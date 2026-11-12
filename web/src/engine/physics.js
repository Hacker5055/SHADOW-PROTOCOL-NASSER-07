/**
 * SHADOW PROTOCOL — Collision world
 * Deterministic AABB world with capsule resolution, step-up, grounded detection
 * and ray casting. Mirrors the Unreal side's UCapsuleComponent + line-trace usage.
 */

export const GRAVITY = -22.0;
export const STEP_HEIGHT = 0.48;

let _boxId = 0;

export class CollisionWorld {
  constructor(opts = {}) {
    /** @type {Array<{id:number,min:[number,number,number],max:[number,number,number],tag:string,solid:boolean,cover:boolean,ai_vision_block:boolean}>} */
    this.boxes = [];
    this.groundFn = opts.groundFn || (() => 0);
    this.waterFn = opts.waterFn || (() => -999);
    this.rayCache = [];
  }

  /** Center + size box. */
  addBox(cx, cy, cz, sx, sy, sz, tag = 'static', flags = {}) {
    const b = {
      id: _boxId++,
      min: [cx - sx / 2, cy - sy / 2, cz - sz / 2],
      max: [cx + sx / 2, cy + sy / 2, cz + sz / 2],
      tag,
      solid: flags.solid !== false,
      cover: !!flags.cover,
      blockVision: flags.blockVision !== false,
      climbable: !!flags.climbable
    };
    this.boxes.push(b);
    return b;
  }

  ground(x, z) { return this.groundFn(x, z); }

  /** True if the point is inside any solid box. */
  pointSolid(x, y, z, pad = 0) {
    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      if (!b.solid) continue;
      if (x > b.min[0] - pad && x < b.max[0] + pad &&
          y > b.min[1] - pad && y < b.max[1] + pad &&
          z > b.min[2] - pad && z < b.max[2] + pad) return b;
    }
    return null;
  }

  /** Highest walkable surface at (x,z) below maxY. */
  surfaceAt(x, z, maxY = 1e9, radius = 0.3) {
    let h = this.ground(x, z);
    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      if (!b.solid) continue;
      if (x + radius < b.min[0] || x - radius > b.max[0]) continue;
      if (z + radius < b.min[2] || z - radius > b.max[2]) continue;
      if (b.max[1] <= maxY + 0.001 && b.max[1] > h) h = b.max[1];
    }
    return h;
  }

  /**
   * Resolve a capsule-vs-world move. Position is the capsule *center-bottom*.
   * Mutates pos and velocity. Returns collision info.
   */
  move(pos, vel, radius, height, dt) {
    const out = { grounded: false, stepped: false, hitWall: false, ceiling: false, water: false };

    // --- horizontal move with per-axis resolve (allows sliding along walls)
    const moveX = vel.x * dt;
    const moveZ = vel.z * dt;
    const steps = Math.max(1, Math.ceil((Math.abs(moveX) + Math.abs(moveZ)) / (radius * 0.7)));
    for (let s = 0; s < steps; s++) {
      this._axisMove(pos, radius, height, moveX / steps, 0, out);
      this._axisMove(pos, radius, height, 0, moveZ / steps, out);
    }

    // --- vertical
    const feet = pos.y;
    vel.y += GRAVITY * dt;
    let ny = feet + vel.y * dt;

    // ground / top-of-box support
    const support = this.surfaceAt(pos.x, pos.z, feet + STEP_HEIGHT, radius);
    if (vel.y <= 0 && ny <= support) {
      // Snap onto support if we were above or within step height of it.
      if (feet >= support - STEP_HEIGHT - 0.02) {
        ny = support;
        vel.y = 0;
        out.grounded = true;
      }
    }
    if (out.grounded) {
      const stepTop = this.surfaceAt(pos.x, pos.z, feet + STEP_HEIGHT + 0.05, radius);
      if (stepTop > ny + 0.001 && stepTop - ny <= STEP_HEIGHT + 0.02) {
        ny = stepTop;
        out.stepped = true;
      }
    }

    // ceiling
    const headY = ny + height;
    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      if (!b.solid) continue;
      if (pos.x + radius < b.min[0] || pos.x - radius > b.max[0]) continue;
      if (pos.z + radius < b.min[2] || pos.z - radius > b.max[2]) continue;
      if (headY > b.min[1] && ny < b.min[1] && vel.y > 0) {
        ny = b.min[1] - height - 0.001;
        vel.y = 0;
        out.ceiling = true;
      }
    }

    // If we would end up inside a box horizontally (e.g. spawn inside geometry), push up.
    if (this.pointSolid(pos.x, ny + height * 0.5, pos.z, -radius * 0.5)) {
      let tries = 0;
      while (this.pointSolid(pos.x, ny + height * 0.5, pos.z, -radius * 0.5) && tries++ < 24) ny += 0.1;
    }

    pos.y = ny;
    // world bound / water
    const water = this.waterFn(pos.x, pos.z);
    if (water > -900 && pos.y < water) {
      out.water = true;
      this.lastWaterDepth = water - pos.y;
    }
    if (pos.y < -30) { pos.y = support; vel.set ? vel.set(0, 0, 0) : (vel.x = vel.y = vel.z = 0); }
    return out;
  }

  _axisMove(pos, radius, height, dx, dz, out) {
    if (dx === 0 && dz === 0) return;
    let nx = pos.x + dx;
    let nz = pos.z + dz;
    const feet = pos.y;
    const head = pos.y + height;
    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      if (!b.solid) continue;
      // ignore anything we can step over or that is above our head
      if (b.max[1] <= feet + 0.02) continue;
      if (b.min[1] >= head - 0.02) continue;
      // horizontal overlap?
      if (nx + radius <= b.min[0] || nx - radius >= b.max[0]) continue;
      if (nz + radius <= b.min[2] || nz - radius >= b.max[2]) continue;

      // Push out along the axis we are moving on.
      if (dx !== 0) {
        nx = dx > 0 ? b.min[0] - radius - 0.001 : b.max[0] + radius + 0.001;
      }
      if (dz !== 0) {
        nz = dz > 0 ? b.min[2] - radius - 0.001 : b.max[2] + radius + 0.001;
      }
      out.hitWall = true;
    }
    pos.x = nx;
    pos.z = nz;
  }

  /** Ray vs AABB slab test. Returns {dist, point, normal, box} or null. */
  raycast(origin, dir, maxDist, opts = {}) {
    const { ignoreTag = null, solidOnly = true, coverOnly = false, blockVision = true } = opts;
    let best = null;
    const ox = origin.x, oy = origin.y, oz = origin.z;
    const dx = dir.x, dy = dir.y, dz = dir.z;
    const invx = 1 / (dx || 1e-9), invy = 1 / (dy || 1e-9), invz = 1 / (dz || 1e-9);

    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      if (solidOnly && !b.solid) continue;
      if (coverOnly && !b.cover) continue;
      if (blockVision && !b.blockVision) continue;
      if (ignoreTag && b.tag === ignoreTag) continue;

      let t1 = (b.min[0] - ox) * invx, t2 = (b.max[0] - ox) * invx;
      let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
      t1 = (b.min[1] - oy) * invy; t2 = (b.max[1] - oy) * invy;
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));
      t1 = (b.min[2] - oz) * invz; t2 = (b.max[2] - oz) * invz;
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));

      if (tmax < 0 || tmin > tmax || tmin > maxDist || tmin < 0.0001) continue;
      if (!best || tmin < best.dist) {
        const px = ox + dx * tmin, py = oy + dy * tmin, pz = oz + dz * tmin;
        // normal from which face was hit
        let nx = 0, ny = 0, nz = 0;
        const eps = 1e-3;
        if (Math.abs(px - b.min[0]) < eps) nx = -1;
        else if (Math.abs(px - b.max[0]) < eps) nx = 1;
        else if (Math.abs(py - b.min[1]) < eps) ny = -1;
        else if (Math.abs(py - b.max[1]) < eps) ny = 1;
        else if (Math.abs(pz - b.min[2]) < eps) nz = -1;
        else nz = 1;
        best = { dist: tmin, point: { x: px, y: py, z: pz }, normal: { x: nx, y: ny, z: nz }, box: b };
      }
    }
    return best;
  }

  /** Ray against terrain heightfield (march). */
  raycastGround(origin, dir, maxDist, step = 0.5) {
    let t = 0;
    while (t < maxDist) {
      const x = origin.x + dir.x * t, y = origin.y + dir.y * t, z = origin.z + dir.z * t;
      if (y <= this.ground(x, z)) return { dist: t, point: { x, y, z }, normal: { x: 0, y: 1, z: 0 } };
      t += step;
    }
    return null;
  }

  /** Line of sight between two points, blocked by solid boxes. */
  lineOfSight(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.001) return true;
    const dir = { x: dx / len, y: dy / len, z: dz / len };
    const hit = this.raycast(a, dir, len, { blockVision: true });
    return !hit;
  }

  /** Find a nearby cover point around a threat direction. */
  findCover(from, threat, radius = 9) {
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      if (!b.cover) continue;
      const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
      const d = Math.hypot(cx - from.x, cz - from.z);
      if (d > radius || d < 0.6) continue;
      // prefer cover whose centre is between us and the threat
      const tx = threat.x - from.x, tz = threat.z - from.z;
      const tl = Math.hypot(tx, tz) || 1;
      const px = cx - from.x, pz = cz - from.z;
      const pl = Math.hypot(px, pz) || 1;
      const dot = (tx / tl) * (px / pl) + (tz / tl) * (pz / pl);
      const score = dot * 2.2 - d * 0.18;
      if (score > bestScore) { bestScore = score; best = b; }
    }
    if (!best) return null;
    // Stand on the far side of the box from the threat.
    const cx = (best.min[0] + best.max[0]) / 2;
    const cz = (best.min[2] + best.max[2]) / 2;
    const tx = cx - threat.x, tz = cz - threat.z;
    const tl = Math.hypot(tx, tz) || 1;
    const off = Math.max(best.max[0] - best.min[0], best.max[2] - best.min[2]) * 0.5 + 0.75;
    return {
      x: cx + (tx / tl) * off,
      y: best.max[1],
      z: cz + (tz / tl) * off,
      box: best
    };
  }

  clearDynamicBodies() {
    this.boxes = this.boxes.filter((b) => !b.dynamic);
  }
}

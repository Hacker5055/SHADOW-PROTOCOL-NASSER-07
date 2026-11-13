/**
 * SHADOW PROTOCOL — Meridian Tower kit (chapter 07)
 *
 * Alexandria harbour at dawn. A 58-floor glass tower: salt-eaten concrete
 * podium, a service core, four arena floors, and a helipad. The palette is
 * pre-dawn blue with the first warm light coming off the water.
 */
import * as THREE from 'three';
import { MAT } from '../engine/materials.js';

const C = {
  concrete: 0x8a8880,
  concreteDark: 0x54524c,
  glass: 0x2a4450,
  steel: 0x4a5158,
  steelDark: 0x30363c,
  floor: 0x6e6c66,
  harbour: 0x14262e,
  accent: 0xc9552a
};

/** Harbour quay: flat concrete with a water edge on the north. */
export function buildHarbourTerrain(world) {
  const ground = (x, z) => {
    let y = Math.sin(x * 0.04) * 0.03 + Math.cos(z * 0.035) * 0.03;
    if (z < -60) y -= Math.min(4, (-60 - z) * 0.25); // the water
    return y;
  };
  world.setTerrain(ground, {
    size: 300, segments: 90,
    material: new THREE.MeshStandardMaterial({ color: C.concrete, roughness: 0.9 })
  });
  world.waterLevel = -3.2;
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 200),
    new THREE.MeshStandardMaterial({ color: C.harbour, roughness: 0.08, metalness: 0.82 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, world.waterLevel, -130);
  world.group.add(sea);
  return { ground };
}

/**
 * The tower block above the roof line: crowns the playable floors and gives
 * Alexandria a silhouette. `baseY` is where it starts, so it never intersects
 * the interiors the player walks through.
 */
export function addTower(world, x, z, w = 34, d = 26, floors = 58, baseY = 0) {
  const fh = 3.6;
  const h = floors * fh;
  // glass curtain wall
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color: C.glass, roughness: 0.22, metalness: 0.72,
      transparent: true, opacity: 0.55
    })
  );
  shell.position.set(x, baseY + h / 2, z);
  world.group.add(shell);
  // structural frame: a column at each corner plus floor slabs every 6 floors
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(1.4, h, 1.4), MAT.concrete(C.concrete));
      col.position.set(x + sx * w / 2, baseY + h / 2, z + sz * d / 2);
      col.castShadow = true;
      world.addObject(col, { solid: true, box: [x + sx * w / 2, baseY + h / 2, z + sz * d / 2, 1.4, h, 1.4], tag: 'column' });
    }
  }
  for (let f = 6; f <= floors; f += 6) {
    world.addBox(x, baseY + f * fh, z, w + 0.6, 0.5, d + 0.6, MAT.concrete(C.concreteDark), { solid: false, blockVision: false });
  }
  return { x, z, w, d, h, fh, floors, baseY };
}

/**
 * One playable floor: a walled room with a stair/atrium opening. `openings`
 * works exactly like the bunker rings — a floor with four solid walls is a
 * sealed box, and that bug has now been made once in this project and is not
 * going to be made again.
 */
export function addFloorPlate(world, { x, z, y = 0, w = 34, d = 26, h = 4.4, openings = [], roof = false }) {
  // slab
  world.addBox(x, y - 0.2, z, w, 0.4, d, MAT.concrete(C.floor), { solid: true });
  // ceiling — omitted for a roof level, which has to be open to the sky
  if (!roof) world.addBox(x, y + h, z, w + 0.6, 0.4, d + 0.6, MAT.concrete(C.concreteDark), { blockVision: true });

  const doorH = 3.0;
  const wall = (cx, cz, len, alongZ, side) => {
    const o = openings.find((op) => op.side === side);
    if (!o) {
      if (alongZ) world.addBox(cx, y + h / 2, cz, 0.4, h, len, MAT.concrete(C.concrete), { cover: true });
      else world.addBox(cx, y + h / 2, cz, len, h, 0.4, MAT.concrete(C.concrete), { cover: true });
      return;
    }
    const dw = Math.min(o.width || 4, len - 1);
    const seg = (len - dw) / 2;
    if (seg > 0.05) {
      for (const s of [-1, 1]) {
        const off = s * (dw / 2 + seg / 2);
        if (alongZ) world.addBox(cx, y + h / 2, cz + off, 0.4, h, seg, MAT.concrete(C.concrete), { cover: true });
        else world.addBox(cx + off, y + h / 2, cz, seg, h, 0.4, MAT.concrete(C.concrete), { cover: true });
      }
    }
    if (alongZ) world.addBox(cx, y + doorH + (h - doorH) / 2, cz, 0.4, h - doorH, dw, MAT.concrete(C.concrete), { cover: true });
    else world.addBox(cx, y + doorH + (h - doorH) / 2, cz, dw, h - doorH, 0.4, MAT.concrete(C.concrete), { cover: true });
  };
  for (const s of [-1, 1]) {
    wall(x + s * w / 2, z, d, true, s < 0 ? 'w' : 'e');
    wall(x, z + s * d / 2, w, false, s < 0 ? 'n' : 's');
  }

  // strip lighting
  for (let i = -1; i <= 1; i++) {
    const pl = new THREE.PointLight(0xdce8f4, 2.0, 20);
    pl.position.set(x + i * (w / 3.4), y + h - 0.7, z);
    world.group.add(pl);
  }
  return { x, z, y, w, d, h };
}

/** Server rack row — the server floor's cover and its visual signature. */
export function addServerRow(world, x, y, z, count = 5, rotY = 0) {
  for (let i = 0; i < count; i++) {
    const rx = x + (i - (count - 1) / 2) * 1.5;
    const px = rx * Math.cos(rotY) - z * Math.sin(rotY);
    const pz = rx * Math.sin(rotY) + z * Math.cos(rotY);
    world.addBox(px, y + 1.1, pz, 1.2, 2.2, 0.9, MAT.metal(C.steelDark), { rotY, cover: true });
    // blinkenlights
    for (let k = 0; k < 5; k++) {
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6),
        new THREE.MeshStandardMaterial({
          color: k % 2 ? 0x40d090 : 0x4090d0,
          emissive: k % 2 ? 0x30c080 : 0x3070b0,
          emissiveIntensity: 2.2
        }));
      led.position.set(px + 0.4, y + 1.9 - k * 0.22, pz + 0.47);
      world.addObject(led, { solid: false, tag: 'led' });
    }
  }
}

/** A two-storey atrium void with a balustrade — the vertical fight. */
export function addAtrium(world, x, y, z, w = 12, d = 12, h = 8.8) {
  for (const s of [-1, 1]) {
    world.addBox(x + s * w / 2, y + 0.5, z, 0.5, 1.0, d, MAT.concrete(C.concreteDark), { cover: true });
    world.addBox(x, y + 0.5, z + s * d / 2, w, 1.0, 0.5, MAT.concrete(C.concreteDark), { cover: true });
  }
  // mezzanine ring
  for (const s of [-1, 1]) {
    world.addBox(x + s * (w / 2 + 2), y + h * 0.55, z, 4, 0.35, d + 6, MAT.concrete(C.floor), { cover: true });
  }
  return { x, y, z, w, d, h };
}

/** Executive level: a long boardroom table and floor-to-ceiling glass. */
export function addBoardroom(world, x, y, z) {
  world.addBox(x, y + 0.78, z, 9, 0.16, 2.6, MAT.wood(), { cover: true });
  for (let i = -3; i <= 3; i++) {
    world.addBox(x + i * 1.4, y + 0.38, z, 0.12, 0.76, 0.12, MAT.metal(C.steel));
  }
  for (let i = -2; i <= 2; i++) {
    world.addBox(x, y + 0.28, z + i * 0.9, 9, 0.5, 0.5, MAT.cloth(0x2a3038), { solid: false });
  }
  // the window wall
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(20, 3.6),
    new THREE.MeshStandardMaterial({ color: 0x1f3a46, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.5 }));
  glass.position.set(x, y + 2.2, z - 12.9);
  world.addObject(glass, { solid: false, tag: 'window-wall' });
  return { x, y, z };
}

/** Helipad on the roof, with the H painted on it and the tower's beacon. */
export function addHelipad(world, x, y, z, r = 9) {
  // `y` is the WALKING surface. The pad disc is sunk so its top is flush with
  // it: a pad raised even 0.8 m over the roof slab is above the engine's step
  // height, and the player simply cannot get onto it.
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.4, 32), MAT.concrete(0x3a3a38));
  pad.position.set(x, y - 0.2, z);
  pad.receiveShadow = true;
  world.addObject(pad, { solid: true, box: [x, y - 0.2, z, r * 2, 0.4, r * 2], tag: 'helipad' });

  // painted H
  const paint = new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: 0.9 });
  world.addBox(x - 1.1, y + 0.02, z, 0.55, 0.02, 4.2, paint, { solid: false, blockVision: false });
  world.addBox(x + 1.1, y + 0.02, z, 0.55, 0.02, 4.2, paint, { solid: false, blockVision: false });
  world.addBox(x, y + 0.02, z, 2.2, 0.02, 0.55, paint, { solid: false, blockVision: false });

  // perimeter lights
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const lx = x + Math.cos(a) * (r - 0.6);
    const lz = z + Math.sin(a) * (r - 0.6);
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0x40a0ff, emissive: 0x2080ff, emissiveIntensity: 2.4 }));
    l.position.set(lx, y + 0.12, lz);
    world.addObject(l, { solid: false, tag: 'pad-light' });
  }
  const beacon = new THREE.PointLight(0x40a0ff, 2.4, 20);
  beacon.position.set(x, y + 0.9, z);
  world.group.add(beacon);
  return { x, y, z, r };
}

/** Guard rail around a roof edge. Non-solid on purpose — see chapter 04. */
export function addRoofRail(world, x1, z1, x2, z2, y) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const ang = Math.atan2(dx, dz);
  world.addBox(x1 + dx / 2, y + 1.0, z1 + dz / 2, 0.07, 0.07, len,
    MAT.metal(C.steel), { rotY: ang, blockVision: false, solid: false });
  const n = Math.max(1, Math.round(len / 2.5));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.0, 6), MAT.metal(C.steel));
    post.position.set(x1 + dx * t, y + 0.5, z1 + dz * t);
    world.addObject(post, { solid: false, tag: 'rail' });
  }
}

/**
 * Service stair between floors. A single straight flight with treads sized to
 * the engine's STEP_HEIGHT: step rise must stay under it or the capsule cannot
 * climb, and each tread must overlap the next or the surfaceAt() query falls
 * between two boxes and the player drops through the flight.
 */
export function addStairwell(world, x, z, fromY, toY, width = 3.0) {
  const rise = 0.2;
  const steps = Math.max(4, Math.round((toY - fromY) / rise));
  const stepRise = (toY - fromY) / steps;
  const run = 0.42; // tread depth; +10% overlap below
  for (let i = 0; i < steps; i++) {
    // tread top sits at fromY + stepRise*(i+1); box is centred so its top matches
    const topY = fromY + stepRise * (i + 1);
    world.addBox(x, topY - 0.12, z - i * run, width, 0.24, run * 1.12, MAT.concrete(C.floor), { cover: false });
  }
  // top landing, wide enough to step off onto the floor slab
  world.addBox(x, toY - 0.12, z - steps * run - 1.0, width, 0.24, 2.4, MAT.concrete(C.floor));
  // handrails: visual only, so they cannot trap the player on the flight
  for (const s of [-1, 1]) {
    world.addBox(x + s * (width / 2), fromY + (toY - fromY) / 2 + 0.55, z - (steps * run) / 2,
      0.08, 0.08, steps * run, MAT.metal(C.steel),
      { rotY: 0, solid: false, blockVision: false });
  }
  return { x, z, fromY, toY, steps, run, topZ: z - steps * run - 1.0 };
}

/** Alexandria pre-dawn sky: warm at the waterline, cold overhead. */
export function addDawnGlow(world, z = -120) {
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 60),
    new THREE.MeshBasicMaterial({
      color: 0xff9a5a, transparent: true, opacity: 0.16,
      depthWrite: false, blending: THREE.AdditiveBlending
    })
  );
  glow.position.set(0, 4, z);
  world.group.add(glow);
}

/** Distant harbour cranes and a breakwater, just to give the horizon scale. */
export function addHarbourSilhouette(world) {
  for (let i = 0; i < 7; i++) {
    const x = -120 + i * 40;
    const h = 14 + (i % 3) * 7;
    world.addBox(x, h / 2, -150, 3.2, h, 3.2, MAT.metal(0x1e2a30), { solid: false, blockVision: false });
    world.addBox(x + 9, h - 1, -150, 20, 1.0, 2.4, MAT.metal(0x1e2a30), { solid: false, blockVision: false });
  }
  world.addBox(0, 0.6, -170, 300, 1.2, 6, MAT.concrete(0x2a3438), { solid: false, blockVision: false });
}

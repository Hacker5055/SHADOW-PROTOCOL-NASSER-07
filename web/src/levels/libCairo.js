/**
 * SHADOW PROTOCOL — shared 1973-era props and architecture kit.
 * Cairo period buildings, archive furniture, signage, lamps and market clutter.
 *
 * Everything here is built from primitives with real collision, so the spaces are
 * walkable and the AI can use them. Used by chapter03 and by future Cairo levels.
 */
import * as THREE from 'three';
import { MAT } from '../engine/materials.js';

// Semantic material aliases built once, so level builders read like art direction
// instead of texture lookups. (MAT exposes factories; these are cached instances.)
let CACHED_MATS = null;
const M = () => {
  if (!CACHED_MATS) {
    CACHED_MATS = {
      plaster: MAT.concrete(0xd6cbb4),
      concrete: MAT.concrete(0xb6b0a2),
      metalGrey: MAT.metal(0x8a8f94),
      metalDark: MAT.metal(0x3a3f43),
      metalRust: MAT.rust(),
      canvas: MAT.cloth(0xb69f7c),
      paper: MAT.cloth(0xe6e0cc),
      wood: MAT.wood(),
      sandbag: MAT.sandbag(),
      brick: MAT.brick(),
      sand: MAT.sand(6)
    };
  }
  return CACHED_MATS;
};

/** Repeating arch (semicircular) made of voussoir blocks. */
export function addArch(world, x, y, z, width, height, depth, mat, rotY = 0) {
  const radius = width / 2;
  const segments = 9;
  for (let i = 0; i < segments; i++) {
    const a = (Math.PI * (i + 0.5)) / segments;
    const px = Math.cos(a) * radius;
    const py = Math.sin(a) * radius;
    const block = world.addBox(
      x + px * Math.cos(rotY), y + py, z + px * Math.sin(rotY),
      (width / segments) * 1.25, height * 0.22, depth, mat, { rotY }
    );
    block.castShadow = true;
  }
  return radius;
}

/** Colonnade: n columns with capitals, returns the column positions. */
export function addColonnade(world, start, end, count, height, radius, mat) {
  const cols = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const x = start.x + (end.x - start.x) * t;
    const z = start.z + (end.z - start.z) * t;
    world.addBox(x, height * 0.5, z, radius * 2, height, radius * 2, mat);
    world.addBox(x, height + 0.12, z, radius * 2.7, 0.24, radius * 2.7, mat); // capital
    cols.push({ x, z });
  }
  return cols;
}

/** A Cairo period building: shell with door and window openings on one face. */
export function addPeriodBuilding(world, {
  x, z, w, d, h, rotY = 0, mat = M().plaster, roofMat = M().concrete,
  doorSide = 'south', windows = 2, balcony = false
} = {}) {
  const wall = 0.28;
  const doorW = 1.35;
  const doorH = 2.3;
  const rot = rotY;

  const place = (lx, lz) => ({
    x: x + lx * Math.cos(rot) - lz * Math.sin(rot),
    z: z + lx * Math.sin(rot) + lz * Math.cos(rot)
  });

  // floor slab
  const floor = place(0, 0);
  world.addBox(floor.x, 0.04, floor.z, w, 0.08, d, M().concrete, { rotY: rot });

  // roof
  const roof = place(0, 0);
  world.addBox(roof.x, h, roof.z, w + 0.4, 0.3, d + 0.4, roofMat, { rotY: rot });

  // four walls, with the door side split around the opening
  const sides = [
    { lx: 0, lz: -d / 2, len: w, rot: 0 },
    { lx: 0, lz: d / 2, len: w, rot: 0 },
    { lx: -w / 2, lz: 0, len: d, rot: Math.PI / 2 },
    { lx: w / 2, lz: 0, len: d, rot: Math.PI / 2 }
  ];

  const isDoorSide = (i) =>
    (doorSide === 'south' && i === 0) || (doorSide === 'north' && i === 1) ||
    (doorSide === 'west' && i === 2) || (doorSide === 'east' && i === 3);

  sides.forEach((s, i) => {
    const centre = place(s.lx, s.lz);
    if (isDoorSide(i)) {
      const sideLen = (s.len - doorW) / 2;
      const offL = place(-(doorW / 2 + sideLen / 2) * Math.cos(s.rot), -(doorW / 2 + sideLen / 2) * Math.sin(s.rot));
      const offR = place((doorW / 2 + sideLen / 2) * Math.cos(s.rot), (doorW / 2 + sideLen / 2) * Math.sin(s.rot));
      world.addBox(offL.x, h / 2, offL.z, sideLen, h, wall, mat, { rotY: rot + s.rot });
      world.addBox(offR.x, h / 2, offR.z, sideLen, h, wall, mat, { rotY: rot + s.rot });
      // lintel over the door
      world.addBox(centre.x, doorH + (h - doorH) / 2, centre.z, doorW, h - doorH, wall, mat, { rotY: rot + s.rot });
    } else {
      // window band: two pierced sections per wall
      const seg = s.len / (windows + 1);
      for (let wi = 0; wi <= windows; wi++) {
        const t = -s.len / 2 + seg * (wi + 0.5);
        const p = place(t * Math.cos(s.rot), t * Math.sin(s.rot));
        world.addBox(p.x, h / 2, p.z, seg * 0.92, h, wall, mat, { rotY: rot + s.rot });
      }
    }
  });

  if (balcony) {
    const b = place(0, -d / 2 - 0.5);
    world.addBox(b.x, 3.1, b.z, w * 0.6, 0.14, 1.1, M().wood, { rotY: rot });
    world.addBox(b.x, 3.6, b.z - 0.5, w * 0.6, 0.9, 0.08, M().metalRust, { rotY: rot, blockVision: false });
  }

  return { x, z, w, d, h, rotY: rot };
}

/** Shuttered kiosk / shopfront with an awning. */
export function addKiosk(world, x, z, rotY = 0, colour = 0x8a5a3a) {
  world.addBox(x, 1.1, z, 2.6, 2.2, 2.0, M().wood, { rotY });
  const shutter = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.5, 0.06),
    new THREE.MeshStandardMaterial({ color: colour, roughness: 0.75, metalness: 0.25 })
  );
  shutter.position.set(x + Math.sin(rotY) * 1.05, 1.35, z + Math.cos(rotY) * 1.05);
  shutter.rotation.y = rotY;
  world.addObject(shutter, { solid: false });
  // awning
  const awning = world.addBox(x + Math.sin(rotY) * 1.4, 2.5, z + Math.cos(rotY) * 1.4,
    3.0, 0.06, 1.6, M().canvas, { rotY, blockVision: false, solid: false });
  awning.rotation.x = -0.22;
  // hanging lamp
  world.addBox(x, 2.2, z + Math.cos(rotY) * 1.0, 0.1, 0.5, 0.1, M().metalDark, { solid: false, blockVision: false });
  return { x, z };
}

/** Street lamp (period: cast iron pole, warm bulb). */
export function addStreetLamp(world, x, z, height = 4.2) {
  world.addBox(x, height / 2, z, 0.16, height, 0.16, M().metalDark);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb85c, emissiveIntensity: 1.6, roughness: 0.4 })
  );
  lamp.position.set(x, height + 0.1, z);
  world.addObject(lamp, { solid: false });
  return { x, y: height, z };
}

/** Market stall: table, crates, striped canopy. */
export function addMarketStall(world, x, z, rotY = 0) {
  world.addBox(x, 0.78, z, 2.0, 0.12, 1.1, M().wood, { rotY });
  for (const dx of [-0.85, 0.85]) {
    world.addBox(x + Math.cos(rotY) * dx, 0.38, z - Math.sin(rotY) * dx, 0.1, 0.76, 0.9, M().wood, { rotY });
  }
  // canopy
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.04, 1.6),
    new THREE.MeshStandardMaterial({ color: 0xb03a2e, roughness: 0.9, side: THREE.DoubleSide })
  );
  canopy.position.set(x, 2.0, z);
  canopy.rotation.y = rotY;
  world.addObject(canopy, { solid: false });
  world.addBox(x, 1.98, z, 2.4, 0.03, 0.06, M().canvas, { rotY, solid: false, blockVision: false });
  // crates
  for (let i = 0; i < 3; i++) {
    world.addBox(x - 0.7 + i * 0.7, 1.0, z + 0.25, 0.5, 0.36, 0.42, M().wood, { rotY });
  }
  return { x, z };
}

/** Filing cabinet row — the archive's visual language. */
export function addFilingRow(world, start, end, count, height = 1.9) {
  const cabinets = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const x = start.x + (end.x - start.x) * t;
    const z = start.z + (end.z - start.z) * t;
    const rotY = Math.atan2(end.x - start.x, end.z - start.z);
    world.addBox(x, height / 2, z, 0.9, height, 0.62, M().metalGrey, { rotY, cover: true });
    // drawer handles
    for (let d = 0; d < 4; d++) {
      world.addBox(x, 0.3 + d * 0.42, z, 0.22, 0.05, 0.05, M().metalDark,
        { rotY, solid: false, blockVision: false });
    }
    cabinets.push({ x, z });
  }
  return cabinets;
}

/** Shelving stack for period documents. */
export function addShelfStack(world, x, z, rotY = 0, bays = 3) {
  for (let b = 0; b < bays; b++) {
    const offset = (b - (bays - 1) / 2) * 1.1;
    world.addBox(x + Math.cos(rotY) * offset, 1.0, z - Math.sin(rotY) * offset,
      1.0, 2.0, 0.42, M().wood, { rotY, cover: true });
    for (let s = 0; s < 4; s++) {
      world.addBox(x + Math.cos(rotY) * offset, 0.35 + s * 0.5, z - Math.sin(rotY) * offset + 0.2,
        0.92, 0.34, 0.06, M().paper, { rotY, solid: false, blockVision: false });
    }
  }
}

/** Reading desk with a banker's lamp — where documents get read. */
export function addReadingDesk(world, x, z, rotY = 0) {
  world.addBox(x, 0.76, z, 1.9, 0.1, 0.95, M().wood, { rotY, cover: true });
  for (const [dx, dz] of [[-0.8, -0.35], [0.8, -0.35], [-0.8, 0.35], [0.8, 0.35]]) {
    world.addBox(x + dx, 0.38, z + dz, 0.1, 0.76, 0.1, M().wood, { rotY });
  }
  const lamp = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.24, 10, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x2a3a2a, emissive: 0xffc978, emissiveIntensity: 0.9,
      roughness: 0.7, side: THREE.DoubleSide
    })
  );
  lamp.position.set(x, 1.02, z);
  world.addObject(lamp, { solid: false });
  // papers on the desk
  for (let i = 0; i < 4; i++) {
    world.addBox(x - 0.5 + i * 0.28, 0.82, z + 0.1, 0.22, 0.01, 0.3, M().paper,
      { rotY, solid: false, blockVision: false });
  }
  return { x, z };
}

/** Wall-mounted map board (used for the operations board and briefing walls). */
export function addMapBoard(world, x, z, rotY = 0, w = 2.4, h = 1.4) {
  world.addBox(x, 2.0, z, w, h, 0.08, M().paper, { rotY, cover: true });
  world.addBox(x, 2.0, z - 0.06, w + 0.16, h + 0.16, 0.04, M().wood, { rotY, solid: false, blockVision: false });
}

/** Sandbag emplacement (period-appropriate even in a city). */
export function addSandbags(world, x, z, rotY = 0, length = 2.4) {
  const bags = Math.max(2, Math.round(length / 0.55));
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < bags; i++) {
      const t = (i - (bags - 1) / 2) * 0.55 + (row ? 0.27 : 0);
      world.addBox(
        x + Math.cos(rotY) * t, 0.16 + row * 0.3, z - Math.sin(rotY) * t,
        0.5, 0.28, 0.42, M().sandbag, { rotY, cover: true }
      );
    }
  }
}

/** Roof-parapet edge, so rooftop spaces are safe and readable. */
export function addParapet(world, cx, cz, w, d, h = 0.9) {
  world.addBox(cx, h / 2, cz - d / 2, w, h, 0.22, M().concrete);
  world.addBox(cx, h / 2, cz + d / 2, w, h, 0.22, M().concrete);
  world.addBox(cx - w / 2, h / 2, cz, 0.22, h, d, M().concrete);
  world.addBox(cx + w / 2, h / 2, cz, 0.22, h, d, M().concrete);
}

/** Interior ceiling fluorescent strip with a soft glow (period: bare tubes). */
export function addCeilingStrip(world, x, y, z, length = 3.2, rotY = 0) {
  world.addBox(x, y, z, length, 0.08, 0.14, M().metalGrey, { rotY, solid: false, blockVision: false });
  const tube = new THREE.Mesh(
    new THREE.BoxGeometry(length * 0.94, 0.05, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xdfe8e4, emissive: 0xdfe8e4, emissiveIntensity: 1.2 })
  );
  tube.position.set(x, y - 0.06, z);
  tube.rotation.y = rotY;
  world.addObject(tube, { solid: false });
}

/** Arabic wall signage panel. */
export function addSignage(world, x, y, z, rotY, w, h, colour = 0x1f2a24) {
  world.addBox(x, y, z, w, h, 0.06, M().metalDark, { rotY, solid: false, blockVision: false });
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.94, h * 0.9),
    new THREE.MeshStandardMaterial({ color: colour, roughness: 0.8 })
  );
  panel.position.set(x + Math.sin(rotY) * 0.04, y, z + Math.cos(rotY) * 0.04);
  panel.rotation.y = rotY;
  world.addObject(panel, { solid: false });
}

/**
 * SHADOW PROTOCOL — Danube freight yard kit (chapter 05)
 *
 * Visual identity: a cold blue industrial rail yard after midnight. Container
 * stacks, gantry cranes, floodlight masts, rail spurs, a locked maintenance
 * shed, and the safehouse: a warm-lit third-floor flat that is the only warm
 * thing in the chapter.
 */
import * as THREE from 'three';
import { MAT } from '../engine/materials.js';

const C = {
  ballast: 0x37363a,
  rail: 0x6e6a63,
  containerA: 0x4a5a54,
  containerB: 0x6b4a3e,
  containerC: 0x39505f,
  concrete: 0x8a857c,
  steel: 0x3a3f44,
  shed: 0x555a52
};

/** Flat gravel yard with shallow drainage dips. */
export function buildYardTerrain(world) {
  const ground = (x, z) => {
    let y = Math.sin(x * 0.05) * 0.03 + Math.cos(z * 0.04) * 0.03;
    if (Math.abs(x) < 6) y -= 0.12; // drainage channel down the middle
    return y;
  };
  world.setTerrain(ground, {
    size: 320, segments: 110,
    material: new THREE.MeshStandardMaterial({ color: C.ballast, roughness: 0.98 })
  });
  return { ground };
}

/** A stack of shipping containers: the yard's main cover object. */
export function addContainerStack(world, x, z, { rows = 3, high = 2, rotY = 0, seed = 0 } = {}) {
  const palette = [C.containerA, C.containerB, C.containerC];
  for (let r = 0; r < rows; r++) {
    for (let h = 0; h < high; h++) {
      // stagger the top row so the stack silhouette is not a perfect block
      const jitter = h > 0 ? ((seed + r) % 2 ? 0.8 : -0.8) : 0;
      const lx = (r - (rows - 1) / 2) * 2.6;
      const px = x + lx * Math.cos(rotY) - jitter * Math.sin(rotY);
      const pz = z + lx * Math.sin(rotY) + jitter * Math.cos(rotY);
      const mat = MAT.container(palette[(r + h + seed) % palette.length]);
      world.addBox(px, 1.3 + h * 2.6, pz, 2.45, 2.55, 6.1, mat, { rotY, cover: true });
      // corrugation ribs, purely visual
      for (let k = -2; k <= 2; k++) {
        const rx = px + (k * 1.1) * Math.cos(rotY);
        const rz = pz + (k * 1.1) * Math.sin(rotY);
        world.addBox(rx, 1.3 + h * 2.6, rz, 0.06, 2.4, 6.0, MAT.metal(0x2a2e31),
          { rotY, solid: false, blockVision: false });
      }
    }
  }
  return { x, z };
}

/** Gantry crane spanning the rail spurs. */
export function addGantryCrane(world, x, z, span = 26, height = 16) {
  for (const sz of [-span / 2, span / 2]) {
    for (const sx of [-3, 3]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, height, 0.9), MAT.metal(C.steel));
      leg.position.set(x + sx, height / 2, z + sz);
      leg.castShadow = true;
      world.addObject(leg, { solid: true, box: [x + sx, height / 2, z + sz, 0.9, height, 0.9], tag: 'crane' });
    }
  }
  world.addBox(x, height, z, 7, 1.2, span, MAT.metal(C.steel), { blockVision: false });
  // trolley
  world.addBox(x, height - 1.6, z + 6, 3.2, 1.6, 4, MAT.metal(0x22262a), { solid: false, blockVision: false });
  const lamp = new THREE.PointLight(0xffd9a0, 3.5, 26);
  lamp.position.set(x, height - 2.6, z + 6);
  world.group.add(lamp);
  return { x, z, span, height };
}

/** Floodlight mast — the yard's only real illumination. */
export function addFloodlightMast(world, x, z, h = 12) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, h, 8), MAT.metal(0x2b2f33));
  pole.position.set(x, h / 2, z);
  pole.castShadow = true;
  world.addObject(pole, { solid: true, box: [x, h / 2, z, 0.4, h, 0.4], tag: 'mast' });
  for (let i = -1; i <= 1; i++) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.35),
      new THREE.MeshStandardMaterial({ color: 0xfff2d0, emissive: 0xffe0a0, emissiveIntensity: 2.6 }));
    head.position.set(x + i * 0.8, h, z);
    world.addObject(head, { solid: false, tag: 'floodlight' });
  }
  const light = new THREE.SpotLight(0xffe8c0, 9, 42, 0.72, 0.55, 1.4);
  light.position.set(x, h - 0.4, z);
  light.target.position.set(x, 0, z + 3);
  world.group.add(light);
  world.group.add(light.target);
}

/** A rail spur with sleepers and two rails. */
export function addRailSpur(world, z, fromX, toX) {
  for (let x = fromX; x <= toX; x += 1.4) {
    world.addBox(x, 0.06, z, 0.5, 0.14, 2.6, MAT.wood(), { solid: false, blockVision: false });
  }
  for (const off of [-0.72, 0.72]) {
    world.addBox((fromX + toX) / 2, 0.17, z + off, toX - fromX, 0.14, 0.1,
      MAT.metal(C.rail), { solid: false, blockVision: false });
  }
}

/** Maintenance shed: solid walls, one door, useful as an objective room. */
export function addShed(world, x, z, w = 10, d = 7, h = 4.2, rotY = 0) {
  world.addBox(x, h / 2, z, w, h, 0.3, MAT.concrete(C.shed), { rotY, cover: true });
  world.addBox(x, h / 2, z + d, w, h, 0.3, MAT.concrete(C.shed), { rotY, cover: true });
  world.addBox(x - w / 2, h / 2, z + d / 2, 0.3, h, d, MAT.concrete(C.shed), { rotY, cover: true });
  world.addBox(x + w / 2, h / 2, z + d / 2, 0.3, h, d, MAT.concrete(C.shed), { rotY, cover: true });
  world.addBox(x, h, z + d / 2, w + 0.6, 0.3, d + 0.6, MAT.metal(C.steel), { rotY });
  // interior lamp
  const lamp = new THREE.PointLight(0xc8d8ff, 1.6, 12);
  lamp.position.set(x, h - 0.7, z + d / 2);
  world.group.add(lamp);
  return { x, z, w, d, h, rotY };
}

/**
 * The safehouse flat. Warm light, a table, a kettle, a television — the only
 * room in the game that is not trying to kill the player.
 */
export function addSafehouse(world, x, z, floor = 6.5) {
  const w = 9, d = 7;
  // shell (open on the south so the camera can see in)
  world.addBox(x, floor / 2, z, w, floor, d, MAT.concrete(0x6a6055), { cover: true });
  world.addBox(x, floor + 1.3, z, w, 2.6, d, MAT.concrete(0x7d7161), { cover: true });

  // warm interior light
  const warm = new THREE.PointLight(0xffb870, 7, 18, 1.6);
  warm.position.set(x, floor + 1.9, z);
  world.group.add(warm);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb060, emissiveIntensity: 3 }));
  lamp.position.set(x, floor + 2.3, z);
  world.addObject(lamp, { solid: false, tag: 'safehouse-lamp' });

  // table, chairs, kit on the floor
  world.addBox(x, floor + 0.75, z, 2.0, 0.08, 1.1, MAT.wood(), { solid: false });
  for (const sx of [-0.9, 0.9]) for (const sz of [-0.45, 0.45]) {
    world.addBox(x + sx, floor + 0.38, z + sz, 0.07, 0.75, 0.07, MAT.wood(), { solid: false });
  }
  // a kettle and three cups: the quiet details
  const kettle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.24, 10), MAT.metal(0x9aa0a6));
  kettle.position.set(x + 0.5, floor + 0.9, z - 0.1);
  world.addObject(kettle, { solid: false, tag: 'kettle' });
  for (let i = 0; i < 3; i++) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.038, 0.08, 8), MAT.cloth(0xd8d0c0));
    cup.position.set(x - 0.6 + i * 0.28, floor + 0.84, z + 0.24);
    world.addObject(cup, { solid: false, tag: 'cup' });
  }
  // rifle rack against the wall
  world.addBox(x - 3.4, floor + 0.6, z + 1.2, 0.1, 1.2, 2.2, MAT.metal(0x2e3236), { solid: false });
  for (let i = 0; i < 3; i++) {
    world.addBox(x - 3.3, floor + 0.75, z + 0.4 + i * 0.7, 0.05, 0.9, 0.09, MAT.metal(0x1f2326), { solid: false });
  }
  return { x, z, floor };
}

/** Furniture/item pickup marker: a small glowing object used for objectives. */
export function addPickup(world, x, y, z, colour = 0x66d9a0, radius = 0.16) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8),
    new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 2.2 }));
  mesh.position.set(x, y, z);
  world.addObject(mesh, { solid: false, tag: 'pickup' });
  const light = new THREE.PointLight(colour, 1.1, 4);
  light.position.set(x, y + 0.1, z);
  world.group.add(light);
  return mesh;
}

/** Utility poles and sagging cable — cheap, and they sell the space. */
export function addUtilityPole(world, x, z, h = 8) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, h, 7), MAT.wood());
  pole.position.set(x, h / 2, z);
  world.addObject(pole, { solid: true, box: [x, h / 2, z, 0.36, h, 0.36], tag: 'pole' });
  world.addBox(x, h - 0.4, z, 1.8, 0.1, 0.1, MAT.wood(), { solid: false, blockVision: false });
}

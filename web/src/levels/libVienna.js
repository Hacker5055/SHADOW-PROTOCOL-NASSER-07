/**
 * SHADOW PROTOCOL — Vienna Canal District kit (chapter 04)
 *
 * Visual identity: cold blue-grey night, wet cobbles, pale fin-de-siecle stone,
 * tram rails, a canal embankment with iron railings, market awnings, and sodium
 * street lighting. Everything is procedural — no external assets.
 */
import * as THREE from 'three';
import { MAT } from '../engine/materials.js';

const C = {
  stone: 0x9a958c,
  stoneDark: 0x6d6a64,
  cobble: 0x4a4a4c,
  rail: 0x2b2c2e,
  tram: 0x8f2b28,
  awning: 0x2e4a3c,
  shop: 0x1c1712,
  plaster: 0xb6a894
};

/**
 * Wet cobble ground with tram rails cut across it.
 * The fan is deliberately gentle: chapter 04 is a street fight, not a hill.
 */
export function buildViennaTerrain(world) {
  const ground = (x, z) => {
    // almost flat, with a shallow canal embankment slope on the west
    let y = Math.sin(x * 0.02) * 0.05 + Math.cos(z * 0.017) * 0.04;
    if (x < -120) y -= Math.min(6, (-120 - x) * 0.13);
    return y;
  };
  world.setTerrain(ground, {
    size: 460, segments: 140,
    material: new THREE.MeshStandardMaterial({ color: C.cobble, roughness: 0.55, metalness: 0.16 })
  });
  return { ground };
}

/** A pale stone apartment block with a lit ground-floor shopfront. */
export function addViennaBlock(world, x, z, w, d, h, rotY = 0, opts = {}) {
  const wallMat = MAT.concrete(opts.colour ?? C.stone);
  const trimMat = MAT.concrete(C.stoneDark);

  world.addBox(x, h / 2, z, w, h, d, wallMat, { rotY, cover: true });

  // cornice
  world.addBox(x, h + 0.2, z, w + 0.5, 0.4, d + 0.5, trimMat, { rotY });

  // window grid on the two long faces
  const rows = Math.max(1, Math.floor((h - 3) / 3.2));
  const cols = Math.max(2, Math.floor(w / 2.6));
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x141a20, emissive: 0x2a3a48, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.5
  });
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lx = -w / 2 + (w / cols) * (c + 0.5);
      for (const side of [-1, 1]) {
        const lz = (d / 2 + 0.02) * side;
        const px = x + lx * Math.cos(rotY) - lz * Math.sin(rotY);
        const pz = z + lx * Math.sin(rotY) + lz * Math.cos(rotY);
        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.6), windowMat);
        win.position.set(px, 3.4 + r * 3.2, pz);
        win.rotation.y = rotY + (side < 0 ? Math.PI : 0);
        win.matrixAutoUpdate = false;
        win.updateMatrix();
        world.addObject(win, { solid: false, tag: 'window' });
      }
    }
  }

  // ground-floor shopfront glow
  const glow = new THREE.PointLight(0xffca7a, 2.2, 14);
  glow.position.set(x, 2.2, z + (d / 2 + 0.6));
  world.group.add(glow);

  return { x, z, w, d, h, rotY };
}

/** Iron canal railing along a line. */
export function addCanalRailing(world, x1, z1, x2, z2, y = 0) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const ang = Math.atan2(dx, dz);
  const n = Math.max(1, Math.round(len / 2.4));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const px = x1 + dx * t, pz = z1 + dz * t;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.05, 6), MAT.metal(C.rail));
    post.position.set(px, y + 0.52, pz);
    world.addObject(post, { solid: false, tag: 'railing' });
  }
  // Top rail. Marked non-solid: an 8 cm bar is visually a railing but as a
  // collider it walls off entire streets, and the squad's steer() has no way
  // around it. The posts already imply the barrier.
  world.addBox(x1 + dx / 2, y + 1.05, z1 + dz / 2, 0.08, 0.08, len, MAT.metal(C.rail),
    { rotY: ang, blockVision: false, solid: false });
  return { x1, z1, x2, z2, y };
}

/** A tram: static bodywork with lit windows, used as a moving hazard. */
export function buildTram(world, x, z, rotY = 0) {
  const body = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.1, 12), MAT.metal(C.tram));
  hull.position.y = 1.75;
  hull.castShadow = true;
  body.add(hull);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.66, 0.5, 12), MAT.metal(0xd8d2c4));
  stripe.position.y = 1.2;
  body.add(stripe);
  const glass = new THREE.MeshStandardMaterial({
    color: 0x0d1318, emissive: 0xffe0a8, emissiveIntensity: 0.55, roughness: 0.25
  });
  for (let i = -2; i <= 2; i++) {
    for (const side of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), glass);
      w.position.set(side * 1.31, 2.3, i * 2.2);
      w.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      body.add(w);
    }
  }
  const beam = new THREE.SpotLight(0xfff0cc, 6, 40, 0.5, 0.5, 1.2);
  beam.position.set(0, 1.4, 6);
  beam.target.position.set(0, 0, 20);
  body.add(beam);
  body.add(beam.target);
  body.position.set(x, 0, z);
  body.rotation.y = rotY;
  world.group.add(body);
  return body;
}

/** Tram rails sunk into the road. */
export function addTramRails(world, z, fromX, toX) {
  for (const off of [-0.72, 0.72]) {
    world.addBox((fromX + toX) / 2, 0.03, z + off, Math.abs(toX - fromX), 0.06, 0.12,
      MAT.metal(0x8d9298), { blockVision: false });
  }
}

/** Market hall: a big open iron-and-glass shed. */
export function addMarketHall(world, x, z, w, d, h) {
  // corner columns
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, h, 8), MAT.metal(0x3a3f44));
      col.position.set(x + sx * w / 2, h / 2, z + sz * d / 2);
      col.castShadow = true;
      world.addObject(col, { solid: false, tag: 'column' });
    }
  }
  // roof
  world.addBox(x, h, z, w + 1, 0.25, d + 1, MAT.metal(0x2a2f33), { blockVision: true });
  // stalls inside
  for (let i = -2; i <= 2; i++) {
    addMarketStall(world, x + i * 5, z - 4, 0);
    addMarketStall(world, x + i * 5, z + 4, Math.PI);
  }
  return { x, z, w, d, h };
}

export function addMarketStall(world, x, z, rotY = 0) {
  world.addBox(x, 0.85, z, 2.6, 0.12, 1.2, MAT.wood(), { rotY });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.85, 0.09), MAT.wood());
      leg.position.set(x + sx * 1.2, 0.42, z + sz * 0.5);
      world.addObject(leg, { solid: false, tag: 'leg' });
    }
  }
  // awning
  const aw = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.06, 1.5), MAT.cloth(C.awning));
  aw.position.set(x, 2.0, z);
  aw.rotation.set(-0.18, rotY, 0);
  world.addObject(aw, { solid: false, tag: 'awning' });
}

/** Metro stair entrance: a hole in the pavement with a railed stairwell. */
export function addMetroEntrance(world, x, z, rotY = 0) {
  // surround
  world.addBox(x, 0.5, z - 3.2, 6.4, 1.0, 0.4, MAT.concrete(0x6f6a62), { rotY, cover: true });
  world.addBox(x, 0.5, z + 3.2, 6.4, 1.0, 0.4, MAT.concrete(0x6f6a62), { rotY, cover: true });
  // the descending stairwell, sunk into the ground
  const pit = new THREE.Mesh(
    new THREE.BoxGeometry(5.6, 3.4, 6.0),
    new THREE.MeshStandardMaterial({ color: 0x0a0d10, roughness: 1 })
  );
  pit.position.set(x, -1.7, z);
  world.group.add(pit);
  // steps
  for (let i = 0; i < 10; i++) {
    world.addBox(x, -0.16 - i * 0.32, z - 2.6 + i * 0.55, 5.2, 0.32, 0.55, MAT.concrete(0x55524c), { rotY });
  }
  const lamp = new THREE.PointLight(0xffd9a0, 1.4, 10);
  lamp.position.set(x, 0.6, z - 2.6);
  world.group.add(lamp);
  return { x, z, rotY };
}

/** Ornate street lamp, warmer and taller than the Cairo one. */
export function addViennaLamp(world, x, z, h = 5.2) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, h, 8), MAT.metal(0x23262a));
  pole.position.set(x, h / 2, z);
  pole.castShadow = true;
  world.addObject(pole, { solid: false, tag: 'lamp' });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffe6b0, emissive: 0xffc870, emissiveIntensity: 1.6, roughness: 0.4 }));
  head.position.set(x, h + 0.1, z);
  world.addObject(head, { solid: false, tag: 'lamp' });
  const light = new THREE.PointLight(0xffcf8a, 2.6, 18);
  light.position.set(x, h, z);
  world.group.add(light);
}

/** Parked car, useful as waist-high cover on the street. */
export function addParkedCar(world, x, z, rotY = 0, colour = 0x2c3036) {
  world.addBox(x, 0.72, z, 1.85, 0.72, 4.3, MAT.metal(colour), { rotY, cover: true });
  world.addBox(x, 1.28, z - 0.15, 1.6, 0.5, 1.9, MAT.glass(), { rotY, blockVision: true });
  return { x, z };
}

/** CCTV camera on a bracket, with a visible red tally light. */
export function addCCTV(world, x, y, z, rotY = 0) {
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.7), MAT.metal(0x2a2d31));
  arm.position.set(x, y, z);
  arm.rotation.y = rotY;
  world.addObject(arm, { solid: false, tag: 'cctv' });

  const bodyG = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.5), MAT.metal(0x3d4248));
  bodyG.add(shell);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10),
    new THREE.MeshStandardMaterial({ color: 0x05070a, emissive: 0x220000, roughness: 0.2 }));
  lens.rotation.x = Math.PI / 2;
  lens.position.z = 0.26;
  bodyG.add(lens);
  const tally = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff1100, emissiveIntensity: 2.4 }));
  tally.position.set(0.1, 0.09, 0.2);
  bodyG.add(tally);

  bodyG.position.set(x + Math.sin(rotY) * 0.4, y - 0.16, z + Math.cos(rotY) * 0.4);
  world.group.add(bodyG);

  // slow pan, so the camera reads as live hardware
  world.addAnimated((dt) => {
    bodyG.rotation.y += dt * 0.25;
  });
  return bodyG;
}

/** Hotel facade with a lit entrance — the chapter's target. */
export function addHotelEntrance(world, x, z, rotY = 0) {
  world.addBox(x, 2.6, z, 7, 5.2, 0.5, MAT.concrete(0x3a3630), { rotY, cover: true });
  // canopy
  world.addBox(x, 5.0, z + 1.6, 8, 0.25, 3.4, MAT.metal(0x23252a), { rotY });
  for (const sx of [-1, 1]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 4.9, 10), MAT.metal(0xb8b0a0));
    col.position.set(x + sx * 3.2, 2.45, z + 2.8);
    world.addObject(col, { solid: false, tag: 'column' });
  }
  // door glow
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.2),
    new THREE.MeshStandardMaterial({ color: 0x1a2028, emissive: 0xffcf92, emissiveIntensity: 0.9, roughness: 0.3 }));
  door.position.set(x, 1.65, z + 0.28);
  door.rotation.y = rotY;
  world.addObject(door, { solid: false, tag: 'door' });
  const light = new THREE.PointLight(0xffd7a0, 5, 22);
  light.position.set(x, 3.4, z + 2.6);
  world.group.add(light);
  return { x, z };
}

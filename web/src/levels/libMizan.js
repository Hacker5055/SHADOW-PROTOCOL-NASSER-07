/**
 * SHADOW PROTOCOL — Facility Mizan kit (chapter 06)
 *
 * A 1960s Soviet-supplied bunker under a Western Desert salt flat: poured
 * concrete, cold strip lighting, ribbed blast doors, cable trays, and four
 * concentric rings. Above ground is sandstorm and nothing else.
 */
import * as THREE from 'three';
import { MAT } from '../engine/materials.js';

const C = {
  sand: 0xb8a882,
  concrete: 0x7d7a72,
  concreteDark: 0x565550,
  steel: 0x3c4248,
  floor: 0x62605a,
  accent: 0x8a2a22
};

/** Salt flat above the bunker: dead flat, blowing sand. */
export function buildMizanTerrain(world) {
  const ground = (x, z) => {
    // salt flats are flat; the only relief is drift against the bunker mouth
    const d = Math.hypot(x, z + 40);
    return d < 30 ? Math.max(0, (30 - d) * 0.05) : 0;
  };
  world.setTerrain(ground, {
    size: 420, segments: 90,
    material: new THREE.MeshStandardMaterial({ color: C.sand, roughness: 1.0 })
  });
  // the salt crust: pale, cracked, and slightly reflective
  const crust = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xd8cdb4, roughness: 0.35, metalness: 0.05 })
  );
  crust.rotation.x = -Math.PI / 2;
  crust.position.y = 0.02;
  crust.receiveShadow = true;
  world.group.add(crust);
  return { ground };
}

/**
 * A bunker corridor: floor, ceiling, two walls, and strip lights every few
 * metres. `axis` is 'x' or 'z'. Returns the walkable span so ring geometry can
 * be chained without gaps.
 */
export function addCorridor(world, { x, z, length, axis = 'z', width = 4.2, height = 3.4 }) {
  const along = axis === 'z';
  const sx = along ? width : length;
  const sz = along ? length : width;

  world.addBox(x, -0.15, z, sx, 0.3, sz, MAT.concrete(C.floor), { solid: true, cover: false });
  world.addBox(x, height, z, sx, 0.3, sz, MAT.concrete(C.concreteDark), { blockVision: true });

  const wallOff = width / 2;
  for (const s of [-1, 1]) {
    if (along) world.addBox(x + s * wallOff, height / 2, z, 0.3, height, length, MAT.concrete(C.concrete), { cover: true });
    else world.addBox(x, height / 2, z + s * wallOff, length, height, 0.3, MAT.concrete(C.concrete), { cover: true });
  }

  // strip lights down the centre line
  const n = Math.max(1, Math.floor(length / 6));
  for (let i = 0; i < n; i++) {
    const t = -length / 2 + (length / n) * (i + 0.5);
    const lx = along ? x : x + t;
    const lz = along ? z + t : z;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(along ? 0.5 : 1.6, 0.08, along ? 1.6 : 0.5),
      new THREE.MeshStandardMaterial({ color: 0xdfe8f0, emissive: 0xa8c8e0, emissiveIntensity: 1.9 }));
    strip.position.set(lx, height - 0.16, lz);
    world.addObject(strip, { solid: false, tag: 'strip-light' });
    if (i % 2 === 0) {
      const pl = new THREE.PointLight(0xcfe0f0, 1.5, 11);
      pl.position.set(lx, height - 0.5, lz);
      world.group.add(pl);
    }
  }
  return { x, z, length, axis, width, height };
}

/**
 * A ring chamber: square room used as the hub of each bunker level.
 *
 * `openings` describes doorways cut through the walls, because a ring with four
 * solid walls is a sealed box — the first build of this chapter had exactly
 * that and the entire bunker below the entrance was unreachable. Each opening
 * is { side: 'n'|'s'|'e'|'w', width }. A side without an opening stays solid.
 */
export function addRingChamber(world, x, z, size = 22, height = 5.2, name = 'ring', openings = []) {
  const doorH = 3.4;
  world.addBox(x, -0.15, z, size, 0.3, size, MAT.concrete(C.floor), { solid: true });
  world.addBox(x, height, z, size + 1, 0.4, size + 1, MAT.concrete(C.concreteDark), { blockVision: true });

  const wallFor = (side) => openings.find((o) => o.side === side);
  // Builds one wall, split around a doorway if this side has one.
  const wall = (cx, cz, len, rotY, side) => {
    const o = wallFor(side);
    if (!o) {
      world.addBox(cx, height / 2, cz, rotY ? 0.4 : len, height, rotY ? len : 0.4, MAT.concrete(C.concrete), { cover: true });
      return;
    }
    const dw = Math.min(o.width || 4, len - 1);
    const seg = (len - dw) / 2;
    if (seg > 0.05) {
      for (const s of [-1, 1]) {
        const off = s * (dw / 2 + seg / 2);
        if (rotY) world.addBox(cx, height / 2, cz + off, 0.4, height, seg, MAT.concrete(C.concrete), { cover: true });
        else world.addBox(cx + off, height / 2, cz, seg, height, 0.4, MAT.concrete(C.concrete), { cover: true });
      }
    }
    // lintel over the doorway
    if (rotY) world.addBox(cx, doorH + (height - doorH) / 2, cz, 0.4, height - doorH, dw, MAT.concrete(C.concrete), { cover: true });
    else world.addBox(cx, doorH + (height - doorH) / 2, cz, dw, height - doorH, 0.4, MAT.concrete(C.concrete), { cover: true });
  };

  for (const s of [-1, 1]) {
    wall(x + s * size / 2, z, size, true, s < 0 ? 'w' : 'e');
    wall(x, z + s * size / 2, size, false, s < 0 ? 'n' : 's');
  }
  // a ring of ceiling lamps
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const lx = x + Math.cos(a) * (size * 0.28);
    const lz = z + Math.sin(a) * (size * 0.28);
    const pl = new THREE.PointLight(0xbfd4e8, 2.2, 16);
    pl.position.set(lx, height - 0.6, lz);
    world.group.add(pl);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.18, 10), MAT.metal(C.steel));
    shade.position.set(lx, height - 0.35, lz);
    world.addObject(shade, { solid: false, tag: 'lamp' });
  }
  void name;
  return { x, z, size, height, openings };
}

/** Heavy ribbed blast door — the thing that makes a bunker read as a bunker. */
export function addBlastDoor(world, x, z, rotY = 0, width = 3.6) {
  world.addBox(x, 1.9, z, width, 3.8, 0.42, MAT.metal(C.steel), { rotY, cover: true });
  for (let i = -2; i <= 2; i++) {
    world.addBox(x, 1.9 + i * 0.7, z + 0.24 * Math.cos(rotY), width - 0.5, 0.1, 0.06,
      MAT.metal(0x596068), { rotY, solid: false, blockVision: false });
  }
  // hazard chevrons
  world.addBox(x, 3.95, z, width, 0.3, 0.46, MAT.metal(C.accent), { rotY });
}

/** Laser tripwire: a red beam across a corridor and the emitter that casts it. */
export function addTripwire(world, x, y, z, length, axis = 'x') {
  const along = axis === 'x';
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(along ? length : 0.035, 0.035, along ? 0.035 : length),
    new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.75 })
  );
  beam.position.set(x, y, z);
  world.addObject(beam, { solid: false, tag: 'tripwire' });
  for (const s of [-1, 1]) {
    const emit = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), MAT.metal(0x2a2e33));
    emit.position.set(
      x + (along ? s * length / 2 : 0),
      y,
      z + (along ? 0 : s * length / 2)
    );
    world.addObject(emit, { solid: false, tag: 'emitter' });
  }
  return { beam, x, y, z, length, axis };
}

/** Stacked archive shelving — the Records ring's cover. */
export function addArchiveShelving(world, x, z, bayCount = 4, height = 2.6) {
  for (let i = 0; i < bayCount; i++) {
    const bx = x + i * 2.4;
    for (let level = 0; level < 3; level++) {
      const y = 0.7 + level * 0.9;
      world.addBox(bx, y, z, 2.2, 0.08, 0.85, MAT.metal(0x4a5058), { solid: false, blockVision: false });
      // box files
      for (let k = 0; k < 3; k++) {
        world.addBox(bx - 0.7 + k * 0.7, y + 0.16, z, 0.6, 0.3, 0.7, MAT.wood(), { solid: false, blockVision: false });
      }
    }
    for (const s of [-1, 1]) {
      world.addBox(bx + s * 1.05, height / 2, z, 0.1, height, 0.9, MAT.metal(0x3a4048), { cover: true });
    }
  }
  return { x, z };
}

/** A security console with a live camera feed: the mantrap's control point. */
export function addSecurityConsole(world, x, z, rotY = 0) {
  world.addBox(x, 0.55, z, 2.2, 1.1, 0.8, MAT.metal(0x33383e), { rotY, cover: true });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x0a1418, emissive: 0x2fa8c0, emissiveIntensity: 0.8, roughness: 0.25 }));
  screen.position.set(x, 1.3, z + 0.42);
  screen.rotation.set(-0.4, rotY, 0);
  world.addObject(screen, { solid: false, tag: 'console-screen' });
  const glow = new THREE.PointLight(0x2fa8c0, 1.4, 7);
  glow.position.set(x, 1.4, z + 1.2);
  world.group.add(glow);
  return { x, z, renderer: screen };
}

/** MOTION-SENSOR beacon: a pale teal lamp that pulses while armed. */
export function addMotionSensor(world, x, y, z) {
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x2fa8c0, emissive: 0x2fa8c0, emissiveIntensity: 2.2 }));
  lamp.position.set(x, y, z);
  world.addObject(lamp, { solid: false, tag: 'motion-sensor' });
  const pl = new THREE.PointLight(0x2fa8c0, 0.9, 8);
  pl.position.set(x, y, z);
  world.group.add(pl);
  return { lamp, pl };
}

/** Blast-furnace-red emergency lighting for the Core ring. */
export function addCoreLighting(world, x, z, radius = 12) {
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const lx = x + Math.cos(a) * radius;
    const lz = z + Math.sin(a) * radius;
    const pl = new THREE.PointLight(0xff6a3a, 2.8, 15);
    pl.position.set(lx, 3.2, lz);
    world.group.add(pl);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xff7a4a, emissive: 0xff5020, emissiveIntensity: 2.6 }));
    glow.position.set(lx, 3.2, lz);
    world.addObject(glow, { solid: false, tag: 'core-light' });
  }
}

/** The document vault: a glass-and-steel cabinet where the original page sits. */
export function addVault(world, x, z) {
  world.addBox(x, 1.4, z, 3.2, 2.8, 1.0, MAT.metal(0x3a4048), { cover: true });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x1a3038, emissive: 0x356a7a, emissiveIntensity: 0.4, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.6 }));
  glass.position.set(x, 1.5, z + 0.52);
  world.addObject(glass, { solid: false, tag: 'vault-glass' });
  const pl = new THREE.PointLight(0x66c8e0, 2.0, 8);
  pl.position.set(x, 2.1, z + 1.1);
  world.group.add(pl);
  // the page itself
  const page = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.68),
    new THREE.MeshStandardMaterial({ color: 0xe8dcc0, emissive: 0x6a5a3a, emissiveIntensity: 0.5 }));
  page.position.set(x, 1.7, z + 0.3);
  world.addObject(page, { solid: false, tag: 'vault-page' });
  return { x, z, page };
}

/** Drifting sand haze for the exterior approach. */
export function addSandstorm(world, x, z, w = 60) {
  const pts = [];
  for (let i = 0; i < 220; i++) {
    pts.push(
      (Math.random() - 0.5) * w,
      0.4 + Math.random() * 4.0,
      (Math.random() - 0.5) * w
    );
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const mat = new THREE.PointsMaterial({ color: 0xd8c9a4, size: 0.11, transparent: true, opacity: 0.30, depthWrite: false });
  const cloud = new THREE.Points(geo, mat);
  cloud.position.set(x, 0, z);
  world.group.add(cloud);
  world.addAnimated((dt) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let px = p.getX(i) + dt * 7.5;
      if (px > w / 2) px -= w;
      p.setX(i, px);
    }
    p.needsUpdate = true;
  });
  return cloud;
}

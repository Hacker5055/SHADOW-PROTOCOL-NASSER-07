/**
 * SHADOW PROTOCOL — Procedural character & prop models
 * Everything is assembled from primitives at runtime. Characters are modular
 * (head / torso / arms / legs / gear) so equipment can be swapped per era,
 * mirroring the Unreal side's modular skeletal-mesh + gear-socket architecture.
 */
import * as THREE from 'three';
import { MAT } from '../engine/materials.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- palettes
export const PALETTE = {
  egypt1973: {
    uniform: 0xa89d78,      // sand-drab fatigues
    uniformDark: 0x8c825f,
    webbing: 0x6d6548,
    helmet: 0x7d7657,
    skin: 0x8a5f3c,
    boot: 0x3a3126,
    accent: 0xb03a2a
  },
  nkGuard: {
    uniform: 0x3f4a3c,
    uniformDark: 0x2f372d,
    webbing: 0x24291f,
    helmet: 0x2b3126,
    skin: 0xb08a63,
    boot: 0x181a14,
    accent: 0xa32020
  },
  egyptModern: {
    uniform: 0x4a4f42,
    uniformDark: 0x393d33,
    webbing: 0x1f221b,
    helmet: 0x2c2f26,
    skin: 0x8a5f3c,
    boot: 0x1a1a17,
    accent: 0xc96a1e
  },
  israeli1973: {
    uniform: 0x8d8f72,
    uniformDark: 0x74765c,
    webbing: 0x555741,
    helmet: 0x6e7058,
    skin: 0xb08a63,
    boot: 0x2d2a20,
    accent: 0x2d5f8a
  }
};

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function cyl(rt, rb, h, mat, seg = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------- soldier
/**
 * Modular humanoid. Height ~1.8m, origin at feet.
 * Returns { group, pose(t, speed, crouch, aim) }.
 */
export function buildSoldier(palette = PALETTE.egypt1973, opts = {}) {
  const P = palette;
  const g = new THREE.Group();
  const mats = {
    uniform: new THREE.MeshStandardMaterial({ color: P.uniform, roughness: 0.94 }),
    uniformDark: new THREE.MeshStandardMaterial({ color: P.uniformDark, roughness: 0.94 }),
    webbing: new THREE.MeshStandardMaterial({ color: P.webbing, roughness: 0.85 }),
    helmet: new THREE.MeshStandardMaterial({ color: P.helmet, roughness: 0.7, metalness: 0.15 }),
    skin: new THREE.MeshStandardMaterial({ color: P.skin, roughness: 0.72 }),
    boot: new THREE.MeshStandardMaterial({ color: P.boot, roughness: 0.9 }),
    accent: new THREE.MeshStandardMaterial({ color: P.accent, roughness: 0.8 })
  };

  // hips root
  const hips = new THREE.Group();
  hips.position.y = 0.94;
  g.add(hips);

  // torso
  const torso = new THREE.Group();
  hips.add(torso);
  const chest = box(0.46, 0.58, 0.26, mats.uniform, 0, 0.29, 0);
  torso.add(chest);
  // chest webbing + pouches (period correct for both eras)
  torso.add(box(0.4, 0.16, 0.06, mats.webbing, 0, 0.35, 0.15));
  torso.add(box(0.1, 0.1, 0.07, mats.webbing, -0.13, 0.2, 0.16));
  torso.add(box(0.1, 0.1, 0.07, mats.webbing, 0.13, 0.2, 0.16));
  if (opts.era === 'modern') {
    torso.add(box(0.34, 0.28, 0.1, mats.webbing, 0, 0.36, 0.16)); // plate carrier
    torso.add(box(0.06, 0.06, 0.04, mats.accent, -0.12, 0.44, 0.22)); // patch
  } else {
    torso.add(box(0.2, 0.08, 0.05, mats.accent, 0.1, 0.45, 0.14)); // unit tab
  }
  // shoulders
  const shoulderL = new THREE.Group(); shoulderL.position.set(-0.29, 0.5, 0); torso.add(shoulderL);
  const shoulderR = new THREE.Group(); shoulderR.position.set(0.29, 0.5, 0); torso.add(shoulderR);

  const armGeo = () => box(0.13, 0.36, 0.14, mats.uniform, 0, -0.18, 0);
  const upperL = armGeo(); shoulderL.add(upperL);
  const upperR = armGeo(); shoulderR.add(upperR);
  const elbowL = new THREE.Group(); elbowL.position.y = -0.34; shoulderL.add(elbowL);
  const elbowR = new THREE.Group(); elbowR.position.y = -0.34; shoulderR.add(elbowR);
  elbowL.add(box(0.11, 0.3, 0.12, mats.uniformDark, 0, -0.15, 0));
  elbowR.add(box(0.11, 0.3, 0.12, mats.uniformDark, 0, -0.15, 0));
  const handL = box(0.09, 0.1, 0.1, mats.skin, 0, -0.32, 0.02); elbowL.add(handL);
  const handR = box(0.09, 0.1, 0.1, mats.skin, 0, -0.32, 0.02); elbowR.add(handR);

  // head + helmet
  const neck = new THREE.Group(); neck.position.y = 0.6; torso.add(neck);
  const head = box(0.2, 0.23, 0.21, mats.skin, 0, 0.1, 0); neck.add(head);
  neck.add(box(0.06, 0.05, 0.03, mats.skin, 0, 0.09, 0.11)); // nose
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), mats.helmet);
  helmet.position.set(0, 0.205, 0);
  helmet.scale.set(1, 0.82, 1.05);
  helmet.castShadow = true;
  neck.add(helmet);
  if (opts.era === 'modern') {
    // optic mount + goggles
    neck.add(box(0.16, 0.05, 0.06, mats.webbing, 0, 0.19, 0.09));
    const gog = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 10), MAT.glass());
    gog.rotation.x = Math.PI / 2; gog.position.set(0, 0.12, 0.1); neck.add(gog);
  }

  // legs
  const hipL = new THREE.Group(); hipL.position.set(-0.11, -0.06, 0); hips.add(hipL);
  const hipR = new THREE.Group(); hipR.position.set(0.11, -0.06, 0); hips.add(hipR);
  const legGeo = () => box(0.16, 0.46, 0.17, mats.uniform, 0, -0.23, 0);
  hipL.add(legGeo()); hipR.add(legGeo());
  const kneeL = new THREE.Group(); kneeL.position.y = -0.46; hipL.add(kneeL);
  const kneeR = new THREE.Group(); kneeR.position.y = -0.46; hipR.add(kneeR);
  kneeL.add(box(0.14, 0.4, 0.15, mats.uniformDark, 0, -0.2, 0));
  kneeR.add(box(0.14, 0.4, 0.15, mats.uniformDark, 0, -0.2, 0));
  const footL = box(0.15, 0.1, 0.26, mats.boot, 0, -0.43, 0.04); kneeL.add(footL);
  const footR = box(0.15, 0.1, 0.26, mats.boot, 0, -0.43, 0.04); kneeR.add(footR);

  // optional backpack / radio
  if (opts.radio) {
    torso.add(box(0.3, 0.34, 0.14, mats.webbing, 0, 0.28, -0.19));
    const ant = cyl(0.006, 0.006, 0.5, mats.webbing, 5);
    ant.position.set(-0.1, 0.65, -0.22); torso.add(ant);
  }
  if (opts.medic) {
    torso.add(box(0.12, 0.12, 0.02, mats.accent, 0.18, 0.25, -0.14));
  }

  // weapon arm posing helper
  const pose = (t, speed = 0, crouch = 0, aim = 0, dead = false) => {
    if (dead) {
      g.rotation.z = Math.PI / 2.15;
      g.position.y = 0.24;
      hips.rotation.set(0, 0, 0);
      shoulderL.rotation.set(-0.2, 0, 0.7);
      shoulderR.rotation.set(-0.2, 0, -0.7);
      return;
    }
    const swing = Math.sin(t) * Math.min(speed, 6) * 0.11;
    const bob = Math.abs(Math.cos(t)) * Math.min(speed, 6) * 0.012;

    hips.position.y = 0.94 - crouch * 0.32 + bob;
    hips.rotation.x = crouch * 0.22 + Math.min(speed, 6) * 0.012;

    hipL.rotation.x = swing;
    hipR.rotation.x = -swing;
    kneeL.rotation.x = Math.max(0, -swing) * 1.1 + crouch * 0.95;
    kneeR.rotation.x = Math.max(0, swing) * 1.1 + crouch * 0.95;

    // arms: right holds weapon, left either on the weapon (aim) or swinging
    shoulderR.rotation.x = -1.25 + aim * 0.12 + Math.sin(t) * Math.min(speed, 6) * 0.03;
    shoulderR.rotation.z = -0.16;
    elbowR.rotation.x = -0.7 + aim * 0.2;

    if (aim > 0.4) {
      shoulderL.rotation.x = -1.15;
      shoulderL.rotation.z = 0.5;
      elbowL.rotation.x = -0.85;
    } else {
      shoulderL.rotation.x = -0.35 - swing * 0.7;
      shoulderL.rotation.z = 0.2;
      elbowL.rotation.x = -0.5;
    }
    torso.rotation.y = -aim * 0.06;
    neck.rotation.x = aim * -0.08;
  };

  return { group: g, parts: { hips, torso, neck, shoulderL, shoulderR, elbowL, elbowR, hipL, hipR, kneeL, kneeR, handR }, mats, pose };
}

// ---------------------------------------------------------------- weapons
/** Returns a weapon mesh group with a muzzle Object3D at `muzzle`. */
export function buildWeaponModel(id) {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.55, metalness: 0.65 });
  const woodM = new THREE.MeshStandardMaterial({ color: 0x53331c, roughness: 0.8 });
  const poly = new THREE.MeshStandardMaterial({ color: 0x2e3128, roughness: 0.75 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x4a4e52, roughness: 0.4, metalness: 0.85 });

  const add = (mesh, x, y, z) => { mesh.position.set(x, y, z); g.add(mesh); return mesh; };
  const b = (w, h, d, m) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.castShadow = true; return me; };
  const c = (r, len, m, seg = 8) => { const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m); me.rotation.x = Math.PI / 2; me.castShadow = true; return me; };

  switch (id) {
    case 'akm': {
      add(b(0.06, 0.1, 0.34, dark), 0, 0, -0.05);            // receiver
      add(c(0.017, 0.46, steel), 0, 0.02, -0.4);             // barrel
      add(b(0.05, 0.03, 0.1, steel), 0, 0.09, -0.36);        // gas tube
      add(b(0.06, 0.06, 0.16, steel), 0, 0.09, -0.26);       // gas block
      add(c(0.028, 0.18, dark), 0, -0.01, -0.56);            // muzzle device
      const mag = add(b(0.05, 0.2, 0.09, dark), 0, -0.13, -0.03);
      mag.rotation.x = 0.28;
      add(b(0.05, 0.09, 0.26, woodM), 0, -0.02, 0.16);       // wooden stock
      add(b(0.045, 0.045, 0.2, woodM), 0, -0.03, -0.24);     // handguard
      const grip = add(b(0.04, 0.13, 0.06, woodM), 0, -0.12, 0.09);
      grip.rotation.x = -0.28;
      add(b(0.012, 0.06, 0.03, dark), 0, 0.055, 0.02);       // rear sight
      add(b(0.012, 0.07, 0.02, dark), 0, 0.07, -0.34);       // front sight
      break;
    }
    case 'portsaid': {
      // Port Said / Carl Gustaf m/45 style SMG
      add(c(0.022, 0.3, steel), 0, 0.01, -0.2);
      add(b(0.055, 0.09, 0.24, dark), 0, 0, 0);
      add(b(0.04, 0.16, 0.05, dark), 0, -0.12, -0.02);
      add(b(0.045, 0.05, 0.18, poly), 0, -0.02, -0.24);
      add(c(0.012, 0.1, steel), 0, 0.05, -0.34);
      add(b(0.04, 0.1, 0.18, steel), 0, 0, 0.16);
      break;
    }
    case 'rpd': {
      add(b(0.07, 0.11, 0.36, dark), 0, 0, -0.05);
      add(c(0.019, 0.5, steel), 0, 0.02, -0.42);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 14), poly);
      drum.rotation.z = Math.PI / 2; drum.position.set(0.02, -0.11, -0.08); drum.castShadow = true; g.add(drum);
      add(b(0.05, 0.09, 0.24, woodM), 0, -0.01, 0.18);
      add(b(0.04, 0.05, 0.2, woodM), 0, -0.02, -0.3);
      add(b(0.04, 0.12, 0.05, woodM), 0, -0.11, 0.1);
      add(b(0.012, 0.08, 0.02, dark), 0, 0.07, -0.34);
      break;
    }
    case 'rpg7': {
      add(c(0.032, 1.0, new THREE.MeshStandardMaterial({ color: 0x3b3f33, roughness: 0.8 })), 0, 0.02, -0.3);
      add(c(0.055, 0.22, poly), 0, 0.02, -0.62);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 10), dark);
      cone.rotation.x = -Math.PI / 2; cone.position.set(0, 0.02, -0.82); cone.castShadow = true; g.add(cone);
      add(b(0.04, 0.14, 0.06, woodM), 0, -0.13, 0.04);
      add(b(0.05, 0.05, 0.16, woodM), 0, -0.02, -0.05);
      add(b(0.025, 0.05, 0.03, dark), 0, 0.12, 0.02);
      break;
    }
    case 'sniper': {
      add(c(0.022, 0.62, steel), 0, 0.02, -0.4);
      add(b(0.06, 0.1, 0.32, dark), 0, 0, -0.06);
      add(b(0.05, 0.16, 0.24, poly), 0, -0.02, 0.2);
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.3, 10), steel);
      scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.1, -0.1); g.add(scope);
      add(b(0.02, 0.05, 0.04, dark), 0, 0.06, -0.22);
      add(b(0.02, 0.05, 0.04, dark), 0, 0.06, 0.02);
      break;
    }
    case 'm4': {
      add(b(0.05, 0.09, 0.36, poly), 0, 0, -0.02);
      add(c(0.014, 0.4, steel), 0, 0.015, -0.36);
      add(c(0.022, 0.14, steel), 0, 0.015, -0.6);
      add(b(0.05, 0.05, 0.3, poly), 0, -0.005, -0.28);
      const mag = add(b(0.045, 0.18, 0.075, poly), 0, -0.12, -0.02);
      mag.rotation.x = 0.2;
      add(b(0.05, 0.11, 0.24, poly), 0, -0.005, 0.2);
      add(b(0.035, 0.11, 0.05, poly), 0, -0.1, 0.08);
      add(b(0.04, 0.04, 0.12, dark), 0, 0.075, -0.05); // optic
      add(b(0.02, 0.06, 0.02, dark), 0, 0.1, -0.3);
      break;
    }
    case 'mp5sd': {
      add(c(0.03, 0.34, dark), 0, 0.01, -0.3);   // suppressor
      add(b(0.05, 0.09, 0.28, poly), 0, 0, -0.02);
      add(b(0.045, 0.16, 0.06, poly), 0, -0.12, -0.02);
      add(b(0.04, 0.1, 0.2, poly), 0, -0.005, 0.16);
      add(b(0.03, 0.05, 0.05, dark), 0, 0.06, 0.02);
      add(b(0.02, 0.06, 0.02, dark), 0, 0.055, -0.2);
      break;
    }
    case 'pistol': {
      add(b(0.04, 0.06, 0.2, poly), 0, 0, -0.06);
      add(b(0.035, 0.11, 0.05, poly), 0, -0.08, 0.02);
      add(c(0.01, 0.06, steel), 0, 0.02, -0.17);
      break;
    }
    case 'enemy_ak': {
      const w = buildWeaponModel('akm');
      return withMuzzle(w);
    }
    case 'enemy_modern': {
      const w = buildWeaponModel('m4');
      return withMuzzle(w);
    }
    default: {
      add(b(0.05, 0.09, 0.32, dark), 0, 0, 0);
      break;
    }
  }
  return withMuzzle(g);
}

function withMuzzle(g) {
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, -0.66);
  g.add(muzzle);
  g.userData.muzzle = muzzle;
  return g;
}

// ---------------------------------------------------------------- vehicles & props
export function buildTank(color = 0x6f6b52) {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a382c, roughness: 0.85 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.95, 6.2), body);
  hull.position.y = 1.05; hull.castShadow = true; hull.receiveShadow = true; g.add(hull);
  const glacis = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.7, 1.6), body);
  glacis.position.set(0, 1.25, -2.6); glacis.rotation.x = -0.3; glacis.castShadow = true; g.add(glacis);
  const turret = new THREE.Mesh(new THREE.SphereGeometry(1.25, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), body);
  turret.position.set(0, 1.6, 0.2); turret.scale.set(1.25, 0.8, 1.35); turret.castShadow = true; g.add(turret);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 4.2, 10), dark);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 1.8, -3.2); barrel.castShadow = true; g.add(barrel);
  // tracks
  for (const s of [-1, 1]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 6.4), dark);
    track.position.set(s * 1.7, 0.42, 0); track.castShadow = true; g.add(track);
    for (let i = -2.6; i <= 2.6; i += 0.85) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.25, 12), body);
      wheel.rotation.z = Math.PI / 2; wheel.position.set(s * 1.72, 0.45, i); g.add(wheel);
    }
  }
  // stowage + markings
  const box1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 1.2), dark);
  box1.position.set(-1.1, 1.6, 0.6); g.add(box1);
  return g;
}

export function buildBTR(color = 0x6a6b58) {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x33352c, roughness: 0.9 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.5, 7.0), body);
  hull.position.y = 1.5; hull.castShadow = true; hull.receiveShadow = true; g.add(hull);
  const sloped = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.0, 1.8), body);
  sloped.position.set(0, 1.55, -3.4); sloped.rotation.x = -0.42; sloped.castShadow = true; g.add(sloped);
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, 0.55, 12), body);
  turret.position.set(0, 2.35, -1.4); g.add(turret);
  const mg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), dark);
  mg.rotation.x = Math.PI / 2; mg.position.set(0, 2.4, -2.3); g.add(mg);
  for (const s of [-1, 1]) {
    for (const z of [-2.2, 0, 2.2]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.34, 14), dark);
      wheel.rotation.z = Math.PI / 2; wheel.position.set(s * 1.45, 0.52, z); wheel.castShadow = true; g.add(wheel);
    }
  }
  return g;
}

export function buildTruck() {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x5b6144, roughness: 0.8, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2c22, roughness: 0.9 });
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.9, 2.1), body);
  cab.position.set(0, 1.7, -2.5); cab.castShadow = true; g.add(cab);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 4.2), body);
  bed.position.set(0, 1.0, 0.6); bed.castShadow = true; g.add(bed);
  for (const s of [-1, 1]) {
    g.add(box(0.1, 0.7, 4.2, body, s * 1.15, 1.4, 0.6));
    for (const z of [-2.4, 0.3, 2.3]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.36, 14), dark);
      wheel.rotation.z = Math.PI / 2; wheel.position.set(s * 1.1, 0.55, z); g.add(wheel);
    }
  }
  const canvasTop = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.6, 4.2), new THREE.MeshStandardMaterial({ color: 0x6c6a4e, roughness: 0.95 }));
  canvasTop.position.set(0, 1.9, 0.6); g.add(canvasTop);
  return g;
}

export function buildHelicopter() {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x4d5445, roughness: 0.7, metalness: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1e211a, roughness: 0.85 });
  const fus = new THREE.Mesh(new THREE.CapsuleGeometry(0.95, 3.4, 6, 12), body);
  fus.rotation.z = Math.PI / 2; fus.position.y = 2.2; fus.castShadow = true; g.add(fus);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 4.4), body);
  tail.position.set(0, 2.35, 3.4); g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.3, 0.7), body);
  fin.position.set(0, 2.9, 5.4); g.add(fin);
  const rotor = new THREE.Group(); rotor.position.set(0, 3.1, 0); g.add(rotor);
  for (let i = 0; i < 4; i++) {
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 7.2), dark);
    bl.rotation.y = (i / 4) * Math.PI; rotor.add(bl);
  }
  const tailRotor = new THREE.Group(); tailRotor.position.set(0.2, 2.9, 5.5); g.add(tailRotor);
  for (let i = 0; i < 3; i++) {
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.3, 0.16), dark);
    bl.rotation.x = (i / 3) * Math.PI; tailRotor.add(bl);
  }
  for (const s of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8), dark);
    skid.rotation.x = Math.PI / 2; skid.position.set(s * 0.8, 1.15, 0); g.add(skid);
  }
  g.userData.rotor = rotor;
  g.userData.tailRotor = tailRotor;
  return g;
}

export function buildSandbagWall(len, height = 1.15) {
  const g = new THREE.Group();
  const mat = MAT.sandbag();
  const rows = Math.max(2, Math.round(height / 0.28));
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * 0.24;
    for (let x = -len / 2 + offset; x < len / 2; x += 0.48) {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.26, 0.34 + Math.random() * 0.06), mat);
      bag.position.set(x + 0.23, 0.14 + r * 0.26, (Math.random() - 0.5) * 0.05);
      bag.rotation.y = (Math.random() - 0.5) * 0.08;
      bag.rotation.z = (Math.random() - 0.5) * 0.04;
      bag.castShadow = true; bag.receiveShadow = true;
      g.add(bag);
    }
  }
  g.userData.height = rows * 0.26;
  return g;
}

export function buildCrate(s = 1, mat = null) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.8, s), mat || MAT.wood());
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function buildBarrel(h = 0.9) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, h, 12), MAT.rust());
  body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
  for (const y of [h * 0.25, h * 0.75]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.02, 6, 14), MAT.metal(0x554433));
    ring.rotation.x = Math.PI / 2; ring.position.y = y; g.add(ring);
  }
  return g;
}

export function buildPalm(height = 5) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4a30, roughness: 0.95 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, height, 7), trunkMat);
  trunk.position.y = height / 2; trunk.castShadow = true; g.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4a5f2e, roughness: 0.9, side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.2, 4, 1, true), leafMat);
    leaf.position.set(0, height, 0);
    leaf.rotation.z = Math.PI / 2.4;
    leaf.rotation.y = (i / 9) * Math.PI * 2;
    leaf.translateY(1.4);
    leaf.castShadow = true;
    g.add(leaf);
  }
  return g;
}

export function buildTent(w = 3, d = 4, h = 2) {
  const g = new THREE.Group();
  const mat = MAT.tent();
  const geo = new THREE.BufferGeometry();
  const v = new Float32Array([
    -w / 2, 0, -d / 2, w / 2, 0, -d / 2, 0, h, -d / 2,
    -w / 2, 0, d / 2, w / 2, 0, d / 2, 0, h, d / 2
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
  geo.setIndex([0, 1, 2, 3, 5, 4, 0, 2, 5, 0, 5, 3, 1, 4, 5, 1, 5, 2]);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  return g;
}

export function buildSandbagBunker() {
  const g = new THREE.Group();
  const w = buildSandbagWall(4.6, 1.4);
  g.add(w);
  for (const s of [-1, 1]) {
    const side = buildSandbagWall(3.2, 1.2);
    side.rotation.y = Math.PI / 2;
    side.position.set(s * 2.1, 0, 1.4);
    g.add(side);
  }
  return g;
}

export function buildStreetLamp() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5, 8), MAT.metal(0x2a2d30));
  pole.position.y = 2.5; pole.castShadow = true; g.add(pole);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.28), MAT.metal(0x22252a));
  head.position.set(0.22, 5.0, 0); g.add(head);
  return g;
}

/**
 * SHADOW PROTOCOL — modern environment kit (Port Komdok, DPRK)
 * Visual identity: cold teal shadow, sodium/mercury practical lights, wet
 * concrete, corrugated steel, containers, harbour cranes, floodlight towers,
 * razor-wire perimeter and a brutalist admin block.
 */
import * as THREE from 'three';
import { MAT } from '../engine/materials.js';
import {
  buildContainer, buildCrate, buildBarrel, buildStreetLamp, buildTruck, buildBTR
} from './libProps.js';

export function buildPortTerrain(world) {
  const ground = (x, z) => {
    let y = 0;
    y += Math.sin(x * 0.03) * 0.12 + Math.cos(z * 0.028) * 0.1;
    // quay edge drops to the water on the east
    if (x > 96) {
      const t = Math.min(1, (x - 96) / 10);
      y -= t * t * 6;
    }
    return y;
  };
  world.setTerrain(ground, {
    size: 340, segments: 120,
    material: new THREE.MeshStandardMaterial({ color: 0x2b3136, roughness: 0.95, metalness: 0.05 })
  });
  world.waterLevel = -4.2;

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x0c1c24, roughness: 0.06, metalness: 0.8 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(180, world.waterLevel, 0);
  world.group.add(sea);

  // paved apron markings
  const apronMat = new THREE.MeshStandardMaterial({ color: 0x3a4046, roughness: 0.92 });
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), apronMat);
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(10, 0.012, 6);
  apron.receiveShadow = true;
  world.group.add(apron);
  return { ground };
}

export function buildQuay(world) {
  // concrete quay wall with bollards and fenders
  world.addBox(102, 0.4, 0, 10, 5.2, 190, MAT.concrete(0x4a4f52), { cover: true });
  for (let z = -84; z <= 84; z += 12) {
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.7, 10), MAT.metal(0x2b2e30));
    bollard.position.set(97, 3.0, z);
    bollard.castShadow = true;
    world.addObject(bollard);
    const fender = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 1.6), MAT.rubber());
    fender.position.set(107, 1.2, z);
    world.addObject(fender);
  }
}

export function buildContainers(world, rng) {
  const colors = [[110, 60, 40], [40, 70, 90], [90, 80, 40], [50, 80, 60], [80, 50, 60]];
  const stacks = [
    { x: -34, z: -30, n: 3, rot: 0 }, { x: -18, z: -34, n: 2, rot: 0 },
    { x: 4, z: -40, n: 3, rot: 0 }, { x: 26, z: -36, n: 2, rot: 0.1 },
    { x: 44, z: -22, n: 3, rot: 0 }, { x: -44, z: 18, n: 2, rot: Math.PI / 2 },
    { x: 30, z: 26, n: 3, rot: 0 }, { x: 50, z: 34, n: 2, rot: Math.PI / 2 },
    { x: -10, z: 46, n: 3, rot: 0 }, { x: 14, z: 40, n: 2, rot: 0.2 }
  ];
  for (const s of stacks) {
    for (let i = 0; i < s.n; i++) {
      const y = 0.05 + i * 2.6;
      const c = buildContainer(colors[(rng ? rng() : Math.random()) * colors.length | 0]);
      c.position.set(s.x + (i % 2 ? 0.04 : 0), y + 1.3, s.z);
      c.rotation.y = s.rot + (i % 3) * 0.01;
      world.addObject(c);
      world.collision.addBox(c.position.x, c.position.y, c.position.z, 2.5, 2.6, 12.2,
        'container', { solid: true, cover: true, blockVision: true });
    }
  }
}

export function buildAdminBlock(world) {
  // Brutalist three-storey admin building: the hostage site.
  const cx = -6, cz = -62, w = 34, d = 18, h = 11;
  // main shell (hollow: four walls)
  const wallMat = MAT.concrete(0x555c60);
  world.addBox(cx, h / 2, cz - d / 2, w, h, 0.6, wallMat, { cover: true });
  world.addBox(cx, h / 2, cz + d / 2, w, h, 0.6, wallMat, { cover: true });
  world.addBox(cx - w / 2, h / 2, cz, 0.6, h, d, wallMat, { cover: true });
  world.addBox(cx + w / 2, h / 2, cz, 0.6, h, d, wallMat, { cover: true });
  // floors
  for (const y of [3.6, 7.2]) {
    world.addBox(cx, y, cz, w - 1.2, 0.35, d - 1.2, MAT.concrete(0x4b5155), { tag: 'floor', cover: true });
  }
  world.addBox(cx, h, cz, w + 0.8, 0.5, d + 0.8, MAT.concrete(0x3f4448), { tag: 'roof', cover: true });
  // interior partition walls
  for (const [px, pz, pw, pd] of [
    [cx - 10, cz - 4, 0.4, 8], [cx + 8, cz + 3, 0.4, 10], [cx - 2, cz + 2, 12, 0.4]
  ]) {
    world.addBox(px, 2, pz, pw, 3.6, pd, MAT.concrete(0x4e5458), { cover: true });
  }
  // entrance (north face)
  world.addBox(cx, 1.6, cz + d / 2 + 0.1, 3.2, 3.2, 0.3, new THREE.MeshStandardMaterial({ color: 0x14181a, roughness: 0.9 }), { solid: false });
  // windows (emissive strips)
  for (let f = 0; f < 3; f++) {
    for (let i = 0; i < 7; i++) {
      const wx = cx - 13 + i * 4.4;
      const wy = 1.9 + f * 3.6;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), MAT.emissive(0x2d4a52, 0.7 + Math.random() * 0.6));
      win.position.set(wx, wy, cz + d / 2 + 0.32);
      world.addObject(win);
    }
  }
  // roof structures: stair head, antenna, water tank
  world.addBox(cx + 8, h + 1.8, cz - 4, 6, 3.6, 5, MAT.concrete(0x474d51), { cover: true });
  world.addBox(cx - 10, h + 1.4, cz - 3, 4, 2.8, 4, MAT.metal(0x3a3f42), { cover: true });
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 8, 6), MAT.metal(0x2a2e30));
  antenna.position.set(cx + 2, h + 4, cz - 6);
  world.addObject(antenna);
  // H-marking on the roof for the extraction bird
  const hpad = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshStandardMaterial({ color: 0x5c6166, roughness: 0.95 }));
  hpad.rotation.x = -Math.PI / 2;
  hpad.position.set(cx + 1, h + 0.28, cz + 2);
  world.addObject(hpad);
  for (const rot of [0, Math.PI / 2]) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.7), new THREE.MeshStandardMaterial({ color: 0xc8c2a8 }));
    bar.rotation.x = -Math.PI / 2;
    bar.rotation.z = rot;
    bar.position.set(cx + 1, h + 0.3, cz + 2);
    world.addObject(bar);
  }
  return { cx, cz, w, d, h };
}

export function buildFloodlights(world) {
  const lights = [];
  const spots = [[-46, -20], [40, -10], [-30, 30], [46, 46], [0, -44], [20, 8]];
  for (const [x, z] of spots) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 14, 8), MAT.metal(0x2c3033));
    pole.position.set(x, 7, z);
    pole.castShadow = true;
    world.addObject(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.9), MAT.metal(0x22262a));
    head.position.set(x, 14, z);
    world.addObject(head);
    // emissive lamp faces
    for (const s of [-0.5, 0.5]) {
      const lamp = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.7), MAT.emissive(0xdfe6c0, 2.4));
      lamp.position.set(x + s, 13.75, z + 0.46);
      world.addObject(lamp);
    }
    const l = new THREE.SpotLight(0xdfe8c8, 46, 52, 0.62, 0.45, 1.6);
    l.position.set(x, 13.6, z);
    l.target.position.set(x, 0, z + 4);
    l.castShadow = false;
    world.group.add(l);
    world.group.add(l.target);
    lights.push(l);
    // bloom feel via a point light
    const p = new THREE.PointLight(0xcfe0b8, 6, 16, 2);
    p.position.set(x, 13.2, z);
    world.group.add(p);
  }
  return lights;
}

export function buildPerimeter(world) {
  // razor wire fence around the yard
  const z1 = -96, z2 = 96;
  for (let x = -70; x <= 70; x += 5) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 5), MAT.metal(0x3a3f42));
    post.position.set(x, 1.6, z1);
    world.addObject(post);
    post.position.z = z1;
    if (x < 70) {
      for (let k = 0; k < 2; k++) {
        const wire = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.012, 3, 8), new THREE.MeshStandardMaterial({ color: 0x565c60, metalness: 0.8, roughness: 0.5 }));
        wire.position.set(x + 2.5, 1.2 + k * 0.9, z1);
        wire.rotation.x = Math.PI / 2.2;
        world.addObject(wire);
      }
    }
  }
  // watchtower
  const tx = 58, tz = -70;
  world.addBox(tx, 2.4, tz, 3.2, 4.8, 3.2, MAT.metal(0x33393c), { cover: true });
  world.addBox(tx, 5.4, tz, 4.2, 2.2, 4.2, MAT.metal(0x2a2f32), { cover: true });
  const lampT = new THREE.PointLight(0xffd9a0, 12, 30, 2);
  lampT.position.set(tx, 6, tz + 2);
  world.group.add(lampT);
  void z2;
}

export function buildDocksideProps(world) {
  // shipping clutter, fuel drums, pallet stacks, a moored cargo ship silhouette
  for (let i = 0; i < 30; i++) {
    const x = -56 + Math.random() * 120;
    const z = -26 + Math.random() * 62;
    if (Math.abs(x + 6) < 18 && Math.abs(z + 62) < 12) continue; // keep admin approach clear
    const kind = Math.random();
    if (kind < 0.4) {
      const b = buildBarrel(0.92);
      b.position.set(x, 0.05, z);
      world.addObject(b);
      world.collision.addBox(x, 0.5, z, 0.62, 1.0, 0.62, 'barrel', { cover: true });
    } else if (kind < 0.75) {
      const c = buildCrate(1.0, MAT.wood());
      c.position.set(x, 0.4, z);
      world.addObject(c);
      world.collision.addBox(x, 0.4, z, 1.0, 0.8, 1.0, 'crate', { cover: true });
    } else {
      const c = buildCrate(0.9, MAT.metal(0x40474a));
      c.position.set(x, 0.36, z);
      c.rotation.y = Math.random();
      world.addObject(c);
      world.collision.addBox(x, 0.36, z, 0.9, 0.72, 0.9, 'crate', { cover: true });
    }
  }
  // cargo ship at the quay
  const ship = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(28, 8, 88), MAT.rust());
  hull.position.y = 1.5;
  ship.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(26, 1.2, 84), MAT.metal(0x3a3f42));
  deck.position.y = 5.6;
  ship.add(deck);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 12), MAT.metal(0x4a5054));
  bridge.position.set(0, 11, -30);
  ship.add(bridge);
  for (let i = 0; i < 4; i++) {
    const hold = new THREE.Mesh(new THREE.BoxGeometry(20, 2, 14), MAT.container([70, 60, 50]));
    hold.position.set(0, 6.6, 10 + i * 16);
    ship.add(hold);
  }
  ship.position.set(126, -4.5, -6);
  ship.traverse((o) => { o.castShadow = true; });
  world.addObject(ship);
  // crane
  const crane = new THREE.Group();
  const mast = new THREE.Mesh(new THREE.BoxGeometry(2.4, 30, 2.4), MAT.metal(0x3a4a52));
  mast.position.y = 15;
  crane.add(mast);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 36), MAT.metal(0x3a4a52));
  boom.position.set(0, 29, 14);
  crane.add(boom);
  crane.position.set(60, 0, 30);
  crane.rotation.y = 0.4;
  world.addObject(crane);
  for (let i = 0; i < 6; i++) {
    const l = buildStreetLamp();
    l.position.set(-60 + i * 24, 0.05, 62);
    world.addObject(l);
  }
  // guard truck
  const truck = buildTruck();
  truck.position.set(34, 0.05, 10);
  truck.rotation.y = 0.8;
  truck.traverse((o) => { if (o.material) o.material = MAT.metal(0x3d4a3a); });
  world.addObject(truck);
  world.collision.addBox(34, 1.2, 10, 2.6, 2.4, 5.4, 'truck', { cover: true });
  // APC
  const apc = buildBTR(0x3d4a3c);
  apc.position.set(-34, 0.05, -12);
  apc.rotation.y = 1.2;
  world.addObject(apc);
  world.collision.addBox(-34, 1.3, -12, 3, 2.6, 7.2, 'apc', { cover: true });
}

export function buildSeaWallApproach(world) {
  // the stealth insertion: a sea wall running south from the quay
  for (let z = 20; z <= 96; z += 8) {
    world.addBox(92, 1.2, z, 1.8, 2.4, 8, MAT.concrete(0x3c4245), { cover: true });
  }
  // fishing boat cover
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(6, 1.8, 12), MAT.wood());
  hull.position.y = 0.4;
  boat.add(hull);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 4), MAT.metal(0x42484a));
  cabin.position.set(0, 2.2, -2);
  boat.add(cabin);
  boat.position.set(96, -4.2, 56);
  world.addObject(boat);
}

export function buildInteriors(world, admin) {
  // Holding cells, server rack, briefing room on the ground floor.
  const { cx, cz } = admin;
  // cell bars
  const barMat = MAT.metal(0x4a5055);
  for (let i = 0; i < 6; i++) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 6), barMat);
    bar.position.set(cx - 12 + i * 0.34, 1.6, cz - 2);
    world.addObject(bar);
  }
  world.addBox(cx - 11.3, 1.6, cz - 2, 2.6, 0.14, 0.14, barMat, { tag: 'bar' });
  world.addBox(cx - 11.3, 3.0, cz - 2, 2.6, 0.14, 0.14, barMat, { tag: 'bar' });
  // server rack (optional objective)
  const rack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 0.8), MAT.metal(0x24292c));
  rack.position.set(cx + 11, 1.05, cz - 4);
  world.addObject(rack);
  world.collision.addBox(cx + 11, 1.05, cz - 4, 1.2, 2.1, 0.8, 'rack', { cover: true });
  for (let i = 0; i < 6; i++) {
    const led = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.03), MAT.emissive(i % 3 === 0 ? 0xff5a2a : 0x4aff8a, 2.5));
    led.position.set(cx + 10.5 + (i % 2) * 0.14, 0.4 + i * 0.3, cz - 3.58);
    world.addObject(led);
  }
  world.addProp('server', rack, 'intel', { title: 'PORT KOMDOK SERVER', desc: 'A scan marked ARCHIVE BOX 07 — OPERATION AMUN.' });
  // mission map table
  const table = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 1.8), MAT.metal(0x3a4044));
  table.position.set(cx - 2, 0.95, cz + 3);
  world.addObject(table);
  world.addProp('map', table, 'intel', { title: 'QRF ROSTER', desc: 'Reaction force: 24 personnel, two technicals, one APC.' });
}

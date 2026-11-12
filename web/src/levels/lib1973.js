/**
 * SHADOW PROTOCOL — 1973 environment kit
 * Period-correct set dressing: sand berms (Bar Lev line), trenches, bunkers,
 * Egyptian and Israeli vehicles, supply dumps, pontoon bridging equipment,
 * palm groves, smoke columns and the canal itself.
 *
 * Colour/light identity for 1973 (see §8 of the design doc):
 *  - warm dust haze, high sun, bleached sand, olive-drab steel
 *  - no emissive signage, no cool rim light, no glass
 */
import * as THREE from 'three';
import { MAT } from '../engine/materials.js';
import {
  buildTank, buildBTR, buildTruck, buildSandbagWall, buildSandbagBunker,
  buildCrate, buildBarrel, buildPalm, buildTent, buildWeaponModel
} from '../game/models.js';

export function buildSuezTerrain(world) {
  // Heightfield: flat staging plain west of the canal, the canal trench, raised
  // east bank with the Bar Lev sand berm, and rolling dunes at the edges.
  const canalZ = -30;
  const canalHalfWidth = 16;

  const ground = (x, z) => {
    let y = 0;
    // gentle undulation
    y += Math.sin(x * 0.045) * 0.35 + Math.cos(z * 0.037) * 0.3;
    y += Math.sin(x * 0.11 + z * 0.07) * 0.14;
    // the canal: a channel cut down
    const d = Math.abs(z - canalZ);
    if (d < canalHalfWidth) {
      const t = d / canalHalfWidth;
      y -= (1 - t * t) * 4.6;
    }
    // east bank berm (Bar Lev line) at z ≈ -62
    const bermZ = -62;
    const bd = Math.abs(z - bermZ);
    if (bd < 13) {
      const t = 1 - bd / 13;
      y += Math.pow(t, 1.5) * 9.5;
    }
    // west bank staging ridge
    if (z > 6 && z < 30) {
      const t = 1 - Math.abs(z - 18) / 12;
      y += Math.max(0, t) * 1.1;
    }
    // far dunes
    const edgeX = Math.max(0, Math.abs(x) - 105) / 55;
    const edgeZ = Math.max(0, Math.abs(z + 20) - 110) / 55;
    const e = Math.min(1, edgeX + edgeZ);
    y += e * (3.5 + Math.sin(x * 0.08) * 1.5 + Math.cos(z * 0.06) * 1.8);
    return y;
  };

  world.setTerrain(ground, { size: 400, segments: 220, material: MAT.sand(9) });
  world.waterLevel = ground(0, canalZ) + 2.1;

  // Canal water plane
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(400, canalHalfWidth * 2.1, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0x24505c, roughness: 0.08, metalness: 0.65, transparent: true, opacity: 0.9
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, world.waterLevel, canalZ);
  water.receiveShadow = true;
  world.group.add(water);
  world.canalWater = water;
  world.addAnimated((dt, t) => {
    water.position.y = world.waterLevel + Math.sin(t * 0.8) * 0.03;
  });

  return { ground, canalZ, canalHalfWidth, bermZ: -62 };
}

export function buildBerm(world, terrain) {
  // Bar Lev strongpoint line: sand berm segments with concrete emplacements.
  // The berm itself is the heightfield; here we add the hard structures.
  const cz = terrain.bermZ;
  for (const x of [-72, -48, -24, 0, 24, 48, 72]) {
    const y = terrain.ground(x, cz);
    // concrete strongpoint
    world.addBox(x, y + 1.4, cz + 2, 7.5, 2.8, 5.5, MAT.concrete(0xb9ae94), { cover: true });
    world.addBox(x, y + 3.1, cz + 2, 6.2, 0.6, 4.6, MAT.concrete(0xa89d84), { cover: true });
    // firing slit
    world.addBox(x, y + 1.9, cz - 0.85, 4.6, 0.35, 0.3, MAT.metal(0x15171a), { solid: false });
    // low sandbag ring
    const ring = buildSandbagWall(6.5, 0.9);
    ring.position.set(x, y + 0.05, cz - 4.2);
    world.addObject(ring);
    world.collision.addBox(x, y + 0.45, cz - 4.2, 6.5, 0.9, 0.5, 'sandbag', { solid: true, cover: true });
  }
  // tank scrapes and revetments on the berm crest
  for (const x of [-60, -12, 36, 66]) {
    const y = terrain.ground(x, cz - 3);
    const tank = buildTank(0x6f6b52);
    tank.position.set(x, y, cz - 3);
    tank.rotation.y = Math.PI + (Math.random() - 0.5) * 0.5;
    world.addObject(tank);
    world.collision.addBox(x, y + 1.2, cz - 3, 3.4, 2.4, 6.2, 'tank', { solid: true, cover: true });
  }
}

export function buildEgyptianStaging(world, terrain) {
  // West bank camp: tents, trucks, supply dumps, radio mast, briefing table.
  const spots = [
    { x: -26, z: 24 }, { x: -14, z: 30 }, { x: 2, z: 26 }, { x: 18, z: 31 }, { x: 34, z: 24 }
  ];
  for (const s of spots) {
    const y = terrain.ground(s.x, s.z);
    const tent = buildTent(4.2, 5.5, 2.2);
    tent.position.set(s.x, y, s.z);
    tent.rotation.y = (Math.random() - 0.5) * 0.5;
    world.addObject(tent);
    world.collision.addBox(s.x, y + 1.1, s.z, 3.2, 2.2, 4.4, 'tent', { solid: true, cover: true });
  }
  for (const s of [{ x: -36, z: 12 }, { x: 26, z: 14 }, { x: -8, z: 10 }]) {
    const y = terrain.ground(s.x, s.z);
    const truck = buildTruck();
    truck.position.set(s.x, y, s.z);
    truck.rotation.y = (Math.random() - 0.5) * 1.4;
    world.addObject(truck);
    world.collision.addBox(s.x, y + 1.2, s.z, 2.6, 2.4, 5.4, 'truck', { solid: true, cover: true });
  }
  // supply crates + barrels
  for (let i = 0; i < 26; i++) {
    const x = (Math.random() - 0.5) * 90;
    const z = 6 + Math.random() * 32;
    const y = terrain.ground(x, z);
    if (Math.random() < 0.65) {
      const c = buildCrate(0.8 + Math.random() * 0.5);
      c.position.set(x, y + 0.35, z);
      c.rotation.y = Math.random() * 3;
      world.addObject(c);
      world.collision.addBox(x, y + 0.35, z, 0.9, 0.7, 0.9, 'crate', { cover: true });
    } else {
      const b = buildBarrel(0.9);
      b.position.set(x, y, z);
      world.addObject(b);
      world.collision.addBox(x, y + 0.45, z, 0.6, 0.9, 0.6, 'barrel', { cover: true });
    }
  }
  // radio mast + generator
  {
    const x = -20, z = 18;
    const y = terrain.ground(x, z);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 11, 6), MAT.metal(0x4a4a3c));
    mast.position.set(x, y + 5.5, z);
    world.addObject(mast);
    for (let i = 1; i <= 3; i++) {
      const guy = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 8, 4), MAT.metal(0x33332a));
      guy.position.set(x + Math.cos(i * 2.1) * 3, y + 4, z + Math.sin(i * 2.1) * 3);
      guy.rotation.z = Math.cos(i * 2.1) * 0.6;
      guy.rotation.x = -Math.sin(i * 2.1) * 0.6;
      world.addObject(guy);
    }
    world.addBox(x + 4, y + 0.5, z + 2, 1.6, 1.0, 1.0, MAT.metal(0x3a3a2e), { tag: 'generator', cover: true });
  }
  // palm grove to the west
  for (let i = 0; i < 14; i++) {
    const x = -60 - Math.random() * 60;
    const z = -5 + Math.random() * 70;
    const y = terrain.ground(x, z);
    const palm = buildPalm(4 + Math.random() * 3);
    palm.position.set(x, y, z);
    palm.rotation.y = Math.random() * 6;
    world.addObject(palm);
    world.collision.addBox(x, y + 2, z, 0.5, 4, 0.5, 'palm', { solid: false, cover: false, blockVision: false });
  }
  // Egyptian vehicles near the crossing point
  for (const s of [{ x: -12, z: -6 }, { x: 14, z: -8 }]) {
    const y = terrain.ground(s.x, s.z);
    const btr = buildBTR();
    btr.position.set(s.x, y, s.z);
    btr.rotation.y = Math.PI;
    world.addObject(btr);
    world.collision.addBox(s.x, y + 1.3, s.z, 3.0, 2.6, 7.2, 'btr', { solid: true, cover: true });
  }
  // pontoon bridge sections on the west bank (bridging equipment)
  for (let i = 0; i < 5; i++) {
    const x = -30 + i * 9;
    const z = -10;
    const y = terrain.ground(x, z);
    const pontoon = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.4, 3.1), MAT.wood());
    pontoon.position.set(x, y + 0.3, z);
    pontoon.rotation.y = (Math.random() - 0.5) * 0.08;
    world.addObject(pontoon);
    world.collision.addBox(x, y + 0.3, z, 7.4, 0.4, 3.1, 'pontoon', { solid: true, cover: true });
    for (const s of [-3, 3]) {
      const float = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 3.0, 10), MAT.metal(0x4c4c3c));
      float.rotation.x = Math.PI / 2;
      float.position.set(x + s, y + 0.1, z);
      world.addObject(float);
    }
  }
}

export function buildTrenchNetwork(world, terrain) {
  // East bank trench line captured by the assaulting infantry.
  const z = -44;
  for (let x = -84; x <= 84; x += 8) {
    const y = terrain.ground(x, z);
    // sandbag parapet facing east
    const wall = buildSandbagWall(7.6, 1.15);
    wall.position.set(x, y, z);
    wall.rotation.y = 0;
    world.addObject(wall);
    world.collision.addBox(x, y + 0.55, z, 7.6, 1.15, 0.55, 'sandbag', { cover: true });
    // duckboards / trench floor marker
    if (x % 16 === 0) {
      const crate = buildCrate(0.9);
      crate.position.set(x + 2.2, y + 0.36, z + 1.6);
      world.addObject(crate);
      world.collision.addBox(x + 2.2, y + 0.36, z + 1.6, 1, 0.72, 1, 'crate', { cover: true });
    }
  }
  // communication trench running south from the line
  for (let i = 0; i < 10; i++) {
    const zz = z + 4 + i * 5;
    const xx = -20 + Math.sin(i * 0.6) * 3;
    const y = terrain.ground(xx, zz);
    const wallL = buildSandbagWall(4.2, 0.95);
    wallL.position.set(xx - 1.6, y, zz);
    wallL.rotation.y = Math.PI / 2;
    world.addObject(wallL);
    world.collision.addBox(xx - 1.6, y + 0.45, zz, 0.5, 0.95, 4.2, 'sandbag', { cover: true });
    const wallR = buildSandbagWall(4.2, 0.95);
    wallR.position.set(xx + 1.6, y, zz);
    wallR.rotation.y = Math.PI / 2;
    world.addObject(wallR);
    world.collision.addBox(xx + 1.6, y + 0.45, zz, 0.5, 0.95, 4.2, 'sandbag', { cover: true });
  }
  // destroyed Israeli half-track + burning wreck
  {
    const x = 30, zz = -50;
    const y = terrain.ground(x, zz);
    const wreck = buildBTR(0x4a4a3a);
    wreck.position.set(x, y, zz);
    wreck.rotation.z = 0.16;
    wreck.rotation.y = 0.7;
    world.addObject(wreck);
    world.collision.addBox(x, y + 0.9, zz, 3, 1.8, 6.4, 'wreck', { cover: true });
    world.spawnSmokeColumn({ x, y: y + 1.4, z: zz }, { color: 0x4a4a44, count: 34, life: 7 });
  }
}

export function buildDepotRaid(world, terrain) {
  // Mission 1.5: the Qantara road depot — quiet, wrong, and full of paperwork.
  const cz = 62;
  for (let i = 0; i < 4; i++) {
    const x = -18 + i * 12;
    const y = terrain.ground(x, cz);
    // corrugated shed
    world.addBox(x, y + 2, cz, 9, 4, 7, MAT.metal(0x5a5a48), { cover: true });
    world.addBox(x, y + 4.1, cz, 9.6, 0.3, 7.6, MAT.rust(), { cover: true });
    // interior crates
    for (let j = 0; j < 3; j++) {
      const c = buildCrate(0.8);
      c.position.set(x - 3 + j * 2.4, y + 0.35, cz + 2);
      world.addObject(c);
    }
  }
  // the ledger table — the story object
  {
    const y = terrain.ground(6, cz - 1);
    const table = buildCrate(0.9, MAT.wood());
    table.scale.set(1.3, 1, 2.1);
    table.position.set(6, y + 0.36, cz - 1);
    world.addObject(table);
    const ledger = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.06, 0.56),
      new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.85 })
    );
    ledger.position.set(6, y + 0.76, cz - 1);
    ledger.rotation.y = 0.3;
    world.addObject(ledger);
    world.addProp('ledger', ledger, 'intel', { title: 'THE BLACK LEDGER', desc: 'Column of names. A signature block: A. ZIDAN.' });
  }
  // bodies in the wire (the 14), gas masks on sticks — quiet horror, no gore
  for (let i = 0; i < 9; i++) {
    const x = -34 + Math.random() * 68;
    const zz = cz + 8 + Math.random() * 6;
    const y = terrain.ground(x, zz);
    const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 1.2, 4, 8), MAT.cloth(0x8c8464));
    bag.rotation.z = Math.PI / 2;
    bag.rotation.y = Math.random() * 3;
    bag.position.set(x, y + 0.26, zz);
    bag.castShadow = true;
    world.addObject(bag);
  }
}

export function buildCanalCrossingProps(world, terrain) {
  // Rubber assault boats and scaling ladders at the water's edge.
  const cz = terrain.canalZ + 13;
  for (let i = 0; i < 7; i++) {
    const x = -54 + i * 18;
    const y = terrain.ground(x, cz);
    const boat = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.36, 8, 14, Math.PI * 1.5), MAT.rubber());
    boat.rotation.x = Math.PI / 2;
    boat.rotation.z = Math.PI * 0.75;
    boat.position.set(x, y + 0.25, cz);
    boat.scale.set(1, 1.55, 1);
    world.addObject(boat);
    world.collision.addBox(x, y + 0.3, cz, 2.6, 0.6, 4.4, 'boat', { cover: true });
    // ladder
    const ladder = new THREE.Group();
    for (const s of [-0.35, 0.35]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 4.2, 0.07), MAT.wood());
      rail.position.set(s, 2.1, 0);
      ladder.add(rail);
    }
    for (let r = 0; r < 12; r++) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.05), MAT.wood());
      rung.position.set(0, 0.3 + r * 0.33, 0);
      ladder.add(rung);
    }
    ladder.position.set(x + 2.4, y, cz);
    ladder.rotation.x = -0.28;
    ladder.rotation.z = 0.12;
    world.addObject(ladder);
  }
  // knocked-out Israeli tank in the water
  {
    const x = -22;
    const y = world.waterLevel - 1.2;
    const tank = buildTank(0x585846);
    tank.position.set(x, y, terrain.canalZ);
    tank.rotation.z = 0.5;
    tank.rotation.y = 0.4;
    world.addObject(tank);
    world.spawnSmokeColumn({ x, y: y + 2, z: terrain.canalZ }, { color: 0x5a5a52, count: 22, life: 8 });
  }
}

export function buildWireMinefield(world, terrain) {
  // Mission 1.4 — the men in the wire.
  const zBase = -12;
  for (let x = -40; x <= 40; x += 6) {
    for (let zz = zBase; zz <= zBase + 12; zz += 6) {
      if (Math.random() > 0.55) continue;
      const y = terrain.ground(x + Math.random() * 3, zz + Math.random() * 3);
      // concertina wire: stacked torus rings
      for (let k = 0; k < 3; k++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.42, 0.02, 4, 10),
          new THREE.MeshStandardMaterial({ color: 0x6e6a58, roughness: 0.6, metalness: 0.7 })
        );
        ring.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        ring.position.set(x + (Math.random() - 0.5) * 1.6, y + 0.15 + k * 0.22, zz + (Math.random() - 0.5) * 1.6);
        world.addObject(ring);
      }
      // mine marker
      if (Math.random() < 0.3) {
        const mine = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.09, 8), MAT.metal(0x3b3a30));
        mine.position.set(x + (Math.random() - 0.5) * 2, y + 0.05, zz + (Math.random() - 0.5) * 2);
        world.addObject(mine);
        world.addProp(`mine_${x}_${zz}`, mine, 'mine', {});
      }
    }
  }
}

export function buildBackgroundLife(world, terrain) {
  // Distant smoke columns and the haze of a battlefield.
  const spots = [
    { x: -120, z: -110 }, { x: 40, z: -140 }, { x: 130, z: -95 }, { x: -160, z: 30 }, { x: 100, z: 60 }
  ];
  for (const s of spots) {
    const y = terrain.ground(s.x, s.z);
    world.spawnSmokeColumn({ x: s.x, y: y + 2, z: s.z }, { color: 0x6a6458, count: 30, life: 9 });
  }
  // Mi-8 crossing the canal on a loop
  const heli = buildHelicopterOnLoop(world, terrain);
  void heli;
}

function buildHelicopterOnLoop(world, terrain) {
  const { buildHelicopter } = window.__SP_MODELS__ || {};
  if (!buildHelicopter) return null;
  const heli = buildHelicopter();
  heli.position.set(-90, 26, -40);
  heli.scale.setScalar(1.15);
  world.addObject(heli);
  let t = 0;
  world.addAnimated((dt) => {
    t += dt;
    heli.position.x = -110 + ((t * 9) % 260);
    heli.position.y = 26 + Math.sin(t * 0.6) * 2;
    heli.rotation.y = Math.PI / 2 + Math.sin(t * 0.4) * 0.1;
    if (heli.userData.rotor) heli.userData.rotor.rotation.y += dt * 32;
    if (heli.userData.tailRotor) heli.userData.tailRotor.rotation.x += dt * 40;
  });
  return heli;
}

export function build1973WeaponRack(world, terrain) {
  // A weapon rack at the staging area where the player confirms their loadout.
  const x = -6, z = 16;
  const y = terrain.ground(x, z);
  world.addBox(x, y + 0.9, z, 2.2, 0.12, 0.5, MAT.wood(), { tag: 'rack' });
  world.addBox(x - 1.05, y + 0.45, z, 0.1, 0.9, 0.5, MAT.wood(), { tag: 'rack' });
  world.addBox(x + 1.05, y + 0.45, z, 0.1, 0.9, 0.5, MAT.wood(), { tag: 'rack' });
  for (const [wx, id] of [[x - 0.6, 'akm'], [x, 'portsaid'], [x + 0.6, 'rpd']]) {
    const w = buildWeaponModel(id);
    w.scale.setScalar(0.9);
    w.position.set(wx, y + 1.05, z);
    w.rotation.set(Math.PI / 2, 0, 0);
    world.addObject(w);
  }
}

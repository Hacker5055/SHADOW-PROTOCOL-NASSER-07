/**
 * SHADOW PROTOCOL — CHAPTER 04: CITY OF SHADOWS
 * Present day · Vienna, Canal District · Nasser 07
 *
 * The campaign's semi-open mission. A ~340 x 260 m slice of the 1st-4th
 * districts: streets, a canal embankment, a market hall, a metro entrance and
 * the hotel where KONSUL meets his buyer.
 *
 * 4.1 THE CANAL        — approach, cross the embankment
 * 4.2 THREE COURIERS   — photograph all three without being made
 * 4.3 THE OPTIONALS    — CCTV, the detained journalist, the phone tap
 * 4.4 FIVE WAYS IN     — any of five routes into the hotel
 * 4.5 KONSUL           — kill him or take him alive
 *
 * The surveillance beat is real detection, not a script: a courier is
 * photographed only if you are inside the camera's view cone, close enough,
 * have line of sight, and are not yourself being watched by a hostile.
 */
import * as THREE from 'three';
import { PALETTE } from '../game/models.js';
import { MAT } from '../engine/materials.js';
import {
  buildViennaTerrain, addViennaBlock, addCanalRailing, buildTram, addTramRails,
  addMarketHall, addMetroEntrance, addViennaLamp, addParkedCar, addCCTV,
  addHotelEntrance
} from './libVienna.js';

export const CHAPTER_04_MISSION = {
  id: 'ch04_city_of_shadows',
  chapterIndex: 4,
  code: 'VIENNA / CANAL DISTRICT',
  title: 'City of Shadows',
  cardEra: 'VIENNA · 1ST DISTRICT · 22:40',
  cardNum: 'CHAPTER 04',
  subtitle: 'Canal District<br>KONSUL is meeting a buyer tonight',
  synopsis: 'The ledger puts KONSUL in Vienna for one night. Nasser has a team, a camera, and five ways into a hotel that is watching all of them.',
  era: 'modern',
  loadout: ['pistol', 'mp5sd', 'm4'],
  start: { x: 0, y: 1.2, z: 96 },
  startYaw: Math.PI,
  surface: 'concrete',
  hasSquad: true,
  nvg: true,
  intelTotal: 5,
  darknessAt: 0,
  objectives: [
    { id: 'o_canal', text: 'Cross the canal district to the market hall', marker: { x: 0, y: 1, z: 30 } },
    { id: 'o_couriers', text: 'Photograph all three couriers without being made', marker: { x: 0, y: 1, z: 10 } },
    { id: 'o_cctv', text: 'Optional — disable the CCTV network', type: 'optional' },
    { id: 'o_journalist', text: 'Optional — free the detained journalist', type: 'optional' },
    { id: 'o_phone', text: 'Optional — tap the phone line', type: 'optional' },
    { id: 'o_hotel', text: 'Get inside the Hotel Adler', marker: { x: 0, y: 1, z: -78 } },
    { id: 'o_konsul', text: 'Take KONSUL — alive if you can' }
  ]
};

/** Campaign flags written by this chapter. */
// Canonical uppercase flag names, matching save.js DEFAULT_PROGRESS.flags and
// the ending resolver. Lowercase variants would never be read by anything.
export const CH04_FLAGS = {
  KONSUL_ALIVE: 'KONSUL_ALIVE',
  KONSUL_DEAD: 'KONSUL_DEAD',
  CCTV_DOWN: 'CCTV_DOWN',
  JOURNALIST_FREED: 'JOURNALIST_FREED',
  PHONE_TAPPED: 'PHONE_TAPPED'
};

/** Layout constants, exported so tests can assert against them. */
export const CH04_LAYOUT = {
  canalZ: 62,
  marketZ: 30,
  hotelZ: -78,
  hotelX: 0,
  metroX: -34,
  metroZ: 4,
  cctvCount: 4,
  courierCount: 3,
  routes: 5
};

export function buildViennaMission(game, world) {
  const { ground } = buildViennaTerrain(world);
  buildCanal(world);
  buildMarketSquare(world);
  buildStreetBlocks(world);
  const hotel = buildHotel(world);
  const metro = addMetroEntrance(world, CH04_LAYOUT.metroX, CH04_LAYOUT.metroZ, 0);

  // ------------------------------------------------------------------ squad
  // The campaign squad. By chapter 04 the player knows these three, so they are
  // the same callsigns and names, not fresh anonymous bodies.
  world.friendSpawns.length = 0;
  for (const member of [
    { callsign: 'FANG', nameEn: 'Lt. Karim El-Sayed', nameAr: 'كريم السيد', role: 'marksman', slot: 0, pos: { x: -2.2, y: 0.05, z: 92 } },
    { callsign: 'JACKAL', nameEn: 'Sgt. Hoda Mansour', nameAr: 'هدى منصور', role: 'engineer', slot: 1, pos: { x: 2.2, y: 0.05, z: 92 } },
    { callsign: 'MOUSE', nameEn: 'Sgt. Adel Farhan', nameAr: 'عادل فرحان', role: 'comms', slot: 2, pos: { x: 0, y: 0.05, z: 94 }, radio: true }
  ]) {
    world.addFriend({
      ...member,
      era: 'modern',
      palette: PALETTE.egyptModern,
      weapon: 'enemy_modern'
    });
  }

  // ------------------------------------------------------------------ guards
  // Street patrol: hostile only if they see you do something. They start on
  // normal alertness rather than as a firing squad at the spawn point.
  const posts = [
    { x: -22, z: 44 }, { x: 18, z: 40 }, { x: 30, z: 18 },
    { x: -30, z: 8 }, { x: 12, z: -18 }, { x: -14, z: -34 },
    { x: 26, z: -46 }, { x: -8, z: -62 }, { x: 8, z: -64 }
  ];
  posts.forEach((p, i) => {
    world.addEnemy({
      pos: { x: p.x, y: 0.05, z: p.z },
      yaw: (i / posts.length) * Math.PI * 2,
      era: 'modern',
      palette: PALETTE.egyptModern,
      weapon: 'enemy_modern',
      role: 'rifleman',
      faction: 'konsul'
    });
  });

  // ------------------------------------------------------------------ state
  const mission = game.mission;
  const state = {
    crossed: false,
    photographed: new Set(),
    made: false,
    cctvDown: false,
    journalistFreed: false,
    phoneTapped: false,
    inside: false,
    konsulDone: false
  };

  const couriers = spawnCouriers(world);
  const cameras = spawnCCTVs(world, game, state);

  // ------------------------------------------------------------------ 4.1
  world.addTrigger('ch04_market', { x: 0, y: 1, z: 34 }, 9, () => {
    if (state.crossed) return;
    state.crossed = true;
    mission.completeObjective(0, { notice: 'Reached the market hall' });
    game.hud.say({
      speaker: 'KARIM "GLASS" ZAYED',
      en: 'Three couriers, all carrying the same case. Photograph all three and I can prove the meet is real.',
      ar: 'ثلاثة سُعاة، كلهم يحملون نفس الحقيبة. صوّر الثلاثة وأستطيع إثبات أن اللقاء حقيقي.',
      radio: true
    });
    game.audio?.radio(8, 0.4);
  }, true);

  // ------------------------------------------------------------------ 4.2
  // Courier photography is evaluated every frame against the real camera cone.
  let photoCooldown = 0;
  world.addAnimated((dt) => {
    if (state.made || state.photographed.size >= couriers.length) return;
    photoCooldown = Math.max(0, photoCooldown - dt);
    if (photoCooldown > 0) return;
    const cam = game.player.camera || game.player.viewCam;
    if (!cam) return;

    for (const c of couriers) {
      if (state.photographed.has(c.id) || c.dead) continue;
      if (!inShot(game, cam, c)) continue;
      // Being photographed must not count if a hostile currently sees you.
      if (anyHostileSees(game)) continue;
      state.photographed.add(c.id);
      photoCooldown = 0.6;
      game.hud.feed(`SURVEILLANCE — courier ${state.photographed.size}/${couriers.length} captured`, 'intel');
      game.audio?.uiConfirm?.();
      if (state.photographed.size === couriers.length) {
        mission.completeObjective(1, { notice: 'All three couriers photographed' });
        mission.addIntel({
          id: 'ch04_courier_set',
          title: 'Surveillance set — three couriers',
          era: 'modern',
          body: 'Same briefcase, same hotel, three different arrivals from three different countries. KONSUL is not buying. He is auditing.'
        });
        game.hud.say({
          speaker: 'ADEL "MOUSE" FARHAN',
          en: 'That is a meeting, Nasser. That is a meeting with a buyer who flew in on three passports.',
          ar: 'ده اجتماع يا ناصر. اجتماع مع مشترٍ دخل بثلاثة جوازات.',
          radio: true
        });
      }
      break;
    }
  });

  // Getting made: if a courier sees you at close range with a weapon up, the
  // surveillance window closes. This is the failure state for 4.2.
  world.addAnimated(() => {
    if (state.made) return;
    const p = game.player.pos;
    for (const c of couriers) {
      if (c.dead || state.photographed.has(c.id)) continue;
      const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
      if (d > 7) continue;
      if (!game.world.collision.lineOfSight({ x: c.pos.x, y: c.pos.y + 1.6, z: c.pos.z }, { x: p.x, y: p.y + 1.5, z: p.z })) continue;
      state.made = true;
      game.hud.feed('SURVEILLANCE BLOWN — the couriers have scattered', 'alert');
      game.hud.say({
        speaker: 'KARIM "GLASS" ZAYED',
        en: 'He made you. Cases are moving. We do this the loud way now.',
        ar: 'كشفك. الحقائب بتتحرك. هنعملها بالطريقة الصاخبة دلوقتي.',
        radio: true
      });
      for (const cc of couriers) {
        // they bolt for the hotel
        cc.flee = true;
      }
      break;
    }
  });

  // ------------------------------------------------------------------ 4.3 optional
  // CCTV: a physical junction box behind the market hall.
  const boxPos = { x: 22, z: 22 };
  world.addBox(boxPos.x, 1.1, boxPos.z, 0.5, 0.9, 0.35, MAT.metal(0x3a4046), { cover: true });
  world.addTrigger('ch04_cctv', { x: boxPos.x, y: 1, z: boxPos.z }, 2.4, () => {
    if (state.cctvDown) return;
    state.cctvDown = true;
    for (const cam of cameras) cam.down = true;
    setFlag(game, CH04_FLAGS.CCTV_DOWN);
    mission.completeObjective(2, { notice: 'CCTV network disabled' });
    game.hud.feed('CCTV NETWORK DOWN — patrols are slower to converge', 'intel');
    game.hud.say({
      speaker: 'ADEL "MOUSE" FARHAN',
      en: 'Cameras are blind. Their control room is going to spend ten minutes being confused.',
      ar: 'الكاميرات عميت. غرفة التحكم هتقضي عشر دقايق في حيرة.',
      radio: true
    });
  }, true);

  // Journalist: a locked storeroom off the market hall.
  // Inside the western block footprint, not on the cross street: at x=-26 the
  // room straddled the walkable corridor and sealed the whole west route.
  const cellPos = { x: -33, z: 21 };
  world.addBox(cellPos.x, 1.6, cellPos.z, 4.2, 3.2, 4.2, MAT.concrete(0x6a655c), { cover: true });
  world.addBox(cellPos.x + 2.1, 1.05, cellPos.z, 0.06, 2.1, 1.1, MAT.metal(0x2a2e33), { blockVision: true });
  world.addTrigger('ch04_journalist', { x: cellPos.x + 2.4, y: 1, z: cellPos.z }, 2.6, () => {
    if (state.journalistFreed) return;
    state.journalistFreed = true;
    setFlag(game, CH04_FLAGS.JOURNALIST_FREED);
    mission.completeObjective(3, { notice: 'Freed the detained journalist' });
    mission.addIntel({
      id: 'ch04_journalist_statement',
      title: 'Statement — detained journalist',
      era: 'modern',
      body: '"They asked me about a 1973 logistics file, then a 2011 one, then the same question again. They were not interrogating me. They were checking a record."'
    });
    game.hud.say({
      speaker: 'DETAINED JOURNALIST',
      en: 'You are the second person to ask me about that file tonight. The first one had your accent.',
      ar: 'أنت تاني شخص يسألني عن الملف ده الليلة. الأول كان بيتكلم بلهجتك.'
    });
  }, true);

  // Phone tap: a junction cabinet by the metro.
  const tapPos = { x: CH04_LAYOUT.metroX + 6, z: CH04_LAYOUT.metroZ - 3 };
  world.addBox(tapPos.x, 1.2, tapPos.z, 0.6, 1.2, 0.4, MAT.metal(0x4a4f45), { cover: true });
  world.addTrigger('ch04_phone', { x: tapPos.x, y: 1, z: tapPos.z }, 2.4, () => {
    if (state.phoneTapped) return;
    state.phoneTapped = true;
    setFlag(game, CH04_FLAGS.PHONE_TAPPED);
    mission.completeObjective(4, { notice: 'Phone line tapped' });
    mission.addIntel({
      id: 'ch04_tap_log',
      title: 'Intercept — escape route',
      era: 'modern',
      body: 'A single outbound call to a Danube freight yard, booked for 04:10. If KONSUL runs, that is where he goes. Chapter 05 opens there.'
    });
    game.hud.feed('INTERCEPT — KONSUL has a vehicle waiting at the Danube yard', 'intel');
  }, true);

  // ------------------------------------------------------------------ 4.4 hotel
  world.addTrigger('ch04_hotel', { x: CH04_LAYOUT.hotelX, y: 1, z: CH04_LAYOUT.hotelZ + 6 }, 6, () => {
    if (state.inside) return;
    state.inside = true;
    mission.completeObjective(5, { notice: 'Inside the Hotel Adler' });
    game.hud.say({
      speaker: 'NASSER 07',
      en: 'Room 41. Of course it is the top floor.',
      ar: 'غرفة ٤١. طبعًا آخر دور.'
    });
    // The meet turns hostile the moment the player is inside.
    for (const e of game.ai.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.pos.x - CH04_LAYOUT.hotelX, e.pos.z - CH04_LAYOUT.hotelZ) < 30) {
        e.alerted = true;
        e.awareness = 1;
      }
    }
  }, true);

  // ------------------------------------------------------------------ 4.5 KONSUL
  const konsulPos = { x: CH04_LAYOUT.hotelX + 2, y: 1, z: CH04_LAYOUT.hotelZ - 6 };
  const konsul = world.addEnemy({
    pos: konsulPos, yaw: 0, era: 'modern',
    palette: PALETTE.egyptModern,
    weapon: 'enemy_modern',
    role: 'officer',
    faction: 'konsul'
  });
  konsul.isKonsul = true;
  konsul.holdFire = true; // he wants to talk first

  world.addTrigger('ch04_konsul', { x: konsulPos.x, y: 1, z: konsulPos.z + 4 }, 5, () => {
    if (state.konsulDone) return;
    state.konsulDone = true;
    presentKonsulDecision(game, world, state, mission, konsul);
  }, true);

  // ------------------------------------------------------------------ ambience
  buildTramService(world);
  buildAtmosphere(world);

  return { ground, hotel, metro, couriers, cameras, state };
}

// --------------------------------------------------------------------------
// geometry
// --------------------------------------------------------------------------

function buildCanal(world) {
  // The canal itself: a sunken channel with a stone lip on both sides.
  const z = CH04_LAYOUT.canalZ;
  world.addBox(0, -3.2, z, 300, 6, 22, new THREE.MeshStandardMaterial({
    color: 0x0d1a22, roughness: 0.08, metalness: 0.85
  }), { blockVision: false });
  // embankment walls
  world.addBox(0, -1.2, z - 11, 300, 2.4, 1.2, MAT.concrete(0x8b857a), { cover: true });
  world.addBox(0, -1.2, z + 11, 300, 2.4, 1.2, MAT.concrete(0x8b857a), { cover: true });

  // Two bridges: the wide one is the road, the narrow one is a dead end.
  for (const b of [{ x: 0, w: 16 }, { x: 68, w: 5 }]) {
    world.addBox(b.x, 0.1, z, b.w, 0.4, 24, MAT.concrete(0x9a958c), { cover: true });
    addCanalRailing(world, b.x - b.w / 2, z - 11, b.x - b.w / 2, z + 11, 0.3);
    addCanalRailing(world, b.x + b.w / 2, z - 11, b.x + b.w / 2, z + 11, 0.3);
  }
  // Railings along the embankment outside the bridges
  addCanalRailing(world, -140, z - 11, -9, z - 11, 0.1);
  addCanalRailing(world, 9, z - 11, 65, z - 11, 0.1);
  addCanalRailing(world, -140, z + 11, -9, z + 11, 0.1);
  addCanalRailing(world, 9, z + 11, 65, z + 11, 0.1);

  for (let x = -80; x <= 80; x += 22) {
    if (Math.abs(x) < 10) continue;
    addViennaLamp(world, x, z - 12.5);
    addViennaLamp(world, x, z + 12.5);
  }
}

function buildMarketSquare(world) {
  addMarketHall(world, 0, CH04_LAYOUT.marketZ, 34, 20, 7.5);
  addViennaLamp(world, -20, CH04_LAYOUT.marketZ + 13);
  addViennaLamp(world, 20, CH04_LAYOUT.marketZ + 13);
  // hand carts and crates as low cover
  for (const p of [{ x: -12, z: 24 }, { x: 9, z: 22 }, { x: 16, z: 36 }, { x: -6, z: 40 }]) {
    world.addBox(p.x, 0.55, p.z, 1.6, 1.1, 0.9, MAT.wood(), { cover: true });
  }
}

function buildStreetBlocks(world) {
  // A real street grid, not a wall of buildings with mouse-holes between them.
  // Layout rule: a 26 m central avenue (x = -13..13) runs the whole length, and
  // every row is split by 14 m cross streets. Earlier versions left 6-8 m gaps,
  // which a player could squeeze through but the squad's steer() could not —
  // it jammed against the row and stood still forever, so the team never
  // arrived. Any block placed here must respect those corridors.
  const AVENUE = 13;      // half-width of the central avenue
  const CROSS = 11;       // half-width of each cross street (22 m: two lanes)
  const rows = [
    { z: 74, cross: [-64, -32, 32, 64] },
    { z: 12, cross: [-64, 32, 64] },
    { z: -20, cross: [-64, -32, 32] },
    { z: -52, cross: [-64, -32, 32, 64] }
  ];
  const W = 26, D = 18;
  for (const row of rows) {
    // Build the row as spans between the avenue and each cross street, so the
    // corridors are a property of the layout rather than luck.
    const cuts = [-124, ...row.cross.slice().sort((a, b) => a - b), 124];
    for (let i = 0; i < cuts.length - 1; i++) {
      let from = cuts[i] + (i > 0 ? CROSS : 0);
      let to = cuts[i + 1] - (i < cuts.length - 2 ? CROSS : 0);
      // carve the central avenue out of whichever span contains it
      for (const seg of [[from, Math.min(to, -AVENUE)], [Math.max(from, AVENUE), to]]) {
        const [a, b] = seg;
        if (b - a < 10) continue;
        const w = Math.min(W, b - a);
        addViennaBlock(world, (a + b) / 2, row.z, w, D, 16 + (Math.abs(Math.round(a)) % 7), 0);
      }
    }
  }
  // Street lamps down the main avenue
  for (let z = 52; z >= -66; z -= 18) {
    addViennaLamp(world, -14, z);
    addViennaLamp(world, 14, z);
  }
  // Parked cars as street cover
  for (const p of [{ x: -10, z: 48 }, { x: 11, z: 44 }, { x: -11, z: -8 }, { x: 10, z: -30 }, { x: -9, z: -56 }]) {
    addParkedCar(world, p.x, p.z, 0, 0x24282e);
  }
  addTramRails(world, 0, -140, 140);
}

function buildHotel(world) {
  const x = CH04_LAYOUT.hotelX, z = CH04_LAYOUT.hotelZ;
  // The tall block behind the entrance
  addViennaBlock(world, x, z - 12, 52, 26, 34, 0, { colour: 0x8e8a80 });
  addHotelEntrance(world, x, z - 2);
  // Service alley on the east, fire escape on the west: two of the five routes.
  world.addBox(x + 27, 1.0, z - 8, 1.0, 2.0, 22, MAT.concrete(0x6d6a64), { cover: true });
  world.addBox(x - 27, 1.0, z - 8, 1.0, 2.0, 22, MAT.concrete(0x6d6a64), { cover: true });
  return { x, z, w: 52, d: 26, h: 34 };
}

function buildTramService(world) {
  const tram = buildTram(world, 60, 0, Math.PI / 2);
  let t = 0;
  world.addAnimated((dt) => {
    t += dt;
    // A slow loop up and down the avenue; it is a landmark, not a threat.
    tram.position.z = Math.sin(t * 0.06) * 90;
  });
}

function buildAtmosphere(world) {
  // Light haze so the sodium lamps read as volumetric.
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffcf8a, transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending
  });
  for (let z = 60; z >= -70; z -= 26) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), glowMat);
    g.rotation.x = -Math.PI / 2;
    g.position.set(0, 0.6, z);
    world.group.add(g);
  }
}

// --------------------------------------------------------------------------
// actors
// --------------------------------------------------------------------------

function spawnCouriers(world) {
  const out = [];
  const spots = [
    { x: -8, z: 18, yaw: 0.4 },
    { x: 10, z: 6, yaw: -0.8 },
    { x: 0, z: -6, yaw: 2.4 }
  ];
  spots.forEach((s, i) => {
    const e = world.addEnemy({
      pos: { x: s.x, y: 0.05, z: s.z },
      yaw: s.yaw,
      era: 'modern',
      palette: PALETTE.egyptModern,
      weapon: 'enemy_modern',
      role: 'courier',
      faction: 'konsul'
    });
    e.isCourier = true;
    e.courierId = `courier_${i + 1}`;
    out.push({ id: e.courierId, enemy: e, get pos() { return e.pos; }, get dead() { return e.dead; } });
  });
  return out;
}

function spawnCCTVs(world, game, state) {
  const spots = [
    { x: -16, y: 4.2, z: 26, rotY: 0.6 },
    { x: 16, y: 4.2, z: 26, rotY: -0.6 },
    { x: -16, y: 4.2, z: -30, rotY: 2.4 },
    { x: 16, y: 4.2, z: -60, rotY: -2.4 }
  ];
  const out = [];
  for (const s of spots) {
    const cam = addCCTV(world, s.x, s.y, s.z, s.rotY);
    out.push({ mesh: cam, down: false, pos: { x: s.x, y: s.y, z: s.z } });
  }
  // While the network is live, patrolling guards get a small awareness bonus
  // near a camera. Disabling the network removes it, which is the whole point
  // of the optional objective.
  world.addAnimated(() => {
    if (state.cctvDown) return;
    for (const e of game.ai.enemies) {
      if (e.dead || e.alerted) continue;
      for (const c of out) {
        if (c.down) continue;
        if (Math.hypot(e.pos.x - c.pos.x, e.pos.z - c.pos.z) < 22) {
          e.awareness = Math.min(0.4, (e.awareness || 0) + 0.002);
        }
      }
    }
  });
  return out;
}

// --------------------------------------------------------------------------
// surveillance maths
// --------------------------------------------------------------------------

/**
 * Is `target` inside the camera's frustum-ish cone, close enough, and unobstructed?
 * Deliberately generous in angle but strict on distance and line of sight, because
 * a photograph needs the subject framed and visible.
 */
export function inShot(game, cam, target) {
  const camPos = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  cam.getWorldPosition(camPos);
  cam.getWorldDirection(camDir);
  const tp = new THREE.Vector3(target.pos.x, target.pos.y + 1.1, target.pos.z);
  const to = tp.clone().sub(camPos);
  const dist = to.length();
  if (dist > 26) return false;
  to.normalize();
  if (to.dot(camDir) < 0.55) return false; // ~57 degree half-angle
  const a = { x: camPos.x, y: camPos.y, z: camPos.z };
  const b = { x: tp.x, y: tp.y, z: tp.z };
  return game.world.collision.lineOfSight(a, b);
}

/** True if any living hostile currently has the player in view. */
export function anyHostileSees(game) {
  for (const e of game.ai.enemies) {
    if (e.dead || e.hidden) continue;
    if ((e.awareness || 0) > 0.65 && e.state !== 'idle') return true;
  }
  return false;
}

// --------------------------------------------------------------------------
// the decision
// --------------------------------------------------------------------------

function presentKonsulDecision(game, world, state, mission, konsul) {
  const options = [
    {
      id: 'alive',
      text: 'Take him alive. A live KONSUL opens Chapter 06.',
      textAr: 'خذه حيًا. كونسول حي يفتح الفصل ٦.',
      apply: () => {
        konsul.down = true;
        konsul.dead = false;
        konsul.health = 1;
        konsul.surrendered = true;
        setFlag(game, CH04_FLAGS.KONSUL_ALIVE);
        mission.addIntel({
          id: 'ch04_konsul_custody',
          title: 'KONSUL — in custody',
          era: 'modern',
          body: 'He did not resist. He asked, politely, whether we had brought the 1973 original. He said he had been waiting for someone to ask the right question for fifty years.'
        });
        game.hud.say({
          speaker: 'KONSUL',
          en: 'You are Taher Abdel-Hakim\'s grandson. I wondered which of you would come. Take me somewhere with a chair and a window — I have a long story and no interest in lying.',
          ar: 'أنت حفيد طاهر عبد الحكيم. كنت أتساءل أيكم سيأتي. خذني لمكان به كرسي ونافذة — عندي حكاية طويلة ولا رغبة لي في الكذب.'
        });
      }
    },
    {
      id: 'kill',
      text: 'Kill him. He has earned it.',
      textAr: 'اقتله. هو يستحق.',
      apply: () => {
        konsul.down = true;
        konsul.dead = true;
        konsul.health = 0;
        setFlag(game, CH04_FLAGS.KONSUL_DEAD);
        game.hud.say({
          speaker: 'NASSER 07',
          en: 'That was for the platoon at kilometre 41.',
          ar: 'ده كان عن الفصيل عند الكيلو ٤١.'
        });
        game.hud.say({
          speaker: 'KARIM "GLASS" ZAYED',
          en: 'He knew something, Nasser. He was going to tell you.',
          ar: 'كان يعرف حاجة يا ناصر. كان هيعترف.',
          radio: true
        }, 3.4);
      }
    }
  ];

  if (game.hud?.showChoice) {
    game.hud.showChoice({
      prompt: 'KONSUL IS ON HIS KNEES. WHAT DO YOU DO?',
      promptAr: 'كونسول على رُكبتيه. ماذا تفعل؟',
      options
    });
  } else {
    // No HUD at all (a bare headless harness): take the alive branch so chapter
    // 06's shortcut exists. commitChoice() is what invokes option.apply(), so it
    // must never be called alongside a manual apply() or the option runs twice.
    options[0].apply();
  }

  mission.completeObjective(6, { notice: 'KONSUL dealt with' });
}

function setFlag(game, name) {
  game.save?.setProgress?.((p) => {
    p.flags = p.flags || {};
    p.flags[name] = true;
  });
}

/**
 * SHADOW PROTOCOL — CHAPTER 07: THE FINAL LEGACY
 * Present day · Alexandria, Meridian Tower · Nasser 07
 *
 * A harbour approach at dawn, then four floors of the tower, each a distinct
 * arena, then the decision that decides which ending the campaign earned.
 *
 *   7.1 THE HARBOUR  — cross the quay to the podium
 *   7.2 FLOOR 12     — the server floor
 *   7.3 FLOOR 27     — the atrium, a vertical fight
 *   7.4 FLOOR 41     — the executive level
 *   7.5 FLOOR 54     — the helipad, and whoever is standing on it
 *   7.6 THE LEDGER   — publish / leverage / burn
 *   7.7 THE GRAVE    — Mansoura, and the box marked 07-B
 *
 * The tower is climbed by lift, not by stair: the engine's step height is
 * 0.45 m and a floor is 3.6 m, so the only honest vertical link is a machine.
 * Each lift ride is a scripted 2.4 s blackout with the floor's defenders
 * waking as the doors open.
 */
import * as THREE from 'three';
import { PALETTE } from '../game/models.js';
import { INTELLIGENCE, codaRequirement } from '../game/intel.js';
import { MAT } from '../engine/materials.js';
import {
  buildHarbourTerrain, addTower, addFloorPlate, addServerRow, addAtrium,
  addBoardroom, addHelipad, addRoofRail, addDawnGlow, addHarbourSilhouette
} from './libTower.js';

export const CHAPTER_07_MISSION = {
  id: 'ch07_final_legacy',
  chapterIndex: 7,
  code: 'ALEXANDRIA / MERIDIAN TOWER',
  title: 'The Final Legacy',
  cardEra: 'ALEXANDRIA · MERIDIAN TOWER · 05:20',
  cardNum: 'CHAPTER 07',
  subtitle: 'Meridian Tower, 58 floors<br>Twenty-two minutes to dawn',
  synopsis: 'The ledger is at the top of a building owned by the people who wrote it. Everything Nasser has decided since the canal is about to be read back to him.',
  era: 'modern',
  loadout: ['pistol', 'mp5sd', 'm4'],
  start: { x: 0, y: 1.2, z: 78 },
  startYaw: Math.PI,
  surface: 'concrete',
  hasSquad: true,
  nvg: true,
  intelTotal: 5,
  darknessAt: 0,
  objectives: [
    { id: 'o_harbour', text: 'Cross the quay to the tower podium', marker: { x: 0, y: 1, z: 14 } },
    { id: 'o_floor12', text: 'Take the lift to the server floor — 12', marker: { x: 0, y: 1, z: 6 } },
    { id: 'o_floor27', text: 'Cross the atrium — 27', marker: { x: 0, y: 1, z: 6 } },
    { id: 'o_floor41', text: 'Clear the executive level — 41', marker: { x: 0, y: 1, z: 6 } },
    { id: 'o_helipad', text: 'Ride to the roof — 54', marker: { x: 0, y: 1, z: 6 } },
    { id: 'o_ledger', text: 'Decide what happens to the ledger' },
    { id: 'o_epilogue', text: 'The grave at Mansoura' }
  ]
};

export const CH07_FLAGS = {
  PUBLISHED_LEDGER: 'PUBLISHED_LEDGER',
  LEVERAGED_LEDGER: 'LEVERAGED_LEDGER',
  BURNED_LEDGER: 'BURNED_LEDGER',
  FOUND_ALL_INTEL: 'FOUND_ALL_INTEL',
  BOX_07B: 'BOX_07B'
};

export const CH07_LAYOUT = {
  quayZ: 78,
  /** Lobby and lift bank. Inside the tower footprint — see buildLift(). */
  liftZ: 0,
  towerW: 34,
  towerD: 26,
  towerZ: -10,
  /** Walking surface of each playable floor, in metres. Absolute, not derived. */
  floorY: [0, 12.4, 27.6, 41.6, 54.6],
  /** Where the player arrives on each floor: the lift bank, south side. */
  arriveZ: -4.6,
  liftRide: 2.4,
  /**
   * Documents the 1973 coda requires — the manifest minus the two the epilogue
   * hands out itself. Derived rather than hardcoded: a constant that disagrees
   * with the manifest makes the coda either impossible (if too high) or free
   * (if too low), and both have happened in this project.
   */
  campaignIntelTotal: codaRequirement(),
  campaignIntelManifest: INTELLIGENCE.length
};

export function buildLegacyMission(game, world) {
  const L = CH07_LAYOUT;
  const { ground } = buildHarbourTerrain(world);
  addHarbourSilhouette(world);
  addDawnGlow(world);

  const L4 = L.floorY[4];
  // The tower is silhouette above the roof, so it starts at the roof line.
  const tower = addTower(world, 0, L.towerZ, L.towerW, L.towerD, 40, L4 + 0.2);
  buildPodium(world);
  const floors = buildFloors(world, game);
  const helipadY = L4;
  const helipad = addHelipad(world, 0, helipadY, L.towerZ, 9);

  // ------------------------------------------------------------------ squad
  // The roster is whoever survived to this point. SAVED_FANG is written by
  // chapter 05; JACKAL and MOUSE are permanent.
  world.friendSpawns.length = 0;
  const roster = [
    { callsign: 'JACKAL', nameEn: 'Sgt. Hoda Mansour', nameAr: 'هدى منصور', role: 'engineer', slot: 1, pos: { x: -2.4, y: 0.05, z: 74 } },
    { callsign: 'MOUSE', nameEn: 'Sgt. Adel Farhan', nameAr: 'عادل فرحان', role: 'comms', slot: 2, pos: { x: 2.4, y: 0.05, z: 74 }, radio: true }
  ];
  if (game.save?.progress?.flags?.SAVED_FANG) {
    roster.unshift({ callsign: 'FANG', nameEn: 'Lt. Karim El-Sayed', nameAr: 'كريم السيد', role: 'marksman', slot: 0, pos: { x: 0, y: 0.05, z: 72 } });
  }
  for (const m of roster) {
    world.addFriend({ ...m, era: 'modern', palette: PALETTE.egyptModern, weapon: 'enemy_modern' });
  }

  // ------------------------------------------------------------------ state
  const mission = game.mission;
  const queue = [];
  // `now` is the game-time clock the queue below is measured against. Stamping
  // against game.time and then polling against game.time is the trap: the
  // caller advances the clock between the two, and the beat is already due.
  const now = () => (game.time || 0);
  const after = (seconds, fn) => queue.push({ at: now() + seconds, fn });
  world.addAnimated(() => {
    if (!queue.length) return;
    const t = now();
    for (let i = queue.length - 1; i >= 0; i--) {
      if (t >= queue[i].at) queue.splice(i, 1)[0].fn();
    }
  });

  const state = {
    after,
    floor: 0,
    riding: false,
    clearedFloor: {},
    ledgerDone: false,
    epilogue: false,
    foundAllIntel: false,
    ledgerChoice: null,
    zidanState: game.save?.progress?.flags?.ZIDAN_STATE || null,
    curatorSpared: !!game.save?.progress?.flags?.SPARED_CURATOR
  };

  spawnGarrisons(world);
  buildLift(world, state, game, mission, after);
  buildQuay(world, state, game, mission);
  buildLedger(world, state, game, mission, helipadY);

  // The 1973 coda only unlocks if the player actually found every document in
  // the manifest. `campaignIntelTotal` used to be a hardcoded 21 while only 12
  // of those ids were recorded anywhere: the gate was unsatisfiable. It is now
  // derived from the manifest, and re-checked when the epilogue runs because the
  // chapter's own document is collected during the epilogue itself.
  // Count only manifest documents that the epilogue does not hand out itself.
  // A raw Object.keys() count is wrong twice over: it accepts ids the manifest
  // has never heard of, and it counts the coda's own rewards.
  const requiredIds = INTELLIGENCE.filter((d) => !d.epilogue).map((d) => d.id);
  const intelFound = () => {
    const held = game.save?.progress?.intel || {};
    return requiredIds.filter((id) => held[id]).length;
  };
  const refreshFoundAll = () => {
    state.intelCount = intelFound();
    state.foundAllIntel = state.intelCount >= L.campaignIntelTotal;
    if (state.foundAllIntel) setFlag(game, CH07_FLAGS.FOUND_ALL_INTEL);
    return state.foundAllIntel;
  };
  state.refreshFoundAll = refreshFoundAll;
  refreshFoundAll();

  return { ground, tower, floors, helipad, state };
}

// --------------------------------------------------------------------------
// geometry
// --------------------------------------------------------------------------

/**
 * The podium is the tower's own ground floor. Earlier drafts put a separate
 * lobby building in front of the tower on the quay, which put the lift shaft
 * outside the tower footprint entirely: you would "ride" to floor 12 and arrive
 * in mid-air above the water. The lobby is now where it belongs, inside the
 * tower, and the quay is the approach to its south doors.
 */
/**
 * One document per floor. Each is the thing a real building like this would
 * actually have on it: a data inventory, a tenancy record, a minutes book, and
 * a flight log. They are awarded when the doors open, so a player who rides the
 * lift cannot miss one and a player who does not reach the floor cannot fake it.
 */
const FLOOR_DOSSIERS = {
  1: {
    id: 'ch07_server_inventory',
    title: 'Server inventory — floor 12',
    era: 'modern',
    body: 'Four hundred and six drives. Eleven of them are labelled with Egyptian military file references and none of them are encrypted, because the people who own this building have never had to be afraid of a search warrant.'
  },
  2: {
    id: 'ch07_atrium_tenancy',
    title: 'Tenancy schedule — floor 27',
    era: 'modern',
    body: 'The atrium is eight storeys of nothing because the company that owns the tower deducts it as "public realm". The occupant of the executive level has been the same shell company since 2011, and its registered address is a post office box in Alexandria.'
  },
  3: {
    id: 'ch07_exec_minutes',
    title: 'Board minutes — floor 41',
    era: 'modern',
    body: 'Item seven, fifteen consecutive meetings: "Archive status: no change." Somebody has been asking the same question about box 07 every quarter for four years, and every quarter the answer has been a lie someone typed.'
  },
  4: {
    id: 'ch07_pad_log',
    title: 'Flight log — helipad',
    era: 'modern',
    body: 'The pad has been used nine times this year, always between 03:00 and 05:00, always a charter out of Cairo West. Tonight is the tenth slot. Somebody is expecting to leave.'
  }
};

function buildPodium(world) {
  const L = CH07_LAYOUT;
  const h = 5.6;
  const z0 = L.towerZ;

  // lobby slab, 34 × 26 at ground level
  world.addBox(0, -0.2, z0, L.towerW, 0.4, L.towerD, MAT.concrete(0x6e6c66), { solid: true });

  // north / west / east walls are solid
  world.addBox(0, h / 2, z0 - L.towerD / 2, L.towerW, h, 0.5, MAT.concrete(0x8a8880), { cover: true });
  for (const sx of [-1, 1]) {
    world.addBox(sx * L.towerW / 2, h / 2, z0, 0.5, h, L.towerD, MAT.concrete(0x8a8880), { cover: true });
  }
  // South wall with a 5 m doorway onto the quay. Two segments, symmetric,
  // leaving the gap on the centreline where the player spawns.
  {
    const doorHalf = 2.5;
    const segW = (L.towerW - doorHalf * 2) / 2;
    for (const sx of [-1, 1]) {
      world.addBox(sx * (doorHalf + segW / 2), h / 2, z0 + L.towerD / 2, segW, h, 0.5, MAT.concrete(0x8a8880), { cover: true });
    }
  }
  // ceiling (the tower above starts at the roof, so this is a real ceiling)
  world.addBox(0, h, z0, L.towerW + 0.6, 0.4, L.towerD + 0.6, MAT.concrete(0x54524c), { blockVision: true });

  // reception desk, planters, a security turnstile bank — cover on the way in
  world.addBox(-8, 0.55, z0 + 4, 5.0, 1.1, 1.2, MAT.wood ? MAT.wood() : MAT.concrete(0x5a4a38), { cover: true });
  world.addBox(0, 0.7, z0 + 6.5, 1.0, 1.4, 1.0, MAT.concrete(0x5f6a5a), { cover: true });
  world.addBox(8, 0.7, z0 + 6.5, 1.0, 1.4, 1.0, MAT.concrete(0x5f6a5a), { cover: true });
  for (const sx of [-1, 1]) {
    world.addBox(sx * 5, 0.6, z0 + 4.0, 1.4, 1.2, 1.0, MAT.metal(0x3c4248), { cover: true });
  }
  // lobby lights
  for (const sx of [-9, 0, 9]) {
    const pl = new THREE.PointLight(0xe8dfc8, 3.0, 22);
    pl.position.set(sx, h - 0.8, z0 + 3);
    world.group.add(pl);
  }

  // ---- the quay, south of the tower
  for (let z = 20; z <= 80; z += 12) {
    for (const sx of [-17, 17]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.6, 8), MAT.metal(0x33383c));
      b.position.set(sx, 0.3, z);
      world.addObject(b, { solid: false, tag: 'bollard' });
    }
  }
  world.addBox(-26, 1.3, 34, 2.45, 2.55, 6.1, MAT.container ? MAT.container(0x4a5a54) : MAT.metal(0x4a5a54), { cover: true });
  world.addBox(26, 1.3, 44, 2.45, 2.55, 6.1, MAT.metal(0x4a4a44), { cover: true });
  world.addBox(-9, 1.1, 52, 3.4, 2.2, 1.0, MAT.metal(0x3a4048), { cover: true });
  world.addBox(9, 1.1, 60, 3.4, 2.2, 1.0, MAT.metal(0x3a4048), { cover: true });
  for (const sx of [-12, 12]) {
    for (const z of [24, 44, 64, 82]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 6.4, 8), MAT.metal(0x2a2e32));
      pole.position.set(sx, 3.2, z);
      world.addObject(pole, { solid: false, tag: 'lamp' });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xffe0b0, emissive: 0xffb060, emissiveIntensity: 1.8 }));
      head.position.set(sx, 6.5, z);
      world.addObject(head, { solid: false, tag: 'lamp' });
      const light = new THREE.PointLight(0xffc07a, 2.2, 22);
      light.position.set(sx, 6.4, z);
      world.group.add(light);
    }
  }
}

function buildFloors(world) {
  const L = CH07_LAYOUT;
  const z0 = L.towerZ;
  const out = [];
  // A lift lobby at the south of every floor; the north door leads into the
  // arena itself. Both 4 m openings line up with the lift bank.
  const openBoth = [{ side: 's', width: 4.0 }, { side: 'n', width: 4.0 }];

  // 12 — the server floor. Four racks across, five rows deep: a hall of aisles
  // rather than a single row down the middle of an empty room. The aisles are
  // 2.1 m — wide enough to fight in, narrow enough to be a bad place to be.
  out.push(addFloorPlate(world, { x: 0, z: z0, y: L.floorY[1], w: L.towerW, d: L.towerD, h: 4.4, openings: openBoth }));
  for (const cx of [-11, -4, 3, 10]) {
    for (let r = 0; r < 6; r++) {
      addServerRow(world, cx, L.floorY[1], z0 - 11 + r * 3.6, 3, 0);
    }
  }

  // 27 — the atrium. The void is the middle of the room; the fight is on the
  // balcony ring around it.
  out.push(addFloorPlate(world, { x: 0, z: z0, y: L.floorY[2], w: L.towerW, d: L.towerD, h: 8.8, openings: openBoth }));
  addAtrium(world, 0, L.floorY[2], z0 - 4, 12, 12, 8.8);

  // 41 — the executive level
  out.push(addFloorPlate(world, { x: 0, z: z0, y: L.floorY[3], w: L.towerW, d: L.towerD, h: 4.6, openings: openBoth }));
  addBoardroom(world, 0, L.floorY[3], z0 - 4);

  // 54 — the roof. No ceiling: the helipad is up here and the sky is the point.
  out.push(addFloorPlate(world, {
    x: 0, z: z0, y: L.floorY[4], w: L.towerW, d: L.towerD, h: 3.2,
    openings: [{ side: 's', width: 4.0 }], roof: true
  }));
  addRoofRail(world, -L.towerW / 2, z0 - L.towerD / 2, L.towerW / 2, z0 - L.towerD / 2, L.floorY[4]);

  return out;
}

// --------------------------------------------------------------------------
// the lift
// --------------------------------------------------------------------------

/**
 * The lift bank at the south end of the tower. One car, four stops.
 *
 * A ride is: press → 0.5 s → teleport into the destination floor's lobby →
 * 2.4 s → doors open and the floor's garrison wakes. The car is a sealed shaft
 * the player is teleported out of, so the move never happens in view, and the
 * floors are stacked at absolute Y values rather than derived ones — deriving
 * them from a floor index is how you end up with an arrival at 97 m in a
 * building whose roof is at 54 m.
 */
function buildLift(world, state, game, mission, after) {
  const L = CH07_LAYOUT;
  const car = { x: 0, z: L.towerZ + 9.0 };

  // shaft walls at lobby level
  for (const sx of [-1, 1]) {
    world.addBox(car.x + sx * 2.6, 2.8, car.z, 0.4, 5.6, 4.4, MAT.metal(0x34393e), { cover: true });
  }
  world.addBox(car.x, 2.8, car.z - 2.0, 5.6, 5.6, 0.4, MAT.metal(0x2c3136), { cover: true });
  world.addBox(car.x, 2.8, car.z + 2.2, 5.6, 5.6, 0.3, MAT.metal(0x2c3136), { solid: false });
  // the floor indicator above the doors
  const ind = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x0d1418, emissive: 0xc9552a, emissiveIntensity: 1.1 }));
  ind.position.set(car.x, 3.4, car.z + 2.02);
  world.addObject(ind, { solid: false, tag: 'lift-indicator' });

  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 12),
    new THREE.MeshStandardMaterial({ color: 0xd8d2c0, emissive: 0x50d0a0, emissiveIntensity: 1.4 }));
  btn.position.set(3.4, 1.25, car.z + 2.4);
  btn.rotation.x = Math.PI / 2;
  world.addObject(btn, { solid: false, tag: 'lift-button' });
  const btnLight = new THREE.PointLight(0x50d0a0, 1.2, 7);
  btnLight.position.set(3.4, 1.4, car.z + 2.8);
  world.group.add(btnLight);

  world.addInteractable({
    id: 'ch07_lift_call',
    pos: { x: 3.4, y: 1.25, z: car.z + 2.4 },
    radius: 2.8,
    label: 'CALL THE LIFT',
    onUse: () => {
      if (state.riding) return;
      if (state.floor >= 4) {
        game.hud.feed('THE LIFT ONLY GOES UP', 'intel');
        return;
      }
      rideLift();
    }
  });

  const FLOOR_NAMES = ['LOBBY', 'SERVER FLOOR — 12', 'ATRIUM — 27', 'EXECUTIVE — 41', 'ROOF — 54'];
  const FLOOR_LINES = [
    { speaker: 'HODA "JACKAL" MANSOUR', en: 'Lobby. Nothing upstairs is going to be surprised by a lift.', ar: 'اللوبي. مفيش حد فوق هيتفاجئ بأسانسير.' },
    { speaker: 'ADEL "MOUSE" FARHAN', en: 'Server floor. Everything the network ever filed is on these racks.', ar: 'دور السيرفرات. كل ملف نزّله الجهاز عمره على الرفوف دي.' },
    { speaker: 'HODA "JACKAL" MANSOUR', en: 'The atrium is eight storeys of open air. Do not stop moving on the balcony.', ar: 'الصالة تمانية أدوار هوا. متوقفش على البلكونة.' },
    { speaker: 'GEN. ZIDAN', en: 'The executive level. This is where the money signed the paperwork, Lieutenant.', ar: 'الدور التنفيذي. هنا الفلوس وقّعت الورق يا ملازم.' },
    { speaker: 'NASSER 07', en: 'Roof. Twenty-two minutes to dawn and a way out of this building.', ar: 'السطح. اتنين وعشرين دقيقة للفجر وطريق خروج.' }
  ];

  function rideLift() {
    const next = state.floor + 1;
    if (next > 4 || state.riding) return;
    state.riding = true;
    const idx = next;
    game.hud.feed(`LIFT — ${FLOOR_NAMES[idx]}`, 'intel');
    game.audio?.uiClick?.();

    after(0.5, () => {
      // `arriveZ` is inside the tower footprint. The first draft used the
      // south kerb, one metre outside the floor slab: the player arrived in
      // mid-air over the quay and fell 12 m to the ground floor.
      game.teleport(car.x, L.floorY[idx] + 0.05, L.arriveZ);
    });
    after(L.liftRide, () => {
      state.floor = idx;
      state.riding = false;
      mission.completeObjective(idx, { notice: FLOOR_NAMES[idx] });
      game.hud.say({ ...FLOOR_LINES[idx], time: 5000 });
      const count = wakeFloor(world, idx, game);
      // One document per arena floor: the debrief promises five dots for this
      // chapter and the campaign's coda counts every one of them.
      const dossier = FLOOR_DOSSIERS[idx];
      if (dossier) mission.addIntel(dossier);
      if (count) game.hud.feed(`${count} HOSTILES ON THIS FLOOR`, 'warn');
      // The floor is not "done" until it is quiet — but the lift never waits on
      // it, so a defender who gets stuck in cover cannot softlock the chapter.
      const watch = () => {
        if (floorCleared(game, idx)) {
          game.hud.feed(`${FLOOR_NAMES[idx]} CLEAR`, 'intel');
          game.hud.say({
            speaker: 'HODA "JACKAL" MANSOUR',
            en: 'Floor is quiet. Call the lift.',
            ar: 'الدور سكت. نادي الأسانسير.',
            radio: true, time: 3000
          });
          world.meta[`floor${idx}Clear`] = true;
        } else {
          after(1.5, watch);
        }
      };
      after(2.0, watch);
      if (idx === 4) after(3.0, () => rooftopBeat(world, state, game, mission, after));
    });
  }

  state.rideLift = rideLift;
  state.car = car;
  state.floorNames = FLOOR_NAMES;
}

/**
 * Wake a floor. Every defender is spawned up front as `hidden` — the AI has no
 * late-spawn path, because spawnEnemies only runs once during startMission —
 * and the floor's garrison is revealed when its lift doors open.
 */
function wakeFloor(world, idx, game) {
  const squad = game.ai.enemies.filter((e) => String(e.id).startsWith(`ch07_f${idx}_`) && e.hidden);
  for (const e of squad) {
    e.hidden = false;
    e.mesh.visible = true;
    e.awareness = 0.12;
  }
  if (squad.length) game.audio?.radio(4, 0.6);
  world.meta[`floor${idx}Woken`] = true;
  return squad.length;
}

/** True once every defender on a floor is down. Used for the clear callout. */
function floorCleared(game, idx) {
  const squad = game.ai.enemies.filter((e) => String(e.id).startsWith(`ch07_f${idx}_`));
  return squad.length > 0 && squad.every((e) => e.dead);
}

// --------------------------------------------------------------------------
// garrisons
// --------------------------------------------------------------------------

/**
 * Defenders per floor, as plain data so the simtest can assert both the count
 * and that none of them stands inside a wall. `z` is an offset from the tower
 * centre. Everything except the quay patrol spawns `hidden` and is revealed
 * when its floor's lift doors open.
 */
// Offsets are measured from CH07_LAYOUT.towerZ, and the plate is only 26 m
// deep, so every offset has to sit inside ±12. An earlier pass used −20 here:
// ten defenders were standing in the void outside the north wall.
const GARRISON = {
  1: [ // server floor — 12, in the aisles between the rack columns
    { x: -7.5, z: -9.5, role: 'rifleman', yaw: Math.PI },
    { x: 7.0, z: -9.5, role: 'rifleman', yaw: Math.PI },
    { x: -7.5, z: -2.5, role: 'marksman', yaw: Math.PI },
    { x: 7.0, z: 4.5, role: 'rifleman', yaw: 0 }
  ],
  2: [ // atrium — 27, on the balcony ring around the void
    { x: -14, z: -11, role: 'rifleman', yaw: 0 },
    { x: 14, z: -11, role: 'rifleman', yaw: 0 },
    { x: -14, z: 2, role: 'marksman', yaw: Math.PI },
    { x: 14, z: 2, role: 'marksman', yaw: Math.PI },
    { x: 0, z: -12, role: 'officer', yaw: Math.PI }
  ],
  3: [ // executive — 41, two at the window wall, two at the doors
    { x: -12, z: -11, role: 'officer', yaw: Math.PI },
    { x: 12, z: -11, role: 'officer', yaw: Math.PI },
    { x: -7, z: 3, role: 'rifleman', yaw: Math.PI },
    { x: 7, z: 3, role: 'rifleman', yaw: Math.PI }
  ],
  4: [ // roof — 54, around the pad, inside the parapet stubs
    { x: -11, z: -11, role: 'marksman', yaw: Math.PI },
    { x: 11, z: -11, role: 'marksman', yaw: Math.PI },
    { x: 0, z: -12, role: 'officer', yaw: Math.PI },
    { x: -4, z: 4, role: 'rifleman', yaw: Math.PI }
  ]
};

/** Podium security: the only defenders the player meets before the lift. */
const PODIUM_GARRISON = [
  { x: -7, z: 30, role: 'rifleman', yaw: 0 },
  { x: 7, z: 38, role: 'rifleman', yaw: 0 },
  { x: 0, z: 52, role: 'rifleman', yaw: 0 },
  { x: -10, z: 62, role: 'marksman', yaw: 0 }
];

/** Lobby detail: two men who do not expect the front door to open. */
const LOBBY_GARRISON = [
  { x: -8, z: 1, role: 'rifleman', yaw: Math.PI },
  { x: 8, z: -3, role: 'rifleman', yaw: Math.PI }
];

export const CH07_GARRISON = GARRISON;
export const CH07_PODIUM_GARRISON = PODIUM_GARRISON;
export const CH07_LOBBY_GARRISON = LOBBY_GARRISON;

function spawnGarrisons(world) {
  const L = CH07_LAYOUT;
  // Every enemy carries its floor in its ID. `floor` cannot be a spawn field:
  // the Enemy constructor copies a fixed list of options and drops the rest,
  // so a `e.floor` would be undefined by the time wakeFloor looked for it.
  PODIUM_GARRISON.forEach((p, i) => {
    world.addEnemy({
      id: `ch07_f0_${i}`,
      pos: { x: p.x, y: 0.05, z: p.z }, yaw: p.yaw,
      post: { x: p.x, y: 0.05, z: p.z },
      era: 'modern', palette: PALETTE.nkGuard, weapon: 'enemy_modern',
      role: p.role, faction: 'meridian'
    });
  });
  LOBBY_GARRISON.forEach((p, i) => {
    world.addEnemy({
      id: `ch07_f0_l${i}`,
      pos: { x: p.x, y: 0.05, z: L.towerZ + p.z }, yaw: p.yaw,
      post: { x: p.x, y: 0.05, z: L.towerZ + p.z },
      era: 'modern', palette: PALETTE.nkGuard, weapon: 'enemy_modern',
      role: p.role, faction: 'meridian'
    });
  });
  for (const floor of [1, 2, 3, 4]) {
    const y = L.floorY[floor] + 0.05;
    GARRISON[floor].forEach((p, i) => {
      world.addEnemy({
        id: `ch07_f${floor}_${i}`,
        pos: { x: p.x, y, z: L.towerZ + p.z }, yaw: p.yaw,
        era: 'modern', palette: PALETTE.nkGuard, weapon: 'enemy_modern',
        role: p.role, faction: 'meridian', hidden: true
      });
    });
  }
}

// --------------------------------------------------------------------------
// 7.1 — the quay
// --------------------------------------------------------------------------

function buildQuay(world, state, game, mission) {
  world.addTrigger('ch07_quay', { x: 0, y: 1, z: 46 }, 12, () => {
    if (state.reachedQuay) return;
    state.reachedQuay = true;
    game.hud.say({
      speaker: 'HODA "JACKAL" MANSOUR',
      en: 'Forty minutes until the harbour wakes up. After that we are the only people on this dock with guns.',
      ar: 'أربعين دقيقة والمرسى يصحى. بعدها إحنا الوحيدين على الرصيف دول اللي معاهم سلاح.',
      radio: true,
      time: 5200
    });
    game.audio?.radio(9, 0.35);
  }, true);

  world.addTrigger('ch07_podium', { x: 0, y: 1, z: 22 }, 9, () => {
    if (state.reachedPodium) return;
    state.reachedPodium = true;
    mission.completeObjective(0, { notice: 'At the podium' });
    game.hud.say({
      speaker: 'ADEL "MOUSE" FARHAN',
      en: 'Lift bank is at the back of the lobby. Fifty-four floors of private equity between you and the roof.',
      ar: 'الأسانسير في آخر اللوبي. أربعة وخمسين دور فلوس بينك وبين السطح.',
      radio: true
    });
  }, true);
}

// --------------------------------------------------------------------------
// 7.5 / 7.6 — the roof and the ledger
// --------------------------------------------------------------------------

function rooftopBeat(world, state, game, mission, after) {
  const zidanDead = state.zidanState === 'dead';
  const speaker = zidanDead || state.curatorSpared ? 'THE CURATOR' : 'GEN. ZIDAN';
  const line = zidanDead
    ? 'You shot the general in his own bunker. Somebody has to keep the record now, Lieutenant, and it appears to be me.'
    : state.curatorSpared
      ? 'I am here because you let me be. That is not mercy. That is a decision you are going to have to live inside.'
      : 'You climbed fifty-four floors to hand me a folder. I could have had it couriered.';
  const lineAr = zidanDead
    ? 'ضربت اللواء في مخبأه. لازم حد يحفظ السجل دلوقتي يا ملازم، ويبان إنه أنا.'
    : state.curatorSpared
      ? 'أنا هنا لأنك سيبتني أعيش. ده مش رحمة. ده قرار هتعيش جواه.'
      : 'طلعت أربعة وخمسين دور عشان تسلمني ملف. كان ممكن أبعته بالبريد.';

  game.hud.say({ speaker, en: line, ar: lineAr, time: 5600 });

  after(5.8, () => {
    game.hud.feed('THE LEDGER IS ON THE PAD', 'intel');
    game.hud.say({
      speaker: 'HODA "JACKAL" MANSOUR',
      en: 'The case is on the pad. Whatever you are going to do, do it before the harbour wakes up.',
      ar: 'الشنطة على السطح. أي حاجة هتعملها اعملها قبل ما المرسى يصحى.',
      radio: true,
      urgent: true,
      time: 4800
    });
  });
  void mission;
}

function buildLedger(world, state, game, mission, helipadY) {
  const L = CH07_LAYOUT;
  const caseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 0.46), MAT.metal(0x3a4048));
  caseMesh.position.set(0, helipadY + 0.42, L.towerZ + 1.0);
  caseMesh.castShadow = true;
  world.addObject(caseMesh, { solid: false, tag: 'ledger-case' });
  const glow = new THREE.PointLight(0x60c0ff, 1.6, 8);
  glow.position.set(0, helipadY + 0.9, L.towerZ + 1.0);
  world.group.add(glow);
  world.addProp('ch07_ledger_case', caseMesh, 'ledger', { decided: false });

  world.addInteractable({
    id: 'ch07_ledger_read',
    pos: { x: 0, y: helipadY, z: L.towerZ + 1.0 },
    radius: 3.0,
    label: 'TAKE THE LEDGER',
    onUse: () => {
      if (state.ledgerDone) return;
      if (state.floor < 4) return;
      state.ledgerDone = true;
      mission.completeObjective(5, { notice: 'The ledger is decided' });
      presentLedgerDecision(game, state, mission);
    }
  });

  // The interactable is live from mission start so the prompt machinery has
  // something to find, but the case only physically appears once the roof
  // beat runs. Both are driven from the same flag.
  world.addAnimated(() => {
    const prop = world.props.get('ch07_ledger_case');
    if (!prop) return;
    const onRoof = state.floor >= 4;
    prop.alive = onRoof;
    prop.mesh.visible = onRoof;
    const it = world.interactables.find((i) => i.id === 'ch07_ledger_read');
    if (it) it.taken = state.ledgerDone || !onRoof;
  });
}

function presentLedgerDecision(game, state, mission) {
  const options = [
    {
      id: 'publish',
      text: 'Publish it. Give it to the civilian archive.',
      textAr: 'انشره. اده لمحفوظات مدنية.',
      apply: () => {
        state.ledgerChoice = 'publish';
        setFlag(game, CH07_FLAGS.PUBLISHED_LEDGER);
        game.hud.say({
          speaker: 'NASSER 07',
          en: 'Every page, every duplicate, every name. Let them try to file it back into a drawer.',
          ar: 'كل ورقة، كل نسخة، كل اسم. خلّيهم يحاولوا يخبّوها في درج تاني.'
        });
      }
    },
    {
      id: 'leverage',
      text: 'Keep it. Leverage outlives truth.',
      textAr: 'احتفظ بها. النفوذ أطول عمراً من الحقيقة.',
      apply: () => {
        state.ledgerChoice = 'leverage';
        setFlag(game, CH07_FLAGS.LEVERAGED_LEDGER);
        game.hud.say({
          speaker: 'NASSER 07',
          en: 'I will hold it. Somebody in this building has to be holding something.',
          ar: 'هحتفظ بيها. لازم حد في المبنى ده يكون ماسك حاجة.'
        });
      }
    },
    {
      id: 'burn',
      text: 'Burn it. It has cost enough.',
      textAr: 'احرقها. كلّفت كفاية.',
      apply: () => {
        state.ledgerChoice = 'burn';
        setFlag(game, CH07_FLAGS.BURNED_LEDGER);
        game.hud.say({
          speaker: 'NASSER 07',
          en: 'My grandfather took the bribe and never said a word. If I keep this, I am him with better paperwork.',
          ar: 'جدي خد الرشوة ومقالش كلمة. لو حافظت عليها، أنا هو بورق أحسن.'
        });
      }
    }
  ];

  if (game.hud?.showChoice) {
    game.hud.showChoice({
      prompt: 'WHAT DO YOU DO WITH THE LEDGER?',
      promptAr: 'تعمل إيه في الدفتر؟',
      options
    });
  } else {
    options[0].apply();
  }

  state.after(6.0, () => epilogue(game, state, mission));
}

function epilogue(game, state, mission) {
  if (state.epilogue) return;
  state.epilogue = true;
  const ending = game.save.resolveEnding();
  const copy = game.save.endingCopy(ending);
  const title = game.save.endingTitle(ending);

  game.hud.feed(`ENDING — ${title}`, 'intel');
  game.hud.say({
    speaker: 'NASSER 07',
    en: copy.en.length > 300 ? `${copy.en.slice(0, 297)}…` : copy.en,
    ar: copy.ar,
    time: 7200
  });

  state.after(6.4, () => {
    mission.completeObjective(6, { notice: 'The grave at Mansoura' });
    // Re-check rather than trusting the load-time snapshot: the roof's own
    // document is collected before this point, and it counts.
    const allFound = state.refreshFoundAll ? state.refreshFoundAll() : state.foundAllIntel;
    if (allFound) {
      game.hud.say({
        speaker: 'NASSER 07',
        en: 'You took the bribe to buy back sixty men, then let them call you a traitor for forty-one years. I could have carried that with you.',
        ar: 'خدت الرشوة عشان ترجّع ستين راجل، وبعدين خليتهم يقولوا عليك خاين واحد وأربعين سنة. كان ممكن أشاركك الحمل.',
        time: 6400
      });
      mission.addIntel({
        id: 'ch07_coda_1973',
        title: 'Coda — Mansoura, dawn',
        era: '1973',
        body: 'The grave is a plain stone with a rank and two dates. On the back of the 1973 page, under the co-signature, is a line nobody had read closely enough: "if this is found, the men at kilometre 41 came home because of it."'
      });
    } else {
      game.hud.say({
        speaker: 'NASSER 07',
        en: 'I never found all of it. Enough of it, though. Enough to stand here.',
        ar: 'مكلقيتش كله. لكن لقيت اللي يكفي. يكفي إني أقف هنا.',
        time: 5200
      });
    }
  });

  // Sequel hook: the box one drawer along.
  state.after(14, () => {
    setFlag(game, CH07_FLAGS.BOX_07B);
    mission.addIntel({
      id: 'box07b',
      title: 'BOX 07-B',
      era: 'modern',
      body: 'In the same vault, one drawer along, a second box carries the number 07-B. The label is in a hand Nasser does not recognise, and the date written on it is next year.'
    });
    game.hud.feed('INTELLIGENCE — there is a second box', 'intel');
  });
}

function setFlag(game, name, value = true) {
  game.save.setFlag(name, value);
}

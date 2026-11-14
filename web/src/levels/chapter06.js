/**
 * SHADOW PROTOCOL — CHAPTER 06: SHADOW PROTOCOL
 * Present day · Facility Mizan, Western Desert · Nasser 07
 *
 * The campaign's heaviest chapter and its narrative core. Four rings descend
 * through a 1960s Soviet-supplied bunker: Security, Records, Habitat, Core.
 *
 * 6.1 SALT FLAT   — sandstorm approach to one of three entrances
 * 6.2 SECURITY    — tripwires, motion sensors, and a mantrap timing puzzle
 * 6.3 RECORDS     — the heaviest firefight, amid archive shelving
 * 6.4 HABITAT     — the people who have lived down here for fifty years
 * 6.5 CORE        — the Curator, the original page, and Zidan
 *
 * The reveal: the 1973 page in Taher's helmet is a duplicate. The original is
 * here, and it names Taher as a co-conspirator — he took the bribe to fund the
 * rescue of the platoon and never told anyone.
 */
import * as THREE from 'three';
import { PALETTE } from '../game/models.js';
import { MAT } from '../engine/materials.js';
import {
  buildMizanTerrain, addCorridor, addRingChamber, addBlastDoor, addTripwire,
  addArchiveShelving, addSecurityConsole, addMotionSensor, addCoreLighting,
  addVault, addSandstorm
} from './libMizan.js';

export const CHAPTER_06_MISSION = {
  id: 'ch06_shadow_protocol',
  chapterIndex: 6,
  code: 'FACILITY MIZAN / WESTERN DESERT',
  title: 'Shadow Protocol',
  cardEra: 'WESTERN DESERT · SALT FLAT · 05:50',
  cardNum: 'CHAPTER 06',
  subtitle: 'Facility Mizan<br>Sixty metres down, since 1963',
  synopsis: 'The address in the ledger is a salt flat with a hole in it. What is underneath has been staffed, funded and kept secret for sixty years — and it has been reading our files the whole time.',
  era: 'modern',
  loadout: ['pistol', 'mp5sd', 'm4'],
  start: { x: 0, y: 1.2, z: 96 },
  startYaw: Math.PI,
  surface: 'sand',
  hasSquad: true,
  nvg: true,
  intelTotal: 6,
  darknessAt: 0,
  objectives: [
    { id: 'o_approach', text: 'Cross the salt flat in the sandstorm', marker: { x: 0, y: 1, z: 40 } },
    { id: 'o_security', text: 'Get through the Security ring', marker: { x: 0, y: 1, z: -10 } },
    { id: 'o_mantrap', text: 'Time the mantrap and get inside', marker: { x: 0, y: 1, z: -26 } },
    { id: 'o_records', text: 'Fight through the Records ring', marker: { x: 0, y: 1, z: -54 } },
    { id: 'o_habitat', text: 'Descend through Habitat to the Core', marker: { x: 0, y: 1, z: -86 } },
    { id: 'o_curator', text: 'Find the Curator' },
    { id: 'o_page', text: 'Recover the original 1973 page', type: 'optional' },
    { id: 'o_zidan', text: 'Decide what to do about Zidan' }
  ]
};

export const CH06_FLAGS = {
  SPARED_CURATOR: 'SPARED_CURATOR',
  ZIDAN_STATE: 'ZIDAN_STATE',
  ORIGINAL_PAGE: 'ORIGINAL_PAGE'
};

export const CH06_LAYOUT = {
  securityZ: -10,
  mantrapZ: -26,
  recordsZ: -54,
  habitatZ: -86,
  coreZ: -118,
  /** Seconds the mantrap cycle gives you between the two doors. */
  mantrapCycle: 6,
  ringCount: 4
};

export function buildMizanMission(game, world) {
  const { ground } = buildMizanTerrain(world);
  buildExterior(world);
  buildSecurityRing(world);
  buildRecordsRing(world);
  buildHabitatRing(world);
  const core = buildCoreRing(world);

  // ------------------------------------------------------------------ squad
  world.friendSpawns.length = 0;
  for (const member of [
    { callsign: 'FANG', nameEn: 'Lt. Karim El-Sayed', nameAr: 'كريم السيد', role: 'marksman', slot: 0, pos: { x: -2.2, y: 0.05, z: 92 } },
    { callsign: 'JACKAL', nameEn: 'Sgt. Hoda Mansour', nameAr: 'هدى منصور', role: 'engineer', slot: 1, pos: { x: 2.2, y: 0.05, z: 92 } },
    { callsign: 'MOUSE', nameEn: 'Sgt. Adel Farhan', nameAr: 'عادل فرحان', role: 'comms', slot: 2, pos: { x: 0, y: 0.05, z: 90 }, radio: true }
  ]) {
    world.addFriend({ ...member, era: 'modern', palette: PALETTE.egyptModern, weapon: 'enemy_modern' });
  }

  // ------------------------------------------------------------------ state
  const mission = game.mission;
  // Game-time scheduler, as in chapter 05: wall-clock timers keep running
  // while the game is paused and are clamped to 4 ms in the headless harness.
  const queue = [];
  const after = (seconds, fn) => queue.push({ at: (game.time || 0) + seconds, fn });
  world.addAnimated(() => {
    if (!queue.length) return;
    const now = game.time || 0;
    for (let i = queue.length - 1; i >= 0; i--) {
      if (now >= queue[i].at) queue.splice(i, 1)[0].fn();
    }
  });

  const state = {
    after,
    descended: false,
    securityCleared: false,
    mantrapOpen: false,
    mantrapTimer: CH06_LAYOUT.mantrapCycle,
    mantrapInside: false,
    recordsCleared: false,
    habitatReached: false,
    curatorMet: false,
    pageRead: false,
    zidanDone: false,
    tripwires: []
  };

  // ------------------------------------------------------------------ 6.1
  world.addTrigger('ch06_approach', { x: 0, y: 1, z: 44 }, 12, () => {
    if (state.descended) return;
    state.descended = true;
    mission.completeObjective(0, { notice: 'Reached the bunker mouth' });
    game.hud.say({
      speaker: 'ADEL "MOUSE" FARHAN',
      en: 'There is no building. There is a hole with a ramp in it and a door that was made in Leningrad.',
      ar: 'مفيش مبنى. فيه حفرة فيها نزلة وباب اتعمل في لينينجراد.',
      radio: true
    });
    game.audio?.radio(9, 0.35);
    mission.addIntel({
      id: 'ch06_transfer_manifest',
      title: 'Transfer manifest — bunker mouth',
      era: 'modern',
      body: 'A steel clipboard left hanging by the door. Thirty-one deliveries since March, every one of them paper, none of them weapons. The network has not been arming a war down here. It has been stockpiling a record.'
    });
  }, true);

  // ------------------------------------------------------------------ 6.2 security
  // Laser tripwires must be crouched under. Walking through one alerts the
  // ring — a real consequence, not a flash effect. The wires are built by
  // buildSecurityRing before this point and collected here.
  state.tripwires = world.tripwires || [];
  world.addAnimated(() => {
    if (state.securityCleared) return;
    const p = game.player.pos;
    for (const w of state.tripwires) {
      if (w.broken) continue;
      const dx = Math.abs(p.x - w.x);
      const dz = Math.abs(p.z - w.z);
      const inSpan = w.axis === 'x' ? dx < w.length / 2 : dz < w.length / 2;
      const nearBeam = w.axis === 'x' ? dz < 0.45 : dx < 0.45;
      const standing = game.player.crouchT < 0.5;
      // the beam sits at 1.15 m: crouching clears it, standing does not
      if (inSpan && nearBeam && standing && p.y + 1.15 > w.y - 0.15 && p.y + 1.15 < w.y + 0.15) {
        w.broken = true;
        w.beam.material = new THREE.MeshBasicMaterial({ color: 0x552020 });
        game.hud.feed('TRIPWIRE TRIGGERED — SECURITY ALERTED', 'alert');
        game.audio?.radio(6, 0.6);
        for (const e of game.ai.enemies) {
          if (e.faction === 'mizan' && !e.dead) { e.alerted = true; e.awareness = 1; }
        }
      }
    }
  });

  world.addTrigger('ch06_security', { x: 0, y: 1, z: CH06_LAYOUT.securityZ }, 7, () => {
    if (state.securityCleared) return;
    state.securityCleared = true;
    mission.addIntel({
      id: 'ch06_security_log',
      title: 'Duty board — security ring',
      era: 'modern',
      body: 'Shift changes chalked onto a slate: 1963, 1974, 1985, 1996, 2007, 2018. Six entries, five generations, one signature block that has never changed. The same man has been signing this board since before Nasser was born.'
    });
    mission.completeObjective(1, { notice: 'Through the Security ring' });
    game.hud.say({
      speaker: 'HODA "JACKAL" MANSOUR',
      en: 'Everything down here is 1963 and everything down here still works. That is not reassuring.',
      ar: 'كل حاجة هنا من ١٩٦٣ وكل حاجة هنا لسه شغالة. ده مش مطمّن.',
      radio: true
    });
  }, true);

  // ------------------------------------------------------------------ 6.3 mantrap
  // A real timing puzzle: the outer door opens, you have six seconds to cross
  // the vestibule, and the inner door only opens if the outer one has shut.
  const mantrap = buildMantrapDoors(world);
  world.addTrigger('ch06_mantrap_start', { x: 0, y: 1, z: CH06_LAYOUT.mantrapZ + 5 }, 3.2, () => {
    if (state.mantrapOpen) return;
    state.mantrapOpen = true;
    state.mantrapTimer = CH06_LAYOUT.mantrapCycle;
    game.hud.feed('MANTRAP — OUTER DOOR OPEN. SIX SECONDS.', 'alert');
    game.hud.say({
      speaker: 'HODA "JACKAL" MANSOUR',
      en: 'Six seconds between the doors. If it closes on you it does not open again.',
      ar: 'ست ثواني بين البابين. لو قفل عليك مش هيفتح تاني.',
      radio: true,
      urgent: true
    });
  }, true);

  world.addAnimated((dt) => {
    if (!state.mantrapOpen || state.mantrapInside) return;
    state.mantrapTimer = Math.max(0, state.mantrapTimer - dt);
    // doors animate: the outer slides shut, the inner slides open
    const t = 1 - state.mantrapTimer / CH06_LAYOUT.mantrapCycle;
    if (mantrap.outer) mantrap.outer.position.z = mantrap.outerHome + t * 2.2;
    if (mantrap.inner) mantrap.inner.position.z = mantrap.innerHome - Math.max(0, (t - 0.55) / 0.45) * 2.2;
    game.hud.setObjectiveTimer?.(state.mantrapTimer, 'MANTRAP');
    if (state.mantrapTimer <= 0) {
      state.mantrapOpen = false;
      game.hud.setObjectiveTimer?.(null);
      const past = game.player.pos.z < CH06_LAYOUT.mantrapZ;
      if (past) {
        state.mantrapInside = true;
        mission.completeObjective(2, { notice: 'Through the mantrap' });
        game.hud.feed('MANTRAP CLEARED', 'intel');
      } else {
        game.hud.feed('MANTRAP CLOSED — CYCLE AGAIN', 'alert');
        state.mantrapTimer = CH06_LAYOUT.mantrapCycle;
        state.mantrapOpen = true;
      }
    }
  });

  // ------------------------------------------------------------------ 6.3 records
  buildRecordsGarrison(world, game);

  world.addTrigger('ch06_records', { x: 0, y: 1, z: CH06_LAYOUT.recordsZ }, 9, () => {
    if (state.recordsCleared) return;
    state.recordsCleared = true;
    mission.completeObjective(3, { notice: 'Records ring cleared' });
    mission.addIntel({
      id: 'curator_ledger',
      title: 'The Curator\'s original ledger',
      era: 'modern',
      body: 'Every Egyptian military file since 1963 has a duplicate in this room. Including files that were ordered destroyed. Including the one in Nasser\'s helmet.'
    });
    game.hud.say({
      speaker: 'ADEL "MOUSE" FARHAN',
      en: 'Nasser. Every file in this room is ours. Somebody has been copying Cairo for sixty years.',
      ar: 'ناصر. كل ملف في الأوضة دي بتاعنا. حد بيصوّر القاهرة من ستين سنة.',
      radio: true
    });
  }, true);

  // ------------------------------------------------------------------ 6.4 habitat
  world.addTrigger('ch06_habitat', { x: 0, y: 1, z: CH06_LAYOUT.habitatZ }, 10, () => {
    if (state.habitatReached) return;
    state.habitatReached = true;
    mission.completeObjective(4, { notice: 'Descent to the Core' });
    game.hud.say({
      speaker: 'HODA "JACKAL" MANSOUR',
      en: 'There are people living down here. Families. Children. This is not a bunker, it is a town.',
      ar: 'فيه ناس عايشة هنا. عائلات. أطفال. ده مش مخبأ، ده بلد.',
      radio: true
    });
    game.audio?.setTension?.(0.6);
    mission.addIntel({
      id: 'ch06_habitat_roll',
      title: 'Habitat roll — the people below',
      era: 'modern',
      body: 'A school register, hand-ruled on the back of a 1979 duty roster. Forty-one names, thirty of them children, none of them in any Egyptian census. Somebody has been keeping a town off the books for two generations.'
    });
  }, true);

  // ------------------------------------------------------------------ 6.5 core
  const vault = addVault(world, core.x, core.z - 6);
  world.addTrigger('ch06_page', { x: core.x, y: 1, z: core.z - 4.4 }, 2.8, () => {
    if (state.pageRead) return;
    state.pageRead = true;
    mission.completeObjective(6, { notice: 'Recovered the original page' });
    flag(game, CH06_FLAGS.ORIGINAL_PAGE);
    mission.addIntel({
      id: 'original_page_1973',
      title: 'The original — 1973 annex, page 4',
      era: 'modern',
      body: 'The same page that is folded inside Nasser\'s helmet, but this copy has the co-signature field intact. It reads: T. ABDEL-HAKIM. Below it, in the same hand: "for the platoon. 1.4."'
    });
    void vault;
    game.hud.say({
      speaker: 'NASSER 07',
      en: 'The one in the helmet is a copy. This is the original. And it has his name on it.',
      ar: 'اللي في الخوذة نسخة. دي الأصل. وعليها اسمه.',
      urgent: true
    });
  }, true);

  world.addTrigger('ch06_curator', { x: core.x, y: 1, z: core.z }, 6, () => {
    if (state.curatorMet) return;
    state.curatorMet = true;
    meetTheCurator(game, state, mission);
  }, true);

  buildAtmosphere(world);
  return { ground, core, state, mantrap, vault };
}

// --------------------------------------------------------------------------
// geometry
// --------------------------------------------------------------------------

function buildExterior(world) {
  // The ramp down to the bunker mouth, cut into the salt flat.
  world.addBox(0, -1.5, 20, 14, 3, 70, MAT.concrete(0x6a675f), { cover: true });
  world.addBox(0, 0.5, 20, 16, 1, 70, MAT.concrete(0x7d7a72), { solid: false });
  for (let i = 0; i < 14; i++) {
    world.addBox(0, -0.2 - i * 0.22, 52 - i * 2.4, 12, 0.24, 2.4, MAT.concrete(0x6a675f));
  }
  addBlastDoor(world, 0, 56.4, 0, 5.0);
  addSandstorm(world, 0, 70, 90);
  // vent shaft and service tunnel are visible landmarks, not routes yet
  world.addBox(-34, 1.2, 40, 3.2, 2.4, 3.2, MAT.metal(0x4a5058), { cover: true });
  world.addBox(34, 0.8, 44, 2.6, 1.6, 2.6, MAT.metal(0x4a5058), { cover: true });
}

function buildSecurityRing(world) {
  const z = CH06_LAYOUT.securityZ;
  addRingChamber(world, 0, z, 20, 5.0, 'security', [{ side: 'n', width: 4.6 }, { side: 's', width: 4.6 }]);
  addCorridor(world, { x: 0, z: 48, length: 96, axis: 'z', width: 4.6, height: 3.6 });
  // consoles
  addSecurityConsole(world, -8.2, z - 5, 0.3);
  addSecurityConsole(world, 8.2, z - 5, -0.3);
  // tripwires across the approach corridor
  for (const wz of [40, 30, 20]) {
    const w = addTripwire(world, 0, 1.15, wz, 4.0, 'x');
    // Stashed on the world because the chapter state object does not exist yet
    // when the geometry is built; buildMizanMission adopts the list.
    (world.tripwires ||= []).push({ ...w, broken: false });
  }
  // motion sensors
  for (const wz of [36, 26, 16]) {
    addMotionSensor(world, 0, 3.2, wz);
  }
}

function buildMantrapDoors(world) {
  const z = CH06_LAYOUT.mantrapZ;
  const outer = world.addBox(0, 1.9, z + 3, 4.4, 3.8, 0.4, MAT.metal(0x3c4248), { cover: true });
  const inner = world.addBox(0, 1.9, z - 3, 4.4, 3.8, 0.4, MAT.metal(0x3c4248), { cover: true });
  return { outer, inner, outerHome: z + 3, innerHome: z - 3 };
}

function buildRecordsRing(world) {
  const z = CH06_LAYOUT.recordsZ;
  addRingChamber(world, 0, z, 26, 5.6, 'records', [{ side: 'n', width: 4.6 }, { side: 's', width: 4.6 }]);
  addCorridor(world, { x: 0, z: -40, length: 22, axis: 'z' });
  // stacked shelving as cover: rows across the room with lanes between
  for (const lx of [-8, -3.4, 1.4, 6.2]) {
    addArchiveShelving(world, lx - 1.5, z - 6, 3, 2.6);
    addArchiveShelving(world, lx - 1.5, z, 3, 2.6);
    addArchiveShelving(world, lx - 1.5, z + 6, 3, 2.6);
  }
  addBlastDoor(world, 0, z - 13, 0, 4.0);
}

function buildRecordsGarrison(world, game) {
  const z = CH06_LAYOUT.recordsZ;
  // The heaviest fight in the campaign: a layered defence, not a mob.
  const posts = [
    { x: -9, z: z - 8, role: 'marksman' },
    { x: 9, z: z - 8, role: 'marksman' },
    { x: -4, z: z - 4, role: 'rifleman' },
    { x: 4, z: z - 4, role: 'rifleman' },
    { x: 0, z: z + 2, role: 'rifleman' },
    { x: -7, z: z + 5, role: 'rifleman' },
    { x: 7, z: z + 5, role: 'rifleman' },
    { x: 0, z: z - 11, role: 'officer' }
  ];
  for (const p of posts) {
    world.addEnemy({
      pos: { x: p.x, y: 0.05, z: p.z },
      yaw: Math.PI, era: 'modern',
      palette: PALETTE.nkGuard,
      weapon: 'enemy_modern',
      role: p.role, faction: 'mizan'
    });
  }
  void game;
}

function buildHabitatRing(world) {
  const z = CH06_LAYOUT.habitatZ;
  addRingChamber(world, 0, z, 20, 4.4, 'habitat', [{ side: 'n', width: 4.6 }, { side: 's', width: 4.6 }]);
  addCorridor(world, { x: 0, z: -72, length: 20, axis: 'z' });
  addCorridor(world, { x: 0, z: -102, length: 20, axis: 'z' });
  // habitation: bunks, a canteen counter, a schoolroom blackboard
  for (let lx = -7; lx <= 7; lx += 3.5) {
    world.addBox(lx, 0.45, z - 6, 2.2, 0.9, 1.0, MAT.metal(0x5a5f58), { cover: true });
    world.addBox(lx, 1.55, z - 6, 2.2, 0.1, 1.0, MAT.cloth(0x6a6458), { solid: false });
  }
  world.addBox(0, 0.55, z + 1, 12, 1.1, 1.2, MAT.wood(), { cover: true });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(4, 2),
    new THREE.MeshStandardMaterial({ color: 0x1e2a24, roughness: 0.95 }));
  board.position.set(0, 2.0, z + 9.4);
  board.rotation.y = Math.PI;
  world.addObject(board, { solid: false, tag: 'blackboard' });
}

function buildCoreRing(world) {
  const z = CH06_LAYOUT.coreZ;
  const core = addRingChamber(world, 0, z, 24, 6.0, 'core', [{ side: 'n', width: 4.6 }]);
  addCorridor(world, { x: 0, z: -104, length: 24, axis: 'z' });
  addCoreLighting(world, 0, z, 10);
  // the console the Curator sits at
  world.addBox(0, 0.55, z + 3, 6, 1.1, 1.4, MAT.metal(0x2f3438), { cover: true });
  for (let i = -2; i <= 2; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x0a1418, emissive: 0x3fb0c8, emissiveIntensity: 0.9 }));
    s.position.set(i * 1.15, 1.45, z + 2.35);
    s.rotation.x = -0.5;
    world.addObject(s, { solid: false, tag: 'console' });
  }
  return core;
}

function buildAtmosphere(world) {
  // Dust hanging in the strip light along the whole descent.
  const mat = new THREE.MeshBasicMaterial({
    color: 0xbcd4e8, transparent: true, opacity: 0.03, depthWrite: false, blending: THREE.AdditiveBlending
  });
  for (let z = 40; z >= -120; z -= 26) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), mat);
    g.rotation.x = -Math.PI / 2;
    g.position.set(0, 2.2, z);
    world.group.add(g);
  }
}

// --------------------------------------------------------------------------
// beats
// --------------------------------------------------------------------------

function meetTheCurator(game, state, mission) {
  mission.completeObjective(5, { notice: 'Met the Curator' });
  game.audio?.setTension?.(0.35);

  game.hud.say({
    speaker: 'THE CURATOR',
    en: 'Sit down, Lieutenant. You are the fourth Abdel-Hakim to come down that ramp, and the first one to be armed.',
    ar: 'اقعد يا ملازم. أنت رابع عبد الحكيم ينزل المنحدر ده، وأول واحد منهم يكون معاه سلاح.',
    time: 5200
  });
  state.after?.(5.6, () => game.hud.say({
    speaker: 'NASSER 07',
    en: 'You knew my grandfather.',
    ar: 'إنت كنت تعرف جدي.'
  }));
  state.after?.(8.4, () => game.hud.say({
    speaker: 'THE CURATOR',
    en: 'I was his radio operator. I took the messages he could not bring himself to destroy. Somebody had to keep the record honest.',
    ar: 'كنت مشغّل لاسلكيه. أنا اللي كنت بستلم الرسايل اللي ماقدرش يحرقها. لازم حد يحفظ السجل بأمانة.',
    time: 5600
  }));
  state.after?.(14.4, () => {
    game.hud.say({
      speaker: 'THE CURATOR',
      en: 'Shadow Protocol was never about weapons. It was always about who gets to write the record. Taher understood that. That is why he paid.',
      ar: 'بروتوكول الظل مكنش عمره عن السلاح. كان دايماً عن مين اللي بيكتب السجل. طاهر فهم ده. عشان كده دفع.',
      time: 6200
    });
    mission.addIntel({
      id: 'shadow_directive',
      title: 'Standing directive — SHADOW PROTOCOL',
      era: 'modern',
      body: 'Shadow Protocol is a records programme, not an arms programme. For sixty years its purpose has been to control which version of Egyptian military history survives. Taher paid into it to keep his platoon alive.'
    });
  });

  // Zidan arrives while the player is still standing there.
  state.after?.(22, () => zidanArrives(game, state, mission));
}

function zidanArrives(game, state, mission) {
  game.hud.feed('GEN. ZIDAN — ON SITE', 'alert');
  game.hud.say({
    speaker: 'GEN. ZIDAN',
    en: 'Put the page down, Nasser. You are standing in a room that has outlived every government that funded it.',
    ar: 'حط الورقة يا ناصر. إنت واقف في أوضة عاشت أطول من كل حكومة موّلتها.',
    time: 5000
  });
  state.after?.(4.5, () => askAboutZidan(game, state, mission));
}

function askAboutZidan(game, state, mission) {
  if (state.zidanDone) return;
  state.zidanDone = true;

  const options = [
    {
      id: 'expose',
      text: 'Expose it. Publish the record and let the country decide.',
      textAr: 'فضحها. انشر السجل وخلّي البلد تقرر.',
      apply: () => {
        setFlag(game, CH06_FLAGS.ZIDAN_STATE, 'exposed');
        game.hud.say({
          speaker: 'GEN. ZIDAN',
          en: 'You will burn the service to save your conscience. I hope your conscience can run an intelligence directorate.',
          ar: 'هتحرق الجهاز عشان ضميرك. أتمنى ضميرك يعرف يدير مخابرات.'
        });
      }
    },
    {
      id: 'arrest',
      text: 'Arrest him. Let a court read the page.',
      textAr: 'اعتقل. خلّي محكمة تقرا الورقة.',
      apply: () => {
        setFlag(game, CH06_FLAGS.ZIDAN_STATE, 'arrested');
        game.hud.say({
          speaker: 'GEN. ZIDAN',
          en: 'A court. In this country. You are a better optimist than your grandfather was.',
          ar: 'محكمة. في البلد دي. إنت متفائل أكتر من جدك.'
        });
      }
    },
    {
      id: 'kill',
      text: 'He signed too. Finish it.',
      textAr: 'هو كمان وقّع. خلّص الموضوع.',
      apply: () => {
        setFlag(game, CH06_FLAGS.ZIDAN_STATE, 'dead');
        game.hud.say({
          speaker: 'HODA "JACKAL" MANSOUR',
          en: 'Nasser. That is the third man you have shot in a bunker this week. At some point it stops being justice.',
          ar: 'ناصر. ده تالت راجل تضربه في مخبأ الأسبوع ده. في نقطة بقى مش عدالة.',
          radio: true,
          urgent: true
        });
      }
    }
  ];

  if (game.hud?.showChoice) {
    game.hud.showChoice({
      prompt: 'ZIDAN IS STANDING IN THE CORE. WHAT DO YOU DO?',
      promptAr: 'زيدان واقف في القلب. تعمل إيه؟',
      options
    });
  } else {
    options[0].apply();
  }
  mission.completeObjective(7, { notice: 'Zidan dealt with' });
}

function flag(game, name, value = true) {
  game.save?.setProgress?.((p) => {
    p.flags = p.flags || {};
    p.flags[name] = value;
  });
}
function setFlag(game, name, value = true) { flag(game, name, value); }

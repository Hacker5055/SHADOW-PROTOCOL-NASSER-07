/**
 * SHADOW PROTOCOL — CHAPTER 05: BETRAYAL
 * Present day · Vienna safehouse → Danube freight yard · Nasser 07
 *
 * The chapter that costs the team something. Structurally different from 01-04:
 * it opens in a quiet room, breaks it with a ninety-second ambush, and then puts
 * the player in front of three objectives that cannot all be reached in time.
 *
 * 5.1 THE SAFEHOUSE  — downtime. Tea, a phone call home, the squad talking.
 * 5.2 THE AMBUSH     — 90 s of non-scripted survival. GLASS does not make it.
 * 5.3 THREE RUNS     — freight yard (intel) / metro (FANG) / MOUSE, on a timer.
 * 5.4 THE QUESTION   — what to do about MOUSE's link to the leak.
 *
 * The timed structure is the point: the clock is the antagonist, not the enemy
 * count. Whatever the player does not reach is lost, and the chapter says so.
 */
import * as THREE from 'three';
import { PALETTE } from '../game/models.js';
import { MAT } from '../engine/materials.js';
import {
  buildYardTerrain, addContainerStack, addGantryCrane, addFloodlightMast,
  addRailSpur, addShed, addSafehouse, addPickup, addUtilityPole
} from './libDanube.js';

export const CHAPTER_05_MISSION = {
  id: 'ch05_betrayal',
  chapterIndex: 5,
  code: 'VIENNA / DANUBE YARD',
  title: 'Betrayal',
  cardEra: 'VIENNA · SAFEHOUSE · 01:10',
  cardNum: 'CHAPTER 05',
  subtitle: 'Safehouse, then the yard<br>Somebody gave them this address',
  synopsis: 'The team has ninety seconds and one door. After that, three people need saving at once and the clock does not care which one you choose.',
  era: 'modern',
  loadout: ['pistol', 'mp5sd', 'm4'],
  start: { x: 0, y: 1.2, z: 62 },
  startYaw: Math.PI,
  surface: 'concrete',
  hasSquad: true,
  nvg: true,
  intelTotal: 4,
  darknessAt: 0,
  objectives: [
    { id: 'o_safehouse', text: 'Take the tea. Everyone gets one minute.', marker: { x: 0, y: 1, z: 62 } },
    { id: 'o_ambush', text: 'Survive the ambush' },
    { id: 'o_intel', text: 'Recover the intel from the maintenance shed', marker: { x: -34, y: 1, z: -18 }, type: 'optional' },
    { id: 'o_fang', text: 'Reach FANG at the metro steps', marker: { x: 30, y: 1, z: -30 }, type: 'optional' },
    { id: 'o_mouse', text: 'Reach MOUSE before the network does', marker: { x: 0, y: 1, z: -52 }, type: 'optional' },
    { id: 'o_mouse_choice', text: 'Decide what to do about MOUSE' }
  ]
};

/** Campaign flags written by this chapter. */
export const CH05_FLAGS = {
  TRUST_ADEL: 'TRUST_ADEL',
  ADEL_ARRESTED: 'ADEL_ARRESTED',
  ADEL_RELEASED: 'ADEL_RELEASED',
  GLASS_DEAD: 'GLASS_DEAD',
  SAVED_INTEL: 'SAVED_INTEL',
  SAVED_FANG: 'SAVED_FANG'
};

export const CH05_LAYOUT = {
  safehouseZ: 62,
  yardX: -30,
  shedX: -34,
  shedZ: -18,
  metroX: 30,
  metroZ: -30,
  mouseX: 0,
  mouseZ: -52,
  /** Seconds the player gets for all three recoveries. */
  recoveryWindow: 150,
  /** Seconds the ambush lasts. */
  ambushSeconds: 90
};

export function buildBetrayalMission(game, world) {
  const { ground } = buildYardTerrain(world);
  buildSafehouseBlock(world);
  buildYard(world);
  const shed = addShed(world, CH05_LAYOUT.shedX, CH05_LAYOUT.shedZ, 10, 7, 4.2);
  buildMetroSteps(world);
  buildApproaches(world);

  // ------------------------------------------------------------------ squad
  world.friendSpawns.length = 0;
  for (const member of [
    { callsign: 'FANG', nameEn: 'Lt. Karim El-Sayed', nameAr: 'كريم السيد', role: 'marksman', slot: 0, pos: { x: -2.2, y: 0.05, z: 58 } },
    { callsign: 'GLASS', nameEn: 'Sgt. Karim "Glass" Zayed', nameAr: 'كريم زايد', role: 'breacher', slot: 1, pos: { x: 2.2, y: 0.05, z: 58 } },
    { callsign: 'MOUSE', nameEn: 'Sgt. Adel Farhan', nameAr: 'عادل فرحان', role: 'comms', slot: 2, pos: { x: 0, y: 0.05, z: 56 }, radio: true }
  ]) {
    world.addFriend({ ...member, era: 'modern', palette: PALETTE.egyptModern, weapon: 'enemy_modern' });
  }

  // ------------------------------------------------------------------ state
  const mission = game.mission;
  const state = {
    after: null,   // game-time scheduler, wired below
    tea: false,
    ambushFired: false,
    ambushOver: false,
    glassDown: false,
    timerOn: false,
    timeLeft: CH05_LAYOUT.recoveryWindow,
    intelRecovered: false,
    fangReached: false,
    mouseReached: false,
    mouseDecided: false,
    lost: []
  };

  // Resolved lazily, not here: the level builder runs before ai.spawnSquad(),
  // so game.ai.squad is still empty at construction time. Looking up the cast
  // eagerly returned three undefineds and the scripted death silently no-oped.
  const cast = () => ({
    glass: game.ai.squad.find((s) => s.callsign === 'GLASS'),
    mouse: game.ai.squad.find((s) => s.callsign === 'MOUSE'),
    fang: game.ai.squad.find((s) => s.callsign === 'FANG')
  });

  // Game-time scheduling. Everything story-critical runs off accumulated sim
  // time, never wall-clock: a setTimeout keeps ticking while the game is
  // paused, ignores the timescale, and in the headless harness is clamped to
  // 4 ms, which would run the whole ambush in a single frame.
  const queue = [];
  const after = (seconds, fn) => queue.push({ at: (game.time || 0) + seconds, fn });
  state.after = after;
  world.addAnimated((dt) => {
    void dt;
    if (!queue.length) return;
    const now = game.time || 0;
    for (let i = queue.length - 1; i >= 0; i--) {
      if (now >= queue[i].at) {
        const { fn } = queue.splice(i, 1)[0];
        fn();
      }
    }
  });

  // ------------------------------------------------------------------ 5.1
  world.addTrigger('ch05_safehouse', { x: 0, y: 1, z: CH05_LAYOUT.safehouseZ }, 6, () => {
    if (state.tea) return;
    state.tea = true;
    mission.completeObjective(0, { notice: 'One minute of quiet' });

    // Chapter 04's decision has to be audible here or the branch is decoration.
    const f = game.save?.progress?.flags || {};
    if (f.KONSUL_ALIVE) {
      after(0.4, () => game.hud.say({
        speaker: 'ADEL "MOUSE" FARHAN',
        en: 'KONSUL is in the room downstairs. He has asked for a chair and a window twice.',
        ar: 'كونسول في الأوضة تحت. طلب كرسي ونافذة مرتين.',
        radio: false
      }));
      mission.addIntel({
        id: 'ch05_konsul_debrief',
        title: 'Debrief — KONSUL in custody',
        era: 'modern',
        body: 'He talks in dates, not names. 1973, then 1979, then a gap of twenty years he refuses to account for. He says the ledger was never about money.'
      });
    } else if (f.KONSUL_DEAD) {
      after(0.4, () => game.hud.say({
        speaker: 'HODA "JACKAL" MANSOUR',
        en: 'We buried him in a hotel stairwell and the manifest went with him. I hope you are sure.',
        ar: 'دفناه في سلم فندق والمانيفست راح معاه. أتمنى تكون متأكد.',
        radio: false
      }));
    }
    // Real downtime: jokes, tea, a phone call home. The beat the chapter earns.
    game.hud.say({ speaker: 'KARIM "GLASS" ZAYED', en: 'Four sugars. I am not ashamed of it.', ar: 'أربع ملاعق سكر. ومش خجلان من ده.' });
    after(2.6, () => game.hud.say({ speaker: 'HODA "JACKAL" MANSOUR', en: 'You are drinking tea in a room with three rifles on the table and you are worried about sugar.', ar: 'بتشرب شاي في أوضة فيها تلات بنادق على الترابيزة وقلقان على السكر.' }));
    after(5.4, () => game.hud.say({ speaker: 'ADEL "MOUSE" FARHAN', en: 'My sister had a boy. She sent a photo. I have been looking at it for six hours.', ar: 'أختي خلفت ولد. بعتت صورة. بقالي ست ساعات ببص عليها.' }));
    after(8.2, () => game.hud.say({ speaker: 'NASSER 07', en: 'We go home after this one. All of us.', ar: 'هنروح بعد المهمة دي. كلنا.' }));
    // ...and then it ends.
    after(11, () => fireAmbush(game, world, state, mission, { ...cast(), after }));
  }, true);

  // ------------------------------------------------------------------ 5.3 recovery triggers
  const recoveryArmed = () => state.ambushFired && state.timerOn && state.timeLeft > 0;

  world.addTrigger('ch05_intel', { x: CH05_LAYOUT.shedX, y: 1, z: CH05_LAYOUT.shedZ + 3 }, 3.6, () => {
    if (!recoveryArmed() || state.intelRecovered) return;
    state.intelRecovered = true;
    setFlag(game, CH05_FLAGS.SAVED_INTEL);
    mission.completeObjective(2, { notice: 'Intel recovered from the shed' });
    mission.addIntel({
      id: 'ch05_yard_manifest',
      title: 'Freight manifest — Danube yard',
      era: 'modern',
      body: 'The crates were booked to Facility Mizan, Western Desert, consigned to a name that has been dead since 1997. The network is not buying weapons. It is moving paper.'
    });
    game.hud.say({ speaker: 'KARIM "GLASS" ZAYED', en: 'Got it. Go. Go, go.', ar: 'خدته. امشي. امشي، امشي.', radio: true, urgent: true });
  }, true);

  world.addTrigger('ch05_fang', { x: CH05_LAYOUT.metroX, y: 1, z: CH05_LAYOUT.metroZ }, 4.2, () => {
    if (!recoveryArmed() || state.fangReached) return;
    state.fangReached = true;
    setFlag(game, CH05_FLAGS.SAVED_FANG);
    const f = cast().fang;
    if (f) { f.down = false; f.dead = false; f.health = Math.max(35, f.health); }
    mission.completeObjective(3, { notice: 'FANG pulled out of the metro' });
    // Whichever two you reach, the third is the one you hear about.
    game.hud.say({ speaker: 'FANG', en: 'You came down here for me. You should not have. He is still out there.', ar: 'نزلت هنا عشاني. مكانش لازم. هو لسه بره.', urgent: true });
  }, true);

  world.addTrigger('ch05_mouse', { x: CH05_LAYOUT.mouseX, y: 1, z: CH05_LAYOUT.mouseZ }, 4.2, () => {
    if (!recoveryArmed() || state.mouseReached) return;
    state.mouseReached = true;
    mission.completeObjective(4, { notice: 'Reached MOUSE' });
    const m = cast().mouse;
    if (m) { m.down = false; m.dead = false; m.health = Math.max(30, m.health); }
    game.hud.say({ speaker: 'ADEL "MOUSE" FARHAN', en: 'They had our address, Nasser. They had the flat. I never sent the flat.', ar: 'كان معاهم عنواننا يا ناصر. كان معاهم الشقة. أنا عمري ما بعت الشقة.', urgent: true });
    // The trust question is the chapter's decision and it follows immediately.
    after(1.6, () => askAboutMouse(game, state, mission));
  }, true);

  // ------------------------------------------------------------------ timer
  world.addAnimated((dt) => {
    if (!state.timerOn || state.timeLeft <= 0) return;
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    game.hud.setObjectiveTimer?.(state.timeLeft, 'EXTRACTION IN');
    if (state.timeLeft <= 0) closeWindow(game, state, mission);
  });

  // Safety net: if the player is downed during the ambush, the chapter does not
  // softlock — GLASS's death is scripted, the player's is not.
  world.addAnimated(() => {
    if (state.ambushFired && !state.ambushOver && game.player.health <= 0) {
      state.ambushOver = true;
      state.timerOn = true;
    }
  });

  buildAtmosphere(world);
  return { ground, shed, state, cast };
}

// --------------------------------------------------------------------------
// geometry
// --------------------------------------------------------------------------

function buildSafehouseBlock(world) {
  const z = CH05_LAYOUT.safehouseZ;
  // A three-storey block with the flat on the top floor; the chapter opens here.
  world.addBox(0, 1.5, z, 22, 3, 16, MAT.concrete(0x6a6055), { cover: true });
  world.addBox(0, 4.5, z, 22, 3, 16, MAT.concrete(0x6f6459), { cover: true });
  const flat = addSafehouse(world, 0, z, 6.0);
  // stair access down to the yard
  for (let i = 0; i < 12; i++) {
    world.addBox(-13.5, 6.0 - i * 0.5, z - 4 + i * 0.55, 3.0, 0.5, 0.55, MAT.concrete(0x7a7367));
  }
  // street outside
  world.addBox(0, 0.02, z + 9, 60, 0.04, 6, MAT.asphalt(), { solid: false });
  return flat;
}

function buildYard(world) {
  const L = CH05_LAYOUT;
  addRailSpur(world, -6, -140, 120);
  addRailSpur(world, -14, -140, 120);
  addRailSpur(world, 10, -140, 120);

  addGantryCrane(world, L.yardX, -6, 30, 16);
  addGantryCrane(world, L.yardX + 46, -6, 30, 16);

  // container rows: the yard's cover and its silhouette
  let seed = 0;
  for (const z of [-34, -26, -18, 6, 14, 22]) {
    for (const x of [-56, -44, -18, 18, 40, 56]) {
      addContainerStack(world, x, z, { rows: 2 + (seed % 2), high: 1 + (seed % 3), seed });
      seed += 1;
    }
  }

  for (const p of [[-60, 30], [-20, 30], [20, 30], [60, 30], [-60, -40], [20, -44], [56, -40]]) {
    addFloodlightMast(world, p[0], p[1]);
  }
  for (let x = -80; x <= 80; x += 40) addUtilityPole(world, x, -46);
}

function buildMetroSteps(world) {
  const x = CH05_LAYOUT.metroX, z = CH05_LAYOUT.metroZ;
  // sunk stairwell, same language as chapter 04's but narrower
  const pit = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3.0, 5.2),
    new THREE.MeshStandardMaterial({ color: 0x0a0d10, roughness: 1 }));
  pit.position.set(x, -1.5, z);
  world.group.add(pit);
  for (let i = 0; i < 9; i++) {
    world.addBox(x, -0.14 - i * 0.3, z + 2.2 - i * 0.5, 4.2, 0.3, 0.5, MAT.concrete(0x55524c));
  }
  world.addBox(x, 0.5, z + 3.0, 5.2, 1.0, 0.35, MAT.concrete(0x6f6a62), { cover: true });
  const lamp = new THREE.PointLight(0xbcd8ff, 2.2, 12);
  lamp.position.set(x, 0.8, z + 2.4);
  world.group.add(lamp);
}

function buildApproaches(world) {
  // The safehouse to the yard is one straight run down the middle; the flanks
  // are longer but better covered. The timer makes that choice matter.
  for (let z = 44; z >= -40; z -= 16) {
    world.addBox(-6, 0.8, z, 1.2, 1.6, 3.4, MAT.concrete(0x5f5a52), { cover: true });
    world.addBox(6, 0.8, z + 8, 1.2, 1.6, 3.4, MAT.concrete(0x5f5a52), { cover: true });
  }
}

function buildAtmosphere(world) {
  // Cold haze pooled under the floodlights.
  const mat = new THREE.MeshBasicMaterial({
    color: 0xa8c4e0, transparent: true, opacity: 0.045, depthWrite: false, blending: THREE.AdditiveBlending
  });
  for (let z = 24; z >= -44; z -= 22) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), mat);
    g.rotation.x = -Math.PI / 2;
    g.position.set(0, 0.5, z);
    world.group.add(g);
  }
  // The intel pickup inside the shed is the only warm light in the yard.
  addPickup(world, CH05_LAYOUT.shedX, 1.1, CH05_LAYOUT.shedZ + 3.2, 0x66d9a0, 0.2);
}

// --------------------------------------------------------------------------
// beats
// --------------------------------------------------------------------------

function fireAmbush(game, world, state, mission, cast) {
  if (state.ambushFired) return;
  state.ambushFired = true;
  mission.completeObjective(0, { silent: true });

  game.hud.feed('CONTACT — MULTIPLE, CLOSE', 'alert');
  game.hud.say({
    speaker: 'KARIM "GLASS" ZAYED',
    en: 'They came through the stairwell — how did they know the stairwell?',
    ar: 'دخلوا من السلم — إزاي عرفوا السلم؟',
    urgent: true
  });
  game.audio?.setTension?.(0.9);

  // Spawn the assault: surrounding the safehouse block, closing in.
  const z = CH05_LAYOUT.safehouseZ;
  const spawns = [
    { x: -18, z: z + 4 }, { x: -12, z: z + 10 }, { x: 12, z: z + 10 }, { x: 18, z: z + 4 },
    { x: 0, z: z + 14 }, { x: -16, z: z - 6 }, { x: 16, z: z - 6 }, { x: 0, z: z - 10 }
  ];
  for (const s of spawns) {
    world.addEnemy({
      pos: { x: s.x, y: 0.05, z: s.z },
      yaw: Math.atan2(-s.x, Math.sign(z - s.z) || 1),
      era: 'modern',
      palette: PALETTE.traitorCell,
      weapon: 'enemy_modern',
      role: 'rifleman',
      faction: 'network'
    });
  }
  // They are spawned through the live director so they exist immediately.
  const fresh = world.enemySpawns.slice(-spawns.length);
  world.enemySpawns.length -= spawns.length;
  game.ai.spawnEnemies(fresh);
  for (const e of game.ai.enemies) {
    if (e.faction === 'network') { e.alerted = true; e.awareness = 1; }
  }

  // GLASS does not survive this. It is the one scripted death in the campaign,
  // and it lands in the middle of a firefight rather than in a cutscene.
  cast.after(9, () => {
    if (state.glassDown || !cast.glass) return;
    state.glassDown = true;
    cast.glass.down = true;
    cast.glass.health = 0;
    setFlag(game, CH05_FLAGS.GLASS_DEAD);
    game.hud.feed('GLASS IS DOWN', 'squad');
    game.hud.say({
      speaker: 'KARIM "GLASS" ZAYED',
      en: 'Nasser. Nasser, the flat — only four people knew the flat.',
      ar: 'ناصر. ناصر، الشقة — أربعة بس اللي كانوا عارفين الشقة.',
      urgent: true,
      time: 4200
    });
  });

  // Ninety seconds, then the team scatters and the clock starts.
  cast.after(CH05_LAYOUT.ambushSeconds, () => endAmbush(game, state, mission, cast));
}

function endAmbush(game, state, mission, cast) {
  if (state.ambushOver) return;
  state.ambushOver = true;
  state.timerOn = true;
  if (cast.glass) { cast.glass.down = true; cast.glass.dead = true; }
  mission.completeObjective(1, { notice: 'Survived the ambush' });
  game.hud.feed('GLASS KIA — the team is scattered', 'squad');
  game.hud.say({
    speaker: 'HODA "JACKAL" MANSOUR',
    en: 'We are split. FANG is in the metro, MOUSE is at the north gate, the intel is in the shed. Pick.',
    ar: 'احنا متفرقين. فانج في المترو، ماوس عند البوابة الشمالية، والملفات في الورشة. اختار.',
    radio: true,
    urgent: true
  });
  game.hud.setObjectiveTimer?.(state.timeLeft, 'EXTRACTION IN');
  game.audio?.setTension?.(0.75);
}

function closeWindow(game, state, mission) {
  if (!state.timerOn) return;
  state.timerOn = false;
  game.hud.setObjectiveTimer?.(null);

  // Whatever was not reached is lost — and named.
  const missed = [];
  if (!state.intelRecovered) missed.push('the intel');
  if (!state.fangReached) missed.push('FANG');
  if (!state.mouseReached) missed.push('MOUSE');
  // Recorded on the chapter state as well as spoken, so the debrief and the
  // campaign's casualty count can see who was actually left behind.
  state.lost = missed.slice();

  if (missed.length) {
    game.hud.feed(`EXTRACTION — LEFT BEHIND: ${missed.join(', ').toUpperCase()}`, 'alert');
    game.hud.say({
      speaker: 'HODA "JACKAL" MANSOUR',
      en: missed.length === 3
        ? 'We are leaving with nothing. Do you understand what that means?'
        : `We left ${missed.join(' and ')} out there. That is on you, and it is on me.`,
      ar: missed.length === 3
        ? 'هنمشي بإيدينا فاضية. فاهم ده يعني إيه؟'
        : `سيبنا ${missed.join(' و')} بره. ده عليّا وعليك.`,
      radio: true,
      urgent: true
    });
  } else {
    game.hud.feed('EXTRACTION — EVERYONE ACCOUNTED FOR', 'intel');
  }

  // Anyone genuinely unreached is written out of the campaign.
  if (!state.mouseReached) {
    // MOUSE's fate is decided by the network, not the player. The choice in
    // 5.4 becomes about his memory rather than his freedom.
    state.after?.(2.2, () => askAboutMouse(game, state, mission));
  }
  if (!state.fangReached) {
    setFlag(game, CH05_FLAGS.SAVED_FANG, false);
  }
  game.audio?.setTension?.(0.3);
}

function askAboutMouse(game, state, mission) {
  if (state.mouseDecided) return;
  state.mouseDecided = true;

  const options = [
    {
      id: 'trust',
      text: 'Trust him. He did not give them the flat.',
      textAr: 'ثق فيه. هو ماسلّمهمش الشقة.',
      apply: () => {
        setFlag(game, CH05_FLAGS.TRUST_ADEL);
        game.hud.say({
          speaker: 'NASSER 07',
          en: 'Four people knew that flat. Three of them are standing here. Find me the fourth.',
          ar: 'أربعة عرفوا الشقة دي. تلاتة منهم واقفين هنا. جيبلي الرابع.'
        });
      }
    },
    {
      id: 'arrest',
      text: 'Arrest him. Let the service sort it out.',
      textAr: 'اعتقل. خلّي الجهاز هو اللي يحقق.',
      apply: () => {
        setFlag(game, CH05_FLAGS.ADEL_ARRESTED);
        if (state.mouseReached) setFlag(game, CH05_FLAGS.TRUST_ADEL, false);
        game.hud.say({
          speaker: 'ADEL "MOUSE" FARHAN',
          en: 'You are putting cuffs on me in a freight yard at four in the morning. Do it properly, at least.',
          ar: 'بتكلبشني في حوش سكك حديد الساعة أربعة الصبح. اعملها بأصولها على الأقل.'
        });
      }
    },
    {
      id: 'release',
      text: 'Let him go. He is not the leak.',
      textAr: 'سيبه يمشي. هو مش المصدر.',
      apply: () => {
        setFlag(game, CH05_FLAGS.ADEL_RELEASED);
        game.hud.say({
          speaker: 'ADEL "MOUSE" FARHAN',
          en: 'I will find out who it was. Not for the service. For Glass.',
          ar: 'هعرف مين كان. مش للجهاز. عشان جلاس.'
        });
      }
    }
  ];

  if (game.hud?.showChoice) {
    game.hud.showChoice({
      prompt: 'MOUSE KNEW THE ADDRESS. WHAT DO YOU DO?',
      promptAr: 'ماوس كان عارف العنوان. تعمل إيه؟',
      options
    });
  } else {
    options[0].apply();
  }
  mission.completeObjective(5, { notice: 'Decided what to do about MOUSE' });
}

function setFlag(game, name, value = true) {
  game.save?.setProgress?.((p) => {
    p.flags = p.flags || {};
    p.flags[name] = value;
  });
}

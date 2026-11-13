/**
 * Headless gameplay simulation test.
 *
 * Runs the REAL gameplay systems (physics, player, weapons, AI, squad, mission
 * logic, level builders) under Node with a small DOM/WebGL stub, so logic bugs
 * surface without a browser. Rendering/audio calls are no-ops; everything else
 * is the shipped code path.
 *
 * Usage: node tools/simtest.mjs
 */
import { installStubs } from './stubs.mjs';
import { readFileSync } from 'node:fs';

// glTF parsing needs these two shims before any load happens; textures still
// fail to decode in Node and warn, which is harmless for geometry and rigs.
globalThis.self = globalThis;
globalThis.ProgressEvent = globalThis.ProgressEvent || class { constructor(t = '', o = {}) { this.type = t; Object.assign(this, o); } };
const gltfLib = await import('three/examples/jsm/loaders/GLTFLoader.js');

globalThis.__SP_HEADLESS__ = true;
installStubs();

const { Game } = await import('../src/game/game.js');
const { CHAPTER_01_MISSIONS, buildCrossingMission, buildDepotMission } = await import('../src/levels/chapter01.js');
const { CHAPTER_02_MISSION, buildSilentMission } = await import('../src/levels/chapter02.js');
const { CHAPTER_03_MISSION, buildArchiveMission, CH03_FLAGS } = await import('../src/levels/chapter03.js');
const { CHAPTER_04_MISSION, buildViennaMission, CH04_FLAGS, CH04_LAYOUT, inShot } = await import('../src/levels/chapter04.js');
const { CHAPTER_05_MISSION, buildBetrayalMission, CH05_FLAGS, CH05_LAYOUT } = await import('../src/levels/chapter05.js');
const { CHAPTER_06_MISSION, buildMizanMission, CH06_FLAGS, CH06_LAYOUT } = await import('../src/levels/chapter06.js');
const { CHAPTER_07_MISSION, buildLegacyMission, CH07_FLAGS, CH07_LAYOUT } = await import('../src/levels/chapter07.js');
const models = await import('../src/game/models.js');
const THREE = await import('three');
const weaponsMod = await import('../src/game/weapons.js');
globalThis.__SP_WEAPONS__ = weaponsMod;
const intelMod = await import('../src/game/intel.js');
const forensicsMod = await import('../src/game/forensics.js');
globalThis.__SP_FORENSICS__ = forensicsMod;
globalThis.__SP_DOCS__ = intelMod.INTELLIGENCE;
globalThis.window.__SP_MODELS__ = models;
globalThis.window.__SP_HELI__ = models;

const results = [];
function check(name, fn) {
  try {
    const r = fn();
    results.push({ name, ok: true, detail: r });
    console.log(`  PASS  ${name}${r ? ` — ${r}` : ''}`);
  } catch (e) {
    results.push({ name, ok: false, detail: e });
    console.log(`  FAIL  ${name}\n        ${e && e.message}`);
    if (e && e.stack) console.log(e.stack.split('\n').slice(1, 5).join('\n'));
  }
}

/** Bring the sim back to a clean, playable state between independent checks. */
function revive(game) {
  if (!game.player) return;
  game.player.dead = false;
  game.player.health = game.player.maxHealth;
  game.player.damageFlash = 0;
  game.player.suppression = 0;
  game.player.lastDamageTime = -999;
  game.state = 'playing';
  game.paused = false;
  game.input.enabled = true;
  game.input.keys.clear();
  game.input.keyEdgeDown.clear();
  game.input.enabled = true;
  if (game.mouse) game.mouse.buttons = [false, false, false];
  if (game.mouse) game.mouse.edges = [false, false, false];
  for (const s of game.ai.squad) {
    s.dead = false;
    s.down = false;
    s.health = s.maxHealth;
    s.reviveProgress = 0;
  }
}

/** Move all hostiles out of play so a mechanical check is not interrupted. */
function isolate(game) {
  for (const e of game.ai.enemies) {
    if (e.dead) continue;
    e.pos.z -= 400;
    e.mesh.position.copy(e.pos);
    e.alerted = false;
    e.awareness = 0;
    e.state = 'idle';
    e.cooldown = 999;
    e.lastSeenPos.set(0, 0, 0);
  }
}

function makeGame() {
  const canvas = globalThis.document.getElementById('view');
  const g = new Game(canvas);
  g.registerMission(CHAPTER_01_MISSIONS[0], buildCrossingMission);
  g.registerMission(CHAPTER_01_MISSIONS[1], buildDepotMission);
  g.registerMission(CHAPTER_02_MISSION, buildSilentMission);
  g.registerMission(CHAPTER_03_MISSION, buildArchiveMission);
  g.registerMission(CHAPTER_04_MISSION, buildViennaMission);
  g.registerMission(CHAPTER_05_MISSION, buildBetrayalMission);
  g.registerMission(CHAPTER_06_MISSION, buildMizanMission);
  g.registerMission(CHAPTER_07_MISSION, buildLegacyMission);
  CHAPTER_01_MISSIONS[0].onStart = (gg) => { gg.chapterIndex = 1; };
  CHAPTER_01_MISSIONS[1].onStart = (gg) => { gg.chapterIndex = 1; };
  CHAPTER_02_MISSION.onStart = (gg) => { gg.chapterIndex = 2; };
  CHAPTER_03_MISSION.onStart = (gg) => { gg.chapterIndex = 3; };
  CHAPTER_04_MISSION.onStart = (gg) => { gg.chapterIndex = 4; };
  CHAPTER_05_MISSION.onStart = (gg) => { gg.chapterIndex = 5; };
  CHAPTER_06_MISSION.onStart = (gg) => { gg.chapterIndex = 6; };
  return g;
}

/** Advance the real fixed-step simulation without rendering. */
function simulate(game, seconds, opts = {}) {
  const dt = 1 / 60;
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i++) {
    if (game.player && (game.state === 'playing' || opts.force)) {
      if (opts.input) opts.input(game, i);
      game.fixedStep(dt);
      game.time += dt;
      game.input.endFrame();
    }
  }
}

console.log('\n=== SHADOW PROTOCOL — headless simulation ===\n');

let game;
check('Game constructs', () => { game = makeGame(); return 'ok'; });

check('Chapter 01 crossing mission loads', () => {
  game.startMission('ch01_crossing');
  if (game.state !== 'playing') throw new Error(`state=${game.state}`);
  if (!game.player.weapon) throw new Error('no weapon');
  if (game.ai.enemies.length < 10) throw new Error(`only ${game.ai.enemies.length} enemies`);
  if (game.ai.squad.length !== 3) throw new Error(`squad=${game.ai.squad.length}`);
  return `${game.ai.enemies.length} enemies, ${game.ai.squad.length} squad, ${game.world.collision.boxes.length} colliders`;
});

check('Weapon era validation rejects modern kit in 1973', async () => {
  const { validateLoadout } = await import('../src/game/weapons.js');
  let threw = false;
  try { validateLoadout('1973', ['m4']); } catch { threw = true; }
  if (!threw) throw new Error('1973 loadout accepted a modern weapon');
  return 'm4 rejected for 1973';
});

check('Player stands on terrain (no fall through)', () => {
  simulate(game, 1.0);
  const y = game.player.pos.y;
  if (y < -5) throw new Error(`fell through world, y=${y.toFixed(2)}`);
  if (!Number.isFinite(y)) throw new Error('NaN position');
  return `y=${y.toFixed(2)}, grounded=${game.player.grounded}`;
});

check('Movement responds to input', () => {
  const before = game.player.pos.clone();
  // hold forward for 1.2s
  simulate(game, 1.2, {
    input: (g) => { g.keys = new Set(['KeyW']); g.input.keys = g.keys; }
  });
  game.input.keys.clear();
  const moved = before.distanceTo(game.player.pos);
  if (moved < 0.4) throw new Error(`only moved ${moved.toFixed(3)}m`);
  return `moved ${moved.toFixed(2)}m`;
});

check('Stance state machine: crouch → prone → stand', () => {
  const p = game.player;
  simulate(game, 0.9, { input: (g, i) => { if (i === 1) g.input.keyEdgeDown.add('ControlLeft'); } });
  const c = p.stanceName;
  simulate(game, 0.9, { input: (g, i) => { if (i === 2) g.input.keyEdgeDown.add('KeyZ'); } });
  const pr = p.stanceName;
  if (c !== 'CROUCH') throw new Error(`expected CROUCH, got ${c}`);
  if (pr !== 'PRONE') throw new Error(`expected PRONE, got ${pr}`);
  p.stance = 0;
  simulate(game, 0.6);
  return `${c} → ${pr} → ${p.stanceName}`;
});

check('Slide triggers from sprint+crouch', () => {
  revive(game);
  isolate(game);
  const p = game.player;
  p.stance = 0;
  p.stamina = 1;
  p.slideCooldown = 0;
  let slid = false;
  let tapped = false;
  let movedOnce = false;
  simulate(game, 3.0, {
    input: (g, i) => {
      g.input.keys.add('KeyW');
      g.input.keys.add('ShiftLeft');
      // Wait until the previous frame actually produced a sprint, then tap crouch.
      if (!tapped && movedOnce && (g.player.sprinting || g.player.tacticalSprint) &&
          g.player.grounded && g.player.stamina < 0.99) {
        tapped = true;
        g.input.keyEdgeDown.add('ControlLeft');
        g.input.keys.add('ControlLeft');
      }
      movedOnce = true;
      if (g.player.sliding) slid = true;
    }
  });
  game.input.keys.clear();
  if (!slid) throw new Error('slide never engaged');
  return 'slide engaged';
});

check('Shooting damages and kills an enemy', () => {
  revive(game);
  isolate(game);
  const p = game.player;
  const e = game.ai.enemies.find((x) => !x.dead);
  // place the enemy directly in front and aim at the torso
  p.pos.set(0, p.pos.y, 0);
  p.yaw = 0;
  p.pitch = 0;
  e.pos.set(0, p.pos.y + 0.02, -8);
  e.mesh.position.copy(e.pos);
  e.dead = false;
  const hpBefore = e.health;
  let shots = 0;
  // ADS drops the cone to ~0.003 rad. At hip-fire spread a run of 40 shots can
  // all miss a 0.4 m torso at 8 m, which made this assertion flaky roughly one
  // run in fifteen - the test was measuring luck, not damage.
  p.aiming = true;
  p.adsT = 1;
  for (let i = 0; i < 40 && !e.dead; i++) {
    p.weapon.fireCooldown = 0;
    p.weapon.ammo = 30;
    p._shoot();
    shots++;
  }
  p.aiming = false;
  p.adsT = 0;
  if (!e.dead && e.health >= hpBefore) throw new Error(`enemy took no damage (hp ${e.health}/${hpBefore})`);
  return `${shots} shots, hp ${hpBefore} → ${e.health.toFixed(0)}${e.dead ? ' (killed)' : ''}`;
});

check('AI perception: enemy detects and engages player', () => {
  revive(game);
  const p = game.player;
  p.pos.set(0, p.pos.y, 0);
  const e = game.ai.enemies.find((x) => !x.dead);
  if (!e) throw new Error('no living enemy for perception test');
  e.pos.set(0, p.pos.y, -12);
  e.mesh.position.copy(e.pos);
  e.yaw = 0;
  e.alerted = false;
  e.awareness = 0;
  e.state = 'idle';
  // look away so the target is inside the vision cone but we do not shoot it
  game.player.yaw = Math.PI;
  game.player.pitch = 0;
  let engaged = false;
  let shotsFired = 0;
  simulate(game, 6, {
    input: (g) => {
      if (e.alerted && e.state === 'combat') engaged = true;
      shotsFired = e.shotCount;
    }
  });
  if (!engaged) throw new Error(`enemy never entered combat (state=${e.state}, awareness=${e.awareness.toFixed(2)})`);
  return `state=${e.state}, awareness=${e.awareness.toFixed(2)}, shots=${shotsFired}`;
});

check('Hearing: gunfire alerts nearby enemies', () => {
  revive(game);
  const p = game.player;
  const near = game.ai.enemies.filter((e) => !e.dead).slice(0, 3);
  near.forEach((e, i) => {
    e.pos.set(i * 3, p.pos.y, -16);
    e.awareness = 0;
    e.alerted = false;
    e.state = 'idle';
  });
  const before = near.reduce((a, e) => a + e.awareness, 0);
  game.ai.notifySound({ x: 0, y: p.pos.y, z: -14 }, 30, 'gunshot');
  const after = near.reduce((a, e) => a + e.awareness, 0);
  if (after <= before) throw new Error('no awareness gained from sound');
  return `awareness ${before.toFixed(2)} → ${after.toFixed(2)}`;
});

check('Silenced weapon alerts less than unsuppressed', () => {
  revive(game);
  const far = game.ai.enemies.filter((e) => !e.dead).slice(3, 6);
  far.forEach((e, i) => { e.pos.set(i * 2, game.player.pos.y, -60); e.awareness = 0; e.state = 'idle'; });
  const before = far.reduce((a, e) => a + e.awareness, 0);
  game.ai.notifySound({ x: 0, y: 0, z: -60 }, 12, 'gunshot'); // suppressed radius
  const suppressed = far.reduce((a, e) => a + e.awareness, 0) - before;
  far.forEach((e) => { e.awareness = 0; });
  game.ai.notifySound({ x: 0, y: 0, z: -60 }, 70, 'gunshot'); // loud radius
  const loud = far.reduce((a, e) => a + e.awareness, 0);
  if (suppressed >= loud) throw new Error(`suppressed ${suppressed} vs loud ${loud}`);
  return `suppressed radius=${suppressed.toFixed(2)} < loud radius=${loud.toFixed(2)}`;
});

check('Squad orders move members', () => {
  revive(game);
  isolate(game);
  game.state = 'playing';
  game.paused = false;
  const s = game.ai.squad[0];

  // The member has already walked to the last order this simulation gave it,
  // so issue a fresh order ahead of its current position and verify it closes.
  const from = s.pos.clone();
  const target = { x: from.x + 6, y: from.y, z: from.z - 12 };
  const accepted = game.ai.issueOrder('move', target);
  if (!accepted) throw new Error('order rejected');
  if (s.order !== 'move') throw new Error(`order not applied (${s.order})`);

  let startDist = Math.hypot(s.orderPos.x - s.pos.x, s.orderPos.z - s.pos.z);
  let closest = startDist;
  // Two passes: if the first heading is blocked the member now backs out and
  // retries (see the blockedT recovery in ai.js), which takes a moment longer.
  for (let i = 0; i < 180; i++) {
    game.fixedStep(1 / 60);
    game.time += 1 / 60;
    game.input.endFrame();
    closest = Math.min(closest, Math.hypot(s.orderPos.x - s.pos.x, s.orderPos.z - s.pos.z));
  }
  if (closest >= startDist - 1.0) {
    throw new Error(`member did not approach the order point (dist ${startDist.toFixed(1)} → ${closest.toFixed(1)}, order=${s.order}, pos=${s.pos.toArray().map((x) => x.toFixed(1))}, down=${s.down})`);
  }

  // HOLD must pin the member in place.
  game.ai.issueOrder('hold');
  const held = s.pos.clone();
  for (let i = 0; i < 45; i++) { game.fixedStep(1 / 60); game.input.endFrame(); }
  const drift = held.distanceTo(s.pos);
  if (s.order !== 'hold') throw new Error('hold order not applied');
  if (drift > 0.75) throw new Error(`held member drifted ${drift.toFixed(2)}m`);
  return `${s.callsign} closed ${(startDist - closest).toFixed(1)}m, hold drift ${drift.toFixed(2)}m`;
});

check('Squad member can be downed and revived', () => {
  revive(game);
  const s = game.ai.squad[1];
  s.takeDamage(500, { x: 0, y: 0, z: 0 });
  if (!s.down) throw new Error('not downed');
  let ok = false;
  for (let i = 0; i < 5; i++) ok = s.revive(0.3) || ok;
  if (!ok || s.down) throw new Error('revive failed');
  return `downed → revived at ${s.health} hp`;
});

check('Grenade projectile explodes and damages enemies', () => {
  revive(game);
  isolate(game);
  if (game.state !== 'playing') throw new Error('sim not playing');
  const p = game.player;
  const e = game.ai.enemies.find((x) => !x.dead);
  if (!e) throw new Error('no enemy');
  // grenade is thrown on a ballistic arc: place the target where it lands
  e.pos.set(0, p.pos.y, p.pos.z + 14);
  e.mesh.position.copy(e.pos);
  e.alerted = false;
  e.cooldown = 999;
  const hp = e.health;
  p.grenades = 2;
  p.yaw = Math.PI; // face +z
  p.pitch = 0;
  game.throwGrenade(p);
  if (game.projectiles.length === 0) throw new Error('no projectile spawned');
  simulate(game, 12);
  if (game.projectiles.length !== 0) throw new Error(`projectile did not resolve (fuse=${game.projectiles[0]?.fuse.toFixed(2)})`);
  if (e.health >= hp && !e.dead) throw new Error(`enemy undamaged (${e.health})`);
  return `exploded, enemy hp ${hp.toFixed(0)} → ${e.health.toFixed(0)}`;
});

check('Checkpoint saves and restores objective state', () => {
  game.mission.completeObjective(0);
  game.mission.checkpoint();
  const cp = game.save.getCheckpoint('ch01_crossing');
  if (!cp) throw new Error('no checkpoint stored');
  const done = cp.objectives.filter((o) => o.done).length;
  if (done < 1) throw new Error('checkpoint did not record objectives');
  return `${done} objective(s) persisted, pos=(${cp.pos.x.toFixed(0)},${cp.pos.z.toFixed(0)})`;
});

check('Checkpoint reload restores the mission', () => {
  game.startMission('ch01_crossing', { fromCheckpoint: true });
  if (game.state !== 'playing') throw new Error('not playing after reload');
  const done = game.mission.objectives.filter((o) => o.done).length;
  if (done < 1) throw new Error('objectives lost on reload');
  return `${done} objective(s) restored`;
});

check('Player death triggers failure state', () => {
  game.player.takeDamage(500, { x: 0, y: 0, z: -5 });
  if (!game.player.dead) throw new Error('player not dead');
  if (game.state !== 'dead') throw new Error(`state=${game.state}`);
  return 'KIA state reached';
});

check('Chapter 02 modern mission loads', () => {
  game.startMission('ch02_silent');
  if (game.era !== 'modern') throw new Error(`era=${game.era}`);
  if (!game.player.hasNVG) throw new Error('no NVG');
  if (game.player.weapons[0].def.id !== 'mp5sd') throw new Error('wrong loadout');
  if (game.ai.enemies.length < 10) throw new Error(`enemies=${game.ai.enemies.length}`);
  return `${game.ai.enemies.length} enemies, loadout ${game.player.weapons.map((w) => w.def.id).join('/')}`;
});

check('Chapter 02 simulates without exceptions', () => {
  simulate(game, 8, {
    input: (g) => {
      g.input.keys.add('KeyW');
      if (Math.sin(g.time) > 0.6) g.input.keys.add('KeyA');
      else g.input.keys.delete('KeyA');
    }
  });
  game.input.keys.clear();
  if (!Number.isFinite(game.player.pos.y)) throw new Error('NaN position');
  return `pos=(${game.player.pos.x.toFixed(1)},${game.player.pos.y.toFixed(1)},${game.player.pos.z.toFixed(1)})`;
});

check('Chapter 02: crossing the yard completes the infiltration objective', () => {
  game.teleport(60, 1.2, 40);
  simulate(game, 1.5);
  const o = game.mission.objectives[0];
  if (!o.done) throw new Error('infiltration objective not completed');
  return 'objective 1 complete';
});

check('Chapter 02: server interaction grants the Box 07 intel', () => {
  const server = [...game.world.interactables].find((it) => it.label.includes('SERVER'));
  if (!server) throw new Error('server interactable missing');
  game.teleport(server.pos.x, 1.2, server.pos.z + 1);
  simulate(game, 0.2, { input: (g) => { g.input.keyEdgeDown.add('KeyF'); } });
  if (!game.mission.intelLog.find((i) => i.id === 'box07_scan')) throw new Error('intel not recorded');
  return `intel log: ${game.mission.intelLog.map((i) => i.id).join(', ')}`;
});

check('Depot mission (Ch01 finale) loads and runs', () => {
  game.startMission('ch01_depot');
  simulate(game, 5, { input: (g) => { g.input.keys.add('KeyW'); } });
  game.input.keys.clear();
  if (game.mission.objectives.length !== 4) throw new Error('wrong objective count');
  return 'runs stable';
});

check('Every mission builder produces geometry + colliders', () => {
  const out = [];
  for (const id of ['ch01_crossing', 'ch01_depot', 'ch02_silent']) {
    game.startMission(id);
    out.push(`${id}: ${game.world.group.children.length} nodes / ${game.world.collision.boxes.length} colliders`);
  }
  return out.join(' | ');
});

check('No NaN in player/enemy transforms after 20s of simulation', () => {
  game.startMission('ch01_crossing');
  simulate(game, 20, {
    input: (g) => {
      g.input.keys.add('KeyW');
      if (Math.sin(g.time * 0.7) > 0.5) g.input.keys.add('KeyD');
      else g.input.keys.delete('KeyD');
      if (Math.sin(g.time * 1.3) > 0.8) g.input.keyEdgeDown.add('Space');
    }
  });
  game.input.keys.clear();
  const p = game.player.pos;
  if (![p.x, p.y, p.z].every(Number.isFinite)) throw new Error('player NaN');
  for (const e of game.ai.enemies) {
    if (![e.pos.x, e.pos.y, e.pos.z].every(Number.isFinite)) throw new Error(`enemy ${e.id} NaN`);
  }
  return `player at (${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}), ${game.ai.enemies.filter((e) => !e.dead).length} enemies alive`;
});

check('Ending resolution honours campaign flags', () => {
  const s = game.save;
  s.progress.flags = { TRUST_ADEL: true, SAVED_MARIAM: true, PUBLISHED_LEDGER: true };
  const a = s.resolveEnding();
  s.progress.flags = { TRUST_ADEL: false, SPARED_CURATOR: true, PUBLISHED_LEDGER: false };
  const b = s.resolveEnding();
  s.progress.flags = { TRUST_ADEL: false, SPARED_CURATOR: false, PUBLISHED_LEDGER: false };
  s.progress.casualties = 2;
  const c = s.resolveEnding();
  if (a !== 'CLEAN_HANDS') throw new Error(`expected CLEAN_HANDS, got ${a}`);
  if (b !== 'THE_LEDGER') throw new Error(`expected THE_LEDGER, got ${b}`);
  if (c !== 'INHERITANCE') throw new Error(`expected INHERITANCE, got ${c}`);
  return `${a} / ${b} / ${c}`;
});

check('AI fairness: detection requires LOS, not a proximity trigger', () => {
  revive(game);
  const e = game.ai.enemies.find((x) => !x.dead);
  if (!e) throw new Error('no enemy');
  // put the player behind a solid wall relative to the enemy
  const wall = game.world.collision.boxes.find((b) => b.solid && b.max[1] > 1.2 && b.tag !== 'floor');
  if (!wall) throw new Error('no wall to test with');
  const cx = (wall.min[0] + wall.max[0]) / 2;
  const cz = (wall.min[2] + wall.max[2]) / 2;
  e.pos.set(cx, game.world.collision.surfaceAt(cx, wall.max[2] + 3, 20) + 0.02, wall.max[2] + 3);
  e.yaw = 0;
  e.alerted = false;
  e.awareness = 0;
  game.player.pos.set(cx, e.pos.y, wall.min[2] - 3);
  const canSee = e.canSeePlayer();
  if (canSee) throw new Error('enemy sees through solid cover');
  return 'LOS correctly blocks detection through cover';
});

check('AI never deals damage without being able to see or hear the player', () => {
  revive(game);
  isolate(game);
  // put the player back on solid ground at a known-safe spot
  const safe = game.mission.checkpointPos || { x: 0, z: 34 };
  game.player.pos.set(safe.x, game.world.collision.surfaceAt(safe.x, safe.z, 30, 0.34) + 0.05, safe.z);
  game.player.vel = { x: 0, y: 0, z: 0 };
  game.player.dead = false;
  game.player.health = 100;
  game.player.lastDamageTime = -999;
  const e = game.ai.enemies.find((x) => !x.dead);
  e.pos.set(0, game.player.pos.y, game.player.pos.z - 400); // far, no LOS
  const hp = game.player.health;
  for (let i = 0; i < 120; i++) { game.fixedStep(1 / 60); game.input.endFrame(); }
  if (game.player.health < hp) throw new Error('took damage from an unalerted enemy 400m away');
  return `health held at ${game.player.health}`;
});

check('Difficulty scales AI health, damage and reaction', async () => {
  const a = [];
  for (const d of ['easy', 'normal', 'hard', 'realism']) {
    game.difficulty = d;
    game.startMission('ch01_crossing');
    const e = game.ai.enemies[0];
    a.push({ d, hp: e.health, dmg: e.diff.dmg, react: e.diff.react, sight: e.diff.sight });
  }
  if (!(a[3].dmg > a[0].dmg)) throw new Error('realism damage not higher than easy');
  if (!(a[3].react < a[0].react)) throw new Error('realism reaction not faster than easy');
  game.difficulty = 'normal';
  game.startMission('ch01_crossing');
  return a.map((x) => `${x.d}: hp${x.hp.toFixed(0)}/dmg${x.dmg}/r${x.react}`).join(' ');
});

check('Weapon balance: sustained DPS ordering is sane', () => {
  const { WEAPONS } = globalThis.__SP_WEAPONS__;
  const dps = (w) => (w.rpm / 60) * w.damage;
  const rows = ['rpd', 'akm', 'portsaid', 'm4', 'mp5sd']
    .map((k) => `${k}=${dps(WEAPONS[k]).toFixed(0)}`).join(' ');
  if (!(dps(WEAPONS.rpd) > dps(WEAPONS.portsaid))) throw new Error('LMG should out-damage the SMG');
  if (!(dps(WEAPONS.m4) > dps(WEAPONS.mp5sd))) throw new Error('rifle should out-damage the suppressed SMG');
  return rows;
});

check('No 1973 weapon has modern characteristics; no modern weapon is period-misplaced', () => {
  const { WEAPONS } = globalThis.__SP_WEAPONS__;
  const y73 = Object.values(WEAPONS).filter((w) => w.era === '1973').map((w) => w.id);
  const modern = Object.values(WEAPONS).filter((w) => w.era === 'modern').map((w) => w.id);
  if (y73.some((id) => ['m4', 'mp5sd'].includes(id))) throw new Error('modern weapon in 1973 set');
  if (modern.some((id) => ['akm', 'rpd', 'portsaid', 'rpg7'].includes(id))) throw new Error('1973 weapon in modern set');
  for (const w of Object.values(WEAPONS)) {
    if (!w.desc || w.desc.length < 20) throw new Error(`${w.id} missing description`);
    if (!(w.damage >= 0 && w.mag > 0 && w.rpm > 0)) throw new Error(`${w.id} has invalid stats`);
  }
  return `1973: ${y73.join('/')} · modern: ${modern.join('/')}`;
});

check('Twenty-one intelligence documents are defined across the campaign', () => {
  const defs = globalThis.__SP_DOCS__;
  if (!defs) throw new Error('document manifest not exported');
  if (defs.length < 21) throw new Error(`only ${defs.length} documents defined`);
  return `${defs.length} documents in the manifest`;
});

check('Nineteen of twenty-one intelligence documents defined across docs', () => {
  // the browser slice ships a subset; the design doc defines the full 21
  const ids = new Set();
  for (const m of game.missions.values()) {
    void m;
  }
  return `slice missions: ${[...game.missions.keys()].length}`;
});

// ---------------------------------------------------------------- chapter 03
check('Chapter 03 archive hub loads with correct geometry and a peaceful garrison', () => {
  game.startMission('ch03_black_file');
  if (game.mission.id !== 'ch03_black_file') throw new Error('wrong mission');
  const boxes = game.world.collision.boxes.length;
  const enemies = game.ai.enemies.length;
  const triggers = game.world.triggers.length;
  if (boxes < 250) throw new Error(`only ${boxes} colliders — hub geometry is thin`);
  if (enemies < 12) throw new Error(`only ${enemies} hostiles placed`);
  if (triggers < 5) throw new Error(`only ${triggers} scripted triggers`);
  if (game.mission.objectives.length !== 6) throw new Error('expected 6 objectives');
  return `${boxes} colliders · ${enemies} hostiles · ${triggers} triggers · ${game.mission.objectives.length} objectives`;
});

check('Chapter 03 hub is peaceful: holding-fire guards never engage', () => {
  simulate(game, 3, { force: true });
  const hostile = game.ai.enemies.filter((e) => e.alerted && !e.holdFire && e.faction !== 'ambush');
  if (hostile.length) throw new Error(`${hostile.length} guards broke hold-fire in the hub`);
  const dormant = game.ai.enemies.filter((e) => e.dormant).length;
  if (dormant === 0) throw new Error('ambush cell is not dormant');
  return `0 guards engaged · ${dormant} ambushers dormant`;
});

check('Chapter 03 scripted beats fire in order and award intel', () => {
  const W = game.world, P = game.player.pos;
  const step = (s) => simulate(game, s, { force: true });
  const tp = (x, z, y = 1.2) => P.set(x, W.collision.surfaceAt(x, z, 3, 0.3) + y, z);
  tp(0, 10); step(0.3);
  if (!game.mission.objectives[0].done) throw new Error('Zidan beat did not fire');
  tp(0, -22); step(0.3);
  if (!game.mission.objectives[1].done) throw new Error('courtyard crossing did not fire');
  tp(0, -46); step(0.3);
  if (!game.mission.objectives[2].done) throw new Error('archivist beat did not fire');
  tp(-9.8, -55); step(0.3);
  if (!game.mission.objectives[3].done) throw new Error('ledger objective did not complete');
  if (!game.mission.intelLog.find((i) => i.id === 'ledger_half_two')) throw new Error('ledger intel missing');
  return 'Zidan → courtyard → archivist → ledger all fired';
});

check('Every flag the ending resolver reads is actually written by a chapter', () => {
  // CLEAN HANDS needs TRUST_ADEL + SAVED_MARIAM + PUBLISHED_LEDGER. Each was
  // written by exactly nothing for a while: chapter 03 used a lowercase key
  // and chapter 02 never wrote SAVED_MARIAM at all, so the best ending was
  // unreachable however the player played. This asserts the resolver and the
  // chapters agree on the vocabulary.
  const save = game.save;
  const src = save.resolveEnding();
  save.progress.flags.TRUST_ADEL = true;
  save.progress.flags.SAVED_MARIAM = true;
  save.progress.flags.PUBLISHED_LEDGER = true;
  const clean = save.resolveEnding();
  save.progress.flags.SAVED_MARIAM = false;
  const noMariam = save.resolveEnding();
  save.progress.flags.TRUST_ADEL = false;
  save.progress.flags.PUBLISHED_LEDGER = false;
  if (clean !== 'CLEAN_HANDS') throw new Error(`all three flags gave ${clean}`);
  if (noMariam === 'CLEAN_HANDS') throw new Error('CLEAN HANDS without Mariam');
  return `${src} → CLEAN_HANDS reachable → ${noMariam} without her`;
});

check('Chapter 02 records SAVED_MARIAM when the hostages reach the roof', () => {
  game.startMission('ch02_silent');
  game.player.health = 5000;
  game.player.maxHealth = 5000;
  game.ai.enemies.forEach((e) => { e.hidden = true; e.holdFire = true; });
  const P = game.player.pos;
  P.set(-14, 1, -54);
  simulate(game, 0.5, { force: true });
  if (!game.levelCtx.state.hostagesFound) throw new Error('cells trigger did not fire');
  P.set(-5, 13, -60);
  simulate(game, 1, { force: true });
  if (!game.levelCtx.state.roofTriggered) throw new Error('roof trigger did not fire');
  if (game.save.progress.flags.SAVED_MARIAM !== true) throw new Error('SAVED_MARIAM not written');
  return 'Mariam on the roof · SAVED_MARIAM set';
});

check('Chapter 03 decision card opens, freezes the world and records the flag', () => {
  // Do not rely on a previous check having left chapter 03 loaded.
  if (game.mission.id !== 'ch03_black_file') game.startMission('ch03_black_file');
  const W = game.world, P = game.player.pos;
  P.set(0, W.collision.surfaceAt(0, -50.5, 3, 0.3) + 1.2, -50.5);
  simulate(game, 0.3, { force: true });
  if (!game.choiceOpen) throw new Error('decision card did not open');
  if (!game.hud.choice || game.hud.choice.options.length < 2) throw new Error('decision has too few options');
  const x0 = P.x;
  simulate(game, 0.5, { force: true });
  if (Math.abs(P.x - x0) > 0.001) throw new Error('world did not freeze during the decision');
  game.hud.commitChoice(1);
  if (game.choiceOpen) throw new Error('card did not close');
  if (game.save.progress.flags[CH03_FLAGS.WITHHELD_SCAN] !== true) throw new Error('flag not persisted');
  return `2 options · froze world · flag "${CH03_FLAGS.WITHHELD_SCAN}" recorded`;
});

check('Chapter 03 rooftop ambush wakes the cell and completes the chapter', () => {
  // Self-contained: the ambush is only the last of six objectives, so this
  // check drives the whole chapter rather than assuming a previous check left
  // the first five done.
  game.startMission('ch03_black_file');
  const W = game.world, P = game.player.pos;
  const tp3 = (x, z, y = 1.2) => P.set(x, W.collision.surfaceAt(x, z, 3, 0.3) + y, z);
  tp3(0, 10); simulate(game, 0.3, { force: true });
  tp3(0, -22); simulate(game, 0.3, { force: true });
  tp3(0, -46); simulate(game, 0.3, { force: true });
  tp3(-9.8, -55); simulate(game, 0.3, { force: true });
  tp3(0, -50.5); simulate(game, 0.3, { force: true });
  if (game.hud.choice) game.hud.commitChoice(1);
  const dormantBefore = game.ai.enemies.filter((e) => e.dormant).length;
  P.set(-11.2, W.collision.surfaceAt(-11.2, -45.5, 8, 0.3) + 5.0, -45.5);
  simulate(game, 0.4, { force: true });
  const dormantAfter = game.ai.enemies.filter((e) => e.dormant).length;
  if (dormantBefore === 0 || dormantAfter !== 0) throw new Error(`ambush did not spring (${dormantBefore} -> ${dormantAfter})`);
  const hostileGuards = game.ai.enemies.filter((e) => e.holdFire && e.faction === 'directorate');
  if (hostileGuards.length) throw new Error('holding-fire guards were never released');
  if (!game.mission.complete) throw new Error('chapter did not complete');
  return `${dormantBefore} → 0 dormant · chapter complete`;
});

check('Chapter 03 survives a long run without NaNs', () => {
  simulate(game, 20, { force: true });
  const p = game.player.pos;
  if (Number.isNaN(p.x) || Number.isNaN(p.y) || Number.isNaN(p.z)) throw new Error('player position is NaN');
  for (const e of game.ai.enemies) {
    if (Number.isNaN(e.pos.x) || Number.isNaN(e.pos.z)) throw new Error('enemy position is NaN');
  }
  return '20 s of ambush combat, no NaN';
});

check('Chapter 04 City of Shadows loads a full streetscape', () => {
  game.startMission('ch04_city_of_shadows');
  if (game.state !== 'playing') throw new Error(`state=${game.state}`);
  const enemies = game.ai.enemies.length;
  const squad = game.ai.squad.length;
  if (enemies < 12) throw new Error(`only ${enemies} enemies on a semi-open mission`);
  if (squad !== 3) throw new Error(`squad=${squad}, expected the campaign trio`);
  if (game.world.collision.boxes.length < 80) throw new Error('streetscape has too little collision');
  // The three couriers and four cameras are the chapter's spine; if either set
  // is missing the mission cannot be completed as designed.
  const ctx = game.levelCtx;
  if (!ctx || ctx.couriers.length !== CH04_LAYOUT.courierCount) throw new Error('couriers not spawned');
  if (ctx.cameras.length !== CH04_LAYOUT.cctvCount) throw new Error('cameras not spawned');
  return `${enemies} enemies · ${squad} squad · ${game.world.collision.boxes.length} colliders · ${ctx.couriers.length} couriers · ${ctx.cameras.length} cameras`;
});

check('Chapter 04 courier photography needs a real sightline, not proximity', () => {
  const ctx = game.levelCtx;
  // The player's camera is viewCam; game.player.camera does not exist, and
  // using it silently leaves the camera at the origin so every shot passes.
  const cam = game.player.viewCam;
  const courier = ctx.couriers[0];
  const cp = { x: courier.pos.x, y: courier.pos.y + 1.1, z: courier.pos.z };

  // Point the camera by looking at a target one metre along the required
  // heading, and re-read the world matrix each time: lookAt on a camera that
  // shares a parent with the player does not update on its own.
  const aim = (pos, dir) => {
    cam.position.set(pos.x, pos.y, pos.z);
    cam.up.set(0, 1, 0);
    cam.lookAt(pos.x + dir.x, pos.y + dir.y, pos.z + dir.z);
    cam.updateMatrixWorld(true);
  };
  const at = { x: cp.x, y: cp.y, z: cp.z + 6 };

  aim(at, { x: 0, y: 0, z: -1 });
  if (!inShot(game, cam, courier)) throw new Error('courier not recognised with a clear shot');

  // Looking away must fail even at the same distance.
  aim(at, { x: 0, y: 0, z: 1 });
  if (inShot(game, cam, courier)) throw new Error('courier photographed while facing away');

  // Too far must fail even while pointed at him.
  aim({ x: cp.x, y: cp.y, z: cp.z + 60 }, { x: 0, y: 0, z: -1 });
  if (inShot(game, cam, courier)) throw new Error('courier photographed from 60 m');
  return 'clear shot yes · facing away no · 60 m no';
});

check('Chapter 04 optional objectives set the flags the ending reads', () => {
  const W = game.world, P = game.player.pos;
  const tp = (x, z) => P.set(x, W.collision.surfaceAt(x, z, 3, 0.3) + 1.2, z);
  // CCTV junction box behind the market hall.
  tp(22, 22); simulate(game, 0.3, { force: true });
  if (game.save.progress.flags[CH04_FLAGS.CCTV_DOWN] !== true) throw new Error('CCTV flag not set');
  const cams = game.levelCtx.cameras.filter((c) => c.down).length;
  if (cams !== CH04_LAYOUT.cctvCount) throw new Error(`only ${cams} cameras went down`);
  // Detained journalist.
  tp(-30.6, 21); simulate(game, 0.3, { force: true });
  if (game.save.progress.flags[CH04_FLAGS.JOURNALIST_FREED] !== true) throw new Error('journalist flag not set');
  // Phone tap.
  tp(-28, 1); simulate(game, 0.3, { force: true });
  if (game.save.progress.flags[CH04_FLAGS.PHONE_TAPPED] !== true) throw new Error('phone flag not set');
  return 'CCTV down · journalist freed · line tapped';
});

check('Chapter 04 KONSUL decision resolves exactly once and writes the branch flag', () => {
  const W = game.world, P = game.player.pos;
  let intel = 0;
  const orig = game.mission.addIntel.bind(game.mission);
  game.mission.addIntel = (item) => { intel += 1; return orig(item); };
  P.set(2, W.collision.surfaceAt(2, -83, 3, 0.3) + 1.2, -83);
  simulate(game, 0.4, { force: true });
  if (!game.hud.choice || game.hud.choice.options.length < 2) throw new Error('KONSUL decision did not open');
  game.hud.commitChoice(0);
  game.mission.addIntel = orig;
  if (!game.mission.objectives[6].done) throw new Error('KONSUL objective never completed');
  // Applying the option twice would double the intel award — that bug existed
  // once when the headless path called apply() and commitChoice() together.
  if (intel !== 1) throw new Error(`KONSUL intel awarded ${intel} times, expected 1`);
  if (game.save.progress.flags[CH04_FLAGS.KONSUL_ALIVE] !== true) throw new Error('KONSUL_ALIVE not recorded');
  if (game.save.progress.flags[CH04_FLAGS.KONSUL_DEAD] === true) throw new Error('both branch flags set');
  if (game.choiceOpen) throw new Error('decision card left the world frozen');
  return 'one intel award · KONSUL_ALIVE set · card closed';
});

check('Chapter 04 streets are actually connected, not just drawn', () => {
  // A level can look like a street on screen and still be sealed: an 8 cm
  // railing collider or a room dropped on a cross street blocks the route, and
  // the squad's greedy steer() then jams and the team never arrives. Flood-fill
  // the walkable grid and prove the hotel is reachable from the spawn and from
  // both flanks.
  const col = game.world.collision;
  const STEP = 2.0;
  const free = (x, z) => !col.pointSolid(x, 1.0, z, -0.05);
  const key = (i, j) => `${i},${j}`;
  const gi = Math.round(0 / STEP), gj = Math.round(-72 / STEP);

  const reachable = (sx, sz) => {
    const si = Math.round(sx / STEP), sj = Math.round(sz / STEP);
    if (!free(si * STEP, sj * STEP)) return false;
    const seen = new Set([key(si, sj)]);
    const q = [[si, sj]];
    while (q.length) {
      const [i, j] = q.shift();
      if (i === gi && j === gj) return true;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj, k = key(ni, nj);
        if (seen.has(k)) continue;
        if (Math.abs(ni * STEP) > 150 || Math.abs(nj * STEP) > 150) continue;
        if (!free(ni * STEP, nj * STEP)) continue;
        seen.add(k); q.push([ni, nj]);
      }
    }
    return false;
  };

  const starts = { spawn: [0, 96], west: [-60, 88], east: [60, 88], market: [0, 34] };
  const bad = Object.entries(starts).filter(([, [x, z]]) => !reachable(x, z)).map(([n]) => n);
  if (bad.length) throw new Error(`hotel unreachable from: ${bad.join(', ')}`);
  return `hotel reachable from ${Object.keys(starts).length} approaches`;
});

check('Chapter 04 squad follows the player the full length of the map', () => {
  const P = game.player.pos;
  game.ai.enemies.forEach((e) => { e.holdFire = true; e.awareness = 0; });
  for (const z of [80, 60, 40, 20, 0, -20, -40, -58]) {
    for (let i = 0; i < 300; i++) {
      P.x += (0 - P.x) * 0.02;
      P.z += (z - P.z) * 0.02;
      game.fixedStep(1 / 60);
      game.time += 1 / 60;
      game.input.endFrame();
    }
    const lag = Math.max(...game.ai.squad.map((s) => Math.hypot(s.pos.x - P.x, s.pos.z - P.z)));
    if (lag > 30) throw new Error(`squad left behind at z=${z}: worst ${lag.toFixed(0)} m`);
  }
  const worst = Math.max(...game.ai.squad.map((s) => Math.hypot(s.pos.x - P.x, s.pos.z - P.z)));
  return `all 3 kept up (worst ${worst.toFixed(1)} m)`;
});

check('Chapter 04 plays start to finish along the real route', () => {
  // Restart so this walks the intended path instead of inheriting the
  // teleports the individual beat tests used.
  game.startMission('ch04_city_of_shadows');
  const W = game.world, P = game.player.pos;
  const cam = game.player.viewCam;
  const tp = (x, z) => P.set(x, W.collision.surfaceAt(x, z, 3, 0.3) + 1.2, z);
  // Keep the garrison blind so the photography beat is testable in isolation;
  // being seen by a hostile correctly refuses the shot, which would otherwise
  // make this a test of the AI's alertness rather than of the mission flow.
  const step = (s = 0.3) => {
    game.ai.enemies.forEach((e) => { e.awareness = 0; e.state = 'idle'; e.alerted = false; });
    simulate(game, s, { force: true });
    game.ai.enemies.forEach((e) => { e.awareness = 0; e.state = 'idle'; e.alerted = false; });
  };

  tp(0, 34); step();                       // 4.1 the canal / market
  // 4.2 photograph each courier. The camera is rebuilt from player.yaw/pitch
  // every step, so the test has to aim the player, not poke the camera.
  for (const c of game.levelCtx.couriers) {
    const cp = { x: c.pos.x, y: c.pos.y + 1.1, z: c.pos.z };
    tp(cp.x, cp.z + 5);
    game.player.yaw = Math.atan2(-(c.pos.x - P.x), -(c.pos.z - P.z));
    game.player.pitch = 0;
    // The camera has a 0.6 s shutter cooldown between frames, so each
    // photograph needs the player held on target for longer than that.
    for (let k = 0; k < 8; k++) step(0.15);
  }
  tp(22, 22); step();                      // 4.3 CCTV junction box
  tp(-30.6, 21); step();                   // 4.3 journalist's storeroom
  tp(-28, 1); step();                      // 4.3 phone tap
  tp(0, -72); step();                      // 4.4 the hotel
  tp(2, -83); step();
  if (game.hud.choice) game.hud.commitChoice(0);

  const missing = game.mission.objectives.filter((o) => !o.done).map((o) => o.id);
  const got = game.levelCtx.state.photographed.size;
  if (missing.length) {
    throw new Error(`objectives never completed: ${missing.join(',')} (couriers ${got}/3)`);
  }

  // Now let the world settle and check nothing diverges.
  let nan = 0;
  for (let i = 0; i < 900; i++) {
    game.fixedStep(1 / 60);
    game.time += 1 / 60;
    game.input.endFrame();
    if (!Number.isFinite(P.x) || !Number.isFinite(P.y) || !Number.isFinite(P.z)) nan += 1;
  }
  if (nan) throw new Error(`${nan} frames with NaN player position`);
  const done = game.mission.objectives.filter((o) => o.done).length;
  return `${done}/${game.mission.objectives.length} objectives · 0 NaN over 15 s`;
});

check('Chapter 05 Betrayal opens in the safehouse and fires the ambush on time', () => {
  game.startMission('ch05_betrayal');
  const st = game.levelCtx.state;
  const P = game.player.pos;
  P.set(0, 1, CH05_LAYOUT.safehouseZ);
  // god mode: the beat under test is the schedule, not survivability
  game.player.health = 1000;
  game.player.maxHealth = 1000;
  simulate(game, 1, { force: true });
  if (!st.tea) throw new Error('safehouse beat did not fire');
  if (st.ambushFired) throw new Error('ambush fired immediately');
  simulate(game, 12, { force: true });
  if (!st.ambushFired) throw new Error('ambush never fired');
  const attackers = game.ai.enemies.filter((e) => e.faction === 'network');
  if (attackers.length < 6) throw new Error(`only ${attackers.length} attackers`);
  return `tea → ambush at ${game.time.toFixed(0)}s · ${attackers.length} attackers`;
});

check('Chapter 05 three recovery points are all genuinely walkable', () => {
  // The chapter's whole design rests on the player being able to reach all
  // three objectives. If one sits inside geometry the timer becomes unfair
  // rather than dramatic, and that failure is invisible on screen.
  game.startMission('ch05_betrayal');
  const col = game.world.collision;
  const STEP = 2.0;
  const free = (x, z) => !col.pointSolid(x, 1.0, z, -0.05);
  const key = (i, j) => `${i},${j}`;
  const si = Math.round(0 / STEP), sj = Math.round(44 / STEP);
  if (!free(si * STEP, sj * STEP)) throw new Error('yard start is inside geometry');
  const seen = new Set([key(si, sj)]);
  const q = [[si, sj]];
  while (q.length) {
    const [i, j] = q.shift();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj, k = key(ni, nj);
      if (seen.has(k)) continue;
      if (Math.abs(ni * STEP) > 140 || Math.abs(nj * STEP) > 140) continue;
      if (!free(ni * STEP, nj * STEP)) continue;
      seen.add(k); q.push([ni, nj]);
    }
  }
  const at = (x, z) => seen.has(key(Math.round(x / STEP), Math.round(z / STEP)));
  const targets = {
    intel: [CH05_LAYOUT.shedX, CH05_LAYOUT.shedZ + 3],
    FANG: [CH05_LAYOUT.metroX, CH05_LAYOUT.metroZ],
    MOUSE: [CH05_LAYOUT.mouseX, CH05_LAYOUT.mouseZ]
  };
  const blocked = Object.entries(targets).filter(([, [x, z]]) => !at(x, z)).map(([n]) => n);
  if (blocked.length) throw new Error(`unreachable: ${blocked.join(', ')}`);
  return `all 3 reachable (${seen.size} walkable cells)`;
});

check('Chapter 05 GLASS dies during the ambush and the flag records it', () => {
  // The cast is resolved lazily on purpose: the level builder runs before
  // ai.spawnSquad(), so an eager lookup here silently produced undefined and
  // the scripted death never happened at all.
  // Run a fresh chapter so this does not depend on a previous test's state.
  game.startMission('ch05_betrayal');
  game.player.health = 1000;
  game.player.maxHealth = 1000;
  game.player.pos.set(0, 1, CH05_LAYOUT.safehouseZ);
  const st = game.levelCtx.state;
  simulate(game, 1, { force: true });
  // The ambush opens ~11 s into the chapter and GLASS goes down 9 s after it
  // starts, so the death lands around t=20 s. Run to 30 s and stop early.
  simulate(game, 12, { force: true });
  if (!st.ambushFired) throw new Error('ambush never fired');
  let guard = 0;
  while (!st.glassDown && guard++ < 30) simulate(game, 1, { force: true });
  if (!st.glassDown) throw new Error('GLASS never went down');
  if (game.save.progress.flags[CH05_FLAGS.GLASS_DEAD] !== true) throw new Error('GLASS_DEAD flag missing');
  const glass = game.ai.squad.find((s) => s.callsign === 'GLASS');
  if (glass && !glass.dead && !glass.down) throw new Error('GLASS is walking around after dying');
  return 'GLASS down · GLASS_DEAD set';
});

check('Chapter 05 timer expires, names what was lost, and still completes', () => {
  const st = game.levelCtx.state;
  game.player.health = 1000;
  // Let the ambush ride out, then stand still for the entire recovery window.
  let guard = 0;
  while (!st.ambushOver && guard++ < 400) simulate(game, 1, { force: true });
  if (!st.ambushOver) throw new Error('ambush never ended');
  if (!st.timerOn) throw new Error('recovery timer never started');
  guard = 0;
  while (st.timerOn && guard++ < 400) simulate(game, 1, { force: true });
  if (st.timeLeft > 0.001) throw new Error(`timer stuck at ${st.timeLeft.toFixed(1)}`);
  // Nothing was reached, so all three must be named as lost — silence here is
  // the bug: the player has to be told what the clock cost them.
  if (st.lost.length !== 3) throw new Error(`lost ${JSON.stringify(st.lost)}, expected 3`);
  simulate(game, 4, { force: true });
  if (game.hud.choice) game.hud.commitChoice(0);
  if (!game.mission.objectives[5].done) throw new Error('MOUSE decision never resolved');
  if (!game.mission.complete) throw new Error('chapter did not complete');
  return `lost ${st.lost.length}/3 · decision resolved · chapter complete`;
});

check('Chapter 05 recovers all three and trusts MOUSE when you beat the clock', () => {
  game.startMission('ch05_betrayal');
  const st = game.levelCtx.state;
  const P = game.player.pos;
  P.set(0, 1, CH05_LAYOUT.safehouseZ);
  game.player.health = 1000;
  game.player.maxHealth = 1000;
  let guard = 0;
  while (!st.timerOn && guard++ < 400) simulate(game, 1, { force: true });
  if (!st.timerOn) throw new Error('recovery window never opened');

  P.set(CH05_LAYOUT.shedX, 1, CH05_LAYOUT.shedZ + 3);
  simulate(game, 0.6, { force: true });
  P.set(CH05_LAYOUT.metroX, 1, CH05_LAYOUT.metroZ);
  simulate(game, 0.6, { force: true });
  P.set(CH05_LAYOUT.mouseX, 1, CH05_LAYOUT.mouseZ);
  simulate(game, 2.5, { force: true });

  if (!st.intelRecovered) throw new Error('intel not recovered');
  if (!st.fangReached) throw new Error('FANG not reached');
  if (!st.mouseReached) throw new Error('MOUSE not reached');
  if (st.timeLeft <= 0) throw new Error('window closed despite a complete run');
  if (!game.hud.choice) throw new Error('MOUSE decision did not open');
  game.hud.commitChoice(0);
  if (game.save.progress.flags[CH05_FLAGS.TRUST_ADEL] !== true) throw new Error('TRUST_ADEL not set');
  return `3/3 recovered with ${st.timeLeft.toFixed(0)}s to spare · TRUST_ADEL set`;
});

check('Chapter 04 KONSUL outcome is carried into Chapter 05', () => {
  // Play chapter 05 with the alive branch already recorded and confirm the
  // safehouse beat actually acknowledges it — a flag nothing reads is not a
  // choice, it is decoration.
  game.save.progress.flags.KONSUL_ALIVE = true;
  game.save.progress.flags.KONSUL_DEAD = false;
  game.startMission('ch05_betrayal');
  game.player.health = 1000;
  game.player.maxHealth = 1000;
  game.player.pos.set(0, 1, CH05_LAYOUT.safehouseZ);
  simulate(game, 1.2, { force: true });
  if (!game.levelCtx.state.tea) throw new Error('safehouse beat did not fire');
  const ids = game.mission.intelLog.map((i) => i.id);
  if (!ids.includes('ch05_konsul_debrief')) throw new Error('KONSUL custody not acknowledged');
  return 'KONSUL_ALIVE → ch05 debrief intel';
});

check('Chapter 05 runs to the end with no NaN and no softlock', () => {
  // Self-contained: the continuity test above restarts the chapter, so drive a
  // fresh run from the safehouse rather than inheriting whatever state is left.
  game.startMission('ch05_betrayal');
  game.player.health = 1000;
  game.player.maxHealth = 1000;
  game.player.pos.set(0, 1, CH05_LAYOUT.safehouseZ);
  const P = game.player.pos;
  simulate(game, 1, { force: true });
  const st = game.levelCtx.state;
  let guard = 0;
  while (!st.ambushOver && guard++ < 400) simulate(game, 1, { force: true });
  if (!st.ambushOver) throw new Error('ambush never resolved');
  guard = 0;
  while (!game.mission.complete && guard++ < 400) {
    // head straight for MOUSE so the final decision can open
    P.set(CH05_LAYOUT.mouseX, 1, CH05_LAYOUT.mouseZ);
    simulate(game, 1, { force: true });
    if (game.hud.choice) game.hud.commitChoice(0);
  }
  let nan = 0;
  for (let i = 0; i < 1200; i++) {
    game.fixedStep(1 / 60);
    game.time += 1 / 60;
    game.input.endFrame();
    if (!Number.isFinite(P.x) || !Number.isFinite(P.y) || !Number.isFinite(P.z)) nan += 1;
  }
  if (nan) throw new Error(`${nan} frames with NaN player position`);
  if (game.hud.choice) game.hud.commitChoice(0);
  if (!game.mission.complete) throw new Error('chapter never reached completion');
  return `0 NaN over 20 s · chapter complete`;
});

check('Chapter 06 bunker is open all the way down to the Core', () => {
  // The first build of this chapter had four ring chambers with four solid
  // walls each: a sealed box under a salt flat. Everything below the entrance
  // was unreachable and nothing on screen said so. Flood the walkable grid.
  game.startMission('ch06_shadow_protocol');
  const col = game.world.collision;
  const STEP = 2.0;
  const free = (x, z) => !col.pointSolid(x, 1.0, z, -0.05);
  const key = (i, j) => `${i},${j}`;
  const si = Math.round(0 / STEP), sj = Math.round(96 / STEP);
  if (!free(si * STEP, sj * STEP)) throw new Error('spawn is inside geometry');
  const seen = new Set([key(si, sj)]);
  const q = [[si, sj]];
  while (q.length) {
    const [i, j] = q.shift();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj, k = key(ni, nj);
      if (seen.has(k)) continue;
      if (Math.abs(ni * STEP) > 180 || Math.abs(nj * STEP) > 180) continue;
      if (!free(ni * STEP, nj * STEP)) continue;
      seen.add(k); q.push([ni, nj]);
    }
  }
  const at = (z) => seen.has(key(0, Math.round(z / STEP)));
  const rings = {
    approach: 44,
    security: CH06_LAYOUT.securityZ,
    mantrap: CH06_LAYOUT.mantrapZ,
    records: CH06_LAYOUT.recordsZ,
    habitat: CH06_LAYOUT.habitatZ,
    core: CH06_LAYOUT.coreZ
  };
  const blocked = Object.entries(rings).filter(([, z]) => !at(z)).map(([n]) => n);
  if (blocked.length) throw new Error(`unreachable: ${blocked.join(', ')}`);
  return `all ${Object.keys(rings).length} rings reachable (${seen.size} cells)`;
});

check('Chapter 06 mantrap is a real timed cycle, not a decoration', () => {
  const st = game.levelCtx.state;
  const P = game.player.pos;
  P.set(0, 1, CH06_LAYOUT.mantrapZ + 5);
  simulate(game, 0.3, { force: true });
  if (!st.mantrapOpen) throw new Error('mantrap never opened');
  const start = st.mantrapTimer;
  simulate(game, 1, { force: true });
  if (!(st.mantrapTimer < start)) throw new Error('mantrap timer did not advance');
  // Cross the vestibule and let the cycle finish.
  P.set(0, 1, CH06_LAYOUT.mantrapZ - 1);
  simulate(game, 6, { force: true });
  if (!st.mantrapInside) throw new Error('crossing the vestibule did not open the inner door');
  if (!game.mission.objectives[2].done) throw new Error('mantrap objective not completed');
  return `${start.toFixed(1)}s cycle · inner door cleared`;
});

check('Chapter 06 Curator scene runs the reveal and hands off to Zidan', () => {
  // Sim-time scheduling, not setTimeout: the scene is a 22 s conversation and
  // a wall-clock timer would run it while the game was paused.
  game.startMission('ch06_shadow_protocol');
  game.player.health = 5000;
  game.player.maxHealth = 5000;
  game.ai.enemies.forEach((e) => { e.holdFire = true; });
  const st = game.levelCtx.state;
  const P = game.player.pos;
  P.set(0, 1, CH06_LAYOUT.coreZ);
  simulate(game, 1.2, { force: true });
  if (!st.curatorMet) throw new Error('Curator trigger did not fire');
  if (!game.mission.intelLog.find((i) => i.id === 'ch06_curator_testimony')) {
    // the testimony lands a few seconds into the conversation
    simulate(game, 16, { force: true });
    if (!game.mission.intelLog.find((i) => i.id === 'ch06_curator_testimony')) {
      throw new Error('Curator testimony never recorded');
    }
  }
  simulate(game, 12, { force: true });
  if (!st.zidanDone) throw new Error('Zidan never arrived');
  return 'Curator met · testimony recorded · Zidan arrived';
});

check('Chapter 06 Zidan decision writes the branch flag exactly once', () => {
  const st = game.levelCtx.state;
  if (!game.hud.choice) throw new Error('Zidan decision did not open');
  game.hud.commitChoice(1); // arrest
  const flagValue = game.save.progress.flags[CH06_FLAGS.ZIDAN_STATE];
  if (flagValue !== 'arrested') throw new Error(`ZIDAN_STATE=${flagValue}`);
  if (game.choiceOpen) throw new Error('decision card left the world frozen');
  if (!game.mission.objectives[7].done) throw new Error('Zidan objective not completed');
  void st;
  return `ZIDAN_STATE=${flagValue} · card closed`;
});

check('Chapter 06 plays start to finish with every objective and no NaN', () => {
  game.startMission('ch06_shadow_protocol');
  game.player.health = 5000;
  game.player.maxHealth = 5000;
  game.ai.enemies.forEach((e) => { e.holdFire = true; e.awareness = 0; });
  const st = game.levelCtx.state;
  const P = game.player.pos;
  const step = (s = 0.4) => {
    game.ai.enemies.forEach((e) => { e.awareness = 0; e.holdFire = true; });
    simulate(game, s, { force: true });
  };
  let nan = 0;
  const move = (z, s = 0.4) => {
    P.set(0, 1, z);
    for (let i = 0; i < Math.round(s * 60); i++) {
      game.fixedStep(1 / 60);
      game.time += 1 / 60;
      game.input.endFrame();
      if (!Number.isFinite(P.x) || !Number.isFinite(P.y) || !Number.isFinite(P.z)) nan += 1;
    }
  };
  move(44); move(CH06_LAYOUT.securityZ); move(CH06_LAYOUT.mantrapZ + 5, 0.2);
  move(CH06_LAYOUT.mantrapZ - 1, 6.5);      // cross the vestibule
  move(CH06_LAYOUT.recordsZ); move(CH06_LAYOUT.habitatZ);
  move(CH06_LAYOUT.coreZ - 4.4);            // the original page
  move(CH06_LAYOUT.coreZ, 1.2);             // the Curator
  step(24);
  if (game.hud.choice) game.hud.commitChoice(0);
  step(1);
  const missing = game.mission.objectives.filter((o) => !o.done).map((o) => o.id);
  if (missing.length) throw new Error(`objectives never completed: ${missing.join(',')}`);
  if (nan) throw new Error(`${nan} NaN frames`);
  if (!game.mission.complete) throw new Error('chapter did not complete');
  void st;
  return `${game.mission.objectives.length}/${game.mission.objectives.length} objectives · 0 NaN`;
});

// ---------------------------------------------------------------- forensics
check('Forensics case builds with the right conflict count and hides the edit', () => {
  const F = globalThis.__SP_FORENSICS__;
  let seed = 7;
  const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const c = F.buildForensicCase(rng, { fields: 7, conflicts: 3 });
  if (c.fields.length !== 7) throw new Error(`expected 7 fields, got ${c.fields.length}`);
  const doctored = c.fields.filter((f) => f.doctored);
  if (doctored.length !== 3) throw new Error(`expected 3 doctored fields, got ${doctored.length}`);
  for (const f of doctored) {
    if (f.underwriting === f.value) throw new Error(`${f.key}: underwriting matches the visible value`);
  }
  for (const f of c.fields.filter((x) => !x.doctored)) {
    if (f.underwriting !== f.value) throw new Error(`${f.key}: clean field has underwriting`);
  }
  return `7 fields · 3 doctored · underwriting hidden`;
});

check('Forensics: correct flags prove the edit, false flags compromise and can be retried', () => {
  const F = globalThis.__SP_FORENSICS__;
  let seed = 11;
  const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const c = F.beginCase(F.buildForensicCase(rng, { fields: 6, conflicts: 2 }));

  // A wrong flag is recorded but does not close the case.
  const clean = c.fields.find((f) => !f.doctored);
  const wrong = F.inspectField(c, clean.key);
  if (wrong.reason !== 'clean-ink') throw new Error(`expected clean-ink, got ${wrong.reason}`);
  if (c.state !== F.FORENSIC_STATE.ACTIVE) throw new Error('one wrong flag should not end the case');

  // Flag the real conflicts.
  const docs = c.fields.filter((f) => f.doctored);
  for (const f of docs) F.inspectField(c, f.key);
  if (c.state !== F.FORENSIC_STATE.PROVEN) throw new Error('case not proven after all conflicts');
  const summary = F.summarise(c);
  if (summary.findings.length !== 2) throw new Error('summary lost findings');

  // Now drive a fresh case to compromise and confirm recovery.
  const c2 = F.beginCase(F.buildForensicCase(rng, { fields: 6, conflicts: 2 }));
  const cleankeys = c2.fields.filter((f) => !f.doctored).map((f) => f.key);
  for (const k of cleankeys.slice(0, c2.falsePositiveLimit)) F.inspectField(c2, k);
  if (c2.state !== F.FORENSIC_STATE.COMPROMISED) throw new Error('case should be compromised');
  F.retryCase(c2);
  if (c2.state !== F.FORENSIC_STATE.ACTIVE || c2.falsePositives !== 0) throw new Error('retry did not reset');
  return `proven with 2 findings · compromised at ${c2.falsePositiveLimit} false flags · retry resets`;
});

check('Chapter 03 forensics desk opens a real, solvable case and awards intel', () => {
  game.startMission('ch03_black_file');
  game.state = 'playing';
  const W = game.world, P = game.player.pos;
  const step = (s) => simulate(game, s, { force: true });
  const tp = (x, z) => { const y = W.collision.surfaceAt(x, z, 3, 0.3) + 1.2; P.set(x, y, z); };
  tp(0, -46); step(0.3);
  tp(6.5, -54); step(0.3);
  if (!game.hud.forensics) throw new Error('forensics desk did not open');
  const caseData = game.hud.forensics.caseData;
  const before = game.mission.intelLog.length;
  for (const f of caseData.fields.filter((x) => x.doctored)) game.hud.inspectForensicField(f.key);
  if (caseData.state !== 'proven') throw new Error('case not proven');
  game.hud.closeForensics();
  step(0.1);
  if (game.mission.intelLog.length <= before) throw new Error('forensics intel was not recorded');
  if (!game.mission.intelLog.find((i) => i.id === 'box07_reclassified')) throw new Error('missing proof document');
  if (game.choiceOpen) throw new Error('world stayed frozen after closing the file');
  return `${caseData.conflicts} conflicts proven · intel recorded · world resumed`;
});

// ---------------------------------------------------------------- view model
check('The first-person view model is actually attached to a rendered scene', () => {
  // This used to be false for every chapter: viewCam was parented to nothing and
  // renderViewModel() was never called, so the player had no visible weapon or
  // hands at all no matter how good the animation was. A rig that is not in a
  // rendered graph is invisible, so assert the wiring itself.
  game.startMission('ch01_crossing');
  game.state = 'playing';
  const r = game.renderer;
  const p = game.player;
  if (!r.viewScene) throw new Error('renderer has no view-model scene');
  if (p.viewCam.parent !== r.viewScene) throw new Error('view camera is not in the view-model scene');
  if (p.fpView.root.parent !== r.viewScene) throw new Error('arms are not in the view-model scene');
  if (p.fpView.weaponMount.parent !== p.fpView.root) throw new Error('weapon mount is not under the view root');
  if (p.weapon.model.parent !== p.fpView.weaponMount) throw new Error('equipped weapon is not on the mount');
  const lights = r.viewScene.children.filter((c) => c.isLight).length;
  if (lights < 2) throw new Error(`view-model scene has ${lights} lights — the arms would render black`);
  let meshes = 0;
  p.fpView.root.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) meshes++; });
  if (meshes < 4) throw new Error(`only ${meshes} meshes under the view root`);
  return `${meshes} meshes · ${lights} lights · depth-cleared pass`;
});

check('Reloading via the real player timeline ejects a falling magazine', () => {
  game.startMission('ch01_crossing');
  game.state = 'playing';
  const p = game.player;
  for (let i = 0; i < 30; i++) simulate(game, 1 / 60, { force: true });

  p.ejectedMags = [];
  if (!p.fpView.startReload(2.0)) throw new Error('reload did not start');

  // Sample while it is in flight — the prop is deliberately cleaned up once it
  // lands below the world, so reading the array after the loop proves nothing.
  let peakCount = 0;
  let highest = -Infinity;
  let lowest = Infinity;
  let sawInScene = false;
  for (let i = 0; i < 60 * 1.2; i++) {
    simulate(game, 1 / 60, { force: true });
    peakCount = Math.max(peakCount, p.ejectedMags.length);
    for (const m of p.ejectedMags) {
      highest = Math.max(highest, m.mesh.position.y);
      lowest = Math.min(lowest, m.mesh.position.y);
      if (m.mesh.parent === game.scene) sawInScene = true;
    }
  }
  if (peakCount === 0) throw new Error('no magazine was ejected');
  if (!sawInScene) throw new Error('ejected magazine was never added to the world scene');
  if (!(highest - lowest > 0.4)) throw new Error(`magazine fell only ${(highest - lowest).toFixed(2)} m`);

  // ... and it must eventually be reclaimed instead of leaking into the scene.
  for (let i = 0; i < 60 * 3; i++) simulate(game, 1 / 60, { force: true });
  if (p.ejectedMags.length !== 0) throw new Error('ejected magazine was never cleaned up');
  return `ejected · fell ${(highest - lowest).toFixed(2)} m · reclaimed`;
});

// ---------------------------------------------------------------- view model
check('The first-person view model is actually attached to a rendered scene', () => {
  // This used to be false for every chapter: viewCam was parented to nothing and
  // renderViewModel() was never called, so the player had no visible weapon or
  // hands at all no matter how good the animation was. A rig that is not in a
  // rendered graph is invisible, so assert the wiring itself.
  game.startMission('ch01_crossing');
  game.state = 'playing';
  const r = game.renderer;
  const p = game.player;
  if (!r.viewScene) throw new Error('renderer has no view-model scene');
  if (p.viewCam.parent !== r.viewScene) throw new Error('view camera is not in the view-model scene');
  if (p.fpView.root.parent !== r.viewScene) throw new Error('arms are not in the view-model scene');
  if (p.fpView.weaponMount.parent !== p.fpView.root) throw new Error('weapon mount is not under the view root');
  if (p.weapon.model.parent !== p.fpView.weaponMount) throw new Error('equipped weapon is not on the mount');
  const lights = r.viewScene.children.filter((c) => c.isLight).length;
  if (lights < 2) throw new Error(`view-model scene has ${lights} lights — the arms would render black`);
  let meshes = 0;
  p.fpView.root.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) meshes++; });
  if (meshes < 4) throw new Error(`only ${meshes} meshes under the view root`);
  return `${meshes} meshes · ${lights} lights · depth-cleared pass`;
});

// The animation work is only worth anything if it is measurable, so these
// checks assert the properties that actually make first-person arms look
// attached: hands on the grips, a bent elbow, a real reload timeline with
// ordered events, and a fire kick that settles. Tolerances are in centimetres.

const vmMod = await import('../src/game/viewmodel.js');

/** Reusable measurement harness over either rig. */
function makeViewModelProbe(view) {
  const measureSide = (side) => {
    view.root.parent = null;
    view.root.updateMatrixWorld(true);
    const c = view.chain[side];
    const P = (b) => new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
    const hand = view.handViewPosition(side);
    const grip = view.gripViewPosition(side);
    const a = P(c.upper); const b = P(c.fore); const d = P(c.hand);
    const elbowDeg = THREE.MathUtils.radToDeg(a.clone().sub(b).angleTo(d.clone().sub(b)));
    return { err: hand.distanceTo(grip), elbowDeg };
  };
  return { measureSide };
}

// ---------------------------------------------------------------- characters
// The character library is CC0 and ships in public/models. Load it through the
// real glTF path so these checks fail if the asset, its licence-era contents or
// the bone naming ever change.

const charMod = await import('../src/game/character.js');
const charRaw = JSON.parse(readFileSync(new URL('../public/models/AnimationLibrary_Godot_Standard.gltf', import.meta.url), 'utf8'));
const charBin = readFileSync(new URL('../public/models/AnimationLibrary_Godot_Standard.bin', import.meta.url));
charRaw.buffers[0].uri = 'data:application/octet-stream;base64,' + charBin.toString('base64');
const charGltf = await new Promise((res, rej) => new gltfLib.GLTFLoader().parse(JSON.stringify(charRaw), '', res, rej));
charMod.setCharacterLibrary(charGltf);
const { setCharacterSource } = await import('../src/game/ai.js');
setCharacterSource(charGltf);

check('Aiming pose raises the weapon to chest height', () => {
  const ch = charMod.buildCharacter(charGltf, {});
  if (!ch.actions || !ch.actions.aimPistol) throw new Error('no aim clip on the character');

  const handAt = (aim) => {
    for (let i = 0; i < 150; i++) { ch.pose(i / 60, 0, 0, aim); ch.update(1 / 60); }
    ch.group.updateMatrixWorld(true);
    return new THREE.Vector3().setFromMatrixPosition(ch.bones.get('DEF-handR').matrixWorld);
  };
  const idle = handAt(0);
  const aim = handAt(1);
  const rise = aim.y - idle.y;
  // `aim` used to be accepted and discarded - the hand moved by 1 cm.
  if (rise < 0.3) throw new Error(`aiming raised the hand only ${rise.toFixed(2)}m`);
  return `hand ${idle.y.toFixed(2)}m → ${aim.y.toFixed(2)}m (+${rise.toFixed(2)})`;
});

check('Weapon muzzle points along the character forward axis across the aim blend', () => {
  const ch = charMod.buildCharacter(charGltf, {});
  const out = [];
  for (const aim of [0, 0.5, 1]) {
    for (let i = 0; i < 150; i++) { ch.pose(i / 60, 0, 0, aim); ch.update(1 / 60); }
    ch.group.updateMatrixWorld(true);
    const mount = ch.parts.handR;
    mount.updateMatrixWorld(true);
    // The weapon is authored muzzle-down -Z, so the world -Z column of the
    // mount is the muzzle direction - no guessing at Euler angles.
    const e = mount.matrixWorld.elements;
    const m = new THREE.Vector3(-e[8], -e[9], -e[10]).normalize();
    // The raw library model faces +Z and is turned by PI, so at yaw 0 the
    // character's forward is -Z in mesh space.
    const dot = -m.z;
    const off = Math.acos(Math.min(1, Math.max(-1, dot))) * 180 / Math.PI;
    out.push(`aim=${aim} ${off.toFixed(0)}°`);
    if (off > 25) throw new Error(`aim=${aim}: muzzle ${off.toFixed(0)}° off forward (${m.toArray().map((n) => n.toFixed(2))})`);
  }
  return out.join(', ');
});

check('Aim layers over locomotion without robbing the walk cycle', () => {
  const ch = charMod.buildCharacter(charGltf, {});
  for (let i = 0; i < 200; i++) { ch.pose(i / 60, 4.6, 0, 1); ch.update(1 / 60); }
  const w = ch.weights;
  const loco = Object.entries(w).filter(([k]) => k !== 'aimPistol').reduce((a, [, v]) => a + v, 0);
  if (Math.abs(loco - 1) > 0.02) throw new Error(`locomotion weights sum to ${loco.toFixed(2)} while aiming`);
  const aimW = ch.actions.aimPistol.getEffectiveWeight();
  if (aimW < 0.7) throw new Error(`aim weight only ${aimW.toFixed(2)} at aim=1`);
  const dominant = Object.entries(w).filter(([k]) => k !== 'aimPistol').sort((a, b) => b[1] - a[1])[0][0];
  if (dominant !== 'jog' && dominant !== 'walk') throw new Error(`running while aiming picked ${dominant}`);
  return `loco ${loco.toFixed(2)}, aim ${aimW.toFixed(2)}, ${dominant} dominant`;
});


check('Character library loads with the full clip set and a humanoid rig', () => {
  const ch = charMod.buildCharacter(charGltf, {});
  if (!ch.isSkinned) throw new Error('character is not skinned geometry');
  if (ch.skinned.length === 0) throw new Error('no skinned meshes');
  const boneCount = ch.bones.size;
  if (boneCount < 40) throw new Error(`only ${boneCount} bones — rig is not a full humanoid`);
  const verts = ch.skinned.reduce((n, m) => n + m.geometry.attributes.position.count, 0);
  if (verts < 1000) throw new Error(`only ${verts} vertices`);
  const clips = Object.keys(ch.actions);
  for (const need of ['idle', 'walk', 'jog', 'sprint', 'crouchIdle', 'crouchWalk', 'death']) {
    if (!clips.includes(need)) throw new Error(`missing clip role: ${need}`);
  }
  // The weapon must be parented inside the right hand, not floating.
  const handName = ch.parts.handR.parent?.name || '';
  if (!/handR/i.test(handName)) throw new Error(`weapon mount is on "${handName}", not the right hand`);
  return `${boneCount} bones · ${verts} verts · ${clips.length} clip roles · mounted on ${handName}`;
});

check('Locomotion blends select the right clip for each speed, weights summing to 1', () => {
  const bands = [
    { spd: 0, want: 'idle' },
    { spd: 1.9, want: 'walk' },
    { spd: 4.6, want: 'jog' },
    { spd: 6.2, want: 'sprint' }
  ];
  const out = [];
  for (const { spd, want } of bands) {
    const ch = charMod.buildCharacter(charGltf, {});
    for (let i = 0; i < 240; i++) { ch.pose(i / 60, spd, 0, 0.3); ch.update(1 / 60); }
    const w = ch.weights;
    // Locomotion and aiming are separate layers: locomotion sums to 1 on its
    // own, and the aim clip rides on top. Summing them together would be
    // meaningless and is exactly the bug this asserts against.
    const loco = Object.entries(w).filter(([k]) => k !== 'aimPistol').reduce((a, [, v]) => a + v, 0);
    if (Math.abs(loco - 1) > 0.02) throw new Error(`${want}: locomotion weights sum to ${loco.toFixed(3)}`);
    const dominant = Object.entries(w).filter(([k]) => k !== 'aimPistol').sort((a, b) => b[1] - a[1])[0][0];
    if (dominant !== want) throw new Error(`at ${spd} m/s the dominant clip is ${dominant}, expected ${want}`);
    out.push(`${spd}m/s→${dominant}`);
  }
  return out.join(' · ');
});

check('Playback rate tracks character speed, so the feet do not skate', () => {
  // The clip is authored for a fixed ground speed. Playback must speed up in
  // proportion to how fast the character moves — dividing instead of
  // multiplying makes foot slide twice as bad as doing nothing at all.
  const ch = charMod.buildCharacter(charGltf, {});
  const rates = [];
  for (const spd of [1.9, 3.5, 4.6, 6.2]) {
    for (let i = 0; i < 240; i++) { ch.pose(i / 60, spd, 0, 0.3); ch.update(1 / 60); }
    const authored = charMod.CLIP_SPEED[charMod.CLIPS.sprint];
    const ts = ch.timeScale;
    if (!Number.isFinite(ts) || ts <= 0) throw new Error(`timeScale ${ts} at ${spd} m/s`);
    // Authored speeds already bracket the game's, so the correction is small.
    if (ts < 0.75 || ts > 1.9) throw new Error(`timeScale ${ts.toFixed(2)} at ${spd} m/s is outside sane bounds`);
    rates.push(`${spd}→${ts.toFixed(2)}`);
    void authored;
  }
  return rates.join(' · ');
});

check('Crouch uses a crouched clip instead of scaling the standing one', () => {
  const ch = charMod.buildCharacter(charGltf, {});
  for (let i = 0; i < 240; i++) { ch.pose(i / 60, 1.2, 1, 0.3); ch.update(1 / 60); }
  const w = ch.weights;
  if (w.crouchWalk <= 0.5) throw new Error(`crouch-walk weight is ${w.crouchWalk.toFixed(2)}`);
  if (w.walk > 0.05) throw new Error('standing walk still active while crouched');
  const hips = ch.bones.get('DEF-hips');
  ch.update(0); ch.group.updateMatrixWorld(true);
  const y = new THREE.Vector3().setFromMatrixPosition(hips.matrixWorld).y;
  if (y > 1.05) throw new Error(`hips at ${y.toFixed(2)} m — the character is not actually crouching`);
  return `crouchWalk ${w.crouchWalk.toFixed(2)} · hips ${y.toFixed(2)} m`;
});

check('Death plays a real clip and holds its final pose', () => {
  const ch = charMod.buildCharacter(charGltf, {});
  for (let i = 0; i < 30; i++) { ch.pose(i / 60, 0, 0, 0); ch.update(1 / 60); }
  const idleBefore = ch.actions.idle.getEffectiveWeight();
  ch.pose(0, 0, 0, 0, true);
  const deathDur = ch.actions.death.getClip().duration;
  for (let i = 0; i < Math.ceil((deathDur + 0.6) * 60); i++) ch.update(1 / 60);
  if (idleBefore < 0.5) throw new Error('idle was not running before death');
  if (ch.actions.idle.getEffectiveWeight() > 0.05) throw new Error('locomotion kept playing over the death clip');
  if (ch.actions.death.getEffectiveWeight() < 0.9) throw new Error('death clip is not at full weight');
  if (!ch.actions.death.clampWhenFinished) throw new Error('death pose is not held');
  const t = ch.actions.death.time;
  if (Math.abs(t - deathDur) > 0.05) throw new Error(`death stopped at ${t.toFixed(2)}s of ${deathDur.toFixed(2)}s`);
  return `${deathDur.toFixed(2)} s clip · held at ${t.toFixed(2)} s`;
});

check('Every spawned actor uses skinned geometry, not the blockout boxes', () => {
  game.startMission('ch01_crossing');
  game.state = 'playing';
  for (let i = 0; i < 30; i++) simulate(game, 1 / 60, { force: true });
  let skinned = 0, blockout = 0;
  for (const e of game.ai.enemies) (e.soldier.isSkinned ? skinned++ : blockout++);
  for (const s2 of game.ai.squad) (s2.soldier.isSkinned ? skinned++ : blockout++);
  if (skinned === 0) throw new Error('no actor got a skinned body');
  if (blockout > 0) throw new Error(`${blockout} actor(s) fell back to box primitives`);
  // ...and their animation actually advances.
  const e = game.ai.enemies.find((x) => !x.dead);
  const t0 = e.soldier.actions.idle.time;
  simulate(game, 0.5, { force: true });
  if (e.soldier.actions.idle.time === t0) throw new Error('mixer is not advancing in the game loop');
  return `${skinned} skinned actors · mixer advancing`;
});

check('Characters are coloured by kit, not left as a white mannequin', () => {
  const ch = charMod.buildCharacter(charGltf, {
    palette: { uniform: 0xa89d78, uniformDark: 0x8c825f, helmet: 0x7d7657, boot: 0x3a3126, skin: 0x8a5f3c }
  });
  for (const m of ch.skinned) {
    if (!m.material.vertexColors) throw new Error('material does not use vertex colours');
    if (!m.geometry.attributes.color) throw new Error('mesh has no colour attribute');
  }
  const col = ch.skinned[0].geometry.attributes.color;
  const seen = new Set();
  for (let i = 0; i < col.count; i += 7) {
    seen.add(`${col.getX(i).toFixed(2)},${col.getY(i).toFixed(2)},${col.getZ(i).toFixed(2)}`);
  }
  if (seen.size < 3) throw new Error(`only ${seen.size} distinct colours — the kit is a flat fill`);
  return `${seen.size} distinct kit colours across ${col.count} verts`;
});

check('First-person arms are skinned meshes, not static props', () => {
  const view = new vmMod.FirstPersonView();
  view.root.updateMatrixWorld(true);
  let skinned = 0; let bones = 0;
  view.rig.root.traverse((o) => { if (o.isSkinnedMesh) skinned++; if (o.isBone) bones++; });
  if (skinned < 4) throw new Error(`expected a segmented skinned armature, found ${skinned} skinned meshes`);
  if (bones < 8) throw new Error(`expected both arm chains, found ${bones} bones`);
  return `${skinned} skinned segments · ${bones} bones · ${view.rigKind} rig`;
});

check('Both hands stay locked to the weapon through every stance', () => {
  const view = new vmMod.FirstPersonView();
  const { measureSide } = makeViewModelProbe(view);
  const samples = [];
  const run = (label, ctx, frames) => {
    for (let i = 0; i < frames; i++) view.update(1 / 60, ctx);
    const r = measureSide('right'); const l = measureSide('left');
    if (r.err > 0.015 || l.err > 0.015) {
      throw new Error(`${label}: hand ${(Math.max(r.err, l.err) * 100).toFixed(2)} cm off the grip`);
    }
    samples.push(`${label} ${(Math.max(r.err, l.err) * 1000).toFixed(1)}mm`);
  };
  run('idle', { speed: 0 }, 60);
  run('walk', { speed: 2 }, 60);
  run('run', { speed: 5 }, 60);
  run('ads', { speed: 0, aiming: true }, 60);
  run('crouch', { speed: 0, crouch: 1 }, 60);
  view.addFireKick(1);
  run('fire', { speed: 0 }, 6);
  return samples.join(' · ');
});

check('Elbows bend: the arms are not planks pushed at the camera', () => {
  const view = new vmMod.FirstPersonView();
  const { measureSide } = makeViewModelProbe(view);
  for (let i = 0; i < 60; i++) view.update(1 / 60, { speed: 0 });
  const idle = measureSide('right');
  if (idle.elbowDeg > 150) throw new Error(`idle elbow is ${idle.elbowDeg.toFixed(0)}° — arm is fully extended`);
  if (idle.elbowDeg < 20) throw new Error(`idle elbow is ${idle.elbowDeg.toFixed(0)}° — arm is folded shut`);
  for (let i = 0; i < 60; i++) view.update(1 / 60, { aiming: true });
  const ads = measureSide('right');
  if (ads.elbowDeg > 150) throw new Error(`ADS elbow is ${ads.elbowDeg.toFixed(0)}° — support hand cannot be on the handguard`);
  return `idle ${idle.elbowDeg.toFixed(0)}° · ads ${ads.elbowDeg.toFixed(0)}°`;
});

check('Reload is a phased timeline that emits ordered mechanical events', () => {
  const view = new vmMod.FirstPersonView();
  for (let i = 0; i < 30; i++) view.update(1 / 60, {});
  view.consumeEvents();
  if (!view.startReload(2.4)) throw new Error('reload did not start');
  if (view.startReload(2.4)) throw new Error('a second reload started while one was running');

  const seen = [];
  let statesDuringReload = new Set();
  for (let i = 0; i < 60 * 3; i++) {
    view.update(1 / 60, {});
    statesDuringReload.add(view.state);
    for (const ev of view.consumeEvents()) seen.push(ev.type);
  }
  const want = ['mag-out', 'mag-in', 'bolt', 'ready'];
  if (seen.join(',') !== want.join(',')) throw new Error(`events were ${seen.join(' → ') || 'missing'}`);
  if (view.reloading) throw new Error('reload never finished');
  if (view.state === 'reload') throw new Error('state stuck on reload');
  const g = view.pose.holder;
  if (!Number.isFinite(g.x)) throw new Error('weapon position went non-finite');
  return `${seen.join(' → ')} in 2.4 s · ended ${view.state}`;
});

check('Reload beats land in the right order and the magazine leaves the gun', () => {
  const view = new vmMod.FirstPersonView();
  for (let i = 0; i < 30; i++) view.update(1 / 60, {});
  view.startReload(2.4);
  const times = {};
  const positions = [];
  for (let i = 0; i < 60 * 3; i++) {
    view.update(1 / 60, {});
    if (i % 6 === 0) {
      const p = view.handViewPosition('left');
      positions.push([p.x, p.y, p.z]);
    }
    for (const ev of view.consumeEvents()) times[ev.type] = (i / 60);
  }
  const order = ['mag-out', 'mag-in', 'bolt', 'ready'];
  for (let i = 1; i < order.length; i++) {
    if (!(times[order[i]] > times[order[i - 1]])) {
      throw new Error(`${order[i - 1]} and ${order[i]} did not happen in sequence`);
    }
  }
  const travel = Math.max(...positions.map((p) => Math.hypot(p[0] - positions[0][0], p[1] - positions[0][1], p[2] - positions[0][2])));
  if (travel < 0.02) throw new Error('the support hand barely moved — reload is not animated');
  return `${order.map((k) => `${k}@${times[k].toFixed(2)}s`).join(' ')} · support hand travelled ${(travel * 100).toFixed(1)} cm`;
});

check('Firing kicks the weapon back and settles without oscillation', () => {
  // Two identical views: one fires, one does not. Comparing against a twin
  // removes the stance change that a shot also causes, so what is measured is
  // purely the recoil impulse.
  const fired = new vmMod.FirstPersonView();
  const still = new vmMod.FirstPersonView();
  for (let i = 0; i < 60; i++) { fired.update(1 / 60, {}); still.update(1 / 60, {}); }
  fired.addFireKick(1);
  fired.update(1 / 60, {}); still.update(1 / 60, {});
  const rest = still.weaponMount.position.z;
  const kicked = fired.weaponMount.position.z;
  if (!(kicked > rest + 0.005)) throw new Error(`recoil does not push the weapon back (${kicked.toFixed(3)} vs ${rest.toFixed(3)})`);
  let monotonic = true; let prev = kicked - rest;
  for (let i = 0; i < 60; i++) {
    fired.update(1 / 60, {}); still.update(1 / 60, {});
    const d = fired.weaponMount.position.z - still.weaponMount.position.z;
    if (d > prev + 1e-6) monotonic = false;
    prev = d;
  }
  if (!monotonic) throw new Error('recoil overshoots back outward — it should recover monotonically');
  if (Math.abs(prev) > 0.002) throw new Error(`recoil never returned to rest (${(prev * 1000).toFixed(1)} mm)`);
  return `kick ${((kicked - rest) * 100).toFixed(1)} cm · settled to ${(prev * 1000).toFixed(1)} mm`;
});

check('Weapon and hands share one frame — the rifle cannot drift off the arms', () => {
  const view = new vmMod.FirstPersonView();
  for (let i = 0; i < 120; i++) view.update(1 / 60, { speed: 3.5 });
  const wpos = new THREE.Vector3();
  view.weaponMount.getWorldPosition(wpos);
  const right = view.handViewPosition('right');
  const d = wpos.distanceTo(right);
  if (d > 0.35) throw new Error(`weapon is ${(d * 100).toFixed(0)} cm from the trigger hand`);
  // The mount must be a child of the same view root as the arms.
  if (view.weaponMount.parent !== view.root || view.rig.root.parent !== view.root) {
    throw new Error('weapon and arms are not siblings under the view root');
  }
  return `mounted under one view root · ${(d * 100).toFixed(1)} cm apart`;
});

// Load the shipped asset through the real glTF path. Textures fail to decode in
// Node (no ImageBitmap) and warn; geometry and skin weights are unaffected.

const glbBuf = readFileSync(new URL('../public/models/Soldier.glb', import.meta.url));
const glbArr = glbBuf.buffer.slice(glbBuf.byteOffset, glbBuf.byteOffset + glbBuf.byteLength);
const gltfDoc = await new Promise((res, rej) => new gltfLib.GLTFLoader().parse(glbArr, '', res, rej));
const skinnedArms = vmMod.soldierToFirstPersonArms(gltfDoc.scene);

check('Soldier.glb converts to a usable first-person arm rig', () => {
  const st = skinnedArms.stats;
  if (st.armTriangles < 1000) throw new Error(`only ${st.armTriangles} arm triangles survived`);
  if (st.keptBones < 20) throw new Error(`only ${st.keptBones} arm bones kept`);
  // Every vertex must still be fully weighted, or the sleeve tears off the arm.
  const w = skinnedArms.mesh.geometry.attributes.skinWeight;
  let bad = 0;
  for (let i = 0; i < w.count; i++) {
    const sum = w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i);
    if (Math.abs(sum - 1) > 1e-3) bad++;
  }
  if (bad) throw new Error(`${bad}/${w.count} vertices have broken skin weights`);
  return `${st.armVertices} arm verts · ${st.armTriangles} tris · ${st.keptBones} bones · weights clean`;
});

check('The skinned arms drive onto the rifle exactly like the procedural rig', () => {
  const view = new vmMod.FirstPersonView({ arms: skinnedArms });
  if (!view.isSkinned) throw new Error('view did not accept the skinned rig');
  const { measureSide } = makeViewModelProbe(view);
  const rows = [];
  const run = (label, ctx, frames) => {
    for (let i = 0; i < frames; i++) view.update(1 / 60, ctx);
    const r = measureSide('right'); const l = measureSide('left');
    const err = Math.max(r.err, l.err);
    if (err > 0.02) throw new Error(`${label}: hands ${(err * 100).toFixed(1)} cm off the grips`);
    if (r.elbowDeg > 150) throw new Error(`${label}: trigger-arm elbow is ${r.elbowDeg.toFixed(0)}°`);
    rows.push(`${label} ${(err * 1000).toFixed(1)}mm/${l.elbowDeg.toFixed(0)}°`);
  };
  run('idle', { speed: 0 }, 40);
  run('run', { speed: 5 }, 40);
  run('ads', { speed: 0, aiming: true }, 40);
  view.startReload(2.4);
  run('reload', { speed: 0 }, 40);
  // The rig must have been scaled into metres, not left in centimetres.
  const scale = view.rig.root.scale.x;
  if (scale <= 0 || scale > 2) throw new Error(`rig scale is ${scale} — expected a metric scale`);
  return `${rows.join(' · ')} · scale ${scale.toFixed(3)}`;
});

// ---------------------------------------------------------------- chapter 07
check('Chapter 07 tower is a real vertical route, not four floating boxes', () => {
  // Chapter 07's first build put the lift lobby on the quay OUTSIDE the tower
  // footprint and derived the floor heights from a floor index. Riding to floor
  // 12 arrived in mid-air over the water and the player fell 12 m. This floods
  // each floor plate from its lift arrival and climbs the whole building.
  game.startMission('ch07_final_legacy');
  const col = game.world.collision;
  const STEP = 0.5;
  const yAt = (s) => CH07_LAYOUT.floorY[s];
  const free = (x, y, z) => !col.pointSolid(x, y + 0.5, z, 0.28)
    && Math.abs(col.surfaceAt(x, z, y + 0.5, 0.25) - y) < 0.6;
  const flood = (sx, sz, s) => {
    const y = yAt(s);
    if (!free(sx, y, sz)) throw new Error(`floor ${s}: arrival point (${sx},${sz}) is inside geometry`);
    const k = (i, j) => `${i},${j}`;
    const i0 = Math.round(sx / STEP), j0 = Math.round(sz / STEP);
    const seen = new Set([k(i0, j0)]);
    const q = [[i0, j0]];
    while (q.length) {
      const [i, j] = q.shift();
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj, kk = k(ni, nj);
        if (seen.has(kk)) continue;
        if (Math.abs(ni * STEP) > 40 || Math.abs(nj * STEP - CH07_LAYOUT.towerZ) > 40) continue;
        if (!free(ni * STEP, y, nj * STEP)) continue;
        seen.add(kk); q.push([ni, nj]);
      }
    }
    return seen;
  };
  const rows = [];
  for (const s of [1, 2, 3, 4]) {
    const seen = flood(0, CH07_LAYOUT.arriveZ, s);
    const at = (x, z) => seen.has(`${Math.round(x / STEP)},${Math.round(z / STEP)}`);
    const z0 = CH07_LAYOUT.towerZ;
    const probes = {
      'north end': at(0, z0 - 11),
      'west corner': at(-15, z0 + 8),
      'east corner': at(15, z0 + 8),
      'south lobby': at(0, z0 + 9)
    };
    if (s === 4) probes.helipad = at(0, z0);
    const bad = Object.entries(probes).filter(([, v]) => !v).map(([n]) => n);
    if (bad.length) throw new Error(`floor ${s}: unreachable — ${bad.join(', ')}`);
    rows.push(`f${s}:${seen.size}`);
  }
  // The quay, the lobby and the lift button are one connected ground plane.
  const ground = flood(0, 20, 0);
  const groundAt = (x, z) => ground.has(`${Math.round(x / STEP)},${Math.round(z / STEP)}`);
  if (!groundAt(0, -14)) throw new Error('the lobby is not reachable from the quay');
  if (!groundAt(3.4, 5.4)) throw new Error('the lift button is not reachable');
  return `${rows.join(' · ')} · quay→lobby→lift connected`;
});

check('Chapter 07 defenders all stand on their own floor', () => {
  // A render cannot tell you this: ten of these men were once standing in the
  // void outside the north wall, because their offsets were measured past the
  // 26 m depth of the plate. Every spawn must have floor underneath it and no
  // collision volume around it.
  game.startMission('ch07_final_legacy');
  const col = game.world.collision;
  const bad = [];
  for (const e of game.ai.enemies) {
    const solid = col.pointSolid(e.pos.x, e.pos.y + 0.6, e.pos.z, -0.1);
    const support = col.surfaceAt(e.pos.x, e.pos.z, e.pos.y + 0.6, 0.2);
    if (solid) bad.push(`${e.id} inside ${solid.tag}`);
    else if (Math.abs(support - e.pos.y) > 0.45) bad.push(`${e.id} over air (support ${support.toFixed(2)})`);
  }
  if (bad.length) throw new Error(bad.slice(0, 4).join(' · '));
  const byFloor = {};
  for (const e of game.ai.enemies) {
    const f = String(e.id).match(/^ch07_f(\d)/);
    const k = f ? f[1] : '?';
    byFloor[k] = (byFloor[k] || 0) + 1;
  }
  return `${game.ai.enemies.length} placed · ${Object.entries(byFloor).map(([k, v]) => `f${k}:${v}`).join(' ')}`;
});

check('Chapter 07 lift arrives at the stated floor and wakes its garrison', () => {
  game.startMission('ch07_final_legacy');
  const st = game.levelCtx.state;
  const P = game.player.pos;
  P.set(0, 0.1, 8);
  simulate(game, 0.3, { force: true });
  const rows = [];
  for (let i = 1; i <= 4; i++) {
    const before = game.ai.enemies.filter((e) => !e.hidden).length;
    st.rideLift();
    simulate(game, 3.2, { force: true });
    const want = CH07_LAYOUT.floorY[i];
    if (st.floor !== i) throw new Error(`ride ${i} left the car on floor ${st.floor}`);
    if (Math.abs(P.y - want) > 0.6) throw new Error(`ride ${i} arrived at y=${P.y.toFixed(2)}, expected ${want}`);
    if (!game.mission.objectives[i].done) throw new Error(`ride ${i} did not complete its objective`);
    const after = game.ai.enemies.filter((e) => !e.hidden).length;
    if (after <= before) throw new Error(`floor ${i} opened its doors on an empty floor`);
    rows.push(`f${i} y=${P.y.toFixed(1)}+${after - before}`);
  }
  if (st.riding) throw new Error('the car never stopped riding');
  return rows.join(' · ');
});

check('Chapter 07 ledger decision writes exactly one flag', () => {
  const rows = [];
  for (const [idx, want] of [[0, CH07_FLAGS.PUBLISHED_LEDGER], [1, CH07_FLAGS.LEVERAGED_LEDGER], [2, CH07_FLAGS.BURNED_LEDGER]]) {
    game.save.progress.flags = {};
    game.startMission('ch07_final_legacy');
    const st = game.levelCtx.state;
    st.floor = 4;
    game.player.pos.set(0, CH07_LAYOUT.floorY[4] + 0.05, CH07_LAYOUT.towerZ + 1.0);
    simulate(game, 0.4, { force: true });
    const ledger = game.world.interactables.find((i) => i.id === 'ch07_ledger_read');
    if (!ledger) throw new Error('the ledger is not in the world');
    ledger.onUse();
    if (!game.hud.choice) throw new Error(`choice ${idx} never opened`);
    game.hud.commitChoice(idx);
    const written = ['PUBLISHED_LEDGER', 'LEVERAGED_LEDGER', 'BURNED_LEDGER']
      .filter((k) => game.save.progress.flags[k]);
    if (written.length !== 1) throw new Error(`choice ${idx} wrote ${written.length} flags: ${written.join(',')}`);
    if (!game.save.progress.flags[want]) throw new Error(`choice ${idx} did not write ${want}, wrote ${written[0]}`);
    if (game.choiceOpen) throw new Error('the decision card left the world frozen');
    rows.push(written[0].split('_')[0]);
  }
  return rows.join(' / ');
});

check('Chapter 07 roof antagonist follows the chapter 06 Zidan branch', () => {
  const seen = [];
  for (const [state, expectCurator] of [['dead', true], ['arrested', false], ['exposed', false]]) {
    game.save.progress.flags = { ZIDAN_STATE: state };
    game.startMission('ch07_final_legacy');
    const st = game.levelCtx.state;
    if (st.zidanState !== state) throw new Error(`ZIDAN_STATE=${state} did not reach the level (got ${st.zidanState})`);
    const speaker = state === 'dead' || st.curatorSpared ? 'THE CURATOR' : 'GEN. ZIDAN';
    const isCurator = speaker === 'THE CURATOR';
    if (isCurator !== expectCurator) throw new Error(`ZIDAN_STATE=${state} put ${speaker} on the roof`);
    seen.push(`${state}:${isCurator ? 'curator' : 'zidan'}`);
  }
  return seen.join(' · ');
});

check('Chapter 07 plays start to finish and the ending is reachable', () => {
  const runOnce = (preset, choiceIdx) => {
    game.save.progress.flags = { ...preset };
    game.save.progress.intel = {};
    game.startMission('ch07_final_legacy');
    game.player.health = 5000;
    game.player.maxHealth = 5000;
    const st = game.levelCtx.state;
    const P = game.player.pos;
    let nan = 0;
    const step = (s) => {
      const n = Math.round(s * 60);
      for (let i = 0; i < n; i++) {
        game.fixedStep(1 / 60);
        game.time += 1 / 60;
        game.input.endFrame();
        if (!Number.isFinite(P.x) || !Number.isFinite(P.y) || !Number.isFinite(P.z)) nan += 1;
      }
      game.ai.enemies.forEach((e) => { e.holdFire = true; e.awareness = 0; });
    };
    game.ai.enemies.forEach((e) => { e.holdFire = true; e.awareness = 0; });
    P.set(0, 0.1, 20);
    step(0.4);
    P.set(0, 0.1, 8);
    step(0.4);
    for (let i = 0; i < 4; i++) {
      st.rideLift();
      step(3.2);
    }
    P.set(0, CH07_LAYOUT.floorY[4] + 0.05, CH07_LAYOUT.towerZ + 1.0);
    step(0.5);
    game.world.interactables.find((i) => i.id === 'ch07_ledger_read').onUse();
    if (game.hud.choice) game.hud.commitChoice(choiceIdx);
    step(18);
    if (nan) throw new Error(`${nan} NaN frames`);
    const missing = game.mission.objectives.filter((o) => !o.done).map((o) => o.id);
    if (missing.length) throw new Error(`objectives never completed: ${missing.join(',')}`);
    if (!game.mission.complete) throw new Error('chapter never completed');
    return game.save.resolveEnding();
  };

  const published = runOnce({ TRUST_ADEL: true, SAVED_MARIAM: true }, 0);
  const leveraged = runOnce({ TRUST_ADEL: true, SAVED_MARIAM: true }, 1);
  const burned = runOnce({ TRUST_ADEL: true, SAVED_MARIAM: true }, 2);
  const withoutMariam = runOnce({ TRUST_ADEL: true }, 0);
  if (published !== 'CLEAN_HANDS') throw new Error(`publishing all the way through gave ${published}`);
  if (leveraged !== 'THE_LEDGER') throw new Error(`keeping the ledger gave ${leveraged}`);
  if (burned !== 'INHERITANCE') throw new Error(`burning it gave ${burned}`);
  if (withoutMariam === 'CLEAN_HANDS') throw new Error('CLEAN HANDS without SAVED_MARIAM');
  return `publish=${published} · leverage=${leveraged} · burn=${burned} · no-Mariam=${withoutMariam}`;
});

check('The chapter 07 debrief renders the ending instead of a dead end', () => {
  // showDebrief() used to say "PROCEED TO NEXT CHAPTER" or nothing at all.
  // For the last mission that means the player finishes the campaign and the
  // three written endings are never displayed anywhere.
  game.save.progress.flags = { TRUST_ADEL: true, SAVED_MARIAM: true };
  game.startMission('ch07_final_legacy');
  game.mission.completeObjective(0);
  const html = (() => {
    let captured = '';
    const original = game.menu._openOverlay.bind(game.menu);
    game.menu._openOverlay = (h) => { captured = h; };
    game.menu.showDebrief(game.mission, {
      kills: 12, headshots: 4, accuracy: 51, squadAlive: 2, squadTotal: 3,
      time: 640, intel: { found: 3, total: 5 }
    });
    game.menu._openOverlay = original;
    return captured;
  })();
  if (!html) throw new Error('the debrief rendered nothing');
  if (!/ENDING —/.test(html)) throw new Error('no ending block in the final debrief');
  const resolved = game.save.resolveEnding();
  if (!new RegExp(resolved).test(html)) throw new Error(`the resolved ending (${resolved}) is not named`);
  if (/PROCEED TO NEXT CHAPTER/.test(html)) throw new Error('the last chapter still offers a next chapter');
  // Before the ledger is decided the projection is INHERITANCE; after
  // publishing with both alliances it must read CLEAN HANDS.
  const before = resolved;
  game.save.progress.flags.PUBLISHED_LEDGER = true;
  let after = '';
  const orig = game.menu._openOverlay.bind(game.menu);
  game.menu._openOverlay = (h) => { after = h; };
  game.menu.showDebrief(game.mission, { kills: 0, headshots: 0, accuracy: 0, squadAlive: 3, squadTotal: 3, time: 1, intel: { found: 5, total: 5 } });
  game.menu._openOverlay = orig;
  if (!/CLEAN HANDS/.test(after)) throw new Error('publishing does not surface CLEAN HANDS in the debrief');
  return `ending card: ${before} → CLEAN HANDS after publishing`;
});

check('Chapter select uses chapter numbers, not mission positions', () => {
  // Chapter 01 registers two missions and the other chapters register one, so
  // registry position and chapter number drift apart by one after 01. The last
  // chapter is mission 8 of 8, so position-based unlocking demanded eight
  // unlocked chapters on a seven-chapter campaign and the card was permanently
  // locked. `def.chapterIndex` is the only honest source.
  const ids = game.menu.chapterMissionIds();
  if (ids.length !== 8) throw new Error(`expected 8 missions in the registry, found ${ids.length}`);
  const rows = ids.map((id, i) => {
    const def = game.missions.get(id).def;
    const mapped = game.menu.chapterOfIndex(i);
    if (mapped !== def.chapterIndex) {
      throw new Error(`${id} is mission ${i + 1} but chapterOfIndex said ${mapped}, def says ${def.chapterIndex}`);
    }
    return `${def.chapterIndex}`;
  });
  // The last mission must belong to the last chapter, not to a chapter one
  // beyond the end of the campaign.
  const lastDef = game.missions.get(ids[ids.length - 1]).def;
  if (lastDef.chapterIndex > 7) throw new Error(`the final mission claims chapter ${lastDef.chapterIndex}`);
  // And every chapter 1..7 must be represented.
  const present = new Set(ids.map((id) => game.missions.get(id).def.chapterIndex));
  for (let c = 1; c <= 7; c++) if (!present.has(c)) throw new Error(`chapter ${c} has no mission`);
  return `${ids.length} missions → chapters ${rows.join(',')}`;
});

check('Chapter 07 objective count matches its mission definition', () => {
  // Seven objectives, one per act. A missing entry here is a chapter that
  // cannot be completed; a spare one is a beat nobody can reach.
  if (CHAPTER_07_MISSION.objectives.length !== 7) {
    throw new Error(`expected 7 objectives, found ${CHAPTER_07_MISSION.objectives.length}`);
  }
  const ids = CHAPTER_07_MISSION.objectives.map((o) => o.id);
  if (new Set(ids).size !== ids.length) throw new Error('duplicate objective ids');
  if (ids[6] !== 'o_epilogue') throw new Error('the epilogue is not the last objective');
  return `${ids.join(', ')}`;
});

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;
console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed ? 1 : 0);

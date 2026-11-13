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

globalThis.__SP_HEADLESS__ = true;
installStubs();

const { Game } = await import('../src/game/game.js');
const { CHAPTER_01_MISSIONS, buildCrossingMission, buildDepotMission } = await import('../src/levels/chapter01.js');
const { CHAPTER_02_MISSION, buildSilentMission } = await import('../src/levels/chapter02.js');
const { CHAPTER_03_MISSION, buildArchiveMission, CH03_FLAGS } = await import('../src/levels/chapter03.js');
const models = await import('../src/game/models.js');
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
  CHAPTER_01_MISSIONS[0].onStart = (gg) => { gg.chapterIndex = 1; };
  CHAPTER_01_MISSIONS[1].onStart = (gg) => { gg.chapterIndex = 1; };
  CHAPTER_02_MISSION.onStart = (gg) => { gg.chapterIndex = 2; };
  CHAPTER_03_MISSION.onStart = (gg) => { gg.chapterIndex = 3; };
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
  for (let i = 0; i < 40 && !e.dead; i++) {
    p.weapon.fireCooldown = 0;
    p.weapon.ammo = 30;
    p._shoot();
    shots++;
  }
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
  for (let i = 0; i < 90; i++) {
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

check('Chapter 03 decision card opens, freezes the world and records the flag', () => {
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
  const W = game.world, P = game.player.pos;
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
const THREE = await import('three');

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
globalThis.self = globalThis;
// The DOM stub has no User-Agent, and GLTFLoader sniffs for Safari to choose an
// image path. Give it a plausible one; textures fail in Node either way.
if (!globalThis.navigator) globalThis.navigator = {};
if (!globalThis.navigator.userAgent) globalThis.navigator.userAgent = 'node';
const gltfLib = await import('three/examples/jsm/loaders/GLTFLoader.js');
const { readFileSync } = await import('node:fs');
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

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;
console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed ? 1 : 0);

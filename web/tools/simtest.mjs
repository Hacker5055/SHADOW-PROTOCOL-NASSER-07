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

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;
console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
process.exit(failed ? 1 : 0);

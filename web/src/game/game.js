/**
 * SHADOW PROTOCOL — Game
 * Owns the frame loop and the systems: renderer, audio, input, player, world,
 * AI, HUD, mission, save. Missions are registered as builder functions and are
 * created/loaded/checkpointed through this object.
 */
import * as THREE from 'three';
import { Renderer } from '../engine/renderer.js';
import { AudioEngine } from '../engine/audio.js';
import { Input } from '../engine/input.js';
import { Player } from './player.js';
import { World } from './world.js';
import { AIDirector } from './ai.js';
import { HUD } from '../ui/hud.js';
import { Mission } from './mission.js';
import { SaveSystem } from './save.js';
import { Menu } from '../ui/menu.js';

const MAX_GRENADES = 4;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.time = 0;
    this.paused = true;
    this.state = 'menu'; // menu | briefing | playing | paused | dead | complete
    this.difficulty = 'normal';
    this.era = '1973';
    this.usingOptic = false;
    this.missions = new Map();
    this.projectiles = [];
    this.frameCount = 0;
    this.lastFrame = performance.now();
    this.accumulator = 0;
    this.fixedDt = 1 / 60;
    this.pendingMission = null;

    this.renderer = new Renderer(canvas);
    this.audio = new AudioEngine();
    this.input = new Input(canvas);
    this.save = new SaveSystem(this);
    this.difficulty = this.save.progress.difficulty || 'normal';
    this.hud = new HUD(this);
    this.mission = new Mission(this);
    this.settings = this.save.settings;
    this.applySettings();
    this.input.toggleCrouch = this.settings.toggleCrouch;
    this.input.toggleSprint = this.settings.toggleSprint;

    this.world = new World(this.renderer);
    this.ai = new AIDirector(this);
    this.player = null;

    this.menu = new Menu(this);

    this.input.onLockChange((locked) => {
      if (!locked && this.state === 'playing' && !this.suppressPause) {
        this.pause();
      }
    });

    this.onPlayerDeath = this.onPlayerDeath.bind(this);
    this.onMissionComplete = this.onMissionComplete.bind(this);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (this.state === 'playing') this.pause();
        else if (this.state === 'paused') this.resume();
      }
      if (e.code === 'Tab' && (this.state === 'playing')) {
        const on = this.hud.toggleObjectives();
        this.mission.allowSave = !on;
      }
    });

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  applySettings() {
    const s = this.save.settings;
    this.settings = s;
    this.input.sensitivity = s.sensitivity;
    this.input.invertY = s.invertY;
    this.input.toggleCrouch = s.toggleCrouch;
    this.input.toggleSprint = s.toggleSprint;
    this.audio.setVolume('master', s.master);
    this.audio.setVolume('sfx', s.sfx);
    this.audio.setVolume('music', s.music);
    this.audio.setVolume('voice', s.voice);
    document.documentElement.style.setProperty('--ui-scale', String(s.hudScale || 1));
    if (this.player) {
      this.player.fovBase = s.fov;
      this.player.viewCam.fov = s.fov;
    }
    this.renderer.postMat.uniforms.uGrain.value = s.filmGrain ? 1 : 0;
  }

  registerMission(def, builder) {
    this.missions.set(def.id, { def, builder });
  }

  // ------------------------------------------------------------------ flow
  startMission(id, { fromCheckpoint = false } = {}) {
    const entry = this.missions.get(id);
    if (!entry) { console.error('Unknown mission', id); return; }
    const { def, builder } = entry;

    this.audio.init();
    this.audio.resume();

    // tear down
    this.ai.reset();
    if (this.world) this.world.dispose();
    this.renderer.scene.remove(this.world.group);
    this.projectiles = [];
    this.hud.reset();

    this.era = def.era;
    this.world = new World(this.renderer);
    this.renderer.scene.add(this.world.group);
    this.renderer.setEra(def.era);
    this.renderer.setNVG(0);
    this.renderer.setFade(0);
    this.audio.setAmbience(def.era === '1973' ? 0.5 : 0.32);
    this.ai = new AIDirector(this);

    this.mission.load(def);

    // player
    this.player = new Player(this, {
      era: def.era,
      loadout: def.loadout
    });
    this.player.hasNVG = !!def.nvg;
    this.player.fovBase = this.settings.fov;
    this.player.viewCam.fov = this.settings.fov;

    // build the level (registers spawn manifests into world.*)
    const ctx = builder(this, this.world);
    this.levelCtx = ctx;

    // instantiate AI actors from the level's spawn manifests
    this.ai.spawnEnemies(this.world.enemySpawns);
    this.ai.spawnSquad(this.world.friendSpawns);

    const cp = fromCheckpoint ? this.save.getCheckpoint(def.id) : null;
    const spawn = cp ? cp.pos : def.start;
    this.player.reset(spawn, cp ? cp.yaw : (def.startYaw || 0));
    if (cp) {
      this.mission.restore({
        objectives: cp.objectives,
        intelFound: cp.intelFound,
        intelLog: cp.intelLog
      });
      if (cp.health) this.player.health = Math.max(35, cp.health);
      if (cp.weaponIndex != null) this.player._equipWeapon(Math.min(cp.weaponIndex, this.player.weapons.length - 1));
    }

    this.hud.setEraSkin(def.era);
    this.hud.show(true);
    this.hud.setSquad(this.ai.squad);
    this.state = 'playing';
    this.paused = false;
    this.time = 0;
    this.input.enabled = true;
    this.menu.hideAll();
    this.hud.showChapterCard({
      era: def.cardEra,
      num: def.cardNum,
      title: def.title,
      sub: def.subtitle
    }, 5400);

    if (def.onStart) def.onStart(this);
    this.audio.setTension(0.15);
    this.save.setProgress((p) => { p.lastChapter = def.id; });
    return true;
  }

  restartFromCheckpoint() {
    const id = this.mission.id;
    this.renderer.setFade(0);
    this.startMission(id, { fromCheckpoint: true });
    this.requestLock();
  }

  requestLock() {
    this.suppressPause = false;
    this.input.requestLock();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.paused = true;
    this.input.enabled = false;
    this.input.releaseLock();
    this.menu.showPause();
    this.save.flushPlayTime();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.menu.hideAll();
    this.state = 'playing';
    this.paused = false;
    this.input.enabled = true;
    this.requestLock();
    this.audio.resume();
  }

  quitToMenu() {
    this.state = 'menu';
    this.paused = true;
    this.input.enabled = false;
    this.input.releaseLock();
    this.hud.show(false);
    this.menu.showMain();
    this.audio.setTension(0.05);
  }

  onPlayerDeath() {
    if (this.state !== 'playing') return;
    this.state = 'dead';
    this.paused = false;
    this.input.enabled = false;
    this.audio.setTension(0.05);
    this.hud.showPrompt('', 0.01);
    setTimeout(() => {
      this.input.releaseLock();
      this.menu.showDeath();
    }, 900);
  }

  onMissionComplete() {
    if (this.state !== 'playing') return;
    this.state = 'complete';
    this.save.completeChapter(this.chapterIndex ?? 1);
    setTimeout(() => {
      this.input.enabled = false;
      this.input.releaseLock();
      this.menu.showDebrief(this.mission, this.computeMissionStats());
    }, 1400);
  }

  computeMissionStats() {
    const p = this.player;
    const acc = p.accuracy.shots ? Math.round((p.accuracy.hits / p.accuracy.shots) * 100) : 0;
    return {
      kills: p.kills,
      headshots: p.headshots,
      accuracy: acc,
      intel: { found: this.mission.intelFound, total: this.mission.intelTotal },
      squadAlive: this.ai.squad.filter((s) => !s.dead).length,
      squadTotal: this.ai.squad.length,
      time: this.mission.timeInMission
    };
  }

  // ------------------------------------------------------------------ combat helpers
  throwGrenade(player) {
    const dir = new THREE.Vector3(
      -Math.sin(player.yaw) * Math.cos(player.pitch),
      Math.sin(player.pitch) + 0.18,
      -Math.cos(player.yaw) * Math.cos(player.pitch)
    );
    const origin = new THREE.Vector3(player.pos.x, player.pos.y + player.eyeHeight * 0.85, player.pos.z);
    const pos = origin.clone().addScaledVector(dir, 0.6);
    this.spawnProjectile({
      pos,
      vel: dir.multiplyScalar(17),
      kind: 'grenade',
      fuse: 2.6,
      explosive: { radius: 7.5, damage: 150, falloff: 1.5 },
      owner: 'player'
    });
    this.audio.uiClick();
  }

  spawnRocket(origin, dir, dist, explosive) {
    this.spawnProjectile({
      pos: origin.clone(),
      vel: dir.clone().multiplyScalar(52),
      kind: 'rocket',
      fuse: Math.max(0.05, dist / 52),
      explosive,
      owner: 'player'
    });
  }

  spawnProjectile({ pos, vel, kind, fuse, explosive, owner }) {
    const mesh = new THREE.Mesh(
      kind === 'grenade'
        ? new THREE.SphereGeometry(0.07, 8, 6)
        : new THREE.CapsuleGeometry(0.05, 0.22, 4, 6),
      new THREE.MeshStandardMaterial({ color: kind === 'grenade' ? 0x39442f : 0x50554a, roughness: 0.7 })
    );
    mesh.position.copy(pos);
    mesh.castShadow = true;
    this.world.group.add(mesh);
    this.projectiles.push({
      mesh, pos: pos.clone(), vel: vel.clone(), kind, fuse, explosive, owner, bounced: 0
    });
    if (kind === 'rocket') this.world.spawnSmokeColumn({ x: pos.x, y: pos.y, z: pos.z }, { color: 0x8a8a80, count: 8, life: 1.2 });
  }

  explode(pos, explosive) {
    this.audio.explosion(pos);
    this.renderer.addShake(0.24);
    this.world.spawnParticles({ pos, count: 34, color: 0xffb050, size: 0.32, speed: 11, life: 0.55, additive: true });
    world_spawnDebris(this, pos);
    const light = new THREE.PointLight(0xffb060, 60, 26, 2);
    light.position.copy(pos);
    this.world.group.add(light);
    setTimeout(() => { this.world.group.remove(light); light.dispose(); }, 220);

    // damage player
    const p = this.player;
    const dp = p.pos.clone(); dp.y += p.eyeHeight * 0.6;
    const dPlayer = dp.distanceTo(pos);
    if (dPlayer < explosive.radius) {
      const f = 1 - dPlayer / explosive.radius;
      p.takeDamage(explosive.damage * Math.pow(f, explosive.falloff) * 0.62, pos);
    }
    // damage enemies
    for (const e of this.ai.enemies) {
      if (e.dead) continue;
      const ep = new THREE.Vector3(e.pos.x, e.pos.y + 0.9, e.pos.z);
      const d = ep.distanceTo(pos);
      if (d < explosive.radius) {
        const f = 1 - d / explosive.radius;
        e.takeDamage(explosive.damage * Math.pow(f, explosive.falloff), 'explosive', false, pos);
        if (d < explosive.radius * 0.6) e.suppressed = 1;
      }
    }
    // damage squad lightly (friendly fire is not encouraged)
    for (const s of this.ai.squad) {
      if (s.down || s.dead) continue;
      const sp = new THREE.Vector3(s.pos.x, s.pos.y + 0.9, s.pos.z);
      const d = sp.distanceTo(pos);
      if (d < explosive.radius * 0.8) {
        s.takeDamage(explosive.damage * 0.35 * (1 - d / (explosive.radius * 0.8)), pos);
      }
    }
    this.ai.notifySound({ x: pos.x, y: pos.y, z: pos.z }, 90, 'explosion');
    this.audio.setTension(1);
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.fuse -= dt;
      if (pr.kind === 'grenade') pr.vel.y -= 18 * dt;
      const step = pr.vel.clone().multiplyScalar(dt);
      const next = pr.pos.clone().add(step);
      // collide with world
      const len = step.length();
      if (len > 0.0001) {
        const dir = step.clone().normalize();
        const wall = this.world.collision.raycast(pr.pos, dir, len + 0.1);
        const groundY = this.world.collision.surfaceAt(next.x, next.z, next.y + 1.4, 0.2);
        if (wall) {
          if (pr.kind === 'rocket') { pr.fuse = 0; pr.pos.copy(wall.point); }
          else {
            // bounce
            const n = new THREE.Vector3(wall.normal.x, wall.normal.y, wall.normal.z);
            pr.vel.reflect(n).multiplyScalar(0.42);
            pr.pos.copy(wall.point).addScaledVector(n, 0.06);
            if (pr.vel.length() > 1.4) this.audio.footstep('metal', pr.pos);
            pr.bounced++;
          }
        } else if (next.y <= groundY) {
          if (pr.kind === 'rocket') { pr.fuse = 0; next.y = groundY + 0.02; pr.pos.copy(next); }
          else {
            next.y = groundY + 0.06;
            pr.vel.y = Math.abs(pr.vel.y) * 0.32;
            pr.vel.x *= 0.62; pr.vel.z *= 0.62;
            pr.pos.copy(next);
          }
        } else {
          pr.pos.copy(next);
        }
      }
      pr.mesh.position.copy(pr.pos);
      if (pr.kind === 'grenade') pr.mesh.rotation.x += dt * 12;
      if (pr.fuse <= 0) {
        this.explode(pr.pos.clone(), pr.explosive);
        this.world.group.remove(pr.mesh);
        pr.mesh.geometry.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  // ------------------------------------------------------------------ loop
  loop(now) {
    requestAnimationFrame(this.loop);
    const dtRaw = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    if (this.state === 'playing' && !this.paused) {
      this.step(dtRaw);
    } else if (this.state === 'dead' || this.state === 'complete') {
      // keep rendering for the menu backdrop
      this.stepVisualOnly(dtRaw);
    }

    this.input.endFrame();
    this.hud.update(dtRaw);
    this.menu.update(dtRaw);
  }

  step(dt) {
    this.time += dt;
    this.accumulator += dt;
    let steps = 0;
    const fixed = this.fixedDt;
    while (this.accumulator >= fixed && steps < 4) {
      this.fixedStep(fixed);
      this.accumulator -= fixed;
      steps++;
    }
    if (steps === 0) {
      // still update camera for smoothness
      this.player.update(0, this.input);
    }
    this.renderer.followShadowTarget(this.player.pos);
    this.renderer.render(dt, this.player.viewCam);
    this.audio.updateMusic(dt, this.ai.alertLevel * 0.85 + (this.player.suppression * 0.2));
    this.audio.setAmbience(this.era === '1973' ? 0.42 + this.ai.alertLevel * 0.5 : 0.28 + this.ai.alertLevel * 0.4);
    this.save.addPlayTime(dt);
    if (this.frameCount % 120 === 0) this.save.flushPlayTime();
    this.frameCount++;
  }

  fixedStep(dt) {
    this.player.update(dt, this.input);
    this.ai.update(dt);
    this.mission.update(dt);
    this.world.update(dt, this.time);
    this.updateProjectiles(dt);
    this.hud.setSquad(this.ai.squad);
    this.handleInteractions();
    this.handleSquadOrders();
  }

  stepVisualOnly(dt) {
    this.world.update(dt, this.time);
    this.renderer.render(dt, this.player ? this.player.viewCam : null);
  }

  handleSquadOrders() {
    const i = this.input;
    if (i.pressed('squadMove')) this.ai.issueOrder('move');
    if (i.pressed('squadHold')) this.ai.issueOrder('hold');
    if (i.pressed('squadBreach')) this.ai.issueOrder('breach');
    // middle mouse = context move order
    if (i.mouse.buttons[1] && i.mouse.edges[1]) this.ai.issueOrder('move');
  }

  handleInteractions() {
    const p = this.player;
    const near = this.world.interactables.find((it) => {
      if (it.taken) return false;
      const d = Math.hypot(it.pos.x - p.pos.x, it.pos.z - p.pos.z);
      return d < (it.radius || 2.4);
    });
    if (near) {
      this.hud.showInteract(near.label || 'INSPECT');
      if (this.input.pressed('interact')) {
        near.taken = true;
        this.hud.showInteract(null);
        near.onUse(this);
      }
    } else {
      this.hud.showInteract(null);
    }
  }

  // ------------------------------------------------------------------ debug
  teleport(x, y, z) {
    if (!this.player) return;
    this.player.pos.set(x, y, z);
    this.player.vel = { x: 0, y: 0, z: 0 };
  }

  godMode(v = true) { this.player.godMode = v; }
}

function world_spawnDebris(game, pos) {
  game.world.spawnParticles({ pos, count: 16, color: 0x6a6250, size: 0.09, speed: 7, life: 1.4, gravity: 12 });
  game.world.spawnParticles({ pos, count: 10, color: 0x3a3a34, size: 0.18, speed: 4, life: 2.4, gravity: -0.4 });
}

void MAX_GRENADES;

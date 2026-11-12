/**
 * SHADOW PROTOCOL — Player
 * First-person controller: walking, sprinting, tactical sprint, crouching, prone,
 * sliding, jumping, leaning, mantling — with smooth state transitions, camera
 * breathing, headbob, lean roll, ADS and damage feedback.
 *
 * Analogous on the Unreal side to ASPCharacter + USPCharacterMovementComponent
 * (see docs/03_TECHNICAL_ARCHITECTURE.md §4).
 */
import * as THREE from 'three';
import { WeaponRuntime, WEAPONS } from './weapons.js';

const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

export const STANCE = { STAND: 0, CROUCH: 1, PRONE: 2 };

export class Player {
  constructor(game, opts = {}) {
    this.game = game;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.lean = 0;
    this.leanTarget = 0;
    this.radius = 0.34;
    this.height = 1.78;
    this.stance = STANCE.STAND;
    this.crouchT = 0;       // 0 = stand, 1 = crouch
    this.proneT = 0;        // 0 = up, 1 = prone
    this.grounded = true;
    this.sprinting = false;
    this.tacticalSprint = false;
    this.tacSprintT = 0;
    this.stamina = 1;
    this.health = 100;
    this.maxHealth = 100;
    this.armor = 0;
    this.dead = false;
    this.sliding = false;
    this.slideT = 0;
    this.slideCooldown = 0;
    this.mantling = false;
    this.mantleT = 0;
    this.mantleFrom = new THREE.Vector3();
    this.mantleTo = new THREE.Vector3();
    this.aiming = false;
    this.adsT = 0;
    this.bobT = 0;
    this.stepT = 0;
    this.moveSpeedNow = 0;
    this.suppression = 0;
    this.damageFlash = 0;
    this.lastDamageTime = -99;
    this.bloodT = 0;
    this.nightVision = false;
    this.grenades = 2;
    this.meleeCooldown = 0;
    this.kills = 0;
    this.headshots = 0;
    this.accuracy = { shots: 0, hits: 0 };
    this.flashlight = false;

    this.viewCam = new THREE.PerspectiveCamera(80, 1, 0.02, 60);
    this.weaponHolder = new THREE.Group();
    this.viewCam.add(this.weaponHolder);

    const era = opts.era || '1973';
    this.era = era;
    this.weapons = [];
    this.weaponIndex = 0;
    const loadout = opts.loadout || (era === '1973' ? ['akm', 'portsaid', 'rpg7'] : ['m4', 'mp5sd', 'pistol']);
    for (const id of loadout) {
      if (WEAPONS[id]) this.weapons.push(new WeaponRuntime(WEAPONS[id], this));
    }
    this._equipWeapon(0);
    this.attachViewModel();

    // dynamic lights
    this.flashlightObj = new THREE.SpotLight(0xfff2d0, 0, 34, 0.42, 0.4, 1.4);
    this.flashlightObj.castShadow = false;
    this.viewCam.add(this.flashlightObj);
    this.flashlightObj.position.set(0.15, -0.1, 0);

    this.footstepSurface = 'sand';
    this.cameraShake = new THREE.Vector2();
    this.fovBase = 80;
    this.fovTarget = 80;
  }

  attachViewModel() {
    this.weaponHolder.position.set(0.17, -0.19, -0.32);
    this.weaponHolder.rotation.set(0, -0.04, 0);
    this.weaponHolder.scale.setScalar(1);
  }

  _equipWeapon(index) {
    if (index < 0 || index >= this.weapons.length) return;
    if (this.weapon) this.weaponHolder.remove(this.weapon.model);
    this.weaponIndex = index;
    this.weapon = this.weapons[index];
    this.weaponHolder.add(this.weapon.model);
    this.weapon.model.position.set(0, 0, 0);
    this.weapon.model.rotation.set(0, 0, 0);
  }

  swapWeapon() {
    if (this.weapons.length < 2) return;
    this._equipWeapon((this.weaponIndex + 1) % this.weapons.length);
    this.game.audio.reload();
    this.swapT = 0.35;
  }

  get stanceName() {
    if (this.proneT > 0.5) return 'PRONE';
    if (this.crouchT > 0.5) return 'CROUCH';
    return 'STAND';
  }

  get capsuleHeight() {
    return lerp(1.78, 1.12, this.crouchT) * (1 - this.proneT * 0.72);
  }

  get eyeHeight() {
    return lerp(1.66, 1.02, this.crouchT) * (1 - this.proneT * 0.66);
  }

  get speed() { return this.moveSpeedNow; }

  onGround() { return this.grounded; }

  takeDamage(amount, fromPos, { headshot = false } = {}) {
    if (this.dead || this.godMode) return;
    const prev = this.health;
    this.health = Math.max(0, this.health - amount);
    this.damageFlash = Math.min(1, 0.45 + amount / 60);
    this.lastDamageTime = this.game.time;
    this.game.audio.damageTaken();
    if (fromPos) {
      // directional damage indicator
      const dx = fromPos.x - this.pos.x, dz = fromPos.z - this.pos.z;
      const bear = Math.atan2(dx, dz);
      this.lastDamageDir = bear;
      this.lastDamageAngle = bear;
      this.lastDamageScreen = ((bear - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    }
    this.game.hud.flashDamage(this.lastDamageScreen || 0, amount);
    this.game.renderer.addShake(Math.min(0.09, 0.02 + amount * 0.002));
    this.suppression = Math.min(1, this.suppression + 0.25);
    if (this.health <= 0) this.die();
    else if (prev > 40 && this.health <= 40) this.game.audio.heartbeat();
    this.game.mission.onPlayerDamaged(amount, headshot);
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.health = 0;
    this.game.onPlayerDeath();
  }

  heal(n) {
    this.health = Math.min(this.maxHealth, this.health + n);
  }

  addGrenade() { this.grenades = Math.min(4, this.grenades + 1); }

  update(dt, input) {
    const g = this.game;
    if (this.dead) { this._updateCamera(dt); return; }

    // ------------------------------------------------------------ look
    const look = input.lookVector();
    const sens = input.sensitivity * (this.aiming ? 0.55 : 1) * (this.nightVision ? 0.85 : 1);
    const mx = look.x * 0.0021 * sens;
    const my = look.y * 0.0021 * sens * (input.invertY ? -1 : 1);
    this.yaw -= mx;
    this.pitch = clamp(this.pitch - my, -88 * DEG, 88 * DEG);
    input.consumeMouse();

    // ------------------------------------------------------------ lean
    let leanWant = 0;
    if (input.down('leanLeft')) leanWant = -1;
    else if (input.down('leanRight')) leanWant = 1;
    if (this.proneT > 0.4) leanWant = 0;
    this.leanTarget = leanWant;
    this.lean = lerp(this.lean, this.leanTarget, 1 - Math.pow(0.0005, dt));

    // ------------------------------------------------------------ stance
    const mv = input.moveVector();
    const moving = mv.magnitude > 0.1;

    // Slide is evaluated against the PREVIOUS frame's sprint state, so that the
    // crouch press that starts a slide does not first cancel the sprint.
    const prevSprinting = this.sprinting;
    const crouchIntent = input.pressed('crouch') || input.down('crouch');
    let startedSlideThisFrame = false;
    this.slideCooldown = Math.max(0, this.slideCooldown - dt);
    if (!this.sliding && (prevSprinting || this.sprinting) && crouchIntent &&
        this.slideCooldown <= 0 && this.grounded && this.stamina > 0.15 && this.proneT < 0.4) {
      this.sliding = true;
      this.slideT = 0.85;
      this.stamina = Math.max(0, this.stamina - 0.18);
      this.vel.x += -Math.sin(this.yaw) * 4.2;
      this.vel.z += -Math.cos(this.yaw) * 4.2;
      startedSlideThisFrame = true;
      g.audio.footstep('sand', this.pos);
      g.renderer.addShake(0.012);
    }

    if (input.pressed('prone')) {
      if (this.stance === STANCE.PRONE) this.stance = STANCE.STAND;
      else this.stance = STANCE.PRONE;
    }
    if (input.pressed('crouch') && !startedSlideThisFrame) {
      if (this.stance === STANCE.PRONE) this.stance = STANCE.CROUCH;
      else if (this.stance === STANCE.CROUCH) this.stance = STANCE.STAND;
      else this.stance = STANCE.CROUCH;
    }
    // hold-to-crouch mode (when toggles disabled)
    if (!input.toggleCrouch && !startedSlideThisFrame) {
      if (input.down('crouch') && this.stance === STANCE.STAND) this.stance = STANCE.CROUCH;
      else if (!input.down('crouch') && this.stance === STANCE.CROUCH) this.stance = STANCE.STAND;
    }

    const canSprint = this.stance === STANCE.STAND && !this.aiming;
    const wantSprint = input.down('sprint') && moving && mv.y > 0.35 && canSprint && this.stamina > 0.04;

    // tactical sprint: sprint while looking roughly forward (or Shift+W burst)
    const lookFwd = Math.abs(this.pitch) < 20 * DEG;
    const wantTac = wantSprint && lookFwd && this.stamina > 0.25;

    this.tacSprintT = clamp(this.tacSprintT + (wantTac ? dt : -dt * 2), 0, 1);
    this.tacticalSprint = wantTac && this.tacSprintT > 0.35;
    this.sprinting = wantSprint && !this.tacticalSprint;

    // stamina
    if (wantSprint) this.stamina = clamp(this.stamina - dt * (this.tacticalSprint ? 0.20 : 0.11), 0, 1);
    else this.stamina = clamp(this.stamina + dt * 0.16, 0, 1);

    // stance interpolation (blocked from standing under low ceilings)
    let wantCrouch = this.stance === STANCE.CROUCH || this.sliding ? 1 : 0;
    const wantProne = this.stance === STANCE.PRONE ? 1 : 0;
    if (wantCrouch === 0) {
      // check headroom
      const headY = this.pos.y + 1.85;
      if (g.world.collision.pointSolid(this.pos.x, headY, this.pos.z)) wantCrouch = 1;
    }
    this.crouchT = lerp(this.crouchT, wantCrouch, 1 - Math.pow(0.001, dt));
    this.proneT = lerp(this.proneT, wantProne, 1 - Math.pow(0.002, dt));

    // ------------------------------------------------------------ slide tick
    if (this.sliding) {
      this.slideT -= dt;
      if (this.slideT <= 0 || this.stance === STANCE.PRONE) {
        this.sliding = false;
        this.slideCooldown = 0.55;
      }
    }

    // ------------------------------------------------------------ speed model
    const base = 3.15;
    const sprintMul = this.tacticalSprint ? 1.92 : this.sprinting ? 1.55 : 1;
    const stanceMul = this.proneT > 0.5 ? 0.28 : this.crouchT > 0.5 ? 0.55 : 1;
    const aimMul = this.aiming ? 0.66 : 1;
    let targetSpeed = base * sprintMul * stanceMul * aimMul;
    if (this.sliding) targetSpeed = 7.4;
    if (this.mantling) targetSpeed = 0;

    // ------------------------------------------------------------ mantle
    if (!this.mantling && input.pressed('jump') && this.grounded && moving) {
      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const chest = { x: this.pos.x + fwd.x * 0.55, y: this.pos.y + 1.0, z: this.pos.z + fwd.z * 0.55 };
      const knee = { x: this.pos.x + fwd.x * 0.6, y: this.pos.y + 0.55, z: this.pos.z + fwd.z * 0.6 };
      const hitChest = g.world.collision.pointSolid(chest.x, chest.y, chest.z);
      const hitKnee = g.world.collision.pointSolid(knee.x, knee.y, knee.z);
      if (hitChest && !hitKnee) {
        const topY = hitChest.max[1];
        if (topY - this.pos.y > 0.6 && topY - this.pos.y < 1.9) {
          // ensure landing space is clear
          const land = { x: this.pos.x + fwd.x * 1.15, y: topY + 0.05, z: this.pos.z + fwd.z * 1.15 };
          if (!g.world.collision.pointSolid(land.x, land.y + 0.9, land.z)) {
            this.mantling = true;
            this.mantleT = 0;
            this.mantleFrom.copy(this.pos);
            this.mantleTo.set(land.x, topY + 0.02, land.z);
            g.audio.footstep('concrete', this.pos);
          }
        }
      }
    }
    if (this.mantling) {
      this.mantleT += dt / 0.62;
      const t = clamp(this.mantleT, 0, 1);
      const e = t * t * (3 - 2 * t);
      this.pos.x = lerp(this.mantleFrom.x, this.mantleTo.x, e);
      this.pos.z = lerp(this.mantleFrom.z, this.mantleTo.z, e);
      this.pos.y = lerp(this.mantleFrom.y, this.mantleTo.y, Math.min(1, e * 1.8));
      this.vel.x = this.vel.y = this.vel.z = 0;
      if (t >= 1) { this.mantling = false; this.grounded = true; }
      this._updateCamera(dt);
      this._updateWeapon(dt, 0, input);
      return;
    }

    // ------------------------------------------------------------ horizontal accel
    const accel = this.grounded ? 34 : 8;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    let wishX = fwd.x * mv.y + right.x * mv.x;
    let wishZ = fwd.z * mv.y + right.z * mv.x;
    const wishLen = Math.hypot(wishX, wishZ);
    if (wishLen > 0.001) { wishX /= wishLen; wishZ /= wishLen; }
    if (this.sliding) {
      // slide keeps momentum
      this.vel.x = lerp(this.vel.x, wishX * targetSpeed, dt * 1.2);
      this.vel.z = lerp(this.vel.z, wishZ * targetSpeed, dt * 1.2);
    } else {
      this.vel.x = lerp(this.vel.x, wishX * targetSpeed * Math.min(1, wishLen || 0), Math.min(1, dt * accel));
      this.vel.z = lerp(this.vel.z, wishZ * targetSpeed * Math.min(1, wishLen || 0), Math.min(1, dt * accel));
    }

    // jump
    if (input.pressed('jump') && this.grounded && !this.mantling && !this.sliding) {
      this.vel.y = 6.6;
      this.grounded = false;
      this.stamina = clamp(this.stamina - 0.06, 0, 1);
    }

    // ------------------------------------------------------------ physics
    const col = g.world.collision.move(this.pos, this.vel, this.radius, this.capsuleHeight, dt);
    this.grounded = col.grounded;
    if (col.hitWall && this.sprinting) { /* wall bump keeps sprint */ }

    // water hazard: slow and drain in deep water
    if (col.water) {
      const depth = g.world.collision.lastWaterDepth || 0;
      if (depth > 1.6) this.takeDamage(dt * 26, null);
      this.vel.x *= 0.6; this.vel.z *= 0.6;
    }

    // out of bounds recovery
    if (this.pos.y < -12) { this.pos.y = 2; this.takeDamage(12, null); }

    // ------------------------------------------------------------ footsteps
    this.moveSpeedNow = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && this.moveSpeedNow > 0.6) {
      const rate = this.sprinting ? 2.1 : this.crouchT > 0.5 ? 0.85 : 1.35;
      this.stepT += dt * rate * Math.min(1.6, this.moveSpeedNow / 3);
      if (this.stepT >= 1) {
        this.stepT = 0;
        const surf = this.game.mission.surfaceAt ? this.game.mission.surfaceAt(this.pos) : 'sand';
        this.footstepSurface = surf;
        g.audio.footstep(surf, this.pos);
        g.ai.notifySound(this.pos, this.crouchT > 0.5 ? 2.5 : this.sprinting ? 14 : 8, 'footstep');
      }
    } else {
      this.stepT = Math.min(this.stepT, 0.9);
    }

    // ------------------------------------------------------------ aim / fire
    this._updateWeapon(dt, this.moveSpeedNow, input);
    this._updateCamera(dt);

    // ------------------------------------------------------------ health regen
    // Standard military-shooter regeneration, gated on difficulty. Realism
    // disables it entirely; every difficulty waits 5 s after the last hit.
    const regenAllowed = g.difficulty !== 'realism';
    if (regenAllowed && !this.dead && this.health < this.maxHealth &&
        g.time - this.lastDamageTime > 5.0) {
      this.health = Math.min(this.maxHealth, this.health + dt * 16);
    }

    // suppression decay
    this.suppression = Math.max(0, this.suppression - dt * 0.55);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.2);
    this.meleeCooldown = Math.max(0, this.meleeCooldown - dt);
    this.swapT = Math.max(0, (this.swapT || 0) - dt);

    // night vision
    if (input.pressed('nightVision') && this.hasNVG) {
      this.nightVision = !this.nightVision;
      g.audio.nightVisionOn();
      g.renderer.setNVG(this.nightVision ? 0.88 : 0);
    }
    // flashlight
    if (input.pressed('flashlight')) {
      this.flashlight = !this.flashlight;
      this.flashlightObj.intensity = this.flashlight ? 4.5 : 0;
      g.audio.uiClick();
    }
  }

  _updateWeapon(dt, moving, input) {
    const w = this.weapon;
    const g = this.game;

    // ADS
    const wantAim = input.down('aim') && !this.sprinting && !this.sliding && !this.mantling;
    this.aiming = wantAim;
    this.adsT = lerp(this.adsT, wantAim ? 1 : 0, 1 - Math.pow(0.0001, dt));

    // fire
    if (input.down('fire') && !this.mantling) {
      if (w.reloading) { /* no fire while reloading */ }
      else if (w.def.auto || input.pressed('fire')) {
        if (w.canFire()) this._shoot();
        else if (w.empty && input.pressed('fire')) { g.audio.dryFire(); w.startReload() && g.audio.reload(); }
      }
    }
    // reload
    if ((input.pressed('reload') || (w.empty && input.pressed('fire'))) && w.startReload()) {
      g.audio.reload();
      g.hud.showPrompt(this.era === '1973' ? 'إعادة تلقيم' : 'RELOADING', 0.9);
    }
    // swap (keys 1/2 or wheel)
    if (input.pressed('swapWeapon')) this.swapWeapon();
    const wheel = input.consumeWheel();
    if (wheel !== 0 && this.weapons.length > 1) this.swapWeapon();

    // melee
    if (input.pressed('melee') && this.meleeCooldown <= 0) {
      this.meleeCooldown = 0.7;
      g.audio.melee();
      g.renderer.addShake(0.03);
      const meleeRange = 2.3;
      const fwd = this._forward();
      const targets = g.ai.enemiesAlive();
      for (const e of targets) {
        const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
        if (d < meleeRange) {
          const toE = new THREE.Vector3(e.pos.x - this.pos.x, 0, e.pos.z - this.pos.z).normalize();
          if (toE.dot(fwd) > 0.55) {
            // stealth takedown if unseen, else a hard hit
            if (!e.alerted) {
              e.takedown();
              g.hud.showPrompt(this.era === '1973' ? 'إسقاط صامت' : 'SILENT TAKEDOWN', 1.2);
              g.audio.takedown();
            } else {
              e.takeDamage(65, 'melee', false);
            }
            break;
          }
        }
      }
    }

    // revive a downed teammate (hold interact while standing over them)
    if (input.down('interact')) {
      for (const member of g.ai.squad) {
        if (!member.down || member.dead) continue;
        const d = Math.hypot(member.pos.x - this.pos.x, member.pos.z - this.pos.z);
        if (d < 2.4) {
          this.reviveTarget = member;
          member.revive(dt * 0.62);
          g.hud.showPrompt(`REVIVING ${member.callsign} — ${Math.round(member.reviveProgress * 100)}%`, 0.3);
          break;
        }
      }
    } else {
      this.reviveTarget = null;
    }

    // grenade
    if (input.pressed('grenade') && this.grenades > 0) {
      this.grenades -= 1;
      g.throwGrenade(this);
    }

    // weapon runtime
    w.update(dt, moving, this.aiming);

    // recoil applied to aim
    this.pitch += w.recoil.y * dt * 12;
    this.yaw += w.recoil.x * dt * 12;
    this.pitch = clamp(this.pitch, -89 * DEG, 89 * DEG);

    // viewmodel pose
    const aimBlend = this.adsT;
    const swayData = w.viewOffset(moving, this.aiming, g.time);
    const hipX = 0.17, hipY = -0.19, hipZ = -0.32;
    const adsX = 0, adsY = -0.115, adsZ = -0.26;
    const runBobX = Math.sin(this.bobT) * 0.012 * Math.min(1, moving / 4);
    const runBobY = Math.abs(Math.cos(this.bobT)) * 0.014 * Math.min(1, moving / 4);
    const breathing = Math.sin(g.time * 1.35) * 0.0035;

    this.weaponHolder.position.set(
      lerp(hipX, adsX, aimBlend) + swayData.x + runBobX * (1 - aimBlend),
      lerp(hipY, adsY, aimBlend) + swayData.y + runBobY * (1 - aimBlend) + breathing,
      lerp(hipZ, adsZ, aimBlend)
    );
    const sprintPose = this.sprinting ? 1 : 0;
    this.weaponHolder.rotation.set(
      lerp(-0.03 + swayData.rotX, 0, aimBlend) + sprintPose * 0.35,
      lerp(-0.04, 0, aimBlend) + sprintPose * 0.55,
      lerp(0.02 + swayData.rotZ, 0, aimBlend) + sprintPose * 0.28
    );
    this.weaponHolder.position.y -= (this.swapT || 0) * 0.5;

    // suppression affects viewmodel
    this.weaponHolder.position.y -= this.suppression * 0.01;
  }

  _forward() {
    return new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    ).normalize();
  }

  /** Apply damage to a specific enemy, including hitbox resolution. */
  _shoot() {
    const g = this.game;
    const w = this.weapon;
    w.fire(g.time);
    this.accuracy.shots += 1;

    g.audio.gunshot(w.def.sound, this.pos, w.def.suppressed);

    const origin = this._eyePos();
    const baseDir = this._forward();

    for (let b = 0; b < w.def.bullets; b++) {
      const spread = w.currentSpread(this.moveSpeedNow / 7, this.aiming, this.crouchT > 0.5);
      const dir = baseDir.clone();
      // random cone
      const rx = (Math.random() - 0.5 + Math.random() - 0.5) * spread * 2;
      const ry = (Math.random() - 0.5 + Math.random() - 0.5) * spread * 2;
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const up = new THREE.Vector3().crossVectors(right, dir).normalize();
      dir.addScaledVector(right, rx).addScaledVector(up, ry).normalize();

      const hitEnemy = g.ai.raycastEnemies(origin, dir, 260, (e) => e.team !== 'player');
      const wallHit = g.world.collision.raycast(origin, dir, 260);
      const groundHit = g.world.collision.raycastGround(origin, dir, 260, 0.6);

      let best = { dist: 260, kind: 'none', point: null, normal: null };
      if (wallHit && wallHit.dist < best.dist) best = { dist: wallHit.dist, kind: 'wall', point: wallHit.point, normal: wallHit.normal };
      if (groundHit && groundHit.dist < best.dist) best = { dist: groundHit.dist, kind: 'ground', point: groundHit.point, normal: groundHit.normal };
      if (hitEnemy && hitEnemy.dist < best.dist) best = { dist: hitEnemy.dist, kind: 'enemy', enemy: hitEnemy.enemy, point: hitEnemy.point, headshot: hitEnemy.headshot };

      const muzzleWorld = new THREE.Vector3();
      this.weapon.model.userData.muzzle.getWorldPosition(muzzleWorld);

      if (w.def.explosive) {
        // rocket: just explode at impact point after travel
        const impact = best.point || new THREE.Vector3().copy(origin).addScaledVector(dir, 120).toArray();
        g.spawnRocket(muzzleWorld, dir, best.dist, w.def.explosive);
        void impact;
      } else {
        if (best.kind === 'enemy') {
          const dmg = w.def.damage * (best.headshot ? w.def.headMul : 1);
          const killed = best.enemy.takeDamage(dmg, w.def.id, best.headshot, this.pos);
          this.accuracy.hits += 1;
          if (best.headshot) this.headshots += 1;
          if (killed) this.kills += 1;
          g.hud.hitMarker(killed, best.headshot);
          g.audio.hitMarker(killed);
          g.audio.impact('flesh', best.point);
          g.world.spawnParticles({
            pos: best.point, count: 9, color: 0x8a1010, size: 0.06, speed: 2.4, life: 0.45, gravity: 6
          });
        } else if (best.kind !== 'none') {
          g.audio.impact('metal', best.point);
          if (Math.random() < 0.25) g.audio.ricochet(best.point);
          g.world.spawnParticles({
            pos: best.point, count: 7, color: 0xd8cfae, size: 0.045, speed: 3.2, life: 0.5, gravity: 7
          });
          // suppress enemies near the impact
          g.ai.notifySuppression(best.point, 4.5);
        } else {
          g.audio.bulletWhiz(this.pos);
        }
        if (suppressedTracer(w)) g.world.spawnTracer(muzzleWorld, best.point || origin.clone().addScaledVector(dir, 120).toArray());
        if (best.kind !== 'none') g.world.spawnTracer(muzzleWorld, best.point);
      }
      // bullet noise alerts AI
      g.ai.notifySound(this.pos, w.def.suppressed ? 12 : 70, 'gunshot');
    }

    // recoil kick to camera + shake
    g.renderer.addShake(w.def.recoilV * 0.9);
    this.pitch += w.def.recoilV * 0.35;
  }

  _eyePos() {
    return new THREE.Vector3(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);
  }

  _updateCamera(dt) {
    const g = this.game;
    const cam = this.viewCam;

    // bob
    const speedFactor = Math.min(1.4, this.moveSpeedNow / 3.2);
    this.bobT += dt * (6 + speedFactor * 5);
    const bobAmt = this.grounded ? speedFactor * (this.aiming ? 0.004 : 0.016) : 0;
    const bobY = Math.abs(Math.cos(this.bobT)) * bobAmt;
    const bobX = Math.sin(this.bobT * 0.5) * bobAmt * 1.1;

    // breathing
    const breath = Math.sin(g.time * 1.1) * 0.0022 * (1 - this.adsT * 0.6);
    const breathFov = this.aiming ? 1 - this.adsT * 0.04 : 1;

    this.fovTarget = this.fovBase
      * (this.aiming ? lerp(1, 1 / this.weapon.def.adsZoom, this.adsT) : 1)
      * (this.tacticalSprint ? 1.06 : 1)
      * breathFov;
    cam.fov = lerp(cam.fov, this.fovTarget, 1 - Math.pow(0.002, dt));

    // eye position with lean offset
    const eyeH = this.eyeHeight;
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const leanOffset = this.lean * 0.42;
    const leanDrop = Math.abs(this.lean) * 0.07;

    cam.position.set(
      this.pos.x + right.x * leanOffset + right.x * bobX,
      this.pos.y + eyeH - leanDrop + bobY + breath,
      this.pos.z + right.z * leanOffset + right.z * bobX
    );
    // subtle neck pivot so leaning peeks around cover without moving the whole body
    cam.rotation.set(this.pitch, this.yaw, this.lean * 0.085);
    cam.rotateZ(-this.lean * 0.03);
    cam.updateMatrixWorld();
    cam.aspect = window.innerWidth / window.innerHeight;
    cam.updateProjectionMatrix();

    // audio listener
    const fwd = this._forward();
    g.audio.setListener(cam.position, fwd, { x: 0, y: 1, z: 0 });

    // post effects
    g.renderer.setDamage(this.damageFlash * Math.min(1, 1 - this.health / 100 + 0.25));
    g.renderer.setSuppression(this.suppression * 0.85);
    g.renderer.setExposure(lerp(1.0, 0.82, this.damageFlash * 0.6));
  }

  reset(pos, yaw = 0) {
    this.pos.set(pos.x, pos.y, pos.z);
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = yaw;
    this.pitch = 0;
    this.health = this.maxHealth;
    this.dead = false;
    this.stance = STANCE.STAND;
    this.crouchT = 0;
    this.proneT = 0;
    this.stamina = 1;
    this.suppression = 0;
    this.damageFlash = 0;
    this.sliding = false;
    this.mantling = false;
    this.nightVision = false;
    this.lean = 0;
  }
}

function suppressedTracer(w) { return !w.def.suppressed || Math.random() < 0.5; }

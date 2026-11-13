/**
 * SHADOW PROTOCOL — AI
 * Enemy: perception (vision cone + LOS + hearing), awareness states
 * (IDLE → SUSPICIOUS → SEARCH → COMBAT → COVER → FLANK → RETREAT), suppressive
 * fire, communication (alerts propagate to nearby allies), difficulty tiers.
 * Squad: formation following, order execution (MOVE/HOLD/BREACH/RECON), revive.
 *
 * Analogous on the Unreal side to ASPEnemyAIController (Behaviour-tree driven)
 * and ASPSquadAIController.
 */
import * as THREE from 'three';
import { buildSoldier, buildWeaponModel, PALETTE } from './models.js';
import { buildCharacter } from './character.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * Make an animated character body for one actor.
 *
 * The rigged library is fetched once by the game and cached in `character.js`.
 * If it is not available yet — first frames, or a failed fetch — this returns
 * null and the caller keeps the blockout body, so gameplay never blocks on art.
 */
let _charGltf = null;
export function setCharacterSource(gltf) { _charGltf = gltf; }
export function hasCharacterSource() { return !!_charGltf; }

function makeBody(palette, opts = {}) {
  if (_charGltf) {
    try {
      return buildCharacter(_charGltf, { palette, ...opts });
    } catch (err) {
      console.warn('[ai] character build failed, using blockout body:', err.message);
    }
  }
  // Blockout fallback: still a playable body, never a crash and never a gap in
  // the level while the 4 MB character library is still arriving.
  return buildSoldier(palette, opts);
}


const lerp = (a, b, t) => a + (b - a) * t;
const dist2D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const ENEMY_STATE = {
  IDLE: 'idle', PATROL: 'patrol', SUSPICIOUS: 'suspicious',
  SEARCH: 'search', COMBAT: 'combat', COVER: 'cover',
  FLANK: 'flank', RETREAT: 'retreat', DEAD: 'dead', TAKEDOWN: 'takedown'
};

const DIFFICULTY = {
  easy: { sight: 34, fov: 1.5, react: 0.85, accuracy: 0.28, dmg: 0.55, health: 0.8, hearing: 26, burst: [2, 4] },
  normal: { sight: 52, fov: 1.9, react: 0.5, accuracy: 0.5, dmg: 1.0, health: 1.0, hearing: 34, burst: [3, 6] },
  hard: { sight: 66, fov: 2.2, react: 0.32, accuracy: 0.68, dmg: 1.2, health: 1.15, hearing: 44, burst: [4, 8] },
  realism: { sight: 78, fov: 2.4, react: 0.22, accuracy: 0.82, dmg: 2.2, health: 1.0, hearing: 55, burst: [5, 10] }
};

let _uid = 0;

export class Enemy {
  constructor(game, cfg) {
    this.game = game;
    this.id = cfg.id ?? `e${_uid++}`;
    this.team = cfg.team || 'enemy';
    this.diff = DIFFICULTY[cfg.difficulty || 'normal'];
    this.pos = new THREE.Vector3(cfg.pos.x, cfg.pos.y ?? 0, cfg.pos.z);
    this.yaw = cfg.yaw || 0;
    this.homeYaw = this.yaw;
    this.health = (cfg.health ?? 100) * this.diff.health;
    this.maxHealth = this.health;
    this.state = ENEMY_STATE.IDLE;
    this.alerted = false;
    this.awareness = 0;
    this.lastSeen = null;
    this.lastSeenPos = new THREE.Vector3();
    this.targetPos = new THREE.Vector3().copy(this.pos);
    this.patrol = cfg.patrol || null;
    this.patrolIdx = 0;
    this.post = cfg.post || null;
    this.weaponId = cfg.weapon || (cfg.era === '1973' ? 'enemy_ak' : 'enemy_modern');
    this.era = cfg.era || '1973';
    this.role = cfg.role || 'rifleman';
    this.cooldown = 0;
    this.burstLeft = 0;
    this.burstTimer = 0;
    this.reactionTimer = 0;
    this.searchTimer = 0;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.strafeTimer = 1 + Math.random() * 2;
    this.coverPos = null;
    this.suppressed = 0;
    this.dead = false;
    this.deadT = 0;
    this.removed = false;
    this.spottedPlayer = false;
    this.lastShout = -99;
    this.shotCount = 0;

    // Scripted states used by hub chapters (e.g. Ch.03 Directorate):
    //  holdFire — alerted but ordered not to shoot (guards during a briefing)
    //  dormant  — not yet in play (an ambush that has not sprung)
    //  hidden   — whole actor kept off the field until it wakes
    this.holdFire = !!cfg.holdFire;
    this.dormant = !!cfg.dormant;
    this.hidden = !!cfg.hidden;
    this.faction = cfg.faction || 'enemy';

    // model
    const palette = cfg.palette || (this.era === '1973' ? PALETTE.israeli1973 : PALETTE.nkGuard);
    this.soldier = makeBody(palette, { era: this.era === '1973' ? '1973' : 'modern', role: this.role });
    this.mesh = this.soldier.group;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;
    game.world.group.add(this.mesh);

    this.gun = buildWeaponModel(this.weaponId);
    this.gun.scale.setScalar(1);
    this.soldier.parts.handR.add(this.gun);
    if (this.soldier.isSkinned) {
      // Mounted inside the hand bone; the weapon's own origin is the receiver.
      this.gun.position.set(0, 0, 0);
      this.gun.rotation.set(0, 0, 0);
    } else {
      this.gun.position.set(0, -0.32, 0.02);
      this.gun.rotation.set(0.1, 0, 0);
    }

    this.walkT = Math.random() * 6;
    this.speed = this.role === 'officer' ? 2.6 : 2.2;
    this.moveTarget = null;
    this.stuckTimer = 0;
    this.lastPos = this.pos.clone();

    if (this.patrol && this.patrol.length > 1) this.state = ENEMY_STATE.PATROL;
  }

  get eye() { return { x: this.pos.x, y: this.pos.y + 1.55, z: this.pos.z }; }

  /** Sphere/AABB approximation used by bullet raycasts. */
  hitTest(origin, dir, maxDist) {
    if (this.dead) return null;
    // head sphere
    const head = { x: this.pos.x, y: this.pos.y + 1.62, z: this.pos.z, r: 0.17 };
    // body capsule approximated as AABB
    const bodyMin = { x: this.pos.x - 0.28, y: this.pos.y + 0.1, z: this.pos.z - 0.28 };
    const bodyMax = { x: this.pos.x + 0.28, y: this.pos.y + 1.72, z: this.pos.z + 0.28 };

    const headHit = raySphere(origin, dir, head, maxDist);
    const bodyHit = rayAABB(origin, dir, bodyMin, bodyMax, maxDist);
    if (headHit && (!bodyHit || headHit < bodyHit)) {
      return { dist: headHit, headshot: true, enemy: this, point: pointAt(origin, dir, headHit) };
    }
    if (bodyHit) return { dist: bodyHit, headshot: false, enemy: this, point: pointAt(origin, dir, bodyHit) };
    return null;
  }

  takeDamage(amount, weapon, headshot, fromPos) {
    if (this.dead) return false;
    // limb falloff for body shots at extreme range
    this.health -= amount;
    this.alerted = true;
    this.awareness = 1;
    if (fromPos) this.lastSeenPos.copy(fromPos);
    this.suppressed = 1;
    if (this.state === ENEMY_STATE.IDLE || this.state === ENEMY_STATE.PATROL) this.state = ENEMY_STATE.COMBAT;
    if (this.health <= 0) {
      this.die(headshot);
      return true;
    }
    // flinch + shout
    this.mesh.position.y += 0.0;
    this.shout('CONTACT!', 0.9);
    // partial cover taking
    if (Math.random() < 0.45) this._seekCover(fromPos);
    this.reactionTimer = Math.min(this.reactionTimer, 0.15);
    void weapon;
    return false;
  }

  takedown() {
    if (this.dead) return;
    this.dead = true;
    this.state = ENEMY_STATE.DEAD;
    this.deadT = 0;
    this.soldier.pose(0, 0, 0, 0, true);
    this.game.mission.onEnemyKilled(this, true);
  }

  die(headshot) {
    this.dead = true;
    this.state = ENEMY_STATE.DEAD;
    this.deadT = 0;
    this.soldier.pose(0, 0, 0, 0, true);
    this.gun.rotation.z = 1.2;
    this.game.mission.onEnemyKilled(this, headshot);
    // ragdoll-lite: fall direction
    this.deathDir = Math.random() < 0.5 ? 1 : -1;
  }

  shout(text, urgency = 0.5) {
    if (this.game.time - this.lastShout < 1.6) return;
    this.lastShout = this.game.time;
    this.game.mission.onEnemyShout(this, text, urgency);
  }

  canSeePlayer() {
    const p = this.game.player;
    if (p.dead) return false;
    const eye = this.eye;
    const target = { x: p.pos.x, y: p.pos.y + p.eyeHeight * 0.85, z: p.pos.z };
    const d = Math.hypot(target.x - eye.x, target.y - eye.y, target.z - eye.z);
    let maxSight = this.diff.sight;
    if (p.proneT > 0.5) maxSight *= 0.55;
    else if (p.crouchT > 0.5) maxSight *= 0.8;
    if (p.sprinting) maxSight *= 1.18;
    if (this.game.era === 'modern' && this.game.time > (this.game.mission.darknessAt || 0) && !p.flashlight) maxSight *= 0.62;
    if (p.flashlight) maxSight *= 1.35;
    if (this.alerted) maxSight *= 1.15;
    if (d > maxSight) return false;

    // field of view
    const dx = target.x - eye.x, dz = target.z - eye.z;
    const bearing = Math.atan2(dx, dz);
    let diffA = ((bearing - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    if (Math.abs(diffA) > this.diff.fov / 2) return false;

    return this.game.world.collision.lineOfSight(eye, target);
  }

  _seekCover(threatPos) {
    const cover = this.game.world.collision.findCover(this.pos, threatPos || this.game.player.pos, 12);
    if (cover) {
      this.coverPos = new THREE.Vector3(cover.x, cover.y, cover.z);
      this.state = ENEMY_STATE.COVER;
    }
  }

  _moveToward(target, dt, speedMul = 1) {
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.35) return true;
    const sp = this.speed * speedMul * (this.state === ENEMY_STATE.RETREAT ? 1.5 : 1);
    const step = steer(this.game.world.collision, this.pos, { x: target.x, z: target.z }, sp * dt, 1.0);
    if (step.blocked) {
      // Truly boxed in: try a hard strafe, and if that fails pick a new point.
      const side = steer(this.game.world.collision, this.pos, {
        x: this.pos.x + (this.strafeDir || 1) * 10, z: this.pos.z
      }, sp * dt, 1.0);
      if (side.blocked) {
        this.strafeDir = -(this.strafeDir || 1);
        this.stuckTimer += dt;
        if (this.stuckTimer > 1.2) { this.coverPos = null; this.flankPos = null; this.stuckTimer = 0; }
        return false;
      }
      this.pos.x = side.x;
      this.pos.z = side.z;
    } else {
      this.pos.x = step.x;
      this.pos.z = step.z;
      this.stuckTimer = Math.max(0, this.stuckTimer - dt);
    }
    this.pos.y = this.game.world.collision.surfaceAt(this.pos.x, this.pos.z, this.pos.y + 0.7, 0.25);
    this.walkT += dt * sp * 2.6;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = Math.atan2(dx, dz) + Math.PI;
    return false;
  }

  update(dt) {
    const g = this.game;

    // Dormant or hidden actors are inert: no perception, no movement, no model.
    if (this.dormant || this.hidden) {
      this.mesh.visible = !this.hidden;
      this.awareness = 0;
      this.alerted = false;
      return;
    }
    this.mesh.visible = true;

    if (this.dead) {
      this.deadT += dt;
      // settle the body
      this.mesh.position.y = lerp(this.mesh.position.y, this.pos.y + 0.18, Math.min(1, dt * 6));
      this.mesh.rotation.y = lerp(this.mesh.rotation.y, this.yaw + this.deathDir * 0.9, Math.min(1, dt * 3));
      if (this.deadT > 24 && !this.removed) { this.removed = true; g.world.group.remove(this.mesh); }
      return;
    }

    const player = g.player;
    const sees = this.canSeePlayer();
    this.spottedPlayer = sees;

    // --- awareness accumulation instead of instant detection
    if (sees) {
      this.awareness = clamp(this.awareness + dt * (1.6 / this.diff.react), 0, 1);
    } else {
      this.awareness = clamp(this.awareness - dt * 0.22, 0, 1);
    }

    if (sees && this.awareness > 0.35 && !this.alerted) {
      this.alerted = true;
      // A guard under hold-fire notices you and tracks you, but does not engage.
      this.state = this.holdFire ? ENEMY_STATE.SUSPICIOUS : ENEMY_STATE.COMBAT;
      this.lastSeenPos.copy(player.pos);
      this.reactionTimer = this.diff.react;
      this.shout(this.era === '1973' ? 'TARGET!' : 'CONTACT!');
      this.game.ai.propagateAlert(this.pos, 22, this);
      g.audio.radio(5, 0.9);
      g.mission.onSpotted(this);
    }
    if (sees) this.lastSeenPos.set(player.pos.x, player.pos.y + 1.4, player.pos.z);

    this.suppressed = Math.max(0, this.suppressed - dt * 0.55);

    switch (this.state) {
      case ENEMY_STATE.IDLE: {
        // idle sway scan
        this.yaw += Math.sin(g.time * 0.4 + this.walkT) * dt * 0.25;
        this.mesh.rotation.y = this.yaw;
        if (this.awareness > 0.45) {
          this.state = ENEMY_STATE.SUSPICIOUS;
          this.searchTimer = 4;
          this.shout(this.era === '1973' ? 'من هناك؟' : 'WHO GOES THERE?');
        }
        break;
      }
      case ENEMY_STATE.PATROL: {
        const wp = this.patrol[this.patrolIdx % this.patrol.length];
        const done = this._moveToward(wp, dt, 0.72);
        this.yaw = this.mesh.rotation.y - Math.PI;
        if (done) {
          this.patrolIdx = (this.patrolIdx + 1) % this.patrol.length;
        }
        if (this.awareness > 0.45) {
          this.state = ENEMY_STATE.SUSPICIOUS;
          this.searchTimer = 4.5;
          this.shout(this.era === '1973' ? 'إيه ده؟' : 'WHAT WAS THAT?');
        }
        break;
      }
      case ENEMY_STATE.SUSPICIOUS: {
        // turn toward the last heard/suspected point
        if (this.lastSeenPos.lengthSq() > 0) {
          const dx = this.lastSeenPos.x - this.pos.x, dz = this.lastSeenPos.z - this.pos.z;
          const want = Math.atan2(dx, dz);
          this.yaw = lerpAngle(this.yaw, want, dt * 2.2);
          this.mesh.rotation.y = this.yaw;
        }
        this.searchTimer -= dt;
        // Under hold-fire they keep watching; anything else escalates normally.
        if (!this.holdFire && (sees || this.awareness > 0.75)) {
          this.alerted = true;
          this.state = ENEMY_STATE.COMBAT;
          this.reactionTimer = this.diff.react;
          this.shout('CONTACT!');
          g.ai.propagateAlert(this.pos, 26, this);
        } else if (this.searchTimer <= 0) {
          // investigate the disturbance
          if (this.lastSeenPos.lengthSq() > 0) {
            this.state = ENEMY_STATE.SEARCH;
            this.searchTimer = 6;
            this.targetPos.copy(this.lastSeenPos);
          } else {
            this.state = this.patrol ? ENEMY_STATE.PATROL : ENEMY_STATE.IDLE;
          }
        }
        break;
      }
      case ENEMY_STATE.SEARCH: {
        const done = this._moveToward(this.targetPos, dt, 0.85);
        if (done) {
          this.searchTimer -= dt * 1.6;
          this.yaw += dt * 1.7;
          this.mesh.rotation.y = this.yaw;
        } else {
          this.searchTimer -= dt;
        }
        if (sees && !this.holdFire) {
          this.alerted = true;
          this.state = ENEMY_STATE.COMBAT;
          this.reactionTimer = this.diff.react;
        } else if (this.searchTimer <= 0) {
          this.alerted = false;
          this.awareness = 0.2;
          this.state = this.patrol ? ENEMY_STATE.PATROL : ENEMY_STATE.IDLE;
          this.game.mission.hooks.onSearchEnded && this.game.mission.hooks.onSearchEnded(this);
        }
        break;
      }
      case ENEMY_STATE.COMBAT: {
        const p = player.pos;
        const dist = dist2D(this.pos, p);
        // face the player
        const want = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
        this.yaw = lerpAngle(this.yaw, want, dt * 6);
        this.mesh.rotation.y = this.yaw;

        if (sees && this.reactionTimer > 0) this.reactionTimer -= dt;
        if (this.suppressed > 0.6 && Math.random() < dt * 1.4) this._seekCover(p);

        // movement: close distance if far, strafe if close, retreat if hurt badly
        if (this.health < this.maxHealth * 0.25 && Math.random() < dt * 0.7) {
          this.state = ENEMY_STATE.RETREAT;
          this.searchTimer = 3;
          this.shout(this.era === '1973' ? 'أنا مصاب!' : 'I\'M HIT, FALLING BACK!');
        } else if (dist > 26 && dist < 90) {
          this.coverPos = null;
          this._moveToward({ x: p.x, y: p.y, z: p.z }, dt, 1.0);
        } else if (dist < 5.5) {
          // back off to keep weapon space
          this._moveToward({ x: this.pos.x * 2 - p.x, y: this.pos.y, z: this.pos.z * 2 - p.z }, dt, 0.7);
        } else {
          // strafe in combat
          this.strafeTimer -= dt;
          if (this.strafeTimer <= 0) { this.strafeDir *= -1; this.strafeTimer = 0.9 + Math.random() * 1.6; }
          const side = { x: -(p.z - this.pos.z), z: (p.x - this.pos.x) };
          const l = Math.hypot(side.x, side.z) || 1;
          const speed = this.speed * 0.6;
          const nx = this.pos.x + (side.x / l) * this.strafeDir * speed * dt;
          const nz = this.pos.z + (side.z / l) * this.strafeDir * speed * dt;
          if (!g.world.collision.pointSolid(nx, this.pos.y + 0.5, nz)) { this.pos.x = nx; this.pos.z = nz; }
          else this.strafeDir *= -1;
          this.walkT += dt * 6;
        }

        // fire control
        this.cooldown -= dt;
        if (sees && this.reactionTimer <= 0 && this.cooldown <= 0) {
          if (this.burstLeft <= 0) {
            this.burstLeft = this.diff.burst[0] + Math.floor(Math.random() * (this.diff.burst[1] - this.diff.burst[0] + 1));
            this.burstTimer = 0;
          }
          this.burstTimer -= dt;
          if (this.burstTimer <= 0) {
            if (this.burstLeft > 0) {
              this._fireAt(player);
              this.burstLeft -= 1;
              this.burstTimer = 60 / 620;
            }
            if (this.burstLeft <= 0) this.cooldown = 0.55 + Math.random() * 0.9;
          }
        }
        // lost sight → push to last known position
        if (!sees && this.awareness < 0.5) {
          this.state = ENEMY_STATE.SEARCH;
          this.searchTimer = 6;
          this.targetPos.copy(this.lastSeenPos);
        }
        break;
      }
      case ENEMY_STATE.COVER: {
        if (!this.coverPos) { this.state = ENEMY_STATE.COMBAT; break; }
        const done = this._moveToward(this.coverPos, dt, 1.3);
        const want = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
        this.yaw = lerpAngle(this.yaw, want, dt * 4);
        this.mesh.rotation.y = this.yaw;
        if (done) {
          this.coverTimer = (this.coverTimer || 1.6) - dt;
          this.cooldown -= dt;
          // pop out to fire, then duck again
          if (this.coverTimer <= 0 && this.cooldown <= 0 && sees) {
            this._fireAt(player);
            this.cooldown = 0.5 + Math.random() * 0.7;
            this.coverTimer = 1.2 + Math.random() * 1.4;
          }
          if (this.suppressed < 0.25) {
            this.state = ENEMY_STATE.COMBAT;
            this.coverPos = null;
          }
        }
        break;
      }
      case ENEMY_STATE.FLANK: {
        if (!this.flankPos) { this.state = ENEMY_STATE.COMBAT; break; }
        const done = this._moveToward(this.flankPos, dt, 1.25);
        if (done || dist2D(this.pos, player.pos) < 14) {
          this.state = ENEMY_STATE.COMBAT;
          this.flankPos = null;
        }
        break;
      }
      case ENEMY_STATE.RETREAT: {
        const away = { x: player.pos.x, y: player.pos.y, z: player.pos.z };
        const dx = this.pos.x - away.x, dz = this.pos.z - away.z;
        const l = Math.hypot(dx, dz) || 1;
        this._moveToward({ x: this.pos.x + (dx / l) * 12, y: this.pos.y, z: this.pos.z + (dz / l) * 12 }, dt, 1.1);
        this.searchTimer -= dt;
        this.health = Math.min(this.maxHealth, this.health + dt * 4); // steady while regrouping
        if (this.searchTimer <= 0) { this.state = ENEMY_STATE.COMBAT; this.coverPos = null; }
        break;
      }
      default: break;
    }

    // pose + stamina
    const moving = dist2D(this.pos, this.lastPos) > 0.001;
    const spd = moving ? Math.hypot(this.pos.x - this.lastPos.x, this.pos.z - this.lastPos.z) / dt : 0;
    this.lastPos.copy(this.pos);
    this.soldier.pose(this.walkT, spd, 0, this.state === ENEMY_STATE.COMBAT || this.state === ENEMY_STATE.COVER ? 1 : 0.2);
    if (this.soldier.update) this.soldier.update(dt);
    this.mesh.position.copy(this.pos);

    // stuck detection
    if (moving && spd < 0.15) this.stuckTimer += dt; else this.stuckTimer = 0;
    if (this.stuckTimer > 1.5) { this.strafeDir *= -1; this.stuckTimer = 0; }
  }

  _fireAt(player) {
    const g = this.game;
    const from = this.eye;
    const dist = Math.hypot(player.pos.x - from.x, player.pos.z - from.z);
    const muzzleWorld = new THREE.Vector3();
    this.gun.updateMatrixWorld(true);
    (this.gun.userData.muzzle || this.gun).getWorldPosition(muzzleWorld);

    // accuracy: distance + player movement + suppression penalties
    let acc = this.diff.accuracy;
    acc *= clamp(1 - dist / 90, 0.28, 1);
    if (player.sprinting) acc *= 0.8;
    if (player.crouchT > 0.5) acc *= 0.92;
    if (this.suppressed > 0.4) acc *= 0.55;
    if (this.state === ENEMY_STATE.COVER) acc *= 0.9;

    g.audio.gunshot(this.era === '1973' ? 'enemy_ak' : 'enemy_modern', this.pos, false);
    g.world.spawnParticles({ pos: muzzleWorld, count: 4, color: 0xffd080, size: 0.06, speed: 4, life: 0.12, additive: true });

    const hit = Math.random() < acc;
    const target = { x: player.pos.x, y: player.pos.y + (Math.random() < 0.12 ? player.eyeHeight : 0.9), z: player.pos.z };
    if (hit) {
      const dmg = (this.era === '1973' ? 17 : 15) * this.diff.dmg;
      player.takeDamage(dmg, this.pos, { headshot: false });
      g.world.spawnTracer(muzzleWorld, target, 0xffc060, 0.07);
      g.hud.showHitDirection(this.pos);
    } else {
      const miss = new THREE.Vector3(
        target.x + (Math.random() - 0.5) * 2.4,
        target.y + (Math.random() - 0.5) * 1.9,
        target.z + (Math.random() - 0.5) * 2.4
      );
      g.world.spawnTracer(muzzleWorld, miss, 0xffc060, 0.07);
      // near miss → suppression + whiz
      if (miss.distanceTo(new THREE.Vector3(player.pos.x, player.pos.y + 1, player.pos.z)) < 3.5) {
        player.suppression = Math.min(1, player.suppression + 0.18);
        g.audio.bulletWhiz(miss);
        g.renderer.addShake(0.006);
      }
      const wall = g.world.collision.raycast(muzzleWorld, new THREE.Vector3().subVectors(miss, muzzleWorld).normalize(), 120);
      if (wall) g.world.spawnParticles({ pos: wall.point, count: 4, color: 0xcfc6a8, size: 0.05, speed: 2.4, life: 0.4, gravity: 6 });
    }
    this.shotCount += 1;
    g.ai.notifySound(this.pos, 40, 'gunshot');
  }
}

// ---------------------------------------------------------------- friendly squad
export const SQUAD_ORDER = { FOLLOW: 'follow', MOVE: 'move', HOLD: 'hold', BREACH: 'breach', RECON: 'recon' };

export class SquadMember {
  constructor(game, cfg) {
    this.game = game;
    this.callsign = cfg.callsign;
    this.nameEn = cfg.nameEn;
    this.nameAr = cfg.nameAr;
    this.role = cfg.role;
    this.team = 'player';
    this.pos = new THREE.Vector3(cfg.pos.x, cfg.pos.y || 0, cfg.pos.z);
    this.health = 100;
    this.maxHealth = 100;
    this.down = false;
    this.dead = false;
    this.reviveProgress = 0;
    this.ammo = 180;
    this.weaponId = cfg.weapon || (cfg.era === '1973' ? 'enemy_ak' : 'enemy_modern');
    this.cooldown = 0;
    this.slot = cfg.slot || 0;
    this.order = SQUAD_ORDER.FOLLOW;
    this.orderPos = new THREE.Vector3();
    this.yaw = 0;
    this.walkT = Math.random() * 5;
    this.lastSpeak = -99;
    this.kills = 0;
    this.suppressed = 0;

    this.soldier = makeBody(cfg.palette || PALETTE.egypt1973, { era: cfg.era === 'modern' ? 'modern' : '1973', role: cfg.role });
    this.mesh = this.soldier.group;
    this.mesh.position.copy(this.pos);
    game.world.group.add(this.mesh);
    const gun = buildWeaponModel(this.weaponId);
    this.soldier.parts.handR.add(gun);
    if (this.soldier.isSkinned) {
      gun.position.set(0, 0, 0);
      gun.rotation.set(0, 0, 0);
    } else {
      gun.position.set(0, -0.32, 0.02);
    }
    this.gun = gun;
    this.lastPos = this.pos.clone();
  }

  get eye() { return { x: this.pos.x, y: this.pos.y + 1.55, z: this.pos.z }; }

  orderTo(pos, order = SQUAD_ORDER.MOVE) {
    this.orderPos.set(pos.x, pos.y, pos.z);
    this.order = order;
  }

  takeDamage(amount, fromPos) {
    if (this.down || this.dead) return;
    this.health -= amount;
    this.suppressed = Math.min(1, this.suppressed + 0.4);
    if (this.health <= 0) {
      this.health = 0;
      this.down = true;
      this.downT = 0;
      this.game.mission.onSquadDown(this, fromPos);
    }
  }

  revive(amount = 0.34) {
    if (!this.down) return false;
    this.reviveProgress += amount;
    if (this.reviveProgress >= 1) {
      this.down = false;
      this.health = 45;
      this.reviveProgress = 0;
      this.game.mission.onSquadRevived(this);
      return true;
    }
    return false;
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    if (this.dead) { this.mesh.visible = false; return; }
    if (this.down) {
      this.downT += dt;
      // progress decays if the player walks away without finishing
      if (!(p.reviveTarget === this)) this.reviveProgress = Math.max(0, this.reviveProgress - dt * 0.2);
      this.soldier.pose(0, 0, 1, 0);
      if (this.soldier.update) this.soldier.update(dt);
      this.mesh.position.copy(this.pos);
      // bleed out on realism
      if (this.downT > (g.difficulty === 'realism' ? 22 : 45)) {
        this.dead = true;
        g.mission.onSquadLost(this);
      }
      return;
    }

    this.suppressed = Math.max(0, this.suppressed - dt * 0.5);

    // formation offsets relative to the player and their facing
    const offsets = [
      { x: -1.9, z: 1.6 }, { x: 2.0, z: 1.9 }, { x: -0.2, z: 2.9 }
    ];
    let goal;
    if (this.order === SQUAD_ORDER.HOLD) {
      goal = this.orderPos;
    } else if (this.order === SQUAD_ORDER.MOVE || this.order === SQUAD_ORDER.BREACH || this.order === SQUAD_ORDER.RECON) {
      goal = this.orderPos;
      if (dist2D(this.pos, goal) < 2.4) this.order = SQUAD_ORDER.HOLD;
    } else {
      const o = offsets[this.slot % offsets.length];
      const fwd = new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
      const right = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
      goal = {
        x: p.pos.x + fwd.x * o.z + right.x * o.x,
        y: p.pos.y,
        z: p.pos.z + fwd.z * o.z + right.z * o.x
      };
    }

    const dGoal = dist2D(this.pos, goal);
    let spd = 0;
    if (dGoal <= (this.order === SQUAD_ORDER.FOLLOW ? 1.2 : 0.8)) this.blockedT = 0;
    if (dGoal > (this.order === SQUAD_ORDER.FOLLOW ? 1.2 : 0.8)) {
      const sp = dGoal > 9 ? 6.4 : dGoal > 4 ? 4.4 : 2.9;
      const step = steer(g.world.collision, this.pos, { x: goal.x, z: goal.z }, sp * dt, 0.95);
      if (!step.blocked) {
        this.pos.x = step.x;
        this.pos.z = step.z;
        spd = sp;
        this.walkT += dt * sp * 1.9;
      } else {
        // Nothing in the fan of headings is walkable, which means the member is
        // boxed in: pressed against a wall, a doorway or a piece of cover. The
        // sidestep below can fail too, and if both fail every frame the member
        // stands still forever while still holding a live move order — it looks
        // like the squad order was simply ignored. Track how long we have been
        // pinned and back out along the reverse heading after a moment.
        this.blockedT = (this.blockedT || 0) + dt;
        // sidestep along the obstruction
        const side = steer(g.world.collision, this.pos, {
          x: this.pos.x + (this.order === SQUAD_ORDER.HOLD ? 0 : 10) * Math.cos(this.yaw + Math.PI / 2),
          z: this.pos.z + (this.order === SQUAD_ORDER.HOLD ? 0 : 10) * Math.sin(this.yaw + Math.PI / 2)
        }, sp * dt, 0.95);
        if (!side.blocked) {
          this.pos.x = side.x;
          this.pos.z = side.z;
        } else if (this.blockedT > 0.45) {
          // Give up on the direct route and slide backwards along our own
          // facing to unpick ourselves from whatever we are jammed against.
          const back = steer(g.world.collision, this.pos, {
            x: this.pos.x - Math.sin(this.yaw) * 4,
            z: this.pos.z - Math.cos(this.yaw) * 4
          }, sp * dt, 0.95);
          if (!back.blocked) {
            this.pos.x = back.x;
            this.pos.z = back.z;
          }
          this.blockedT = 0;
        }
      }
      this.pos.y = g.world.collision.surfaceAt(this.pos.x, this.pos.z, this.pos.y + 0.8, 0.28);
    }

    // target selection: nearest visible enemy
    let target = null, bestD = 1e9;
    for (const e of g.ai.enemies) {
      if (e.dead) continue;
      const d = dist2D(this.pos, e.pos);
      if (d < 46 && d < bestD && g.world.collision.lineOfSight(this.eye, e.eye)) { target = e; bestD = d; }
    }

    // radio chatter (only on meaningful events, throttled)
    if (target && g.time - this.lastSpeak > 9 && Math.random() < dt * 0.35) {
      this.lastSpeak = g.time;
      g.mission.onSquadChatter(this, 'contact');
    }

    // engage
    if (target) {
      const want = Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z);
      this.yaw = lerpAngle(this.yaw, want, dt * 5);
      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        this.cooldown = 0.14 + Math.random() * 0.2;
        this._fire(target);
      }
    } else {
      // face movement/player
      const fdx = (dGoal > 1.2 ? goal.x - this.pos.x : p.pos.x - this.pos.x);
      const fdz = (dGoal > 1.2 ? goal.z - this.pos.z : p.pos.z - this.pos.z);
      this.yaw = lerpAngle(this.yaw, Math.atan2(fdx, fdz), dt * 3);
    }

    const aim = target ? 1 : (dGoal > 1.2 ? 0.25 : 0.55);
    this.soldier.pose(this.walkT, spd, 0, aim);
    if (this.soldier.update) this.soldier.update(dt);
    this.mesh.rotation.y = this.yaw;
    this.mesh.position.copy(this.pos);
    this.lastPos.copy(this.pos);
  }

  _fire(target) {
    const g = this.game;
    const from = this.eye;
    const muzzle = new THREE.Vector3();
    this.gun.updateMatrixWorld(true);
    (this.gun.userData.muzzle || this.gun).getWorldPosition(muzzle);
    g.audio.gunshot(this.game.era === '1973' ? 'enemy_ak' : 'enemy_modern', this.pos, false);
    const acc = 0.42 + (g.squadAccuracyBonus || 0);
    const hit = Math.random() < acc;
    const aimPoint = { x: target.pos.x, y: target.pos.y + 1.05, z: target.pos.z };
    if (hit) {
      const dmg = 26 + Math.random() * 12;
      target.takeDamage(dmg, this.weaponId, false, this.pos);
      g.world.spawnTracer(muzzle, aimPoint, 0xffe090, 0.06);
      if (Math.random() < 0.4) g.audio.hitMarker(false);
    } else {
      const miss = { x: aimPoint.x + (Math.random() - 0.5) * 2, y: aimPoint.y + (Math.random() - 0.5) * 1.6, z: aimPoint.z + (Math.random() - 0.5) * 2 };
      g.world.spawnTracer(muzzle, miss, 0xffe090, 0.06);
      target.suppressed = Math.min(1, target.suppressed + 0.3);
    }
    void from;
  }
}

// ---------------------------------------------------------------- director
export class AIDirector {
  constructor(game) {
    this.game = game;
    this.enemies = [];
    this.squad = [];
    this.soundEvents = [];
    this.lastFlankCheck = 0;
  }

  spawnEnemies(list) {
    for (const cfg of list) {
      const e = new Enemy(this.game, { ...cfg, era: this.game.era, difficulty: this.game.difficulty });
      this.enemies.push(e);
    }
  }

  spawnSquad(list) {
    for (const cfg of list) {
      const s = new SquadMember(this.game, { ...cfg, era: this.game.era });
      this.squad.push(s);
    }
  }

  enemiesAlive() { return this.enemies.filter((e) => !e.dead); }
  squadAlive() { return this.squad.filter((s) => !s.dead && !s.down); }

  /** Raycast against enemy hitboxes. */
  raycastEnemies(origin, dir, maxDist, filter = null) {
    let best = null;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (filter && !filter(e)) continue;
      const hit = e.hitTest(origin, dir, maxDist);
      if (hit && (!best || hit.dist < best.dist)) best = hit;
    }
    return best;
  }

  notifySound(pos, radius, kind) {
    this.soundEvents.push({ pos: { ...pos }, radius, kind, t: this.game.time });
    if (this.soundEvents.length > 40) this.soundEvents.shift();
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
      if (d < radius) {
        // hearing check: quiet weapons are much less effective
        e.lastSeenPos.set(pos.x, pos.y + 1.2, pos.z);
        e.awareness = clamp(e.awareness + 0.35 + (radius - d) / radius * 0.3, 0, 1);
        if (e.state === ENEMY_STATE.IDLE || e.state === ENEMY_STATE.PATROL) {
          e.state = ENEMY_STATE.SUSPICIOUS;
          e.searchTimer = 3.5;
        }
        void kind;
      }
    }
  }

  notifySuppression(pos, radius) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
      if (d < radius) e.suppressed = Math.min(1, e.suppressed + 0.5);
    }
  }

  propagateAlert(pos, radius, source) {
    for (const e of this.enemies) {
      if (e.dead || e === source) continue;
      const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
      if (d < radius) {
        e.alerted = true;
        e.awareness = Math.max(e.awareness, 0.8);
        if (e.state === ENEMY_STATE.IDLE || e.state === ENEMY_STATE.PATROL) {
          e.state = ENEMY_STATE.SEARCH;
          e.searchTimer = 6;
          e.targetPos.copy(source.lastSeenPos);
          e.lastSeenPos.copy(source.lastSeenPos);
        }
      }
    }
  }

  /** Squad orders from the player. */
  issueOrder(kind, targetPos) {
    const alive = this.squadAlive();
    if (!alive.length) return false;
    const p = this.game.player.pos;
    if (kind === SQUAD_ORDER.HOLD) {
      for (const s of alive) s.orderTo(s.pos.clone(), SQUAD_ORDER.HOLD);
      this.game.mission.onSquadOrder('hold');
      return true;
    }
    if (kind === SQUAD_ORDER.MOVE || kind === SQUAD_ORDER.BREACH || kind === SQUAD_ORDER.RECON) {
      // target: the player's aim point on the ground, else a forward offset
      let t = targetPos;
      if (!t) {
        const fwd = new THREE.Vector3(-Math.sin(this.game.player.yaw), 0, -Math.cos(this.game.player.yaw));
        const origin = { x: p.x, y: p.y + 1.5, z: p.z };
        const dir = fwd.clone();
        const hit = this.game.world.collision.raycastGround(origin, dir, 40, 0.5) || this.game.world.collision.raycast(origin, dir, 40);
        t = hit ? hit.point : new THREE.Vector3(p.x + fwd.x * 8, p.y, p.z + fwd.z * 8);
      }
      const offsets = [[0, 0], [-2.2, -1.4], [2.2, -1.4]];
      alive.forEach((s, i) => {
        const o = offsets[i % offsets.length];
        s.orderTo({ x: t.x + o[0], y: t.y, z: t.z + o[1] }, kind);
      });
      this.game.mission.onSquadOrder(kind, t);
      return true;
    }
    return false;
  }

  /** Dynamic flanking: a few enemies attempt to flank when combat is stable. */
  updateFlanking(dt) {
    this.lastFlankCheck -= dt;
    if (this.lastFlankCheck > 0) return;
    this.lastFlankCheck = 2.4;
    const combat = this.enemies.filter((e) => !e.dead && e.state === ENEMY_STATE.COMBAT && e.alerted);
    if (combat.length < 2) return;
    const candidate = combat.find((e) => Math.random() < 0.3 && e.health > e.maxHealth * 0.5);
    if (!candidate) return;
    const p = this.game.player.pos;
    const ang = Math.atan2(candidate.pos.x - p.x, candidate.pos.z - p.z) + (Math.random() < 0.5 ? 0.9 : -0.9);
    const r = 16 + Math.random() * 6;
    const flank = { x: p.x + Math.sin(ang) * r, y: p.y, z: p.z + Math.cos(ang) * r };
    if (!this.game.world.collision.pointSolid(flank.x, this.game.world.collision.surfaceAt(flank.x, flank.z) + 1, flank.z)) {
      candidate.flankPos = new THREE.Vector3(flank.x, this.game.world.collision.surfaceAt(flank.x, flank.z), flank.z);
      candidate.state = ENEMY_STATE.FLANK;
      candidate.shout('FLANKING!');
    }
  }

  update(dt) {
    for (const e of this.enemies) e.update(dt);
    for (const s of this.squad) s.update(dt);
    this.updateFlanking(dt);
    // clamp enemy count growth for performance
    if (this.enemies.length > 120) {
      this.enemies = this.enemies.filter((e) => !e.removed);
    }
  }

  get alertLevel() {
    let n = 0, total = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      total++;
      if (e.state === ENEMY_STATE.COMBAT || e.state === ENEMY_STATE.COVER) n += 1;
      else if (e.alerted || e.state === ENEMY_STATE.SEARCH) n += 0.45;
    }
    return total ? n / total : 0;
  }

  reset() {
    for (const e of this.enemies) { if (e.mesh) this.game.world.group.remove(e.mesh); }
    for (const s of this.squad) { if (s.mesh) this.game.world.group.remove(s.mesh); }
    this.enemies = [];
    this.squad = [];
    this.soundEvents = [];
  }
}

// ---------------------------------------------------------------- steering
/**
 * Local navigation: sample directions from the desired heading outward and take
 * the first one that is clear. Cheap, deterministic, and good enough for trench
 * and yard geometry; the Unreal build replaces this with a navmesh path query.
 */
export function steer(collision, pos, goal, stepLen, radius = 0.9) {
  const dx = goal.x - pos.x;
  const dz = goal.z - pos.z;
  const len = Math.hypot(dx, dz) || 1;
  const base = Math.atan2(dx, dz);
  const offsets = [0, 0.4, -0.4, 0.85, -0.85, 1.3, -1.3, 1.9, -1.9];
  const probeY = pos.y + 0.85;
  for (const off of offsets) {
    const a = base + off;
    const nx = pos.x + Math.sin(a) * stepLen;
    const nz = pos.z + Math.cos(a) * stepLen;
    // check the destination and a slightly further lookahead
    if (collision.pointSolid(nx, probeY, nz, -0.05)) continue;
    const la = pos.x + Math.sin(a) * (stepLen + 0.7);
    const lz = pos.z + Math.cos(a) * (stepLen + 0.7);
    if (collision.pointSolid(la, probeY, lz, -0.15)) continue;
    return { x: nx, z: nz, blocked: false, angle: a };
  }
  void radius;
  return { x: pos.x, z: pos.z, blocked: true, angle: base };
}

// ---------------------------------------------------------------- math helpers
function raySphere(origin, dir, sphere, maxDist) {
  const ox = origin.x - sphere.x, oy = origin.y - sphere.y, oz = origin.z - sphere.z;
  const b = ox * dir.x + oy * dir.y + oz * dir.z;
  const c = ox * ox + oy * oy + oz * oz - sphere.r * sphere.r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  let t = -b - sq;
  if (t < 0) t = -b + sq;
  if (t < 0 || t > maxDist) return null;
  return t;
}

function rayAABB(origin, dir, min, max, maxDist) {
  let tmin = 0, tmax = maxDist;
  for (const ax of ['x', 'y', 'z']) {
    const d = dir[ax];
    if (Math.abs(d) < 1e-8) {
      if (origin[ax] < min[ax] || origin[ax] > max[ax]) return null;
      continue;
    }
    let t1 = (min[ax] - origin[ax]) / d;
    let t2 = (max[ax] - origin[ax]) / d;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin > 0.001 ? tmin : null;
}

function pointAt(origin, dir, t) {
  return { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t };
}

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * Math.min(1, t);
}

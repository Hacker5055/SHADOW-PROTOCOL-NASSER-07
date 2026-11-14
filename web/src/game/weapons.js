/**
 * SHADOW PROTOCOL — Weapons
 * Data-driven weapon definitions with era gating, recoil patterns, sway,
 * suppression and hit resolution. The 1973 loadout can never select a modern
 * weapon (see validateLoadout) — this is enforced, not merely cosmetic.
 */
import * as THREE from 'three';
import { buildWeaponModel, fitWeaponModel } from './models.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const WEAPONS = {
  // ---------------------------------------------------------------- 1973
  akm: {
    id: 'akm', era: '1973', name: 'AKM', nameAr: 'أكم',
    class: 'Assault Rifle', origin: 'Egyptian Army, 1973',
    damage: 34, headMul: 2.6, rpm: 600, mag: 30, reserve: 180,
    spread: 0.011, adsSpread: 0.0028, moveSpread: 0.028,
    recoilV: 0.019, recoilH: 0.008, recoilRecover: 7.5,
    sway: 1.0, adsZoom: 1.35, reloadTime: 2.3, suppressed: false,
    auto: true, bullets: 1, muzzle: 1.0, sound: 'akm',
    desc: 'Standard-issue assault rifle of the Egyptian infantry in 1973. Hard-hitting, heavy recoil, slow to control in bursts.'
  },
  portsaid: {
    id: 'portsaid', era: '1973', name: 'Port Said SMG', nameAr: 'بندقية بورسعيد',
    class: 'Submachine Gun', origin: 'Egyptian licence-built, 1960s',
    damage: 22, headMul: 2.2, rpm: 600, mag: 36, reserve: 216,
    spread: 0.016, adsSpread: 0.005, moveSpread: 0.032,
    recoilV: 0.009, recoilH: 0.006, recoilRecover: 9,
    sway: 0.75, adsZoom: 1.2, reloadTime: 2.0, suppressed: false,
    auto: true, bullets: 1, muzzle: 0.75, sound: 'portsaid',
    desc: 'Compact Egyptian submachine gun. Ideal for trench clearance and close-quarters fighting inside bunkers.'
  },
  rpd: {
    id: 'rpd', era: '1973', name: 'RPD', nameAr: 'رشاش RPD',
    class: 'Light Machine Gun', origin: 'Soviet-supplied, Egyptian service',
    damage: 30, headMul: 2.2, rpm: 650, mag: 100, reserve: 300,
    spread: 0.022, adsSpread: 0.006, moveSpread: 0.048,
    recoilV: 0.014, recoilH: 0.012, recoilRecover: 5.5,
    sway: 1.4, adsZoom: 1.25, reloadTime: 4.2, suppressed: false,
    auto: true, bullets: 1, muzzle: 1.2, sound: 'rpd',
    desc: 'Belt-fed squad automatic weapon. Heavy suppression tool; punishing without a bipod position.'
  },
  rpg7: {
    id: 'rpg7', era: '1973', name: 'RPG-7', nameAr: 'آر بي جي',
    class: 'Anti-Tank Launcher', origin: 'Soviet-supplied',
    damage: 0, headMul: 1, rpm: 20, mag: 1, reserve: 3,
    spread: 0.004, adsSpread: 0.001, moveSpread: 0.02,
    recoilV: 0.06, recoilH: 0.02, recoilRecover: 3,
    sway: 1.8, adsZoom: 1.9, reloadTime: 3.4, suppressed: false,
    auto: false, bullets: 1, muzzle: 1.8, sound: 'rpg7',
    explosive: { radius: 6.5, damage: 160, falloff: 1.6 },
    desc: 'Rocket-propelled grenade. Single shot, devastating against emplacements and armour; reloading under fire is fatal.'
  },
  // ---------------------------------------------------------------- modern
  m4: {
    id: 'm4', era: 'modern', name: 'M4A1 (custom)', nameAr: 'إم ٤',
    class: 'Assault Rifle', origin: 'K-9 Cell — modern loadout',
    damage: 28, headMul: 2.8, rpm: 780, mag: 30, reserve: 210,
    spread: 0.0085, adsSpread: 0.0016, moveSpread: 0.022,
    recoilV: 0.012, recoilH: 0.005, recoilRecover: 10,
    sway: 0.8, adsZoom: 1.5, reloadTime: 2.0, suppressed: false,
    auto: true, bullets: 1, muzzle: 0.95, sound: 'm4',
    desc: 'Flat-recoil carbine with an LPVO. The team\'s default; controllable in controlled pairs at range.'
  },
  mp5sd: {
    id: 'mp5sd', era: 'modern', name: 'MP5SD', nameAr: 'إم بي ٥',
    class: 'Suppressed SMG', origin: 'K-9 Cell — suppressed kit',
    damage: 21, headMul: 2.5, rpm: 800, mag: 30, reserve: 180,
    spread: 0.013, adsSpread: 0.004, moveSpread: 0.02,
    recoilV: 0.006, recoilH: 0.004, recoilRecover: 12,
    sway: 0.6, adsZoom: 1.3, reloadTime: 1.9, suppressed: true,
    auto: true, bullets: 1, muzzle: 0.35, sound: 'mp5sd',
    desc: 'Integrally suppressed. Firing does not carry beyond ~35 m, making it the stealth-clearance answer.'
  },
  sniper: {
    id: 'sniper', era: '1973', name: 'SVD-pattern DMR', nameAr: 'قناصة',
    class: 'Designated Marksman', origin: 'Squad marksman kit',
    damage: 85, headMul: 2.4, rpm: 60, mag: 10, reserve: 40,
    spread: 0.002, adsSpread: 0.0002, moveSpread: 0.03,
    recoilV: 0.045, recoilH: 0.006, recoilRecover: 4,
    sway: 2.2, adsZoom: 3.4, reloadTime: 3.0, suppressed: false,
    auto: false, bullets: 1, muzzle: 1.3, sound: 'sniper',
    desc: 'Squad marksman rifle. One shot, one decision; sway makes standing shots a gamble.'
  },
  pistol: {
    id: 'pistol', era: 'any', name: 'Service Pistol', nameAr: 'مسدس',
    class: 'Sidearm', origin: 'Officer\'s sidearm',
    damage: 26, headMul: 2.4, rpm: 420, mag: 8, reserve: 48,
    spread: 0.014, adsSpread: 0.004, moveSpread: 0.024,
    recoilV: 0.02, recoilH: 0.008, recoilRecover: 9,
    sway: 0.7, adsZoom: 1.25, reloadTime: 1.6, suppressed: false,
    auto: false, bullets: 1, muzzle: 0.8, sound: 'pistol',
    desc: 'Last resort. Quiet relative to a rifle, lethal at conversation range.'
  }
};

export const ERA_LOADOUTS = {
  '1973': {
    primary: ['akm', 'portsaid', 'rpd'],
    specialist: 'rpg7',
    marksman: 'sniper',
    sidearm: 'pistol'
  },
  modern: {
    primary: ['m4', 'mp5sd'],
    specialist: 'mp5sd',
    marksman: 'm4',
    sidearm: 'pistol'
  }
};

export function validateLoadout(era, ids) {
  for (const id of ids) {
    const w = WEAPONS[id];
    if (!w) throw new Error(`Unknown weapon ${id}`);
    if (w.era !== 'any' && w.era !== era) {
      throw new Error(`Weapon ${id} is ${w.era}, not available in ${era}`);
    }
  }
  return true;
}

// ---------------------------------------------------------------- projectile
export class Projectile {
  constructor(opts) {
    Object.assign(this, {
      pos: { x: 0, y: 0, z: 0 },
      vel: { x: 0, y: 0, z: 0 },
      damage: 30, headMul: 2.5, life: 3, tracer: true,
      explosive: null, owner: 'player', weapon: null, gravity: 0,
      color: 0xffd070
    }, opts);
    this.age = 0;
    this.dead = false;
  }
}

// ---------------------------------------------------------------- runtime
export class WeaponRuntime {
  constructor(def, owner) {
    this.def = def;
    this.owner = owner;
    this.ammo = def.mag;
    this.reserve = def.reserve;
    this.reloading = false;
    this.reloadT = 0;
    this.fireCooldown = 0;
    this.recoil = new THREE.Vector2(0, 0);
    this.recoilTarget = new THREE.Vector2(0, 0);
    this.swayT = Math.random() * 100;
    this.heat = 0;
    this.burstCount = 0;
    this.lastFire = -99;
    this.model = buildWeaponModel(def.id);
    this.muzzleFlash = null;
    this._buildFlash();
  }

  _buildFlash() {
    const flash = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(0.11, 0.42, 5),
      new THREE.MeshBasicMaterial({ color: 0xffc250, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    spike.rotation.x = -Math.PI / 2;
    spike.position.z = -0.2;
    flash.add(core, spike);
    flash.position.copy(this.model.userData.muzzle.position);
    flash.visible = false;
    this.model.add(flash);
    this.muzzleFlash = flash;
    this.flashLight = new THREE.PointLight(0xffcf80, 0, 14, 2);
    this.flashLight.position.copy(flash.position);
    this.model.add(this.flashLight);
  }

  get empty() { return this.ammo <= 0; }

  canFire() {
    return !this.reloading && this.ammo > 0 && this.fireCooldown <= 0;
  }

  fire(t) {
    this.ammo -= 1;
    this.fireCooldown = 60 / this.def.rpm;
    this.burstCount = t - this.lastFire < 0.35 ? this.burstCount + 1 : 0;
    this.lastFire = t;
    this.recoilTarget.x += this.def.recoilV * (1 + Math.min(this.burstCount, 6) * 0.08);
    this.recoilTarget.y += (Math.random() - 0.5) * this.def.recoilH * 2;
    this.heat = Math.min(1, this.heat + 0.12);
    // muzzle flash
    this.muzzleFlash.visible = true;
    this.muzzleFlash.rotation.z = Math.random() * Math.PI;
    this.muzzleFlash.scale.setScalar(0.8 + Math.random() * 0.6);
    this.flashLight.intensity = 3.2;
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => {
      this.muzzleFlash.visible = false;
      this.flashLight.intensity = 0;
    }, 45);
  }

  startReload() {
    if (this.reloading || this.ammo === this.def.mag || this.reserve <= 0) return false;
    this.reloading = true;
    this.reloadT = this.def.reloadTime;
    return true;
  }

  update(dt, moving = 0, aiming = false) {
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.reloading) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        const need = this.def.mag - this.ammo;
        const take = Math.min(need, this.reserve);
        this.ammo += take;
        this.reserve -= take;
        this.reloading = false;
      }
    }
    // recoil recovery
    this.recoil.lerp(this.recoilTarget, Math.min(1, dt * this.def.recoilRecover));
    this.recoilTarget.multiplyScalar(Math.max(0, 1 - dt * this.def.recoilRecover * 0.85));
    this.heat = Math.max(0, this.heat - dt * 0.35);
    this.swayT += dt * (1.2 + moving * 2.4);
    void aiming;
  }

  /** Current angular spread in radians. */
  currentSpread(moving, aiming, crouched) {
    const d = this.def;
    let s = aiming ? d.adsSpread : d.spread;
    s += moving * (aiming ? d.moveSpread * 0.4 : d.moveSpread);
    s += this.heat * 0.006;
    if (crouched) s *= 0.82;
    return s;
  }

  /** Viewmodel offset from sway/bob (applied to the FP camera holder). */
  viewOffset(moving, aiming, t) {
    const sway = this.def.sway * (aiming ? 0.25 : 1);
    return {
      x: Math.sin(this.swayT) * 0.006 * sway + Math.cos(t * 0.7) * 0.002,
      y: Math.sin(this.swayT * 2) * 0.004 * sway - moving * 0.006,
      rotZ: Math.sin(this.swayT) * 0.02 * sway * (1 - moving * 0.3),
      rotX: -moving * 0.01
    };
  }
}

// ---------------------------------------------------------------- sourced models
/**
 * Downloaded weapon models, fitted at runtime.
 *
 * The primitives in models.js stay as the fallback: they are authored straight
 * onto the grip frame, they exist on the first frame, and if a .glb fails to
 * load the weapon still appears. A sourced model replaces the primitive only
 * once it has been fitted AND the fit residuals are essentially zero — so a bad
 * pack cannot silently put the hands in the wrong place.
 *
 * Each entry is a CC0 pack export. Licence text lives next to the files in
 * public/models/weapons/LICENSE.txt so provenance travels with the build.
 */
export const SOURCED_WEAPONS = {
  akm: {
    url: './models/weapons/akm.glb',
    name: 'AKM (Flat Guns East, CC0)',
    // Anchors present in the pack's node names.
    leftAnchor: 'Magazine',
    rightAnchor: 'Trigger',
    muzzleNode: 'Attach_Muzzle'
  }
};

const _cache = new Map();
let _loader = null;

/**
 * Load and fit one sourced weapon. Resolves to null when the model is missing
 * or the fit is not exact; never throws, because a cosmetic upgrade must not be
 * able to break a running match.
 */
export async function loadSourcedWeapon(id) {
  if (_cache.has(id)) return _cache.get(id);
  const spec = SOURCED_WEAPONS[id];
  const done = (v) => { _cache.set(id, v); return v; };
  if (!spec) return done(null);

  try {
    _loader ||= new GLTFLoader();
    const doc = await _loader.loadAsync(spec.url);
    const fitted = fitWeaponModel(doc.scene, {
      name: spec.name,
      leftAnchor: spec.leftAnchor,
      rightAnchor: spec.rightAnchor,
      muzzleNode: spec.muzzleNode
    });
    const err = fitted.fitError;
    if (err && (err.left > 0.004 || err.right > 0.004)) {
      console.warn(`[weapons] ${id}: fit residual ${(err.left * 1000).toFixed(1)}mm / ${(err.right * 1000).toFixed(1)}mm — keeping primitives`);
      return done(null);
    }
    // The pack's materials are flat near-black, authored for a bright PBR rig.
    // Lift them to a readable gunmetal so the view-model's key/fill/rim lights
    // show the shape instead of a silhouette.
    fitted.root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const restyle = (src) => {
        const m = src.clone();
        if (m.color) {
          const l = 0.2126 * m.color.r + 0.7152 * m.color.g + 0.0722 * m.color.b;
          const v = Math.min(0.58, 0.13 + l * 2.1);
          m.color.setRGB(v * 0.97, v, v * 1.06);
        }
        if (m.roughness !== undefined) m.roughness = 0.58;
        if (m.metalness !== undefined) m.metalness = 0.42;
        m.side = THREE.FrontSide;
        return m;
      };
      o.material = Array.isArray(o.material) ? mats.map(restyle) : restyle(mats[0]);
      o.frustumCulled = false;
      o.castShadow = false;
      o.receiveShadow = false;
    });
    return done(fitted);
  } catch (e) {
    console.warn(`[weapons] ${id}: sourced model unavailable (${e.message})`);
    return done(null);
  }
}

/**
 * Swap a fitted model into a live WeaponRuntime, keeping the muzzle-flash and
 * muzzle marker glued to the new geometry.
 */
export function applySourcedWeapon(runtime, fitted) {
  if (!runtime || !fitted) return false;
  const old = runtime.model;
  const parent = old.parent;
  const flash = runtime.muzzleFlash;
  const light = runtime.flashLight;

  fitted.root.position.copy(old.position);
  fitted.root.rotation.copy(old.rotation);
  fitted.root.scale.copy(old.scale);
  fitted.root.userData.muzzle = fitted.root.userData.muzzle || new THREE.Object3D();
  // Muzzle marker in the fitted model's own space.
  fitted.root.userData.muzzle.position.copy(fitted.muzzle);
  if (!fitted.root.userData.muzzle.parent) fitted.root.add(fitted.root.userData.muzzle);

  if (parent) {
    parent.remove(old);
    parent.add(fitted.root);
  }
  if (flash) {
    flash.position.copy(fitted.muzzle);
    flash.visible = false;
    fitted.root.add(flash);
  }
  if (light) {
    light.position.copy(fitted.muzzle);
    fitted.root.add(light);
  }
  runtime.model = fitted.root;
  runtime.sourced = true;
  return true;
}

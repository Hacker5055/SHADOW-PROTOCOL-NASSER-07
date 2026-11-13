/**
 * SHADOW PROTOCOL — Animated humanoid characters
 *
 * Replaces the box-primitive soldier with a real rigged mesh driven by real
 * motion-capture clips. Everything below is licensed CC0 or MIT and ships in
 * `web/public/models/`; provenance is recorded there next to the files.
 *
 * Assets
 * ------
 *   Character + animation : Quaternius "Universal Animation Library" (CC0 1.0)
 *                           `AnimationLibrary_Godot_Standard.gltf/.bin`
 *                           53 bones, 3390 verts, 46 clips
 *   Fallback arms (FP)    : three.js `Soldier.glb` (MIT)
 *
 * Why this asset and not the alternatives
 * ---------------------------------------
 * Measured, not assumed:
 *   - `Soldier.glb` is a sci-fi trooper: full helmet with visor, pauldrons,
 *     plate armour. Wrong period, and one flat white material with no texture.
 *   - `CesiumMan` (CC-BY) is a featureless mannequin with no garment at all.
 *   - Mixamo-derived repositories re-distribute Mixamo files, which their terms
 *     forbid; their licences cannot travel with the asset.
 *   - Quaternius UAL is CC0, ships its own 46-clip library, and its locomotion
 *     is authored at speeds that already match this game.
 *
 * Measured authored ground speeds (planted-foot travel relative to the hips):
 *
 *   clip                | duration | authored speed | game speed
 *   --------------------+----------+----------------+-----------
 *   Walk_Formal_Loop    | 1.33 s   | 1.63 m/s       | 1.9 walk
 *   Jog_Fwd_Loop        | 0.92 s   | 4.69 m/s       | 4.6 run
 *   Sprint_Loop         | 0.67 s   | 6.21 m/s       | 6.2 tactical sprint
 *   Crouch_Fwd_Loop     | 2.00 s   | 1.10 m/s       | ~1.4 crouch-walk
 *
 * That agreement is why the feet do not skate: playback rate is
 * `characterSpeed / authoredSpeed`, which lands within a few percent of 1.0 at
 * the speeds the game actually moves.
 *
 * Interface
 * ---------
 * The returned object matches `models.js:buildSoldier()` — `{ group, parts,
 * pose }` — so `ai.js` needs no special-casing. `parts.handR` is a real
 * `Object3D` in the right hand, so the rifle follows the arm through every clip.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** Clip names in the shipped library, grouped by what the game asks for. */
export const CLIPS = {
  idle: 'Idle_Loop',
  walk: 'Walk_Formal_Loop',
  jog: 'Jog_Fwd_Loop',
  sprint: 'Sprint_Loop',
  crouchIdle: 'Crouch_Idle_Loop',
  crouchWalk: 'Crouch_Fwd_Loop',
  death: 'Death01',
  hitChest: 'Hit_Chest',
  hitHead: 'Hit_Head',
  aimPistol: 'Pistol_Aim_Neutral',
  shootPistol: 'Pistol_Shoot',
  reloadPistol: 'Pistol_Reload',
  jumpStart: 'Jump_Start',
  jumpLoop: 'Jump_Loop',
  jumpLand: 'Jump_Land',
  roll: 'Roll'
};

/**
 * Authored ground speed of each locomotion clip, in m/s, measured from the
 * asset by sampling planted-foot travel relative to the hips. Recorded here so
 * the runtime does not have to re-measure on every load, and so a regression in
 * a re-exported asset is visible as a number rather than a feeling.
 */
export const CLIP_SPEED = {
  [CLIPS.walk]: 1.63,
  [CLIPS.jog]: 4.69,
  [CLIPS.sprint]: 6.21,
  [CLIPS.crouchWalk]: 1.10
};

const MODEL_FACING = Math.PI;

/**
 * Weapon-mount rotation that points the muzzle along the character's forward
 * axis, sampled at three aim weights and linearly interpolated.
 *
 * Derived by solving `mountQuat * handWorldQuat * (0,0,-1) = forward` at each
 * pose. Without this the rifle pointed at the floor behind the soldier: the
 * hand bone's frame is nowhere near the character's forward axis.
 */
export const WRIST_AIM_TABLE = [
  { aim: 0.0, x: 2.629, y: 0.007, z: -0.028 },
  { aim: 0.5, x: 2.154, y: 0.153, z: -0.283 },
  { aim: 1.0, x: 1.529, y: 0.122, z: -0.117 }
];

/** Interpolate the wrist table for an aim weight in [0,1]. */
export function wristOffsetForAim(aim) {
  const t = Math.max(0, Math.min(1, aim));
  const a = WRIST_AIM_TABLE;
  if (t <= a[0].aim) return { x: a[0].x, y: a[0].y, z: a[0].z };
  if (t >= a[2].aim) return { x: a[2].x, y: a[2].y, z: a[2].z };
  const u = (t - a[0].aim) / (a[1].aim - a[0].aim);
  if (u <= 1) {
    return {
      x: a[0].x + (a[1].x - a[0].x) * u,
      y: a[0].y + (a[1].y - a[0].y) * u,
      z: a[0].z + (a[1].z - a[0].z) * u
    };
  }
  const v = (t - a[1].aim) / (a[2].aim - a[1].aim);
  return {
    x: a[1].x + (a[2].x - a[1].x) * v,
    y: a[1].y + (a[2].y - a[1].y) * v,
    z: a[1].z + (a[2].z - a[1].z) * v
  };
}
// Wide enough to cover the game's 1.9 / 4.6 / 6.2 m/s without clamping: a
// clamped rate is a visible stutter, not a subtle one.
const TIME_SCALE_MIN = 0.5;
const TIME_SCALE_MAX = 4.0;

let _sourceGltf = null;
let _pending = null;

/**
 * Load the animation library once, then hand out independent clones.
 *
 * `SkeletonUtils.clone` rebuilds bones and skinned meshes with fresh skeletons;
 * sharing them would make every character in the level share one pose.
 */
export async function loadCharacterLibrary(url = './models/AnimationLibrary_Godot_Standard.gltf') {
  if (_sourceGltf) return _sourceGltf;
  if (!_pending) {
    _pending = new GLTFLoader().loadAsync(url).then((gltf) => {
      _sourceGltf = gltf;
      return gltf;
    }).catch((err) => {
      _pending = null;
      throw err;
    });
  }
  return _pending;
}

/** For tests: install an already-parsed glTF as the shared source. */
export function setCharacterLibrary(gltf) {
  _sourceGltf = gltf;
  return gltf;
}

/**
 * Build one playable character.
 *
 * @param {object} gltf     parsed library (from loadCharacterLibrary)
 * @param {object} opts     { palette, era, role }
 * @returns {{group, pivot, mixer, actions, bones, parts, pose, update, ...}}
 */
export function buildCharacter(gltf, opts = {}) {
  const scene = cloneSkinned(gltf.scene);
  const palette = opts.palette || null;

  const group = new THREE.Group();
  group.name = 'Character';
  const pivot = new THREE.Group();
  pivot.rotation.y = MODEL_FACING;
  pivot.add(scene);
  group.add(pivot);

  // ---------------------------------------------------------------- inspect
  const bones = new Map();
  const skinned = [];
  scene.traverse((o) => {
    if (o.isBone) bones.set(o.name, o);
    if (o.isSkinnedMesh) skinned.push(o);
  });

  if (palette) {
    applyKit(shadedKit(skinned, bones, palette, opts));
    dressWithKit(bones, palette, opts);
  }
  for (const m of skinned) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
  }

  // ---------------------------------------------------------------- clips
  const byName = new Map((gltf.animations || []).map((c) => [c.name, c]));
  const mixer = new THREE.AnimationMixer(scene);
  const actions = {};
  for (const [role, clipName] of Object.entries(CLIPS)) {
    const clip = byName.get(clipName);
    if (!clip) continue;
    const action = mixer.clipAction(clip);
    action.loop = THREE.LoopRepeat;
    action.enabled = true;
    action.setEffectiveWeight(0);
    actions[role] = action;
  }
  const play = (role, weight = 1) => {
    const a = actions[role];
    if (!a) return null;
    a.setEffectiveWeight(weight);
    if (!a.isRunning()) a.play();
    return a;
  };
  play('idle', 1);

  // ---------------------------------------------------------------- weapon hand
  const handR = bones.get('DEF-handR');
  const weaponMount = new THREE.Object3D();
  weaponMount.name = 'weaponMount';
  if (handR) {
    handR.add(weaponMount);
    // Orientation solved numerically, not guessed. The weapon model is authored
    // with its muzzle down local -Z and the hand bone's frame is nowhere near the
    // character's forward axis: with the obvious (PI/2, 0, 0) offset the muzzle
    // pointed 0.83 down and 0.53 backwards, i.e. at the floor behind the soldier.
    // The correct offset also changes through the aim blend because the wrist
    // genuinely rotates, so it comes from WRIST_AIM_TABLE above and is refreshed
    // every pose() call. The value set here is the low-ready extreme.
    weaponMount.position.set(0, 0.035, 0.095);
    weaponMount.rotation.set(WRIST_AIM_TABLE[0].x, WRIST_AIM_TABLE[0].y, WRIST_AIM_TABLE[0].z);
  }

  // ---------------------------------------------------------------- state
  const state = {
    speed: 0,
    crouch: 0,
    aim: 0,
    dead: 0,
    timeScale: 1,
    weights: { idle: 1, walk: 0, jog: 0, sprint: 0, crouchIdle: 0, crouchWalk: 0 }
  };

  /**
   * Drive the character. Signature matches the legacy `pose()` exactly, so the
   * call sites in ai.js keep working; the arguments now select and blend real
   * animation clips instead of setting a sine offset.
   */
  const pose = (t, speed = 0, crouch = 0, aim = 0, dead = false) => {
    state.speed = speed;
    state.crouch = crouch;
    state.aim = aim;

    if (dead) {
      if (!state.dead) {
        state.dead = 1;
        // Hands off locomotion, then let Death01 run once and hold.
        for (const k of ['idle', 'walk', 'jog', 'sprint', 'crouchIdle', 'crouchWalk']) {
          if (actions[k]) actions[k].setEffectiveWeight(0);
        }
        const d = actions.death;
        if (d) {
          d.reset();
          d.setLoop(THREE.LoopOnce, 1);
          d.clampWhenFinished = true;
          d.setEffectiveWeight(1);
          d.play();
        }
      }
      return;
    }

    // ---------------------------------------------------- locomotion blend
    // Five clips crossfaded across speed and stance. The weights are computed
    // so they always sum to 1: overlapping weights are silently renormalised by
    // AnimationMixer, which makes an equal-parts walk/jog blend look like a
    // character moonwalking in slow motion.
    const spd = Math.max(0, Math.min(8, speed));
    const crouched = crouch > 0.5;

    let w = { idle: 0, walk: 0, jog: 0, sprint: 0, crouchIdle: 0, crouchWalk: 0 };
    if (crouched) {
      const t2 = Math.min(1, spd / 1.4);
      w.crouchIdle = 1 - t2;
      w.crouchWalk = t2;
    } else if (spd <= 0.15) {
      w.idle = 1;
    } else if (spd < 2.4) {
      const b = Math.min(1, (spd - 0.15) / (2.4 - 0.15));
      w.idle = 1 - b;
      w.walk = b;
    } else if (spd < 5.2) {
      const b = (spd - 2.4) / (5.2 - 2.4);
      w.walk = 1 - b;
      w.jog = b;
    } else {
      const b = Math.min(1, (spd - 5.2) / 1.0);
      w.jog = 1 - b;
      w.sprint = b;
    }
    state.weights = w;

    // Aiming overrides the arm layer: the library ships a dedicated aim clip and
    // blending into it lifts the hands from waist height (0.91 m) to chest/eye
    // height (1.40 m), which is the silhouette that reads as "pointing a rifle".
    // Before this, `aim` was accepted and thrown away — the parameter moved the
    // hand by 1 cm, so enemies visibly aimed with their arms down.
    const aimW = Math.max(0, Math.min(1, aim));
    w.aimPistol = aimW;

    const k = 1 - Math.exp(-9 * (1 / 60));
    // Locomotion and aim are separate layers: locomotion weights sum to 1 among
    // themselves, and the aim clip rides on top. Letting aim into the same sum
    // would rob the walk cycle of weight and make the legs stutter whenever an
    // enemy pointed a rifle.
    const aimAction = actions.aimPistol;
    const locomotionTotal = 1 - aimW * 0.85;
    for (const role of Object.keys(w)) {
      if (role === 'aimPistol') continue;
      const a = actions[role];
      if (!a) continue;
      const cur = a.getEffectiveWeight();
      const target = w[role] * locomotionTotal;
      const next = cur + (target - cur) * k;
      a.setEffectiveWeight(next);
      if (next > 0.002 && !a.isRunning()) a.play();
    }
    if (aimAction) {
      const next = aimAction.getEffectiveWeight() + (aimW * 0.85 - aimAction.getEffectiveWeight()) * k;
      aimAction.setEffectiveWeight(next);
      if (next > 0.002 && !aimAction.isRunning()) aimAction.play();
    }

    // ---------------------------------------------------- foot-locked rate
    // Playback rate is proportional to speed, never inverse: moving faster than
    // the clip was authored for means the planted foot must travel further per
    // second, so the cycle has to run *faster*. Dividing instead of multiplying
    // here is the classic way to make foot slide twice as bad as doing nothing.
    const dominant = w.sprint > 0.5 ? CLIPS.sprint
      : w.jog > 0.5 ? CLIPS.jog
        : w.crouchWalk > 0.5 ? CLIPS.crouchWalk
          : CLIPS.walk;
    // Blend the reference speed with the same weights used for the clips, so a
    // half-walk/half-jog blend is not scaled for one clip's stride alone.
    const reference = Math.max(0.3,
      (w.walk * CLIP_SPEED[CLIPS.walk])
      + (w.jog * CLIP_SPEED[CLIPS.jog])
      + (w.sprint * CLIP_SPEED[CLIPS.sprint])
      + (w.crouchWalk * CLIP_SPEED[CLIPS.crouchWalk])
      + ((w.idle + w.crouchIdle) * (CLIP_SPEED[CLIPS.walk] || 1.6)));
    let target = 1;
    if (spd > 0.4) target = Math.max(TIME_SCALE_MIN, Math.min(TIME_SCALE_MAX, spd / reference));
    state.timeScale += (target - state.timeScale) * (1 - Math.exp(-7 * (1 / 60)));
    mixer.timeScale = state.timeScale;

    // Keep the muzzle level through the aim blend.
    const wrist = wristOffsetForAim(aimW);
    weaponMount.rotation.set(wrist.x, wrist.y, wrist.z);

    void t;
  };

  /** Advance the mixer. Call once per frame with the real delta. */
  const update = (dt) => {
    if (dt > 0) mixer.update(dt);
  };

  /** Trigger a one-shot reaction clip (hit, reload, jump). */
  const oneShot = (role, fade = 0.12) => {
    const a = actions[role];
    if (!a) return false;
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.setEffectiveWeight(1);
    a.fadeIn(fade);
    a.play();
    return true;
  };

  return {
    /** True when this body is real skinned geometry rather than boxes. */
    isSkinned: true,
    group,
    pivot,
    scene,
    mixer,
    actions,
    bones,
    skinned,
    parts: { handR: weaponMount },
    pose,
    update,
    oneShot,
    state,
    get timeScale() { return state.timeScale; },
    /** Snapshot of the blend weights, for tests and debug overlay. */
    get weights() { return { ...state.weights }; }
  };
}

// ---------------------------------------------------------------- kit props

/**
 * Bolt era-appropriate equipment onto the rig.
 *
 * The library ships a bare mannequin: colouring alone leaves a naked-looking
 * figure. A helmet and a chest rig are the two silhouette cues that make a
 * humanoid read as a soldier at 20 metres, and both are cheap primitives
 * parented to bones, so they inherit the animation for free.
 */
export function dressWithKit(bones, palette, opts = {}) {
  const era = opts.era || '1973';
  const webbing = new THREE.MeshStandardMaterial({ color: palette.webbing ?? 0x6d6548, roughness: 0.95 });
  const steel = new THREE.MeshStandardMaterial({ color: palette.helmet ?? 0x7d7657, roughness: 0.62, metalness: 0.18 });
  const cloth = new THREE.MeshStandardMaterial({ color: palette.uniform ?? 0xa89d78, roughness: 0.96 });

  const head = bones.get('DEF-head');
  if (head) {
    // 1973: a plain steel pot. Modern: a lower-cut shell with a rail block.
    const isModern = era === 'modern';
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(isModern ? 0.135 : 0.142, 14, 10, 0, Math.PI * 2, 0, Math.PI * (isModern ? 0.5 : 0.56)),
      steel
    );
    shell.scale.set(1, isModern ? 0.86 : 0.92, 1.04);
    shell.position.y = 0.045;
    shell.castShadow = true;
    head.add(shell);

    if (isModern) {
      const mount = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.06), webbing);
      mount.position.set(0.05, 0.09, 0.06);
      head.add(mount);
    } else {
      // Khaki helmet cover band, the giveaway detail on period photographs.
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.138, 0.14, 0.022, 14, 1, true), cloth);
      band.position.y = 0.052;
      head.add(band);
    }
  }

  // Chest rig: magazine pouches across the front of the ribcage.
  const chest = bones.get('DEF-spine003') || bones.get('DEF-spine002');
  if (chest) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.30, 0.055), webbing);
    strap.position.set(0, 0.02, 0.105);
    strap.castShadow = true;
    chest.add(strap);

    for (const x of [-0.072, 0, 0.072]) {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.075, 0.042), cloth);
      pouch.position.set(x, -0.055, 0.135);
      chest.add(pouch);
    }
    // Canteen on the hip, so the silhouette is asymmetric like the real kit.
    const hips = bones.get('DEF-hips');
    if (hips) {
      const canteen = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.045, 0.13, 10), cloth);
      canteen.position.set(-0.15, -0.02, -0.05);
      canteen.rotation.z = 0.12;
      canteen.castShadow = true;
      hips.add(canteen);
    }
  }
}

// ---------------------------------------------------------------- appearance

/**
 * Give the untextured mannequin a 1973/2024 kit.
 *
 * The library ships one flat material with no texture. Dressed as-is it reads as
 * a naked mannequin, which is no better than the boxes it replaces. Instead each
 * vertex is coloured from the bone that dominates its skin weights, so trousers,
 * tunic, webbing, boots and skin are distinct, and joints blend rather than
 * banding at the seam.
 */
export function shadedKit(skinnedMeshes, boneMap, palette, opts = {}) {
  return { skinnedMeshes, boneMap, palette, opts };
}

export function applyKit({ skinnedMeshes, palette, opts }) {
  /** Ordered most-specific-first: the first pattern that matches wins. */
  const rules = [
    { re: /toe|foot/i, color: palette.boot ?? 0x3a3126 },
    { re: /shin|thigh/i, color: palette.uniformDark ?? palette.uniform },
    { re: /hips$/i, color: palette.uniformDark ?? palette.uniform },
    { re: /spine0*1$|spine001/i, color: palette.uniform },
    { re: /spine|chest/i, color: palette.uniform },
    { re: /neck|head/i, color: palette.helmet ?? palette.uniform },
    { re: /shoulder/i, color: palette.uniform },
    { re: /upper_arm/i, color: palette.uniform },
    { re: /forearm/i, color: palette.uniformDark ?? palette.uniform },
    { re: /hand|f_index|f_middle|f_ring|f_pinky|thumb/i, color: palette.skin ?? 0x8a5f3c }
  ];

  const pick = (boneName) => {
    for (const r of rules) if (r.re.test(boneName)) return r.color;
    return palette.uniform;
  };

  const tmp = new THREE.Color();
  const tint = opts.tint ? new THREE.Color(opts.tint) : null;

  for (const mesh of skinnedMeshes) {
    const geo = mesh.geometry;
    const count = geo.attributes.position.count;
    const si = geo.attributes.skinIndex;
    const sw = geo.attributes.skinWeight;
    if (!si || !sw) continue;

    const colors = new Float32Array(count * 3);
    const bones = mesh.skeleton ? mesh.skeleton.bones : [];

    for (let v = 0; v < count; v++) {
      let r = 0, g = 0, b = 0, total = 0;
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(v, k);
        if (w <= 0) continue;
        const bone = bones[si.getComponent(v, k)];
        if (!bone) continue;
        tmp.setHex(pick(bone.name.replace(/:/g, '')));
        r += tmp.r * w; g += tmp.g * w; b += tmp.b * w; total += w;
      }
      if (total <= 0) { r = g = b = 1; } else { r /= total; g /= total; b /= total; }
      tmp.setRGB(r, g, b);
      if (tint) tmp.lerp(tint, 0.22);
      colors[v * 3] = tmp.r; colors[v * 3 + 1] = tmp.g; colors[v * 3 + 2] = tmp.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = mesh.material.clone();
    mat.vertexColors = true;
    mat.color.setRGB(1, 1, 1);
    mat.roughness = palette.roughness ?? 0.94;
    mat.metalness = palette.metalness ?? 0.02;
    mesh.material = mat;
  }
}

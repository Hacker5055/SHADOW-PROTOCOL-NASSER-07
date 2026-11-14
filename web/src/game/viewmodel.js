/**
 * SHADOW PROTOCOL — First-person arms (skinned)
 *
 * Real skinned geometry: an armature driven by hand-authored pose tracks, with
 * a bind-pose mesh weighted to it. This replaces the old "gun floating in front
 * of the camera with no hands" placeholder.
 *
 * Design
 * ------
 *  - One armature, six bones: Shoulder → UpperArm → Forearm → Hand, plus a
 *    mirrored set for the support arm. Poses are keyframed tracks, not sines.
 *  - The rifle is parented to the right hand bone, so it inherits every hand
 *    movement instead of being animated separately.
 *  - State machine drives the whole thing: IDLE / WALK / RUN / ADS / FIRE /
 *    RELOAD / INSPECT. Reload is split into real phases with events, so the
 *    magazine actually leaves the gun before the new one goes in.
 *
 * Everything is deterministic and headless-testable: `update(dt)` advances the
 * clips and exposes `pose` + `events` with no renderer involved.
 */

import * as THREE from 'three';

export const ARM_STATE = {
  IDLE: 'idle',
  WALK: 'walk',
  RUN: 'run',
  ADS: 'ads',
  FIRE: 'fire',
  RELOAD: 'reload',
  EMPTY: 'empty'
};

/**
 * Reload phases, as fractions of the reload duration.
 *
 * The visual dip is driven by `at`, and each `event` is emitted once when the
 * timeline crosses it so audio, shell ejection and the HUD all key off the same
 * source of truth instead of a pile of setTimeouts drifting apart.
 */
export const RELOAD_PHASES = [
  { name: 'grip',    at: 0.00, event: null },
  { name: 'eject',   at: 0.16, event: 'mag-out' },
  { name: 'insert',  at: 0.42, event: 'mag-in' },
  { name: 'seat',    at: 0.62, event: 'bolt' },
  { name: 'shoulder', at: 0.82, event: 'ready' },
  { name: 'done',    at: 1.00, event: null }
];

/**
 * Nominal shoulder-to-wrist length of a viewmodel arm, in metres.
 *
 * ADVISORY ONLY — nothing normalises the rig to it any more. Rescaling the rig
 * to hit this number was what inflated Soldier.glb by 1.40x, giving half-metre
 * forearms and a boot-sized hand. The asset's real reach is 0.473 m (Mixamo's
 * Vanguard is a little short-armed, real adults are ~0.55 m) and the grip
 * positions are placed to fit inside whatever reach the rig actually has.
 *
 * Use `_armReach()` to read the live value; tools/fpview.mjs prints it.
 */
export const ARM_REACH = 0.66;

/** Bone lengths in metres — tuned against a 1.78 m soldier. */
export const ARM_DIMS = {
  upper: 0.29,
  fore: 0.26,
  hand: 0.10
};

/** Mixamo bone prefix, after three.js strips the ':' from 'mixamorig:RightHand'. */
const RIG_PREFIX = 'mixamorig';
/**
 * Scale applied to a skinned rig on top of whatever the asset already carries.
 *
 * `Soldier.glb`'s root node already applies 0.01 (centimetres -> metres), so the
 * parsed scene is metric and this must stay 1. Use `_setupRigTransform`, which
 * calibrates against the actual shoulder span, rather than multiplying here.
 */
export const RIG_UNIT_SCALE = 1;

/** Normalises 'mixamorig:RightHand' and 'mixamorigRightHand' to one form. */
export function normaliseBoneName(name) {
  return String(name).replace(/:/g, '');
}

export const ARM_BONE_GROUPS = {
  right: armBoneList('Right'),
  left: armBoneList('Left')
};

function armBoneList(side) {
  const out = [`${RIG_PREFIX}${side}Shoulder`, `${RIG_PREFIX}${side}Arm`, `${RIG_PREFIX}${side}ForeArm`, `${RIG_PREFIX}${side}Hand`];
  for (const finger of ['Thumb', 'Index', 'Middle', 'Ring']) {
    for (let n = 1; n <= 3; n++) out.push(`${RIG_PREFIX}${side}Hand${finger}${n}`);
  }
  return out;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ---------------------------------------------------------------- materials
let _sleeveMat = null;
let _sleeveMatWorn = null;
let _gloveMat = null;

function sleeveMat(color, worn = false) {
  if (worn) {
    if (_sleeveMatWorn) return _sleeveMatWorn;
    _sleeveMatWorn = new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0.0 });
    return _sleeveMatWorn;
  }
  if (_sleeveMat) return _sleeveMat;
  _sleeveMat = new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0.02 });
  return _sleeveMat;
}

function gloveMat(color) {
  if (_gloveMat) return _gloveMat;
  _gloveMat = new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.08 });
  return _gloveMat;
}

// ---------------------------------------------------------------- solver
//
// Both rigs pose arms the same way: a two-bone analytic IK solve from a
// shoulder that is fixed in view space to a wrist target that is fixed in
// weapon space. Authoring Euler angles per clip means hand-tuning 8 poses x 4
// joints x 2 arms and the hands still drift off the weapon the moment it
// recoils. Solving for the target instead means the hands are always *on* the
// weapon, which is the single biggest reason first-person arms read as
// attached rather than floating.

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

/**
 * Analytic two-bone IK: returns the elbow position for a limb rooted at `a`
 * whose tip should reach `target`, with segment lengths len1/len2, bending
 * toward `pole`.
 */
export function solveTwoBone(a, target, len1, len2, pole, outElbow) {
  _v1.copy(target).sub(a);
  let dist = _v1.length();
  if (dist < 1e-5) { _v1.set(0, -1, 0); dist = 1e-5; }
  _v1.divideScalar(dist);

  const maxReach = (len1 + len2) * 0.999;
  const minReach = Math.abs(len1 - len2) * 1.001;
  const clamped = Math.min(maxReach, Math.max(minReach, dist));

  const cosA = (len1 * len1 + clamped * clamped - len2 * len2) / (2 * len1 * clamped);
  const angle = Math.acos(Math.max(-1, Math.min(1, cosA)));

  // Bend plane: axis is arm direction, normal derived from the pole.
  _v2.copy(pole).sub(a);
  _v2.addScaledVector(_v1, -_v2.dot(_v1));
  if (_v2.lengthSq() < 1e-8) {
    _v2.set(0, 0, 1).cross(_v1);
    if (_v2.lengthSq() < 1e-8) _v2.set(1, 0, 0);
  }
  _v2.normalize();

  outElbow.copy(a)
    .addScaledVector(_v1, Math.cos(angle) * len1)
    .addScaledVector(_v2, Math.sin(angle) * len1);
  return outElbow;
}

// ---------------------------------------------------------------- procedural rig

/**
 * Fallback rig: six rigid-skinned tapered segments.
 *
 * Used for the first frames before the glTF resolves, and permanently if the
 * fetch fails. Deliberately simple geometry — it is a bridge, not the target
 * look — but it is driven by exactly the same IK, so the hands land in the
 * same place as the skinned rig and the swap is invisible in silhouette.
 */
export function buildFirstPersonArms(opts = {}) {
  const sleeve = opts.sleeveColor ?? 0x6b6a4e;
  const glove = opts.gloveColor ?? 0x2a2b26;
  const skin = opts.skinColor ?? 0x8a5f3c;

  const root = new THREE.Group();
  root.name = 'FPArmsProcedural';

  /**
   * Bones sit *at joints*, and each segment mesh is bound to the joint it hangs
   * from — so `upper` is the elbow, `fore` is the wrist. Getting this one level
   * off is what makes an IK-driven arm look like it has two elbows.
   */
  const makeArm = (side) => {
    const sign = side === 'R' ? 1 : -1;
    const shoulder = new THREE.Bone();          // shoulder joint
    shoulder.name = `shoulder${side}`;
    shoulder.position.set(0.185 * sign, 0.0, 0);

    const upper = new THREE.Bone();             // elbow joint
    upper.name = `upper${side}`;
    upper.position.set(0, -ARM_DIMS.upper, 0);
    shoulder.add(upper);

    const fore = new THREE.Bone();              // wrist joint
    fore.name = `fore${side}`;
    fore.position.set(0, -ARM_DIMS.fore, 0);
    upper.add(fore);

    const hand = new THREE.Bone();              // knuckles
    hand.name = `hand${side}`;
    hand.position.set(0, -ARM_DIMS.hand, 0);
    fore.add(hand);

    return { shoulder, upper, fore, hand };
  };

  const armR = makeArm('R');
  const armL = makeArm('L');

  const rigRoot = new THREE.Bone();
  rigRoot.name = 'rigRoot';
  rigRoot.add(armR.shoulder);
  rigRoot.add(armL.shoulder);

  const segments = [
    { bone: armR.shoulder, len: ARM_DIMS.upper, r0: 0.062, r1: 0.050, mat: sleeveMat(sleeve) },
    { bone: armR.upper,    len: ARM_DIMS.fore,  r0: 0.050, r1: 0.039, mat: sleeveMat(sleeve, true) },
    { bone: armR.fore,     len: ARM_DIMS.hand,  r0: 0.040, r1: 0.031, mat: gloveMat(glove) },
    { bone: armL.shoulder, len: ARM_DIMS.upper, r0: 0.062, r1: 0.050, mat: sleeveMat(sleeve) },
    { bone: armL.upper,    len: ARM_DIMS.fore,  r0: 0.050, r1: 0.039, mat: sleeveMat(sleeve, true) },
    { bone: armL.fore,     len: ARM_DIMS.hand,  r0: 0.040, r1: 0.031, mat: gloveMat(glove) }
  ];

  const meshes = [];
  for (const seg of segments) {
    const geo = new THREE.CylinderGeometry(seg.r0, seg.r1, seg.len, 10, 3, false);
    geo.translate(0, -seg.len / 2, 0);
    geo.computeVertexNormals();

    const count = geo.attributes.position.count;
    const si = new Uint16Array(count * 4);
    const sw = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) sw[i * 4] = 1;
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));

    const mesh = new THREE.SkinnedMesh(geo, seg.mat);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    mesh.bind(new THREE.Skeleton([seg.bone]), new THREE.Matrix4());
    seg.bone.add(mesh);
    meshes.push(mesh);
  }

  root.add(rigRoot);

  return {
    root,
    rigRoot,
    bones: {
      shoulderR: armR.shoulder, upperR: armR.upper, foreR: armR.fore, handR: armR.hand,
      shoulderL: armL.shoulder, upperL: armL.upper, foreL: armL.fore, handL: armL.hand
    },
    hands: { right: armR.hand, left: armL.hand },
    meshes,
    materials: { sleeve: sleeveMat(sleeve), glove: gloveMat(glove) }
  };
}

// ---------------------------------------------------------------- skinned rig

/**
 * Turn a loaded Soldier.glb into a first-person arm rig.
 *
 * Filters the body geometry down to arm triangles at the geometry level rather
 * than hiding the rest: no wasted fill, and no chance of a helmet clipping into
 * the near plane. Skin weights are preserved exactly; only the triangle list
 * and the bone index remap change.
 *
 * The bone hierarchy is kept intact (bones do not render) because the arm
 * bones' world transforms depend on the spine above them.
 */
export function soldierToFirstPersonArms(gltfScene) {
  const root = new THREE.Group();
  root.name = 'FPSoldierArms';

  const skinned = [];
  gltfScene.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
  if (!skinned.length) throw new Error('soldier asset has no skinned meshes');

  // The body mesh carries all 49 joints; the visor mesh carries 2.
  const body = skinned.reduce((a, b) => (b.skeleton.bones.length > a.skeleton.bones.length ? b : a));
  const skeleton = body.skeleton;
  const boneNames = skeleton.bones.map((b) => normaliseBoneName(b.name));
  const boneByName = new Map();
  skeleton.bones.forEach((b, i) => boneByName.set(boneNames[i], b));

  // Two different sets, and the difference matters.
  //
  // `chainNames` is what the two-bone IK drives: shoulder, upper arm, forearm,
  // hand. All 49 bones stay in the skeleton either way (see the note below on
  // why the weights must not be touched), so nothing needs trimming here.
  //
  // `visibleNames` is what actually gets DRAWN: forearm, hand and fingers only.
  // Drawing the upper arm and deltoid as well put a half-metre sleeve across
  // the whole left half of the frame — a real first-person view shows the
  // forearms and hands, never the shoulder. The shoulder geometry is still
  // skinned and still moving, it is simply not submitted.
  const chainNames = new Set([...ARM_BONE_GROUPS.right, ...ARM_BONE_GROUPS.left].map(normaliseBoneName));
  const visibleNames = new Set();
  // Bone names are CamelCase: mixamorigRightForeArm. Building these from the
  // lowercase side ('right') produced mixamorigrightForeArm, which matched
  // nothing and left the arm filter with zero triangles.
  for (const Side of ['Right', 'Left']) {
    visibleNames.add(normaliseBoneName(`${RIG_PREFIX}${Side}ForeArm`));
    visibleNames.add(normaliseBoneName(`${RIG_PREFIX}${Side}Hand`));
    for (const finger of ['Thumb', 'Index', 'Middle', 'Ring']) {
      for (let n = 1; n <= 3; n++) visibleNames.add(normaliseBoneName(`${RIG_PREFIX}${Side}Hand${finger}${n}`));
    }
  }
  const isArmBone = new Uint8Array(boneNames.length);
  let armBoneCount = 0;
  boneNames.forEach((name, i) => {
    if (chainNames.has(name)) armBoneCount++;
    if (visibleNames.has(name)) isArmBone[i] = 1;
  });
  if (!armBoneCount) throw new Error('no arm bones found — rig naming changed?');

  const geo = body.geometry;
  const idx = geo.index;
  const pos = geo.attributes.position;
  const si = geo.attributes.skinIndex;
  const sw = geo.attributes.skinWeight;
  const triCount = idx ? idx.count / 3 : pos.count / 3;

  // Compact skinIndex/skinWeight before anything reads them.
  //
  // Soldier.glb stores these two attributes in an INTERLEAVED bufferView with a
  // 32-byte stride. GLTFLoader builds the typed array straight off that view, so
  // `array.length` came out at 234,400 for a 7,325-vertex mesh that only needs
  // 29,300 — eight vertices' worth of bytes per vertex. `getComponent()` walks
  // the accessor's own stride and is correct; the raw `array` is not.
  //
  // The arm filter below used to index the raw array through getComponent, so it
  // was reading joints and weights belonging to other vertices. Nearly every
  // triangle then looked arm-dominated (2,756 of 11,186 kept, spanning 184
  // metres of the model) and the first-person view drew the soldier's whole body
  // around the camera instead of two forearms. Rebuilding the attributes from
  // the authoritative accessor gives 29,300 entries, a max joint index of 48
  // (the skeleton really is 49 bones) and weight sums of exactly 1.000.
  {
    const vertCount = si.count;
    const cj = new Uint16Array(vertCount * 4);
    const cw = new Float32Array(vertCount * 4);
    for (let v = 0; v < vertCount; v++) {
      for (let k = 0; k < 4; k++) {
        cj[v * 4 + k] = si.getComponent(v, k);
        cw[v * 4 + k] = sw.getComponent(v, k);
      }
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(cj, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(cw, 4));
  }
  const si2 = geo.attributes.skinIndex;
  const sw2 = geo.attributes.skinWeight;

  // How much of each vertex is driven by arm bones (0..1).
  const armWeight = new Float32Array(pos.count);
  for (let v = 0; v < pos.count; v++) {
    let s = 0;
    for (let k = 0; k < 4; k++) {
      const w = sw2.getComponent(v, k);
      if (w > 0 && isArmBone[si2.getComponent(v, k)]) s += w;
    }
    armWeight[v] = s;
  }

  // Draw only triangles that are actually sleeve/hand: at least two corners
  // arm-dominated. Everything else (torso, legs, head) is discarded.
  const keepTri = [];
  for (let t = 0; t < triCount; t++) {
    const a = idx ? idx.getX(t * 3) : t * 3;
    const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    // At least one corner must be strongly forearm/hand. The threshold is
    // lower than the old arm-only pass (1.5) because the mask no longer counts
    // the upper arm, so a wrist triangle tops out near 1.0 rather than 2.0.
    if (armWeight[a] + armWeight[b] + armWeight[c] < 0.9) continue;
    keepTri.push(a, b, c);
  }
  if (!keepTri.length) {
    const dbg = { armBoneCount, visible: [...visibleNames].slice(0, 4), kept: 0, maxW: Math.max(...armWeight) };
    throw new Error(`arm filter kept no triangles ${JSON.stringify(dbg)}`);
  }

  // Compact the vertex set, but copy skinIndex/skinWeight through UNCHANGED.
  //
  // An earlier version dropped the non-arm influences and renormalised what
  // was left. That does not merely thin the skeleton — it changes the surface.
  // A boundary vertex weighted to both the deltoid and the spine snapped fully
  // onto the arm bone and shot out of the frame as a spike. Keeping the real
  // weights against the real 49-bone skeleton means the visible sleeve deforms
  // exactly as it does on the full character; the triangles we threw away are
  // simply not drawn.
  const used = new Map();
  const outPos = [], outNrm = [], outUv = [], outSI = [], outSW = [];
  const nrm = geo.attributes.normal;
  const uv = geo.attributes.uv;
  const emit = (v) => {
    let n = used.get(v);
    if (n !== undefined) return n;
    n = used.size;
    used.set(v, n);
    outPos.push(pos.getX(v), pos.getY(v), pos.getZ(v));
    if (nrm) outNrm.push(nrm.getX(v), nrm.getY(v), nrm.getZ(v));
    if (uv) outUv.push(uv.getX(v), uv.getY(v));
    for (let k = 0; k < 4; k++) {
      outSI.push(si2.getComponent(v, k));
      outSW.push(sw2.getComponent(v, k));
    }
    return n;
  };

  const outIndex = new Uint32Array(keepTri.length);
  for (let i = 0; i < keepTri.length; i++) outIndex[i] = emit(keepTri[i]);

  const outGeo = new THREE.BufferGeometry();
  outGeo.setAttribute('position', new THREE.Float32BufferAttribute(outPos, 3));
  if (outNrm.length) outGeo.setAttribute('normal', new THREE.Float32BufferAttribute(outNrm, 3));
  if (outUv.length) outGeo.setAttribute('uv', new THREE.Float32BufferAttribute(outUv, 2));
  outGeo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(outSI, 4));
  outGeo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(outSW, 4));
  outGeo.setIndex(new THREE.BufferAttribute(outIndex, 1));
  outGeo.computeBoundingBox();
  outGeo.computeBoundingSphere();

  const material = body.material.clone();
  material.side = THREE.FrontSide;

  // Keep the asset's own graph: `Character` (scale 0.01) -> Armature -> bones
  // -> mesh. The mesh and its bones therefore share one node, so three derives
  // bindMatrix and the inverse bind matrices from the authored bind pose and
  // the 0.01 cannot be lost. Everything except the body mesh is removed.
  const sceneRoot = gltfScene;
  const drop = [];
  sceneRoot.traverse((o) => { if (o.isSkinnedMesh && o !== body) drop.push(o); });
  for (const o of drop) o.parent && o.parent.remove(o);

  body.geometry = outGeo;
  body.material = material;
  body.castShadow = false;
  body.receiveShadow = false;
  body.frustumCulled = false;
  body.name = 'FPSoldierArmsMesh';
  // Re-bind against the untouched skeleton in its authored bind pose.
  body.bind(skeleton, body.bindMatrix);

  root.add(sceneRoot);

  return {
    root,
    mesh: body,
    skeleton,
    keptBones: skeleton.bones.filter((b, i) => isArmBone[i]),
    bones: boneByName,
    rightHand: boneByName.get(`${RIG_PREFIX}RightHand`),
    leftHand: boneByName.get(`${RIG_PREFIX}LeftHand`),
    rightArm: boneByName.get(`${RIG_PREFIX}RightArm`),
    leftArm: boneByName.get(`${RIG_PREFIX}LeftArm`),
    rightForeArm: boneByName.get(`${RIG_PREFIX}RightForeArm`),
    leftForeArm: boneByName.get(`${RIG_PREFIX}LeftForeArm`),
    stats: { sourceTriangles: triCount, armTriangles: keepTri.length / 3, armVertices: used.size }
  };
}

/** Clone a rig (SkeletonUtils rebuilds bones + skinned mesh with a fresh skeleton). */
export function cloneArmRig(arms) {
  const cloned = cloneSkinned(arms.root);
  const mesh = findSkinned(cloned);
  const bones = new Map();
  cloned.traverse((o) => { if (o.isBone) bones.set(normaliseBoneName(o.name), o); });
  return {
    root: cloned,
    mesh,
    skeleton: mesh ? mesh.skeleton : null,
    keptBones: mesh ? mesh.skeleton.bones : [],
    bones,
    rightHand: bones.get(`${RIG_PREFIX}RightHand`),
    leftHand: bones.get(`${RIG_PREFIX}LeftHand`),
    rightArm: bones.get(`${RIG_PREFIX}RightArm`),
    leftArm: bones.get(`${RIG_PREFIX}LeftArm`),
    rightForeArm: bones.get(`${RIG_PREFIX}RightForeArm`),
    leftForeArm: bones.get(`${RIG_PREFIX}LeftForeArm`),
    stats: arms.stats
  };
}

function findSkinned(o) {
  let found = null;
  o.traverse((c) => { if (!found && c.isSkinnedMesh) found = c; });
  return found;
}

/** Minimal SkeletonUtils.clone — three's version needs the full addon import. */
function cloneSkinned(source) {
  const boneMap = new Map();
  const clone = source.clone(true);
  const srcNodes = [];
  const dstNodes = [];
  source.traverse((n) => srcNodes.push(n));
  clone.traverse((n) => dstNodes.push(n));
  for (let i = 0; i < srcNodes.length; i++) {
    if (srcNodes[i].isBone) boneMap.set(srcNodes[i], dstNodes[i]);
  }
  for (let i = 0; i < srcNodes.length; i++) {
    const src = srcNodes[i];
    const dst = dstNodes[i];
    if (!src.isSkinnedMesh) continue;
    const srcSkel = src.skeleton;
    const bones = srcSkel.bones.map((b) => boneMap.get(b) || b);
    const skeleton = new THREE.Skeleton(bones, srcSkel.boneInverses);
    dst.bind(skeleton, dst.bindMatrix.clone());
  }
  return clone;
}

let _soldierCache = null;

/**
 * Load Soldier.glb and convert it to first-person arms.
 *
 * Cached per module: the levels instantiate many Players across a session and
 * re-parsing a 2 MB glTF each time is pure waste. Each caller gets a fresh
 * clone, so rigs never share bone transforms.
 */
export async function loadSoldierArmsFromGLB(url = './models/Soldier.glb', opts = {}) {
  if (!_soldierCache) {
    const THREE_GLTF = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const loader = new THREE_GLTF.GLTFLoader();
    const gltf = await loader.loadAsync(url);
    _soldierCache = soldierToFirstPersonArms(gltf.scene);
  }
  return cloneArmRig(_soldierCache);
}

export const ARM_POSES = {
  // The Z of each pose is the number that was wrong.
  //
  // A rifle is ~0.94 m long and its butt reaches 0.29 m behind the mount
  // origin. At the old z = -0.15 the butt sat 0.09 m from the eye while the
  // near plane is 0.02 m, so a 6 cm wide stock 9 cm away was magnified to 1.5x
  // the screen height — that is the brown mass in the screenshot. It was never
  // the wrong model; it was the inside of the stock against the lens.
  //
  // Every pose therefore holds the rifle far enough forward that the butt is
  // behind the near plane and gets clipped, exactly as a real viewmodel clips
  // the player's own shoulder. The X/Y/yaw keep it right-and-low with the
  // muzzle converging on the crosshair (centre at NDC ~0.09, -0.58).
  //
  // These values were solved, not guessed: see tools/fpview.mjs. Beyond about
  // z = -0.38 the support arm passes 170 deg and turns into a straight plank.
  idle:   { holder: [0.100, -0.190, -0.340], holderRot: [-0.02, 0.16, 0.03] },
  walk:   { holder: [0.096, -0.200, -0.334], holderRot: [-0.05, 0.18, 0.05] },
  run:    { holder: [0.112, -0.214, -0.322], holderRot: [-0.14, 0.26, 0.16] },
  // ADS. The Y value is doing the real work here.
  //
  // At y = -0.073 the buttstock projected to NDC -0.45 and covered 60% of the
  // frame in brown — the eye was looking straight down the side of the stock.
  // Dropping to -0.14 puts the butt edge at -0.40 and the rear sight just
  // below centre, so the player looks over the stock and through the sights.
  // Solved by measuring the stock's projected extent at 36 candidate poses
  // (tools/fpview.mjs), not by eye.
  ads:    { holder: [0.000, -0.140, -0.370], holderRot: [0.20, 0.00, 0.00] },
  fire:   { holder: [0.004, -0.136, -0.356], holderRot: [0.22, 0.00, 0.00] },
  // Reload pulls the rifle in towards the chest. z cannot go below -0.30 here:
  // the swing away from the shoulder pushes the support grip past the 0.473 m
  // reach and the left hand loses the weapon mid-animation (measured 4 cm short
  // at the old -0.312).
  reload: { holder: [0.104, -0.206, -0.280], holderRot: [0.10, 0.02, 0.22] },
  empty:  { holder: [0.102, -0.196, -0.336], holderRot: [0.02, 0.02, 0.10] }
};



/**
 * Grip points, in weapon-mount space. The rifle model is authored muzzle toward
 * -Z with the receiver near the origin, so the pistol grip is behind the origin
 * and the handguard in front of it.
 *
 * `wrist` is where the IK target sits: the hand centre is the grip, but the
 * wrist joint is offset back along the forearm so the hand wraps the grip
 * instead of the arm springing straight out of it.
 */
export const GRIP_POINTS = {
  // Trigger hand: on the pistol grip, behind the receiver.
  right: { hand: [0.000, -0.130, 0.088], pole: [0.55, -0.80, 0.35] },
  // Support hand: under the handguard, ahead of the receiver.
  // Support hand on the front of the receiver, at the magazine well. It used to
  // sit at z = -0.237 on the handguard, which is ~0.71 m from the left
  // shoulder — far beyond the rig's real reach, so the IK gave up 3 cm short
  // with the elbow locked at 175 deg: a straight plank.
  //
  // The reach is the hard constraint here and it is smaller than it looks.
  // Mixamo's Vanguard measures 0.473 m shoulder-to-wrist (a real adult is
  // ~0.55 m), and the mount sits 0.34 m out, so the handguard is out of range
  // by construction. At z = +0.02 the grip needs 0.468 m and the hand lands
  // exactly on it with the elbow near 145 deg. Measured with tools/fpview.mjs;
  // simtest asserts the 0.02 m lock across every stance.
  left:  { hand: [0.000, -0.052, 0.020], pole: [-0.55, -0.80, 0.30] }
};

/** Shoulder joints in view space — the pivot the whole arm hangs from. */
export const SHOULDER_ANCHOR = {
  right: [0.185, -0.145, 0.015],
  left:  [-0.185, -0.145, 0.015]
};

/**
 * The animated first-person view.
 *
 * Owns the arms, the weapon mount, the state machine and the reload timeline.
 * `update(dt, ctx)` is pure simulation — no renderer, no DOM — so the entire
 * thing is measurable in Node.
 *
 * Two rigs are supported behind one interface:
 *   - "procedural": the block armature from buildFirstPersonArms() (fallback,
 *     used for the first frames and if the asset fails to load)
 *   - "skinned": the real Soldier.glb arms from soldierToFirstPersonArms()
 *
 * Both are driven by the same two-bone IK, so the hands land on the weapon
 * identically either way.
 */
export class FirstPersonView {
  constructor(opts = {}) {
    this.rigKind = opts.arms && opts.arms.keptBones && opts.arms.keptBones.length
      ? 'skinned' : 'procedural';
    this.rig = opts.arms || buildFirstPersonArms(opts);

    // One container parented to the camera. The arms and the weapon are siblings
    // inside it: mounting the rifle in the hand would be circular, because the
    // hand is solved *to* the rifle.
    this.root = new THREE.Group();
    this.root.name = 'FPView';
    this.root.add(this.rig.root);
    this.weaponMount = new THREE.Group();
    this.weaponMount.name = 'weaponMount';
    this.root.add(this.weaponMount);

    this.chain = this._buildChain();

    this.state = ARM_STATE.IDLE;
    this.blend = { idle: 1, walk: 0, run: 0, ads: 0, fire: 0, reload: 0, empty: 0 };
    this.time = 0;
    this.bobPhase = 0;
    this.fireKick = 0;
    this.reloading = false;
    this.reloadT = 0;
    this.reloadDuration = 2.4;
    this.crouchBlend = 0;
    this.events = [];
    this._firedEvents = new Set();
    this._holder = new THREE.Vector3().fromArray(ARM_POSES.idle.holder);
    this._holderRot = new THREE.Vector3().fromArray(ARM_POSES.idle.holderRot);

    this._setupRigTransform();
    this._apply(ARM_POSES.idle);
    this._pose = ARM_POSES.idle;
  }

  get isSkinned() { return this.rigKind === 'skinned'; }

  /**
   * Normalise both rigs to the same three-joint chain.
   *
   * The armatures disagree on names: the procedural rig's `shoulder` bone sits
   * at the shoulder joint and its `upper` is really the elbow, whereas Mixamo's
   * `Shoulder` is a clavicle and `Arm` is the upper arm. Solving against names
   * would drive the wrong joint, so everything downstream talks in
   * upper/fore/hand.
   */
  _buildChain() {
    const b = this.rig.bones;
    if (this.isSkinned) {
      return {
        right: {
          clavicle: b.get(`${RIG_PREFIX}RightShoulder`),
          upper: b.get(`${RIG_PREFIX}RightArm`),
          fore: b.get(`${RIG_PREFIX}RightForeArm`),
          hand: b.get(`${RIG_PREFIX}RightHand`)
        },
        left: {
          clavicle: b.get(`${RIG_PREFIX}LeftShoulder`),
          upper: b.get(`${RIG_PREFIX}LeftArm`),
          fore: b.get(`${RIG_PREFIX}LeftForeArm`),
          hand: b.get(`${RIG_PREFIX}LeftHand`)
        }
      };
    }
    return {
      right: { clavicle: null, upper: b.shoulderR, fore: b.upperR, hand: b.foreR },
      left: { clavicle: null, upper: b.shoulderL, fore: b.upperL, hand: b.foreL }
    };
  }

  /**
   * Place the rig so its shoulder joints sit at SHOULDER_ANCHOR in view space.
   * Measured from the rig rather than hard-coded, because the glTF is authored
   * in centimetres with the model standing on the origin.
   */
  _setupRigTransform() {
    const armsRoot = this.rig.root;
    armsRoot.scale.setScalar(RIG_UNIT_SCALE);
    this.root.updateMatrixWorld(true);

    // Do NOT rescale the rig to a nominal reach.
    //
    // This used to multiply by ARM_REACH / _armReach(), which made the arms
    // grow to whatever value the grips demanded — on Soldier.glb that came out
    // at 1.40x, i.e. forearms half a metre long and a hand the size of a boot.
    // A real viewmodel is not solved by shrinking or stretching the player's
    // body; it is solved by putting the weapon where a human arm can hold it.
    // The asset is metric, so its proportions stay exactly as authored and the
    // grip positions are chosen to fit inside the rig's natural reach.
    this.root.updateMatrixWorld(true);

    // Offset the rig so the shoulder midpoint lands on the view anchor.
    const mid = this._shoulderMid();
    const anchor = new THREE.Vector3(
      (SHOULDER_ANCHOR.right[0] + SHOULDER_ANCHOR.left[0]) / 2,
      (SHOULDER_ANCHOR.right[1] + SHOULDER_ANCHOR.left[1]) / 2,
      (SHOULDER_ANCHOR.right[2] + SHOULDER_ANCHOR.left[2]) / 2
    );
    armsRoot.position.copy(anchor).sub(mid);
    this.shoulderOffset = armsRoot.position.clone();
    this.root.updateMatrixWorld(true);
  }

  /** Shoulder-to-wrist distance of the rig as currently posed. */
  _armReach() {
    let total = 0;
    let n = 0;
    for (const side of ['right', 'left']) {
      const c = this.chain[side];
      if (!c.upper || !c.fore || !c.hand) continue;
      const a = new THREE.Vector3().setFromMatrixPosition(c.upper.matrixWorld);
      const b = new THREE.Vector3().setFromMatrixPosition(c.fore.matrixWorld);
      const d = new THREE.Vector3().setFromMatrixPosition(c.hand.matrixWorld);
      total += a.distanceTo(b) + b.distanceTo(d);
      n++;
    }
    return n ? total / n : 0;
  }

  _shoulderMid() {
    const mid = new THREE.Vector3();
    let n = 0;
    for (const side of ['right', 'left']) {
      const b = this.chain[side].upper;
      if (!b) continue;
      mid.add(new THREE.Vector3().setFromMatrixPosition(b.matrixWorld));
      n++;
    }
    return n ? mid.divideScalar(n) : mid;
  }

  startReload(duration = 2.4) {
    if (this.reloading) return false;
    this.reloadDuration = Math.max(0.8, duration);
    this.reloadT = 0;
    this.reloading = true;
    this.state = ARM_STATE.RELOAD;
    this._firedEvents = new Set();
    return true;
  }

  cancelReload() {
    this.reloading = false;
    this.reloadT = 0;
    if (this.state === ARM_STATE.RELOAD) this.state = ARM_STATE.IDLE;
  }

  addFireKick(strength = 1) {
    this.fireKick = Math.min(2.2, this.fireKick + strength);
    return this.fireKick;
  }

  update(dt, ctx = {}) {
    this.time += dt;
    const speed = ctx.speed || 0;
    const aiming = !!ctx.aiming;
    const empty = !!ctx.empty;
    const sprinting = !!ctx.sprinting;

    if (this.reloading) {
      this.reloadT += dt / this.reloadDuration;
      for (const phase of RELOAD_PHASES) {
        if (phase.event && this.reloadT >= phase.at && !this._firedEvents.has(phase.name)) {
          this._firedEvents.add(phase.name);
          this.events.push({ type: phase.event, at: this.reloadT, phase: phase.name });
        }
      }
      if (this.reloadT >= 1) {
        this.reloading = false;
        this.reloadT = 0;
        this.state = ARM_STATE.IDLE;
      }
    }

    let target;
    if (this.reloading) target = ARM_STATE.RELOAD;
    else if (empty) target = ARM_STATE.EMPTY;
    else if (aiming) target = ARM_STATE.ADS;
    else if (speed > 4.2 || sprinting) target = ARM_STATE.RUN;
    else if (speed > 0.35) target = ARM_STATE.WALK;
    else target = ARM_STATE.IDLE;
    if (!this.reloading) this.state = target;

    const w = 1 - Math.exp(-12 * dt);
    for (const key of Object.keys(this.blend)) {
      const want = key === this.state ? 1 : 0;
      this.blend[key] += (want - this.blend[key]) * w;
    }

    const gait = this.blend.walk + this.blend.run * 1.6;
    this.bobPhase += dt * (gait > 0.02 ? 2.6 + speed * 1.35 : 0.9);
    this.fireKick = Math.max(0, this.fireKick - dt * 9.5);
    this.crouchBlend += ((ctx.crouch || 0) - this.crouchBlend) * w;

    const pose = this._compose();
    this._apply(pose);
    this._pose = pose;
  }

  /** Blend the authored weapon poses and add the procedural overlays. */
  _compose() {
    const keys = ['idle', 'walk', 'run', 'ads', 'reload', 'empty'];
    const holder = new THREE.Vector3();
    const rot = new THREE.Vector3();
    let total = 0;

    for (const key of keys) {
      let wgt = this.blend[key];
      if (wgt <= 0.001) continue;
      // Firing is an overlay on top of whatever stance you are already in, never
      // a stance of its own. Only the *rotation* blends toward the fire pose:
      // translation is the recoil impulse's job, and blending both meant the
      // rifle jumped forward on the shot instead of back into the shoulder.
      const src = ARM_POSES[key];
      holder.add(new THREE.Vector3().fromArray(src.holder).multiplyScalar(wgt));
      const srcRot = new THREE.Vector3().fromArray(src.holderRot);
      if (this.fireKick > 0.02 && ARM_POSES.fire[key] !== undefined) {
        srcRot.lerp(new THREE.Vector3().fromArray(ARM_POSES.fire.holderRot), Math.min(1, this.fireKick) * 0.85);
      }
      rot.add(srcRot.multiplyScalar(wgt));
      total += wgt;
    }
    if (total > 1e-4) { holder.divideScalar(total); rot.divideScalar(total); }
    else { holder.fromArray(ARM_POSES.idle.holder); rot.fromArray(ARM_POSES.idle.holderRot); }

    // ---- procedural overlays -------------------------------------------
    const gaitAmp = Math.min(1.4, this.blend.walk + this.blend.run * 1.7);
    if (gaitAmp > 0.01) {
      const swing = Math.sin(this.bobPhase);
      const bounce = Math.abs(Math.cos(this.bobPhase));
      const amp = gaitAmp * (this.blend.run > 0.5 ? 0.030 : 0.018);
      holder.x += swing * amp * 0.55;
      holder.y -= bounce * amp * 0.85;
      holder.z += Math.abs(swing) * amp * 0.25;
      rot.z += swing * amp * 2.2;
      rot.y += swing * amp * 1.4;
    }

    // Breathing, and the settle from crouching.
    const calm = 1 - this.blend.ads * 0.75;
    const breath = Math.sin(this.time * 1.35) * 0.0042 * calm;
    holder.y += breath;
    holder.y -= this.crouchBlend * 0.030;

    // Reload: the whole rifle rotates inboard and dips so the support hand can
    // reach the magazine well.
    if (this.blend.reload > 0.01) {
      const t = Math.min(1, this.reloadT);
      const dip = Math.sin(Math.PI * Math.min(1, t * 1.12));
      const roll = easeInOut(Math.min(1, t * 1.7)) * (1 - Math.max(0, (t - 0.70) / 0.30));
      const rw = this.blend.reload;
      holder.y -= dip * 0.050 * rw;
      holder.x += dip * 0.022 * rw;
      rot.z += roll * 0.62 * rw;
      rot.x += roll * 0.34 * rw;
      rot.y -= roll * 0.18 * rw;
    }

    // Recoil: mostly rotation, with a little rearward travel.
    if (this.fireKick > 0.001) {
      const k = Math.min(1, this.fireKick);
      holder.z += k * 0.038;
      holder.y += k * 0.010;
      holder.x += k * 0.004;
      rot.x -= k * 0.26;
      rot.z += k * 0.05;
    }

    return { holder, holderRot: rot };
  }

  /** Push a composed pose into the scene graph. */
  _apply(pose) {
    const h = pose.holder;
    const r = pose.holderRot;
    const px = Array.isArray(h) ? h[0] : h.x;
    const py = Array.isArray(h) ? h[1] : h.y;
    const pz = Array.isArray(h) ? h[2] : h.z;
    const rx = Array.isArray(r) ? r[0] : r.x;
    const ry = Array.isArray(r) ? r[1] : r.y;
    const rz = Array.isArray(r) ? r[2] : r.z;
    this.weaponMount.position.set(px, py, pz);
    this.weaponMount.rotation.set(rx, ry, rz);
    this.weaponMount.updateMatrixWorld(true);
    this._solveArms();
    if (this.isSkinned) this._curlFingers();
  }

  /**
   * Solve both arms onto the rifle.
   *
   * Everything is done in rig-root space: the root is temporarily detached so
   * `updateMatrixWorld` composes from the rig's own transform instead of the
   * camera's (which may be a frame stale during logic). The renderer recomputes
   * world matrices from the same local quaternions afterwards.
   */
  _solveArms() {
    // Everything happens in world space: bone matrices are world-space, and the
    // grip points are world-space once pushed through the weapon mount. Mixing
    // a rig-local target with world-space joints is what makes an IK solver
    // point the arm confidently in the wrong direction.
    this.root.updateMatrixWorld(true);

    for (const side of ['right', 'left']) {
      const c = this.chain[side];
      if (!c.upper || !c.fore || !c.hand) continue;
      const spec = GRIP_POINTS[side];
      const world = new THREE.Vector3().fromArray(spec.hand).applyMatrix4(this.weaponMount.matrixWorld);
      const pole = new THREE.Vector3().fromArray(spec.pole);

      const shoulderPos = new THREE.Vector3().setFromMatrixPosition(c.upper.matrixWorld);
      const elbowPos = new THREE.Vector3().setFromMatrixPosition(c.fore.matrixWorld);
      const wristPos = new THREE.Vector3().setFromMatrixPosition(c.hand.matrixWorld);
      const len1 = shoulderPos.distanceTo(elbowPos);
      const len2 = elbowPos.distanceTo(wristPos);

      const elbow = new THREE.Vector3();
      solveTwoBone(shoulderPos, world, len1, len2, shoulderPos.clone().add(pole), elbow);

      this._aimBone(c.upper, elbow);
      this._aimBone(c.fore, world);
      this._orientHand(side, c.hand);
    }
  }

  /** Rotate `bone` so the segment toward its bone-child points at `target`. */
  _aimBone(bone, target) {
    const child = bone.children.find((ch) => ch.isBone);
    if (!child) return;
    const pos = new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld);
    const cur = new THREE.Vector3().setFromMatrixPosition(child.matrixWorld);
    const d0 = cur.sub(pos);
    const d1 = target.clone().sub(pos);
    if (d0.lengthSq() < 1e-10 || d1.lengthSq() < 1e-10) return;

    const delta = new THREE.Quaternion().setFromUnitVectors(d0.normalize(), d1.normalize());
    const world = new THREE.Quaternion();
    bone.matrixWorld.decompose(new THREE.Vector3(), world, new THREE.Vector3());
    const newWorld = delta.multiply(world);
    const pq = new THREE.Quaternion();
    if (bone.parent) bone.parent.matrixWorld.decompose(new THREE.Vector3(), pq, new THREE.Vector3());
    else pq.identity();
    bone.quaternion.copy(pq.invert().multiply(newWorld));
    bone.updateMatrixWorld(true);
  }

  /**
   * Turn the palm onto the grip.
   *
   * The hand's local axes differ between rigs, so rather than guessing Euler
   * values the palm is aligned to the weapon's own frame: forward down the
   * barrel, up out of the receiver, then rolled so the fingers wrap the grip
   * rather than lying flat along it.
   */
  _orientHand(side, hand) {
    if (!hand) return;
    const aim = new THREE.Quaternion().setFromRotationMatrix(this.weaponMount.matrixWorld);
    const roll = side === 'right' ? 0.42 : -0.55;
    aim.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, roll)));

    const pq = new THREE.Quaternion();
    if (hand.parent) hand.parent.matrixWorld.decompose(new THREE.Vector3(), pq, new THREE.Vector3());
    else pq.identity();
    hand.quaternion.copy(pq.invert().multiply(aim));
    hand.updateMatrixWorld(true);
  }

  /** Close the fingers around the grip — 4 fingers + thumb per hand. */
  _curlFingers() {
    const b = this.rig.bones;
    for (const side of ['Right', 'Left']) {
      const dir = side === 'Right' ? 1 : -1;
      const curl = (finger, j, amount) => {
        const bone = b.get(`${RIG_PREFIX}${side}Hand${finger}${j}`);
        if (bone) bone.rotation.z = dir * amount;
      };
      for (const finger of ['Index', 'Middle', 'Ring']) {
        curl(finger, 1, 0.95);
        curl(finger, 2, 1.25);
        curl(finger, 3, 0.75);
      }
      curl('Thumb', 1, 0.55);
      curl('Thumb', 2, 0.70);
      curl('Thumb', 3, 0.45);
    }
  }

  get pose() { return this._pose; }

  /**
   * Where the hand actually ended up, in view space. Tests use this to prove the
   * hand is on the grip rather than merely near it.
   */
  handViewPosition(side) {
    const c = this.chain[side];
    if (!c || !c.hand) return null;
    const p = new THREE.Vector3().setFromMatrixPosition(c.hand.matrixWorld);
    const viewInv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    return p.applyMatrix4(viewInv);
  }

  /** The grip point the hand is being solved onto, in view space. */
  gripViewPosition(side) {
    const spec = GRIP_POINTS[side];
    const viewInv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    return new THREE.Vector3().fromArray(spec.hand)
      .applyMatrix4(this.weaponMount.matrixWorld)
      .applyMatrix4(viewInv);
  }

  consumeEvents() {
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }
}

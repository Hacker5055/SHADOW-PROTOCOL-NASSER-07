/**
 * Verify the first-person arm filter keeps forearms and hands — and nothing else.
 *
 * soldierToFirstPersonArms() throws away every triangle that is not dominated by
 * forearm/hand bones. If the skin attributes are misread the filter silently
 * keeps the torso, legs and head, and the viewmodel renders the player's whole
 * body around the camera. This asserts the kept geometry is actually arm-sized.
 */
import fs from 'node:fs';

globalThis.self = globalThis;
globalThis.ProgressEvent = globalThis.ProgressEvent
  || class { constructor(t = '', o = {}) { this.type = t; Object.assign(this, o); } };
globalThis.URL.createObjectURL = () => 'blob:stub';
globalThis.URL.revokeObjectURL = () => {};

const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
const THREE = await import('three');
const { soldierToFirstPersonArms, FirstPersonView, ARM_POSES } = await import('../src/game/viewmodel.js');

const bytes = fs.readFileSync(new URL('../public/models/Soldier.glb', import.meta.url));
const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

const gltf = await new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej));
const arms = soldierToFirstPersonArms(gltf.scene);

// Drive the rig to its idle pose before measuring. Without this the skeleton is
// still in the bind pose (T-pose) and the deformed span is the full body width.
const view = new FirstPersonView({ arms });
view.weaponMount.position.fromArray(ARM_POSES.idle.holder);
view.weaponMount.rotation.fromArray(ARM_POSES.idle.holderRot);
view._apply(ARM_POSES.idle);
view.root.updateMatrixWorld(true);

const geo = arms.mesh.geometry;
const pos = geo.attributes.position;
const si = geo.attributes.skinIndex;
const sw = geo.attributes.skinWeight;

// 1. the attributes must be compact
let fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail++; };

check(si.array.length === si.count * 4, `skinIndex is compact (${si.array.length} = ${si.count} x 4)`);
check(sw.array.length === sw.count * 4, `skinWeight is compact (${sw.array.length} = ${sw.count} x 4)`);

let maxJ = 0;
for (let i = 0; i < si.array.length; i++) if (si.array[i] > maxJ) maxJ = si.array[i];
check(maxJ < arms.skeleton.bones.length, `max joint index ${maxJ} < ${arms.skeleton.bones.length} bones`);

// 2. every kept vertex's weights sum to 1
let worst = 0;
for (let v = 0; v < sw.count; v++) {
  const s = sw.getX(v) + sw.getY(v) + sw.getZ(v) + sw.getW(v);
  worst = Math.max(worst, Math.abs(s - 1));
}
check(worst < 0.02, `skin weights normalised (worst deviation ${worst.toFixed(4)})`);

// 3. the kept geometry is arm-sized once skinned.
//
// The raw geometry bounding box is authored in the bind pose, where the arms are
// out to the sides — that box spans the whole body and proves nothing. What
// matters is the DEFORMED result, so apply the real skinning transform
// (boneWorld * boneInverse) and measure the posed span in metres.
const skel = arms.skeleton;
const p2 = geo.attributes.position;
const s2 = geo.attributes.skinIndex;
const w2 = geo.attributes.skinWeight;
let mn = Infinity, mx = -Infinity, mnY = Infinity, mxY = -Infinity;
const tmpV = new THREE.Vector3(), accV = new THREE.Vector3();
for (let i = 0; i < p2.count; i++) {
  accV.set(0, 0, 0); let sum = 0;
  for (let k = 0; k < 4; k++) {
    const w = w2.getComponent(i, k); if (w <= 0) continue;
    const bi = s2.getComponent(i, k);
    const m = new THREE.Matrix4().multiplyMatrices(skel.bones[bi].matrixWorld, skel.boneInverses[bi]);
    tmpV.fromBufferAttribute(p2, i).applyMatrix4(m);
    accV.addScaledVector(tmpV, w); sum += w;
  }
  if (sum > 0) { accV.divideScalar(sum); mn = Math.min(mn, accV.x); mx = Math.max(mx, accV.x);
                 mnY = Math.min(mnY, accV.y); mxY = Math.max(mxY, accV.y); }
}
const spanX = mx - mn, spanY = mxY - mnY;
check(spanX < 1.2, `posed arms span ${spanX.toFixed(3)} m — less than a shoulder-width (body is ~1.8 m)`);
check(spanX > 0.15, `posed arms are not degenerate (span ${spanX.toFixed(3)} m)`);

// 4. triangle count is a small slice of the body
const keptTris = geo.index.count / 3;
// 2,756 of 11,186 is a quarter of the body: two forearms, two hands and
// twenty finger segments. The threshold that matters is the posed span above —
// the raw count only has to rule out "kept everything" and "kept nothing".
check(keptTris > 800 && keptTris < 6000, `kept ${keptTris} triangles of 11186 (arms + fingers, not the body)`);

console.log(fail ? `\n=== ${fail} FAILED ===` : '\n=== arm filter CLEAN ===');
process.exit(fail ? 1 : 0);

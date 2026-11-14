/**
 * First-person view renderer — a CPU rasteriser for the real viewmodel.
 *
 * WHY THIS EXISTS
 * ---------------
 * `__SP_HEADLESS__` swaps the WebGLRenderer for a no-op, so `simtest.mjs` can
 * pass 103/103 while the actual viewport shows a crumpled brown mass. Test
 * counts cannot prove anything about pixels. This tool renders the *real*
 * scene graph (the same Soldier.glb arms, the same IK, the same weapon model
 * and the same camera FOV) with no GPU, no browser and no root, so a visual
 * claim can be backed by an image instead of an adjective.
 *
 * It is deliberately small and honest: flat-ish shading, no textures, no
 * post-processing. If the silhouette is wrong here, it is wrong in the game.
 *
 * USAGE
 *   node tools/fpview.mjs out.raw [--pose idle|ads|run] [--weapon akm]
 *   then convert: python3 -c "from PIL import Image; ..."  (see --help)
 *
 * Output is raw RGB24 at W x H, so it needs no image library.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

globalThis.self = globalThis;
globalThis.ProgressEvent = globalThis.ProgressEvent
  || class { constructor(t = '', o = {}) { this.type = t; Object.assign(this, o); } };

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { installStubs } = await import(path.join(ROOT, 'tools/stubs.mjs'));
globalThis.__SP_HEADLESS__ = true;
installStubs();

const THREE = await import('three');

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('node tools/fpview.mjs out.raw [--pose idle|ads|run|reload] [--weapon akm] [--w 640] [--h 360]');
  process.exit(0);
}
const argOf = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const OUT = args[0] && !args[0].startsWith('--') ? args[0] : 'fpview.raw';
const CANDIDATE = (() => { const i = args.indexOf('--glb'); return i >= 0 ? args[i + 1] : ''; })();
const POSE = argOf('--pose', 'idle');
const OVERRIDE = argOf('--override', '');
const ARMS = argOf('--arms', 'on');
const SOURCED = argOf('--sourced', '');
const WEAPON = argOf('--weapon', 'akm');
const W = parseInt(argOf('--w', '640'), 10);
const H = parseInt(argOf('--h', '360'), 10);

// ---------------------------------------------------------------- asset server
// GLTFLoader needs a real URL; a filesystem path throws "Failed to parse URL".
// Serve web/public on an ephemeral port so this works standalone.
const PUBLIC = path.join(ROOT, 'public');
const MIME = {
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ktx2': 'image/ktx2'
};
const server = http.createServer((req, res) => {
  if (req.url === '/__candidate.glb') {
    res.writeHead(200, { 'content-type': 'model/gltf-binary' });
    res.end(candidateBytes); return;
  }
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
// A --glb candidate is served from an in-memory route: we do not want stray
// candidate files sitting in public/ while they are only being evaluated.
const candidateBytes = CANDIDATE ? fs.readFileSync(CANDIDATE) : null;
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// ---------------------------------------------------------------- build scene
const { loadSoldierArmsFromGLB, FirstPersonView } = await import(path.join(ROOT, 'src/game/viewmodel.js'));
const { buildWeaponModel } = await import(path.join(ROOT, 'src/game/models.js'));

// --arms off renders the weapon alone, which is how a candidate model is judged.
const rig = ARMS === 'off' ? null : await loadSoldierArmsFromGLB(`${BASE}/models/Soldier.glb`);
const view = new FirstPersonView(rig ? { arms: rig } : {});
if (OVERRIDE) {
  const [x, y, z, rx, ry, rz] = OVERRIDE.split(',').map(Number);
  const { ARM_POSES } = await import(path.join(ROOT, 'src/game/viewmodel.js'));
  ARM_POSES[POSE] = { holder: [x, y, z], holderRot: [rx, ry, rz] };
}
const gun = buildWeaponModel(WEAPON);
const GLB_WEAPON = CANDIDATE;
if (SOURCED) {
  // Go through the REAL game path: the same loader and the same two-anchor
  // fit that player.js uses, so this frame is what the player actually sees.
  const { SOURCED_WEAPONS, loadSourcedWeapon } = await import(path.join(ROOT, 'src/game/weapons.js'));
  if (SOURCED_WEAPONS[SOURCED]) {
    SOURCED_WEAPONS[SOURCED].url = `${BASE}/models/weapons/${SOURCED}.glb`;
  }
  const fitted = await loadSourcedWeapon(SOURCED);
  if (!fitted) throw new Error(`sourced ${SOURCED}: load or fit rejected`);
  view.weaponMount.add(fitted.root);
  const box = new THREE.Box3().setFromObject(fitted.root);
  console.log(JSON.stringify({
    sourced: SOURCED,
    fitErrorMm: fitted.fitError,
    scale: +fitted.scale.toFixed(4),
    rollDeg: +(fitted.roll * 180 / Math.PI).toFixed(2),
    size: box.getSize(new THREE.Vector3()).toArray().map((n) => +n.toFixed(3)),
    muzzle: fitted.muzzle.toArray().map((n) => +n.toFixed(3))
  }));
} else if (GLB_WEAPON) {
  // Load a candidate rifle from a local .glb and fit it into the same mount.
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const doc = await new GLTFLoader().loadAsync(`${BASE}/__candidate.glb`);
  const g = doc.scene;
  const box = new THREE.Box3().setFromObject(g);
  const size = box.getSize(new THREE.Vector3());
  // Packs disagree on which axis is "forward". Whichever horizontal axis is
  // longer is the barrel; rotate so the muzzle points down -Z like ours.
  if (size.x > size.z) {
    g.rotation.y = Math.PI / 2;
    g.updateMatrixWorld(true);
  }
  const box2 = new THREE.Box3().setFromObject(g);
  const size2 = box2.getSize(new THREE.Vector3());
  // Normalise to a real AKM's 0.88 m overall length.
  const scale = 0.88 / Math.max(size2.z, 1e-6);
  g.scale.multiplyScalar(scale);
  g.updateMatrixWorld(true);
  const b3 = new THREE.Box3().setFromObject(g);
  const c3 = b3.getCenter(new THREE.Vector3());
  g.position.sub(c3);
  g.position.z -= 0.06;                     // receiver sits under the grips
  // Flat-colour packs ship near-black baseColours (0.0036 luminance), which is
  // correct for a PBR metal under a bright light and unreadable under flat
  // shading. Lift each material by its own luminance so the shapes read while
  // keeping the pack's tonal separation.
  g.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    o.material = Array.isArray(o.material) ? mats.map(restyle) : restyle(mats[0]);
    o.frustumCulled = false;
  });
  function restyle(m) {
    const c = m.clone ? m.clone() : m;
    if (c.color) {
      const l = 0.2126 * c.color.r + 0.7152 * c.color.g + 0.0722 * c.color.b;
      const v = Math.min(0.62, 0.14 + l * 1.9);
      c.color.setRGB(v * 0.98, v, v * 1.04);   // faintly cool gunmetal
      if (c.roughness !== undefined) c.roughness = 0.62;
      if (c.metalness !== undefined) c.metalness = 0.35;
    }
    return c;
  }
  view.weaponMount.add(g);
  console.log(JSON.stringify({ candidate: GLB_WEAPON, rawSize: size.toArray().map((n) => +n.toFixed(3)), scale: +scale.toFixed(3) }));
} else {
  view.weaponMount.add(gun);
}

// Settle the animation state (bob/idle lerp) before capturing a frame.
const ctx = { speed: POSE === 'run' ? 5 : 0, aiming: POSE === 'ads' };
for (let i = 0; i < 90; i++) view.update(1 / 60, ctx);

// The game parents the rig to the camera (player.js: this.viewCam.add(fpView.root)),
// so the render camera must be the PARENT here too, or every view-space
// constant is measured from the wrong origin.
const cam = new THREE.PerspectiveCamera(80, W / H, 0.02, 60);
cam.position.set(0, 0, 0);
cam.add(view.root);
cam.updateMatrixWorld(true);
cam.matrixWorldInverse.copy(cam.matrixWorld).invert();

// ---------------------------------------------------------------- rasteriser
const buf = new Float32Array(W * H * 3);
for (let y = 0; y < H; y++) {
  const t = y / H;
  // dusty 1973 sky, same grade family as the game's fog
  buf[(y * W) * 3] = 0.62; buf[(y * W) * 3 + 1] = 0.60; buf[(y * W) * 3 + 2] = 0.53;
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    buf[i] = 0.72 - 0.30 * t;
    buf[i + 1] = 0.66 - 0.30 * t;
    buf[i + 2] = 0.54 - 0.28 * t;
  }
}
const depth = new Float32Array(W * H).fill(Infinity);
const light = new THREE.Vector3(0.35, 0.8, 0.5).normalize();
const NEAR = -cam.near;

function shadeOf(tri, matColor) {
  const e1 = tri[1].clone().sub(tri[0]);
  const e2 = tri[2].clone().sub(tri[0]);
  const n = e1.cross(e2);
  if (n.lengthSq() < 1e-12) return null;
  n.normalize();
  const viewDir = tri[0].clone().applyMatrix4(cam.matrixWorldInverse).normalize();
  if (n.dot(viewDir) > 0) n.negate();               // face the viewer
  const lam = Math.max(0, n.dot(light));
  const fill = 0.18;
  return { lam, fill, color: matColor };
}

const _v = new THREE.Vector3();
for (const obj of [view.root]) {
  obj.updateMatrixWorld(true);
  obj.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const g = o.geometry;
    const pos = g.attributes.position;
    const index = g.index;
    const count = index ? index.count : pos.count;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const base = mat && mat.color ? [mat.color.r, mat.color.g, mat.color.b] : [0.5, 0.5, 0.5];
    const skinned = !!o.isSkinnedMesh;
    if (skinned && !o.skeleton) return;

    for (let t = 0; t < count; t += 3) {
      // World-space triangle, with CPU skinning when needed.
      const tri = [];
      for (let k = 0; k < 3; k++) {
        const vi = index ? index.getX(t + k) : t + k;
        const p = new THREE.Vector3().fromBufferAttribute(pos, vi);
        if (skinned) o.applyBoneTransform(vi, p);
        tri.push(p.applyMatrix4(o.matrixWorld));
      }
      const sh = shadeOf(tri, base);
      if (!sh) continue;

      // Clip against the near plane in VIEW space. Without this, a triangle
      // straddling the camera plane projects to infinity and smears a huge
      // ribbon across the frame — which is exactly how this tool was
      // misleading me before the clip went in.
      const vp = tri.map((p) => p.clone().applyMatrix4(cam.matrixWorldInverse));
      const poly = [];
      for (let i = 0; i < 3; i++) {
        const a = vp[i];
        const b = vp[(i + 1) % 3];
        const ain = a.z <= NEAR;
        const bin = b.z <= NEAR;
        if (ain) poly.push(a.clone());
        if (ain !== bin) {
          const f = (NEAR - a.z) / (b.z - a.z);
          poly.push(a.clone().lerp(b, f));
        }
      }
      if (poly.length < 3) continue;

      const scr = poly.map((p) => {
        const c = p.clone().project(cam);
        return { x: (c.x * 0.5 + 0.5) * W, y: (-c.y * 0.5 + 0.5) * H, z: c.z };
      });
      // Fan-triangulate the clipped polygon.
      for (let f = 1; f + 1 < scr.length; f++) {
        const s = [scr[0], scr[f], scr[f + 1]];
        const minX = Math.max(0, Math.floor(Math.min(s[0].x, s[1].x, s[2].x)));
        const maxX = Math.min(W - 1, Math.ceil(Math.max(s[0].x, s[1].x, s[2].x)));
        const minY = Math.max(0, Math.floor(Math.min(s[0].y, s[1].y, s[2].y)));
        const maxY = Math.min(H - 1, Math.ceil(Math.max(s[0].y, s[1].y, s[2].y)));
        if (minX > maxX || minY > maxY) continue;
        const area = (s[1].x - s[0].x) * (s[2].y - s[0].y) - (s[2].x - s[0].x) * (s[1].y - s[0].y);
        if (Math.abs(area) < 1e-9) continue;
        const lit = sh.fill + 0.95 * sh.lam;
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const px = x + 0.5;
            const py = y + 0.5;
            const w0 = ((s[1].x - px) * (s[2].y - py) - (s[2].x - px) * (s[1].y - py)) / area;
            const w1 = ((s[2].x - px) * (s[0].y - py) - (s[0].x - px) * (s[2].y - py)) / area;
            const w2 = 1 - w0 - w1;
            if (w0 < 0 || w1 < 0 || w2 < 0) continue;
            const z = w0 * s[0].z + w1 * s[1].z + w2 * s[2].z;
            const i = y * W + x;
            if (z >= depth[i]) continue;
            depth[i] = z;
            buf[i * 3] = sh.color[0] * lit;
            buf[i * 3 + 1] = sh.color[1] * lit;
            buf[i * 3 + 2] = sh.color[2] * lit;
          }
        }
      }
    }
  });
}

const bytes = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H * 3; i++) {
  bytes[i] = Math.round(Math.max(0, Math.min(1, buf[i])) * 255);
}
fs.writeFileSync(OUT, bytes);

// Also emit a PNG next to it so the result can be looked at without PIL.
const pngPath = OUT.replace(/\.raw$/, '') + '.png';
{
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;                       // filter: none
    bytes.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(body) : crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  function crc32(buf) {
    let c, crc = 0xffffffff;
    for (let n = 0; n < buf.length; n++) {
      c = (crc ^ buf[n]) & 0xff;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc = (crc >>> 8) ^ c;
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(pngPath, png);
}

// Report what was drawn so the caller has numbers as well as pixels.
let covered = 0;
let armPx = 0;
for (let i = 0; i < W * H; i++) if (depth[i] < Infinity) covered++;
const hands = {};
for (const side of ['right', 'left']) {
  const b = view.rig && view.rig[`${side}Hand`];
  if (b) hands[side] = b.getWorldPosition(new THREE.Vector3()).toArray().map((n) => +n.toFixed(3));
}
const gunBox = new THREE.Box3().setFromObject(gun);
const gunSize = gunBox.getSize(new THREE.Vector3());
const ndc = gunBox.getCenter(new THREE.Vector3()).project(cam);

console.log(JSON.stringify({
  out: OUT, png: pngPath, size: [W, H], pose: POSE, weapon: WEAPON,
  coverage: +(covered / (W * H)).toFixed(3),
  armMeshTriangles: rig && rig.stats ? rig.stats.armTriangles : null,
  gunLength: +gunSize.z.toFixed(3),
  gunCentreNdc: [+ndc.x.toFixed(2), +ndc.y.toFixed(2)],
  hands,
  mount: view.weaponMount.position.toArray().map((n) => +n.toFixed(3))
}, null, 2));

server.close();

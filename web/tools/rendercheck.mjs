/**
 * Run the real render loop without a GPU.
 *
 * The user's browser supports WebGL2 (get.webgl.org/webgl2 shows the cube), so
 * a black screen is a game bug, not a driver problem. The other harnesses
 * cannot see this class of bug: simtest uses a no-op renderer, and
 * bundlecheck deliberately stops at "the bundle loaded".
 *
 * This provides a fake WebGL2 context good enough for three.js to build its
 * state and issue draw calls, then runs the game for a few frames. It cannot
 * check pixels, but it does check the things that produce a black screen:
 * an exception in the first frame, zero draw calls, or a render that throws.
 *
 *   node tools/rendercheck.mjs [dist/assets/index-*.js]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2] || path.join(ROOT, 'dist/assets',
  fs.readdirSync(path.join(ROOT, 'dist/assets')).find((f) => f.endsWith('.js')));

const stats = { draws: 0, clear: 0, programs: 0, errors: [], frames: 0, viewport: [], drawAfterBoot: 0 };

// GL enum values three asks about by name.
const ENUM = {
  VERSION: 7938, VENDOR: 7936, RENDERER: 7937, SHADING_LANGUAGE_VERSION: 35724,
  LINK_STATUS: 35714, COMPILE_STATUS: 35713, ACTIVE_UNIFORMS: 35718, ACTIVE_ATTRIBUTES: 35721,
  MAX_TEXTURE_IMAGE_UNITS: 34930, MAX_VERTEX_TEXTURE_IMAGE_UNITS: 35660,
  MAX_COMBINED_TEXTURE_IMAGE_UNITS: 35661, MAX_TEXTURE_SIZE: 3379,
  MAX_CUBE_MAP_TEXTURE_SIZE: 34076, MAX_VERTEX_ATTRIBS: 34921,
  MAX_VERTEX_UNIFORM_VECTORS: 36347, MAX_VARYING_VECTORS: 36348,
  MAX_FRAGMENT_UNIFORM_VECTORS: 36349, MAX_SAMPLES: 36183,
  MAX_ARRAY_TEXTURE_LAYERS: 35071, MAX_3D_TEXTURE_SIZE: 32883
};

function make2D(canvas) {
  const noop = () => {};
  return {
    canvas,
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: noop, drawImage: noop, fillRect: noop, clearRect: noop, strokeRect: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, ellipse: noop,
    fill: noop, stroke: noop, save: noop, restore: noop, translate: noop, rotate: noop,
    scale: noop, setTransform: noop, fillText: noop, strokeText: noop, clip: noop,
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
    set fillStyle(v) {}, set strokeStyle(v) {}, set lineWidth(v) {}, set globalAlpha(v) {},
    set font(v) {}, set textAlign(v) {}, set shadowBlur(v) {}, set shadowColor(v) {}
  };
}

function makeGL(canvas) {
  const target = {
    canvas,
    drawingBufferWidth: 1280, drawingBufferHeight: 720,
    isContextLost: () => false,
    getError: () => 0,
    getExtension: (name) => (name === 'WEBGL_debug_renderer_info' ? null
      : { loseContext() {}, drawBuffersWEBGL() {} }),
    getSupportedExtensions: () => [],
    getParameter(p) {
      // three parses these as strings; returning a number makes indexOf throw.
      if (p === ENUM.VERSION || p === 0x1F02) return 'WebGL 2.0 (mock)';
      if (p === ENUM.VENDOR) return 'mock';
      if (p === ENUM.RENDERER) return 'mock-renderer';
      if (p === ENUM.SHADING_LANGUAGE_VERSION || p === 0x8B8C) return 'WebGL GLSL ES 3.00';
      if (p === 0x1F00) return 'mock';
      if (p === 0x1F01) return 'mock-renderer';
      // Anything three will string-match must be a string, not a number.
      if (typeof p === 'number' && p >= 0x1F00 && p <= 0x1F03) return 'mock';
      if (p === ENUM.ACTIVE_UNIFORMS || p === ENUM.ACTIVE_ATTRIBUTES) return 0;
      if (p === ENUM.MAX_TEXTURE_IMAGE_UNITS || p === ENUM.MAX_VERTEX_TEXTURE_IMAGE_UNITS
        || p === ENUM.MAX_COMBINED_TEXTURE_IMAGE_UNITS || p === ENUM.MAX_VERTEX_ATTRIBS
        || p === ENUM.MAX_VERTEX_UNIFORM_VECTORS || p === ENUM.MAX_VARYING_VECTORS
        || p === ENUM.MAX_FRAGMENT_UNIFORM_VECTORS || p === ENUM.MAX_SAMPLES) return 16;
      if (p === ENUM.MAX_ARRAY_TEXTURE_LAYERS) return 256;
      return 4096;
    },
    getShaderPrecisionFormat: () => ({ precision: 23, rangeMin: 127, rangeMax: 127 }),
    getShaderParameter: () => true,
    getProgramParameter: (prog, p) => (p === ENUM.LINK_STATUS ? true : 0),
    getShaderInfoLog: () => '',
    getProgramInfoLog: () => '',
    getActiveUniform: () => null,
    getActiveAttrib: () => null,
    getUniformLocation: () => ({}),
    getAttribLocation: () => 0,
    getUniformBlockIndex: () => 0,
    createShader: () => ({ id: ++stats.programs }),
    createProgram: () => ({ id: ++stats.programs }),
    createBuffer: () => ({}), createTexture: () => ({}), createFramebuffer: () => ({}),
    createRenderbuffer: () => ({}), createVertexArray: () => ({}),
    createQuery: () => ({}), createSampler: () => ({}), createTransformFeedback: () => ({}),
    checkFramebufferStatus: () => 36053,
    drawElements: () => { stats.draws++; if (globalThis.__SP_BOOTED__) stats.drawAfterBoot++; },
    drawArrays: () => { stats.draws++; if (globalThis.__SP_BOOTED__) stats.drawAfterBoot++; },
    drawElementsInstanced: () => { stats.draws++; },
    drawArraysInstanced: () => { stats.draws++; },
    clear: () => { stats.clear++; },
    viewport: (x, y, w, h) => { stats.viewport.push([w, h]); },
    scissor: () => {},
    clearColor: () => {}, clearDepth: () => {}, clearStencil: () => {},
    readPixels: () => {},
    fenceSync: () => ({}), clientWaitSync: () => 37146, deleteSync: () => {}
  };
  return new Proxy(target, {
    get(t, p) {
      // Numeric GL enums are read as properties (gl.VERSION). They must map to
      // their real enum values, not to the generic 1 fallback below, or
      // getParameter() sees a number where three expects a string.
      if (typeof p === 'string' && p in ENUM) return ENUM[p];
      // String-returning queries must never fall through to the generic enum
      // fallback: three calls .indexOf() on the result.
      if (typeof p === 'string' && /^(getSupportedExtensions|getShaderInfoLog|getProgramInfoLog|getString)$/.test(p)) {
        return () => (p === 'getSupportedExtensions' ? [] : '');
      }
      if (p in t) return t[p];
      if (typeof p === 'string' && /^[A-Z0-9_]+$/.test(p)) return 1;
      return () => undefined;
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

// ---------------------------------------------------------------- fake DOM
const el = (tag = 'div') => ({
  tagName: tag.toUpperCase(), style: { setProperty() {}, removeProperty() {} },
  dataset: {}, children: [],
  classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
    contains(c) { return this._s.has(c); }, toggle(c) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } },
  appendChild(c) { this.children.push(c); return c; }, removeChild() {},
  addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute: () => null,
  querySelector: () => el(), querySelectorAll: () => [], focus() {}, blur() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
  getContext(kind) {
    if (kind === '2d') return make2D(this);
    return makeGL(this);
  },
  toDataURL: () => 'data:,', width: 1280, height: 720, textContent: '', innerHTML: ''
});

globalThis.window = globalThis;
globalThis.innerWidth = 1280;
globalThis.innerHeight = 720;
globalThis.devicePixelRatio = 1;
globalThis.document = {
  getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [],
  createElement: (t) => el(t), addEventListener() {}, removeEventListener() {},
  body: el(), head: el(), documentElement: el(), readyState: 'complete', title: '', hidden: false
};
// Any element reachable by id/query returns the same shape, and appendChild
// returns its argument so chained HUD construction cannot hit undefined.
globalThis.document.getElementById = () => el();
globalThis.document.querySelector = () => el();
try { Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node', maxTouchPoints: 0 }, configurable: true }); } catch { /* has getter */ }
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, clear() {} };
globalThis.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return []; } };
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.AudioContext = class {
  constructor() { this.destination = {}; this.currentTime = 0; this.state = 'running'; }
  createGain() { return { connect() {}, disconnect() {}, gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }
  createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: { value: 0, setValueAtTime() {} }, type: 'sine' }; }
  createBuffer() { return { getChannelData: () => new Float32Array(64) }; }
  createBufferSource() { return { connect() {}, start() {}, stop() {}, buffer: null }; }
  createBiquadFilter() { return { connect() {}, frequency: { value: 0 }, Q: { value: 0 }, type: 'lowpass' }; }
  createStereoPanner() { return { connect() {}, pan: { value: 0 } }; }
  createDynamicsCompressor() { return { connect() {}, threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 } }; }
  resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); }
};
globalThis.OffscreenCanvas = class { constructor(w, h) { this.width = w; this.height = h; } getContext() { return null; } };
if (!globalThis.URL.createObjectURL) globalThis.URL.createObjectURL = () => 'blob:stub';
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};

let rafCount = 0;
const rafQueue = [];
globalThis.location = { href: 'http://127.0.0.1/', search: '', hash: '', pathname: '/', origin: 'http://127.0.0.1' };
globalThis.requestAnimationFrame = (fn) => { rafQueue.push(fn); return ++rafCount; };
globalThis.cancelAnimationFrame = () => {};

const realError = console.error;
console.error = (...a) => { realError(...a); stats.errors.push(a.map((x) => (x && x.stack) || String(x)).join(' ').slice(0, 400)); };
process.on('uncaughtException', (e) => stats.errors.push('uncaught: ' + (e.stack || e).slice(0, 400)));
process.on('unhandledRejection', (e) => stats.errors.push('rejection: ' + String((e && e.stack) || e).slice(0, 400)));

// ---------------------------------------------------------------- run
const tmp = path.join(ROOT, '.rendercheck.mjs');
fs.writeFileSync(tmp, fs.readFileSync(file, 'utf8'));
try {
  await import(pathToFileURL(tmp).href);
} catch (e) {
  stats.errors.push('load: ' + ((e && e.stack) || e).slice(0, 600));
}

// Drive frames by hand: the app registers rAF callbacks.
for (let i = 0; i < 6; i++) {
  const batch = rafQueue.splice(0);
  for (const fn of batch) {
    try { fn(16.7 * i); stats.frames++; } catch (e) { stats.errors.push('frame: ' + ((e && e.stack) || e).slice(0, 600)); }
  }
  await new Promise((r) => setTimeout(r, 60));
}
fs.unlinkSync(tmp);

const booted = !!globalThis.__SP_BOOTED__;
const fatalText = globalThis.__SP_FATAL__ || '';
console.log(JSON.stringify({
  file: path.basename(file),
  booted,
  frames: stats.frames,
  drawCalls: stats.draws,
  clears: stats.clear,
  shaders: stats.programs,
  drawCallsAfterBoot: stats.drawAfterBoot,
  viewports: stats.viewport.slice(0, 4),
  rendererBypassed: !!globalThis.__SP_RENDERER_BYPASSED__,
  gameState: globalThis.__SP__ ? (globalThis.__SP__.state || 'n/a') : 'no handle',
  menu: (() => {
    const m = globalThis.__SP__ && globalThis.__SP__.menu;
    if (!m || !m.root) return 'no menu handle';
    const cls = [...(m.root.classList._s || [])];
    return {
      hidden: cls.includes('hidden'),
      classes: cls,
      hasBrand: String(m.root.innerHTML || '').includes('SHADOW PROTOCOL'),
      screens: Object.keys(m.screens || {}).length,
      activeScreen: m.current || null
    };
  })(),
  unsupported: !!(globalThis.__SP_UNSUPPORTED__),
  errors: stats.errors.slice(0, 6),
  errorCount: stats.errors.length,
  fatalText: String(fatalText).slice(0, 300)
}, null, 2));
process.exit(0);

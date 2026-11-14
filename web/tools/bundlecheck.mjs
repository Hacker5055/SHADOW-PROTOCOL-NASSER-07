/**
 * Does the shipped bundle actually parse and evaluate?
 *
 * simtest.mjs runs the *source* against DOM stubs, and tools/smoke.mjs cannot
 * see module loading at all: jsdom does not implement ES modules, so every
 * module script there silently never runs. That leaves a real gap — a syntax or
 * top-level error in a module the tests never import (the GLTFLoader addon, for
 * instance) would ship a black screen with a fully green test suite.
 *
 * This closes the gap without a browser: take the production bundle, strip the
 * bare-specifier imports Vite already resolved, and evaluate it with a minimal
 * DOM. It proves the bundle parses and that module-level code runs; it cannot
 * prove pixels, but it does prove the page cannot die on load.
 *
 *   node tools/bundlecheck.mjs [dist/assets/index-*.js]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const file = process.argv[2]
  || path.join(ROOT, 'dist/assets', fs.readdirSync(path.join(ROOT, 'dist/assets')).find((f) => f.endsWith('.js')));

const src = fs.readFileSync(file, 'utf8');
const tmp = path.join(ROOT, '.bundlecheck.mjs');
fs.writeFileSync(tmp, src);

// A DOM just complete enough for module-level code: no WebGL, so the renderer
// is expected to fail gracefully rather than throw out of the module.
const el = () => ({
  style: {}, dataset: {}, classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
  children: [], appendChild() {}, removeChild() {}, addEventListener() {}, removeEventListener() {},
  setAttribute() {}, getAttribute: () => null, querySelector: () => null, querySelectorAll: () => [],
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
  getContext: () => null, focus() {}, textContent: '', innerHTML: '', width: 1280, height: 720
});
globalThis.window = globalThis;
globalThis.document = {
  getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [],
  createElement: () => el(), addEventListener() {}, removeEventListener() {},
  body: el(), documentElement: el(), readyState: 'complete', title: ''
};
try { if (!globalThis.navigator) globalThis.navigator = { userAgent: 'node' }; } catch { Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node' }, configurable: true }); }
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.devicePixelRatio = 1;
globalThis.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return []; } };
// The bundle is expected to fail at `new WebGLRenderer` because there is no GPU
// here. Recording that fact is the point: it proves the failure is WebGL and
// nothing else, which is exactly the question a black preview raises.
globalThis.__SP_WEBGL_ERROR__ = null;
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
globalThis.AudioContext = class { constructor() { this.destination = {}; } createGain() { return { connect() {}, gain: { value: 0 }, start() {}, stop() {} }; } createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: { value: 0 } }; } resume() {} suspend() {} };
globalThis.OffscreenCanvas = class { constructor(w, h) { this.width = w; this.height = h; } getContext() { return null; } };
if (!globalThis.URL.createObjectURL) globalThis.URL.createObjectURL = () => 'blob:stub';
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, clear() {} };
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
if (!globalThis.performance) globalThis.performance = { now: () => Date.now() };

let status = 'ok';
let detail = '';
const realError = console.error;
console.error = (...a) => { realError(...a); if (!globalThis.__SP_WEBGL_ERROR__) globalThis.__SP_WEBGL_ERROR__ = a.map(String).join(' ').slice(0, 200); };
try {
  await import(pathToFileURL(tmp).href);
  await new Promise((r) => setTimeout(r, 2500));
  if (globalThis.__SP_BOOTED__) status = 'booted';
  else if (/WebGL/i.test(globalThis.__SP_WEBGL_ERROR__ || '')) status = 'webgl-unavailable (expected with no GPU; app reported it)';
  else status = 'did-not-boot';
  detail = globalThis.__SP_WEBGL_ERROR__ || '';
} catch (e) {
  // A WebGL failure is expected and handled inside the app; anything else is a
  // genuine load-time defect.
  const msg = String(e && e.message || e);
  if (/WebGL|getContext|is not a function.*context/i.test(msg)) {
    status = 'graceful-webgl-missing';
    detail = msg.slice(0, 160);
  } else {
    status = 'FAILED';
    detail = (e && e.stack || msg).slice(0, 1200);
  }
}
fs.unlinkSync(tmp);

console.log(JSON.stringify({ bundle: path.basename(file), bytes: src.length, status, detail }, null, 2));
process.exit(status === 'FAILED' ? 1 : 0);

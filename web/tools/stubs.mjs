/**
 * Minimal DOM / WebGL / WebAudio stubs so the gameplay code can run under Node.
 * Only the surface the game actually touches is implemented; rendering and audio
 * become no-ops while all gameplay logic runs for real.
 */

class StubCanvas {
  constructor(id) { this.id = id; this.width = 1280; this.height = 720; this.style = {}; this.listeners = {}; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  removeEventListener() {}
  getContext(kind) { return kind === '2d' ? make2D(this) : null; }
  requestPointerLock() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; }
  focus() {}
}

function make2D(canvas) {
  const noop = () => {};
  const ctx = {
    canvas,
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: noop, getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    fillRect: noop, strokeRect: noop, clearRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, fill: noop, stroke: noop, save: noop, restore: noop,
    translate: noop, rotate: noop, scale: noop, drawImage: noop, fillText: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    measureText: () => ({ width: 10 })
  };
  return ctx;
}

class StubElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.style = new Proxy({ setProperty() {}, removeProperty() {} }, { set: () => true, get: (t, k) => t[k] });
    this.dataset = {};
    this.classList = {
      _s: new Set(),
      add: (...c) => c.forEach((x) => this.classList._s.add(x)),
      remove: (...c) => c.forEach((x) => this.classList._s.delete(x)),
      toggle: (c, f) => { const on = f === undefined ? !this.classList._s.has(c) : f; if (on) this.classList._s.add(c); else this.classList._s.delete(c); return on; },
      contains: (c) => this.classList._s.has(c)
    };
    this.textContent = '';
    this._html = '';
    this.listeners = {};
    this.parentNode = null;
  }
  set innerHTML(v) { this._html = v; }
  get innerHTML() { return this._html; }
  set className(v) { this._cn = v; }
  get className() { return this._cn || ''; }
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  querySelector() { return new StubElement('div'); }
  querySelectorAll() { return []; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  removeEventListener() {}
  closest() { return null; }
  get firstChild() { return this.children[0]; }
  get offsetWidth() { return 1; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; }
}

export function installStubs() {
  const canvas = new StubCanvas('view');

  const doc = {
    readyState: 'complete',
    body: new StubElement('body'),
    head: new StubElement('head'),
    documentElement: new StubElement('html'),
    getElementById: (id) => (id === 'view' ? canvas : new StubElement('div')),
    createElement: (tag) => (tag === 'canvas' ? new StubCanvas('c') : new StubElement(tag)),
    querySelector: () => new StubElement('div'),
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    pointerLockElement: null,
    exitPointerLock: () => {}
  };

  const listeners = {};
  const win = {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    document: doc,
    addEventListener: (t, f) => { (listeners[t] ||= []).push(f); },
    removeEventListener: () => {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    setTimeout: (f, ms) => setTimeout(f, Math.min(ms || 0, 4)),
    clearTimeout: (h) => clearTimeout(h),
    setInterval: () => 0,
    clearInterval: () => {},
    AudioContext: undefined,
    webkitAudioContext: undefined,
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    localStorage: makeStorage(),
    // userAgent matters: GLTFLoader sniffs it for a Safari-specific text-decode
    // path and throws without it.
    navigator: { getGamepads: () => [], userAgent: 'node-headless' },
    performance: { now: () => Date.now() },
    __SP_MODELS__: null,
    __SP_HELI__: null
  };

  globalThis.window = win;
  globalThis.document = doc;
  try { Object.defineProperty(globalThis, 'navigator', { value: win.navigator, configurable: true, writable: true }); } catch { /* node has a getter */ }
  globalThis.localStorage = win.localStorage;
  globalThis.requestAnimationFrame = win.requestAnimationFrame;
  globalThis.getComputedStyle = win.getComputedStyle;
  globalThis.HTMLCanvasElement = StubCanvas;
  globalThis.Image = class {};
  globalThis.__listeners = listeners;
}

function makeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
    get length() { return m.size; }
  };
}

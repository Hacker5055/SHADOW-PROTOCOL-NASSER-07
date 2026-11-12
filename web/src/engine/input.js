/**
 * SHADOW PROTOCOL — Input
 * Unified action-based input: keyboard, mouse and gamepad (XInput layout).
 * Every action exposes: down, pressed (edge), released (edge), value (analog 0..1).
 * Supports hold-vs-toggle accessibility for sprint/crouch/aim/ADS.
 */

const KEYMAP = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  crouch: ['ControlLeft', 'ControlRight', 'KeyC'],
  prone: ['KeyZ'],
  jump: ['Space'],
  leanLeft: ['KeyQ'],
  leanRight: ['KeyE'],
  reload: ['KeyR'],
  swapWeapon: ['Digit1', 'Digit2'],
  grenade: ['KeyG'],
  melee: ['KeyV'],
  interact: ['KeyF'],
  nightVision: ['KeyN'],
  objectives: ['Tab'],
  pause: ['Escape'],
  squadMove: ['F1'],
  squadHold: ['F2'],
  squadBreach: ['F3'],
  flashlight: ['KeyL'],
  slowTime: ['KeyT'], // photo/diagnostic debug only, disabled in Realism
  confirm: ['Enter']
};

const PADMAP = {
  jump: [0],
  crouch: [1],
  reload: [2],
  swapWeapon: [3, 14],
  melee: [11],
  sprint: [10],
  leanLeft: [4],
  leanRight: [5],
  objectives: [8],
  pause: [9],
  nightVision: [12],
  grenade: [12],
  interact: [0]
};

const DEAD = 0.18;

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.keyEdgeDown = new Set();
    this.keyEdgeUp = new Set();
    this.mouse = { dx: 0, dy: 0, buttons: [false, false, false], edges: [false, false, false], wheel: 0 };
    this.pad = null;
    this.padPrev = [];
    this.sensitivity = 1.0;
    this.invertY = false;
    this.toggleSprint = false;
    this.toggleCrouch = true;
    this.toggleAim = true;
    this.pointerLocked = false;
    this.enabled = true;
    this._toggles = Object.create(null);
    this._onLockChange = null;
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.keyEdgeDown.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.keyEdgeUp.add(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.buttons = [false, false, false];
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.pointerLocked) {
        this.mouse.buttons[e.button] = true;
        this.mouse.edges[e.button] = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      this.mouse.buttons[e.button] = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.mouse.dx += e.movementX || 0;
      this.mouse.dy += e.movementY || 0;
    });
    window.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (this._onLockChange) this._onLockChange(this.pointerLocked);
    });
    window.addEventListener('gamepadconnected', (e) => { this.pad = e.gamepad; });
    window.addEventListener('gamepaddisconnected', () => { this.pad = null; });
  }

  requestLock() {
    if (!this.pointerLocked && this.canvas.requestPointerLock) this.canvas.requestPointerLock();
  }
  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }
  onLockChange(cb) { this._onLockChange = cb; }

  _keyDown(action) {
    const codes = KEYMAP[action];
    if (!codes) return false;
    for (const c of codes) if (this.keys.has(c)) return true;
    return false;
  }
  _keyPressed(action) {
    const codes = KEYMAP[action];
    if (!codes) return false;
    for (const c of codes) if (this.keyEdgeDown.has(c)) return true;
    return false;
  }

  _pad() {
    if (this.pad && this.pad.connected) return this.pad;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) { this.pad = p; return p; }
    return null;
  }

  /** Analog movement vector, already normalized, y = forward. */
  moveVector() {
    let x = 0, y = 0;
    if (this.enabled) {
      if (this._keyDown('forward')) y += 1;
      if (this._keyDown('back')) y -= 1;
      if (this._keyDown('right')) x += 1;
      if (this._keyDown('left')) x -= 1;
      const p = this._pad();
      if (p) {
        const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
        if (Math.abs(ax) > DEAD) x += (ax - Math.sign(ax) * DEAD) / (1 - DEAD);
        if (Math.abs(ay) > DEAD) y -= (ay - Math.sign(ay) * DEAD) / (1 - DEAD);
      }
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y, magnitude: Math.min(1, len) };
  }

  lookVector() {
    const p = this._pad();
    let sx = 0, sy = 0;
    if (p && this.enabled) {
      const lx = p.axes[2] || 0, ly = p.axes[3] || 0;
      if (Math.abs(lx) > DEAD) sx = (lx - Math.sign(lx) * DEAD) / (1 - DEAD);
      if (Math.abs(ly) > DEAD) sy = (ly - Math.sign(ly) * DEAD) / (1 - DEAD);
      // cubic response curve for fine aim
      sx = Math.sign(sx) * Math.pow(Math.abs(sx), 1.6);
      sy = Math.sign(sy) * Math.pow(Math.abs(sy), 1.6);
    }
    return { x: this.mouse.dx + sx * 14, y: this.mouse.dy + sy * 14, analog: { x: sx, y: sy } };
  }

  _padButton(action) {
    const p = this._pad();
    if (!p) return false;
    const ids = PADMAP[action];
    if (!ids) return false;
    for (const i of ids) {
      const b = p.buttons[i];
      if (b && (b.pressed || b.value > 0.5)) return true;
    }
    return false;
  }
  _padPressed(action) {
    const p = this._pad();
    if (!p) return false;
    const ids = PADMAP[action];
    if (!ids) return false;
    for (const i of ids) {
      const b = p.buttons[i];
      const prev = this.padPrev[i] || false;
      const now = !!(b && (b.pressed || b.value > 0.5));
      if (now && !prev) return true;
    }
    return false;
  }

  /** Analog value 0..1 for triggers/actions. */
  value(action) {
    if (!this.enabled) return 0;
    const p = this._pad();
    if (action === 'fire' && p) return p.buttons[7] ? p.buttons[7].value : 0;
    if (action === 'aim' && p) return p.buttons[6] ? p.buttons[6].value : 0;
    if (action === 'fire' && this.mouse.buttons[0]) return 1;
    if (action === 'aim' && this.mouse.buttons[2]) return 1;
    return this.down(action) ? 1 : 0;
  }

  down(action) {
    if (!this.enabled) return false;
    if (action === 'fire') return this.mouse.buttons[0] || this._padButton('fire');
    if (action === 'aim') return this.mouse.buttons[2] || this._padButton('aim');
    if (this.toggleSprint && (action === 'sprint')) return this._toggle('sprint', this._keyDown('sprint') || this._padButton('sprint'));
    if (this.toggleCrouch && action === 'crouch') return this._toggle('crouch', this._keyDown('crouch') || this._padButton('crouch'));
    return this._keyDown(action) || this._padButton(action);
  }

  pressed(action) {
    if (!this.enabled) return false;
    if (action === 'fire') return this.mouse.edges[0] || this._padPressed('fire');
    if (action === 'aim') return this.mouse.edges[2] || this._padPressed('aim');
    if (action === 'leanLeft' && this.mouse.buttons[3]) return true;
    if (this.toggleCrouch && action === 'crouch') {
      return this._keyPressed('crouch') || this._padPressed('crouch');
    }
    if (this.toggleSprint && action === 'sprint') {
      return this._keyPressed('sprint') || this._padPressed('sprint');
    }
    return this._keyPressed(action) || this._padPressed(action);
  }

  _toggle(name, rawDown) {
    // Toggle semantics: each fresh press flips the latched state.
    const pressed = this._keyPressed(name) || this._padPressed(name);
    if (pressed) this._toggles[name] = !this._toggles[name];
    return !!this._toggles[name] || (rawDown && !this._toggles[name]);
  }

  consumeWheel() { const w = this.mouse.wheel; this.mouse.wheel = 0; return w; }
  consumeMouse() { const d = { x: this.mouse.dx, y: this.mouse.dy }; this.mouse.dx = 0; this.mouse.dy = 0; return d; }

  endFrame() {
    this.mouse.edges = [false, false, false];
    this.mouse.wheel = 0;
    this.keyEdgeDown.clear();
    this.keyEdgeUp.clear();
    const p = this._pad();
    if (p) {
      this.padPrev = p.buttons.map((b) => b.pressed || b.value > 0.5);
    }
  }

  clearToggles() { this._toggles = Object.create(null); }
}

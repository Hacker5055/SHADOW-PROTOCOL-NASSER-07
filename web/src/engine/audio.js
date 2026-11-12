/**
 * SHADOW PROTOCOL — Audio Engine
 * 100% procedurally synthesized: no binary audio assets required.
 * - Spatial 3D audio via PannerNode (HRTF where available)
 * - Distinct weapon signatures per era (1973 ballistics vs modern suppressed)
 * - Dynamic music: layered tension stems driven by combat/stealth state
 * - Radio comms: band-passed, distorted, room-toned
 *   (Voice acting is delivered as synthesized "radio texture" + on-screen transcript,
 *    see docs/05_AUDIO_AND_VO.md — no copyrighted recordings are used.)
 */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.master = null;
    this.buses = {};
    this.listenerPos = { x: 0, y: 0, z: 0 };
    this.music = { tension: 0, targetTension: 0, layer: {}, timer: 0, beat: 0 };
    this.volume = { master: 0.8, sfx: 0.9, music: 0.55, voice: 0.9 };
    this._noiseBuf = null;
  }

  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC({ latencyHint: 'interactive' });
    const c = this.ctx;

    this.master = c.createGain();
    this.master.gain.value = this.volume.master;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    this.master.connect(comp);
    comp.connect(c.destination);

    // Buses
    for (const [name, vol] of Object.entries({ sfx: this.volume.sfx, music: this.volume.music, voice: this.volume.voice })) {
      const g = c.createGain();
      g.gain.value = vol;
      g.connect(this.master);
      this.buses[name] = g;
    }

    // Reverb send (algorithmic impulse response)
    this.reverb = c.createConvolver();
    this.reverb.buffer = this._impulse(2.4, 2.2);
    this.reverbGain = c.createGain();
    this.reverbGain.gain.value = 0.28;
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.buses.sfx);

    // Noise buffer reused by all noise-based sounds
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noiseBuf = buf;

    this._startAmbience();
    this.ready = true;
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setVolume(bus, v) {
    this.volume[bus] = v;
    if (!this.ready) return;
    if (bus === 'master') this.master.gain.value = v;
    else if (this.buses[bus]) this.buses[bus].gain.value = v;
  }

  setListener(pos, forward, up) {
    this.listenerPos = pos;
    if (!this.ready) return;
    const l = this.ctx.listener;
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(pos.x, t, 0.02);
      l.positionY.setTargetAtTime(pos.y, t, 0.02);
      l.positionZ.setTargetAtTime(pos.z, t, 0.02);
      l.forwardX.setTargetAtTime(forward.x, t, 0.02);
      l.forwardY.setTargetAtTime(forward.y, t, 0.02);
      l.forwardZ.setTargetAtTime(forward.z, t, 0.02);
      l.upX.setTargetAtTime(up.x, t, 0.02);
      l.upY.setTargetAtTime(up.y, t, 0.02);
      l.upZ.setTargetAtTime(up.z, t, 0.02);
    } else {
      l.setPosition(pos.x, pos.y, pos.z);
      l.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }

  _impulse(duration, decay) {
    const c = this.ctx;
    const rate = c.sampleRate;
    const len = Math.floor(rate * duration);
    const buf = c.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return buf;
  }

  _panner(pos, refDist = 6, maxDist = 220, rolloff = 1.1) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = refDist;
    p.maxDistance = maxDist;
    p.rolloffFactor = rolloff;
    if (p.positionX) {
      p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z;
    } else p.setPosition(pos.x, pos.y, pos.z);
    return p;
  }

  _noise(dur, { gain = 0.5, type = 'lowpass', freq = 1200, q = 1, bus = 'sfx', pos = null, attack = 0.001, decay = null, rate = 1 } = {}) {
    if (!this.ready) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this._noiseBuf;
    src.playbackRate.value = rate;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    const now = c.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gain, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(f); f.connect(g);
    let out = this.buses[bus];
    if (pos) {
      const pan = this._panner(pos);
      g.connect(pan); pan.connect(this.buses[bus]); pan.connect(this.reverb);
    } else {
      g.connect(out);
      g.connect(this.reverb);
    }
    void decay;
    src.start(now);
    src.stop(now + dur + 0.05);
  }

  _tone(freq, dur, { gain = 0.2, type = 'sine', bus = 'sfx', pos = null, slide = null, attack = 0.005 } = {}) {
    if (!this.ready) return;
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    const now = c.currentTime;
    o.frequency.setValueAtTime(freq, now);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), now + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gain, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g);
    if (pos) { const p = this._panner(pos); g.connect(p); p.connect(this.buses[bus]); p.connect(this.reverb); }
    else { g.connect(this.buses[bus]); g.connect(this.reverb); }
    o.start(now);
    o.stop(now + dur + 0.02);
  }

  // ---------------------------------------------------------------- weapons
  /**
   * @param {'akm'|'portsaid'|'rpd'|'rpg7'|'sniper'|'m4'|'mp5sd'|'pistol'|'enemy_ak'|'enemy_modern'} id
   */
  gunshot(id, pos = null, suppressed = false) {
    if (!this.ready) return;
    const profiles = {
      akm: { crack: 0.9, thump: 90, noise: 2600, tail: 0.34 },
      portsaid: { crack: 0.5, thump: 180, noise: 3400, tail: 0.18 },
      rpd: { crack: 1.0, thump: 70, noise: 2200, tail: 0.42 },
      sniper: { crack: 1.0, thump: 55, noise: 1800, tail: 0.8 },
      rpg7: { crack: 1.0, thump: 42, noise: 900, tail: 1.1 },
      m4: { crack: 0.75, thump: 110, noise: 4200, tail: 0.26 },
      mp5sd: { crack: 0.22, thump: 190, noise: 1400, tail: 0.12 },
      pistol: { crack: 0.6, thump: 150, noise: 3800, tail: 0.2 },
      enemy_ak: { crack: 0.85, thump: 95, noise: 2400, tail: 0.32 },
      enemy_modern: { crack: 0.7, thump: 120, noise: 4000, tail: 0.24 }
    };
    const p = profiles[id] || profiles.akm;
    const m = suppressed ? 0.35 : 1;
    this._noise(p.tail, { gain: 0.55 * p.crack * m, type: 'bandpass', freq: p.noise, q: 0.7, pos });
    this._tone(p.thump, p.tail * 0.6, { gain: 0.55 * m, type: 'sine', slide: p.thump * 0.4, pos, attack: 0.002 });
    if (!suppressed) this._noise(0.05, { gain: 0.4 * m, type: 'highpass', freq: 3000, pos });
    if (!suppressed) this._noise(p.tail * 2.2, { gain: 0.12 * m, type: 'lowpass', freq: 600, pos, attack: 0.02 });
  }

  bulletWhiz(pos) {
    this._noise(0.09, { gain: 0.22, type: 'bandpass', freq: 5200, q: 6, pos });
    this._tone(2400, 0.07, { gain: 0.05, type: 'sawtooth', slide: 900, pos });
  }
  ricochet(pos) {
    this._tone(1800 + Math.random() * 1400, 0.22, { gain: 0.09, type: 'triangle', slide: 500, pos });
  }
  impact(kind, pos) {
    if (kind === 'metal') this._tone(900, 0.1, { gain: 0.15, type: 'square', slide: 400, pos });
    else this._noise(0.12, { gain: 0.3, type: 'lowpass', freq: 1400, pos });
  }
  reload() {
    this._noise(0.06, { gain: 0.28, type: 'bandpass', freq: 2600, q: 2 });
    setTimeout(() => this._noise(0.07, { gain: 0.32, type: 'bandpass', freq: 1800, q: 3 }), 160);
    setTimeout(() => this._tone(420, 0.05, { gain: 0.14, type: 'square' }), 330);
  }
  dryFire() { this._tone(1400, 0.03, { gain: 0.12, type: 'square' }); }
  explosion(pos) {
    this._noise(1.2, { gain: 0.9, type: 'lowpass', freq: 420, pos });
    this._tone(48, 0.9, { gain: 0.85, type: 'sine', slide: 22, pos, attack: 0.01 });
    this._noise(0.3, { gain: 0.5, type: 'bandpass', freq: 800, q: 0.6, pos });
  }
  footstep(surface = 'sand', pos = null) {
    if (surface === 'metal') this._tone(210, 0.08, { gain: 0.07, type: 'square', slide: 120, pos });
    else if (surface === 'concrete') this._noise(0.06, { gain: 0.09, type: 'bandpass', freq: 1500, q: 1.4, pos });
    else this._noise(0.09, { gain: 0.1, type: 'lowpass', freq: 700, pos });
  }
  damageTaken() {
    this._tone(70, 0.35, { gain: 0.3, type: 'sine', slide: 40 });
    this._noise(0.2, { gain: 0.18, type: 'lowpass', freq: 500 });
  }
  heartbeat() {
    this._tone(52, 0.16, { gain: 0.3, type: 'sine' });
    setTimeout(() => this._tone(44, 0.2, { gain: 0.22, type: 'sine' }), 190);
  }
  melee() { this._noise(0.14, { gain: 0.3, type: 'bandpass', freq: 700, q: 1 }); }
  takedown() { this._noise(0.2, { gain: 0.25, type: 'lowpass', freq: 900 }); this._tone(120, 0.25, { gain: 0.14, type: 'sine', slide: 60 }); }
  uiClick() { this._tone(660, 0.05, { gain: 0.1, type: 'triangle', bus: 'sfx' }); }
  uiConfirm() { this._tone(880, 0.08, { gain: 0.12, type: 'triangle' }); setTimeout(() => this._tone(1320, 0.1, { gain: 0.1, type: 'triangle' }), 70); }
  uiBack() { this._tone(420, 0.08, { gain: 0.1, type: 'triangle' }); }
  objective() { this._tone(784, 0.12, { gain: 0.1, type: 'sine' }); setTimeout(() => this._tone(1175, 0.16, { gain: 0.09, type: 'sine' }), 120); }
  checkpoint() { this._tone(523, 0.1, { gain: 0.09, type: 'sine' }); setTimeout(() => this._tone(784, 0.14, { gain: 0.08 }), 100); }
  nightVisionOn() { this._tone(220, 0.12, { gain: 0.12, type: 'square' }); this._noise(0.15, { gain: 0.1, type: 'highpass', freq: 4000 }); }

  /**
   * Radio voice: a synthesized formant "burst" shaped like speech cadence.
   * The actual words are shown as subtitles + a transcript log (see docs/05).
   */
  radio(syllables = 6, urgency = 0.5) {
    if (!this.ready) return;
    const c = this.ctx;
    const now = c.currentTime;
    const bus = this.buses.voice;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 1.1;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 350;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2900;
    const shaper = c.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.5); }
    shaper.curve = curve;
    const g = c.createGain();
    g.gain.value = 0.0001;
    bp.connect(hp); hp.connect(lp); lp.connect(shaper); shaper.connect(g); g.connect(bus);

    let t = now + 0.02;
    const base = urgency > 0.6 ? 168 : 132;
    for (let i = 0; i < syllables; i++) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      const f = base * (0.9 + Math.random() * 0.45) * (i % 3 === 2 ? 0.82 : 1);
      o.frequency.setValueAtTime(f, t);
      o.frequency.linearRampToValueAtTime(f * (0.94 + Math.random() * 0.12), t + 0.09);
      const env = c.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.32, t + 0.015);
      env.gain.linearRampToValueAtTime(0.0001, t + 0.085 + Math.random() * 0.05);
      o.connect(env); env.connect(bp);
      o.start(t); o.stop(t + 0.14);
      t += 0.1 + (Math.random() < 0.18 ? 0.12 : 0);
    }
    g.gain.setValueAtTime(0.55, now + 0.02);
    g.gain.setValueAtTime(0.55, t - 0.02);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.05);
    // squelch
    this._noise(0.08, { gain: 0.06, type: 'bandpass', freq: 2200, q: 1.5, bus: 'voice' });
  }

  _startAmbience() {
    const c = this.ctx;
    // Low desert wind / distant front rumble bed
    const src = c.createBufferSource();
    src.buffer = this._noiseBuf;
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 220; lp.Q.value = 0.5;
    const g = c.createGain();
    g.gain.value = 0.05;
    src.connect(lp); lp.connect(g); g.connect(this.buses.sfx);
    src.start();
    this.ambienceGain = g;

    // Wind LFO on filter
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoAmt = c.createGain();
    lfoAmt.gain.value = 90;
    lfo.connect(lfoAmt); lfoAmt.connect(lp.frequency);
    lfo.start();
  }

  setAmbience(level, brightness = 220) {
    if (!this.ready || !this.ambienceGain) return;
    this.ambienceGain.gain.setTargetAtTime(clamp(level, 0, 1) * 0.09, this.ctx.currentTime, 0.6);
  }

  // ---------------------------------------------------------------- music
  /**
   * Dynamic music: three stems (drone, tension pulse, combat percussion).
   * tension 0..1 drives mix; called by the game director every frame.
   */
  setTension(t) { this.music.targetTension = clamp(t, 0, 1); }

  updateMusic(dt, danger = 0) {
    if (!this.ready) return;
    const m = this.music;
    m.tension = lerp(m.tension, Math.max(m.targetTension, danger), clamp(dt * 1.6, 0, 1));
    m.timer -= dt;
    m.beat = (m.beat + dt) % 1000;

    // Sparse scheduled music events (no long buffers needed).
    if (m.timer <= 0) {
      const t = m.tension;
      // tempo accelerates with tension
      const interval = lerp(2.6, 0.42, t);
      m.timer = interval;
      const now = this.ctx.currentTime;

      // Drone (always present, louder with tension)
      if (t > 0.05) {
        const freqs = [55, 82.5, 110, 146.83];
        const f = freqs[Math.floor(Math.random() * freqs.length)];
        this._tone(f, lerp(3.2, 1.2, t), {
          gain: 0.05 + t * 0.05, type: 'sine', bus: 'music', attack: 0.7
        });
      }
      // Tension pulse: low piano-ish ping
      if (t > 0.35) {
        const scale = [220, 261.63, 293.66, 329.63, 392];
        const n = scale[Math.floor(Math.random() * scale.length)];
        this._tone(n, 1.1, { gain: 0.03 + t * 0.035, type: 'triangle', bus: 'music' });
      }
      // Combat percussion
      if (t > 0.62) {
        this._tone(58, 0.16, { gain: 0.16 * (t - 0.5), type: 'sine', bus: 'music' });
        this._noise(0.06, { gain: 0.05 * t, type: 'highpass', freq: 6000, bus: 'music' });
      }
      void now;
    }
  }

  hitMarker(isKill) {
    this._tone(isKill ? 1500 : 1050, 0.05, { gain: 0.12, type: 'square' });
    if (isKill) setTimeout(() => this._tone(900, 0.08, { gain: 0.1, type: 'square' }), 50);
  }
}

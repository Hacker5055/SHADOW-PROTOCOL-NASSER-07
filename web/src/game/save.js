/**
 * SHADOW PROTOCOL — Save system
 * Persistent campaign progress (chapters unlocked, intelligence, endings flags,
 * settings) plus per-mission checkpoints. Uses localStorage with versioned
 * migration and a safe in-memory fallback when storage is unavailable.
 */

const KEY = 'shadowprotocol.save.v1';
const CP_KEY = 'shadowprotocol.checkpoints.v1';
const SET_KEY = 'shadowprotocol.settings.v1';

const DEFAULT_PROGRESS = {
  version: 1,
  chaptersUnlocked: 1,
  chaptersCompleted: [],
  intel: {},
  flags: {
    TRUST_ADEL: false,
    SAVED_MARIAM: false,
    SPARED_CURATOR: false,
    PUBLISHED_LEDGER: false,
    KONSUL_ALIVE: false,
    KONSUL_DEAD: false,
    ZIDAN_STATE: 'unknown',
    LEDGER_COPY: false,
    WITHHELD_SCAN: false,
    CCTV_DOWN: false,
    JOURNALIST_FREED: false,
    PHONE_TAPPED: false
  },
  casualties: 0,
  endingsSeen: [],
  totalKills: 0,
  playTime: 0,
  difficulty: 'normal',
  lastChapter: null
};

const DEFAULT_SETTINGS = {
  sensitivity: 1.0,
  invertY: false,
  fov: 80,
  master: 0.8,
  sfx: 0.9,
  music: 0.55,
  voice: 0.9,
  showArabic: true,
  subtitles: true,
  subtitleSize: 1,
  toggleCrouch: true,
  toggleSprint: false,
  toggleAim: true,
  crosshair: true,
  filmGrain: true,
  motionBlur: false, // informational: post pass always has a light CA
  hudScale: 1,
  language: 'en'
};

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return v && typeof v === 'object' ? v : fallback;
  } catch { return fallback; }
}

class Storage {
  constructor() {
    this.mem = new Map();
    try {
      localStorage.setItem('__t', '1');
      localStorage.removeItem('__t');
      this.ok = true;
    } catch { this.ok = false; }
  }
  get(k) { if (this.ok) { try { return localStorage.getItem(k); } catch { return this.mem.get(k) ?? null; } } return this.mem.get(k) ?? null; }
  set(k, v) { if (this.ok) { try { localStorage.setItem(k, v); return; } catch { /* quota */ } } this.mem.set(k, v); }
  del(k) { if (this.ok) { try { localStorage.removeItem(k); } catch { /* noop */ } } this.mem.delete(k); }
}

export class SaveSystem {
  constructor(game) {
    this.game = game;
    this.store = new Storage();
    this.progress = { ...DEFAULT_PROGRESS, flags: { ...DEFAULT_PROGRESS.flags } };
    this.settings = { ...DEFAULT_SETTINGS };
    this.checkpoints = {};
    this.loadAll();
  }

  loadAll() {
    const p = safeParse(this.store.get(KEY), null);
    if (p) this.progress = { ...DEFAULT_PROGRESS, ...p, flags: { ...DEFAULT_PROGRESS.flags, ...(p.flags || {}) } };
    const s = safeParse(this.store.get(SET_KEY), null);
    if (s) this.settings = { ...DEFAULT_SETTINGS, ...s };
    const c = safeParse(this.store.get(CP_KEY), null);
    if (c) this.checkpoints = c;
  }

  persistProgress() { this.store.set(KEY, JSON.stringify(this.progress)); }
  persistSettings() { this.store.set(SET_KEY, JSON.stringify(this.settings)); }
  persistCheckpoints() { this.store.set(CP_KEY, JSON.stringify(this.checkpoints)); }

  setProgress(fn) {
    fn(this.progress);
    this.persistProgress();
  }

  setFlag(name, value = true) {
    this.progress.flags[name] = value;
    this.persistProgress();
  }
  getFlag(name) { return !!this.progress.flags[name]; }

  completeChapter(chapterIndex) {
    this.setProgress((p) => {
      if (!p.chaptersCompleted.includes(chapterIndex)) p.chaptersCompleted.push(chapterIndex);
      p.chaptersUnlocked = Math.max(p.chaptersUnlocked, chapterIndex + 1);
      p.lastChapter = chapterIndex;
    });
  }

  addPlayTime(seconds) {
    this.progress.playTime = (this.progress.playTime || 0) + seconds;
    this._playTimeDirty = true;
  }

  flushPlayTime() {
    if (this._playTimeDirty) { this.persistProgress(); this._playTimeDirty = false; }
  }

  addKills(n) {
    this.progress.totalKills = (this.progress.totalKills || 0) + n;
    this.persistProgress();
  }

  saveCheckpoint(missionId, data) {
    this.checkpoints[missionId] = { ...data, t: Date.now() };
    this.persistCheckpoints();
    this.progress.lastChapter = missionId;
    this.persistProgress();
  }

  getCheckpoint(missionId) { return this.checkpoints[missionId] || null; }
  hasCheckpoint(missionId) { return !!this.checkpoints[missionId]; }

  clearCheckpoint(missionId) {
    delete this.checkpoints[missionId];
    this.persistCheckpoints();
  }

  applySettings(settings) {
    this.settings = { ...this.settings, ...settings };
    this.persistSettings();
  }

  resetAll() {
    this.progress = { ...DEFAULT_PROGRESS, flags: { ...DEFAULT_PROGRESS.flags } };
    this.checkpoints = {};
    this.store.del(KEY); this.store.del(CP_KEY);
    this.persistProgress(); this.persistCheckpoints();
  }

  /** Determine the ending for the campaign based on tracked flags. */
  /**
   * The ending the player has earned so far. Chapter 07 writes exactly one of
   * PUBLISHED_LEDGER / LEVERAGED_LEDGER / BURNED_LEDGER, and each of the three
   * endings now has a decision that reaches it — a decision flag nothing reads
   * is decoration, and an ending no sequence of choices can reach is dead copy.
   */
  resolveEnding() {
    const f = this.progress.flags;
    const deaths = this.progress.casualties || 0;
    // Publish, and the whole campaign's other choices stay clean with you.
    if (f.TRUST_ADEL && f.SAVED_MARIAM && f.PUBLISHED_LEDGER) return 'CLEAN_HANDS';
    if (f.BURNED_LEDGER) return 'INHERITANCE';
    // Keeping it is the Curator's ending whether or not he is still alive.
    if (f.LEVERAGED_LEDGER) return 'THE_LEDGER';
    // Published, but without the two alliances that would have made it clean:
    // the record goes out and Nasser is still the man who carried it.
    if (f.PUBLISHED_LEDGER) return 'THE_LEDGER';
    // Saves from before chapter 07 existed.
    if (f.SPARED_CURATOR && deaths < 2) return 'THE_LEDGER';
    return 'INHERITANCE';
  }

  endingTitle(ending) {
    return {
      CLEAN_HANDS: 'CLEAN HANDS',
      THE_LEDGER: 'THE LEDGER',
      INHERITANCE: 'INHERITANCE',
      QUIET_CHOICE: 'THE QUIET CHOICE'
    }[ending] || ending;
  }

  endingCopy(ending) {
    return {
      CLEAN_HANDS: {
        ar: 'أيادي نظيفة',
        en: 'The ledger goes to a civilian archive in Alexandria, not to the Directorate. Within a month it is on every front page in the region. Zidan is arrested at his desk. Hoda and Adel testify in open court. Nasser resigns his commission and walks out of the building with a 1973 helmet under his arm.',
        tone: 'BITTERSWEET · INSTITUTIONAL'
      },
      THE_LEDGER: {
        ar: 'الدفتر',
        en: 'Nasser keeps the ledger. The Curator is alive, comfortable, and useful. Within six months the Directorate has new names at the top and the same arithmetic at the bottom. Nasser is promoted. He tells himself he bought time.',
        tone: 'COLD · AMBIGUOUS'
      },
      INHERITANCE: {
        ar: 'الإرث',
        en: 'He burns the page beside his grandfather\'s grave in Mansoura. The network survives because paper outlives soldiers only when someone is willing to file it. Nasser is reassigned to a unit that does not appear in any budget.',
        tone: 'DARK · UNRESOLVED'
      }
    }[ending] || { ar: '', en: '', tone: '' };
  }

  static get DEFAULT_SETTINGS() { return { ...DEFAULT_SETTINGS }; }
}

/**
 * SHADOW PROTOCOL — Mission framework
 * Objective graph, checkpointing, scripted beats, collectible intelligence,
 * scripted dialogue, camera direction and chapter transitions.
 *
 * On the Unreal side this is ASPMissionManager + ASPMissionObjective (see docs/03 §6).
 */

export const OBJ = {
  PRIMARY: 'primary',
  OPTIONAL: 'optional',
  BONUS: 'bonus'
};

export class Mission {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.id = null;
    this.code = '';
    this.title = '';
    this.subtitle = '';
    this.era = '1973';
    this.objectives = [];
    this.objectiveIndex = 0;
    this.checkpointPos = null;
    this.checkpointYaw = 0;
    this.checkpointData = null;
    this.checkpoints = [];
    this.intelTotal = 0;
    this.intelFound = 0;
    this.intelCarried = 0;
    this.intelLog = [];
    this.intelSeeded = false;
    this.beats = new Map();
    this.firedTriggers = new Set();
    this.darknessAt = 0;
    this.surfaceHint = 'sand';
    this.briefingShown = false;
    this.complete = false;
    this.timeInMission = 0;
    this.allowSave = true;
    // External listeners. Mission code must never call itself through these.
    this.hooks = {
      onKill: null, onSpotted: null, onEnemyShout: null, onSquadDown: null,
      onSquadRevived: null, onSquadLost: null, onSquadOrder: null,
      onSquadChatter: null, onPlayerDamaged: null, onSearchEnded: null,
      onUpdate: null
    };
  }

  load(def) {
    this.reset();
    // Documents are campaign-wide. The save keeps one set; the per-mission log
    // has to start from it or every debrief counts from zero and a duplicate
    // document looks new.
    const carried = this.game?.save?.progress?.intel || {};
    for (const id of Object.keys(carried)) this.intelLog.push({ id, carried: true });
    // Two different numbers, and conflating them is how a debrief ends up
    // reading "14 / 5": `intelFound` is what THIS mission yielded, `intelCarried`
    // is what the campaign already had. The coda reads the save, the debrief
    // reads this.
    this.intelCarried = this.intelLog.length;
    this.intelFound = 0;
    this.intelSeeded = true;
    this.id = def.id;
    this.code = def.code;
    this.title = def.title;
    this.subtitle = def.subtitle;
    this.era = def.era;
    this.surfaceHint = def.surface || 'sand';
    this.darknessAt = def.darknessAt || 0;
    this.checkpoints = def.checkpoints || [];
    this.objectives = (def.objectives || []).map((o, i) => ({
      id: o.id || `o${i}`,
      text: o.text,
      type: o.type || OBJ.PRIMARY,
      done: false,
      marker: o.marker || null,
      hidden: !!o.hidden
    }));
    this.intelTotal = def.intelTotal || 0;
    this.checkpointPos = def.start;
    this.checkpointYaw = def.startYaw || 0;
    this.objectiveIndex = 0;
    this.completionLog = [];
    this.markerDwell = new Map();
    this._syncObjective();
  }

  get currentObjective() {
    for (let i = 0; i < this.objectives.length; i++) {
      if (!this.objectives[i].done && this.objectives[i].type === OBJ.PRIMARY) return this.objectives[i];
    }
    return null;
  }

  _syncObjective() {
    const cur = this.currentObjective;
    if (cur) this.game.hud.setObjective(cur.text, this.objectives
      .filter((o) => o.type !== OBJ.PRIMARY || o === cur)
      .slice(0, 4)
      .map((o) => ({ text: o.text, done: o.done })));
  }

  completeObjective(index, { silent = false, notice = null } = {}) {
    const o = typeof index === 'number' ? this.objectives[index] : this.objectives.find((x) => x.id === index);
    if (!o || o.done) return;
    o.done = true;
    this.completionLog.push({ id: o.id, t: this.timeInMission });
    if (!silent) {
      this.game.audio.objective();
      this.game.hud.feed(`OBJECTIVE COMPLETE — ${o.text}`, '');
      if (notice) this.game.hud.feed(notice, '');
    }
    this._syncObjective();
    this._checkMissionComplete();
  }

  completeObjectiveByText(fragment, opts) {
    const o = this.objectives.find((x) => !x.done && x.text.toLowerCase().includes(fragment.toLowerCase()));
    if (o) this.completeObjective(this.objectives.indexOf(o), opts);
  }

  _checkMissionComplete() {
    const primaryLeft = this.objectives.filter((o) => o.type === OBJ.PRIMARY && !o.done);
    if (this.objectives.some((o) => o.type === OBJ.PRIMARY) && primaryLeft.length === 0 && !this.complete) {
      this.complete = true;
      this.game.onMissionComplete();
    }
  }

  addIntel(item) {
    // Documents are campaign-wide, not per-mission. The save has always kept
    // `progress.intel` as one set across the campaign, but the in-memory log
    // reset on every `load()`, so each mission's debrief counted from zero and
    // any "all documents found" gate had to be read off the save instead.
    // Seeding the log from the save keeps the two views in agreement.
    if (this.intelLog.find((i) => i.id === item.id)) return false;
    this.intelLog.push(item);
    this.intelFound += 1;
    this.game.audio.objective();
    this.game.hud.feed(`INTELLIGENCE RECOVERED — ${item.title}`, '');
    this.game.save.setProgress((p) => {
      p.intel = p.intel || {};
      p.intel[item.id] = true;
    });
    return true;
  }

  /** Record a checkpoint. Called at safe moments and on objective completion. */
  checkpoint(pos = null, yaw = null) {
    if (!this.allowSave) return;
    const p = this.game.player;
    this.checkpointPos = pos ? { x: pos.x, y: pos.y, z: pos.z } : { x: p.pos.x, y: p.pos.y, z: p.pos.z };
    this.checkpointYaw = yaw !== null ? yaw : p.yaw;
    this.checkpointData = {
      objectives: this.objectives.map((o) => o.done),
      intelFound: this.intelFound,
      intelLog: this.intelLog.slice(),
      health: p.health
    };
    this.game.hud.feed('CHECKPOINT', '');
    this.game.audio.checkpoint();
    this.game.save.saveCheckpoint(this.id, {
      pos: this.checkpointPos, yaw: this.checkpointYaw,
      objectives: this.objectives.map((o) => ({ id: o.id, done: o.done })),
      intelFound: this.intelFound, intelLog: this.intelLog,
      health: p.health, weaponIndex: p.weaponIndex
    });
  }

  restore(data) {
    if (!data) return;
    if (data.objectives) {
      for (const saved of data.objectives) {
        const o = this.objectives.find((x) => x.id === saved.id);
        if (o) o.done = saved.done;
      }
    }
    this.intelFound = data.intelFound || 0;
    this.intelLog = data.intelLog || [];
    this._syncObjective();
  }

  // ------------------------------------------------------------- events
  onEnemyKilled(enemy, headshot) {
    const g = this.game;
    g.player.kills += headshot ? 0 : 0;
    g.hud.feed(`${headshot ? 'HEADSHOT — ' : 'ELIMINATED — '}${enemy.role.toUpperCase()}`, 'kill');
    g.audio.setTension(Math.min(1, g.audio.music.targetTension + 0.05));
    if (this.hooks.onKill) this.hooks.onKill(enemy, headshot);
  }

  onSpotted(enemy) {
    if (this._spottedOnce) return;
    this._spottedOnce = true;
    this.game.hud.feed('DETECTED — ENEMY ALERTED', '');
    if (this.hooks.onSpotted) this.hooks.onSpotted(enemy);
  }

  onEnemyShout(enemy, text, urgency) {
    // occasional audible enemy barks with Arabic subtitles
    if (Math.random() < 0.42) {
      const ar = this.era === '1973'
        ? (text === 'CONTACT!' ? 'تماس! عدو أمامنا!' : 'مين هناك؟')
        : (text === 'CONTACT!' ? 'تماس! تماس!' : 'مين هناك؟');
      this.game.hud.say({
        speaker: this.era === '1973' ? 'إسرائيلي' : 'حرس',
        en: text,
        ar,
        voice: false,
        time: 1800,
        urgent: urgency > 0.7
      });
    }
    if (this.hooks.onEnemyShout) this.hooks.onEnemyShout(enemy, text);
  }

  onSquadDown(member, fromPos) {
    const g = this.game;
    g.hud.feed(`MAN DOWN — ${member.callsign}`, 'squad');
    g.hud.say({
      speaker: member.callsign,
      en: `${member.callsign} is down! I'm hit!`,
      ar: `${member.nameAr} مصاب! أنا مصاب!`,
      urgent: true
    });
    if (this.hooks.onSquadDown) this.hooks.onSquadDown(member, fromPos);
    void fromPos;
  }

  onSquadRevived(member) {
    this.game.hud.feed(`${member.callsign} BACK ON HIS FEET`, 'squad');
    this.game.hud.say({ speaker: member.callsign, en: "I'm up. Thanks, boss.", ar: 'أنا كويس. شكرًا يا ريّس.', voice: false, time: 2600 });
  }

  onSquadLost(member) {
    this.game.hud.feed(`${member.callsign} KIA`, 'squad');
    this.game.save.setProgress((p) => { p.casualties = (p.casualties || 0) + 1; });
    if (this.hooks.onSquadLost) this.hooks.onSquadLost(member);
  }

  onSquadOrder(kind, pos) {
    const g = this.game;
    const label = kind === 'hold' ? 'HOLD POSITION' : kind === 'breach' ? 'BREACH' : kind === 'recon' ? 'RECON' : 'MOVE TO';
    g.hud.showPrompt(`SQUAD — ${label}`, 1.2);
    g.audio.uiConfirm();
    if (this.hooks.onSquadOrder) this.hooks.onSquadOrder(kind, pos);
    void pos;
  }

  onSquadChatter(member, kind) {
    if (this.hooks.onSquadChatter) this.hooks.onSquadChatter(member, kind);
  }

  onPlayerDamaged(amount, headshot) {
    if (this.hooks.onPlayerDamaged) this.hooks.onPlayerDamaged(amount, headshot);
  }

  onSearchEnded(enemy) {
    if (this.hooks.onSearchEnded) this.hooks.onSearchEnded(enemy);
  }

  surfaceAt(pos) {
    // material hint for footstep audio
    if (!pos) return this.surfaceHint;
    const y = pos.y;
    if (y > 1.4) return 'concrete';
    return this.surfaceHint;
  }

  getObjectiveMarkers() {
    const cur = this.currentObjective;
    if (!cur || !cur.marker) return [];
    return [{ pos: cur.marker, label: cur.markerLabel || 'OBJ' }];
  }

  update(dt) {
    this.timeInMission += dt;
    // trigger evaluation
    const p = this.game.player;
    if (!p) return;
    for (const t of this.game.world.triggers) {
      if (t.fired && t.once) continue;
      const d = Math.hypot(t.pos.x - p.pos.x, t.pos.y - p.pos.y, t.pos.z - p.pos.z);
      if (d < t.radius) {
        t.fired = true;
        t.onEnter();
      }
    }
    // --- softlock guard: a primary objective that carries an objective marker
    // and has been standing for a while completes when the player is physically
    // at that marker. Prevents an unwinnable state if a scripted beat is missed.
    const cur = this.currentObjective;
    if (cur && cur.marker) {
      const dwell = (this.markerDwell.get(cur.id) || 0) + dt;
      this.markerDwell.set(cur.id, dwell);
      const d = Math.hypot(cur.marker.x - p.pos.x, cur.marker.z - p.pos.z);
      if (dwell > 18 && d < 9) this.completeObjective(cur.id, { silent: true });
    }

    // per-frame mission script hook
    if (this.hooks.onUpdate) this.hooks.onUpdate(dt);
  }
}

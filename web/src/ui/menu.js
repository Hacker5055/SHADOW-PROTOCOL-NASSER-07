/**
 * SHADOW PROTOCOL — Menus
 * Main menu, chapter select, campaign dossier, settings, credits, pause, death,
 * debrief. Two distinct presentations: the 1973 dossier (paper, dust, stencil)
 * and the modern command deck (graphite, telemetry, orange).
 */

const CSS = `
#menu{position:fixed;inset:0;z-index:60;font-family:"Bahnschrift","DIN Alternate","Roboto Condensed",Impact,system-ui,sans-serif;
  color:#e8e2d0;letter-spacing:.06em;user-select:none;overflow:hidden;transition:opacity .35s;}
#menu.hidden{display:none;opacity:0}
#menu-bg{position:absolute;inset:0;background:
  radial-gradient(ellipse at 22% 18%, rgba(224,116,31,.14), transparent 46%),
  radial-gradient(ellipse at 78% 82%, rgba(63,68,54,.5), transparent 55%),
  linear-gradient(160deg,#0a0c0d 0%,#11151a 42%,#0c0f11 100%);}
#menu-grain{position:absolute;inset:0;opacity:.22;pointer-events:none;
  background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 3px);}
#menu-scan{position:absolute;inset:0;pointer-events:none;opacity:.35;
  background:linear-gradient(180deg,transparent 0%,rgba(224,116,31,.05) 50%,transparent 100%);
  animation:scanMove 7s linear infinite}
@keyframes scanMove{0%{transform:translateY(-100%)}100%{transform:translateY(100%)}}

.menu-screen{position:absolute;inset:0;display:none;flex-direction:column;padding:clamp(28px,5vw,72px);}
.menu-screen.active{display:flex}

/* ---------- main */
#screen-main .brand{display:flex;align-items:flex-start;gap:18px}
#screen-main .brand-mark{width:4px;height:74px;background:#e0741f;box-shadow:0 0 22px rgba(224,116,31,.55)}
#screen-main h1{font-size:clamp(40px,6.4vw,90px);line-height:.9;margin:0;font-weight:800;letter-spacing:.01em;
  text-shadow:0 6px 34px rgba(0,0,0,.65)}
#screen-main h1 .thin{display:block;font-size:.34em;letter-spacing:.5em;color:#e0741f;font-weight:600;margin-bottom:10px}
#screen-main .sub{margin-top:12px;font-size:clamp(10px,1.05vw,13px);letter-spacing:.34em;color:rgba(232,226,208,.5)}
.menu-list{margin-top:clamp(24px,5vh,56px);display:flex;flex-direction:column;gap:2px;max-width:440px}
.menu-item{display:flex;align-items:center;gap:16px;padding:13px 18px;font-size:clamp(14px,1.5vw,18px);letter-spacing:.16em;
  cursor:pointer;background:linear-gradient(90deg,rgba(21,24,26,.72),rgba(21,24,26,.2));
  border-left:2px solid rgba(224,116,31,.25);transition:.14s;position:relative}
.menu-item:hover,.menu-item.sel{background:linear-gradient(90deg,rgba(224,116,31,.22),rgba(224,116,31,.02));
  border-left-color:#e0741f;padding-left:26px}
.menu-item .idx{font-size:10px;color:rgba(224,116,31,.75);width:20px;letter-spacing:.1em}
.menu-item.disabled{opacity:.32;cursor:not-allowed}
.menu-item.disabled:hover{background:linear-gradient(90deg,rgba(21,24,26,.72),rgba(21,24,26,.2));border-left-color:rgba(224,116,31,.25);padding-left:18px}
.menu-item small{margin-left:auto;font-size:10px;letter-spacing:.1em;color:rgba(232,226,208,.4)}
#screen-main .foot{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;
  font-size:10px;letter-spacing:.2em;color:rgba(232,226,208,.32);gap:20px;flex-wrap:wrap}
#screen-main .foot .disc{max-width:540px;line-height:1.7;letter-spacing:.06em}
#screen-main .side{position:absolute;right:clamp(24px,6vw,90px);top:50%;transform:translateY(-50%);width:min(300px,26vw);
  display:flex;flex-direction:column;gap:14px}
.stat-block{border-left:1px solid rgba(224,116,31,.4);padding-left:14px}
.stat-block .k{font-size:9px;letter-spacing:.26em;color:rgba(232,226,208,.42)}
.stat-block .v{font-size:22px;font-weight:700;letter-spacing:.02em;margin-top:3px}
.stat-block .v small{font-size:11px;color:rgba(232,226,208,.5);letter-spacing:.1em}

/* ---------- generic inner screens */
.screen-head{display:flex;align-items:center;gap:18px;margin-bottom:26px;flex-wrap:wrap}
.screen-head h2{margin:0;font-size:clamp(20px,2.6vw,32px);letter-spacing:.14em;font-weight:700}
.screen-head .rule{flex:1;height:1px;background:linear-gradient(90deg,rgba(224,116,31,.55),transparent)}
.back-btn{display:flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.2em;cursor:pointer;color:rgba(232,226,208,.6);
  padding:7px 12px;border:1px solid rgba(232,226,208,.16);transition:.14s}
.back-btn:hover{color:#e0741f;border-color:rgba(224,116,31,.6)}
.scroll{overflow-y:auto;padding-right:12px;flex:1}
.scroll::-webkit-scrollbar{width:6px}
.scroll::-webkit-scrollbar-thumb{background:rgba(224,116,31,.4)}

/* ---------- chapters */
.chapter-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.chapter-card{position:relative;padding:18px 18px 16px;background:linear-gradient(150deg,rgba(24,28,30,.92),rgba(14,17,18,.8));
  border:1px solid rgba(201,191,163,.14);cursor:pointer;transition:.16s;overflow:hidden}
.chapter-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:rgba(224,116,31,.3);transition:.16s}
.chapter-card:hover{border-color:rgba(224,116,31,.5);transform:translateY(-2px)}
.chapter-card:hover::before{background:#e0741f;box-shadow:0 0 16px rgba(224,116,31,.7)}
.chapter-card.locked{opacity:.45;cursor:not-allowed}
.chapter-card.locked:hover{transform:none;border-color:rgba(201,191,163,.14)}
.chapter-card .num{font-size:10px;letter-spacing:.3em;color:#e0741f}
.chapter-card .ttl{font-size:20px;font-weight:700;letter-spacing:.06em;margin:6px 0 4px}
.chapter-card .era{font-size:9px;letter-spacing:.24em;color:rgba(232,226,208,.45)}
.chapter-card .desc{font-size:11px;line-height:1.6;color:rgba(232,226,208,.55);margin-top:10px;letter-spacing:.03em}
.chapter-card .badges{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap}
.badge{font-size:8px;letter-spacing:.16em;padding:3px 7px;border:1px solid rgba(201,191,163,.24);color:rgba(232,226,208,.65)}
.badge.ok{border-color:rgba(127,154,90,.7);color:#9fbb74}
.badge.play{border-color:rgba(224,116,31,.8);color:#ffab5c}
.badge.soon{border-color:rgba(201,191,163,.2);color:rgba(232,226,208,.35)}
.chapter-card .lockicon{position:absolute;right:14px;top:14px;font-size:10px;letter-spacing:.2em;color:rgba(232,226,208,.4)}

/* ---------- settings */
.settings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px 34px;align-content:start}
.set-group{border-top:1px solid rgba(224,116,31,.3);padding-top:12px}
.set-group h3{font-size:10px;letter-spacing:.28em;color:#e0741f;margin:0 0 12px;font-weight:600}
.set-row{display:flex;align-items:center;gap:12px;margin:9px 0;font-size:11px;letter-spacing:.1em}
.set-row label{flex:1;color:rgba(232,226,208,.8)}
.set-row input[type=range]{width:140px;accent-color:#e0741f;background:transparent}
.set-row .val{width:42px;text-align:right;color:#e0741f;font-variant-numeric:tabular-nums;font-size:11px}
.toggle{width:44px;height:20px;border:1px solid rgba(201,191,163,.3);position:relative;cursor:pointer;transition:.15s;background:rgba(0,0,0,.4)}
.toggle::after{content:'';position:absolute;left:2px;top:2px;width:14px;height:14px;background:rgba(232,226,208,.4);transition:.15s}
.toggle.on{border-color:#e0741f;background:rgba(224,116,31,.18)}
.toggle.on::after{left:26px;background:#e0741f;box-shadow:0 0 10px rgba(224,116,31,.8)}
select{background:#15181a;color:#e8e2d0;border:1px solid rgba(201,191,163,.24);padding:5px 8px;font:inherit;font-size:11px;letter-spacing:.1em}

/* ---------- credits */
.credits{max-width:760px;font-size:12px;line-height:2;letter-spacing:.06em;color:rgba(232,226,208,.72)}
.credits h3{color:#e0741f;font-size:10px;letter-spacing:.32em;margin:26px 0 8px}
.credits .big{font-size:16px;letter-spacing:.1em;color:#e8e2d0;margin-bottom:2px}
.credits .note{font-size:11px;line-height:1.9;color:rgba(232,226,208,.45);margin-top:20px;border-top:1px solid rgba(201,191,163,.15);padding-top:14px}

/* ---------- overlay (pause / death / debrief) */
#overlay{position:absolute;inset:0;display:none;align-items:center;justify-content:center;
  background:rgba(5,7,8,.82);backdrop-filter:blur(3px);z-index:70}
#overlay.active{display:flex}
.overlay-card{width:min(760px,88vw);padding:clamp(24px,4vw,44px);background:linear-gradient(155deg,rgba(20,24,26,.97),rgba(11,13,14,.95));
  border:1px solid rgba(201,191,163,.16);box-shadow:0 30px 90px rgba(0,0,0,.75)}
.overlay-card .eyebrow{font-size:10px;letter-spacing:.32em;color:#e0741f;margin-bottom:10px}
.overlay-card h2{margin:0 0 6px;font-size:clamp(24px,3.4vw,44px);letter-spacing:.05em;font-weight:800}
.overlay-card .sub{font-size:11px;letter-spacing:.2em;color:rgba(232,226,208,.45);margin-bottom:24px}
.overlay-actions{display:flex;flex-direction:column;gap:2px;margin-top:16px}
.ovl-item{padding:12px 16px;font-size:13px;letter-spacing:.16em;cursor:pointer;border-left:2px solid rgba(224,116,31,.25);
  background:rgba(21,24,26,.6);transition:.14s}
.ovl-item:hover{background:rgba(224,116,31,.18);border-left-color:#e0741f;padding-left:24px}
.debrief-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:14px;margin:22px 0 8px}
.ds{border-left:1px solid rgba(224,116,31,.45);padding-left:12px}
.ds .k{font-size:9px;letter-spacing:.22em;color:rgba(232,226,208,.42)}
.ds .v{font-size:26px;font-weight:700;margin-top:2px}
.ds .v small{font-size:11px;color:rgba(232,226,208,.5)}
.debrief-intel{font-size:11px;letter-spacing:.12em;color:rgba(232,226,208,.6);margin-top:12px}
.debrief-intel b{color:#e0741f}
.dot-line{display:flex;gap:4px;margin-top:8px}
.dot-line i{width:8px;height:8px;background:rgba(201,191,163,.18);display:block}
.dot-line i.on{background:#e0741f;box-shadow:0 0 8px rgba(224,116,31,.8)}

/* era skins for the menu */
#menu.era-1973 #menu-bg{background:
  radial-gradient(ellipse at 24% 20%, rgba(224,150,70,.22), transparent 50%),
  radial-gradient(ellipse at 76% 78%, rgba(120,95,55,.45), transparent 58%),
  linear-gradient(160deg,#14100a 0%,#221a11 40%,#0f0c08 100%);}
#menu.era-1973 #screen-main h1{font-family:"Courier New",monospace;letter-spacing:-.02em}
#menu.era-modern #menu-bg{background:
  radial-gradient(ellipse at 20% 14%, rgba(255,138,36,.16), transparent 48%),
  radial-gradient(ellipse at 80% 84%, rgba(40,72,92,.55), transparent 56%),
  linear-gradient(150deg,#080b0d 0%,#0e1418 44%,#080b0c 100%);}
`;

export class Menu {
  constructor(game) {
    this.game = game;
    this.root = document.createElement('div');
    this.root.id = 'menu';
    this.root.className = 'hidden era-modern';
    document.body.appendChild(this.root);
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    this.root.innerHTML = `
      <div id="menu-bg"></div><div id="menu-grain"></div><div id="menu-scan"></div>

      <div class="menu-screen active" id="screen-main">
        <div class="brand">
          <div class="brand-mark"></div>
          <div>
            <h1><span class="thin">SHADOW PROTOCOL</span>NASSER 07</h1>
            <div class="sub">TWO GENERATIONS · ONE UNFINISHED WAR</div>
          </div>
        </div>
        <div class="menu-list" id="main-list">
          <div class="menu-item" data-act="new"><span class="idx">01</span>NEW CAMPAIGN<small>CHAPTER 01</small></div>
          <div class="menu-item" data-act="continue"><span class="idx">02</span>CONTINUE<small id="continue-info">—</small></div>
          <div class="menu-item" data-act="chapters"><span class="idx">03</span>CHAPTER SELECT<small id="chapter-info">1 / 7</small></div>
          <div class="menu-item" data-act="dossier"><span class="idx">04</span>CAMPAIGN DOSSIER<small>INTEL</small></div>
          <div class="menu-item" data-act="settings"><span class="idx">05</span>SETTINGS</div>
          <div class="menu-item" data-act="credits"><span class="idx">06</span>CREDITS & DISCLAIMER</div>
        </div>
        <div class="foot">
          <div class="disc">FICTIONAL WORK. Operation Amun, Box 07, the Black Ledger and all named characters are invented.
          The October 1973 War is portrayed with reference to the historical record; no real person is depicted committing a crime.
          Inspired by the craft of modern military cinema — all assets, systems and writing in this project are original.</div>
          <div>v1.0 · MILESTONE 5 SLICE</div>
        </div>
      </div>

      <div class="menu-screen" id="screen-chapters">
        <div class="screen-head">
          <div class="back-btn" data-act="back">‹ BACK</div>
          <h2>CHAPTER SELECT</h2><div class="rule"></div>
        </div>
        <div class="scroll"><div class="chapter-grid" id="chapter-grid"></div></div>
      </div>

      <div class="menu-screen" id="screen-dossier">
        <div class="screen-head">
          <div class="back-btn" data-act="back">‹ BACK</div>
          <h2>CAMPAIGN DOSSIER</h2><div class="rule"></div>
        </div>
        <div class="scroll" id="dossier-body"></div>
      </div>

      <div class="menu-screen" id="screen-settings">
        <div class="screen-head">
          <div class="back-btn" data-act="back">‹ BACK</div>
          <h2>SETTINGS</h2><div class="rule"></div>
        </div>
        <div class="scroll"><div class="settings-grid" id="settings-body"></div></div>
      </div>

      <div class="menu-screen" id="screen-credits">
        <div class="screen-head">
          <div class="back-btn" data-act="back">‹ BACK</div>
          <h2>CREDITS</h2><div class="rule"></div>
        </div>
        <div class="scroll"><div class="credits">
          <div class="big">SHADOW PROTOCOL: NASSER 07</div>
          <div>A cinematic military FPS in seven chapters</div>
          <h3>DESIGN & WRITING</h3>
          <div>Original story, characters and dialogue created for this project.</div>
          <h3>ENGINEERING</h3>
          <div>Custom WebGL2 render pipeline · deterministic AABB capsule physics · perception-driven AI ·
            procedural material and model library · dynamic tension-based score</div>
          <h3>UNREAL ENGINE 5 PROJECT</h3>
          <div>Source in <code>ShadowProtocol/</code> — movement, weapons, AI, squad, mission and save systems in C++.</div>
          <h3>HISTORICAL REFERENCE</h3>
          <div>1973 Egyptian order of battle, Suez crossing, Bar Lev line, period small arms and armour.
            See <code>docs/06_HISTORICAL_REFERENCE.md</code></div>
          <div class="note"><b>DISCLAIMER.</b> This is a work of fiction. Operation Amun, Archive Box 07, the Black
            Ledger, Directorate 7, the K-9 cell and every named character are inventions. The game does not depict
            real historical figures committing crimes, and makes no claim that its fictional events occurred.
            The October 1973 War is treated as history and is portrayed without triumphalism; its soldiers,
            on both sides, are depicted as soldiers.<br><br>
            No copyrighted game assets, characters, mission designs or dialogue were used or reproduced.</div>
        </div></div>
      </div>

      <div id="overlay">
        <div class="overlay-card" id="overlay-card"></div>
      </div>
    `;

    this.screens = {
      main: this.root.querySelector('#screen-main'),
      chapters: this.root.querySelector('#screen-chapters'),
      dossier: this.root.querySelector('#screen-dossier'),
      settings: this.root.querySelector('#screen-settings'),
      credits: this.root.querySelector('#screen-credits')
    };
    this.overlay = this.root.querySelector('#overlay');
    this.overlayCard = this.root.querySelector('#overlay-card');

    this.root.addEventListener('click', (e) => {
      const item = e.target.closest('[data-act]');
      if (!item) return;
      const act = item.dataset.act;
      this.game.audio.init();
      this.game.audio.resume();
      this.game.audio.uiClick();
      this.handle(act, item);
    });
    this.root.addEventListener('mouseover', (e) => {
      const item = e.target.closest('.menu-item');
      if (!item) return;
      this._selIndex = [...this.root.querySelectorAll('#main-list .menu-item')].indexOf(item);
    });
    window.addEventListener('keydown', (e) => this._onKey(e));

    this.current = 'main';
    this._selIndex = 0;
    this._buildChapters();
    this._buildSettings();
    this.showMain();
  }

  _onKey(e) {
    if (this.root.classList.contains('hidden')) return;
    if (this.overlay.classList.contains('active')) {
      const items = [...this.overlay.querySelectorAll('.ovl-item')];
      if (!items.length) return;
      if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
        e.preventDefault();
        this._ovlIndex = ((this._ovlIndex || 0) + (e.code === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach((it, i) => it.classList.toggle('sel', i === this._ovlIndex));
        this.game.audio.uiClick();
      }
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        items[this._ovlIndex || 0].click();
      }
      return;
    }
    if (this.current !== 'main') {
      if (e.code === 'Escape') this.showMain();
      return;
    }
    const items = [...this.root.querySelectorAll('#main-list .menu-item')];
    if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
      e.preventDefault();
      this._selIndex = ((this._selIndex || 0) + (e.code === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((it, i) => it.classList.toggle('sel', i === this._selIndex));
      this.game.audio.uiClick();
    }
    if (e.code === 'Enter') {
      const it = items[this._selIndex || 0];
      if (it && !it.classList.contains('disabled')) it.click();
    }
  }

  handle(act, el) {
    const g = this.game;
    switch (act) {
      case 'new': {
        const id = this.chapterMissionIds()[0];
        this.hideAll();
        g.startMission(id, { fromCheckpoint: false });
        g.requestLock();
        break;
      }
      case 'continue': {
        const last = g.save.progress.lastChapter;
        const cpInfo = last ? g.save.getCheckpoint(last) : null;
        const id = cpInfo ? last : this.firstPlayableId();
        this.hideAll();
        g.startMission(id, { fromCheckpoint: !!cpInfo });
        g.requestLock();
        break;
      }
      case 'chapters': this.show('chapters'); break;
      case 'dossier': this.showDossier(); break;
      case 'settings': this.show('settings'); break;
      case 'credits': this.show('credits'); break;
      case 'back': this.showMain(); break;
      case 'resume': g.resume(); break;
      case 'restart-cp': this.hideOverlay(); this.hideAll(); g.restartFromCheckpoint(); break;
      case 'restart-mission': this.hideOverlay(); this.hideAll(); g.startMission(g.mission.id, { fromCheckpoint: false }); g.requestLock(); break;
      case 'settings-from-pause': this.showSettingsFromPause(); break;
      case 'quit': this.hideOverlay(); g.quitToMenu(); break;
      case 'chapter': {
        const idx = Number(el.dataset.chapter);
        const id = this.chapterMissionIds()[idx];
        if (!id) { g.audio.uiBack(); return; }
        const chapterNo = this.chapterOfIndex(idx);
        if (chapterNo > g.save.progress.chaptersUnlocked) { g.audio.uiBack(); return; }
        this.hideAll();
        g.chapterIndex = chapterNo;
        g.startMission(id, { fromCheckpoint: false });
        g.requestLock();
        break;
      }
      case 'resume-campaign': {
        const next = this.nextMissionId();
        this.hideOverlay();
        this.hideAll();
        if (next) { g.startMission(next, { fromCheckpoint: false }); g.requestLock(); }
        else g.quitToMenu();
        break;
      }
      case 'replay': {
        this.hideOverlay();
        this.hideAll();
        g.startMission(g.mission.id, { fromCheckpoint: false });
        g.requestLock();
        break;
      }
      case 'dossier-after': this.hideOverlay(); this.showDossier(); break;
      case 'toggle': {
        const key = el.dataset.key;
        const s = g.save.settings;
        s[key] = !s[key];
        g.save.applySettings(s);
        g.applySettings();
        this._buildSettings();
        break;
      }
      case 'set-range': {
        // handled by input listener
        break;
      }
      case 'reset-progress': {
        if (el.dataset.confirm === '1') {
          g.save.resetAll();
          this._buildChapters();
          this.showMain();
          this.showToast('PROGRESS RESET');
        } else {
          el.dataset.confirm = '1';
          el.textContent = 'CONFIRM: ERASE ALL PROGRESS';
        }
        break;
      }
      default: break;
    }
  }

  // ------------------------------------------------------------------ screens
  show(name) {
    for (const [k, el] of Object.entries(this.screens)) {
      if (el) el.classList.toggle('active', k === name);
    }
    this.current = name;
    this.root.classList.remove('hidden');
    if (name === 'chapters') this._buildChapters();
    if (name === 'settings') this._buildSettings();
  }

  showMain() {
    this.hideOverlay();
    this.root.classList.remove('hidden');
    this.root.classList.toggle('era-1973', this.game.save.progress.chaptersCompleted.length === 0 ? false : true);
    this.game.hud.show(false);
    this.show('main');
    const p = this.game.save.progress;
    const cpId = p.lastChapter;
    const cp = cpId ? this.game.save.getCheckpoint(cpId) : null;
    const info = this.root.querySelector('#continue-info');
    if (cp) {
      const def = this.game.missions.get(cpId);
      info.textContent = def ? def.def.title : 'CHECKPOINT';
    } else {
      info.textContent = '—';
      // disable continue if nothing to continue
      const cont = this.root.querySelector('[data-act="continue"]');
      if (cont) cont.classList.add('disabled');
    }
    this.root.querySelector('#chapter-info').textContent = `${Math.min(p.chaptersUnlocked, 7)} / 7`;
    const items = [...this.root.querySelectorAll('#main-list .menu-item')];
    items.forEach((it, i) => it.classList.toggle('sel', i === (this._selIndex || 0)));
  }

  hideAll() {
    this.root.classList.add('hidden');
    this.hideOverlay();
  }

  hideOverlay() {
    this.overlay.classList.remove('active');
    this.root.classList.remove('hidden');
    this.root.classList.add('hidden');
    this._ovlIndex = 0;
  }

  _openOverlay(html) {
    this.overlayCard.innerHTML = html;
    this.overlay.classList.add('active');
    this.root.classList.remove('hidden');
    this._ovlIndex = 0;
    const items = [...this.overlayCard.querySelectorAll('.ovl-item')];
    if (items[0]) items[0].classList.add('sel');
  }

  showPause() {
    const m = this.game.mission;
    this._openOverlay(`
      <div class="eyebrow">OPERATION PAUSED</div>
      <h2 id="pause-title">${this.game.era === '1973' ? 'THE CROSSING' : 'THE SILENT MISSION'}</h2>
      <div class="sub">${m.code} · ${this.game.difficulty.toUpperCase()}</div>
      <div class="overlay-actions">
        <div class="ovl-item" data-act="resume">RESUME OPERATION</div>
        <div class="ovl-item" data-act="settings-from-pause">SETTINGS</div>
        <div class="ovl-item" data-act="restart-cp">RESTART FROM CHECKPOINT</div>
        <div class="ovl-item" data-act="restart-mission">RESTART CHAPTER</div>
        <div class="ovl-item" data-act="quit">ABANDON — MAIN MENU</div>
      </div>
    `);
    setTimeout(() => { this.suppressEsc = true; }, 0);
  }

  showSettingsFromPause() {
    this._settingsReturnToPause = true;
    this.hideOverlay();
    this.show('settings');
  }

  showDeath() {
    const m = this.game.mission;
    const lines = this.game.era === '1973'
      ? ['الشهيد لا يموت مرتين', 'The dead do not die twice']
      : ['الفريق لا يترك أحداً', 'The team does not leave anyone'];
    this._openOverlay(`
      <div class="eyebrow">OPERATION FAILED</div>
      <h2>KILLED IN ACTION</h2>
      <div class="sub">${m.title} · ${lines[1].toUpperCase()}</div>
      <div style="font-size:15px;direction:rtl;color:rgba(232,226,208,.55);font-family:'Noto Naskh Arabic',serif;margin-bottom:6px">${lines[0]}</div>
      <div class="overlay-actions">
        <div class="ovl-item" data-act="restart-cp">RESUME FROM LAST CHECKPOINT</div>
        <div class="ovl-item" data-act="restart-mission">RESTART CHAPTER</div>
        <div class="ovl-item" data-act="quit">ABANDON — MAIN MENU</div>
      </div>
    `);
  }

  showDebrief(mission, stats) {
    const dots = [];
    for (let i = 0; i < mission.intelTotal; i++) dots.push(`<i class="${i < stats.intel.found ? 'on' : ''}"></i>`);
    const mins = Math.floor(stats.time / 60), secs = Math.floor(stats.time % 60);
    const next = this.nextMissionId();
    const ending = this.game.save.resolveEnding();
    const copy = this.game.save.endingCopy(ending);
    // The campaign's last mission gets an ending card, not a "next chapter"
    // prompt. Without this, finishing chapter 07 drops the player back on the
    // menu with the ending copy never shown — three written endings and no
    // screen that displays them.
    // `mission` is the live Mission object, which does not carry chapterIndex;
    // the registered definition does.
    const def = this.game.missions.get(mission.id)?.def;
    const isFinal = (def?.chapterIndex || 0) >= 7;
    this._openOverlay(`
      <div class="eyebrow">CHAPTER COMPLETE</div>
      <h2>${mission.title.toUpperCase()}</h2>
      <div class="sub">${mission.code} · ${mission.era === '1973' ? 'OCTOBER 1973' : 'PRESENT DAY'}</div>
      <div class="debrief-stats">
        <div class="ds"><div class="k">ELIMINATED</div><div class="v">${stats.kills}</div></div>
        <div class="ds"><div class="k">HEADSHOTS</div><div class="v">${stats.headshots}</div></div>
        <div class="ds"><div class="k">ACCURACY</div><div class="v">${stats.accuracy}<small>%</small></div></div>
        <div class="ds"><div class="k">SQUAD</div><div class="v">${stats.squadAlive}<small>/${stats.squadTotal}</small></div></div>
        <div class="ds"><div class="k">TIME</div><div class="v">${mins}<small>m ${String(secs).padStart(2, '0')}s</small></div></div>
      </div>
      <div class="debrief-intel">INTELLIGENCE RECOVERED <b>${stats.intel.found} / ${stats.intel.total}</b>
        <div class="dot-line">${dots.join('')}</div></div>
      ${isFinal ? `
      <div class="debrief-intel" style="margin-top:22px;border-top:1px solid rgba(224,116,31,.3);padding-top:16px">
        <div class="eyebrow" style="margin-bottom:8px">ENDING — ${copy.tone}</div>
        <div style="font-size:22px;letter-spacing:.14em;color:#e0741f;margin-bottom:10px">${this.game.save.endingTitle(ending)}</div>
        <div style="direction:rtl;font-family:'Noto Naskh Arabic',serif;font-size:18px;color:rgba(232,226,208,.72);margin-bottom:10px">${copy.ar}</div>
        <div style="font-size:12px;line-height:1.9;color:rgba(232,226,208,.7);letter-spacing:.03em;max-width:640px">${copy.en}</div>
        ${this.game.save.progress.flags.BOX_07B ? '<div style="margin-top:14px;font-size:11px;letter-spacing:.22em;color:#9fbb74">ARCHIVE BOX 07-B — UNRESOLVED</div>' : ''}
      </div>` : `
      <div class="debrief-intel" style="margin-top:16px">CAMPAIGN STANDING — <b>${this.game.save.endingTitle(ending)}</b> is currently the projected ending.
        ${this.game.save.progress.casualties ? `Permanent losses: <b>${this.game.save.progress.casualties}</b>.` : 'No permanent losses.'}</div>`}
      <div class="overlay-actions">
        ${next
          ? '<div class="ovl-item" data-act="resume-campaign">PROCEED TO NEXT CHAPTER</div>'
          : `<div class="ovl-item" data-act="quit">${isFinal ? 'CLOSE THE FILE — MAIN MENU' : 'RETURN TO MAIN MENU'}</div>`}
        <div class="ovl-item" data-act="replay">REPLAY CHAPTER</div>
        <div class="ovl-item" data-act="dossier-after">CAMPAIGN DOSSIER</div>
        <div class="ovl-item" data-act="quit">MAIN MENU</div>
      </div>
    `);
  }

  showToast(text) {
    const t = document.createElement('div');
    t.textContent = text;
    t.style.cssText = `position:absolute;left:50%;bottom:14%;transform:translateX(-50%);padding:10px 22px;
      background:rgba(13,15,16,.9);border-left:2px solid #e0741f;font-size:11px;letter-spacing:.24em;z-index:99`;
    this.root.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  }

  // ------------------------------------------------------------------ data
  chapterMissionIds() {
    return [...this.game.missions.keys()];
  }

  firstPlayableId() {
    return this.chapterMissionIds()[0] || null;
  }

  /**
   * The chapter a mission belongs to, as a 1-based number.
   *
   * This used to be the mission's *position* in the registry. Chapter 01 has two
   * missions and every other chapter has one, so position and chapter drift
   * apart by one from chapter 02 onwards — and the last chapter (position 8 of
   * 8) needed eight unlocked chapters on a campaign that only has seven. The
   * registered definition carries the real number.
   */
  currentChapterIndex() {
    const def = this.game.missions.get(this.game.mission.id)?.def;
    if (def && def.chapterIndex) return def.chapterIndex;
    return this.chapterMissionIds().indexOf(this.game.mission.id) + 1;
  }

  /** Chapter number for the mission at registry position `i`. */
  chapterOfIndex(i) {
    const id = this.chapterMissionIds()[i];
    const def = id ? this.game.missions.get(id)?.def : null;
    return def && def.chapterIndex ? def.chapterIndex : i + 1;
  }

  nextMissionId() {
    const ids = this.chapterMissionIds();
    const i = ids.indexOf(this.game.mission.id);
    if (i >= 0 && i + 1 < ids.length) {
      const unlocked = this.game.save.progress.chaptersUnlocked;
      // The next mission's own chapter number decides, not its position.
      if (this.chapterOfIndex(i + 1) <= unlocked) return ids[i + 1];
    }
    return null;
  }

  _buildChapters() {
    const g = this.game;
    const grid = this.root.querySelector('#chapter-grid');
    const ids = this.chapterMissionIds();
    const unlock = g.save.progress.chaptersUnlocked;
    const done = g.save.progress.chaptersCompleted;
    grid.innerHTML = ids.map((id, i) => {
      const { def } = g.missions.get(id);
      const locked = def.chapterIndex > unlock;
      const isDone = def.chapterIndex <= done.length && done.includes(def.chapterIndex);
      return `<div class="chapter-card ${locked ? 'locked' : ''}" data-act="chapter" data-chapter="${i}">
        <div class="num">CHAPTER ${String(def.chapterIndex).padStart(2, '0')}</div>
        <div class="ttl">${def.title}</div>
        <div class="era">${def.cardEra}</div>
        <div class="desc">${def.synopsis}</div>
        <div class="badges">
          <span class="badge ${!locked ? 'play' : 'soon'}">${locked ? 'LOCKED' : 'PLAYABLE'}</span>
          <span class="badge ${isDone ? 'ok' : ''}">${isDone ? 'COMPLETED' : 'NOT COMPLETED'}</span>
          ${def.hasSquad ? '<span class="badge ok">SQUAD AI</span>' : ''}
          ${def.nvg ? '<span class="badge ok">NVG</span>' : ''}
        </div>
        ${locked ? '<div class="lockicon">▮▮▮</div>' : ''}
      </div>`;
    }).join('');
  }

  _buildSettings() {
    const s = this.game.save.settings;
    const body = this.root.querySelector('#settings-body');
    const range = (key, label, min, max, step, val, fmt = (v) => v) => `
      <div class="set-row"><label>${label}</label>
        <input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${val}">
        <span class="val" data-val="${key}">${fmt(val)}</span></div>`;
    const toggle = (key, label) => `
      <div class="set-row"><label>${label}</label>
        <div class="toggle ${s[key] ? 'on' : ''}" data-act="toggle" data-key="${key}"></div></div>`;

    body.innerHTML = `
      <div class="set-group">
        <h3>CONTROLS</h3>
        ${range('sensitivity', 'Mouse / stick sensitivity', 0.2, 3, 0.05, s.sensitivity, (v) => Number(v).toFixed(2))}
        ${toggle('invertY', 'Invert vertical look')}
        ${toggle('toggleCrouch', 'Crouch: toggle (off = hold)')}
        ${toggle('toggleSprint', 'Sprint: toggle (off = hold)')}
        ${toggle('toggleAim', 'Aim: toggle (off = hold)')}
        ${range('fov', 'Field of view', 65, 105, 1, s.fov, (v) => `${v}°`)}
      </div>
      <div class="set-group">
        <h3>AUDIO</h3>
        ${range('master', 'Master', 0, 1, 0.05, s.master, (v) => Math.round(v * 100))}
        ${range('sfx', 'Effects / weapons', 0, 1, 0.05, s.sfx, (v) => Math.round(v * 100))}
        ${range('music', 'Dynamic score', 0, 1, 0.05, s.music, (v) => Math.round(v * 100))}
        ${range('voice', 'Radio / voice', 0, 1, 0.05, s.voice, (v) => Math.round(v * 100))}
      </div>
      <div class="set-group">
        <h3>INTERFACE</h3>
        ${toggle('showArabic', 'Show Egyptian Arabic subtitles')}
        ${toggle('subtitles', 'Subtitles enabled')}
        ${range('hudScale', 'HUD scale', 0.8, 1.4, 0.05, s.hudScale, (v) => `${Math.round(v * 100)}%`)}
        ${toggle('filmGrain', 'Film grain / halation')}
        ${toggle('crosshair', 'Crosshair')}
      </div>
      <div class="set-group">
        <h3>CAMPAIGN</h3>
        <div class="set-row"><label>Difficulty</label>
          <select data-key="difficulty" id="difficulty-select">
            ${['easy', 'normal', 'hard', 'realism'].map((d) => `<option value="${d}" ${this.game.difficulty === d ? 'selected' : ''}>${d.toUpperCase()}</option>`).join('')}
          </select>
        </div>
        <div class="set-row"><label>Progress & checkpoints</label>
          <div class="ovl-item" style="padding:6px 12px;font-size:10px;margin:0" data-act="reset-progress" data-confirm="0">RESET</div>
        </div>
        <div class="set-row" style="font-size:10px;color:rgba(232,226,208,.4);line-height:1.7;letter-spacing:.06em">
          Difficulty locks when a chapter starts. Realism removes the HUD and makes every round lethal.
        </div>
      </div>
    `;

    body.querySelectorAll('input[type=range]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const key = inp.dataset.key;
        const v = Number(inp.value);
        this.game.save.settings[key] = v;
        const lbl = body.querySelector(`[data-val="${key}"]`);
        if (lbl) lbl.textContent = inp.max === '1' ? String(Math.round(v * 100)) : key === 'fov' ? `${v}°` : key === 'sensitivity' ? v.toFixed(2) : `${Math.round(v * 100)}%`;
        this.game.save.applySettings(this.game.save.settings);
        this.game.applySettings();
      });
    });
    const diffSel = body.querySelector('#difficulty-select');
    if (diffSel) {
      diffSel.addEventListener('change', () => {
        this.game.difficulty = diffSel.value;
        this.game.save.setProgress((p) => { p.difficulty = diffSel.value; });
        this.game.audio.uiConfirm();
      });
    }
  }

  showDossier() {
    const g = this.game;
    const p = g.save.progress;
    const intelCount = Object.keys(p.intel || {}).length;
    const flags = p.flags;
    const flagRow = (k, label) => `<div class="set-row" style="font-size:11px">
      <label>${label}</label>
      <span style="color:${flags[k] ? '#9fbb74' : 'rgba(232,226,208,.35)'};letter-spacing:.18em;font-size:10px">
        ${flags[k] ? 'ESTABLISHED' : 'NOT ESTABLISHED'}</span></div>`;
    const ending = g.save.resolveEnding();
    const copy = g.save.endingCopy(ending);
    this.root.querySelector('#dossier-body').innerHTML = `
      <div class="settings-grid">
        <div class="set-group" style="grid-column:span 1">
          <h3>OPERATIVE</h3>
          <div class="set-row"><label>Field name</label><span style="color:#e0741f">NASSER 07</span></div>
          <div class="set-row"><label>Unit</label><span style="font-size:10px">GID · SPECIAL OPS CELL K-9</span></div>
          <div class="set-row"><label>Legacy</label><span style="font-size:10px">GRANDSON OF COL. TAHER ABDEL-HAKIM</span></div>
          <div class="set-row"><label>Archive box</label><span style="color:#e0741f">07 — OPERATION AMUN</span></div>
        </div>
        <div class="set-group">
          <h3>CAMPAIGN STATE</h3>
          <div class="set-row"><label>Chapters unlocked</label><span>${Math.min(p.chaptersUnlocked, 7)} / 7</span></div>
          <div class="set-row"><label>Intelligence</label><span>${intelCount}</span></div>
          <div class="set-row"><label>Total eliminations</label><span>${p.totalKills || 0}</span></div>
          <div class="set-row"><label>Permanent losses</label><span>${p.casualties || 0}</span></div>
          <div class="set-row"><label>Play time</label><span>${Math.floor((p.playTime || 0) / 60)} min</span></div>
        </div>
        <div class="set-group">
          <h3>DECISION FLAGS</h3>
          ${flagRow('TRUST_ADEL', 'Trusted Adel (MOUSE)')}
          ${flagRow('SAVED_MARIAM', 'Kept Mariam Fahmy alive')}
          ${flagRow('SPARED_CURATOR', 'Spared the Curator')}
          ${flagRow('PUBLISHED_LEDGER', 'Published the Black Ledger')}
          ${flagRow('KONSUL_ALIVE', 'Took KONSUL alive')}
          ${flagRow('LEDGER_COPY', 'Copied the archive exfiltration')}
        </div>
        <div class="set-group">
          <h3>PROJECTED ENDING</h3>
          <div class="stat-block" style="border-left-color:#e0741f">
            <div class="k">${copy.tone}</div>
            <div class="v" style="color:#e0741f">${g.save.endingTitle(ending)}</div>
          </div>
          <div style="direction:rtl;font-family:'Noto Naskh Arabic',serif;font-size:16px;margin-top:12px;color:rgba(232,226,208,.6)">${copy.ar}</div>
          <div style="font-size:11px;line-height:1.8;margin-top:10px;color:rgba(232,226,208,.62);letter-spacing:.03em">${copy.en}</div>
        </div>
      </div>
      <div class="set-group" style="margin-top:22px">
        <h3>INTELLIGENCE INDEX</h3>
        <div style="font-size:11px;line-height:1.9;color:rgba(232,226,208,.55);letter-spacing:.04em">
          Documents are recovered in-mission from evidence markers. ${intelCount === 0
            ? 'No documents recovered yet. Check the admin block, the depot, and the briefing tables.'
            : Object.keys(p.intel).join(' · ')}
        </div>
      </div>
    `;
    this.show('dossier');
  }

  update() { /* reserved for animated menu state */ }
}

/**
 * SHADOW PROTOCOL — HUD
 * Premium military interface: graphite black, muted olive, tactical orange.
 * DOM-based so it stays crisp at any resolution and respects UI scaling.
 */

const css = `
:root{
  --graphite:#0d0f10; --graphite2:#15181a; --olive:#3f4436; --olive2:#5a6048;
  --sand:#c9bfa3; --orange:#e0741f; --orange2:#ff9a3c; --red:#c22b1c;
  --green:#7f9a5a; --blue:#5b8fa8; --bone:#e8e2d0;
  --ui-scale:1;
}
#hud{position:fixed;inset:0;pointer-events:none;font-family:"Bahnschrift","DIN Alternate","Roboto Condensed",Impact,system-ui,sans-serif;
  color:var(--bone);letter-spacing:.08em;font-size:calc(14px*var(--ui-scale));z-index:20;user-select:none;}
#hud.hidden{display:none}
.hud-panel{background:linear-gradient(180deg,rgba(13,15,16,.82),rgba(21,24,26,.62));
  border:1px solid rgba(201,191,163,.22);box-shadow:0 4px 22px rgba(0,0,0,.5), inset 0 1px 0 rgba(201,191,163,.08);}
.hud-corner{position:absolute;width:15px;height:15px;border:2px solid var(--orange);opacity:.85}
.hud-corner.tl{top:0;left:0;border-right:0;border-bottom:0}
.hud-corner.tr{top:0;right:0;border-left:0;border-bottom:0}
.hud-corner.bl{bottom:0;left:0;border-right:0;border-top:0}
.hud-corner.br{bottom:0;right:0;border-left:0;border-top:0}

/* compass */
#compass{position:absolute;top:18px;left:50%;transform:translateX(-50%);width:min(560px,72vw);height:38px;
  overflow:hidden;border-top:1px solid rgba(201,191,163,.18);border-bottom:1px solid rgba(201,191,163,.18);}
#compass-inner{position:absolute;top:0;height:100%;display:flex;align-items:center;white-space:nowrap;
  font-size:11px;color:rgba(232,226,208,.55);will-change:transform}
.cmp-tick{display:inline-block;width:26px;text-align:center;position:relative}
.cmp-tick.major{color:var(--bone);font-weight:700;font-size:13px}
.cmp-tick.major::after{content:'';position:absolute;bottom:-6px;left:50%;width:1px;height:6px;background:rgba(232,226,208,.5)}
.cmp-tick.minor::after{content:'';position:absolute;bottom:-5px;left:50%;width:1px;height:4px;background:rgba(232,226,208,.25)}
#compass-needle{position:absolute;left:50%;top:0;width:2px;height:100%;background:var(--orange);transform:translateX(-50%);opacity:.9}
#objective-marker-labels{position:absolute;inset:0;overflow:hidden}

/* objective */
#objective{position:absolute;top:22px;left:26px;min-width:270px;max-width:360px;padding:12px 14px 12px 16px;}
#objective .label{font-size:10px;color:var(--orange);letter-spacing:.22em;margin-bottom:6px}
#objective .primary{font-size:14px;line-height:1.35;color:var(--bone);letter-spacing:.04em}
#objective .sub{margin-top:8px;padding-top:8px;border-top:1px solid rgba(201,191,163,.16);font-size:11px;color:rgba(232,226,208,.6);line-height:1.5}
#objective .sub .ok{color:var(--green)}
#objective .sub .todo::before{content:'▢ ';color:var(--orange)}
#objective .sub .ok::before{content:'▣ ';color:var(--green)}

/* team status */
#team{position:absolute;top:22px;right:26px;width:210px;padding:10px 12px;}
#team .label{font-size:10px;color:var(--orange);letter-spacing:.22em;margin-bottom:8px}
.team-row{display:flex;align-items:center;gap:8px;margin:5px 0;font-size:11px}
.team-row .cs{width:52px;font-weight:700;letter-spacing:.1em}
.team-row .nm{flex:1;color:rgba(232,226,208,.55);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.team-bar{width:54px;height:5px;background:rgba(0,0,0,.55);position:relative;border:1px solid rgba(201,191,163,.18)}
.team-bar i{position:absolute;left:0;top:0;bottom:0;width:100%;background:var(--green);transition:width .2s,background .2s}
.team-row.down .cs{color:var(--red)}
.team-row.down .team-bar i{background:var(--red)}
.team-row.down{animation:blink 1s infinite}
.team-row.dead{opacity:.35;text-decoration:line-through}
@keyframes blink{50%{opacity:.45}}

/* health / ammo */
#vitals{position:absolute;left:26px;bottom:26px;width:300px;padding:12px 14px;}
#health-label{display:flex;justify-content:space-between;font-size:10px;letter-spacing:.2em;color:rgba(232,226,208,.6)}
#health-val{font-size:26px;font-weight:700;letter-spacing:.02em;line-height:1.1}
#health-track{height:9px;background:rgba(0,0,0,.6);margin-top:6px;position:relative;border:1px solid rgba(201,191,163,.2)}
#health-fill{position:absolute;inset:0;width:100%;background:linear-gradient(90deg,#7f9a5a,#a8c07a);transition:width .18s}
#health-fill.low{background:linear-gradient(90deg,#8f2214,#c22b1c);animation:pulseLow 1.1s infinite}
#health-fill.mid{background:linear-gradient(90deg,#a86a15,#d69a2a)}
@keyframes pulseLow{50%{opacity:.55}}
#stamina-track{height:3px;background:rgba(0,0,0,.5);margin-top:5px;position:relative}
#stamina-fill{position:absolute;inset:0;width:100%;background:var(--blue);transition:width .1s}
#stance-row{display:flex;gap:12px;margin-top:9px;font-size:10px;color:rgba(232,226,208,.5);letter-spacing:.16em}
#stance-row b{color:var(--orange);font-weight:700}

#ammo{position:absolute;right:26px;bottom:26px;width:230px;padding:12px 14px;text-align:right}
#ammo .wname{font-size:11px;letter-spacing:.14em;color:rgba(232,226,208,.7)}
#ammo .wname small{display:block;color:var(--orange);font-size:9px;letter-spacing:.2em;margin-top:2px}
#ammo .counts{display:flex;align-items:baseline;justify-content:flex-end;gap:6px;margin-top:6px}
#ammo .mag{font-size:34px;font-weight:700;line-height:1;letter-spacing:0}
#ammo .mag.low{color:var(--orange2)}
#ammo .mag.empty{color:var(--red)}
#ammo .res{font-size:15px;color:rgba(232,226,208,.5)}
#ammo .mode{font-size:9px;letter-spacing:.2em;color:rgba(232,226,208,.4);margin-top:4px}
#reload-bar{height:3px;background:rgba(0,0,0,.6);margin-top:7px;position:relative;opacity:0;transition:opacity .1s}
#reload-bar.on{opacity:1}
#reload-fill{position:absolute;inset:0;width:0;background:var(--orange)}
#grenades{margin-top:7px;font-size:10px;color:rgba(232,226,208,.55);letter-spacing:.14em}
#grenades b{color:var(--orange)}

/* crosshair */
#crosshair{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:64px;height:64px}
#crosshair .dot{position:absolute;left:50%;top:50%;width:2px;height:2px;border-radius:50%;background:rgba(255,255,255,.9);transform:translate(-50%,-50%);box-shadow:0 0 3px rgba(0,0,0,.9)}
#crosshair .bar{position:absolute;background:rgba(255,255,255,.82);box-shadow:0 0 2px rgba(0,0,0,.9)}
#crosshair .b1{left:50%;top:0;width:2px;height:9px;transform:translateX(-50%)}
#crosshair .b2{left:50%;bottom:0;width:2px;height:9px;transform:translateX(-50%)}
#crosshair .b3{top:50%;left:0;height:2px;width:9px;transform:translateY(-50%)}
#crosshair .b4{top:50%;right:0;height:2px;width:9px;transform:translateY(-50%)}
#hitmarker{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(45deg);width:24px;height:24px;opacity:0}
#hitmarker span{position:absolute;background:#fff;box-shadow:0 0 3px rgba(0,0,0,.8)}
#hitmarker .h1{left:0;top:50%;width:8px;height:2px}
#hitmarker .h2{right:0;top:50%;width:8px;height:2px}
#hitmarker .h3{top:0;left:50%;width:2px;height:8px}
#hitmarker .h4{bottom:0;left:50%;width:2px;height:8px}
#hitmarker.kill span{background:var(--orange2)}
#hitmarker.show{animation:hm .28s ease-out}
@keyframes hm{0%{opacity:1;transform:translate(-50%,-50%) rotate(45deg) scale(1.35)}100%{opacity:0;transform:translate(-50%,-50%) rotate(45deg) scale(1)}}
#headshot-tag{position:absolute;left:50%;top:calc(50% - 44px);transform:translateX(-50%);font-size:10px;letter-spacing:.28em;color:var(--orange2);opacity:0;text-shadow:0 0 8px rgba(224,116,31,.9)}
#headshot-tag.show{animation:hs .8s ease-out}
@keyframes hs{0%{opacity:1;transform:translate(-50%,0)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-12px)}}

/* damage direction */
#dmg-ring{position:absolute;left:50%;top:50%;width:min(72vh,72vw);height:min(72vh,72vw);transform:translate(-50%,-50%);opacity:0;transition:opacity .25s}
#dmg-ring .arc{position:absolute;inset:0;border-radius:50%;border:3px solid transparent;border-top-color:rgba(194,43,28,.0)}

/* prompts / subtitles */
#prompt{position:absolute;left:50%;bottom:26%;transform:translateX(-50%);padding:8px 18px;font-size:12px;letter-spacing:.2em;
  background:rgba(13,15,16,.7);border-left:2px solid var(--orange);border-right:2px solid var(--orange);opacity:0;transition:opacity .2s}
#prompt.show{opacity:1}
#subtitles{position:absolute;left:50%;bottom:15%;transform:translateX(-50%);width:min(820px,84vw);text-align:center}
.sub-line{margin:5px 0;padding:6px 12px;background:rgba(8,10,11,.62);display:inline-block;max-width:100%}
.sub-line .spk{color:var(--orange);font-size:11px;letter-spacing:.16em;margin-right:8px}
.sub-line .en{font-size:14px;letter-spacing:.02em;line-height:1.4;display:block;color:var(--bone)}
.sub-line .ar{font-size:15px;direction:rtl;letter-spacing:0;line-height:1.6;display:block;color:rgba(232,226,208,.72);font-family:"Noto Naskh Arabic","Segoe UI",serif;margin-top:2px}

/* mission feed */
#feed{position:absolute;right:26px;top:190px;width:270px;text-align:right}
.feed-item{font-size:11px;letter-spacing:.12em;color:rgba(232,226,208,.8);padding:5px 9px;margin-bottom:4px;
  background:rgba(8,10,11,.6);border-right:2px solid var(--orange);animation:feedIn .25s ease-out;line-height:1.4}
.feed-item.kill{border-right-color:var(--red)}
.feed-item.squad{border-right-color:var(--blue)}
@keyframes feedIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}

/* interaction */
#interact{position:absolute;left:50%;top:58%;transform:translateX(-50%);font-size:12px;letter-spacing:.18em;padding:7px 14px;
  background:rgba(13,15,16,.72);border:1px solid rgba(224,116,31,.4);display:none}
#interact.show{display:block}
#interact b{color:var(--orange)}

/* objectives overlay */
#objectives-overlay{position:absolute;inset:0;background:rgba(5,7,8,.86);display:none;padding:8vh 10vw;pointer-events:none}
#objectives-overlay.show{display:block}
#objectives-overlay h2{font-size:13px;letter-spacing:.34em;color:var(--orange);margin:0 0 4px}
#objectives-overlay h3{font-size:24px;letter-spacing:.06em;margin:0 0 22px;font-weight:600}
#objectives-overlay .obj{display:flex;gap:14px;align-items:flex-start;margin:10px 0;font-size:14px;letter-spacing:.03em}
#objectives-overlay .obj .num{width:26px;color:var(--orange);font-weight:700;font-size:12px;padding-top:2px}
#objectives-overlay .obj.done{color:rgba(232,226,208,.4)}
#objectives-overlay .obj.done .num{color:var(--green)}
#objectives-overlay .intel{margin-top:26px;padding-top:18px;border-top:1px solid rgba(201,191,163,.18);font-size:12px;color:rgba(232,226,208,.55);letter-spacing:.1em}
#objectives-overlay .intel b{color:var(--orange)}
#objectives-overlay .hint{margin-top:10px;font-size:11px;color:rgba(232,226,208,.35);letter-spacing:.14em}

/* nvg / status chips */
#chips{position:absolute;left:26px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:6px}
.chip{font-size:9px;letter-spacing:.2em;padding:4px 8px;background:rgba(8,10,11,.7);border-left:2px solid var(--olive2);color:rgba(232,226,208,.7);opacity:0;transition:opacity .2s}
.chip.on{opacity:1;border-left-color:var(--orange);color:var(--orange2)}

/* compass objective marker */
.obj-marker{position:absolute;top:44px;transform:translateX(-50%);font-size:9px;letter-spacing:.1em;color:var(--orange);
  white-space:nowrap;display:flex;flex-direction:column;align-items:center;gap:1px}
.obj-marker .diamond{width:6px;height:6px;background:var(--orange);transform:rotate(45deg);box-shadow:0 0 6px rgba(224,116,31,.7)}
.obj-marker .dist{color:rgba(232,226,208,.65);font-size:8px}

/* vignette + low health */
#dmg-vignette{position:absolute;inset:0;box-shadow:inset 0 0 140px rgba(140,10,10,.0);transition:box-shadow .25s;pointer-events:none}

/* chapter title card */
#chapter-card{position:absolute;inset:0;display:none;align-items:center;justify-content:flex-start;padding-left:9vw;background:linear-gradient(90deg,rgba(5,7,8,.9) 0%,rgba(5,7,8,.45) 45%,transparent 75%)}
#chapter-card.show{display:flex}
#chapter-card .cc-inner{max-width:560px}
#chapter-card .cc-era{font-size:11px;letter-spacing:.5em;color:var(--orange);margin-bottom:14px}
#chapter-card .cc-num{font-size:12px;letter-spacing:.44em;color:rgba(232,226,208,.55);margin-bottom:6px}
#chapter-card .cc-title{font-size:clamp(38px,6.4vw,86px);line-height:.96;letter-spacing:.02em;font-weight:700;margin-bottom:14px}
#chapter-card .cc-sub{font-size:13px;letter-spacing:.2em;color:rgba(232,226,208,.6);line-height:1.7}
#chapter-card .cc-rule{width:88px;height:2px;background:var(--orange);margin:20px 0}
`

export class HUD {
  constructor(game) {
    this.game = game;
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.className = 'hidden';
    document.body.appendChild(this.root);

    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    this.root.innerHTML = `
      <div id="dmg-vignette"></div>
      <div id="compass"><div id="compass-inner"></div><div id="compass-needle"></div><div id="objective-marker-labels"></div></div>

      <div id="objective" class="hud-panel">
        <i class="hud-corner tl"></i><i class="hud-corner tr"></i>
        <div class="label">CURRENT OBJECTIVE</div>
        <div class="primary" id="obj-primary">—</div>
        <div class="sub" id="obj-sub"></div>
      </div>

      <div id="team" class="hud-panel">
        <i class="hud-corner tl"></i><i class="hud-corner tr"></i>
        <div class="label">SQUAD · <span id="team-count">0</span></div>
        <div id="team-list"></div>
      </div>

      <div id="vitals" class="hud-panel">
        <i class="hud-corner bl"></i>
        <div id="health-label"><span>VITALS</span><span id="health-state">STABLE</span></div>
        <div id="health-val">100</div>
        <div id="health-track"><div id="health-fill"></div></div>
        <div id="stamina-track"><div id="stamina-fill"></div></div>
        <div id="stance-row"><span>STANCE <b id="stance">STAND</b></span><span>LEAN <b id="lean">0</b></span><span>SPD <b id="spd">0.0</b></span></div>
      </div>

      <div id="ammo" class="hud-panel">
        <i class="hud-corner br"></i>
        <div class="wname" id="wname">AKM <small>ASSAULT RIFLE</small></div>
        <div class="counts"><span class="mag" id="mag">30</span><span class="res">/ <span id="reserve">180</span></span></div>
        <div class="mode" id="fire-mode">AUTO · 7.62×39</div>
        <div id="reload-bar"><div id="reload-fill"></div></div>
        <div id="grenades">GRENADES <b id="grenade-count">2</b></div>
      </div>

      <div id="crosshair"><div class="dot"></div><div class="bar b1"></div><div class="bar b2"></div><div class="bar b3"></div><div class="bar b4"></div></div>
      <div id="hitmarker"><span class="h1"></span><span class="h2"></span><span class="h3"></span><span class="h4"></span></div>
      <div id="headshot-tag">HEADSHOT</div>

      <div id="chips">
        <div class="chip" id="chip-nvg">NIGHT VISION ACTIVE</div>
        <div class="chip" id="chip-supp">SUPPRESSED</div>
        <div class="chip" id="chip-stealth">UNDETECTED</div>
      </div>

      <div id="feed"></div>
      <div id="prompt"></div>
      <div id="interact"><b>[F]</b> <span id="interact-label">INTERACT</span></div>
      <div id="subtitles"></div>

      <div id="objectives-overlay">
        <h2>MISSION FILE · <span id="ovl-code">OP</span></h2>
        <h3 id="ovl-title">OBJECTIVES</h3>
        <div id="ovl-list"></div>
        <div class="intel" id="ovl-intel">INTELLIGENCE RECOVERED <b>0 / 0</b></div>
        <div class="hint">TAB — CLOSE FILE · ESC — PAUSE</div>
      </div>

      <div id="chapter-card">
        <div class="cc-inner">
          <div class="cc-era" id="cc-era">EGYPT · OCTOBER 1973</div>
          <div class="cc-num" id="cc-num">CHAPTER 01</div>
          <div class="cc-title" id="cc-title">THE CROSSING</div>
          <div class="cc-rule"></div>
          <div class="cc-sub" id="cc-sub">Second Army · Commando Detachment</div>
        </div>
      </div>
    `;

    this.el = {};
    for (const id of ['compass-inner', 'objective-marker-labels', 'obj-primary', 'obj-sub', 'team-list', 'team-count',
      'health-val', 'health-fill', 'health-state', 'stamina-fill', 'stance', 'lean', 'spd', 'wname', 'mag', 'reserve',
      'fire-mode', 'reload-bar', 'reload-fill', 'grenade-count', 'crosshair', 'hitmarker', 'headshot-tag', 'feed',
      'prompt', 'interact', 'interact-label', 'subtitles', 'objectives-overlay', 'ovl-list', 'ovl-title', 'ovl-code',
      'ovl-intel', 'chip-nvg', 'chip-supp', 'chip-stealth', 'dmg-vignette', 'chapter-card', 'cc-era', 'cc-num',
      'cc-title', 'cc-sub']) {
      this.el[id] = this.root.querySelector(`#${id}`);
    }
    this._buildCompass();
    this._subQueue = [];
    this._feedItems = [];
    this._promptTimer = 0;
    this._hitDir = [];
    this.lastAmmoStr = '';
    this.visible = false;
  }

  _buildCompass() {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    let html = '';
    for (let deg = -180; deg <= 540; deg += 15) {
      const norm = ((deg % 360) + 360) % 360;
      const label = Math.abs(norm % 45) < 0.1 ? dirs[Math.round(norm / 45) % 8] : '';
      const major = !!label;
      const bearing = label || (norm % 30 === 0 ? String(Math.round(norm)) : '·');
      html += `<span class="cmp-tick ${major ? 'major' : 'minor'}" data-deg="${deg}">${bearing}</span>`;
    }
    this.el['compass-inner'].innerHTML = html;
    this._ticks = [...this.el['compass-inner'].querySelectorAll('.cmp-tick')];
  }

  show(v = true) {
    this.visible = v;
    this.root.classList.toggle('hidden', !v);
  }

  setEraSkin(era) {
    this.root.classList.toggle('era-1973', era === '1973');
    this.root.classList.toggle('era-modern', era !== '1973');
    const v = document.documentElement.style;
    if (era === '1973') {
      v.setProperty('--orange', '#e0741f');
      v.setProperty('--bone', '#e8e2d0');
    } else {
      v.setProperty('--orange', '#ff8a24');
      v.setProperty('--bone', '#dbe7ea');
    }
  }

  setObjective(primary, subs = []) {
    this.el['obj-primary'].textContent = primary;
    this.el['obj-sub'].innerHTML = subs.map((s) =>
      `<div class="${s.done ? 'ok' : 'todo'}">${s.text}</div>`).join('');
  }

  setObjectivesOverlay(title, code, objectives, intel) {
    this.el['ovl-title'].textContent = title;
    this.el['ovl-code'].textContent = code;
    this.el['ovl-list'].innerHTML = objectives.map((o, i) =>
      `<div class="obj ${o.done ? 'done' : ''}"><span class="num">${String(i + 1).padStart(2, '0')}</span><span>${o.text}</span></div>`).join('');
    this.el['ovl-intel'].innerHTML = `INTELLIGENCE RECOVERED <b>${intel.found} / ${intel.total}</b>`;
  }

  toggleObjectives(force) {
    const el = this.el['objectives-overlay'];
    const on = force !== undefined ? force : !el.classList.contains('show');
    el.classList.toggle('show', on);
    return on;
  }

  setSquad(list) {
    const alive = list.filter((s) => !s.dead);
    this.el['team-count'].textContent = `${alive.filter((s) => !s.down).length}`;
    const html = alive.map((s) => {
      const pct = Math.max(0, Math.round((s.health / s.maxHealth) * 100));
      const cls = s.down ? 'down' : '';
      return `<div class="team-row ${cls}">
        <span class="cs">${s.callsign}</span>
        <span class="nm">${s.nameEn.split(' ').slice(-1)[0]}</span>
        <span class="team-bar"><i style="width:${pct}%"></i></span>
      </div>`;
    }).join('');
    this.el['team-list'].innerHTML = html || `<div class="team-row"><span class="nm">NO SQUAD ATTACHED</span></div>`;
  }

  update(dt) {
    const p = this.game.player;
    if (!p) return;

    // ---------------------------------------------------------- compass
    const yawDeg = ((-p.yaw * 180 / Math.PI) % 360 + 360) % 360;
    const pxPerDeg = 26 / 15;
    const offset = -(yawDeg) * pxPerDeg;
    const width = window.innerWidth * 0.72;
    this.el['compass-inner'].style.transform = `translateX(${offset + width / 2 - 13}px)`;

    // objective markers
    this._updateMarkers(dt);

    // ---------------------------------------------------------- vitals
    const hp = Math.round(p.health);
    this.el['health-val'].textContent = hp;
    const fill = this.el['health-fill'];
    fill.style.width = `${Math.max(0, hp)}%`;
    fill.className = hp <= 30 ? 'low' : hp <= 60 ? 'mid' : '';
    this.el['health-state'].textContent = hp <= 30 ? 'CRITICAL' : hp <= 60 ? 'INJURED' : 'STABLE';
    this.el['stamina-fill'].style.width = `${Math.round(p.stamina * 100)}%`;
    this.el['stance'].textContent = p.stanceName;
    this.el['lean'].textContent = p.lean < -0.15 ? 'L' : p.lean > 0.15 ? 'R' : '0';
    this.el['spd'].textContent = p.moveSpeedNow.toFixed(1);

    this.el['dmg-vignette'].style.boxShadow = hp <= 30
      ? `inset 0 0 ${120 + Math.sin(this.game.time * 6) * 40}px rgba(140,10,10,${0.35 + (1 - hp / 30) * 0.3})`
      : 'inset 0 0 140px rgba(140,10,10,0)';

    // ---------------------------------------------------------- weapon
    const w = p.weapon;
    this.el['wname'].innerHTML = `${w.def.name} <small>${w.def.class}</small>`;
    this.el['mag'].textContent = String(w.ammo).padStart(2, '0');
    this.el['mag'].className = 'mag' + (w.ammo === 0 ? ' empty' : w.ammo <= w.def.mag * 0.3 ? ' low' : '');
    this.el['reserve'].textContent = w.reserve;
    this.el['fire-mode'].textContent = `${w.def.auto ? 'AUTO' : 'SEMI'} · ${w.def.origin}`;
    this.el['grenade-count'].textContent = p.grenades;

    if (w.reloading) {
      this.el['reload-bar'].classList.add('on');
      const t = 1 - (w.reloadT / w.def.reloadTime);
      this.el['reload-fill'].style.width = `${Math.round(Math.max(0, Math.min(1, t)) * 100)}%`;
    } else {
      this.el['reload-bar'].classList.remove('on');
    }

    // ---------------------------------------------------------- crosshair
    const spread = w.currentSpread(p.moveSpeedNow / 7, p.aiming, p.crouchT > 0.5);
    const gap = Math.round(4 + spread * 900);
    const bars = this.el['crosshair'].querySelectorAll('.bar');
    const b1 = bars[0], b2 = bars[1], b3 = bars[2], b4 = bars[3];
    const sizeScale = p.aiming ? 0.6 : 1;
    const len = Math.round(9 * sizeScale);
    b1.style.height = `${len}px`; b1.style.top = `${20 - gap}px`;
    b2.style.height = `${len}px`; b2.style.bottom = `${20 - gap}px`;
    b3.style.width = `${len}px`; b3.style.left = `${20 - gap}px`;
    b4.style.width = `${len}px`; b4.style.right = `${20 - gap}px`;
    this.el['crosshair'].style.opacity = (p.aiming ? 0.75 : 1) * (p.dead ? 0 : 1);
    this.el['crosshair'].style.display = p.aiming && this.game.usingOptic ? 'none' : 'block';

    // ---------------------------------------------------------- chips
    this.el['chip-nvg'].classList.toggle('on', p.nightVision);
    this.el['chip-supp'].classList.toggle('on', p.suppression > 0.45);
    const alert = this.game.ai ? this.game.ai.alertLevel : 0;
    this.el['chip-stealth'].classList.toggle('on', alert < 0.35);
    if (alert >= 0.35) {
      this.el['chip-stealth'].textContent = 'DETECTED';
      this.el['chip-stealth'].style.borderLeftColor = 'var(--red)';
    } else {
      this.el['chip-stealth'].textContent = 'UNDETECTED';
      this.el['chip-stealth'].style.borderLeftColor = '';
    }

    // ---------------------------------------------------------- revive prompt
    if (this.game.ai) {
      const downed = this.game.ai.squad.find((m) => m.down && !m.dead &&
        Math.hypot(m.pos.x - p.pos.x, m.pos.z - p.pos.z) < 2.6);
      if (downed && !p.reviveTarget) {
        this.el['interact-label'].textContent = `REVIVE ${downed.callsign}`;
        this.el['interact'].classList.add('show');
        this._revivePrompt = true;
      } else if (this._revivePrompt) {
        this.el['interact'].classList.remove('show');
        this._revivePrompt = false;
      }
    }

    // ---------------------------------------------------------- prompts
    if (this._promptTimer > 0) {
      this._promptTimer -= dt;
      if (this._promptTimer <= 0) this.el['prompt'].classList.remove('show');
    }

    // ---------------------------------------------------------- subtitles
    this._updateSubtitles(dt);

    // ---------------------------------------------------------- damage director
    this._updateDamageArcs(dt);
  }

  _updateMarkers(dt) {
    const markers = this.game.mission.getObjectiveMarkers ? this.game.mission.getObjectiveMarkers() : [];
    const container = this.el['objective-marker-labels'];
    const p = this.game.player;
    let html = '';
    const compassWidth = 560;
    for (const m of markers) {
      const dx = m.pos.x - p.pos.x;
      const dz = m.pos.z - p.pos.z;
      const dist = Math.hypot(dx, dz);
      const bearing = Math.atan2(dx, -dz);
      let rel = bearing - p.yaw;
      rel = ((rel + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      if (Math.abs(rel) < 1.15) {
        const x = (rel / (Math.PI * 2)) * compassWidth * 1.0 * 2.2 + compassWidth / 2;
        html += `<div class="obj-marker" style="left:${x}px"><span class="diamond"></span><span class="dist">${m.label || 'OBJ'} ${Math.round(dist)}m</span></div>`;
      }
    }
    container.innerHTML = html;
    void dt;
  }

  hitMarker(kill, headshot) {
    const hm = this.el['hitmarker'];
    hm.classList.remove('show', 'kill');
    void hm.offsetWidth;
    if (kill) hm.classList.add('kill');
    hm.classList.add('show');
    if (headshot) {
      const tag = this.el['headshot-tag'];
      tag.classList.remove('show'); void tag.offsetWidth; tag.classList.add('show');
    }
  }

  flashDamage(angle, amount) {
    this._hitDir.push({ angle, t: 1.1, amount });
    if (this._hitDir.length > 4) this._hitDir.shift();
  }

  showHitDirection(fromPos) {
    const p = this.game.player;
    const dx = fromPos.x - p.pos.x, dz = fromPos.z - p.pos.z;
    const bearing = Math.atan2(dx, -dz);
    let rel = bearing - p.yaw;
    rel = ((rel + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this._hitDir.push({ angle: rel, t: 1.0, amount: 8 });
    if (this._hitDir.length > 5) this._hitDir.shift();
  }

  _updateDamageArcs(dt) {
    for (const a of this._hitDir) a.t -= dt;
    this._hitDir = this._hitDir.filter((a) => a.t > 0);
    const el = document.querySelector('#hud-dmg-arcs');
    if (!el) {
      const d = document.createElement('div');
      d.id = 'hud-dmg-arcs';
      d.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
      this.root.appendChild(d);
    }
    const host = document.querySelector('#hud-dmg-arcs');
    host.innerHTML = this._hitDir.map((a) => {
      const deg = -a.angle * 180 / Math.PI;
      const op = Math.max(0, a.t / 1.0) * 0.85;
      return `<div style="position:absolute;left:50%;top:50%;width:0;height:0;transform:translate(-50%,-50%) rotate(${deg}deg)">
        <div style="position:absolute;left:-70px;top:-140px;width:140px;height:8px;border-radius:4px;
          background:radial-gradient(ellipse at center, rgba(194,43,28,${op}) 0%, rgba(194,43,28,0) 72%);
          filter:blur(1px)"></div></div>`;
    }).join('');
  }

  showPrompt(text, time = 1.5) {
    this.el['prompt'].textContent = text;
    this.el['prompt'].classList.add('show');
    this._promptTimer = time;
  }

  showInteract(label) {
    if (label) {
      this.el['interact-label'].textContent = label;
      this.el['interact'].classList.add('show');
    } else {
      this.el['interact'].classList.remove('show');
    }
  }

  feed(text, kind = '') {
    const div = document.createElement('div');
    div.className = `feed-item ${kind}`;
    div.textContent = text;
    this.el['feed'].appendChild(div);
    setTimeout(() => {
      div.style.transition = 'opacity .4s';
      div.style.opacity = '0';
      setTimeout(() => div.remove(), 420);
    }, 4200);
    while (this.el['feed'].children.length > 6) this.el['feed'].firstChild.remove();
  }

  /** @param {{speaker:string, en:string, ar?:string, time?:number}} line */
  say(line) {
    const div = document.createElement('div');
    div.className = 'sub-line';
    const showAr = this.game.settings.showArabic && line.ar;
    div.innerHTML = `<span class="spk">${line.speaker}</span>
      ${showAr ? `<span class="ar">${line.ar}</span>` : ''}
      <span class="en">${line.en}</span>`;
    this.el['subtitles'].appendChild(div);
    const ttl = line.time || Math.max(2600, Math.min(7200, line.en.length * 62));
    const item = { el: div, ttl, age: 0 };
    this._subQueue.push(item);
    while (this._subQueue.length > 3) {
      const old = this._subQueue.shift();
      old.el.remove();
    }
    if (line.voice !== false) this.game.audio.radio(Math.min(14, Math.max(3, Math.round(line.en.length / 7))), line.urgent ? 0.85 : 0.4);
  }

  _updateSubtitles(dt) {
    for (let i = this._subQueue.length - 1; i >= 0; i--) {
      const s = this._subQueue[i];
      s.age += dt * 1000;
      if (s.age > s.ttl) {
        s.el.style.transition = 'opacity .3s';
        s.el.style.opacity = '0';
        setTimeout(() => s.el.remove(), 320);
        this._subQueue.splice(i, 1);
      }
    }
  }

  showChapterCard({ era, num, title, sub }, duration = 5200) {
    this.el['cc-era'].textContent = era;
    this.el['cc-num'].textContent = num;
    this.el['cc-title'].textContent = title;
    this.el['cc-sub'].innerHTML = sub;
    const card = this.el['chapter-card'];
    card.classList.add('show');
    card.style.opacity = '0';
    card.style.transition = 'opacity .8s';
    requestAnimationFrame(() => { card.style.opacity = '1'; });
    setTimeout(() => {
      card.style.opacity = '0';
      setTimeout(() => card.classList.remove('show'), 900);
    }, duration);
  }

  clearSubtitles() {
    this.el['subtitles'].innerHTML = '';
    this._subQueue = [];
  }

  reset() {
    this.clearSubtitles();
    this.el['feed'].innerHTML = '';
    this._hitDir = [];
    this.el['prompt'].classList.remove('show');
    this.el['objectives-overlay'].classList.remove('show');
  }
}

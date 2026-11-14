/**
 * SHADOW PROTOCOL — entry point
 * Boots the renderer, registers the playable chapters, exposes a debug handle.
 */
import { Game } from './game/game.js';
import { CHAPTER_01_MISSIONS, buildCrossingMission, buildDepotMission } from './levels/chapter01.js';
import { CHAPTER_02_MISSION, buildSilentMission } from './levels/chapter02.js';
import { CHAPTER_03_MISSION, buildArchiveMission } from './levels/chapter03.js';
import { CHAPTER_04_MISSION, buildViennaMission } from './levels/chapter04.js';
import { CHAPTER_05_MISSION, buildBetrayalMission } from './levels/chapter05.js';
import { CHAPTER_06_MISSION, buildMizanMission } from './levels/chapter06.js';
import { CHAPTER_07_MISSION, buildLegacyMission } from './levels/chapter07.js';
import * as models from './game/models.js';

// models are reachable from level builders that need optional props
window.__SP_MODELS__ = models;
window.__SP_HELI__ = models;

function fatal(err) {
  console.error(err);
  const box = document.getElementById('error');
  const detail = document.getElementById('error-detail');
  if (box && detail) {
    box.style.display = 'block';
    detail.textContent = `${err && err.stack ? err.stack : String(err)}`;
  }
  const boot = document.getElementById('boot');
  if (boot) boot.classList.add('done');
}

window.addEventListener('error', (e) => {
  if (e.error) fatal(e.error);
});
window.addEventListener('unhandledrejection', (e) => fatal(e.reason));

function start() {
  const canvas = document.getElementById('view');
  let game;
  try {
    game = new Game(canvas);
  } catch (e) {
    fatal(e);
    return;
  }

  // ---- register playable missions -------------------------------------------
  game.registerMission(CHAPTER_01_MISSIONS[0], buildCrossingMission);
  game.registerMission(CHAPTER_01_MISSIONS[1], buildDepotMission);
  game.registerMission(CHAPTER_02_MISSION, buildSilentMission);
  game.registerMission(CHAPTER_03_MISSION, buildArchiveMission);
  game.registerMission(CHAPTER_04_MISSION, buildViennaMission);
  game.registerMission(CHAPTER_05_MISSION, buildBetrayalMission);
  game.registerMission(CHAPTER_06_MISSION, buildMizanMission);
  game.registerMission(CHAPTER_07_MISSION, buildLegacyMission);

  // hooks used by the mission builders
  CHAPTER_01_MISSIONS[0].onStart = (g) => { g.chapterIndex = 1; };
  CHAPTER_01_MISSIONS[1].onStart = (g) => { g.chapterIndex = 1; };
  CHAPTER_02_MISSION.onStart = (g) => { g.chapterIndex = 2; };
  CHAPTER_03_MISSION.onStart = (g) => { g.chapterIndex = 3; };
  CHAPTER_04_MISSION.onStart = (g) => { g.chapterIndex = 4; };
  CHAPTER_05_MISSION.onStart = (g) => { g.chapterIndex = 5; };
  CHAPTER_06_MISSION.onStart = (g) => { g.chapterIndex = 6; };
  CHAPTER_07_MISSION.onStart = (g) => { g.chapterIndex = 7; };

  // the chapter-01 finale chains into chapter 02
  const origComplete = game.onMissionComplete.bind(game);
  game.onMissionComplete = function () {
    if (this.mission.id === 'ch01_crossing') {
      // first chapter's first mission: unlock the finale mission and let the player continue
      this.save.setProgress((p) => { p.chaptersUnlocked = Math.max(p.chaptersUnlocked, 1); });
    }
    origComplete();
  };

  window.__SP__ = game;
  window.__SP_GAME__ = game;

  // ---- deep link -----------------------------------------------------------
  // `?chapter=7` boots straight into a chapter, and `?unlock=all` opens the
  // whole campaign. Without this the only way to reach chapter 07 is to have a
  // save that got there, which makes the last chapter impossible to show
  // someone (or to smoke-test) without replaying six chapters first.
  {
    const params = new URLSearchParams(location.search);
    const unlock = params.get('unlock');
    if (unlock === 'all') {
      game.save.setProgress((p) => {
        p.chaptersUnlocked = 7;
        p.chaptersCompleted = [1, 2, 3, 4, 5, 6];
      });
    }
    const want = Number(params.get('chapter'));
    if (want >= 1 && want <= 7) {
      const id = [...game.missions.entries()]
        .find(([, m]) => m.def.chapterIndex === want)?.[0];
      if (id) {
        game.save.setProgress((p) => { p.chaptersUnlocked = Math.max(p.chaptersUnlocked, want); });
        game.menu.hideAll();
        game.startMission(id, { fromCheckpoint: false });
        game.requestLock();
      }
    }
    const intel = params.get('intel');
    if (intel === 'all') {
      // Every document, for looking at the dossier and the 1973 coda.
      import('./game/intel.js').then(({ INTELLIGENCE }) => {
        game.save.setProgress((p) => {
          p.intel = p.intel || {};
          for (const d of INTELLIGENCE) p.intel[d.id] = true;
        });
      });
    }
  }

  const boot = document.getElementById('boot');
  if (boot) {
    boot.querySelector('.hint').textContent = 'READY';
    setTimeout(() => boot.classList.add('done'), 420);
  }

  // unlock audio on the first interaction
  const unlock = () => {
    game.audio.init();
    game.audio.resume();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}

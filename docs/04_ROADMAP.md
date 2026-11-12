# SHADOW PROTOCOL: NASSER 07 — Production Roadmap

Ten milestones. Each one ends with something that can be played or verified — never a
document pretending to be a build. Status is honest as of this revision.

Legend: **[x]** done · **[~]** in progress · **[ ]** not started

---

## M1 — Foundation & vertical slice **[x]**

*Goal: prove the game is fun before proving it is pretty.*

- Playable browser vertical slice: 3 missions (Chapter 01 crossing, depot raid, Chapter 02 silent entry)
- Full movement set, weapons, squad AI, enemy perception, suppression, downed/revive, checkpoints
- 21 bilingual intelligence documents
- HUD, pause menu, objective flow, three endings resolve from flags
- Automated verification: `cd web && node tools/simtest.mjs` → **32 passed, 0 failed**

Exit criteria met: a stranger can sit down and finish a mission, and the systems survive
20 simulated seconds without a NaN.

---

## M2 — UE5 project skeleton **[x]**

*Goal: stand up the real engine project the game ships in.*

- UE 5.4 project, module, targets, `DefaultEngine/Game/Input/GameUserSettings.ini`
- Shared types (`ShadowProtocolTypes.h`): era, difficulty, stances, orders, AI states, hit zones, objectives, checkpoints, progress, dialogue, intel
- Character + movement component (walk → prone → slide → lean → mantle), stamina, capsule transitions
- Weapon data asset + weapon component with era gate, hitscan spread, recoil, suppression, AI noise
- AI controller with perception and a nine-state behaviour machine; enemy pawn; squad member with orders and revive
- Mission data asset + mission manager (objectives, checkpoints, intel, dialogue beats)
- Game mode, player controller, progress subsystem, save game, HUD/pause C++ models, user settings
- World actors: intel pickup, objective trigger, extraction point
- Front end: menu subsystem, main-menu controller/widget model, menu game mode
- Procedural graybox range (`ASPGrayboxLevel`) + `ASPGrayboxGameMode` test mission, so an
  empty level is playable with no authored assets
- Editor build script for mission data assets and maps; static verification tool

Exit criteria met at the source level. **Not compiled** — no UE toolchain in the authoring
environment. See `docs/03_TECHNICAL_ARCHITECTURE.md` §8.

---

## M3 — Chapter 01 blockout **[~]** ← in progress

*Goal: the first chapter exists as playable space.*

The procedural graybox range already provides playable geometry at correct scale
(canal 170 m, berm 8 m, 240 cm trench walls, 45 m depot yard). What remains is authored
blockout with real art direction instead of engine cubes.

- `L_Chapter01_Crossing`: staging area → berm breach → trench network → strongpoint 4 → Qantara road depot
- Grey-box geometry at correct scale (180 m of trench, 60 m berm frontage, depot yard 40×25 m)
- PlayerStart tagged `SP_MissionStart`; `ASPMissionManager` with `DA_ch01_crossing`
- Six `ASPIntelPickup` actors, five `ASPObjectiveTrigger` actors, one `ASPExtractionPoint`
- Nav mesh coverage verified on every route
- Two squad members spawning and following

Exit criteria: a full mission can be played start → extraction with no art at all.

---

## M4 — Combat feel pass **[ ]**

- Weapon data for AKM, Port Said, RPG-7 (+ RPD, SVD); modern M4, MP5SD, pistol
- Recoil curves, aim-down-sights blending, sway, hit-zone damage tuning
- Suppression feedback: audio ducking, camera shake, desaturation
- Melee and grenade feel, hitmarkers, damage direction
- Controller support tuned (deadzones, aim assist curves)

Exit criteria: shooting a wall for sixty seconds is still satisfying.

---

## M5 — Enemy & squad AI tuning **[ ]**

- Difficulty tiers validated by playtest: reaction time, accuracy, aggression, search persistence
- Fairness audit: no enemy can see through cover, no off-screen instakills, alert propagation bounded
- Squad orders feel responsive; formation keeps up through doors and stairs
- Downed/revive window tested at each difficulty (45 s / 22 s)

Exit criteria: three testers cannot fake-break the AI in ten minutes of trying.

---

## M6 — Chapter 01 art & audio **[ ]**

- Period-correct Egyptian uniforms, helmets, webbing, kit
- Berm, trenches, bunkers, rubber boats, ladders, pontoon bridge, wrecked vehicles
- `1973_Afternoon` and `1973_Night` lighting presets (Lumen, dust volumetrics)
- Weapon and ambience audio, Arabic VO for Taher's detachment, period music bed

Exit criteria: a screenshot reads as 1973 without a caption.

---

## M7 — Cinematics & narrative delivery **[ ]**

- Opening briefing (in-engine Level Sequence, letterboxed, skippable)
- Radio dialogue system with bilingual subtitles and speaker attribution
- Lip sync pass for the briefing cast
- Chapter card, debrief, credits-as-newsreel

Exit criteria: cutscenes can be skipped, paused and subtitled without desync.

---

## M8 — Chapters 02–03 **[~]** ← in progress

- Chapter 02: Port Komdok — three insertion routes, night vision, rooftop defence
- Chapter 03: Cairo archive hub — no combat until the final five minutes, intel-driven
  - **Done in the browser slice:** hub geometry (`libCairo.js`), six scripted beats, document
    collection, the Box 07 branching decision with a persisted flag, and the rooftop ambush
    with dormant/hold-fire AI states. UE side: objective rows + mission asset spec.
  - **Also done:** the forensics UV/ink minigame (`web/src/game/forensics.js`) — real rules,
    real failure state, retryable, and covered by three automated checks.
  - **Outstanding:** interview dialogue wheel, suspicion meter, and the Unreal implementation
    of the hub level itself.
- Optional objectives and hidden intel wired to campaign flags

---

## M9 — Chapters 04–06 **[ ]**

- Chapter 04: semi-open city district + vehicle pursuit
- Chapter 05: ambush, traitor reveal, branching survival
- Chapter 06: underground facility, the reveal, squad fate

---

## M10 — Chapter 07, endings & ship **[ ]**

- Chapter 07: three endings (Clean Hands / The Ledger / Inheritance) + secret epilogue (The Quiet Choice)
- Save/load, chapter select, New Game Plus carrying documents and unlocks
- Graphics settings matrix, frame-time budget, load times, crash sweep
- Localisation pass, accessibility pass, final QC

---

## Milestone discipline

- Nothing is marked done on the strength of "the code is written". A milestone closes when
  its exit criteria are demonstrated.
- The browser slice stays green throughout; it is the regression net for gameplay logic that
  cannot be compiled here.
- Gaps are listed, not hidden — see `docs/03_TECHNICAL_ARCHITECTURE.md` §11.

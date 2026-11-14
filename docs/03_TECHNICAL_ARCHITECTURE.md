# SHADOW PROTOCOL: NASSER 07 — Technical Architecture

**Engine:** Unreal Engine 5.4 · **Platform:** Windows PC (DX12, SM6) · **Language:** C++ core + Blueprint data/visual layer

This document describes what is actually built in `ShadowProtocol/`, what is a stub, and
what remains. It is written to be honest: nothing is described as finished unless it is.

---

## 1. Repository layout

```
/README.md                     project overview + build instructions
/docs/                         01 story bible · 02 chapters · 03 this file · 04 roadmap · 05 audio · 06 history
/web/                          playable browser vertical slice (three missions, 32 automated checks)
/ShadowProtocol/
  ShadowProtocol.uproject      UE 5.4, plugins: EnhancedInput, Niagara, Metasound, LevelSequence, GeometryScripting
  Config/                      DefaultEngine / DefaultGame / DefaultInput / DefaultGameUserSettings
  Content/Data/                DT_Objectives.csv + generated data assets (see §9)
  Tools/build_mission_assets.py  editor Python: builds mission data assets and maps
  Source/ShadowProtocol/
    Core/       ShadowProtocolTypes · SPGameMode · SPGrayboxGameMode · SPMenuGameMode
                SPPlayerController · SPMainMenuController · SPMenuSubsystem
                SPProgressSubsystem · SPSaveGame · SPGameUserSettings
    Character/  SPCharacter · SPCharacterMovementComponent
    Weapons/    SPWeaponData · SPWeaponComponent
    AI/         SPAIController · SPEnemyCharacter · SPSquadMember
    Mission/    SPMissionData · SPMissionManager
    UI/         SPHUDWidget · SPPauseMenuWidget · SPMainMenuWidget
    World/      SPIntelPickup · SPObjectiveTrigger · SPExtractionPoint · SPGrayboxLevel
```

---

## 2. Class responsibilities

| Class | Role | Status |
|---|---|---|
| `USPCharacterMovementComponent` | Full movement set: walk, sprint, tactical sprint, crouch, prone, slide, jump, lean, mantle; stamina; capsule resizing; `CanStandUp()` | Implemented |
| `ASPCharacter` | Both protagonists, era-parameterised: health/regen, ADS FOV blend, lean camera offset, compass, night vision (modern only), melee, grenades, revive scan, legacy + Enhanced Input | Implemented |
| `USPWeaponData` | Weapon data asset: ballistics, recoil, handling, presentation; `ValidateEraCompatibility()`, `GetDamageAtDistance()` | Implemented |
| `USPWeaponComponent` | Loadout, hitscan with cone spread + hit zones, recoil accumulation, reloads, suppression, AI noise, `SetEra()` era purge | Implemented |
| `ASPAIController` | Perception profile (sight cone + LOS + hearing), awareness state machine (Idle→Suspicious→Search→Combat→TakeCover/Flank/Retreat), difficulty scaling, alert propagation | Implemented |
| `ASPEnemyCharacter` | Hostile pawn: armour absorption, `FireAtTarget(Target, bWillHit, AimError)`, near-miss suppression, death ragdoll + notify | Implemented |
| `ASPSquadMember` | Squad AI: formation slots, five orders, LOS target selection, fire, downed → revive window → KIA permanence, radio chatter | Implemented |
| `ASPMissionManager` | Objective graph, checkpoints, squad spawning, intel, dialogue beats, completion handoff | Implemented |
| `ASPGameMode` | Session orchestration: squad orders, noise/alert routing, checkpoints, subtitles, mission completion, difficulty application | Implemented |
| `ASPPlayerController` | HUD lifecycle, pause, tactical map toggle, cinematic mode, settings application, squad-order input | Implemented |
| `USPProgressSubsystem` | Campaign persistence: chapters, intel, ending flags, difficulty, ending resolution | Implemented |
| `USPSaveGame` | Serialised campaign progress + active checkpoint | Implemented |
| `USPGameUserSettings` | Persisted options: subtitles (EN/AR), sensitivity, audio buses, graphics presets | Implemented |
| `USPHUDWidget` | Presentation-only HUD data model + Blueprint events (layout authored in UMG) | C++ side implemented; **widget Blueprints not authored** |
| `USPPauseMenuWidget` | Pause surface wired to real functions | C++ side implemented; **widget Blueprint not authored** |
| `ASPMenuSubsystem` | Front-end state machine: new campaign, continue, chapter select, settings, quit. Chapter buttons are enabled only when the save *and* the level file support them | Implemented |
| `ASPMainMenuController` / `USPMainMenuWidget` | Front-end controller + widget data model | C++ side implemented; **widget Blueprint not authored** |
| `ASPMenuGameMode` | Front-end session (no pawn, no combat systems) | Implemented |
| `ASPGrayboxLevel` | Procedural 1973 crossing test range built from engine primitives | Implemented |
| `ASPGrayboxGameMode` | Spawns the range + a code-defined test mission so the project runs with zero authored assets | Implemented |
| `ASPMissionData` | Chapter-mission definition asset | Implemented |
| `ASPIntelPickup` / `ASPObjectiveTrigger` / `ASPExtractionPoint` | Level-authored mission plumbing | Implemented |

---

## 3. Data flow (one frame, combat)

```
Input ─► ASPCharacter handler ─► USPWeaponComponent::StartFire()
                                     │
                                     ├─ line trace + cone spread ─► damage + ESPHitZone
                                     ├─ recoil accumulated ─► ASPCharacter camera (ConsumeRecoil)
                                     ├─ OnAmmoChanged / OnHitConfirmed ─► USPHUDWidget
                                     └─ UAISense_Hearing::ReportNoiseEvent
                                        + ASPGameMode::NotifySoundEvent (per-controller attenuation)
                                              │
                                              ▼
                                        ASPAIController::NotifyHeardNoise → awareness → state machine
                                              │ contact made
                                              ▼
                                        ASPGameMode::PropagateAlert → neighbouring controllers
```

Mission state flows the other way:

```
ASPMissionManager::CompleteObjective
   ├─ OnObjectiveChanged ─► USPHUDWidget (objective banner)
   ├─ RecordCheckpoint ─► ASPGameMode::StoreCheckpoint ─► USPSaveGame ─► disk
   └─ all primaries done ─► USPProgressSubsystem::CompleteChapter ─► ASPGameMode::NotifyMissionComplete
```

---

## 4. Era enforcement (the 1973 rule)

Three independent gates, because the brief is explicit that Taher never touches modern kit:

1. **Data**: every `USPWeaponData` carries `ESPEra Era`. `ValidateEraCompatibility()` rejects a mismatch and returns a reason string.
2. **Runtime**: `USPWeaponComponent::SetEra()` is authoritative — it purges any loadout entry whose era no longer matches, so even a Blueprint mistake cannot survive.
3. **Character**: `ASPCharacter::SetNightVisionEnabled()` returns false in 1973 regardless of input; the night-vision input is bound but inert in period chapters.

The same pattern applies to squad gear through `ASPSquadMember::ConfigureIdentity(CharacterId, Era, Callsign)`.

---

## 5. Two visual identities

| | 1973 | Modern |
|---|---|---|
| Palette | Bleached sand, oxide red, faded olive; heavy film grain, halation | Graphite, sodium orange, cold cyan accents; clean blacks |
| Post process | Bloom 0.9, grain 0.45, chromatic 0.35, film vignette | Bloom 0.4, grain 0.12, chromatic 0.05, sharpen 0.35 |
| Lighting preset | `1973_Afternoon` / `1973_Night` (Lumen, low sun, dust volumetrics) | `Modern_Night` (Lumen, practical-driven, rain volumetrics) |
| Camera | 90° base FOV, heavier lean offset, no FOV kick on sprint | 90° base, wider tactical-sprint kick (96°) |
| Audio bed | Tape-limited, mono-leaning, distant artillery | Full-range, stereo, digital radio codec |

Preset selection is data (`USPMissionData::LightingPresetName`, `TimeOfDayHours`), applied per chapter.

---

## 6. Mission framework

Chapters are **data, not code**. Each mission is a `USPMissionData`:

- identity (id, chapter index, bilingual titles, code, synopsis)
- setup (era, protagonist, start transform, loadout, squad spawns, difficulty, night vision)
- objectives (`FSPObjective[]`, primary/optional/hidden, marker locations)
- intel (`FSPIntelEntry[]`, 39 documents campaign-wide: 16 required for the 1973 coda, the rest optional)
- dialogue beats (trigger id → bilingual lines)
- cinematics (opening/closing `ULevelSequence`, ambience, time of day)
- outcome flags (`FlagsOnComplete` → ending resolution)

Levels wire it up with `ASPMissionManager` + `ASPObjectiveTrigger` / `ASPIntelPickup` / `ASPExtractionPoint`.
Adding Chapter 03 is authoring one asset and one level — no engineering work.

---

## 7. Checkpointing & save

- Checkpoint payload: mission id, player transform, completed objectives, collected intel, health, weapon slot, timestamp, load count.
- Written on objective completion, extraction, and every 240 s (`AutoCheckpointInterval`).
- Death restarts from the last checkpoint after `DeathReloadDelay`, restoring objectives, intel, position and health, and clearing input locks.
- Campaign progress (chapters, intel, four ending flags, casualties, difficulty) persists in `USPProgressSubsystem` → `USPSaveGame`.

---

## 7b. Front end

Two sessions, deliberately separate:

- **`L_MainMenu` + `ASPMenuGameMode`**: spectator pawn, mouse-driven UI. `USPMenuSubsystem`
  owns the screen state and all actions. New Campaign really resets progress; Continue really
  loads the save; Chapter Select disables a chapter when either the save hasn't unlocked it
  **or** its `.umap` is not on disk, and says which. No button is decorative.
- **`L_GrayboxRange` + `ASPGrayboxGameMode`**: the playable range, built procedurally.

## 8. Build & verification status

| Item | Status |
|---|---|
| C++ compiles | **Not verified.** No UE toolchain in the authoring environment. All files are hand-reviewed; a header/definition/balance checker (17 pairs) was run against the tree. |
| Static source checks | **Present and clean**: `python3 ShadowProtocol/Tools/verify_source.py` — 27 headers, 24 sources, 24 pairs, 0 findings (undeclared definitions, missing includes, `.generated.h` ordering, delimiter balance, copy-paste artefacts). |
| Headless gameplay tests | **Not present in UE.** The browser slice carries 32 automated behaviour checks instead. |
| Browser slice | **Verified**: `cd web && node tools/simtest.mjs` → 41 passed, 0 failed; `npx vite build` succeeds; dev server serves all four missions. |
| Editor content (levels, UMG, meshes, sequences, audio) | **Not authored.** `Tools/build_mission_assets.py` creates the data assets and empty maps; blockout and art are outstanding work. |

What that means in plain terms: the systems exist and are written to be compiled, but the
project has never been opened in Unreal. It is not a shipped build.

---

## 9. Content pipeline

1. `Content/Data/DT_Objectives.csv` — objective rows keyed by mission id (version-controlled, diffable).
2. `Tools/build_mission_assets.py` — run in-editor; imports the table, creates `DA_ch01_crossing`, `DA_ch01_depot`, `DA_ch02_silent`, creates the three maps, and prints any missing reference instead of silently substituting.
3. Weapon assets live in `/Game/Data/Weapons/DA_<weapon_id>`; the script warns when one is absent.

---

## 10. Controls

| Action | Keyboard / Mouse | Gamepad |
|---|---|---|
| Move / Look | WASD / Mouse | L-Stick / R-Stick |
| Fire / Aim | LMB / RMB | RT / LT |
| Sprint / Crouch / Prone | Shift / Ctrl / Ctrl+Z | L3 / B / D-Pad ↓ |
| Jump | Space | A |
| Lean L/R | Q / E | LB / RB |
| Melee / Grenade | V / G | R3 / D-Pad ↑ |
| Reload / Swap | R / X | X / D-Pad ← |
| Interact | F | Y |
| Squad: Move/Hold/Breach/Recon/Revive | 1 / 2 / 3 / 4 / 5 | radial (author in BP) |
| Tactical map / Pause | M / Esc | Back / Start |
| Night vision | N | — (modern chapters only) |

Full bindings: `Config/DefaultInput.ini`.

---

## 11. Known gaps (deliberately listed)

1. Levels are empty maps — no blockout geometry, lighting, or art.
2. UMG widget Blueprints (`WBP_HUD`, `WBP_Pause`, `WBP_MainMenu`) are not authored; the C++ data model and events exist, and the menu warns in the log when its class is unset.
3. Animation Blueprints, character meshes, weapon meshes and animation sets are not authored.
4. Level Sequences for briefings/cinematics are not authored.
5. Audio assets (VO, weapons, ambience, music) are not authored; `docs/05_AUDIO_AND_VO.md` specifies them.
6. Behaviour trees are replaced by an explicit C++ state machine — deliberate, so the AI logic is testable and readable; a BT wrapper can sit on top.
7. Difficulty tier "Realism" is wired through AI/health code but has not been playtested for fairness.

---

## 12.2 Character animation (browser slice)

Enemies and squadmates are real rigged meshes playing real motion-capture clips.
This section records what was measured, because the previous implementation was
30 axis-aligned boxes with a single `Math.sin(t) * speed * 0.11` gait term.

### Assets and why these ones

| Candidate | Verdict |
|---|---|
| Quaternius **Universal Animation Library** (CC0 1.0) | **Chosen.** 53 bones, 3390 verts, 46 clips, metric scale, authored speeds match the game |
| three.js `Soldier.glb` (MIT) | Rejected as a body: sci-fi helmet, pauldrons, plate armour; one flat white material. Still used for first-person arms |
| `CesiumMan` (CC-BY 4.0) | Rejected: featureless mannequin, no garment, 19 bones |
| Mixamo-derived GitHub repositories | Rejected: Mixamo's terms forbid redistributing the raw animation files, so a repo's licence cannot travel with the asset |

Provenance and licence text live beside the files:
`web/public/models/LICENSE-quaternius-UAL.txt`.

### Measured authored ground speeds

Planted-foot travel relative to the hips, sampled over one cycle:

| clip | duration | authored speed | game speed it serves |
|---|---|---|---|
| `Walk_Formal_Loop` | 1.33 s | 1.63 m/s | walk 1.9 |
| `Jog_Fwd_Loop` | 0.92 s | 4.69 m/s | run 4.6 |
| `Sprint_Loop` | 0.67 s | 6.21 m/s | tactical sprint 6.2 |
| `Crouch_Fwd_Loop` | 2.00 s | 1.10 m/s | crouch-walk ~1.4 |

Because the clips already bracket the game's speeds, the playback correction is
small — measured `timeScale` 1.17 / 1.24 / 1.14 / 1.00 at 1.9 / 3.5 / 4.6 / 6.2 m/s.

**The direction of that correction matters and is easy to get wrong.** Playback
rate must be `characterSpeed / clipAuthoredSpeed`: moving faster than the clip was
authored for means the planted foot travels further per second, so the cycle runs
*faster*. Dividing instead of multiplying makes foot slide roughly twice as bad as
doing nothing, which is what the first attempt in this session actually did.

### Blending

Five clips crossfade by speed and stance, with weights forced to sum to 1
(`idle → walk → jog → sprint`, and `crouchIdle → crouchWalk`). Overlapping weights
are silently renormalised by `AnimationMixer`, so an accidental 1.0/1.0 blend looks
like a character moonwalking rather than throwing an error — hence the explicit
summation test.

Death runs `Death01` once with `clampWhenFinished` and holds the final pose; the
locomotion actions are zeroed first so they cannot play underneath it.

### Dressing

The library ships one untextured material. Colouring it per bone group (uniform /
trousers / boots / skin, blended per vertex so joints do not band) plus a helmet
and chest-rig primitive parented to `DEF-head` and `DEF-spine003` is what turns a
mannequin into a soldier. Both inherit the animation for free.

### Known gaps

- The face is flat-shaded with no eyes or mouth; it reads correctly at gameplay
  distance and badly in a close-up. There is no facial rig.
- No IK foot planting, so steep slopes and stairs still slide.
- Aiming is a whole-body blend, not an upper-body-layer split: the legs lose 15% of
  their weight to the aim clip while a soldier is aiming, which is invisible at
  walking speed and slightly softens a full sprint. A proper spine split (aim on
  `DEF-spine003` and above only) is the fix and is not done.
- The head does not turn to look where the weapon points; it inherits the aim clip.

---

## 12.1 First-person view model (browser slice)

The slice renders first-person arms and the weapon in a dedicated view-model scene, drawn
after the world with the depth buffer cleared. This section exists because the previous
state of this subsystem was a real defect, not a polish gap: `viewCam` was parented to
nothing and `renderViewModel()` was never called, so **no weapon and no hands were ever
drawn** in any chapter.

### Rendering path

- `Renderer.viewScene` — separate `THREE.Scene` with three lights (key/fill/rim).
- `Renderer.bindViewModel(viewCam, viewRoot)` — parents the camera and the arm root into it.
- `Renderer.render()` — after the post pass, `clearDepth()` then renders `viewScene` with
  `viewCam`. A separate scene means the arms are not eaten by the world's 0.05 m near plane
  and cannot be shaded by fog intended for 200 m of desert.
- Regression test: *"The first-person view model is actually attached to a rendered scene"*.

### Rig

`FirstPersonView` owns everything and is headless-testable (`update(dt, ctx)` touches no
renderer). Two interchangeable rigs behind one interface:

| Rig | Source | When |
|---|---|---|
| `skinned` | `web/public/models/Soldier.glb` — arm triangles filtered out of the Mixamo body, skin weights preserved and renormalised | shipped path |
| `procedural` | six rigid-skinned tapered segments | first frames, and fallback if the glTF fails |

The arm filter is **weight-based**, not position-based: a triangle is kept if at least two
of its corners are majority-weighted to an arm bone. Measured on the shipped asset:
7325 → 2377 arm vertices, 11186 → 3621 triangles, 31 bones kept, all weights summing to 1.

### Why IK rather than authored arm angles

Hand-authored Euler angles per clip (8 poses × 4 joints × 2 arms) drift off the weapon the
moment the rifle recoils, which is exactly what makes first-person arms read as floating.
Instead the *weapon* is authored and the arms are derived:

1. `ARM_POSES` gives the weapon's position/rotation per stance, in view space.
2. `GRIP_POINTS` gives the right hand (pistol grip) and left hand (handguard) in weapon space.
3. `solveTwoBone()` does an analytic two-bone solve from each shoulder to its grip, with a
   pole vector choosing the elbow plane.
4. `_aimBone()` rotates each segment onto the solved direction; `_orientHand()` rolls the
   palm onto the grip and `_curlFingers()` closes the fingers.

Both rigs are normalised to `ARM_REACH` (0.585 m shoulder-to-wrist) on construction, so the
elbow has a visible bend at rifle-grip distances on either rig. Measured: hands land within
**0.0 mm** of the grips in idle/walk/run/ADS/crouch/fire/reload, with 42° idle and 55° ADS
elbow bend on the procedural rig, 52°/66° on the skinned rig.

### Reload timeline

`RELOAD_PHASES` is the single source of truth for the reload; each phase emits one event
that `player.js` consumes:

| Phase | At | Event | Effect |
|---|---|---|---|
| `grip` | 0.00 | — | support hand leaves the handguard |
| `eject` | 0.16 | `mag-out` | `audio.magOut()`, magazine prop ejected and falls |
| `insert` | 0.42 | `mag-in` | `audio.magIn()` |
| `seat` | 0.62 | `bolt` | `audio.boltRelease()` |
| `shoulder` | 0.82 | `ready` | HUD prompt |
| `done` | 1.00 | — | back to `idle` |

Audio keys off these events rather than `setTimeout`, so the sound happens on the frame the
part actually moves. Verified order at 2.4 s: `mag-out@0.38 mag-in@1.00 bolt@1.48 ready@1.97`,
with the support hand travelling 18.5 cm.

### Asset provenance

`Soldier.glb` comes from `mrdoob/three.js` (`examples/models/gltf/`), MIT-licensed;
`web/public/models/LICENSE-three.js.txt` ships alongside it and must not be removed.

### Aiming

`pose(t, speed, crouch, aim, dead)` takes an `aim` weight in `[0,1]` and layers the
`Pistol_Aim_Neutral` clip on top of locomotion. This was previously a dead parameter:
`state.aim = aim` was written and never read, so the hand moved 1 cm between `aim=0`
and `aim=1` and enemies aimed with their arms hanging at their sides.

Two details make it work:

1. **Locomotion and aim are separate weight layers.** Locomotion weights are scaled by
   `1 - aim * 0.85` so they still sum to 1 among themselves, and the aim clip rides on
   top at `aim * 0.85`. Putting aim into the same sum robs the walk cycle of weight and
   makes the legs stutter whenever anyone aims.
2. **The weapon mount rotation is solved per aim weight, not fixed.** The hand bone's
   frame is not aligned with the character's forward axis, and the wrist genuinely
   rotates between the low-ready and aiming poses. A single constant offset cannot hold
   the muzzle level: measured muzzle error across the blend was up to 57 degrees. The
   offset is solved at aim 0 / 0.5 / 1 (X = 2.629 / 2.154 / 1.529 rad) and linearly
   interpolated in `wristOffsetForAim()`. Result: muzzle within 0 degrees of forward at
   all three sample points, worst case 13 degrees mid-run-cycle.

Measured: right hand 0.92 m at `aim=0` → 1.31 m at `aim=1` (chest is 1.28 m).

### Known gaps in this subsystem

- Third-person character gait is still the single `Math.sin(t) * speed * 0.11` term in
  `models.js`. Deferred by explicit scope decision, **not** fixed.
- Death, crouch and mantle have no character animation.
- The Unreal side has no AnimBP; this browser implementation is not a port target.

---

## 12.3 Chapter 04 — the semi-open level (browser slice)

`levels/chapter04.js` + `levels/libVienna.js`. A ~340 x 260 m slice of Vienna's canal
district: a street grid, a sunken canal with two bridges, a market hall, a metro
entrance, a tram loop, and the Hotel Adler.

**Street layout is a generated grid, not hand-placed blocks.** Rows of buildings are
split by a 26 m central avenue and 22 m cross streets. This is not cosmetic: the squad's
navigation is `steer()` (`ai.js`), a nineteen-heading local sampler with no path
planning. Given 6–8 m gaps it wedges against a building and stands still forever. The
first version of this level left such gaps and three squad members never left the spawn.

**Two separate bugs that produced the same symptom — an unreachable hotel:**

1. **Hairline colliders.** Canal railings were registered as solid 8 cm boxes. On screen
   they were a railing; as collision they were a wall across the district. Railings are
   now `solid: false` — the posts imply the barrier, and a player is meant to be able to
   step over the kerb.
2. **A room on the cross street.** The journalist's storeroom was placed at x = -26,
   straddling the western corridor and sealing the route. Moved into the block footprint.

The regression test is a **flood-fill** over a 2 m walkable grid proving the hotel is
reachable from four approaches. Comparing screenshots would not have caught either bug;
both levels rendered correctly.

**Surveillance (beat 4.2)** is real detection, not a script:
`inShot(game, cam, target)` requires the courier inside a ~57° half-angle of the camera
axis, within 26 m, with `lineOfSight` unobstructed. A frame is voided if
`anyHostileSees(game)` is true — being spotted while shooting photographs is the
designed failure state. There is a 0.6 s shutter cooldown between frames.

**Flags.** Chapter 04 writes `KONSUL_ALIVE` / `KONSUL_DEAD` plus three optional-objective
flags. These are the canonical uppercase keys in `save.js`; the ending resolver reads
them by name, so a lowercase variant is silently invisible.

### Known limitations in this chapter

- No vehicle pursuit and no rooftop route. The design calls for both; the five
  approaches that exist are street-level.
- Couriers are ordinary AI actors with a `flee` flag on being made; they do not path to
  an exit, they just run.
- No save checkpoint inside the mission yet — checkpoints are chapter-granular here.

## 12.4 Chapter 05 — timed pressure (browser slice)

`levels/chapter05.js` + `levels/libDanube.js`. A safehouse, a Danube freight yard, and a
structure that is deliberately different from 01-04: one quiet room, one ninety-second
ambush, then three objectives that cannot all be reached.

**All story timing runs on accumulated sim time, never `setTimeout`.** Chapter 05 needs
an eleven-second dialogue sequence, a ninety-second ambush and a 150-second recovery
window. Wall-clock timers were the obvious tool and the wrong one, for three reasons:

1. They keep ticking while the game is paused.
2. They ignore any time-scale change.
3. The headless harness clamps `setTimeout` to 4 ms, so the entire ambush — including
   the scripted death — ran inside a single simulated frame and the tests validated a
   sequence the player never sees.

The chapter uses a small queue drained from `world.addAnimated`, keyed on `game.time`.
Fixing this also cut a single test run from 106 s to about 7 s, because the stub's 4 ms
clamp was being hit as real latency hundreds of times.

**Lazy cast lookup.** The level builder runs *before* `ai.spawnSquad()`, so `game.ai.squad`
is still empty when `buildBetrayalMission` executes. Looking up GLASS/MOUSE/FANG eagerly
returned three `undefined`s and the scripted death silently never fired — the chapter's
central beat, gone, with no error. The cast is resolved through a `cast()` closure at the
moment each beat needs it.

**The clock has to say what it cost.** When the recovery window closes, the names of
whatever was not reached are pushed into `state.lost` and spoken in the HUD. A timed
chapter that silently drops an objective is indistinguishable from a bug.

**Reachability is tested, not assumed.** All three recovery points are proven walkable
from the yard by flood-fill before any of it is called done.

### Known limitations in this chapter

- No metro-tunnel interior: FANG is at the steps, not 200 m underground.
- No flash-forward epilogue to the Delta safehouse.
- The ambush is lethal but not adaptive — a fixed eight-attacker assault rather than a
  reaction to how the player has played the previous four chapters.

## 12.5 Chapter 06 — Facility Mizan (browser slice)

`levels/chapter06.js` + `levels/libMizan.js`. A salt flat above, four descending rings
below: Security, Records, Habitat, Core.

**The sealed-box bug.** `addRingChamber()` originally drew four solid walls. Four rings
of solid walls is four closed boxes, so the entire bunker below the entrance was
unreachable — the player could walk the ramp, reach the Security trigger, and then hit a
wall. It looked completely normal in a top-down render and from inside the corridor. The
fix is that the chamber builder takes `openings: [{ side, width }]` and cuts a doorway
with a lintel over it.

This is the third geometry bug in the project with the same shape (chapter 04's railings,
chapter 04's storeroom, chapter 06's rings): **a level that renders correctly and cannot
be walked**. All three are now caught by flood-fill tests that assert every waypoint is
in the same connected component as the spawn, and `addRingChamber`'s signature makes the
omission explicit rather than silent.

**The mantrap** is a real timing puzzle, not a door that opens on a trigger:
`chain` = outer door opens, six-second window, the player must cross the vestibule, and
the inner door only opens once the outer has shut. Failing it re-arms the cycle rather
than softlocking.

**The Curator scene** is a 22-second conversation driven by the same sim-time queue as
chapter 05, ending with Zidan's arrival and the chapter's final decision. `ZIDAN_STATE`
takes one of `exposed` / `arrested` / `dead`.

### Known limitations in this chapter

- Habitat is one room rather than the inhabited town the design calls for.
- The vent-shaft and service-tunnel entrances are landmarks, not routes.
- Archive shelving is cover but not destructible cover.

## 12.6 Chapter 07 — Meridian Tower (browser slice)

`levels/chapter07.js` + `levels/libTower.js`. Alexandria harbour at pre-dawn, then a
four-floor ascent of a 54 m tower, a confrontation on the roof and the campaign's final
decision. The chapter exists to cash three cheques the previous six wrote: the ledger,
`ZIDAN_STATE`, and the ending resolver.

**The lift.** The engine's `STEP_HEIGHT` is 0.45 m and a floor is ~13 m up, so there is no
honest stair route; the tower is climbed by a lift. That makes the ride the chapter's only
piece of level-transition machinery, and it is deliberately scripted rather than physical:
press → 0.5 s → teleport into the destination floor's lobby → 2.4 s → doors open and that
floor's garrison wakes. The player never sees the move because they are inside a sealed car.

**Three geometry bugs, one shape.** The first build placed a separate lift-lobby building
*on the quay, in front of the tower*, and derived each floor's height from its index
(`floor × 3.6`). Riding to floor 12 therefore arrived in mid-air outside the tower
footprint, and the player fell 12 m to the ground floor. The second build put the roof
inside a sealed 3.2 m parapet room, with the helipad sunk behind it; the third put ten
defenders at offsets beyond the plate's 26 m depth, so they stood in the void outside the
north wall. All three render beautifully. All three are now caught by tests:

- a per-floor flood-fill from the lift arrival (`Chapter 07 tower is a real vertical route`),
- a spawn placement audit asserting every defender has floor under them and no collision
  volume around them (`Chapter 07 defenders all stand on their own floor`),
- and a lift test that asserts arrival height within 0.6 m of `CH07_LAYOUT.floorY[n]`.

The lesson generalises to a rule: **derive vertical positions from absolute data, not from
an index, and audit every spawn against the collision world rather than against a plot.**

**Floor heights are absolute.** `CH07_LAYOUT.floorY = [0, 12.4, 27.6, 41.6, 54.6]`. The
building's silhouette above the roof is a separate `addTower(..., baseY)` call, so the
decorative tower can never intersect the interiors the player walks through.

**Sleeping garrisons.** `AIDirector.spawnEnemies()` runs once inside `startMission()`; there
is no late-spawn API. Every defender is therefore spawned up front with `hidden: true` and
revealed by `wakeFloor()` when the doors open. Floor identity lives in the enemy **id**
(`ch07_f<floor>_<n>`), because the `Enemy` constructor copies a fixed list of options and
silently drops anything else — a `floor` spawn field is `undefined` by the time it matters.

**The decision.** The ledger's three options write exactly one of `PUBLISHED_LEDGER`,
`LEVERAGED_LEDGER`, `BURNED_LEDGER`, and `resolveEnding()` reads all three. Before this
chapter, `PUBLISHED_LEDGER` had no writer at all — `CLEAN_HANDS` was unreachable — while
`LEVERAGED_LEDGER` and `BURNED_LEDGER` were read by nothing. The resolver now maps publish
→ `CLEAN_HANDS` (with `TRUST_ADEL` + `SAVED_MARIAM`), leverage → `THE_LEDGER`, burn →
`INHERITANCE`, and publish without the two alliances → `THE_LEDGER`. A test walks all four.

**Chapter select indexed missions, not chapters.** Chapter 01 registers two missions
(`ch01_crossing`, `ch01_final`) and every other chapter registers one, so registry position
and chapter number diverge after chapter 01. Unlocking and the card grid both used position:
the final chapter is mission 8 of 8 on a seven-chapter campaign, so its card needed eight
unlocked chapters and could never open. `currentChapterIndex()` / `chapterOfIndex()` now read
the registered `def.chapterIndex`, and a test walks the real registry asserting that all seven
chapter numbers are represented and the last mission is chapter 7 rather than 8.

**The ending card.** `showDebrief()` previously offered "PROCEED TO NEXT CHAPTER" or a bare
return to the menu, which for the final mission meant the campaign ended without ever
displaying the ending copy that `endingCopy()` has carried since chapter 01. The debrief now
branches on the registered definition's `chapterIndex >= 7` (the live `Mission` object does
not carry it) and renders title, tone, Arabic title and English epilogue in place of the
campaign-standing line.

### Known limitations in this chapter

- The tower is climbed only by lift. No stair route, no exterior climb, no rooftop descent.
- Each floor is a single arena room, not a full floor plate with offices and corridors.
- The atrium fight is horizontal on the balcony ring; there is no vertical flanking.
- Zidan and the Curator appear as scene speakers only — neither is a fightable actor.

## 12.7 The intelligence manifest and the coda (cross-chapter)

The collectible-document system had the same shape of bug as the ending flags, and it
took the same fix: **make the reader and the writer agree.**

`game/intel.js` is the manifest. Chapters award documents with `mission.addIntel({id})`.
Nothing enforced a relationship between the two, and they had drifted badly:

- **Nine manifest entries were never recorded by any level.** Chapters 03–07 simply had
  no code for them. Three more were recorded *after* the gate that required them.
- **Seven ids the levels did record were missing from the manifest** — `ledger_half_two`,
  `ch04_tap_log`, `curator_ledger`, `shadow_directive` and others. They appeared in the
  player's log and nowhere in the dossier.
- **Chapter 07's 1973 epilogue is gated on finding every document.** With only 12 of the
  21 manifest ids reachable, the gate was not hard, it was unsatisfiable: a player could
  collect everything that existed and the coda would never fire.
- **Four chapters promised more dots than they had documents.** `intelTotal` is
  hand-written per mission, and chapters 04, 05, 06 and 07 each declared more than they
  could award (5/4, 4/3, 6/3, 5/2). The debrief drew empty dots nobody could fill.

What the fixes establish:

1. **One manifest, two directions checked.** A test scans every `addIntel` call in every
   level file and fails if an id is recorded that the manifest does not list, and a second
   test fails if a listed document is required by the coda but awarded by nothing.
2. **The coda's requirement is derived, not declared.** `codaRequirement()` counts the
   manifest minus two categories: `epilogue` documents (awarded *by* the epilogue, so
   requiring them would be circular) and `missable` documents (behind optional objectives,
   world pickups, the forensic minigame, KONSUL's survival branch, or chapter 05's
   deliberately over-subscribed recovery window). Requiring a missable document makes the
   coda unreachable for a player who skipped one crate, and chapter 05 *guarantees* a loss.
3. **`intelTotal` ≤ available.** A test walks every registered mission and fails if it
   declares more documents than its chapter has. Four chapters were failing before.
4. **The two counters are separate.** `mission.intelFound` is what this mission yielded;
   `mission.intelCarried` is what the campaign already had. Seeding the log from the save
   without splitting them made the chapter 07 debrief read "14 / 5".
5. **The dossier reads the manifest.** It used to print `Object.keys(p.intel).join(' · ')`
   — raw ids like `doc1973_orders · nkg_roster`. It now lists every document by title,
   greyed out if unfound, marked OPTIONAL where applicable, with a running
   `n / 16 REQUIRED FOR THE 1973 CODA` counter.

**The secret ending.** `QUIET_CHOICE` had a title, no copy, and no path to it — a dangling
string in `resolveEnding()`'s title table. It is now the campaign's secret fourth ending:
burn the ledger, keep both alliances, lose nobody, find the whole archive. It is checked
*first* in the resolver, so it overrides the public three rather than being shadowed by
them, and a test removes each of its four conditions in turn to prove none of them is
decorative.

### Known limitations

- Documents are awarded by triggers, not picked up off a surface. The evidence markers in
  chapters 01 and 02 are physical; the rest are beat rewards.
- The manifest's Arabic copy is written but never rendered in the dossier, which is English
  only. The ending and intel *bodies* are bilingual.

## 12.8 The dossier reading pane and CONTINUE (menu)

**Archive reading.** Every entry in `game/intel.js` has carried Arabic title and body text
since chapter 01. Nothing in the game ever rendered it: the dossier listed documents as raw
ids, and the only bilingual surface was the subtitle line. `showIntel(id)` now opens a
recovered document as a page — the Arabic set as the body, the English underneath as the
operative's gloss, with the chapter/beat reference and whether the record is optional. The
`showArabic` setting governs it, and governs the ending copy in the dossier too; it is now
labelled "Arabic in subtitles and archive documents" rather than only subtitles.

**CONTINUE resolved to chapter 01, always.** The handler returned `firstPlayableId()` — the
first registered mission id — whenever it did not find a checkpoint, and it never found a
checkpoint because it compared `save.progress.lastChapter` (which holds a *mission id*)
against `def.chapterIndex` (a number). So CONTINUE restarted the campaign from the beginning
for every player. `continueTarget()` resolves properly:

1. if `lastChapter` is a registered mission id with a stored checkpoint → resume it;
2. otherwise map an older numeric `lastChapter` forward to its mission;
3. otherwise the earliest unlocked chapter the player has not completed;
4. otherwise — a finished campaign — the last unlocked mission, so the button re-enters the
   finale instead of doing nothing.

The label under CONTINUE is produced by the same function, so it cannot disagree with where
the button actually goes. A test walks a fresh save, a mid-campaign save, a finished
campaign and a real checkpoint through it.

## 12.9 The first-person weapon: what was actually wrong

The in-game first-person view rendered the rifle and arms as a crumpled brown mass. Three
separate defects were stacked on top of each other, and none of them were caught by the
103 automated checks — because `__SP_HEADLESS__` replaces the `WebGLRenderer` with a no-op,
so a green test run says nothing at all about pixels. All three were found by measuring
geometry, and each fix was confirmed by rendering the real scene graph.

**1. The rig was laid out in centimetres.** `Soldier.glb` is authored in cm with a
`Character` node carrying `scale 0.01`. `soldierToFirstPersonArms()` rebuilt the hierarchy
and carried over only the root bone, silently discarding that node. Measured result: an arm
mesh with a bounding box of **184.8 m**, reaching 134–160 m in front of the camera. The
`0.01` now travels with the rig, and — more importantly — the function no longer rebuilds
the skeleton at all. It keeps the asset's own `Character → Armature → bones → mesh` graph
and culls the non-arm triangles, so the mesh and its bones share one node and three.js
derives `bindMatrix` and the inverse bind matrices from the authored bind pose.

**2. Renormalised skin weights snapped the sleeve.** The original code dropped the non-arm
influences from every vertex and renormalised the rest, to make the arms a closed mesh. A
boundary vertex weighted to both the deltoid and the spine was therefore pinned fully onto
the arm bone and shot out of frame as a spike. The weights are now copied through untouched
against the real 49-bone skeleton; the triangles we do not want are simply not drawn.
The visible set is forearm, hand and fingers — drawing the upper arm as well put a
half-metre sleeve across the left half of the frame.

**3. The rifle was pressed against the lens.** This was the brown mass itself. A rifle is
~0.94 m long and its butt reaches 0.29 m behind the mount origin; the old idle mount was at
`z = -0.15`, so the butt sat **0.09 m from the eye** while the near plane is 0.02 m. A 6 cm
wide stock 9 cm away is magnified to ~1.5× the screen height. The model was never wrong —
the player was looking at the inside of their own buttstock. Every stance now holds the
weapon far enough forward that the stock is behind the near plane and gets clipped, exactly
as a real viewmodel clips the player's own shoulder.

Two supporting changes fell out of the measurements:

- The rig is no longer rescaled to a nominal reach. `ARM_REACH / _armReach()` had been
  inflating it by **1.40×**, giving half-metre forearms. Mixamo's Vanguard measures
  **0.473 m** shoulder-to-wrist, and the grips are now placed inside that reach instead.
- The support-hand grip moved from `z = -0.237` (0.71 m from the left shoulder, 3 cm beyond
  the IK's reach, elbow locked at 175° — a straight plank) to `z = +0.02` (0.468 m, elbow
  ~110°, hand exactly on the grip). The reload pose pulls in to `z = -0.28` for the same
  reason.

**How this is verified now.** `web/tools/fpview.mjs` is a CPU rasteriser for the real
viewmodel: same `Soldier.glb`, same IK, same weapon model, same 80° FOV and same 0.02 m near
plane, with near-plane clipping so triangles straddling the camera cannot smear into
ribbons. It needs no GPU, no browser and no root, and it writes a PNG. Reference frames are
committed as `docs/images/first-person-idle.png` and `docs/images/first-person-ads.png`.

Measured after the fix: arm mesh bounding box **0.77 × 0.45 × 0.65 m**, both hands **0.0 mm**
from their grips in every stance (idle, walk, run, ADS, crouch, fire, reload), trigger-arm
elbow 72–80°, support-arm elbow 97–142°.

**What is still not at the bar the design calls for, stated plainly:**

- The weapon is still assembled from box and cylinder primitives in `models.js`. It reads as
  a rifle in silhouette, not a modelled AKM. This is the largest remaining visual gap.
- The arms are the untextured Mixamo mesh. In a real browser the diffuse texture loads; in
  the CPU rasteriser the texture is a stub, so committed reference frames show them white.
- The rasteriser has no shadows, no normal maps and flat lighting, so it flatters nothing
  and hides nothing — but it is not a screenshot of the game.

## 12.10 Sourced weapon models (CC0)

The rifle in the first-person view was assembled from boxes and cylinders in
`models.js`. It reads as a rifle in silhouette but it is not one, and that was the
largest remaining visual gap. It is now a real model — with the primitives kept as the
fallback.

**Source.** `akm.glb` is the assault rifle from *Flat Guns East* by Flat Guns
(OpenGameArt), **CC0 1.0** — public domain dedication, no attribution required. Retrieved
via the [fps-asset-kit](https://github.com/petroulacl/fps-asset-kit) mirror. Provenance,
licence and source URL are recorded in `web/public/models/weapons/LICENSE.txt` next to the
file, so the licence travels with the build rather than living only in this document.

**Why CC0 and not a better-looking model.** CoD-grade AKMs exist on Sketchfab and
CGTrader, but they are CC-BY (attribution) or paid, and every one of them sits behind an
interactive download that cannot be fetched from a build sandbox. CC0 packs are the only
sourced models that can be shipped without a manual step. When a higher-quality model is
available it drops into the same slot — `SOURCED_WEAPONS` in `weapons.js` is the only
place a filename appears.

**How it is fitted.** `fitWeaponModel()` matches the model's bounding frame onto the frame
the primitives were validated in: 0.94 m overall length, receiver centred at
`(0, -0.059, -0.18)`, muzzle toward −Z. It reports residuals (`length`, `centre`) and
`loadSourcedWeapon()` **refuses to apply the model** if either exceeds 4 mm.

The first attempt at this was the textbook method — solve the model's own trigger and
magazine nodes onto our two grip points with a roll about the barrel. It failed, and the
reason is worth keeping: our grip points are only **10 cm apart**, because the support hand
sits on the magazine well (the 0.473 m arm reach cannot put it on the handguard), while a
real AKM's grips are **35 cm apart**. Solving that mismatch produces a **65° roll** — the
rifle lies on its side. Framing to the enclosing box instead keeps it upright and exactly
the size of the model it replaces.

**How it is verified.** `node tools/fpview.mjs out.raw --sourced akm` goes through the real
`loadSourcedWeapon()` path — same loader, same fit — and renders the result.
Measured: `fitError { length: 0, centre: 0 }`, fitted size **0.233 × 0.366 × 0.945 m**,
muzzle marker at `(0, -0.039, -0.630)`. Before/after in
`docs/images/akm-before-after.png`, candidate comparison in
`docs/images/weapon-candidates.png`.

**Tooling: the CPU rasteriser got two real fixes.** Both were latent bugs that only surfaced
once it rendered something other than the viewmodel.

- `Vector3.project()` was being called on points that were *already* in view space, so
  `matrixWorldInverse` was applied twice. Harmless while the only camera sat at the origin
  with an identity matrix; it put every vertex off-screen for a real camera.
- Its triangles now clip against the near plane before projecting, without which a triangle
  straddling the camera smears a ribbon across the frame.

It also decodes assets properly now: `tools/glbtexture.mjs` pulls the embedded images out of
a `.glb` and, crucially, follows the **material's baseColorTexture index** rather than taking
the first image. `Soldier.glb` carries a normal map in slot 0, so the naive choice painted the
arms purple. Textures are sampled per-pixel with the raster pass's own barycentric weights
and V flipped to match three.js. `--subject soldier` renders a full procedural character, so
body art can be reviewed without a browser.

Reference frames: `docs/images/first-person-akm-cc0.png`, `first-person-akm-ads.png`,
`soldier-1973.png`, and both side by side in `weapon-and-body.png`.

**Still primitive, stated plainly:** the other twelve weapons (Port Said, RPD, RPG-7, M4,
MP5SD, pistol, sniper, and the enemy variants) still use box geometry. The remaining CC0
packs — Quaternius *Ultimate Guns Pack* (40 models) and *Flat Guns West* (10) — are already
identified and retrievable, so the same treatment extends to them. The sourced model also
carries no textures: the pack is flat-colour by design, restyled at load into gunmetal.

## 12. Parity matrix — browser slice ↔ Unreal C++

The browser slice (`web/`) and the Unreal project are two implementations of one design.
The slice is the one that runs today and is verified by automated tests; the C++ classes are
the ones that ship. Keeping this table honest is how drift gets caught.

| Browser system (`web/src/...`) | Unreal counterpart | Notes |
|---|---|---|
| `game/player.js` — movement, stamina, slide, lean | `USPCharacterMovementComponent`, `ASPCharacter` | UE adds mantle, tactical sprint, capsule transitions |
| `game/weapons.js` — loadout, recoil, reload, era gate | `USPWeaponData`, `USPWeaponComponent` | Same era-gate rule; UE adds hit zones and suppression volume |
| `game/ai.js` — perception, states, squad steering, `steer()` nav sampler | `ASPAIController`, `ASPSquadMember` | UE uses navmesh + `UPawnMovementComponent`; the slice's `steer()` has no UE analogue because the engine provides one |
| `game/mission.js` — objectives, hooks, checkpoints | `ASPMissionManager`, `USPMissionData` | UE moves objective definitions into data assets |
| `game/forensics.js` — UV ink analysis minigame (domain logic, headlessly tested) | none yet | UE: implement as a UMG widget over the same rule set; no C++ counterpart written |
| `levels/chapter04.js` + `libVienna.js` — semi-open Vienna streets, view-cone surveillance | none yet | UE: authored `L_Chapter04_Vienna`, navmesh instead of `steer()`, and the courier photography as a tagged-camera volume check |
| `levels/chapter05.js` + `libDanube.js` — safehouse, timed recoveries, scripted squad death | none yet | UE: `ASPTimedObjectiveActor` over `game.time` equivalents; the sim-time queue is the pattern to port, not `SetTimer` with wall-clock semantics |
| `levels/chapter06.js` + `libMizan.js` — descending bunker rings, mantrap timing, tripwires | none yet | UE: authored `L_Chapter06_Mizan`; the mantrap becomes a state machine on an actor, and tripwires become trigger volumes with a crouch-height check |
| `levels/chapter07.js` + `libTower.js` — harbour, lift ascent, sleeping per-floor garrisons | none yet | UE: authored `L_Chapter07_Meridian` with real `SetActorLocation` lift movement between world-partition cells, and each garrison spawned on a streaming trigger rather than hidden up front |
| `ui/hud.js showChoice()` — branching decision card | `ASPGameMode::PushSubtitle` + UMG dialog | UE: author the dialog as a widget; the flag plumbing (`USPProgressSubsystem::SetFlag`) already exists |
| `game/game.js` — spawn wiring, difficulty scaling | `ASPGameMode`, `ASPGrayboxGameMode` | Same responsibilities, plus save/load |
| `game/intel.js` — 39 bilingual documents, 16 of them coda-required | `FSPIntelEntry` + `ASPIntelPickup` | Content parity: one manifest, every id a level records exists in it |
| `game/save.js` — checkpoint + campaign state | `USPSaveGame`, `USPProgressSubsystem` | UE persists to slot files + config |
| `ui/menu.js`, `ui/hud.js` | `USPHUDWidget`, `USPPauseMenuWidget` | UE HUD data model is C++; layout is UMG |
| `engine/physics.js` — collider push-out | engine `UCharacterMovementComponent` collision | Not reimplemented |
| `game/character.js` — CC0 rigged library, blended locomotion, kit dressing | `USPAnimInstance` + skeletal mesh assets | Clips are CC0; the Unreal side would use AnimBPs over the same clips |
| `game/viewmodel.js` — inverted-pendulum-free two-bone IK arms, weapon pose tracks, reload timeline | `USPAnimInstance` + AnimMontage (not authored) | The slice solves arms analytically; UE would use AnimBPs, so this is **not** a port target — see §12.1 |
| `levels/chapter03.js` + `libCairo.js` — Cairo hub | objective rows in `Content/Data/DT_Objectives.csv`; mission spec in `Tools/build_mission_assets.py`; **no UE level yet** | Content parity for the design, not for the build |
| `tools/simtest.mjs` — 60 checks (4 missions + view model + characters) | none yet | **Gap**: no automation framework in the UE tree beyond the header checker |

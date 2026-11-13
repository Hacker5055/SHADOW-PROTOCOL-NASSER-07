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
- intel (`FSPIntelEntry[]`, 21 documents campaign-wide)
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
| `ui/hud.js showChoice()` — branching decision card | `ASPGameMode::PushSubtitle` + UMG dialog | UE: author the dialog as a widget; the flag plumbing (`USPProgressSubsystem::SetFlag`) already exists |
| `game/game.js` — spawn wiring, difficulty scaling | `ASPGameMode`, `ASPGrayboxGameMode` | Same responsibilities, plus save/load |
| `game/intel.js` — 21 bilingual documents | `FSPIntelEntry` + `ASPIntelPickup` | Content parity: 21 documents campaign-wide |
| `game/save.js` — checkpoint + campaign state | `USPSaveGame`, `USPProgressSubsystem` | UE persists to slot files + config |
| `ui/menu.js`, `ui/hud.js` | `USPHUDWidget`, `USPPauseMenuWidget` | UE HUD data model is C++; layout is UMG |
| `engine/physics.js` — collider push-out | engine `UCharacterMovementComponent` collision | Not reimplemented |
| `game/character.js` — CC0 rigged library, blended locomotion, kit dressing | `USPAnimInstance` + skeletal mesh assets | Clips are CC0; the Unreal side would use AnimBPs over the same clips |
| `game/viewmodel.js` — inverted-pendulum-free two-bone IK arms, weapon pose tracks, reload timeline | `USPAnimInstance` + AnimMontage (not authored) | The slice solves arms analytically; UE would use AnimBPs, so this is **not** a port target — see §12.1 |
| `levels/chapter03.js` + `libCairo.js` — Cairo hub | objective rows in `Content/Data/DT_Objectives.csv`; mission spec in `Tools/build_mission_assets.py`; **no UE level yet** | Content parity for the design, not for the build |
| `tools/simtest.mjs` — 60 checks (4 missions + view model + characters) | none yet | **Gap**: no automation framework in the UE tree beyond the header checker |

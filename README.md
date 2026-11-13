# SHADOW PROTOCOL: NASSER 07

**A cinematic military FPS spanning two generations of Egyptian soldiers.**
Unreal Engine 5 · PC · Seven-chapter single-player campaign.

> **Original work.** All characters, units, operations, documents and dialogue in this
> project are fictional. The October 1973 War is portrayed with respect for the historical
> record; the classified events of "Operation Amun" and "Shadow Protocol" are invented
> for this story and are **not** presented as real history.

---

## What is in this repository

| Path | What it is | Status |
|---|---|---|
| `ShadowProtocol/` | The real **Unreal Engine 5.4+ C++ project** — movement, weapons, AI, squad, mission & save framework, procedural graybox range, config `.ini` set | Source written; **never compiled here** (no UE toolchain in the authoring environment) |
| `web/` | **Playable vertical slice** (Three.js/WebGL) — Chapters 01 *The Crossing* (1973), 02 *The Silent Mission* and 03 *The Black File* (Cairo hub + rooftop ambush), menus, HUD, squad AI, enemy AI, branch dialogue, checkpoints | **Playable now** in any modern browser · 53 automated checks passing |
| `docs/` | Story bible, seven-chapter design, technical architecture, roadmap, audio/VO direction, historical reference | Complete for the campaign design |
| `ShadowProtocol/Tools/` | `build_mission_assets.py` (editor asset generation) and `verify_source.py` (static source checks) | `verify_source.py` runs here and reports CLEAN; the editor script runs inside UE |

The two implementations share one design. `docs/03_TECHNICAL_ARCHITECTURE.md` contains the
**parity matrix** that maps every browser gameplay system to its Unreal C++ class.

---

## Play the vertical slice

```bash
cd web
npm install
npm run dev        # http://localhost:5173  (bind 0.0.0.0 in the sandbox)
```

Production build:

```bash
cd web && npm run build && npm run preview
```

**Controls**

| Action | Keyboard / Mouse | Gamepad |
|---|---|---|
| Move / look | WASD / Mouse | Left stick / Right stick |
| Sprint (hold) | Shift | L3 |
| Tactical sprint | Shift+W double-tap | L3 (tap twice) |
| Crouch | Ctrl / C | B |
| Prone | Z | D-pad down |
| Slide | Ctrl while sprinting | B while sprinting |
| Lean left / right | Q / E | LB / RB |
| Jump | Space | A |
| Fire | LMB | RT |
| Aim (ADS) | RMB | LT |
| Reload | R | X |
| Swap weapon | 1 / 2 | D-pad left |
| Grenade | G | D-pad up |
| Melee / takedown | V | R3 |
| Squad order: move / hold / breach | F1 / F2 / F3 or middle-click | D-pad |
| Night vision (modern) | N | Y |
| Objectives / map | Tab | Back |
| Pause | Esc | Start |

**Arabic dialogue** is subtitled in both Arabic and English; toggle in Settings.

---

## Build the Unreal project

> **Read this first.** The C++ in `ShadowProtocol/` has **not been compiled**. It was written
> without access to an Unreal install, and reviewed by hand plus a header/definition/balance
> checker. Expect to fix compile errors on first build. Nothing below claims otherwise.

1. Install **Unreal Engine 5.4 or newer** (Epic Games Launcher) and Visual Studio 2022 with
   the *Game development with C++* workload.
2. Right-click `ShadowProtocol/ShadowProtocol.uproject` → **Generate Visual Studio project files**.
3. Build `ShadowProtocolEditor` (Development Editor, Win64) and open the project.
4. Create an **empty level** (File → New Level → Empty Level) and press **Play** — the project's
   default game mode builds the range itself. Or run `ShadowProtocol/Tools/build_mission_assets.py`
   in the editor, which creates `L_GrayboxRange`, `L_MainMenu` and the mission data assets.
5. `SPGrayboxGameMode` (the project default) then builds the **SPGrayboxRange** test mission in
   code: procedural 1973 crossing geometry (canal, sand berm with a breached lane, trench
   network, three strongpoints, Qantara depot yard), two squad members, hostiles per
   strongpoint, five objectives, two intelligence documents, checkpoints, and the HUD.

What that range is: a **playable test range** built from engine primitives. It proves the
systems work together. It is *not* shipping art — apart from one downloaded, MIT-licensed
soldier mesh used for the first-person arms, there are no authored meshes, materials, audio
or cinematics in the project yet (see `docs/03_TECHNICAL_ARCHITECTURE.md` §11).

First-person animation is real and measured, not implied: the arms are IK-solved onto the
rifle every frame, so the hands stay within 0 mm of the grips across idle/walk/run/ADS/
crouch/fire/reload, and the reload is a phased timeline that emits `mag-out → mag-in → bolt →
ready` (see `docs/03_TECHNICAL_ARCHITECTURE.md` §12.1).

The front end (`USPMenuSubsystem`, `ASPMainMenuController`, `USPMenuWidget`) implements New Campaign,
Continue, Chapter Selection, Settings, Credits and Exit as real actions. Chapter buttons are
enabled only when the save has unlocked the chapter **and** its level exists on disk; otherwise
the menu says so instead of silently failing. The menus need their UMG Blueprints
(`WBP_MainMenu`) authored before they draw — until then the controller logs a warning.

Project config in `ShadowProtocol/Config/` sets Lumen, Nanite, virtual shadow maps,
volumetric fog, DX12/SM6, the input bindings (K/M + gamepad), collision profiles and the
user-settings defaults. See `docs/03_TECHNICAL_ARCHITECTURE.md` §5.

---

## Campaign at a glance

| # | Chapter | Era | Protagonist | Location |
|---|---|---|---|---|
| 01 | The Crossing | Oct 1973 | Col. Taher Abdel-Hakim | Suez Canal, Bar Lev Line |
| 02 | The Silent Mission | Present | Nasser 07 | Port Komdok, North Korea |
| 03 | The Black File | Present | Nasser 07 | Cairo — Directorate 7 archive |
| 04 | City of Shadows | Present | Nasser 07 | Vienna — Canal District |
| 05 | Betrayal | Present | Nasser 07 | Vienna → Delta safehouse |
| 06 | Shadow Protocol | Present | Nasser 07 | Facility Mizan, Western Desert |
| 07 | The Final Legacy | Present | Nasser 07 | Alexandria — Meridian Tower |

Three endings (`CLEAN HANDS`, `THE LEDGER`, `INHERITANCE`) are decided by four tracked
campaign flags, plus a secret epilogue. See `docs/02_CHAPTERS.md`.

Chapters 01–03 are playable in the browser slice. Chapter 03 is the hub chapter: a
Cairo intelligence directorate you walk through, read, and then have to fight your way
out of the top floor — with one branching decision that persists into the finale.

---

## Development milestones

`docs/04_ROADMAP.md` tracks the ten milestones from the brief against what is actually
implemented. Nothing is marked complete unless it is playable or compilable.

- **M1 — vertical slice:** done and verified (`web/`, 53 automated checks passing across
  Chapters 01–03, plus measured first-person animation).
- **M2 — UE5 project skeleton:** done at source level; **not compiled**.
- **M3 — Chapter 01 blockout:** next; the procedural graybox range is the starting point.

## What is explicitly *not* built

Listed so nobody has to discover it the hard way:

1. No compiled Unreal build — the C++ has never seen a compiler.
2. No authored levels, meshes, materials or UMG widget Blueprints. The only shipped mesh is
   `web/public/models/Soldier.glb` (MIT, from three.js) driving the first-person arms.
   **Third-person character animation is not done** — the character gait is still a single
   sine term, death is a single rotation snap, and crouch/mantle have no character animation.
3. No audio assets: VO, weapons, ambience and music are specified in
   `docs/05_AUDIO_AND_VO.md` but not produced.
4. No cinematics or Level Sequences.
5. Chapters 04–07 exist as design (docs + data schema), not as playable content.
6. Chapter 03's interview dialogue wheel and faction suspicion meter are design only. The hub,
   the branching decision, the forensics minigame and the rooftop ambush are all real.

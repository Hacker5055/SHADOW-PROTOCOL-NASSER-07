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
| `web/` | **Playable vertical slice** (Three.js/WebGL) — Chapter 01 *The Crossing* (1973) and Chapter 02 *The Silent Mission* (modern), menus, HUD, squad AI, enemy AI, checkpoints | **Playable now** in any modern browser |
| `docs/` | Story bible, seven-chapter design, technical architecture, roadmap, audio/VO direction, historical reference | Complete for the campaign design |
| `ShadowProtocol/Tools/` | Editor Python that builds mission data assets + maps from `Content/Data` | Written; run inside UE |

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
4. Create an **empty level** (File → New Level → Empty Level), add one **SPGrayboxLevel** actor,
   and press **Play** — or run `ShadowProtocol/Tools/build_mission_assets.py` in the editor,
   which creates `L_GrayboxRange` for you.
5. `SPGrayboxGameMode` (the project default) then builds the **SPGrayboxRange** test mission in
   code: procedural 1973 crossing geometry (canal, sand berm with a breached lane, trench
   network, three strongpoints, Qantara depot yard), two squad members, hostiles per
   strongpoint, five objectives, two intelligence documents, checkpoints, and the HUD.

What that range is: a **playable test range** built from engine primitives. It proves the
systems work together. It is *not* shipping art — there are no meshes, materials, animations,
audio or cinematics in the project yet (see `docs/03_TECHNICAL_ARCHITECTURE.md` §11).

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
campaign flags. See `docs/02_CHAPTERS.md`.

---

## Development milestones

`docs/04_ROADMAP.md` tracks the ten milestones from the brief against what is actually
implemented. Nothing is marked complete unless it is playable or compilable.

- **M1 — vertical slice:** done and verified (`web/`, 32 automated checks passing).
- **M2 — UE5 project skeleton:** done at source level; **not compiled**.
- **M3 — Chapter 01 blockout:** next; the procedural graybox range is the starting point.

## What is explicitly *not* built

Listed so nobody has to discover it the hard way:

1. No compiled Unreal build — the C++ has never seen a compiler.
2. No authored levels, meshes, materials, animations or UMG widget Blueprints.
3. No audio assets: VO, weapons, ambience and music are specified in
   `docs/05_AUDIO_AND_VO.md` but not produced.
4. No cinematics or Level Sequences.
5. Chapters 03–07 exist as design (docs + data schema), not as playable content.

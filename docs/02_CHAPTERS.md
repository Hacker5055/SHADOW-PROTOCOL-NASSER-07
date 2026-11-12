# SHADOW PROTOCOL: NASSER 07 — Chapter Design

Seven chapters, ~9–11 hours of campaign. Each entry lists: playable space type,
mission flow, objectives, new systems introduced, collectibles, and checkpoints.

Legend — **[C]** cinematic/linear, **[S]** semi-open tactical, **[H]** hybrid.

---

## CHAPTER 01 — THE CROSSING
**Era:** 6–9 October 1973 · **POV:** Col. Taher Abdel-Hakim · **Type:** [H] · ~85 min
**Location:** West bank staging areas → Suez Canal crossing → Bar Lev strongpoint 4 →
Qantara road depot.

### Missions
| # | Mission | Type | Beat |
|---|---|---|---|
| 1.1 | **DUST AND RADIO** | [C] | Pre-dawn staging. Taher inspects the detachment; the player learns movement, squad orders, radio. A staff officer (young **Ashraf Zidan**) hands him sealed orders with a line blacked out. |
| 1.2 | **H-HOUR** | [H] | 14:00 artillery barrage. The player advances through the breach in the sand berm, uses rubber boats and ladders, clears bunkers. First real firefight. |
| 1.3 | **THE BRIDGEHEAD** | [S] | Semi-open: 180 m of captured trench network with three strongpoints. Player chooses which strongpoint to take first; each grants a different support (mortars / ammo / medics). |
| 1.4 | **THE MEN IN THE WIRE** | [C] | Rescue of a cut-off platoon in a minefield. Scripted but player-driven; the platoon's survival depends on the player clearing wire under fire. First moral micro-choice. |
| 1.5 | **AMUN** | [C] | Classified night mission to the Qantara road depot. No ammunition — only a ledger and 14 bodies. Taher tears out the page, hides it in his helmet. Roll credits-as-newsreel. |

**Systems introduced:** movement (walk/sprint/crouch/prone/slide/lean), period weapons
(AKM, Port Said SMG, RPG-7, grenades), squad orders, suppression, checkpointing,
first-person cinematics, historical HUD skin.

**Collectibles:** 6 field documents (Egyptian 1973 paperwork), 1 "ledger page" (narrative).

**Historical notes:** all equipment from the 1973 Egyptian order of battle; the raid on the
depot is fictional and framed as such in the debrief.

---

## CHAPTER 02 — THE SILENT MISSION
**Era:** Present, Day 1 · **POV:** Nasser 07 · **Type:** [S] · ~80 min
**Location:** GID headquarters, Cairo → Port Komdok naval facility, North Korea (night).

### Missions
| # | Mission | Type | Beat |
|---|---|---|---|
| 2.1 | **DIRECTORATE 7** | [C] | Walk-and-talk through the operations floor. Introduces the team by voice and body language before any gun is drawn. Briefing: 6 Egyptian engineers held at a "weather station". |
| 2.2 | **COLD APPROACH** | [S] | Insertion by RHIB. Three routes into the port: the sea wall (stealth), the drainage channel (stealth+CQB), the front gate (loud). Night vision available. |
| 2.3 | **THE ADMIN BLOCK** | [H] | Locate the holding cells. Optional objective: recover the server rack (unlocks Ch. 03 shortcut). |
| 2.4 | **ROOFTOP EXTRACTION** | [C] | Defense of the roof against a QRF while the helicopter lands. Squad commands matter. |
| 2.5 | **THE WRONG FILE** | [C] | Nasser opens the recovered scan: **ARCHIVE BOX 07 — OPERATION AMUN**, dated 1973, with his grandfather's service number in the margin. |

**Systems introduced:** modern movement (tactical sprint, mantling), weapon customization
at the ops table, night vision, takedowns, squad orders v2 (breach/flank/recon),
optional objectives.

**Collectibles:** 5 intelligence items, 1 "Box 07 scan".

---

## CHAPTER 03 — THE BLACK FILE
**Era:** Present, Day 3 · **POV:** Nasser 07 · **Type:** [C] (hub) · ~55 min
**Location:** GID Directorate 7, Cairo — operations floor, courtyard, archive wing, rooftop.

A **playable hub**: no combat until the last five minutes. Guards hold fire by design; the
chapter is about reading a building.

| # | Beat | What the player does |
|---|---|---|
| 3.1 | **OPERATIONS FLOOR** | Reports to Zidan. Walk-and-talk; the briefing is delivered as dialogue, not a cutscene. Introduces the Box 07 scan and Zidan's refusal to let it leave the building. |
| 3.2 | **THE COURTYARD** | Crosses the compound: colonnade, dry fountain, dead palm, street noise beyond the wall. Pure atmosphere and orientation. |
| 3.3 | **THE ARCHIVIST** | Asks for the AMETHYST clearance file. The archivist opens the stacks — a shutter physically rises. |
| 3.4 | **THE STACKS** *(optional)* | Searches the archive floor and mezzanine for the ledger's second half. The campaign's intelligence documents can be read here. |
| 3.4b | **THE LAMP** *(optional)* | The forensics bench: a UV pass over the reclassification record. Seven fields, three overwritten; flag the wrong ink and the read is compromised, so it can be retried. Proving the edit yields a new intelligence document. |
| 3.5 | **THE DECISION** | Chooses what to do with the scan: **give it to Adel** (`TRUST_ADEL`) or **keep it** (`WITHHELD_SCAN`). Real branching — the card freezes the world and the flag persists into Chapter 07. |
| 3.6 | **ROOFTOP AMBUSH** | The only combat. Eight ambushers plus two marksmen wake on the roof; the Directorate guards drop their hold-fire and turn hostile. |

**Systems exercised:** hub navigation, scripted trigger beats, document collection, branching
dialogue choice with persistent flags, dormant/hold-fire AI states, rooftop defence.

**Implemented:** `web/src/levels/chapter03.js` (+ `libCairo.js` prop kit), the forensics minigame
in `web/src/game/forensics.js` with its own panel in `web/src/ui/hud.js`, Unreal objective rows
in `ShadowProtocol/Content/Data/DT_Objectives.csv`, mission asset spec in
`ShadowProtocol/Tools/build_mission_assets.py`. Covered by 6 automated checks in
`web/tools/simtest.mjs`.

**Still to author:** the 300+ individually modelled file spines (shelf systems with the document
reader stand in), the dialogue-wheel interview angles that unlock different documents, and the
faction suspicion meter. Those are design commitments, not shipped features.

---

## CHAPTER 04 — CITY OF SHADOWS
**Era:** Present, Day 6 · **POV:** Nasser 07 · **Type:** [S] · ~75 min
**Location:** Vienna — Canal District (fictionalized composite of the 1st–4th districts).

The campaign's flagship semi-open mission. ~340 m × 260 m of streets, rooftops, a canal
embankment, a market hall, a metro station and a hotel.
- **Five infiltration routes** into the hotel where KONSUL is meeting a buyer.
- **Surveillance sequence:** photograph three couriers without being made (real detection AI,
  not scripted). Photographs feed the investigation board.
- **Optional:** disable CCTV (reduces enemy alertness globally), free a detained journalist
  (unlocks a document), tap a phone line (unlocks KONSUL's escape route).
- **Vehicle pursuit** on the Ringstrasse — a real drivable sequence with the team's
  up-armored SUV, ramming, and a scripted tram crossing.
- **Ending fork:** kill KONSUL or take him alive (`KONSUL_ALIVE`). Alive yields a Ch. 06
  shortcut and better ending eligibility.

---

## CHAPTER 05 — BETRAYAL
**Era:** Present, Day 7 · **POV:** Nasser 07 · **Type:** [H] · ~70 min
**Location:** Vienna safehouse → Danube freight yard → Delta safehouse (flash-forward).

- Safehouse scene: the team decompresses. Real downtime dialogue — jokes, tea, a phone call
  home. The game has earned this quiet.
- **The ambush:** 90 seconds of non-scripted survival with the squad AI taking real damage.
  GLASS dies. The team scatters.
- **Three parallel recoveries** the player can attempt in any order: recover the intel from the
  freight yard, find FANG in the metro tunnels, reach MOUSE before the network does.
  You cannot save everyone in time — this is the point.
- **Trust decision:** MOUSE's link to the leak. Choices: *arrest him*, *trust him*, *let him go*.
  `TRUST_ADEL` gates the CLEAN HANDS ending and Adel's survival.
- Ends with Nasser reading Rami's last transmission and a flash of 1973.

**Systems introduced:** squad permadeath state, trust/relationship tracker, timed
multi-objective pressure, dynamic music.

---

## CHAPTER 06 — SHADOW PROTOCOL
**Era:** Present, Day 9 · **POV:** Nasser 07 · **Type:** [H] · ~80 min
**Location:** Facility Mizan — a decommissioned 1960s Soviet-supplied bunker complex under the
Western Desert, 60 m below a salt flat.

- **Exterior:** sandstorm approach, three entrances (vent shaft, service tunnel, main ramp).
- **Interior:** four rings — Security, Records, Habitat, Core. Advanced security: laser tripwires,
  motion sensors, rotating cameras, pressure plates, a mantrap with a real timing puzzle.
- **Combat:** the campaign's heaviest firefight in the Records ring (stacked shelving as
  destructible cover).
- **The Curator:** revealed as **Nabil Sharawi**, Taher's radio operator, 91 years old, kept
  alive by the network he built. Long, quiet, devastating conversation. The player learns
  Shadow Protocol was never about weapons — it was about *the right to write the record*.
- **Confrontation:** Zidan arrives. The player chooses to expose, kill, or arrest. `SPARED_CURATOR`
  and `ZIDAN_STATE` follow.
- **The reveal that lands:** the 1973 page in the helmet is a *duplicate*; the original is here,
  and it names Taher as a co-conspirator — because he took the bribe to fund the rescue of the
  platoon in 1.4 and never told anyone.

---

## CHAPTER 07 — THE FINAL LEGACY
**Era:** Present, Day 11 · **POV:** Nasser 07 · **Type:** [H] · ~75 min
**Location:** Alexandria — Meridian Tower (58 floors), the harbor, and a dawn epilogue at
Taher's grave in Mansoura.

- **Approach:** harbor infiltration with the surviving team (composition varies by Ch. 05).
- **Ascent:** floors 12 / 27 / 41 / 54 — each a distinct combat arena: server floor, atrium
  vertical fight, executive level, helipad.
- **Final confrontation** with Zidan (or with the Curator's successor if Zidan died in Ch. 06).
- **Critical decision:** what to do with the ledger — **publish**, **leverage**, or **burn**.
- **Epilogue** per ending, plus a 1973 coda if all 21 documents were found.
- **Sequel hook:** a second box number — **07-B** — appears in a file Nasser did not open.

---

## Cross-chapter systems

| System | Introduced | Notes |
|---|---|---|
| Checkpoints & manual save | 1.2 | Save anywhere off-combat; 3 autosave slots, 3 manual |
| Chapter select + NG+ | after Ch. 01 | NG+ carries documents & unlocks |
| Difficulty | start | Recruit / Soldier / Veteran / Realism (no HUD, one-shot lethality) |
| Localization | start | EN / AR (MSA + Egyptian colloquial) / FR / DE / RU |
| Photo mode | Ch. 02 | pause-time, free camera, filters |
| Accessibility | start | subtitle size/background, colorblind reticles, hold→toggle for all inputs, aim assist |

---

## Pacing chart

```
Tension
  ^
  |        C1                    C2          C3        C4            C5        C6         C7
  |      /‾‾‾\                /‾‾‾\       /‾‾\      /‾‾‾‾\        /‾\   /‾‾\  /‾‾‾\    /‾‾‾\
  |     /     \_____         /     \____ /    \____/     \______/   \_/    \/     \__/     \__
  |  __/             \______/                                          (quiet)          (quiet)
  +-----------------------------------------------------------------------------------------> time
        crossing      depot   port      archive   vienna    ambush   bunker   tower  epilogue
```

Quiet chapters (03) are deliberately placed after the two loudest openings.

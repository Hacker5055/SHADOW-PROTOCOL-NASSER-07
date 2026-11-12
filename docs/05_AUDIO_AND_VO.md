# SHADOW PROTOCOL: NASSER 07 — Audio & Voice Direction

**Principle:** the two eras must be audible before they are visible. A player should be able
to close their eyes, hear ten seconds, and know whether it is 1973 or today.

---

## 1. Era signature

| | 1973 | Modern |
|---|---|---|
| Bandwidth | Tape-limited, rolled-off above 9 kHz, mono-leaning | Full range, stereo, wide field |
| Noise floor | Generator hum, distant artillery, flies, wind over sand | Rain, HVAC, distant traffic, server fans |
| Radio | Analogue crackle, squelch tails, heterodyne whistle | Digital codec, clipped consonants, packet stutter |
| Weapons | Heavy mechanical clatter, long reverb tails in open desert | Tighter transient, suppressed subsonic thump, urban slap-back |
| Music | Oud, ney, frame drum; sparse, diegetic-leaning | Prepared piano, low strings, granular synth textures |

Audio mix must never let music mask the radio channel: dialogue bus ducks music −6 dB
while the radio is open.

---

## 2. Weapon audio (chapter 01 period kit)

| Weapon | Character | Notes |
|---|---|---|
| AKM | Dull, heavy, chest-thumping | Mechanical charging handle; brass on sand |
| Port Said (9 mm) | Sharper crack, faster cycle | Distinct magazine slap |
| RPD | Deep rhythmic thud | Belt rattle on movement |
| RPG-7 | Ignition whoosh then flat boom | Backblast must be audible and dangerous |
| SVD | Long, flat crack | Reverb tail sells the distance |

Modern kit (Chapter 02+): M4 (crisp, high transient), MP5SD (suppressed thump + bolt),
pistol (dry snap). All modern weapons carry a suppressed/un-suppressed variant.

---

## 3. Voice cast

| Character | Language | Direction |
|---|---|---|
| Col. Taher Abdel-Hakim | Egyptian Arabic (primary), English (radio to advisors) | Quiet authority; speaks in short orders, never shouts. Ages across the campaign via archival recordings for the modern chapters. |
| Nasser 07 | Egyptian Arabic, English | Inherits his grandfather's cadence; clipped and dry. |
| Lt. Karim "FANG" El-Sayed | Egyptian Arabic | The warmth in the squad; jokes when nervous. |
| Sgt. Hoda "JACKAL" Mansour | Egyptian Arabic | Flat, precise, professional. No banter during contact. |
| Sgt. Adel "MOUSE" Farhan | Egyptian Arabic | Younger, faster, audibly anxious — the character the player is asked to trust or not. |
| Lt. Rami "GLASS" Fahmy | Egyptian Arabic | Cold, procedural. Sister Mariam is the only crack in the voice. |
| Gen. Ashraf Zidan | Egyptian Arabic (formal) | The same man at 30 and at 80: same rhythm, different weight. |
| The Curator | Arabic + accented English | Never raises volume. Sounds like an archivist, not a villain. |

**Direction rules**
- Natural Egyptian colloquial, not Modern Standard Arabic, except Zidan in formal settings.
- Radio lines are recorded twice: clean (for cinematics) and processed (for comms).
- No character explains the plot to themselves. Information comes from other people.

---

## 4. Dialogue & subtitle pipeline

1. Lines live in mission data (`FSPDialogueBeat` → `FSPDialogueLine` with English, Arabic, `USoundBase`, `bRadioFiltered`).
2. Subtitle delivery: `ASPGameMode::PushSubtitle` → `ASPPlayerController` → `USPHUDWidget`.
3. Language toggle (`USPGameUserSettings::bArabicSubtitles`) switches subtitle text only; VO language is a separate setting.
4. Subtitle rules: max two lines on screen, speaker in caps, radio prefix `[RADIO]`, minimum 1.8 s per line.
5. Every line ships with a text key for localisation. No hard-coded strings in widgets.

---

## 5. Chapter 01 sound script (representative)

| Beat | Layer |
|---|---|
| 1.1 Dust and Radio (pre-dawn) | Generator hum, dogs, boots on gravel; a single oud motif when Zidan hands over the sealed orders |
| 1.2 H-Hour | Artillery walking barrage from right to left, then silence, then the berm opening; water, oars, breathing |
| 1.3 The Bridgehead | Trench interior: muffled exterior combat, dripping, spent brass; each strongpoint has its own reverberant character |
| 1.4 The Men in the Wire | Wind, wire tension, a man crying quietly; music drops out entirely until the platoon is clear |
| 1.5 AMUN (night) | Total quiet except footsteps, a generator, and fourteen bodies; the ledger's page tear is the loudest sound in the chapter |

That last beat is the thesis of the chapter: **the horror is quiet**.

---

## 6. Dynamic music

Three states per chapter, crossfaded on tension score (0–100) driven by AI awareness and squad state:

- **Calm** — sparse, diegetic-leaning
- **Tension** — pulse, low strings, no melody
- **Assault** — full percussion, brass stabs; drops to silence for scripted deaths

Rules: music never starts while a subtitle is on screen; music never re-enters on a fixed
timer after combat — it waits for the player to move.

---

## 7. Technical

- Middleware: MetaSounds + Quartz for tempo-locked cues; submix hierarchy Master → Music / SFX / Dialogue / Radio.
- Spatialisation: attenuation on all world sounds; radio and briefing are 2D by design.
- Audio occlusion on by default for interiors; the trench network depends on it.
- Ambience beds per mission (`USPMissionData::AmbienceBed`).
- Budget: 48 kHz, ≤ 32 concurrent voices in combat, ≤ 64 in the Chapter 02 rooftop defence.

---

## 8. Assets not yet produced

Every sound and voice asset listed here is **specified but not recorded**. The browser slice
uses procedural synthesis for weapon and impact audio as a placeholder for *feel*, not as
final content. Do not represent the slice's audio as the shipping soundtrack.

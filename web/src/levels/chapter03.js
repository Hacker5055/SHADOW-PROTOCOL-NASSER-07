/**
 * SHADOW PROTOCOL — CHAPTER 03: THE BLACK FILE
 * Present day · GID Directorate 7, Cairo · Nasser 07
 *
 * A playable hub, per the design: no combat for the first two thirds. The player
 * walks the archive floor, plans the Vienna operation, reads documents, and makes
 * the chapter's central decision — to trust Adel with the Box 07 scan or not.
 *
 * 3.1 DIRECTORATE 7  — arrival, walk-and-talk, the archive floor
 * 3.2 THE BLACK FILE — find the ledger's other half (intel-driven)
 * 3.3 THE DELEGATION — Vienna briefing, squad loadout decisions
 * 3.4 ROOFTOP AMBUSH — fifteen minutes of violence at the very end
 */
import * as THREE from 'three';
import { ENEMY_STATE } from '../game/ai.js';
import { buildForensicCase, beginCase, summarise, retryCase, FORENSIC_STATE } from '../game/forensics.js';
import { MAT } from '../engine/materials.js';
import { PALETTE } from '../game/models.js';
import {
  addArch, addColonnade, addPeriodBuilding, addKiosk, addStreetLamp,
  addMarketStall, addFilingRow, addShelfStack, addReadingDesk, addMapBoard,
  addSandbags, addParapet, addCeilingStrip, addSignage
} from './libCairo.js';

export const CHAPTER_03_MISSION = {
  id: 'ch03_black_file',
  chapterIndex: 3,
  code: 'DIR-7 / ARCHIVE FLOOR',
  title: 'The Black File',
  cardEra: 'CAIRO · DIRECTORATE 7 · 09:20',
  cardNum: 'CHAPTER 03',
  subtitle: 'GID Directorate 7<br>Archive floor — clearance AMETHYST',
  synopsis: 'The scan from Port Komdok ends in a torn edge. The other half is in Cairo, in a building that has been quietly losing documents since 1979. Nasser has one morning to find it — and to decide who he tells.',
  era: 'modern',
  loadout: ['pistol', 'mp5sd'],
  start: { x: 0, y: 1.2, z: 30 },
  startYaw: Math.PI,
  surface: 'concrete',
  hasSquad: false,
  nvg: false,
  intelTotal: 4,
  darknessAt: 0,
  objectives: [
    { id: 'o_zidan', text: 'Report to Gen. Zidan on the operations floor', marker: { x: 0, y: 1, z: 8 } },
    { id: 'o_archive', text: 'Cross the courtyard to the archive wing', marker: { x: 0, y: 1, z: -14 } },
    { id: 'o_amethyst', text: 'Request the AMETHYST clearance file from the archivist', marker: { x: 0, y: 1, z: -45 } },
    { id: 'o_ledger', text: 'Search the archive floor for the other half of the ledger', marker: { x: 0, y: 1, z: -52 }, type: 'optional' },
    { id: 'o_decision', text: 'Decide what to do with the Box 07 scan', type: 'optional' },
    { id: 'o_ambush', text: 'Reach the rooftop and survive the ambush' }
  ]
};

/**
 * The chapter's decision, stored on the game object so the ending resolver can
 * read it. This mirrors the four campaign flags the UE build uses.
 */
// These must match the keys in save.js DEFAULT_PROGRESS.flags: the ending
// resolver reads f.TRUST_ADEL, and an earlier lowercase 'trust_adel' here made
// the CLEAN HANDS ending unreachable no matter what the player chose.
export const CH03_FLAGS = {
  TRUST_ADEL: 'TRUST_ADEL',
  WITHHELD_SCAN: 'WITHHELD_SCAN'
};

export function buildArchiveMission(game, world) {
  const ground = buildDirectorateGround(world);
  const opsFloor = buildOperationsFloor(world);
  const courtyard = buildCourtyard(world);
  const archive = buildArchiveWing(world);
  const roof = buildRooftop(world);
  buildStreetFrontage(world);
  buildArchiveProps(world, archive);

  // ------------------------------------------------------------- no squad yet
  // Nasser is alone on the Directorate floor: this chapter is about isolation.
  world.friendSpawns.length = 0;

  // ------------------------------------------------------------- garrison
  // Guards exist but are non-hostile until the rooftop; they are placed as
  // "standing" posts with a wide engagement delay so the hub stays peaceful.
  const posts = [
    { x: -8, z: 14 }, { x: 8, z: 14 }, { x: -8, z: -12 }, { x: 8, z: -12 },
    { x: -12, z: -38 }, { x: 12, z: -38 }
  ];
  posts.forEach((p, i) => {
    const guard = world.addEnemy({
      pos: { x: p.x, y: 0.05, z: p.z },
      yaw: Math.PI + (i % 2 ? 0.4 : -0.4),
      era: 'modern',
      palette: PALETTE.egyptModern,
      weapon: 'enemy_modern',
      role: 'rifleman',
      post: true,
      // Hub guards: they hold fire until the rooftop beat flips them hostile.
      faction: 'directorate'
    });
    guard.holdFire = true;
    guard.awareness = 0;
  });

  // The ambush team is spawned hidden and only activated at the rooftop trigger.
  const ambush = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const s = world.addEnemy({
      pos: { x: roof.x + Math.cos(angle) * 9, y: roof.y + 0.05, z: roof.z + Math.sin(angle) * 9 },
      yaw: angle + Math.PI,
      era: 'modern',
      palette: PALETTE.traitorCell,
      weapon: 'enemy_modern',
      role: i === 0 ? 'officer' : 'rifleman',
      faction: 'ambush'
    });
    s.dormant = true;
    ambush.push(s);
  }
  // Snipers on the far roof, visible from the courtyard before the ambush.
  for (const p of [{ x: -26, z: -70 }, { x: 26, z: -70 }]) {
    const s = world.addEnemy({
      pos: { x: p.x, y: roof.y, z: p.z },
      yaw: 0, era: 'modern', palette: PALETTE.traitorCell,
      weapon: 'enemy_modern', role: 'marksman', faction: 'ambush'
    });
    s.dormant = true;
    ambush.push(s);
  }

  // hide every ambush enemy until the beat fires
  for (const s of ambush) {
    s.hidden = true;
  }
  world.addAnimated(() => {
    // keep them frozen while dormant
    for (const s of ambush) {
      if (s.dormant) s.awareness = 0;
    }
  });

  // ------------------------------------------------------------- mission state
  const mission = game.mission;
  const state = {
    reported: false,
    crossed: false,
    requested: false,
    ledgerFound: false,
    decided: false,
    trustedAdel: null,
    ambushFired: false
  };

  // ------------------------------------------------------------- interactables
  // 1. Zidan's desk on the operations floor
  const zidanPos = { x: opsFloor.x, y: 1, z: opsFloor.z - 3 };
  world.addTrigger('ch03_zidan', zidanPos, 4.0, () => {
    if (state.reported) return;
    state.reported = true;
    mission.completeObjective(0, { notice: 'Reported to Gen. Zidan' });
    game.hud.say({ speaker: 'GEN. ZIDAN', en: 'The scan you sent me is a forgery. Or it is real. Either way it does not leave this building.', ar: 'النسخة التي أرسلتها لي مزيفة. أو أنها حقيقية. في الحالتين لن تخرج من هذا المبنى.', radio: true });
    game.audio?.radio(8, 0.4);
    world.addTrigger('ch03_courtyard_hint', { x: 0, y: 1, z: -6 }, 6, () => {
      game.hud.say({ speaker: 'GEN. ZIDAN', en: 'Archive wing is across the courtyard. AMETHYST clearance. Ask for Farida.', ar: 'جناح الأرشيف عبر الفناء. تصريح أميثيست. اسأل عن فريدة.', radio: true });
    }, true);
  }, true);

  // 2. The archivist's desk
  const archivistPos = { x: archive.x, y: 1, z: archive.z + archive.d / 2 - 2 };
  world.addTrigger('ch03_archivist', archivistPos, 4.4, () => {
    if (state.requested) return;
    state.requested = true;
    // You cannot stand at this counter without having crossed the courtyard.
    // Completing that objective here prevents a permanent one-way softlock.
    if (!state.crossed) {
      state.crossed = true;
      mission.completeObjective(1, { notice: 'Crossed into the archive wing' });
    }
    mission.completeObjective(2, { notice: 'Requested the AMETHYST file' });
    game.hud.say({ speaker: 'ARCHIVIST', en: 'AMETHYST was closed in 1979. What you want is in the stacks, not the catalogue.', ar: 'أُغلق أميثيست عام ١٩٧٩. ما تريده في الأرفف، لا في الفهرس.' });
    setTimeout(() => {
      game.hud.say({ speaker: 'NASSER 07', en: 'Then I will read the stacks.', ar: 'إذن سأقرأ الأرفف.' });
    }, 3200);
    openStacksAccess(world, archive);
  }, true);

  // 3. The ledger half — hidden among the stacks
  const ledgerPos = { x: archive.x - archive.w / 2 + 2.2, y: 1, z: archive.z - archive.d / 2 + 3 };
  const ledgerTrigger = world.addTrigger('ch03_ledger', ledgerPos, 2.2, () => {
    if (state.ledgerFound) return;
    state.ledgerFound = true;
    mission.completeObjective(3, { notice: 'Found the other half of the ledger' });
    mission.addIntel({
      id: 'ledger_half_two',
      title: 'Ledger — second half',
      era: 'modern',
      body: 'Fourteen names, and a fifteenth written in a different hand: T. ABDEL-HAKIM. The margin note reads "not to be informed".'
    });
    game.hud.feed('INTELLIGENCE — ledger, second half recovered', 'intel');
  }, true);

  // 3a. Two reclassification slips, pinned inside the stacks. They are the
  // paper trail behind the forensics result: somebody moved this file twice,
  // five years apart, and signed it both times.
  const slips = [
    { id: 'arch_1974', z: archive.z - archive.d / 2 + 5.5, x: archive.x - 3.0,
      title: 'Reclassification slip, 1974',
      body: 'BOX 07 moved from AMETHYST to the standing collection. Reason given: "routine review". Signed with a block: A.Z. Zidan was a captain in 1974.' },
    { id: 'arch_1985', z: archive.z - archive.d / 2 + 10.5, x: archive.x + 3.0,
      title: 'Reclassification slip, 1985',
      body: 'BOX 07 moved again, this time out of the catalogue entirely. Reason: "no surviving operational interest". The same block signature, eleven years older and no less legible.' }
  ];
  for (const slip of slips) {
    world.addBox(slip.x, 1.1, slip.z, 1.4, 0.08, 0.9, MAT.wood(), { solid: false, blockVision: false });
    world.addTrigger(`ch03_slip_${slip.id}`, { x: slip.x, y: 1, z: slip.z }, 2.2, () => {
      if (state[slip.id]) return;
      state[slip.id] = true;
      mission.addIntel({ id: slip.id, title: slip.title, era: 'modern', body: slip.body });
      game.hud.feed(`INTELLIGENCE — ${slip.title}`, 'intel');
    }, true);
  }

  // 3b. Forensics table — prove the file was edited (Chapter 03 design beat).
  const forensicsPos = { x: archive.x + 6.5, y: 1, z: archive.z - 2 };
  world.addTrigger('ch03_forensics', forensicsPos, 3.4, () => {
    if (state.forensicsDone) return;
    openForensicsDesk(game, mission, state);
  }, true);

  // 4. The decision point
  const decisionPos = { x: archive.x, y: 1, z: archive.z + 1.5 };
  world.addTrigger('ch03_decision', decisionPos, 3.2, () => {
    if (state.decided) return;
    state.decided = true;
    presentDecision(game, world, state, mission);
  }, true);

  // 5. Rooftop ambush trigger
  world.addTrigger('ch03_roof', { x: roof.x - 11.2, y: roof.y + 1, z: roof.z + 5.5 }, 3.6, () => {
    if (state.ambushFired) return;
    // Guard: the beat only fires when the player is genuinely above the roofline.
    if (game.player.pos.y < roof.y - 0.6) return;
    state.ambushFired = true;
    fireAmbush(game, world, ambush, roof, mission);
  }, true);

  // 6. Courtyard crossing (wide radius: the courtyard is the only path through)
  world.addTrigger('ch03_courtyard', { x: 0, y: 1, z: -18 }, 15, () => {
    if (state.crossed) return;
    state.crossed = true;
    mission.completeObjective(1, { notice: 'Crossed into the archive wing' });
  }, true);

  // ------------------------------------------------------------- ambient life
  buildAmbientLife(world, courtyard);

  return {
    state,
    roof,
    archive,
    ambush
  };
}

// =============================================================== ground & shell

function buildDirectorateGround(world) {
  world.setTerrain((x, z) => {
    // Flat paved compound with a slight fall toward the street.
    const street = Math.max(0, -z - 34) * 0.04;
    return -street + Math.sin(x * 0.35) * 0.012;
  }, { size: 220, segments: 110 });

  // Asphalt forecourt
  world.addBox(0, 0.02, 6, 46, 0.04, 52, MAT.asphalt(), { solid: false, blockVision: false });
  // Compound perimeter wall
  const wallH = 2.6;
  world.addBox(0, wallH / 2, -76, 92, wallH, 0.5, MAT.concrete(0xbfb49c), { cover: true });
  world.addBox(-23, wallH / 2, 6, 0.5, wallH, 76, MAT.concrete(0xbfb49c), { cover: true });
  world.addBox(23, wallH / 2, 6, 0.5, wallH, 76, MAT.concrete(0xbfb49c), { cover: true });
  return { x: 0, z: 0 };
}

function buildOperationsFloor(world) {
  const w = 18, d = 14, h = 4.2;
  const building = addPeriodBuilding(world, {
    x: 0, z: 12, w, d, h, mat: MAT.concrete(0xcfc6ae), roofMat: MAT.concrete(0x9c9484),
    doorSide: 'south', windows: 3
  });

  // Interior floor and back wall so the room reads as a room.
  world.addBox(0, 0.05, 12, w - 0.6, 0.1, d - 0.6, MAT.concrete(0x8f8a7c), { solid: false });
  // Partition creating the operations pit
  world.addBox(-5.2, 1.4, 12, 0.24, 2.8, d - 2, MAT.wood(), { cover: true });
  world.addBox(5.2, 1.4, 12, 0.24, 2.8, d - 2, MAT.wood(), { cover: true });

  // Desks
  for (let i = 0; i < 4; i++) {
    world.addBox(-6.5 + i * 4.3, 0.74, 9.5, 2.2, 0.1, 1.0, MAT.wood(), { cover: true });
    world.addBox(-6.5 + i * 4.3, 0.37, 9.5, 2.0, 0.74, 0.9, MAT.metal(0x6c7276));
  }

  // Zidan's desk faces the door
  world.addBox(0, 0.78, 16.5, 3.0, 0.12, 1.4, MAT.wood(), { cover: true });
  world.addBox(0, 0.38, 16.5, 2.8, 0.76, 1.2, MAT.metal(0x5a6064));

  // Map board behind him
  addMapBoard(world, 0, 18.7, Math.PI, 4.2, 2.0);
  // Period signage
  addSignage(world, 0, 3.4, 18.8, Math.PI, 4.6, 0.55, 0x1b2620);

  // Fluorescents
  for (let i = 0; i < 3; i++) addCeilingStrip(world, -4 + i * 4, 4.0, 12, 3.0, Math.PI / 2);
  addCeilingStrip(world, 0, 4.0, 16, 2.4, 0);

  return { x: 0, z: 12, ...building };
}

function buildCourtyard(world) {
  // The courtyard is the connective tissue: 24 m of open ground between the
  // operations building and the archive wing, with a colonnade on one side.
  addColonnade(world, { x: -10, z: 1 }, { x: 10, z: 1 }, 6, 3.4, 0.22, MAT.concrete(0xc9bfa6));

  // Garden bed with a dead palm
  world.addBox(-8, 0.25, -6, 6, 0.5, 4, MAT.sand(3), { solid: false, blockVision: false });
  world.addBox(-8, 1.6, -6, 0.35, 2.8, 0.35, MAT.wood());
  for (let i = 0; i < 5; i++) {
    world.addBox(-8 + Math.cos(i) * 0.9, 3.0 + i * 0.1, -6 + Math.sin(i) * 0.9, 1.4, 0.06, 0.18,
      MAT.cloth(0x6d6b3f), { solid: false, blockVision: false });
  }

  // Benches and a dry fountain
  for (const z of [-2, 2]) {
    world.addBox(8, 0.42, z, 2.4, 0.12, 0.5, MAT.wood(), { cover: true });
    world.addBox(8, 0.2, z, 2.2, 0.4, 0.35, MAT.concrete(0x9a9484));
  }
  // fountain basin (empty)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    world.addBox(Math.cos(a) * 3.2, 0.3, -2 + Math.sin(a) * 3.2, 0.9, 0.6, 0.5,
      MAT.concrete(0xa8a292), { rotY: a });
  }

  // Lamps along the courtyard walk
  for (const p of [{ x: -11, z: 6 }, { x: 11, z: 6 }, { x: -11, z: -4 }, { x: 11, z: -4 }]) {
    addStreetLamp(world, p.x, p.z, 3.8);
  }

  return { x: 0, z: -6 };
}

function buildArchiveWing(world) {
  const w = 24, d = 16, h = 4.6;
  addPeriodBuilding(world, {
    x: 0, z: -52, w, d, h, mat: MAT.concrete(0xb9ae95), roofMat: MAT.concrete(0x8e8778),
    doorSide: 'south', windows: 4
  });

  // Interior: floor, two rows of stacks, a mezzanine
  world.addBox(0, 0.05, -52, w - 0.6, 0.1, d - 0.6, MAT.concrete(0x7e7a6e), { solid: false });

  // Stack rows
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      addShelfStack(world, side * 6.5, -46 - i * 3.2, Math.PI / 2, 1);
      addShelfStack(world, side * 3.2, -46 - i * 3.2, Math.PI / 2, 1);
    }
  }

  // Filing wall along the back
  addFilingRow(world, { x: -9, z: -59.2 }, { x: 9, z: -59.2 }, 12, 2.0);

  // Reading desks under the windows
  addReadingDesk(world, -8.5, -55, 0);
  addReadingDesk(world, 8.5, -55, 0);

  // The archivist's counter near the door
  world.addBox(0, 1.05, -43.5, 6.0, 0.14, 0.9, MAT.wood(), { cover: true });
  world.addBox(0, 0.5, -43.5, 5.8, 1.0, 0.8, MAT.wood());
  addSignage(world, 0, 3.2, -59.4, 0, 5.2, 0.5, 0x24301f);

  // Mezzanine at 3.4 m, reached by stairs at the east end.
  world.addBox(0, 3.4, -57.5, w - 4, 0.24, 5.0, MAT.wood(), { cover: true });
  world.addBox(0, 3.9, -59.7, w - 4, 0.9, 0.16, MAT.metalDark, { blockVision: false });
  // stairs
  for (let i = 0; i < 10; i++) {
    world.addBox(9.5, 0.17 + i * 0.34, -50 + i * 0.42, 2.2, 0.34, 0.42, MAT.concrete(0x9a9484));
  }

  // Fluorescents over the aisles
  for (let i = 0; i < 4; i++) addCeilingStrip(world, -6 + i * 4, 4.4, -52, 3.4, Math.PI / 2);

  return { x: 0, z: -52, w, d, h };
}

function buildRooftop(world) {
  // Roof of the archive wing, reachable by an external stair from the courtyard.
  const roofY = 4.6;
  const w = 24, d = 16;
  addParapet(world, 0, -52, w, d, 1.0);

  // External stair: 14 steps from courtyard level to the roof, along the west side.
  for (let i = 0; i < 14; i++) {
    world.addBox(-11.2, 0.17 + i * 0.33, -38 - i * 0.55, 2.4, 0.33, 0.55, MAT.concrete(0x8e8778));
  }
  // Landing
  world.addBox(-11.2, roofY + 0.05, -46, 3.0, 0.1, 3.0, MAT.concrete(0x8e8778), { cover: false });

  // Rooftop furniture: AC units, water tank, a lift housing
  world.addBox(6, roofY + 0.9, -55, 2.2, 1.8, 2.2, MAT.metal(0x6f7579), { cover: true });
  world.addBox(-6, roofY + 0.7, -57, 1.8, 1.4, 1.8, MAT.metal(0x767c80), { cover: true });
  const tank = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 1.8, 14),
    MAT.metal(0x5d6366)
  );
  tank.position.set(2, roofY + 2.0, -58.5);
  tank.castShadow = true;
  world.addObject(tank, { solid: true, box: [2, roofY + 2.0, -58.5, 2.2, 1.8, 2.2, true, true] });
  // ladder + antenna
  world.addBox(-2, roofY + 1.5, -47, 0.1, 3.0, 0.1, MAT.metalDark, { blockVision: false });
  for (let i = 0; i < 5; i++) {
    world.addBox(-2 + (i - 2) * 0.2, roofY + 2.9, -47, 0.1, 0.1, 0.6, MAT.metalDark,
      { solid: false, blockVision: false });
  }

  // Sandbag positions for the defence
  addSandbags(world, 0, -44.5, 0, 4.2);
  addSandbags(world, -8, -47, Math.PI / 2, 3.0);
  addSandbags(world, 8, -47, Math.PI / 2, 3.0);

  return { x: 0, y: roofY, z: -52 };
}

function buildStreetFrontage(world) {
  // Cairo street outside the compound wall: shops, kiosks, a taxi, laundry lines.
  const streetZ = -82;
  world.addBox(0, 0.01, streetZ, 120, 0.02, 12, MAT.asphalt(), { solid: false, blockVision: false });

  for (let i = -4; i <= 4; i++) {
    addPeriodBuilding(world, {
      x: i * 13, z: streetZ - 12, w: 11, d: 10, h: 8 + (i % 3) * 2.2,
      rotY: 0, mat: MAT.brick(), roofMat: MAT.concrete(0x9a8f78),
      doorSide: 'south', windows: 3, balcony: i % 2 === 0
    });
  }
  for (const k of [{ x: -18, z: streetZ + 4 }, { x: 2, z: streetZ + 4 }, { x: 20, z: streetZ + 4 }]) {
    addKiosk(world, k.x, k.z, Math.PI, 0x9c5b34);
  }
  for (const s of [{ x: -8, z: streetZ + 3 }, { x: 12, z: streetZ + 3 }]) {
    addMarketStall(world, s.x, s.z, Math.PI);
  }
  for (let i = 0; i < 5; i++) addStreetLamp(world, -26 + i * 13, streetZ + 5, 4.6);
}

// =============================================================== props & beats

function buildArchiveProps(world, archive) {
  // Archive boxes on the mezzanine: the "black file" shelf.
  for (let i = 0; i < 6; i++) {
    world.addBox(-8 + i * 3.2, 3.62, -59.4, 1.5, 0.42, 0.9, MAT.wood(), { cover: true });
  }
  // a lone chair, mid-floor
  world.addBox(2, 0.22, -48, 0.5, 0.44, 0.5, MAT.wood(), { cover: false });

  // The decision table centre of the archive floor.
  addReadingDesk(world, archive.x, archive.z + 1.5, 0);

  // The UV analysis bench.
  addReadingDesk(world, archive.x + 6.5, archive.z - 2, 0);
  world.addBox(archive.x + 6.5, 1.02, archive.z - 2, 0.34, 0.12, 0.22, MAT.metal(0x4a4f52),
    { solid: false, blockVision: false });
  const uvLamp = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.09, 0.3, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a2a3a, emissive: 0x6f5cff, emissiveIntensity: 1.4 })
  );
  uvLamp.position.set(archive.x + 6.5, 1.22, archive.z - 2);
  world.addObject(uvLamp, { solid: false });

  // Documents scattered — read as "someone was here before you"
  for (let i = 0; i < 14; i++) {
    world.addBox(
      archive.x - 8 + Math.random() * 16,
      0.07,
      archive.z - 6 + Math.random() * 12,
      0.32, 0.01, 0.42, MAT.cloth(0xe6e0cc),
      { solid: false, blockVision: false, rotY: Math.random() * 3 }
    );
  }
}

function openStacksAccess(world, archive) {
  // The stacks were physically closed off by a shutter; opening it is the reward
  // for asking the archivist, and it is a real collidable object being removed.
  const shutter = world.addBox(archive.x, 1.4, archive.z - 4.5, 6.2, 2.8, 0.2,
    MAT.metal(0x5b6165), { cover: true });
  const box = shutter.userData.collisionBox;
  world.addAnimated(() => {
    if (!shutter.userData.opening) return;
    shutter.position.y += 0.03;
    if (box) box.maxY = Math.min(box.maxY, shutter.position.y + 1.4);
  });
  setTimeout(() => {
    shutter.userData.opening = true;
  }, 2600);
  if (box) box.maxY = 2.8;
}

function openForensicsDesk(game, mission, state) {
  // Deterministic per playthrough seed is not needed here: the case is real
  // either way, and a fresh one each run keeps the beat replayable.
  let seed = 0;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const caseData = beginCase(buildForensicCase(rng, { fields: 7, conflicts: 3 }));

  game.hud.say({
    speaker: 'ARCHIVIST',
    en: 'The lamp picks up the ink underneath. Anything that does not match the page — flag it.',
    ar: 'المصباح يكشف الحبر الذي تحته. أي شيء لا يطابق الصفحة — علّمه.',
    radio: false
  });

  game.hud.openForensics(caseData, {
    onClose: (closed) => {
      const summary = summarise(closed);
      if (summary.proven) {
        state.forensicsDone = true;
        state.forensicsProven = true;
        mission.addIntel({
          id: 'forensics_report',
          title: 'Ink analysis — archive floor',
          era: 'modern',
          body: `${summary.findings.length} fields overwritten. ` +
            summary.findings.map((f) => `${f.label}: ${f.shown} over ${f.underneath}`).join(' · ')
        });
        game.hud.say({
          speaker: 'ADEL "MOUSE" FARHAN',
          en: `That is a director's signature under the archivist's hand. Someone edited this file while it was still live.`,
          ar: 'هذا توقيع مدير تحت خط يد أمين الأرشيف. أحدهم عدّل هذا الملف وهو ما زال نشطًا.',
          radio: true
        });
        mission.completeObjective(2, { notice: 'Proved the AMETHYST file was edited' });
      } else {
        // Never a dead end: the case can be reopened and retried.
        state.forensicsDone = false;
        state.forensicsProven = false;
        game.hud.feed('ANALYSIS INCONCLUSIVE — the lamp is still warm, try again', 'alert');
      }
    }
  });
}

function presentDecision(game, world, state, mission) {
  const options = [
    {
      id: 'trust',
      text: 'Give Adel the scan. He can authenticate it.',
      textAr: 'أعط عادل النسخة. يستطيع التحقق منها.',
      apply: () => {
        state.trustedAdel = true;
        game.save?.setProgress?.((p) => {
          p.flags = p.flags || {};
          p.flags[CH03_FLAGS.TRUST_ADEL] = true;
        });
        game.hud.say({ speaker: 'ADEL "MOUSE" FARHAN', en: 'I will check it against the 1979 index. If it is real, Nasser, your grandfather signed it.', ar: 'سأقارنها بفهرس ١٩٧٩. إن كانت حقيقية يا ناصر، فجدك هو من وقّعها.' });
      }
    },
    {
      id: 'withhold',
      text: 'Keep it. Tell no one yet.',
      textAr: 'احتفظ بها. لا تخبر أحدًا بعد.',
      apply: () => {
        state.trustedAdel = false;
        game.save?.setProgress?.((p) => {
          p.flags = p.flags || {};
          p.flags[CH03_FLAGS.WITHHELD_SCAN] = true;
        });
        game.hud.say({ speaker: 'NASSER 07', en: 'Not yet. Not until I know what my name is doing on it.', ar: 'ليس بعد. ليس قبل أن أعرف لماذا يظهر اسمي عليها.' });
      }
    }
  ];

  if (game.hud?.showChoice) {
    game.hud.showChoice({
      prompt: 'WHAT DO YOU DO WITH THE BOX 07 SCAN?',
      promptAr: 'ماذا تفعل بنسخة صندوق ٠٧؟',
      options
    });
  } else {
    options[0].apply();
  }

  mission.completeObjective(4, { notice: 'Decided what to do with the scan' });
  game.audio?.uiConfirm();
}

function fireAmbush(game, world, ambush, roof, mission) {
  // The ambush cell is dormant on the field; this beat wakes the live enemies.
  for (const e of game.ai.enemies) {
    if (e.dead) continue;
    if (e.faction === 'ambush') {
      e.dormant = false;
      e.hidden = false;
      e.holdFire = false;
      e.mesh.visible = true;
      e.awareness = Math.max(e.awareness, 0.8);
      e.alerted = true;
      e.lastSeenPos.set(game.player.pos.x, game.player.pos.y + 1.4, game.player.pos.z);
      e.state = ENEMY_STATE.COMBAT;
    } else if (e.faction === 'directorate') {
      // Directorate guards were only ever holding fire; now they are hostile.
      e.holdFire = false;
      e.faction = 'ambush';
      e.awareness = Math.max(e.awareness, 0.6);
    }
  }

  game.hud.say({
    speaker: 'NASSER 07',
    en: 'Contact! They were waiting for the file, not for me.',
    ar: 'تماس! كانوا ينتظرون الملف، لا ينتظرونني.',
    urgent: true
  });
  game.hud.feed('CONTACT — ROOFTOP AMBUSH', 'alert');
  game.audio?.radio(12, 0.9);
  game.audio?.setTension?.(1);

  // Smoke and a tracer to sell the moment.
  world.spawnSmokeColumn({ x: roof.x + 4, y: roof.y + 1, z: roof.z - 2 }, { color: 0x9a9a90, count: 20, life: 7 });
  world.spawnTracer(
    { x: roof.x - 20, y: roof.y + 1.5, z: roof.z - 18 },
    { x: roof.x + 2, y: roof.y + 1.2, z: roof.z },
    0xffe0a0, 0.12
  );

  setTimeout(() => {
    game.hud.say({
      speaker: 'JACKAL',
      en: 'Nasser, the Directorate roof is lit up. Hold it — we are two minutes out.',
      ar: 'ناصر، سطح المديرية مشتعل. اصمد — نحن على بعد دقيقتين.',
      radio: true
    });
  }, 4200);

  mission.completeObjective(5, { notice: 'Survived the rooftop ambush' });
  
}

function buildAmbientLife(world, courtyard) {
  // Dust motes drifting through the courtyard light — cheap, sells the space.
  world.addAnimated((dt, t) => {
    if (Math.random() < 0.02) {
      world.spawnParticles({
        pos: {
          x: courtyard.x + (Math.random() - 0.5) * 18,
          y: 1.4 + Math.random() * 2,
          z: courtyard.z + (Math.random() - 0.5) * 16
        },
        count: 6, color: 0xd8c9a8, size: 0.02, speed: 0.25, life: 5.5, gravity: 0.02, spread: 0.6
      });
    }
  });

  // A radio playing somewhere in the street (period detail, non-diegetic stand-in).
  world.ambientAudio.push({ id: 'street_radio', pos: { x: 0, y: 2, z: -84 }, radius: 26, volume: 0.12 });
  world.ambientAudio.push({ id: 'archive_hum', pos: { x: 0, y: 3, z: -52 }, radius: 18, volume: 0.08 });
}

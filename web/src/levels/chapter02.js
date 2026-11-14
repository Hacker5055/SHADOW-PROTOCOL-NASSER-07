/**
 * SHADOW PROTOCOL — CHAPTER 02: THE SILENT MISSION
 * Present day · Port Komdok, DPRK · Nasser 07
 *
 * 2.1 COLD APPROACH   — sea wall / drainage / gate, three routes
 * 2.2 THE ADMIN BLOCK — find the hostages, optional server
 * 2.3 ROOFTOP         — defend the extraction
 * 2.4 THE WRONG FILE  — the Box 07 reveal
 */
import * as THREE from 'three';
import { MAT } from '../engine/materials.js';
import { PALETTE } from '../game/models.js';
import {
  buildPortTerrain, buildQuay, buildContainers, buildAdminBlock, buildFloodlights,
  buildPerimeter, buildDocksideProps, buildSeaWallApproach, buildInteriors
} from './libModern.js';

export const CHAPTER_02_MISSION = {
  id: 'ch02_silent',
  chapterIndex: 2,
  code: 'OP SILENT MISSION / K-9',
  title: 'The Silent Mission',
  cardEra: 'PORT KOMDOK · DPRK · 02:40 LOCAL',
  cardNum: 'CHAPTER 02',
  subtitle: 'GID Special Operations Cell K-9<br>Objective: recover six Egyptian nationals',
  synopsis: 'Six engineers are held at a "weather station" on the North Korean coast. Nasser leads the K-9 cell through a night infiltration — and finds an archive scan from 1973 inside the facility.',
  era: 'modern',
  loadout: ['mp5sd', 'm4', 'pistol'],
  start: { x: 96, y: 3.4, z: 84 },
  startYaw: Math.PI,
  surface: 'concrete',
  hasSquad: true,
  nvg: true,
  intelTotal: 5,
  darknessAt: 0,
  objectives: [
    { text: 'Infiltrate the port — reach the container yard undetected', marker: { x: 60, y: 1, z: 40 } },
    { text: 'Enter the admin block and locate the hostages', marker: { x: -6, y: 1, z: -52 } },
    { text: 'Optional: recover the server rack from the admin block', type: 'optional' },
    { text: 'Escort the hostages to the rooftop LZ', marker: { x: -5, y: 12, z: -60 } },
    { text: 'Hold the roof until the helicopter arrives' }
  ]
};

export function buildSilentMission(game, world) {
  const terrain = buildPortTerrain(world);
  buildQuay(world);
  buildContainers(world);
  const admin = buildAdminBlock(world);
  buildFloodlights(world);
  buildPerimeter(world);
  buildDocksideProps(world);
  buildSeaWallApproach(world);
  buildInteriors(world, admin);

  // ------------------------------------------------- squad
  world.friendSpawns.push(
    { callsign: 'FANG', nameEn: 'Lt. Karim El-Sayed', nameAr: 'كريم السيد', role: 'marksman', slot: 0, pos: { x: 96, y: 3.4, z: 88 }, era: 'modern', palette: PALETTE.egyptModern, weapon: 'enemy_modern' },
    { callsign: 'JACKAL', nameEn: 'Sgt. Hoda Mansour', nameAr: 'هدى منصور', role: 'engineer', slot: 1, pos: { x: 94, y: 3.4, z: 90 }, era: 'modern', palette: PALETTE.egyptModern, weapon: 'enemy_modern' },
    { callsign: 'MOUSE', nameEn: 'Sgt. Adel Farhan', nameAr: 'عادل فرحان', role: 'comms', slot: 2, pos: { x: 98, y: 3.4, z: 90 }, era: 'modern', palette: PALETTE.egyptModern, weapon: 'enemy_modern', radio: true }
  );

  // ------------------------------------------------- garrison
  // perimeter patrols
  const patrols = [
    [{ x: -20, z: 20 }, { x: -20, z: -14 }, { x: 6, z: -14 }],
    [{ x: 30, z: 30 }, { x: 46, z: 10 }, { x: 30, z: -8 }],
    [{ x: 56, z: 50 }, { x: 20, z: 56 }, { x: 44, z: 30 }],
    [{ x: -44, z: -6 }, { x: -44, z: 22 }, { x: -30, z: 8 }]
  ];
  for (const p of patrols) {
    world.addEnemy({
      pos: { x: p[0].x, y: 0.05, z: p[0].z }, yaw: 0, era: 'modern',
      palette: PALETTE.nkGuard, weapon: 'enemy_modern', role: 'rifleman',
      patrol: p
    });
  }
  // static posts around the admin block and the yard
  const posts = [
    [-26, -48], [16, -50], [-6, -40], [22, -30], [-40, -40],
    [10, 6], [-16, 4], [40, -54], [-52, 30], [58, 4]
  ];
  posts.forEach(([x, z], i) => {
    world.addEnemy({
      pos: { x, y: 0.05, z }, yaw: Math.PI + (Math.random() - 0.5),
      era: 'modern', palette: PALETTE.nkGuard, weapon: 'enemy_modern',
      role: i % 4 === 0 ? 'officer' : 'rifleman'
    });
  });
  // sentries inside the admin block (two floors)
  for (const p of [{ x: -14, z: -58 }, { x: 2, z: -66 }, { x: 8, z: -56 }, { x: -6, z: -66 }]) {
    world.addEnemy({
      pos: { x: p.x, y: 0.05, z: p.z }, yaw: Math.random() * 6,
      era: 'modern', palette: PALETTE.nkGuard, weapon: 'enemy_modern'
    });
  }
  // QRF staged behind the admin block (rooftop defence)
  const qrf = [];
  for (let i = 0; i < 10; i++) {
    qrf.push({ x: -30 + i * 6, z: -86 });
  }

  for (const s of world.enemySpawns) {
    s.pos.y = world.collision.surfaceAt(s.pos.x, s.pos.z, 20, 0.3) + 0.02;
  }

  const mission = game.mission;
  const state = {
    infiltrated: false,
    serverTaken: false,
    hostagesFound: false,
    roofTriggered: false,
    heliArrived: false,
    capturedCount: 0
  };

  // ------------------------------------------------- hostage NPCs (escorted, not combatants)
  const hostages = [];
  const hostagePositions = [
    { x: -14, z: -58 }, { x: -12.4, z: -58.6 }, { x: -13.2, z: -59.4 },
    { x: -15, z: -59 }, { x: -11.6, z: -57.6 }, { x: -13.8, z: -57.2 }
  ];
  hostagePositions.forEach((p, i) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.9, 4, 8),
      new THREE.MeshStandardMaterial({ color: i === 0 ? 0x8a8f96 : 0x6a6f74, roughness: 0.9 }));
    body.position.y = 0.78;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x8a5f3c, roughness: 0.8 }));
    head.position.y = 1.42;
    g.add(head);
    g.position.set(p.x, 0.02, p.z);
    g.rotation.y = Math.random() * 6;
    world.addObject(g);
    hostages.push({ mesh: g, pos: g.position, id: i, rescued: false });
  });

  // ------------------------------------------------- infiltration triggers
  world.addTrigger('yard', { x: 60, y: 1, z: 40 }, 14, () => {
    if (state.infiltrated) return;
    state.infiltrated = true;
    mission.completeObjective(0);
    game.hud.say({
      speaker: 'FANG',
      en: 'We are inside the wire. Cameras are on a nine-second sweep. Nine seconds, then the blind spot on the north gantry.',
      ar: 'إحنا جوه السلك. الكاميرات بتلف كل تسع ثواني. تسع ثواني، وبعدها النقطة العميا عند البرج الشمالي.'
    });
    setTimeout(() => game.hud.say({
      speaker: 'NASSER',
      en: 'Jackal, take the north. Mouse, cut their landline but leave the radio — I want to hear them call for help.',
      ar: 'جاكال، خد الشمال. ماوس، اقطع التليفون الأرضي وسيب الراديو — عايز أسمعهم بيطلبوا نجدة.'
    }), 6000);
    game.hud.say({
      speaker: 'JACKAL',
      en: 'That is either very confident or very Egyptian.',
      ar: 'ده يا إما ثقة زيادة يا إما مصري خالص.',
      voice: false,
      time: 3200
    });
    mission.checkpoint();
  });

  world.addTrigger('admin-door', { x: -6, y: 1, z: -52 }, 6, () => {
    mission.completeObjectiveByText('Enter the admin block');
    game.hud.say({
      speaker: 'MOUSE',
      en: 'Six heat signatures, ground floor, west room. Two guards moving. No cameras inside — this building is older than the country.',
      ar: 'ست بصمات حرارة، الدور الأرضي، الأوضة الغربية. اتنين حراس بيتحركوا. مفيش كاميرات جوه — المبنى أقدم من البلد.'
    });
  });

  world.addTrigger('cells', { x: -14, y: 1, z: -58 }, 6, () => {
    if (state.hostagesFound) return;
    state.hostagesFound = true;
    mission.completeObjectiveByText('locate the hostages');
    // Mariam's first statement, on the main path. Chapter 02 had no document a
    // straight playthrough was guaranteed to collect, which left the campaign's
    // 1973 coda with a chapter-shaped hole in its required set.
    mission.addIntel({
      id: 'mariam_statement',
      title: 'Statement — Mariam Fahmy',
      era: 'modern',
      body: '"They did not want the drone. They wanted the manifest for it. A number on a 1973 annex — they kept saying the same six digits." The drive the engineers carried was a decoy; the paper was the target.'
    });
    game.audio.setTension(0.3);
    game.hud.say({
      speaker: 'MARIAM',
      en: 'You are Egyptian. Thank God — they told us Cairo had abandoned us.',
      ar: 'إنت مصري. الحمد لله — قالوا لنا القاهرة سابتنا.',
      urgent: true
    });
    setTimeout(() => game.hud.say({
      speaker: 'NASSER',
      en: 'Cairo sends what it can. Can you walk?',
      ar: 'القاهرة بتبعت اللي تقدر عليه. تقدري تمشي؟'
    }), 4600);
    setTimeout(() => game.hud.say({
      speaker: 'MARIAM',
      en: 'We were not building a weather station. We were recovering a drone. It had a hard drive with a scan on it. 1973. Your ministry asked for it by number.',
      ar: 'إحنا مكناش بنبني محطة أرصاد. كنا بنلمّ طيارة مسيّرة. كان فيها هارد بمسح. سنة ١٩٧٣. وزارتكم طلبتها بالرقم.'
    }), 9000);
    setTimeout(() => {
      game.hud.say({
        speaker: 'NASSER',
        en: 'What number.',
        ar: 'أنهي رقم.'
      });
      game.hud.feed('OBJECTIVE — INTERROGATE THE FACILITY ADMINISTRATOR', '');
      mission.checkpoint();
    }, 15000);
    // hostages follow the squad now
    for (const h of hostages) { h.following = true; }
  });

  // Optional objective: sweeping the racks. Chapter 02 already contained three
  // documents and hid them behind an interactable no objective pointed at, which
  // made the campaign-wide "all 21 documents" coda unreachable without guessing.
  // OBJ.OPTIONAL, not a literal: the mission object's own `type` vocabulary is
  // primary / optional / bonus, and a string it does not know silently behaves
  // like a primary objective.
  mission.objectives.push({
    id: 'o_racks', text: 'Sweep the server racks', type: 'optional', done: false
  });

  // ------------------------------------------------- optional server
  const server = world.props.get('server');
  if (server) {
    world.addInteractable({
      pos: server.mesh.position.clone(),
      radius: 2.4,
      label: 'PULL THE SERVER RACK',
      onUse: (g) => {
        state.serverTaken = true;
        mission.completeObjectiveByText('recover the server rack');
        mission.completeObjective('o_racks', { silent: true });
        g.mission.addIntel({
          id: 'box07_scan', title: 'ARCHIVE BOX 07 — OPERATION AMUN',
          era: 'modern',
          body: 'Scan of a 1973 military intelligence annex file. Cover marked 07. Margin note in a hand Nasser recognises: "deliverable to be confirmed on site — T.A.H." His grandfather\'s initials.'
        });
        g.hud.feed('INTELLIGENCE — BOX 07 SCAN', '');
        g.audio.setTension(0.6);
        g.hud.say({
          speaker: 'JACKAL',
          en: 'That is a 1973 file header. Amun. Nasser — this scan is older than both of us.',
          ar: 'ده هيدر ملف من ١٩٧٣. آمون. ناصر — المسح ده أقدم مننا احنا الاتنين.'
        });
        setTimeout(() => g.hud.say({
          speaker: 'NASSER',
          en: 'T.A.H. That is my grandfather. Pull it. Pull everything.',
          ar: 'ت.ع.ح. ده جدي. اسحبها. اسحب كل حاجة.',
          urgent: true
        }), 5000);
      }
    });
  }
  const mapTable = world.props.get('map');
  if (mapTable) {
    world.addInteractable({
      pos: mapTable.mesh.position.clone(),
      radius: 2.4,
      label: 'STUDY THE QRF ROSTER',
      onUse: (g) => {
        g.mission.addIntel({ id: 'qrf_roster', title: 'QRF roster', era: 'modern', body: '24 personnel. Two technicals, one APC. Reaction time from alarm to roof: 4 minutes.' });
        g.hud.showPrompt('QRF ROSTER — 4 MINUTE RESPONSE', 2.6);
      }
    });
  }

  // ------------------------------------------------- rooftop defence
  world.addTrigger('roof', { x: -5, y: 12, z: -60 }, 5.5, () => {
    if (state.roofTriggered) return;
    state.roofTriggered = true;
    mission.completeObjectiveByText('Escort the hostages');
    // SAVED_MARIAM is one of the four flags the ending resolver reads. Nothing
    // ever wrote it, so CLEAN HANDS was unreachable no matter how the chapter
    // was played. Mariam is hostage 0 and is recorded only if she reached the
    // roof with the player.
    const mariam = hostages[0];
    const mariamSafe = !!mariam && Math.hypot(mariam.pos.x - game.player.pos.x, mariam.pos.z - game.player.pos.z) < 24;
    game.save?.setProgress?.((p) => {
      p.flags = p.flags || {};
      p.flags.SAVED_MARIAM = mariamSafe;
    });
    if (mariamSafe) game.hud.feed('MARIAM FAHMY — ON THE ROOF', 'squad');
    mission.checkpoint();
    game.audio.setTension(0.8);
    game.hud.say({
      speaker: 'MOUSE',
      en: 'Bird is eleven minutes out. And the yard is filling up — they know.',
      ar: 'الطيارة على أحداشر دقيقة. والساحة بتمتلي — هما عرفوا.',
      urgent: true
    });
    // spawn the QRF assault in waves
    let wave = 0;
    const iv = setInterval(() => {
      wave++;
      for (let i = 0; i < qrf.length; i++) {
        const p = qrf[i];
        game.ai.spawnEnemies([{
          pos: { x: p.x + (Math.random() - 0.5) * 8, y: world.collision.surfaceAt(p.x, p.z, 20) + 0.02, z: p.z + Math.random() * 12 },
          yaw: 0, era: 'modern', palette: PALETTE.nkGuard, weapon: 'enemy_modern'
        }]);
        const e = game.ai.enemies[game.ai.enemies.length - 1];
        e.alerted = true;
        e.awareness = 1;
        e.state = 'combat';
        e.lastSeenPos.copy(game.player.pos);
      }
      game.hud.feed(`QRF WAVE ${wave} — HOLD THE ROOF`, 'kill');
      game.renderer.addShake(0.03);
      if (wave >= 3) clearInterval(iv);
    }, 14000);

    // helicopter arrival
    setTimeout(() => {
      state.heliArrived = true;
      game.hud.say({ speaker: 'MOUSE', en: 'Bird on final! Pop smoke, pop smoke!', ar: 'الطيارة في النهاية! دخّن، دخّن!', urgent: true });
      spawnHelicopter(game, world, admin);
      mission.completeObjectiveByText('Hold the roof');
      setTimeout(() => {
        // final reveal
        game.audio.setTension(0.25);
        game.completeChapter02 = true;
        game.hud.say({
          speaker: 'NASSER',
          en: 'Mariam. The number on that drive. Say it again.',
          ar: 'مريم. الرقم اللي على الهارد. قوليه تاني.'
        });
        setTimeout(() => game.hud.say({
          speaker: 'MARIAM',
          en: 'Zero seven. Archive box zero seven. Operation Amun.',
          ar: 'صفر سبعة. صندوق الأرشيف سبعة. عملية آمون.'
        }), 4600);
        setTimeout(() => {
          game.hud.say({
            speaker: 'NASSER',
            en: 'My grandfather was in Amun. He came home and never said a word about it for forty-one years.',
            ar: 'جدي كان في آمون. رجع البيت ومقالش كلمة عنها واحد وأربعين سنة.'
          });
          setTimeout(() => game.onMissionComplete(), 5200);
        }, 9500);
      }, 9000);
    }, 34000);
  });

  // approach flavour
  world.addTrigger('seawall', { x: 92, y: 2, z: 60 }, 9, () => {
    game.hud.say({
      speaker: 'NASSER',
      en: 'Sea wall is clear. Weapons tight — I want us inside before they know we exist.',
      ar: 'حاجز البحر فاضي. أسلحة محكمة — عايزنا نكون جوه قبل ما يعرفوا إننا موجودين.',
      urgent: true
    });
    game.player.nightVision = true;
    game.renderer.setNVG(0.88);
  });

  // extra intel across the yard
  const intelSpots = [
    { id: 'nkg_orders', x: 30, z: 12, title: 'QRF movement order', body: 'Hand-written. "If the Egyptians come, do not let them reach the third floor. The hard drive is worth more than the engineers."' },
    { id: 'nkg_roster', x: -34, z: -12, title: 'Guard shift roster', body: 'Twelve names, four of them Korean, eight Egyptian. Eight of our own nationals guarding a holding site.' },
    { id: 'nkg_photo', x: 46, z: 34, title: 'Photograph, 2019', body: 'Six engineers with a recovered drone. In the background: a man in a civilian coat with a Directorate visitor badge. The face is turned away.' },
    { id: 'nkg_ledgercopy', x: -44, z: 18, title: 'Third-country transfer docket', body: 'A manifest for "archival material" — one crate, 4 kg, routed Vienna → Alexandria. Signed with a block: A.Z.' }
  ];
  for (const s of intelSpots) {
    const y = world.collision.surfaceAt(s.x, s.z, 4, 0.3) + 0.05;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xc9bfa3, emissive: 0x2a2410, emissiveIntensity: 0.7, roughness: 0.8 }));
    box.position.set(s.x, y, s.z);
    box.rotation.y = Math.random() * 3;
    world.addObject(box);
    world.addInteractable({
      pos: box.position.clone(), radius: 2.2, label: 'COLLECT INTELLIGENCE',
      onUse: (g) => {
        g.mission.addIntel({ id: s.id, title: s.title, body: s.body, era: 'modern' });
        g.hud.showPrompt(s.title.toUpperCase(), 2.2);
        world.group.remove(box);
      }
    });
  }

  // hostages shuffle toward the roof once found
  world.addAnimated((dt) => {
    for (const h of hostages) {
      if (!h.following) continue;
      const target = { x: -6 + (h.id - 2.5) * 0.8, z: -54 };
      const dx = target.x - h.pos.x, dz = target.z - h.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 1) {
        h.pos.x += (dx / d) * 1.1 * dt;
        h.pos.z += (dz / d) * 1.1 * dt;
        h.mesh.rotation.y = Math.atan2(dx, dz);
      }
    }
  });

  mission.hooks.onSpotted = () => {
    game.hud.say({ speaker: 'FANG', en: 'They made us. Going loud.', ar: 'كشفونا. هندخل بالتخبيس.', urgent: true });
  };
  mission.hooks.onUpdate = () => {};
  return { terrain, admin, state, hostages };
}

function spawnHelicopter(game, world, admin) {
  const { buildHelicopter } = window.__SP_HELI__ || {};
  const heli = buildHelicopter ? buildHelicopter() : makeSimpleHeli();
  heli.scale.setScalar(1.1);
  heli.position.set(admin.cx - 60, 30, admin.cz + 40);
  world.addObject(heli);
  const light = new THREE.PointLight(0xff2020, 8, 30, 2);
  light.position.set(0, 1, -4);
  heli.add(light);
  let t = 0;
  const start = heli.position.clone();
  const target = new THREE.Vector3(admin.cx + 1, admin.h + 4.2, admin.cz + 2);
  world.addAnimated((dt) => {
    t += dt;
    const k = Math.min(1, t / 9);
    const e = 1 - Math.pow(1 - k, 3);
    heli.position.lerpVectors(start, target, e);
    heli.position.y += Math.sin(t * 1.4) * 0.18;
    heli.rotation.y = Math.PI * 0.75;
    if (heli.userData.rotor) heli.userData.rotor.rotation.y += dt * 34;
    if (heli.userData.tailRotor) heli.userData.tailRotor.rotation.x += dt * 44;
    light.intensity = 6 + Math.sin(t * 6) * 4;
  });
}

function makeSimpleHeli() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(1, 3.4, 6, 10), MAT.metal(0x3d4438));
  body.rotation.z = Math.PI / 2;
  body.position.y = 2;
  g.add(body);
  const rotor = new THREE.Group();
  rotor.position.y = 3;
  g.add(rotor);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 7), MAT.metal(0x1c1e18));
    b.rotation.y = (i / 4) * Math.PI;
    rotor.add(b);
  }
  g.userData.rotor = rotor;
  return g;
}

/**
 * SHADOW PROTOCOL — CHAPTER 01: THE CROSSING
 * 6 October 1973 · Suez Canal · Col. Taher Abdel-Hakim
 *
 * Playable missions:
 *   1.1 DUST AND RADIO   — staging, movement tutorial, sealed orders
 *   1.2 H-HOUR           — the barrage and the crossing
 *   1.3 THE BRIDGEHEAD   — semi-open trench fight (three strongpoints)
 *   1.4 THE MEN IN THE WIRE — rescue of a cut-off platoon
 *   1.5 AMUN             — the depot, the ledger, the hidden page
 */
import * as THREE from 'three';
import { MAT } from '../engine/materials.js';
import { PALETTE } from '../game/models.js';
import {
  buildSuezTerrain, buildBerm, buildEgyptianStaging, buildTrenchNetwork,
  buildDepotRaid, buildCanalCrossingProps, buildWireMinefield,
  buildBackgroundLife, build1973WeaponRack
} from './lib1973.js';
import { ENEMY_STATE } from '../game/ai.js';

const E = (x, z) => ({ x, y: 0, z });
void E;

// ---------------------------------------------------------------- mission data
export const CHAPTER_01_MISSIONS = [
  {
    id: 'ch01_crossing',
    chapterIndex: 1,
    code: 'OP NISR-3 / 1.1–1.3',
    title: 'The Crossing',
    cardEra: 'EGYPT · 6 OCTOBER 1973 · 13:40',
    cardNum: 'CHAPTER 01',
    subtitle: 'Second Army · Commando Detachment NISR-3<br>Suez Canal — west bank staging',
    synopsis: 'The first hour of the October War. Advance through the breach in the Bar Lev sand berm, hold the bridgehead, and take the trench network before the counterattack.',
    era: '1973',
    loadout: ['akm', 'portsaid', 'rpg7'],
    start: { x: 0, y: 1.2, z: 34 },
    startYaw: Math.PI,
    surface: 'sand',
    hasSquad: true,
    nvg: false,
    intelTotal: 4,
    objectives: [
      { text: 'Report to the detachment commander at the staging line', marker: { x: 0, y: 1, z: 18 } },
      { text: 'Cross the canal under the artillery barrage', marker: { x: 0, y: 0, z: -30 } },
      { text: 'Clear the Bar Lev strongpoint and breach the berm', marker: { x: 0, y: 9, z: -60 } },
      { text: 'Secure the trench network (0/3 strongpoints)' }
    ]
  },
  {
    id: 'ch01_depot',
    chapterIndex: 1,
    code: 'OP NISR-3 / 1.5 — CLASSIFIED',
    title: 'Amun',
    cardEra: 'EGYPT · 9 OCTOBER 1973 · 02:15',
    cardNum: 'CHAPTER 01 · FINALE',
    subtitle: 'Qantara road depot · night<br>Objective: recover diverted convoy — no engagement',
    synopsis: 'A convoy is gone. Taher is sent to a depot where the ammunition should be, and finds a ledger instead. He hides one page inside his helmet and never speaks of it again.',
    era: '1973',
    loadout: ['portsaid', 'akm', 'pistol'],
    start: { x: 0, y: 1.2, z: 6 },
    startYaw: Math.PI,
    surface: 'sand',
    hasSquad: true,
    nvg: false,
    intelTotal: 1,
    objectives: [
      { text: 'Approach the depot without engaging', marker: { x: 0, y: 1, z: 40 } },
      { text: 'Search the sheds for the diverted convoy', marker: { x: 6, y: 1, z: 62 } },
      { text: 'Recover the ledger from the table', marker: { x: 6, y: 1, z: 61 } },
      { text: 'Hide the page and report the convoy destroyed', marker: { x: 0, y: 1, z: 6 } }
    ]
  }
];

// ---------------------------------------------------------------- builders
export function buildCrossingMission(game, world) {
  const terrain = buildSuezTerrain(world);
  buildBerm(world, terrain);
  buildEgyptianStaging(world, terrain);
  buildTrenchNetwork(world, terrain);
  buildCanalCrossingProps(world, terrain);
  buildBackgroundLife(world, terrain);
  build1973WeaponRack(world, terrain);
  buildCrossingPickups(world, terrain);

  // ------------------------------------------------ squad
  world.friendSpawns.push(
    { callsign: 'FANG', nameEn: 'Lt. Karim El-Sayed', nameAr: 'كريم السيد', role: 'marksman', slot: 0, pos: { x: -2.2, y: 0, z: 31 }, era: '1973', palette: PALETTE.egypt1973, weapon: 'enemy_ak' },
    { callsign: 'JACKAL', nameEn: 'Sgt. Hoda Mansour', nameAr: 'هدى منصور', role: 'engineer', slot: 1, pos: { x: 2.2, y: 0, z: 31 }, era: '1973', palette: PALETTE.egypt1973, weapon: 'enemy_ak' },
    { callsign: 'MOUSE', nameEn: 'Sgt. Adel Farhan', nameAr: 'عادل فرحان', role: 'comms', slot: 2, pos: { x: 0, y: 0, z: 33 }, era: '1973', palette: PALETTE.egypt1973, weapon: 'enemy_ak', radio: true }
  );

  // ------------------------------------------------ enemies
  // berm strongpoint defenders (the first fight)
  for (let i = 0; i < 7; i++) {
    const x = -10 + i * 3.4;
    world.addEnemy({
      pos: { x, y: terrain.ground(x, -60) || 8, z: -60 + (Math.random() - 0.5) * 3 },
      yaw: 0.6,
      era: '1973',
      role: i === 0 ? 'officer' : 'rifleman',
      palette: PALETTE.israeli1973,
      post: true,
      weapon: 'enemy_ak'
    });
  }
  // trench network defenders
  for (let i = 0; i < 14; i++) {
    const x = -70 + i * 10 + (Math.random() - 0.5) * 4;
    const z = -44 + (Math.random() - 0.5) * 6;
    world.addEnemy({
      pos: { x, y: 0.05, z },
      yaw: Math.PI,
      era: '1973',
      role: i % 5 === 0 ? 'officer' : 'rifleman',
      palette: PALETTE.israeli1973,
      weapon: 'enemy_ak'
    });
  }
  // patrols on the west side (pre-contact tension)
  world.addEnemy({
    pos: { x: -34, y: 0, z: -8 }, yaw: 0, era: '1973', palette: PALETTE.israeli1973,
    patrol: [{ x: -34, z: -8 }, { x: -20, z: -12 }, { x: -30, z: -20 }], weapon: 'enemy_ak'
  });
  world.addEnemy({
    pos: { x: 40, y: 0, z: -14 }, yaw: 0, era: '1973', palette: PALETTE.israeli1973,
    patrol: [{ x: 40, z: -14 }, { x: 52, z: -6 }, { x: 38, z: 2 }], weapon: 'enemy_ak'
  });

  // intercept ground spawns
  for (const s of world.enemySpawns) {
    s.pos.y = world.collision.surfaceAt(s.pos.x, s.pos.z, 20, 0.3) + 0.02;
  }

  const state = {
    talkedCommander: false,
    crossed: false,
    strongpoints: new Set(),
    crossedH: false,
    reachedTrench: false
  };
  const mission = game.mission;

  // ------------------------------------------------ scripted beats
  world.addTrigger('briefing', { x: -1, y: 1, z: 20 }, 4.2, () => {
    state.talkedCommander = true;
    mission.completeObjective(0);
    game.hud.say({
      speaker: 'قائد الكتيبة',
      en: 'NISR-3, you are four minutes out. The barrage lifts at fourteen hundred exactly. Do not be early — the staff will have your commission.',
      ar: 'ناصر ثلاثة، فاضل أربع دقايق. التمهيد بيخلص الساعة اتنين بالظبط. متتقدمش قبل كده.',
      urgent: true
    });
    setTimeout(() => game.hud.say({
      speaker: 'TAHER',
      en: 'Understood. My men cross on the barrage, not on the clock.',
      ar: 'مفهوم. رجالي بيعدّوا مع الضرب، مش مع الساعة.'
    }), 5200);
    setTimeout(() => {
      game.hud.say({
        speaker: 'MOUSE',
        en: 'Colonel — sealed packet from the staff. The third line is blacked out.',
        ar: 'يا فندم — ظرف مقفول من الرئاسة. السطر التالت مطموس.'
      });
      game.hud.feed('FIELD DOCUMENT — SEALED STAFF ORDERS', '');
      mission.addIntel({ id: 'doc1973_orders', title: 'Sealed staff orders', era: '1973', body: 'Paragraph 3 is redacted. Handwritten in the margin: "deliverable to be confirmed on site — A.Z."' });
    }, 11000);
    setTimeout(() => {
      game.hud.say({
        speaker: 'TAHER',
        en: 'Zidan. That is the second time this week I have been handed an order with a hole in it.',
        ar: 'زيدان. دي تاني مرة الأسبوع ده أوصلني أمر فيه فتحة.'
      });
    }, 16000);
    setTimeout(() => mission.checkpoint(), 2000);
  });

  world.addTrigger('staging-line', { x: 0, y: 1, z: 12 }, 6, () => {
    game.hud.say({
      speaker: 'MOUSE',
      en: 'Ninety seconds. Boats are in the water. I will keep the net open — shout if you need the mortars.',
      ar: 'تسعين ثانية. القوارض في الماية. الشبكة مفتوحة — نادي لو محتاج المورتر.'
    });
  });

  // H-HOUR: the artillery barrage
  world.addTrigger('hhour', { x: 0, y: 1, z: 2 }, 7, () => {
    if (state.crossedH) return;
    state.crossedH = true;
    game.audio.explosion({ x: 0, y: 4, z: -62 });
    game.renderer.addShake(0.5);
    game.audio.setTension(0.85);
    game.hud.showPrompt('13:59 — PREPARATORY FIRE', 3);
    let n = 0;
    const interval = setInterval(() => {
      n++;
      const x = (Math.random() - 0.5) * 160;
      const z = -62 + (Math.random() - 0.5) * 16;
      const y = world.collision.surfaceAt(x, z, 30) || 8;
      const p = new THREE.Vector3(x, y + 0.5, z);
      game.world.spawnParticles({ pos: p, count: 22, color: 0xffb050, size: 0.42, speed: 9, life: 0.8, additive: true });
      game.world.spawnParticles({ pos: p, count: 18, color: 0x8a7f68, size: 0.5, speed: 5, life: 3.6, gravity: -1.2 });
      game.audio.explosion(p);
      game.renderer.addShake(0.09);
      if (n > 26) clearInterval(interval);
    }, 220);
    setTimeout(() => {
      game.hud.say({
        speaker: 'TAHER',
        en: 'That is our cover. Boats — go, go! Squad, on me!',
        ar: 'ده غطاونا. القوارب — يلا، يلا! الفريق معايا!'
      });
      mission.completeObjective(1);
      mission.checkpoint({ x: 0, y: 1, z: 2 }, Math.PI);
    }, 5200);
  });

  // bridgehead objective hooks
  const strongpointPositions = [-48, 0, 48];
  for (const sx of strongpointPositions) {
    world.addTrigger(`sp_${sx}`, { x: sx, y: 9, z: -58 }, 16, () => {
      if (state.strongpoints.has(sx)) return;
      const near = game.ai.enemies.filter((e) => !e.dead &&
        Math.hypot(e.pos.x - sx, e.pos.z + 58) < 18).length;
      if (near === 0) {
        state.strongpoints.add(sx);
        game.hud.feed(`STRONGPOINT ${state.strongpoints.size}/3 SECURED`, '');
        game.audio.objective();
        // each strongpoint grants a support
        if (state.strongpoints.size === 1) {
          game.squadAccuracyBonus = 0.12;
          game.hud.say({ speaker: 'JACKAL', en: 'Ammunition cache — resupplying the squad. We can hold.', ar: 'مخزن ذخيرة — بزوّد الفريق. نقدر نصمد.' });
          game.player.addGrenade();
        }
        if (state.strongpoints.size === 2) {
          game.hud.say({ speaker: 'MOUSE', en: 'Mortar net is up. Say the word and I will drop it on the berm.', ar: 'شبكة المورتر جاهزة. قول وأنا برمي على الساتر.' });
          game.player.addGrenade();
        }
        if (state.strongpoints.size === 3) {
          game.hud.say({ speaker: 'TAHER', en: 'Bridgehead is ours. Hold it. Nobody crosses back today.', ar: 'الرأس عندنا. حافظوا عليها. محدش هيرجع النهاردة.' });
          mission.completeObjective(3);
          mission.checkpoint({ x: sx, y: 9, z: -54 }, Math.PI);
          // counterattack wave
          spawnCounterattack(game, world);
        } else {
          mission.checkpoint();
        }
      }
    });
  }

  mission.hooks.onKill = (enemy, headshot) => {
    void headshot;
    if (state.strongpoints.size < 3) {
      // recompute strongpoints
      for (const sx of strongpointPositions) {
        if (state.strongpoints.has(sx)) continue;
        const alive = game.ai.enemies.filter((e) => !e.dead && Math.hypot(e.pos.x - sx, e.pos.z + 58) < 18);
        if (!alive.length) {
          // let the trigger fire on next frame by nudging the player check
          const t = world.triggers.find((tr) => tr.id === `sp_${sx}`);
          if (t) { t.fired = false; }
        }
      }
    }
    void enemy;
  };

  mission.hooks.onSpotted = () => {
    game.hud.say({
      speaker: 'FANG',
      en: 'Contact front! They are in the berm — get down!',
      ar: 'تماس من قدام! في الساتر — انبطحوا!',
      urgent: true
    });
  };

  mission.hooks.onSquadDown = () => { game.audio.setTension(1); };

  // ambient battlefield audio cue
  world.addTrigger('war-sound', { x: 0, y: 1, z: 40 }, 200, () => {
    game.mission.checkpoint();
  }, false);

  mission.hooks.onUpdate = () => {
    game.hud.setSquad(game.ai.squad);
  };

  mission.darknessAt = 1e9;
  return { terrain, state };
}

function spawnCounterattack(game, world) {
  // the 9 October counterattack pushes in from the east
  let n = 0;
  const interval = setInterval(() => {
    n++;
    for (let k = 0; k < 3; k++) {
      const x = -66 + Math.random() * 132;
      const z = -96 + Math.random() * 10;
      game.ai.spawnEnemies([{
        pos: { x, y: 0.05, z },
        yaw: 0,
        era: '1973',
        role: n % 3 === 0 ? 'officer' : 'rifleman',
        palette: PALETTE.israeli1973,
        weapon: 'enemy_ak'
      }]);
      const e = game.ai.enemies[game.ai.enemies.length - 1];
      e.state = ENEMY_STATE.COMBAT;
      e.alerted = true;
      e.awareness = 1;
      e.lastSeenPos.copy(game.player.pos);
    }
    game.hud.feed('COUNTERATTACK — HOLD THE BRIDGEHEAD', 'kill');
    game.audio.setTension(1);
    if (n > 3) clearInterval(interval);
  }, 9000);
  void world;
}

function buildCrossingPickups(world, terrain) {
  const addIntel = (id, x, z, y, title, body, label) => {
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.05, 0.26),
      new THREE.MeshStandardMaterial({ color: 0xd8cfae, roughness: 0.9, emissive: 0x3a2e14, emissiveIntensity: 0.6 })
    );
    marker.position.set(x, y, z);
    marker.rotation.y = Math.random() * 3;
    world.addObject(marker);
    world.addInteractable({
      pos: marker.position.clone(),
      radius: 2.2,
      label: label || 'READ DOCUMENT',
      onUse: (game) => {
        game.mission.addIntel({ id, title, body, era: '1973' });
        game.hud.showPrompt(title.toUpperCase(), 2.2);
        world.group.remove(marker);
      }
    });
  };
  const g = (x, z) => terrain.ground(x, z);
  addIntel('doc1973_map', -24, 26, g(-24, 26) + 0.7, 'Crossing map, 2nd Army',
    'Hand-annotated. A single line drawn east of the canal, terminating at a depot symbol. No label.');
  addIntel('doc1973_id', 22, 30, g(22, 30) + 0.4, 'Identity disc of an unknown officer',
    'Egyptian army disc, 1969 issue, name filed off. Found in the staging area before the assault.');
  addIntel('doc1973_letter', -44, -20, g(-44, -20) + 0.5, 'Unsigned letter',
    'Three lines of Arabic. "The convoy will move after dark. If it is not at Qantara by dawn, we were never there."');
  addIntel('doc1973_radio', 44, -30, g(44, -30) + 0.05, 'Israeli radio order — captured',
    'Order to abandon strongpoint 4 and consolidate at the orchard. The signature block is legible. Yours is not.');
}

// ---------------------------------------------------------------- depot mission
export function buildDepotMission(game, world) {
  const terrain = buildSuezTerrain(world);
  buildDepotRaid(world, terrain);
  buildBackgroundLife(world, terrain);
  buildWireMinefield(world, terrain);

  // a small escort of two soldiers who wait at the vehicles
  world.friendSpawns.push(
    { callsign: 'MOUSE', nameEn: 'Sgt. Adel Farhan', nameAr: 'عادل فرحان', role: 'comms', slot: 0, pos: { x: -2, y: 0, z: 2 }, era: '1973', palette: PALETTE.egypt1973, weapon: 'enemy_ak', radio: true },
    { callsign: 'JACKAL', nameEn: 'Sgt. Hoda Mansour', nameAr: 'هدى منصور', role: 'engineer', slot: 1, pos: { x: 2, y: 0, z: 2 }, era: '1973', palette: PALETTE.egypt1973, weapon: 'enemy_ak' }
  );

  // two looters / deserters, not a military force — the reveal
  for (const p of [{ x: 6, z: 48 }, { x: -10, z: 54 }]) {
    world.addEnemy({
      pos: { x: p.x, y: 0, z: p.z }, yaw: Math.PI, era: '1973',
      palette: PALETTE.egypt1973, weapon: 'enemy_ak', role: 'rifleman'
    });
  }
  for (const s of world.enemySpawns) s.pos.y = world.collision.surfaceAt(s.pos.x, s.pos.z, 20, 0.3) + 0.02;

  const mission = game.mission;
  const state = { searched: 0, hasLedger: false };

  world.addTrigger('drive', { x: 0, y: 1, z: 20 }, 8, () => {
    game.hud.say({
      speaker: 'MOUSE',
      en: 'Two kilometres. No lights, no radio. Colonel — there is nobody here. A convoy of nine trucks does not evaporate.',
      ar: 'كيلومترين. مفيش نور، مفيش راديو. يا فندم — مفيش حد هنا. قافلة تسع عربيات مش بتختفي.'
    });
    setTimeout(() => game.hud.say({
      speaker: 'TAHER',
      en: 'Keep the engine running. If I am not back in twenty minutes, you leave without an argument.',
      ar: 'سيب الموتور شغال. لو مرجعتش في عشرين دقيقة، تمشي من غير كلام.'
    }), 6200);
  });

  world.addTrigger('shed-a', { x: -18, y: 1, z: 62 }, 6.5, () => {
    if (state.searched & 1) return;
    state.searched |= 1;
    game.hud.say({ speaker: 'JACKAL', en: 'Empty crates. Straw. The good ammunition is gone and the boxes are still here. Someone needed it small enough to carry.', ar: 'صناديق فاضية. قش. الذخيرة الحلوة مشيت والصناديق لسه هنا. حد كان محتاجها بحجم يتشال.' });
    mission.checkpoint();
  });
  world.addTrigger('shed-b', { x: -6, y: 1, z: 62 }, 6.5, () => {
    if (state.searched & 2) return;
    state.searched |= 2;
    game.hud.say({ speaker: 'MOUSE', en: 'Medical stores, stamped for the crossing. Someone signed them out three days ago. Signature is a block — A. ZIDAN.', ar: 'مستلزمات طبية، مختومة للعبور. حد صرفها قبل تلات أيام. التوقيع حروف — أ. زيدان.' });
  });
  world.addTrigger('shed-c', { x: 6, y: 1, z: 62 }, 7.5, () => {
    if (state.searched & 4) return;
    state.searched |= 4;
    mission.completeObjective(1);
    game.hud.say({ speaker: 'TAHER', en: 'There. On the table. That is not a manifest. That is a ledger.', ar: 'هناك. على الطربيزة. ده مش بيان. ده دفتر.' });
    mission.checkpoint();
  });

  // the ledger interaction (placed by the builder)
  const ledger = world.props.get('ledger');
  if (ledger) {
    world.addInteractable({
      pos: ledger.mesh.position.clone(),
      radius: 2.6,
      label: 'OPEN THE LEDGER',
      onUse: (g) => {
        state.hasLedger = true;
        mission.completeObjective(2);
        g.audio.setTension(0.35);
        g.hud.feed('THE BLACK LEDGER — RECOVERED', '');
        g.hud.say({
          speaker: 'TAHER',
          en: 'Fourteen names. Ammunition, morphine, diesel, tyres. And a page with my own staff captain on it.',
          ar: 'أربعتاشر اسم. ذخيرة، مورفين، سولار، كاوتش. وصفحة فيها اسم ضابط في الركن بتاعي.'
        });
        setTimeout(() => {
          g.hud.say({
            speaker: 'TAHER',
            en: 'If this goes up the chain, it will disappear — and every man on that page will walk. If I keep it, I am carrying a crime.',
            ar: 'لو الورقة دي طلعت القيادة، هتختفي — وكل راجل على الصفحة دي هيمشي. لو سبتها معايا، أنا شايل جريمة.'
          });
        }, 6800);
        setTimeout(() => {
          g.hud.say({
            speaker: 'TAHER',
            en: 'One page. That is all I take. The rest gets burned with the convoy.',
            ar: 'صفحة واحدة. ده كل اللي هاخده. الباقي يتحرق مع القافلة.'
          });
          g.hud.showPrompt('THE PAGE IS IN YOUR HELMET LINER', 3.4);
          g.mission.addIntel({
            id: 'ledger_page', title: 'Ledger page — Operation Amun',
            era: '1973', body: 'Column of names, including A. ZIDAN, staff captain, logistics. Total diverted: 11 trucks, 40 tonnes. Hidden in a helmet liner for 41 years.'
          });
          g.save.setFlag('LEDGER_COPY', true);
          g.mission.checkpoint();
        }, 13600);
      }
    });
  }

  world.addTrigger('return', { x: 0, y: 1, z: 12 }, 7, () => {
    if (!state.hasLedger) return;
    mission.completeObjective(3);
    game.hud.say({
      speaker: 'TAHER',
      en: 'Report to battalion: convoy located and destroyed. No survivors. No documents recovered.',
      ar: 'بلغ الكتيبة: القافلة اتلقت واتدمّرت. مفيش ناجين. مفيش ورق اترجع.'
    });
    setTimeout(() => {
      game.hud.say({
        speaker: 'MOUSE',
        en: '...Understood, Colonel.',
        ar: '...مفهوم يا فندم.',
        voice: false
      });
    }, 6200);
  });

  mission.darknessAt = 0;
  world.addAnimated(() => {});
  return { terrain, state };
}

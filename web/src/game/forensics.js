/**
 * SHADOW PROTOCOL — Document forensics
 *
 * The Chapter 03 commitment: prove the Box 07 file was edited. This is a real
 * minigame with real logic, kept deliberately separate from rendering so it can
 * be verified headlessly (see tools/simtest.mjs).
 *
 * How it plays
 *  ------------
 * A reclassification record is shown as a table of fields. Some fields were
 * written over: the visible value is newer than the underwriting beneath it.
 * The player moves a UV lamp across the page and clicks the fields whose
 * underwriting contradicts the visible value.
 *
 * Rules
 *  -----
 *  - Every case has `conflicts` doctored fields among `fields`.
 *  - Correct flags reveal the true (older) value and add a finding.
 *  - Wrong flags add a false positive. Three false positives and the case is
 *    COMPROMISED (the operator in the room stops trusting the read), which is a
 *    fail state but never a dead end: the player can retry.
 *  - `revealAll()` exists for accessibility and for automated tests; it is not
 *    wired to a gameplay shortcut.
 */

export const FORENSIC_STATE = {
  IDLE: 'idle',
  ACTIVE: 'active',
  PROVEN: 'proven',
  COMPROMISED: 'compromised'
};

const FALSE_POSITIVE_LIMIT = 3;

/**
 * Field archetypes for a 1979-era Egyptian reclassification record.
 * Each includes the "clean" value and one or more plausible overwritten values.
 */
const FIELD_ARCHETYPES = [
  {
    key: 'date_opened',
    label: 'DATE OPENED',
    labelAr: 'تاريخ الفتح',
    clean: '12 MAR 1979',
    forged: ['04 NOV 1973', '19 OCT 1973', '02 JAN 1974']
  },
  {
    key: 'authority',
    label: 'AUTHORITY',
    labelAr: 'الجهة المختصة',
    clean: 'DIRECTORATE 7 / AMETHYST',
    forged: ['SECOND ARMY / NISR-3', 'FIELD DETACHMENT 3', 'QANTARA LOGISTICS']
  },
  {
    key: 'classification',
    label: 'CLASSIFICATION',
    labelAr: 'التصنيف',
    clean: 'LEVEL 2 — INTERNAL',
    forged: ['LEVEL 1 — EYES ONLY', 'LEVEL 3 — OPEN', 'LEVEL 1 — ARCHIVE SEAL']
  },
  {
    key: 'reclassified',
    label: 'LAST RECLASSIFIED',
    labelAr: 'آخر إعادة تصنيف',
    clean: '08 AUG 1991',
    forged: ['06 OCT 1973', '14 OCT 1973', '22 SEP 1979']
  },
  {
    key: 'custodian',
    label: 'CUSTODIAN',
    labelAr: 'العهدة',
    clean: 'F. NAGUIB',
    forged: ['T. ABDEL-HAKIM', 'A. ZIDAN', 'UNASSIGNED']
  },
  {
    key: 'location',
    label: 'STORAGE',
    labelAr: 'موقع الحفظ',
    clean: 'ARCHIVE FLOOR — WING B',
    forged: ['QANTARA ROAD DEPOT', 'FIELD SAFE — SUEZ', 'DIRECTORATE VAULT']
  },
  {
    key: 'quantity',
    label: 'ITEMS LOGGED',
    labelAr: 'عدد المفردات',
    clean: '014',
    forged: ['002', '007', '027']
  },
  {
    key: 'signature',
    label: 'SIGNATURE BLOCK',
    labelAr: 'خانة التوقيع',
    clean: 'F. NAGUIB — ARCHIVIST',
    forged: ['A. ZIDAN — DIRECTOR', 'T. ABDEL-HAKIM — C.O.', 'UNSIGNED']
  },
  {
    key: 'witness',
    label: 'WITNESS',
    labelAr: 'الشاهد',
    clean: '—',
    forged: ['SGT. A. FARHAN', 'LT. K. EL-SAYED', 'CPL. H. MANSOUR']
  },
  {
    key: 'disposition',
    label: 'DISPOSITION',
    labelAr: 'المصير',
    clean: 'RETAINED',
    forged: ['DESTROYED 09 OCT 1973', 'TRANSFERRED', 'SEALED — NO ACCESS']
  }
];

function shuffle(list, rng) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build a playable case.
 * @param {() => number} rng deterministic in tests, Math.random in game
 * @param {{fields?:number, conflicts?:number, title?:string, titleAr?:string}} opts
 */
export function buildForensicCase(rng = Math.random, opts = {}) {
  const fieldCount = Math.max(4, Math.min(opts.fields ?? 7, FIELD_ARCHETYPES.length));
  const conflictCount = Math.max(1, Math.min(opts.conflicts ?? 3, fieldCount - 1));

  const archetypes = shuffle(FIELD_ARCHETYPES, rng).slice(0, fieldCount);
  const doctoredKeys = new Set(shuffle(archetypes.map((a) => a.key), rng).slice(0, conflictCount));

  const fields = archetypes.map((a) => {
    const doctored = doctoredKeys.has(a.key);
    // The visible record always reads as the *clean* value: that is what makes
    // the doctoring invisible until the lamp picks up the ink underneath.
    return {
      key: a.key,
      label: a.label,
      labelAr: a.labelAr,
      value: a.clean,
      underwriting: doctored
        ? a.forged[Math.floor(rng() * a.forged.length)]
        : a.clean,
      doctored,
      flagged: false,
      confirmed: false
    };
  });

  return {
    title: opts.title || 'RECLASSIFICATION RECORD — AMETHYST',
    titleAr: opts.titleAr || 'سجل إعادة التصنيف — أميثيست',
    reference: 'BOX 07 / FOLIO 14',
    fields,
    conflicts: conflictCount,
    found: 0,
    falsePositives: 0,
    falsePositiveLimit: FALSE_POSITIVE_LIMIT,
    state: FORENSIC_STATE.IDLE
  };
}

/** Begin the analysis. */
export function beginCase(caseData) {
  caseData.state = FORENSIC_STATE.ACTIVE;
  return caseData;
}

/**
 * Flag a field after inspecting it under UV.
 * @returns {{ok:boolean, reason?:string, field?:object, found?:number, conflicts?:number, complete?:boolean}}
 */
export function inspectField(caseData, key) {
  if (!caseData || caseData.state === FORENSIC_STATE.PROVEN) {
    return { ok: false, reason: 'case-closed' };
  }
  if (caseData.state === FORENSIC_STATE.COMPROMISED) {
    return { ok: false, reason: 'compromised' };
  }

  const field = caseData.fields.find((f) => f.key === key);
  if (!field) return { ok: false, reason: 'unknown-field' };
  if (field.flagged) return { ok: false, reason: 'already-flagged' };

  field.flagged = true;

  if (field.doctored) {
    field.confirmed = true;
    caseData.found += 1;
    if (caseData.found >= caseData.conflicts) {
      caseData.state = FORENSIC_STATE.PROVEN;
      return {
        ok: true, reason: 'proven', field,
        found: caseData.found, conflicts: caseData.conflicts, complete: true
      };
    }
    return { ok: true, reason: 'finding', field, found: caseData.found, conflicts: caseData.conflicts };
  }

  caseData.falsePositives += 1;
  if (caseData.falsePositives >= caseData.falsePositiveLimit) {
    caseData.state = FORENSIC_STATE.COMPROMISED;
    return { ok: false, reason: 'compromised', field, falsePositives: caseData.falsePositives };
  }
  return { ok: false, reason: 'clean-ink', field, falsePositives: caseData.falsePositives };
}

/** Reset a compromised case so the chapter can never dead-end. */
export function retryCase(caseData) {
  for (const f of caseData.fields) {
    f.flagged = false;
    f.confirmed = false;
  }
  caseData.found = 0;
  caseData.falsePositives = 0;
  caseData.state = FORENSIC_STATE.ACTIVE;
  return caseData;
}

/** Accessibility / test path: expose every finding without playing. */
export function revealAll(caseData) {
  for (const f of caseData.fields) {
    if (f.doctored) {
      f.flagged = true;
      f.confirmed = true;
    }
  }
  caseData.found = caseData.conflicts;
  caseData.state = FORENSIC_STATE.PROVEN;
  return caseData;
}

/** The summary the player is shown when the case closes. */
export function summarise(caseData) {
  const proofs = caseData.fields
    .filter((f) => f.confirmed)
    .map((f) => ({ label: f.label, shown: f.value, underneath: f.underwriting }));

  return {
    proven: caseData.state === FORENSIC_STATE.PROVEN,
    findings: proofs,
    headline: proofs.length
      ? `THE FILE WAS EDITED — ${proofs.length} FIELD${proofs.length > 1 ? 'S' : ''} OVERWRITTEN`
      : 'NO EDIT PROVEN',
    headlineAr: proofs.length
      ? `تم تعديل الملف — ${proofs.length} حقول مكتوبة فوق بعضها`
      : 'لم يثبت أي تعديل'
  };
}

export const FORENSIC_ARCHETYPES = FIELD_ARCHETYPES;

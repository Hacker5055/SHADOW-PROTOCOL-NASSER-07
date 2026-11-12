/**
 * SHADOW PROTOCOL — Intelligence manifest
 * The campaign's 21 collectible documents. Ten are placed in the playable
 * vertical slice; the remainder are defined here so Chapters 03–07 have a
 * single canon source. Each entry carries bilingual title/body text.
 *
 * Placement legend:
 *   1.2/1.3/1.5 = Chapter 01 missions; 2.2/2.3 = Chapter 02; 3..7 = future
 */

export const INTELLIGENCE = [
  // ---------------------------------------------------------------- Ch.01
  {
    id: 'doc1973_orders', chapter: 1, mission: '1.1', title: 'Sealed staff orders',
    titleAr: 'أوامر أركان مختومة',
    body: 'Paragraph 3 is redacted. Handwritten in the margin: "deliverable to be confirmed on site — A.Z."',
    bodyAr: 'الفقرة الثالثة مطموسة. بخط اليد في الهامش: «التسليم يُعتمد في الموقع — أ.ز».'
  },
  {
    id: 'doc1973_map', chapter: 1, mission: '1.2', title: 'Crossing map, 2nd Army',
    titleAr: 'خريطة العبور — الجيش الثاني',
    body: 'Hand-annotated. A single line drawn east of the canal, terminating at a depot symbol. No label.',
    bodyAr: 'عليها تعليقات بخط اليد. خط واحد شرق القناة ينتهي عند رمز مخزن. بلا تسمية.'
  },
  {
    id: 'doc1973_id', chapter: 1, mission: '1.2', title: 'Identity disc of an unknown officer',
    titleAr: 'لوحة هوية ضابط مجهول',
    body: 'Egyptian army disc, 1969 issue, name filed off. Found in the staging area before the assault.',
    bodyAr: 'لوحة هوية من إصدار ١٩٦٩، الاسم محكوك. وُجدت في منطقة الحشد قبل الهجوم.'
  },
  {
    id: 'doc1973_letter', chapter: 1, mission: '1.3', title: 'Unsigned letter',
    titleAr: 'خطاب بلا توقيع',
    body: 'Three lines of Arabic. "The convoy will move after dark. If it is not at Qantara by dawn, we were never there."',
    bodyAr: 'ثلاثة سطور بالعربية: «القافلة تتحرك بعد الغروب. لو مش في القنطرة قبل الفجر، يبقى إحنا ما كنّاش هناك».'
  },
  {
    id: 'doc1973_radio', chapter: 1, mission: '1.3', title: 'Israeli radio order — captured',
    titleAr: 'أمر لاسلكي إسرائيلي — غنيمة',
    body: 'Order to abandon strongpoint 4 and consolidate at the orchard. The signature block is legible. Yours is not.',
    bodyAr: 'أمر بالتخلي عن النقطة الحصينة ٤ والتجمع عند البستان. التوقيع واضح. توقيعك أنت لا.'
  },
  {
    id: 'ledger_page', chapter: 1, mission: '1.5', title: 'Ledger page — Operation Amun',
    titleAr: 'صفحة الدفتر — عملية آمون',
    body: 'Column of names, including A. ZIDAN, staff captain, logistics. Total diverted: 11 trucks, 40 tonnes. Hidden in a helmet liner for 41 years.',
    bodyAr: 'عمود أسماء، من بينها أ. زيدان، نقيب أركان، إمداد. إجمالي المحوَّل: ١١ عربة، ٤٠ طنًا. مخبأة في بطانة خوذة ٤١ سنة.'
  },
  // ---------------------------------------------------------------- Ch.02
  {
    id: 'box07_scan', chapter: 2, mission: '2.3', title: 'ARCHIVE BOX 07 — OPERATION AMUN',
    titleAr: 'صندوق الأرشيف ٠٧ — عملية آمون',
    body: 'Scan of a 1973 military intelligence annex file. Cover marked 07. Margin note in a hand Nasser recognises: "deliverable to be confirmed on site — T.A.H." His grandfather\'s initials.',
    bodyAr: 'مسح لملف ملحق مخابرات حربية من ١٩٧٣. الغلاف مكتوب عليه ٠٧. ملاحظة هامش بخط يعرفه ناصر: «التسليم يُعتمد في الموقع — ط.ع.ح». أحرف جده.'
  },
  {
    id: 'nkg_orders', chapter: 2, mission: '2.2', title: 'QRF movement order',
    titleAr: 'أمر تحرك قوة الرد',
    body: 'Hand-written. "If the Egyptians come, do not let them reach the third floor. The hard drive is worth more than the engineers."',
    bodyAr: 'بخط اليد: «لو المصريين جو، متسيبوهمش يوصلوا الدور التالت. الهارد أغلى من المهندسين».'
  },
  {
    id: 'nkg_roster', chapter: 2, mission: '2.2', title: 'Guard shift roster',
    titleAr: 'جدول ورديات الحراسة',
    body: 'Twelve names, four of them Korean, eight Egyptian. Eight of our own nationals guarding a holding site.',
    bodyAr: 'اتناشر اسم، أربعة كوريين وتمانية مصريين. تمانية من ولاد بلدنا بيحرسوا موقع احتجاز.'
  },
  {
    id: 'nkg_photo', chapter: 2, mission: '2.3', title: 'Photograph, 2019',
    titleAr: 'صورة فوتوغرافية، ٢٠١٩',
    body: 'Six engineers with a recovered drone. In the background: a man in a civilian coat with a Directorate visitor badge. The face is turned away.',
    bodyAr: 'ستة مهندسين مع طيارة مسيّرة مستعادة. في الخلفية: رجل ببالطو مدني يحمل شارة زائر من الرئاسة. وجهه مُدار بعيدًا.'
  },
  {
    id: 'nkg_ledgercopy', chapter: 2, mission: '2.3', title: 'Third-country transfer docket',
    titleAr: 'محضر تحويل لدولة ثالثة',
    body: 'A manifest for "archival material" — one crate, 4 kg, routed Vienna → Alexandria. Signed with a block: A.Z.',
    bodyAr: 'بيان لـ«مواد أرشيفية» — صندوق واحد، ٤ كجم، خط فيينا ← الإسكندرية. موقّع بحروف: أ.ز.'
  },
  {
    id: 'qrf_roster', chapter: 2, mission: '2.3', title: 'QRF roster (administrator\'s desk)',
    titleAr: 'كشف قوة الرد',
    body: '24 personnel. Two technicals, one APC. Reaction time from alarm to roof: 4 minutes.',
    bodyAr: '٢٤ فردًا. عربيتان مسلحتان، وناقلة جنود. زمن الرد من الإنذار للسطح: ٤ دقائق.'
  },
  // ---------------------------------------------------------------- Ch.03–07
  {
    id: 'arch_1974', chapter: 3, mission: '3.1', title: 'Reclassification slip, 1974',
    titleAr: 'ورقة إعادة تصنيف، ١٩٧٤',
    body: 'Box 07 reclassified from SECRET to "administratively closed". Signature block: A. ZIDAN.',
    bodyAr: 'الصندوق ٠٧ أُعيد تصنيفه من «سري» إلى «مغلق إداريًا». التوقيع: أ. زيدان.'
  },
  {
    id: 'arch_1985', chapter: 3, mission: '3.1', title: 'Reclassification slip, 1985',
    titleAr: 'ورقة إعادة تصنيف، ١٩٨٥',
    body: 'Same signature. Same eleven-year interval. A third slip exists for 1996.',
    bodyAr: 'نفس التوقيع. نفس الفاصل الزمني — أحد عشر عامًا. توجد ورقة ثالثة لسنة ١٩٩٦.'
  },
  {
    id: 'forensics_report', chapter: 3, mission: '3.4', title: 'Ink analysis — archive floor',
    titleAr: 'تحليل حبر — أرضية الأرشيف',
    body: 'Five altered dates. One hand. The alteration instrument is a 1974 German pen not issued to Egyptian staff officers.',
    bodyAr: 'خمسة تواريخ معدَّلة. خط واحد. أداة التعديل قلم ألماني من ١٩٧٤ لم يُصرف لضباط الأركان المصريين.'
  },
  {
    id: 'vienna_survey', chapter: 4, mission: '4.2', title: 'Surveillance photograph set',
    titleAr: 'مجموعة صور مراقبة',
    body: 'Three couriers, one hotel, one buyer. The buyer\'s tie pin matches a Directorate retirement gift from 2011.',
    bodyAr: 'ثلاثة وسطاء، فندق واحد، مشتري واحد. دبوس ربطة عنق المشتري مطابق لهدية تقاعد من الرئاسة سنة ٢٠١١.'
  },
  {
    id: 'konsul_file', chapter: 4, mission: '4.4', title: 'KONSUL dossier',
    titleAr: 'ملف كونسول',
    body: 'Col. Yuri Vasnetsov, former GRU. Arranges "collection services" for three intelligence agencies. Charges in archival material.',
    bodyAr: 'العقيد يوري فاسنيتسوف، GRU سابقًا. ينظّم «خدمات جمع» لثلاث أجهزة مخابرات. يتقاضى أتعابه مواد أرشيفية.'
  },
  {
    id: 'ambush_signal', chapter: 5, mission: '5.2', title: 'Ambush trigger signal',
    titleAr: 'إشارة بدء الكمين',
    body: 'A single burst on a frequency that only four people in the Directorate use. Three of them are in this safehouse.',
    bodyAr: 'بث واحد على تردد لا يستخدمه في الرئاسة إلا أربعة أشخاص. تلاتة منهم في هذا البيت الآمن.'
  },
  {
    id: 'curator_ledger', chapter: 6, mission: '6.3', title: 'The Curator\'s original ledger',
    titleAr: 'دفتر أمين الأرشيف الأصلي',
    body: 'The 1973 original. Taher\'s name is in it — as the officer who took the money to fund the rescue of the platoon in the wire.',
    bodyAr: 'الأصل من ١٩٧٣. اسم طاهر فيه — الضابط الذي أخذ المال لتمويل إنقاذ الفصيل المحاصر في الأسلاك.'
  },
  {
    id: 'shadow_directive', chapter: 6, mission: '6.4', title: 'Standing directive — SHADOW PROTOCOL',
    titleAr: 'توجيه دائم — بروتوكول الظل',
    body: 'Unsigned, undated. "Where the record conflicts with the institution, correct the record." Renewed every eleven years.',
    bodyAr: 'بلا توقيع وبلا تاريخ: «حيث يتعارض السجل مع المؤسسة، صحّح السجل». يُجدَّد كل أحد عشر عامًا.'
  },
  {
    id: 'box07b', chapter: 7, mission: '7.5', title: 'Box 07-B',
    titleAr: 'صندوق ٠٧-ب',
    body: 'A second box. A second ledger. A second generation of names — filed the year Nasser was born.',
    bodyAr: 'صندوق تانٍ. دفتر تانٍ. جيل تانٍ من الأسماء — أُرشف في السنة اللي اتولد فيها ناصر.'
  }
];

export const INTEL_BY_CHAPTER = INTELLIGENCE.reduce((acc, d) => {
  (acc[d.chapter] ||= []).push(d);
  return acc;
}, {});

export function intelForChapter(ch) { return INTEL_BY_CHAPTER[ch] || []; }
export function totalIntel() { return INTELLIGENCE.length; }

export function findIntel(id) { return INTELLIGENCE.find((d) => d.id === id) || null; }

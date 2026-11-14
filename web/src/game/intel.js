/**
 * SHADOW PROTOCOL — Intelligence manifest
 * The campaign's collectible documents, in one canon list with bilingual
 * title/body text. Every entry here is actually recorded by a level; the ids
 * a level records must exist here, or the dossier, the per-chapter `intelTotal`
 * dots and the "all documents found" coda all drift apart.
 *
 * This list used to be an aspiration, not a manifest: nine of its entries were
 * never recorded anywhere (Chapter 03–07 had no code for them) while six
 * documents that the levels *did* record were missing from it entirely. The
 * player could therefore never reach the 21-document coda that chapter 07's
 * 1973 epilogue is gated on — the gate was unsatisfiable, not merely hard.
 *
 * Placement legend (chapter . beat):
 *   1.1–1.5 = Chapter 01 (1973) · 2.2/2.3 = Chapter 02 · 3.1–3.5 = Chapter 03
 *   4.x = Chapter 04 · 5.x = Chapter 05 · 6.x = Chapter 06 · 7.x = Chapter 07
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
    id: 'doc1973_map', missable: true, chapter: 1, mission: '1.2', title: 'Crossing map, 2nd Army',
    titleAr: 'خريطة العبور — الجيش الثاني',
    body: 'Hand-annotated. A single line drawn east of the canal, terminating at a depot symbol. No label.',
    bodyAr: 'عليها تعليقات بخط اليد. خط واحد شرق القناة ينتهي عند رمز مخزن. بلا تسمية.'
  },
  {
    id: 'doc1973_id', missable: true, chapter: 1, mission: '1.2', title: 'Identity disc of an unknown officer',
    titleAr: 'لوحة هوية ضابط مجهول',
    body: 'Egyptian army disc, 1969 issue, name filed off. Found in the staging area before the assault.',
    bodyAr: 'لوحة هوية من إصدار ١٩٦٩، الاسم محكوك. وُجدت في منطقة الحشد قبل الهجوم.'
  },
  {
    id: 'doc1973_letter', missable: true, chapter: 1, mission: '1.3', title: 'Unsigned letter',
    titleAr: 'خطاب بلا توقيع',
    body: 'Three lines of Arabic. "The convoy will move after dark. If it is not at Qantara by dawn, we were never there."',
    bodyAr: 'ثلاثة سطور بالعربية: «القافلة تتحرك بعد الغروب. لو مش في القنطرة قبل الفجر، يبقى إحنا ما كنّاش هناك».'
  },
  {
    id: 'doc1973_radio', missable: true, chapter: 1, mission: '1.3', title: 'Israeli radio order — captured',
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
    id: 'box07_scan', missable: true, chapter: 2, mission: '2.3', title: 'ARCHIVE BOX 07 — OPERATION AMUN',
    titleAr: 'صندوق الأرشيف ٠٧ — عملية آمون',
    body: 'Scan of a 1973 military intelligence annex file. Cover marked 07. Margin note in a hand Nasser recognises: "deliverable to be confirmed on site — T.A.H." His grandfather\'s initials.',
    bodyAr: 'مسح لملف ملحق مخابرات حربية من ١٩٧٣. الغلاف مكتوب عليه ٠٧. ملاحظة هامش بخط يعرفه ناصر: «التسليم يُعتمد في الموقع — ط.ع.ح». أحرف جده.'
  },
  {
    id: 'nkg_orders', missable: true, chapter: 2, mission: '2.2', title: 'QRF movement order',
    titleAr: 'أمر تحرك قوة الرد',
    body: 'Hand-written. "If the Egyptians come, do not let them reach the third floor. The hard drive is worth more than the engineers."',
    bodyAr: 'بخط اليد: «لو المصريين جو، متسيبوهمش يوصلوا الدور التالت. الهارد أغلى من المهندسين».'
  },
  {
    id: 'nkg_roster', missable: true, chapter: 2, mission: '2.2', title: 'Guard shift roster',
    titleAr: 'جدول ورديات الحراسة',
    body: 'Twelve names, four of them Korean, eight Egyptian. Eight of our own nationals guarding a holding site.',
    bodyAr: 'اتناشر اسم، أربعة كوريين وتمانية مصريين. تمانية من ولاد بلدنا بيحرسوا موقع احتجاز.'
  },
  {
    id: 'nkg_photo', missable: true, chapter: 2, mission: '2.3', title: 'Photograph, 2019',
    titleAr: 'صورة فوتوغرافية، ٢٠١٩',
    body: 'Six engineers with a recovered drone. In the background: a man in a civilian coat with a Directorate visitor badge. The face is turned away.',
    bodyAr: 'ستة مهندسين مع طيارة مسيّرة مستعادة. في الخلفية: رجل ببالطو مدني يحمل شارة زائر من الرئاسة. وجهه مُدار بعيدًا.'
  },
  {
    id: 'nkg_ledgercopy', missable: true, chapter: 2, mission: '2.3', title: 'Third-country transfer docket',
    titleAr: 'محضر تحويل لدولة ثالثة',
    body: 'A manifest for "archival material" — one crate, 4 kg, routed Vienna → Alexandria. Signed with a block: A.Z.',
    bodyAr: 'بيان لـ«مواد أرشيفية» — صندوق واحد، ٤ كجم، خط فيينا ← الإسكندرية. موقّع بحروف: أ.ز.'
  },
  {
    id: 'qrf_roster', missable: true, chapter: 2, mission: '2.3', title: 'QRF roster (administrator\'s desk)',
    titleAr: 'كشف قوة الرد',
    body: '24 personnel. Two technicals, one APC. Reaction time from alarm to roof: 4 minutes.',
    bodyAr: '٢٤ فردًا. عربيتان مسلحتان، وناقلة جنود. زمن الرد من الإنذار للسطح: ٤ دقائق.'
  },
  // ---------------------------------------------------------------- Ch.03–07
  {
    id: 'forensics_report', missable: true, chapter: 3, mission: '3.4', title: 'Ink analysis — archive floor',
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
    id: 'konsul_file', missable: true, chapter: 4, mission: '4.4', title: 'KONSUL dossier',
    titleAr: 'ملف كونسول',
    body: 'Col. Yuri Vasnetsov, former GRU. Arranges "collection services" for three intelligence agencies. Charges in archival material.',
    bodyAr: 'العقيد يوري فاسنيتسوف، GRU سابقًا. ينظّم «خدمات جمع» لثلاث أجهزة مخابرات. يتقاضى أتعابه مواد أرشيفية.'
  },

  // ------------------------------- recorded by levels 03–07, and previously
  // missing from this list: the levels had content the manifest did not know
  // about, which is how the 21-document gate went unsatisfiable.
  {
    id: 'arch_1974', missable: true, chapter: 3, mission: '3.2', title: 'Reclassification slip, 1974',
    titleAr: 'ورقة إعادة تصنيف، ١٩٧٤',
    body: 'Box 07 moved from AMETHYST to the standing collection. Reason given: "routine review". Signed with a block: A. ZIDAN — a captain in 1974.',
    bodyAr: 'الصندوق ٠٧ نُقل من «أميثيست» إلى المجموعة الدائمة. السبب المذكور: «مراجعة روتينية». التوقيع: أ. زيدان — وكان نقيبًا في ١٩٧٤.'
  },
  {
    id: 'arch_1985', missable: true, chapter: 3, mission: '3.2', title: 'Reclassification slip, 1985',
    titleAr: 'ورقة إعادة تصنيف، ١٩٨٥',
    body: 'Box 07 moved again, this time out of the catalogue entirely. Reason: "no surviving operational interest". The same block signature, eleven years older.',
    bodyAr: 'الصندوق ٠٧ نُقل مرة أخرى، وهذه المرة خارج الفهرس كله. السبب: «لا مصلحة عملياتية قائمة». نفس التوقيع، وأحد عشر عامًا أقدم.'
  },
  {
    id: 'ledger_half_two', chapter: 3, mission: '3.5', title: 'Ledger — second half',
    titleAr: 'الدفتر — النصف الثاني',
    body: 'Fourteen names, and a fifteenth written in a different hand: T. ABDEL-HAKIM. The margin note reads "not to be informed".',
    bodyAr: 'أربعة عشر اسمًا، والخامس عشر بخط مختلف: ت. عبد الحكيم. والهامش: «لا يُبلَّغ».'
  },
  {
    id: 'original_page_1973', chapter: 6, mission: '6.4', title: 'The original — 1973 annex, page 4',
    titleAr: 'الأصل — ملحق ١٩٧٣، صفحة ٤',
    body: 'The page folded in Nasser\'s helmet, but with the co-signature field intact: T. ABDEL-HAKIM, and beneath it, in the same hand, "for the platoon. 1.4."',
    bodyAr: 'نفس الصفحة المطوية في خوذة ناصر، لكن خانة التوقيع المشترك سليمة: ت. عبد الحكيم، وتحتها بخطه: «للفصيلة. ١٫٤».'
  },
  {
    id: 'curator_ledger', chapter: 6, mission: '6.3', title: 'The Curator\'s original ledger',
    titleAr: 'دفتر القيّم الأصلي',
    body: 'Every Egyptian military file since 1963 has a duplicate in the bunker, including files that were ordered destroyed. Including the one in Nasser\'s helmet.',
    bodyAr: 'كل ملف عسكري مصري منذ ١٩٦٣ له نسخة في المخبأ، بما فيها ملفات أُمِر بإتلافها. بما فيها الملف الذي في خوذة ناصر.'
  },
  {
    id: 'shadow_directive', chapter: 6, mission: '6.4', title: 'Standing directive — SHADOW PROTOCOL',
    titleAr: 'توجيه دائم — بروتوكول الظل',
    body: 'Shadow Protocol is a records programme, not an arms programme. Its purpose is to control which version of Egyptian military history survives. Renewed every eleven years.',
    bodyAr: 'بروتوكول الظل برنامج سجلات، لا برنامج أسلحة. غايته التحكم في أي رواية للتاريخ العسكري المصري تبقى. يُجدَّد كل أحد عشر عامًا.'
  },
  {
    id: 'ch04_cctv_recorder', missable: true, chapter: 4, mission: '4.3', title: 'CCTV recorder — market hall',
    titleAr: 'مسجل الكاميرات — قاعة السوق',
    body: 'Nine days of footage on a drive the size of a matchbox. Six of those days show the same man walking the market hall without ever buying anything, and one of them shows him meeting the couriers.',
    bodyAr: 'تسعة أيام تصوير على قرص بحجم علبة كبريت. ستة منها تُظهر الرجل نفسه يمشي في القاعة دون أن يشتري شيئًا، وواحد منها يُظهره يلتقي الوسطاء.'
  },
  {
    id: 'ch04_journalist_statement', missable: true, chapter: 4, mission: '4.3', title: 'Statement — detained journalist',
    titleAr: 'إفادة — صحفي محتجز',
    body: '"They asked me about a 1973 logistics file, then a 2011 one, then the same question again. They were not interrogating me. They were checking a record."',
    bodyAr: '«سألوني عن ملف لوجستي من ١٩٧٣، ثم عن واحد من ٢٠١١، ثم أعادوا السؤال نفسه. لم يكونوا يحققون معي. كانوا يراجعون سجلًا».'
  },
  {
    id: 'ch04_tap_log', missable: true, chapter: 4, mission: '4.4', title: 'Intercept — escape route',
    titleAr: 'اعتراض — طريق الهروب',
    body: 'A single outbound call to a Danube freight yard, booked for 04:10. If KONSUL runs, that is where he goes.',
    bodyAr: 'مكالمة صادرة واحدة إلى ساحة شحن على الدانوب، محجوزة ٠٤:١٠. لو هرب كونسول، فهو ذاهب إلى هناك.'
  },
  {
    id: 'ch05_konsul_debrief', missable: true, chapter: 5, mission: '5.1', title: 'KONSUL — first debrief',
    titleAr: 'كونسول — أول استجواب',
    body: 'He talks in dates, not names. 1973, then 1979, then a gap of twenty years he refuses to account for. He says the ledger was never about money.',
    bodyAr: 'يتحدث بالتواريخ لا بالأسماء. ١٩٧٣، ثم ١٩٧٩، ثم فجوة عشرين سنة يرفض تفسيرها. يقول إن الدفتر لم يكن يومًا عن المال.'
  },
  {
    id: 'ch05_yard_manifest', missable: true, chapter: 5, mission: '5.4', title: 'Freight manifest — the yard',
    titleAr: 'بيان الشحن — الساحة',
    body: 'The crates were booked to Facility Mizan, Western Desert, consigned to a name that has been dead since 1997. The network is not buying weapons. It is moving paper.',
    bodyAr: 'الصناديق محجوزة إلى منشأة ميزان في الصحراء الغربية، باسم شخص ميت منذ ١٩٩٧. الشبكة لا تشتري سلاحًا. تنقل ورقًا.'
  },
  {
    id: 'ambush_signal', chapter: 5, mission: '5.2', title: 'Ambush trigger signal',
    titleAr: 'إشارة بدء الكمين',
    body: 'A single burst on a frequency that only four people in the Directorate use. Three of them are in this safehouse.',
    bodyAr: 'بث واحد على تردد لا يستخدمه في الرئاسة إلا أربعة أشخاص. تلاتة منهم في هذا البيت الآمن.'
  },
  {
    id: 'ch07_coda_1973', chapter: 7, mission: '7.7', epilogue: true, title: 'Coda — Mansoura, dawn',
    titleAr: 'خاتمة — المنصورة، الفجر',
    body: 'On the back of the 1973 page, under the co-signature, a line nobody had read closely enough: "if this is found, the men at kilometre 41 came home because of it."',
    bodyAr: 'على ظهر صفحة ١٩٧٣، تحت التوقيع المشترك، سطر لم يقرأه أحد بتمعّن كافٍ: «إن وُجد هذا، فرجال الكيلو ٤١ رجعوا بسببه».'
  },
  {
    id: 'ch05_equipment_case', missable: true, chapter: 5, mission: '5.3', title: 'Equipment case — the yard',
    titleAr: 'حقيبة عتاد — الساحة',
    body: 'Two encrypted handsets and a directory in a waterproof bag. One handset has MOUSE\'s callsign scratched into the battery cover, and it is not the handset he carries.',
    bodyAr: 'جهازان مشفران ودليل في كيس مقاوم للماء. على أحد الجهازين نداء «ماوس» محفور في غطاء البطارية، وهو ليس الجهاز الذي يحمله.'
  },
  {
    id: 'ch05_trust_record', missable: true, chapter: 5, mission: '5.3', title: 'Decision — the fourth man',
    titleAr: 'قرار — الرجل الرابع',
    body: 'Four people knew the safehouse. Nasser chose to trust the one in front of him and look for the fourth instead. The first entry in the ledger that he wrote himself.',
    bodyAr: 'أربعة عرفوا البيت الآمن. اختار ناصر أن يثق بالواقف أمامه وأن يبحث عن الرابع. أول سطر في الدفتر كتبه بيده.'
  },
  {
    id: 'ch06_transfer_manifest', chapter: 6, mission: '6.1', title: 'Transfer manifest — bunker mouth',
    titleAr: 'بيان نقل — فم المخبأ',
    body: 'Thirty-one deliveries since March, every one of them paper, none of them weapons. The network has not been arming a war down here. It has been stockpiling a record.',
    bodyAr: 'واحد وثلاثون تسليمًا منذ مارس، كلها ورق، ولا سلاح واحد. الشبكة لم تكن تُسلّح حربًا هنا. كانت تخزّن سجلًا.'
  },
  {
    id: 'ch06_security_log', chapter: 6, mission: '6.2', title: 'Duty board — security ring',
    titleAr: 'لوحة المناوبات — حلقة الأمن',
    body: 'Shift changes chalked onto a slate across six decades. One signature block that has never changed: the same man has been signing this board since before Nasser was born.',
    bodyAr: 'تبديلات مناوبات بالطباشير على لوح عبر ستة عقود. توقيع واحد لم يتغير: الرجل نفسه يوقّع على هذا اللوح قبل أن يُولد ناصر.'
  },
  {
    id: 'ch06_habitat_roll', chapter: 6, mission: '6.4', title: 'Habitat roll — the people below',
    titleAr: 'كشف السكن — الناس تحت',
    body: 'A school register ruled on the back of a 1979 duty roster. Forty-one names, thirty of them children, none of them in any Egyptian census.',
    bodyAr: 'سجل مدرسة على ظهر كشف مناوبات من ١٩٧٩. واحد وأربعون اسمًا، ثلاثون منهم أطفال، ولا أحد منهم في أي تعداد مصري.'
  },
  {
    id: 'ch07_server_inventory', chapter: 7, mission: '7.2', title: 'Server inventory — floor 12',
    titleAr: 'جرد السيرفرات — الدور ١٢',
    body: 'Four hundred and six drives. Eleven carry Egyptian military file references and none of them are encrypted, because the people who own this building have never had to fear a search warrant.',
    bodyAr: 'أربعمائة وستة أقراص. أحد عشر منها تحمل مراجع ملفات عسكرية مصرية، ولا واحد منها مشفّر، لأن أصحاب هذا المبنى لم يخافوا يومًا من مذكرة تفتيش.'
  },
  {
    id: 'ch07_atrium_tenancy', chapter: 7, mission: '7.3', title: 'Tenancy schedule — floor 27',
    titleAr: 'جدول المستأجرين — الدور ٢٧',
    body: 'The atrium is eight storeys of nothing because the owner deducts it as "public realm". The executive level has been let to the same shell company since 2011, registered to a post office box in Alexandria.',
    bodyAr: 'الصالة ثمانية أدوار فراغ لأن المالك يخصمها كـ«مجال عام». الدور التنفيذي مؤجَّر لنفس الشركة الوهمية منذ ٢٠١١، مسجّلة على صندوق بريد في الإسكندرية.'
  },
  {
    id: 'ch07_exec_minutes', chapter: 7, mission: '7.4', title: 'Board minutes — floor 41',
    titleAr: 'محضر مجلس الإدارة — الدور ٤١',
    body: 'Item seven, fifteen consecutive meetings: "Archive status: no change." Somebody has asked the same question about box 07 every quarter for four years, and every quarter the answer was a lie someone typed.',
    bodyAr: 'البند السابع، خمسة عشر اجتماعًا متتاليًا: «حالة الأرشيف: لا تغيير». سأل أحدهم السؤال نفسه عن الصندوق ٠٧ كل ربع سنة لأربع سنوات، وكل ربع كان الجواب كذبة كتبها أحدهم.'
  },
  {
    id: 'ch07_pad_log', chapter: 7, mission: '7.5', title: 'Flight log — helipad',
    titleAr: 'سجل الطيران — مهبط المروحيات',
    body: 'Nine flights this year, always between 03:00 and 05:00, always a charter out of Cairo West. Tonight is the tenth slot. Somebody is expecting to leave.',
    bodyAr: 'تسع رحلات هذا العام، دائمًا بين ٠٣:٠٠ و٠٥:٠٠، ودائمًا رحلة خاصة من غرب القاهرة. الليلة الموعد العاشر. أحدهم ينتظر أن يغادر.'
  },
  {
    id: 'mariam_statement', chapter: 2, mission: '2.2', title: 'Statement — Mariam Fahmy',
    titleAr: 'إفادة — مريم فهمي',
    body: '"They did not want the drone. They wanted the manifest for it. A number on a 1973 annex — they kept saying the same six digits." The drive the engineers carried was a decoy; the paper was the target.',
    bodyAr: '«لم يريدوا الطائرة. أرادوا بيانها. رقم في ملحق ١٩٧٣ — كانوا يكررون نفس الستة أرقام». القرص الذي حمله المهندسون كان طُعمًا؛ الورق كان الهدف.'
  },
  {
    id: 'box07b', chapter: 7, mission: '7.6', epilogue: true, title: 'BOX 07-B',
    titleAr: 'صندوق ٠٧-ب',
    body: 'A second box. A second ledger. A second generation of names — filed the year Nasser was born.',
    bodyAr: 'صندوق ثانٍ. دفتر ثانٍ. جيل ثانٍ من الأسماء — أُرشف في السنة اللي اتولد فيها ناصر.'
  }
];

export const INTEL_BY_CHAPTER = INTELLIGENCE.reduce((acc, d) => {
  (acc[d.chapter] ||= []).push(d);
  return acc;
}, {});

export function intelForChapter(ch) { return INTEL_BY_CHAPTER[ch] || []; }
export function totalIntel() { return INTELLIGENCE.length; }

export function findIntel(id) { return INTELLIGENCE.find((d) => d.id === id) || null; }

/**
 * The documents the 1973 coda requires. Two filters, both of them earned:
 *
 *  - `epilogue` documents are awarded BY the epilogue, so requiring them would
 *    be requiring the player to have already seen the coda.
 *  - `missable` documents sit behind optional objectives, world pickups, or
 *    chapter 05's deliberately over-subscribed recovery window — the one place
 *    the design *guarantees* the player loses something. A gate that includes
 *    them is a gate nobody can pass.
 *
 * What is left is the set a player collects simply by finishing the campaign
 * and reading what the story puts in front of them. That is what "finding
 * everything" can honestly mean.
 */
export const INTELLIGENCE_PRE_CODA = INTELLIGENCE.filter((d) => !d.epilogue && !d.missable);
export function codaRequirement() { return INTELLIGENCE_PRE_CODA.length; }

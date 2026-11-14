إصدار لينكس للتجربة (rc2)

الملف: shadow-protocol-nasser-07-linux-v1.0.0-rc2.tar.gz
الحجم: 2.64 MB
sha256: bacfd8606a0aa3203967ee52070d2c577f9f582942d9fdf6818dfd40bb2d7207

**استخدم rc2، مش rc1.** النسخة الأولى كانت بتفتح على شاشة سودة الظاهر
فقط إنها شاشة — اللعبة كانت شغالة والأخطاء صفر، لكن الكادر كان بيطلع أسود
فعلياً. سببها أربع عيوب متراكمة في مسار الرسم، كلها اتصلحت. تفاصيل كاملة في
الـ commit 520a50c.

طريقة التشغيل:
  tar -xzf shadow-protocol-nasser-07-linux-v1.0.0-rc2.tar.gz
  cd shadow-protocol-nasser-07-linux
  ./play.sh

المتطلبات: Node.js 18+ ومتصفح فيه WebGL 2.

افتح من `./play.sh` بس — فتح `dist/index.html` مباشرة من الملفات بيدي شاشة
سودة حقيقية، لأن المتصفح بيرفض تحميل ملفات الـ 3D من `file://`. صفحة
`index.html` اللي في الجذر بتشرح ده لو حصل.

أوامر إضافية:
  NO_OPEN=1 ./play.sh    يمنع فتح المتصفح تلقائياً
  PORT=7432 ./play.sh    يغيّر البورت (الافتراضي 7431)

البناء:
  cd web && npm run build && node tools/package-linux.mjs

أدوات التحقق (محتاجة متصفح، مش جزء من الحزمة):
  cd web
  node tools/simtest.mjs      منطق اللعبة — 103 اختبار
  node tools/armfilter.mjs    فلتر أيدي الشخص الأول
  node tools/rendercheck.mjs  إقلاع الحزمة الحقيقية
  node tools/playtest.mjs <url>   مشي/ضرب/تعبئة/نظر في متصفح حقيقي
  node tools/shot.mjs <url> <out.png> [menu|game]   لقطة شاشة

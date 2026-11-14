/**
 * Screenshot the running game in headless Chromium.
 *
 * The Node tools (fpview.mjs, rendercheck.mjs) rasterise a single pass and can
 * prove the geometry is right, but they cannot prove what a real browser
 * composites: the post grade, depth ordering, skinned animation and the HUD all
 * only exist here. This sandbox has no GPU, so Chromium falls back to
 * SwiftShader — slow (about one frame per second) but faithful.
 *
 * Requires the bundled AL2023 libraries:
 *   LD_LIBRARY_PATH=/tmp/al2libs/lib node tools/shot.mjs <url> <out.png> [menu|game]
 */
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const url = process.argv[2] || 'http://127.0.0.1:7500/';
const out = process.argv[3] || '/tmp/shot.png';
const mode = process.argv[4] || 'game';

const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  headless: true,
  args: [...chromium.args, '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', '--no-sandbox']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 3500));

if (mode === 'menu') {
  await page.screenshot({ path: out });
  console.log('menu ->', out);
} else {
  await page.evaluate(() => document.querySelector('#main-list .menu-item').click());
  // Soldier.glb takes ~12 s to parse under SwiftShader before the skinned rig
  // replaces the procedural one; poll for it rather than guess a delay.
  let ready = false;
  for (let i = 0; i < 40 && !ready; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    ready = await page.evaluate(() => !!(globalThis.__SP__?.player?.fpArmsReady
                                       && globalThis.__SP__?.player?.weapon?.sourced));
  }
  const st = await page.evaluate(() => {
    const g = globalThis.__SP__, p = g.player;
    return { state: g.state, rig: p.fpView.rigKind, arms: p.fpArmsReady,
             sourced: !!p.weapon.sourced, draws: g.renderer.renderer.info.render.calls };
  });
  console.log('STATE', JSON.stringify(st));
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: out });
  console.log('game ->', out);
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();

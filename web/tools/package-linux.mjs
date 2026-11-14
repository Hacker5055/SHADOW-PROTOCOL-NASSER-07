#!/usr/bin/env node
/**
 * Package the browser slice as a folder you can hand to someone on Linux.
 *
 * WHY NOT A SINGLE HTML FILE
 * --------------------------
 * The obvious "portable" answer is one .html with everything inlined, opened
 * with file://. It does not work here, and the reason is worth recording:
 * GLTFLoader fetches the .glb assets over XMLHttpRequest. Browsers treat every
 * file:// document as an opaque origin, so those requests are blocked and the
 * soldiers, the weapon and the animations all fail to load — the game runs with
 * blockout bodies and no rifle. The assets are also 6 MB, i.e. 8 MB+ of base64.
 *
 * So the deliverable is a folder:
 *
 *   shadow-protocol-nasser-07-linux/
 *     dist/        the production build (relative paths)
 *     play.sh      starts a loopback server and opens your browser
 *     serve.mjs    ~100-line static server, no dependencies
 *     index.html   explains the situation if opened directly
 *     README.txt   plain-language instructions
 *
 *   node tools/package-linux.mjs [outDir]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAME = 'shadow-protocol-nasser-07-linux';
const OUT = path.resolve(process.argv[2] || path.join(ROOT, NAME));
const DIST = path.join(ROOT, 'dist');

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('No build found. Run `npm run build` first.');
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(DIST, path.join(OUT, 'dist'), { recursive: true });

function write(name, text, mode = 0o644) {
  const p = path.join(OUT, name);
  fs.writeFileSync(p, text);
  fs.chmodSync(p, mode);
}

// ---------------------------------------------------------------- serve.mjs
write('serve.mjs', String.raw`#!/usr/bin/env node
/**
 * Loopback static server for SHADOW PROTOCOL.
 *
 * A web game that loads .glb files needs a real http:// origin. This exists so
 * the game can be played from a folder with nothing installed but Node.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, 'dist');
const PORT = Number(process.env.PORT || 7431);
const ADDRESS = 'http://127.0.0.1:' + PORT + '/';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent((req.url || '/').split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, {
    'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-cache'
  });
  fs.createReadStream(file).pipe(res);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error('');
    console.error('  Port ' + PORT + ' is already in use.');
    console.error('  If the game is already running, open: ' + ADDRESS);
    console.error('  Otherwise pick another:  PORT=7432 ./play.sh');
    console.error('');
    process.exit(1);
  }
  throw e;
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  SHADOW PROTOCOL: NASSER 07');
  console.log('  --------------------------');
  console.log('  Playing at  ' + ADDRESS);
  console.log('  Press Ctrl+C to stop.');
  console.log('');
  if (process.env.NO_OPEN !== '1') openBrowser(ADDRESS);
});

function openBrowser(target) {
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'cmd'
    : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', target] : [target];
  const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
  child.on('error', () => {
    console.log('  Could not open a browser automatically. Open ' + target);
  });
  child.unref();
}
`, 0o755);

// ---------------------------------------------------------------- play.sh
write('play.sh', String.raw`#!/usr/bin/env bash
# SHADOW PROTOCOL: NASSER 07 - Linux launcher
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo '  Node.js is required to serve the game (browsers refuse to load'
  echo '  3D assets from a local file:// page).'
  echo ''
  echo '    Debian/Ubuntu : sudo apt install nodejs'
  echo '    Fedora        : sudo dnf install nodejs'
  echo '    Arch          : sudo pacman -S nodejs'
  echo ''
  echo '  Then run ./play.sh again.'
  exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "  Node $NODE_MAJOR is too old; version 18 or newer is required."
  exit 1
fi

exec node serve.mjs
`, 0o755);

// ---------------------------------------------------------------- index.html
write('index.html', String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>SHADOW PROTOCOL: NASSER 07 - launcher</title>
<style>
  html,body{margin:0;height:100%;background:#06080a;color:#c9bfa3;
    font-family:"Bahnschrift","DIN Alternate","Roboto Condensed",system-ui,sans-serif}
  .wrap{max-width:660px;margin:0 auto;padding:11vh 24px}
  h1{font-size:15px;letter-spacing:.4em;color:#e0741f;font-weight:600;margin:0}
  h2{font-size:10px;letter-spacing:.32em;color:#8b8677;font-weight:400;margin:6px 0 30px}
  p{font-size:14px;line-height:1.75}
  code{background:rgba(201,191,163,.1);padding:2px 7px;border-radius:3px;font-size:13px}
  pre{background:#0d1012;border:1px solid rgba(201,191,163,.14);padding:13px 15px;
    font-size:13px;overflow:auto;border-radius:4px;color:#d8cdb2}
  a.btn{display:inline-block;margin-top:6px;padding:11px 22px;background:#e0741f;
    color:#08090a;text-decoration:none;letter-spacing:.22em;font-size:11px;font-weight:700}
  .muted{color:#7d7869;font-size:12.5px;line-height:1.75}
</style>
</head>
<body>
<div class="wrap">
  <h1>SHADOW PROTOCOL</h1>
  <h2>NASSER 07</h2>

  <p><strong>You opened the launcher page directly.</strong> The game is in
  <code>dist/</code>, and it has to be served over <code>http://</code> because
  browsers block 3D asset loading from <code>file://</code> pages. Opening
  <code>dist/index.html</code> directly gives you a black screen and console errors —
  that is the browser refusing, not the game failing.</p>

  <p>Start it from a terminal in this folder:</p>
  <pre>./play.sh</pre>

  <p class="muted">If that says "Permission denied", run
  <code>chmod +x play.sh &amp;&amp; ./play.sh</code>. Needs Node.js 18 or newer.
  It opens your default browser automatically.</p>

  <p>Already running it in another terminal?</p>
  <a class="btn" href="http://127.0.0.1:7431/">Open the game</a>
</div>
</body>
</html>
`);



// ---------------------------------------------------------------- README.txt
write('README.txt', String.raw`SHADOW PROTOCOL: NASSER 07
Playable vertical slice - Linux build
=====================================

KEEP THIS FOLDER TOGETHER. It is not a single file: the game loads its
character and weapon models over http, so it needs the dist/ folder next to
the launcher.


REQUIREMENTS
------------
  * Linux (x86_64 or arm64)
  * Node.js 18 or newer        check with:  node --version
  * A browser with WebGL 2 and hardware acceleration enabled
    (Firefox, Chrome/Chromium, or Edge)

  Need Node?
    Debian / Ubuntu   sudo apt install nodejs
    Fedora            sudo dnf install nodejs
    Arch              sudo pacman -S nodejs


HOW TO PLAY
-----------
  1. Open a terminal in this folder.
  2. Run:      ./play.sh
     Permission denied?      chmod +x play.sh && ./play.sh
  3. Your browser opens at http://127.0.0.1:7431/ and the game starts.
  4. Stop it with Ctrl+C in that terminal.


IF IT DOES NOT WORK
-------------------
"Node.js is required"
    Install Node 18+ and run ./play.sh again.

"The browser opened but the screen is black"
    WebGL 2 is not available in that browser. Test it at
    https://get.webgl.org/webgl2/ . Usual fixes: enable hardware acceleration
    in the browser settings, update the graphics driver, and make sure this is
    not a remote/VM session without GPU passthrough.

    The game shows an on-screen error rather than a silent black screen now,
    so if you see text, read it - it names the cause.

"Port 7431 is already in use"
    It is probably already running: open http://127.0.0.1:7431/
    For another port:        PORT=7432 ./play.sh

play.sh prints the address but no browser opens
    Run it as:  NO_OPEN=1 ./play.sh   and open the address manually.


WHAT IS IN THIS BUILD
---------------------
All seven chapters, the menus, the intelligence archive and the endings.

Honest state of the visuals:
  * The first-person weapon is a real CC0 model (Flat Guns East).
  * Several of the other twelve weapons are still built from primitives.
  * Enemy and squad bodies are blockout geometry, not character models.
  * Everything is stylised low-poly by design; this is a playable prototype,
    not a finished commercial shooter.

The full current state, including what is unfinished, is documented in
docs/03_TECHNICAL_ARCHITECTURE.md in the source repository.


LICENCES
--------
  three.js                        MIT
  Quaternius Ultimate Anim Lib    CC0
  Mixamo Vanguard (Soldier.glb)   Adobe Mixamo asset
  Flat Guns East (akm.glb)        CC0

Full texts are in dist/models/.
`);

// ---------------------------------------------------------------- archive
const archive = path.join(ROOT, NAME + '.tar.gz');
execFileSync('tar', ['-czf', archive, '-C', path.dirname(OUT), path.basename(OUT)]);

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else files.push(p);
  }
})(OUT);

console.log(JSON.stringify({
  outDir: OUT,
  archive,
  archiveMB: +(fs.statSync(archive).size / 1048576).toFixed(2),
  files: files.length,
  totalMB: +(files.reduce((n, f) => n + fs.statSync(f).size, 0) / 1048576).toFixed(2),
  entries: fs.readdirSync(OUT).sort()
}, null, 2));

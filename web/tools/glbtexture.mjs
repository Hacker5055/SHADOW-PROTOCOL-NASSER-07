/**
 * Minimal in-process texture decode for tools/fpview.mjs.
 *
 * GLTFLoader wants a browser Image/ImageBitmap to turn an embedded JPEG into a
 * Texture. Under Node there is neither, so decoded textures come back as a
 * warning and a white material. This decorator hooks the loader, reads the
 * embedded JPEG out of the GLB itself, decodes it with an external `convert`
 * (ImageMagick / GraphicsMagick), and registers the result as a plain
 * { width, height, data } record that the rasteriser samples directly.
 *
 * It is a tool-side concern only: the browser decodes these natively, so none
 * of this ships in the game bundle.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function binAvailable(name) {
  try {
    execFileSync('which', [name], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const DECODER = ['magick', 'convert', 'gm'].find(binAvailable) || null;

/** Extract every embedded image from a .glb into raw RGB, in loader order. */
export function extractGlbTextures(glbPath) {
  if (!DECODER) return null;
  const d = fs.readFileSync(glbPath);
  const magic = d.readUInt32LE(0);
  if (magic !== 0x46546c67) return null;               // 'glTF'
  const total = d.readUInt32LE(8);
  let off = 12;
  let json = null;
  let bin = null;
  while (off < total) {
    const len = d.readUInt32LE(off);
    const type = d.readUInt32LE(off + 4);
    if (type === 0x4e4f534a) json = JSON.parse(d.subarray(off + 8, off + 8 + len).toString('utf8'));
    else if (type === 0x004e4942) bin = off + 8;
    off += 8 + len;
  }
  if (!json || bin == null) return null;

  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'glbtex-'));
  const out = [];
  for (const [i, img] of (json.images || []).entries()) {
    const bv = json.bufferViews[img.bufferView];
    if (!bv) { out.push(null); continue; }
    const start = bin + (bv.byteOffset || 0);
    const bytes = d.subarray(start, start + bv.byteLength);
    const ext = (img.mimeType || 'image/jpeg').includes('png') ? 'png' : 'jpg';
    const src = path.join(tmp, `img${i}.${ext}`);
    const raw = path.join(tmp, `img${i}.rgb`);
    fs.writeFileSync(src, bytes);
    try {
      // -depth 8 rgb:- always emits 3 bytes per pixel, no header guessing.
      const args = DECODER === 'gm'
        ? ['convert', src, '-depth', '8', `rgb:${raw}`]
        : [src, '-depth', '8', `rgb:${raw}`];
      execFileSync(DECODER, args, { stdio: 'ignore' });
      const size = execFileSync(DECODER, DECODER === 'gm'
        ? ['identify', '-format', '%w %h', src]
        : [src, '-format', '%w %h', 'info:'], { encoding: 'utf8' }).trim().split(/\s+/).map(Number);
      const [w, h] = size;
      const data = fs.readFileSync(raw);
      if (w > 0 && h > 0 && data.length >= w * h * 3) {
        out.push({ width: w, height: h, data });
        continue;
      }
    } catch { /* fall through to null */ }
    out.push(null);
  }
  // Which embedded image is the BASE COLOUR? A GLB routinely packs a normal
  // map next to the diffuse (Soldier.glb's image 0 is a bluish normal map), so
  // "the biggest image" is the wrong guess and paints the arms purple.
  let baseColorImage = -1;
  try {
    const mat = (json.materials || []).find((m) => m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorTexture);
    if (mat) {
      const tex = json.textures[mat.pbrMetallicRoughness.baseColorTexture.index];
      if (tex && tex.source != null) baseColorImage = tex.source;
    }
  } catch { /* leave as -1 */ }

  return { images: out, baseColorImage };
}

export const textureDecoderAvailable = !!DECODER;

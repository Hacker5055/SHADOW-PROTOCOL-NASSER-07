/**
 * SHADOW PROTOCOL — Procedural material library
 * All textures are generated at runtime on <canvas> so the project ships with
 * zero external art dependencies. Each material family has a 1973 variant and a
 * modern variant with a deliberately different grade (see §8 of the design doc).
 */
import * as THREE from 'three';

const cache = new Map();

function canvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function noiseFill(ctx, size, base, variance, alpha = 1) {
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const n = (Math.random() - 0.5) * variance;
    img.data[i * 4] = Math.max(0, Math.min(255, base[0] + n));
    img.data[i * 4 + 1] = Math.max(0, Math.min(255, base[1] + n));
    img.data[i * 4 + 2] = Math.max(0, Math.min(255, base[2] + n));
    img.data[i * 4 + 3] = 255 * alpha;
  }
  ctx.putImageData(img, 0, 0);
}

function grain(ctx, size, amount, dark = false) {
  for (let i = 0; i < amount; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const r = Math.random() * 2.5;
    ctx.fillStyle = dark ? `rgba(0,0,0,${Math.random() * 0.35})` : `rgba(255,255,255,${Math.random() * 0.22})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function tex(kind, opts = {}) {
  const key = kind + JSON.stringify(opts);
  if (cache.has(key)) return cache.get(key);

  const size = opts.size || 256;
  const c = canvas(size);
  const ctx = c.getContext('2d');

  switch (kind) {
    case 'sand': {
      noiseFill(ctx, size, [176, 150, 106], 34);
      // wind ripples
      ctx.strokeStyle = 'rgba(120,98,64,0.18)';
      for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        const y = Math.random() * size;
        ctx.moveTo(0, y);
        for (let x = 0; x < size; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.08 + i) * 3);
        ctx.stroke();
      }
      grain(ctx, size, 900, true);
      grain(ctx, size, 700);
      break;
    }
    case 'sandbag': {
      noiseFill(ctx, size, [150, 132, 92], 22);
      // bag seams
      for (let row = 0; row < 6; row++) {
        const y = (row / 6) * size;
        ctx.fillStyle = 'rgba(70,58,38,0.35)';
        ctx.fillRect(0, y, size, 2);
        const off = row % 2 === 0 ? 0 : size / 12;
        for (let col = 0; col < 6; col++) {
          ctx.fillStyle = 'rgba(70,58,38,0.28)';
          ctx.fillRect(off + (col / 6) * size, y, 2, size / 6);
        }
      }
      grain(ctx, size, 1200, true);
      break;
    }
    case 'concrete': {
      noiseFill(ctx, size, [126, 124, 118], 26);
      // form-work seams + stains
      ctx.strokeStyle = 'rgba(60,60,58,0.3)';
      ctx.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, (i / 4) * size);
        ctx.lineTo(size, (i / 4) * size);
        ctx.stroke();
      }
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = `rgba(40,42,40,${0.04 + Math.random() * 0.08})`;
        const w = 10 + Math.random() * 60, h = 30 + Math.random() * 120;
        ctx.fillRect(Math.random() * size, Math.random() * size, w, h);
      }
      grain(ctx, size, 1500, true);
      break;
    }
    case 'metal': {
      noiseFill(ctx, size, [92, 96, 100], 20);
      for (let i = 0; i < 18; i++) {
        ctx.strokeStyle = `rgba(${120 + Math.random() * 40},${70 + Math.random() * 30},40,${0.1 + Math.random() * 0.18})`;
        ctx.lineWidth = 1 + Math.random() * 3;
        ctx.beginPath();
        ctx.moveTo(Math.random() * size, Math.random() * size);
        ctx.lineTo(Math.random() * size, Math.random() * size);
        ctx.stroke();
      }
      // rivets
      for (let y = 12; y < size; y += 28) {
        for (let x = 12; x < size; x += 28) {
          ctx.fillStyle = 'rgba(200,200,205,0.18)';
          ctx.beginPath(); ctx.arc(x, y, 1.8, 0, 6.28); ctx.fill();
          ctx.fillStyle = 'rgba(20,20,22,0.25)';
          ctx.beginPath(); ctx.arc(x + 0.6, y + 0.8, 1.8, 0, 6.28); ctx.fill();
        }
      }
      grain(ctx, size, 900, true);
      break;
    }
    case 'container': {
      noiseFill(ctx, size, opts.color || [110, 90, 70], 18);
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 3;
      for (let x = 0; x < size; x += 14) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
      }
      grain(ctx, size, 1000, true);
      break;
    }
    case 'wood': {
      noiseFill(ctx, size, [112, 82, 52], 20);
      for (let i = 0; i < 26; i++) {
        ctx.strokeStyle = `rgba(${60 + Math.random() * 40},${40 + Math.random() * 30},20,${0.12 + Math.random() * 0.2})`;
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.beginPath();
        const y = Math.random() * size;
        ctx.moveTo(0, y);
        for (let x = 0; x < size; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.03 + i) * 5);
        ctx.stroke();
      }
      grain(ctx, size, 700, true);
      break;
    }
    case 'rust': {
      noiseFill(ctx, size, [120, 74, 44], 30);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(${50 + Math.random() * 40},${28 + Math.random() * 24},${14 + Math.random() * 14},${0.15 + Math.random() * 0.3})`;
        ctx.beginPath(); ctx.arc(Math.random() * size, Math.random() * size, 4 + Math.random() * 22, 0, 6.28); ctx.fill();
      }
      grain(ctx, size, 1400, true);
      break;
    }
    case 'asphalt': {
      noiseFill(ctx, size, [64, 66, 68], 18);
      grain(ctx, size, 3000, false);
      grain(ctx, size, 2200, true);
      break;
    }
    case 'brick': {
      noiseFill(ctx, size, [128, 96, 80], 16);
      const bh = 18, bw = 40;
      for (let y = 0, row = 0; y < size; y += bh, row++) {
        for (let x = (row % 2) * bw * 0.5 - bw; x < size; x += bw) {
          ctx.strokeStyle = 'rgba(48,44,42,0.55)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, bw, bh);
        }
      }
      grain(ctx, size, 900, true);
      break;
    }
    case 'tarmac_water': {
      noiseFill(ctx, size, [26, 44, 52], 12);
      break;
    }
    case 'tent': {
      noiseFill(ctx, size, [116, 116, 92], 18);
      ctx.strokeStyle = 'rgba(80,80,60,0.4)';
      for (let x = 0; x < size; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke(); }
      grain(ctx, size, 700, true);
      break;
    }
    default:
      noiseFill(ctx, size, [128, 128, 128], 20);
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

export const MAT = {
  sand: (rep = 8) => {
    const m = new THREE.MeshStandardMaterial({ map: tex('sand').clone(), roughness: 0.98, metalness: 0, color: 0xffffff });
    m.map.repeat.set(rep, rep); m.map.needsUpdate = true;
    return m;
  },
  sandbag: () => new THREE.MeshStandardMaterial({ map: tex('sandbag'), roughness: 0.95 }),
  concrete: (c = 0xffffff) => new THREE.MeshStandardMaterial({ map: tex('concrete'), roughness: 0.9, color: c }),
  metal: (c = 0xffffff) => new THREE.MeshStandardMaterial({ map: tex('metal'), roughness: 0.55, metalness: 0.6, color: c }),
  container: (c) => new THREE.MeshStandardMaterial({ map: tex('container', { color: c }), roughness: 0.8, metalness: 0.35 }),
  wood: () => new THREE.MeshStandardMaterial({ map: tex('wood'), roughness: 0.9 }),
  rust: () => new THREE.MeshStandardMaterial({ map: tex('rust'), roughness: 0.85, metalness: 0.3 }),
  asphalt: () => new THREE.MeshStandardMaterial({ map: tex('asphalt'), roughness: 0.92 }),
  brick: () => new THREE.MeshStandardMaterial({ map: tex('brick'), roughness: 0.92 }),
  tent: () => new THREE.MeshStandardMaterial({ map: tex('tent'), roughness: 0.96, side: THREE.DoubleSide }),
  water: (c = 0x1d4e5c) => new THREE.MeshStandardMaterial({
    color: c, roughness: 0.12, metalness: 0.5, transparent: true, opacity: 0.86
  }),
  glass: () => new THREE.MeshStandardMaterial({ color: 0x223845, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.55 }),
  emissive: (c, i = 1.5) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.4 }),
  cloth: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, side: THREE.DoubleSide }),
  skin: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 }),
  rubber: () => new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 })
};

export function disposeMaterials() { cache.clear(); }

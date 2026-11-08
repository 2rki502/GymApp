// Generates the PWA / apple-touch icons as PNGs with no dependencies.
// Shapes are drawn with signed-distance functions and 4×4 supersampling.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── SDF shapes (normalised 0..1 space) ──────────────────────────────────────
const roundRect = (px, py, cx, cy, hw, hh, r) => {
  const qx = Math.abs(px - cx) - hw + r;
  const qy = Math.abs(py - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
/** Ring arc from a0→a1 (radians, 0 = up, clockwise) with round caps. */
const arc = (px, py, cx, cy, R, w, a0, a1) => {
  const dx = px - cx;
  const dy = py - cy;
  let a = Math.atan2(dx, -dy);
  if (a < 0) a += Math.PI * 2;
  if (a >= a0 && a <= a1) return Math.abs(Math.hypot(dx, dy) - R) - w;
  const cap = (t) => Math.hypot(px - (cx + Math.sin(t) * R), py - (cy - Math.cos(t) * R)) - w;
  return Math.min(cap(a0), cap(a1));
};

const LIME = [200, 255, 61];
const WHITE = [245, 245, 247];

function render(size, scale) {
  const buf = Buffer.alloc(size * size * 4);
  const SS = 4; // `scale` < 1 shrinks the artwork into the maskable safe zone
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;
          // background: subtle lime glow from the bottom
          const glow = Math.max(0, 1 - Math.hypot(u - 0.5, v - 1.05) / 0.9);
          let c = [8 + 14 * glow * glow, 9 + 20 * glow * glow, 6 + 4 * glow * glow];
          // progress ring (gap top-right)
          const ring = arc(u, v, 0.5, 0.5, 0.31 * scale, 0.045 * scale, Math.PI * 0.42, Math.PI * 2.0);
          if (ring < 0) c = LIME;
          // dumbbell
          const bar = roundRect(u, v, 0.5, 0.5, 0.15 * scale, 0.022 * scale, 0.02 * scale);
          const p1 = roundRect(u, v, 0.5 - 0.125 * scale, 0.5, 0.032 * scale, 0.105 * scale, 0.025 * scale);
          const p2 = roundRect(u, v, 0.5 + 0.125 * scale, 0.5, 0.032 * scale, 0.105 * scale, 0.025 * scale);
          const p3 = roundRect(u, v, 0.5 - 0.19 * scale, 0.5, 0.022 * scale, 0.065 * scale, 0.018 * scale);
          const p4 = roundRect(u, v, 0.5 + 0.19 * scale, 0.5, 0.022 * scale, 0.065 * scale, 0.018 * scale);
          if (Math.min(bar, p1, p2, p3, p4) < 0) c = WHITE;
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const i = (y * size + x) * 4;
      const n = SS * SS;
      buf[i] = r / n;
      buf[i + 1] = g / n;
      buf[i + 2] = b / n;
      buf[i + 3] = 255;
    }
  }
  return png(size, buf);
}

const targets = [
  ['apple-touch-icon.png', 180, 1],
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['icon-maskable-512.png', 512, 0.78],
];
for (const [name, size, scale] of targets) {
  writeFileSync(join(OUT, name), render(size, scale));
  console.log('wrote', name);
}

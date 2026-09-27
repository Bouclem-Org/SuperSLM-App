// Generates assets/icon.png + icon.ico (PNG-in-ICO, Vista+).
// Amber rounded square with a pixel-art "S" — no dependencies, Node zlib only.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const SIZE = 256;
const MARGIN = 18;
const RADIUS = 52;
const AMBER = [0xd7, 0xa8, 0x5c, 0xff];
const DARK = [0x1b, 0x1b, 0x1e, 0xff];
const CLEAR = [0, 0, 0, 0];

const GLYPH = ['01110', '10001', '10000', '01110', '00001', '10001', '01110'];
const CELL = 24;
const GX = (SIZE - GLYPH[0].length * CELL) / 2;
const GY = (SIZE - GLYPH.length * CELL) / 2;

const px = new Uint8Array(SIZE * SIZE * 4);
const set = (x, y, c) => px.set(c, (y * SIZE + x) * 4);

const inRoundRect = (x, y) => {
  if (x < MARGIN || y < MARGIN || x >= SIZE - MARGIN || y >= SIZE - MARGIN) return false;
  const cx = Math.max(MARGIN + RADIUS, Math.min(SIZE - MARGIN - RADIUS, x));
  const cy = Math.max(MARGIN + RADIUS, Math.min(SIZE - MARGIN - RADIUS, y));
  return (x - cx) ** 2 + (y - cy) ** 2 <= RADIUS * RADIUS;
};

const inGlyph = (x, y) => {
  const gx = Math.floor((x - GX) / CELL);
  const gy = Math.floor((y - GY) / CELL);
  return gy >= 0 && gy < GLYPH.length && gx >= 0 && gx < GLYPH[0].length && GLYPH[gy][gx] === '1';
};

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    set(x, y, !inRoundRect(x, y) ? CLEAR : inGlyph(x, y) ? DARK : AMBER);
  }
}

// --- PNG ---
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
};

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  Buffer.from(px.buffer, y * SIZE * 4, SIZE * 4).copy(raw, y * (SIZE * 4 + 1) + 1);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
]);

// --- ICO (PNG payload) ---
const icoHeader = Buffer.from([0, 0, 1, 0, 1, 0]);
const icoEntry = Buffer.alloc(16);
icoEntry[0] = 0; // 256px
icoEntry[1] = 0;
icoEntry.writeUInt16LE(1, 4);
icoEntry.writeUInt16LE(32, 6);
icoEntry.writeUInt32LE(png.length, 8);
icoEntry.writeUInt32LE(22, 12);
const ico = Buffer.concat([icoHeader, icoEntry, png]);

mkdirSync('assets', { recursive: true });
writeFileSync('assets/icon.png', png);
writeFileSync('assets/icon.ico', ico);
console.log(`icon.png ${png.length}b, icon.ico ${ico.length}b`);

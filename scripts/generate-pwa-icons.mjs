import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

const directory = new URL('../client/public/icons/', import.meta.url);
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const indigo = [0x4f, 0x46, 0xe5];
const white = [255, 255, 255];

function pngChunk(type, data) {
  const payload = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  let crc = 0xffffffff;
  for (const byte of payload) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([size, payload, checksum]);
}

function letterC(x, y, start) {
  return x >= start && x < start + 0.2 && y >= 0.35 && y < 0.65
    && (x < start + 0.065 || y < 0.415 || y >= 0.585);
}

function makeIcon(size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // Bits per channel.
  header[9] = 2; // RGB.

  const stride = 1 + size * 3; // Each row starts with PNG's no-filter byte.
  const pixels = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const monogram = letterC(x / size, y / size, 0.275) || letterC(x / size, y / size, 0.525);
      pixels.set(monogram ? white : indigo, y * stride + 1 + 3 * x);
    }
  }

  return Buffer.concat([
    signature,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(pixels)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

await mkdir(directory, { recursive: true });
await Promise.all([180, 192, 512].map((size) =>
  writeFile(new URL(`icon-${size}.png`, directory), makeIcon(size)),
));

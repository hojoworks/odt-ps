/* PNG plumbing, so a generator that has to read one does not carry its own copy
 * of the format. Only what our own assets need: 8-bit, non-interlaced, and the
 * five colour types, all of them landing on one RGBA grid.
 */
import { inflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function decodePng(data) {
  if (!data.subarray(0, 8).equals(SIGNATURE)) { throw new Error("not a PNG"); }
  let at = 8;
  let header = null;
  let palette = null;
  let transparency = null;
  const parts = [];
  while (at < data.length) {
    const length = data.readUInt32BE(at);
    const type = data.toString("ascii", at + 4, at + 8);
    const body = data.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      header = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        depth: body[8],
        colour: body[9],
        interlace: body[12]
      };
    } else if (type === "PLTE") {
      palette = [];
      for (let i = 0; i < length; i += 3) { palette.push([body[i], body[i + 1], body[i + 2], 255]); }
    } else if (type === "tRNS") {
      transparency = body;
    } else if (type === "IDAT") {
      parts.push(body);
    } else if (type === "IEND") {
      break;
    }
    at += 12 + length;
  }
  if (!header || header.depth !== 8 || header.interlace !== 0) {
    throw new Error("unsupported PNG (depth " + (header ? header.depth : "?") + ")");
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[header.colour];
  if (!channels) { throw new Error("unsupported PNG colour type " + header.colour); }

  const raw = inflateSync(Buffer.concat(parts));
  const stride = header.width * channels;
  const pixels = Buffer.alloc(stride * header.height);
  let position = 0;
  for (let y = 0; y < header.height; y++) {
    const filter = raw[position++];
    const row = raw.subarray(position, position + stride);
    position += stride;
    const target = pixels.subarray(y * stride, (y + 1) * stride);
    const above = y ? pixels.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? target[x - channels] : 0;
      const up = above[x];
      const upLeft = x >= channels ? above[x - channels] : 0;
      let value = row[x];
      if (filter === 1) { value += left; }
      else if (filter === 2) { value += up; }
      else if (filter === 3) { value += (left + up) >> 1; }
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
        value += (pa <= pb && pa <= pc) ? left : (pb <= pc ? up : upLeft);
      }
      target[x] = value & 0xff;
    }
  }

  const rgba = Buffer.alloc(header.width * header.height * 4);
  for (let i = 0; i < header.width * header.height; i++) {
    let r, g, b, a = 255;
    if (header.colour === 6) { r = pixels[i * 4]; g = pixels[i * 4 + 1]; b = pixels[i * 4 + 2]; a = pixels[i * 4 + 3]; }
    else if (header.colour === 2) { r = pixels[i * 3]; g = pixels[i * 3 + 1]; b = pixels[i * 3 + 2]; }
    else if (header.colour === 3) {
      const index = pixels[i];
      const entry = palette[index] || [0, 0, 0, 255];
      r = entry[0]; g = entry[1]; b = entry[2];
      a = transparency && index < transparency.length ? transparency[index] : 255;
    } else if (header.colour === 0) { r = g = b = pixels[i]; }
    else { r = g = b = pixels[i * 2]; a = pixels[i * 2 + 1]; }
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a;
  }
  return { width: header.width, height: header.height, pixels: rgba };
}

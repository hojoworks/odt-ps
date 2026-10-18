/* Turn the Apache OpenOffice 1.1 document icons into the 16-colour pixel-art
 * <symbol>s the setup screen draws.
 *
 *   node tools/make-icons.mjs
 *
 * The .ico sources in icons/ooo11/ come from Apache OpenOffice (Apache License
 * 2.0) and keep their provenance in icons/ooo11/README.md and docs/credits.md.
 * This script only rewrites the region of site/index.html between the
 * "ooo11:start" and "ooo11:end" markers, so the rest of the icon set stays
 * hand-drawn.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { decodePng, encodePalettePng } from "./png.mjs";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/* node tools/make-icons.mjs --inspect <png>   shows what a sprite contains */
if (process.argv.includes("--inspect")) {
  const file = process.argv[process.argv.indexOf("--inspect") + 1];
  const image = decodePng(readFileSync(file));
  console.log(file + ": " + image.width + "x" + image.height);
  const corner = (x, y) => {
    const at = (y * image.width + x) * 4;
    return "rgba(" + [image.pixels[at], image.pixels[at + 1], image.pixels[at + 2], image.pixels[at + 3]].join(",") + ")";
  };
  console.log("corners: top-left " + corner(0, 0) + "  top-right " + corner(image.width - 1, 0) +
    "  bottom-left " + corner(0, image.height - 1));
  const background = [image.pixels[0], image.pixels[1], image.pixels[2]];
  const differs = (x, y) => {
    const at = (y * image.width + x) * 4;
    if (image.pixels[at + 3] < 20) { return false; }
    return Math.abs(image.pixels[at] - background[0]) + Math.abs(image.pixels[at + 1] - background[1]) +
      Math.abs(image.pixels[at + 2] - background[2]) > 24;
  };
  console.log("samples: " + [[0, 0], [10, 10], [20, 5], [35, 5], [50, 29], [70, 31]]
    .map((p) => p.join(",") + "=" + corner(p[0], p[1])).join("  "));
  const histogram = new Map();
  for (let i = 0; i < image.width * image.height; i++) {
    if (image.pixels[i * 4 + 3] < 128) { continue; }
    const key = [image.pixels[i * 4], image.pixels[i * 4 + 1], image.pixels[i * 4 + 2]].join(",");
    histogram.set(key, (histogram.get(key) || 0) + 1);
  }
  console.log("top colours: " + [...histogram.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map((e) => "rgb(" + e[0] + ")x" + e[1]).join("  "));
  for (let y = 0; y < image.height; y++) {
    let line = "";
    for (let x = 0; x < image.width; x++) { line += differs(x, y) ? "#" : "."; }
    console.log(String(y).padStart(2) + " " + line);
  }
  process.exit(0);
}

/* the 16-colour Windows 9x palette the whole screen is drawn from */
const PALETTE = [
  [0x00, 0x00, 0x00], [0x80, 0x00, 0x00], [0x00, 0x80, 0x00], [0x80, 0x80, 0x00],
  [0x00, 0x00, 0x80], [0x80, 0x00, 0x80], [0x00, 0x80, 0x80], [0xc0, 0xc0, 0xc0],
  [0x80, 0x80, 0x80], [0xff, 0x00, 0x00], [0x00, 0xff, 0x00], [0xff, 0xff, 0x00],
  [0x00, 0x00, 0xff], [0xff, 0x00, 0xff], [0x00, 0xff, 0xff], [0xff, 0xff, 0xff]
];

const hexColour = (rgb) => "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
const SIZE = 16;

/* Which OO11 icon becomes which symbol. `large` adds the 26px version where the
   page uses it; anything not referenced in site/ is not generated at all. */
const ICONS = [
  { file: "ooo11-writer-doc.ico", id: "i-doc", note: "text document" },
  { file: "ooo11-calc-doc.ico", id: "i-grid", note: "spreadsheet" },
  { file: "ooo11-impress-doc.ico", id: "i-slide", note: "presentation" },
  { file: "ooo11-base-doc.ico", id: "i-db", note: "database" },
  { file: "ooo11-draw-doc.ico", id: "i-shapes", note: "drawing" },
  { file: "ooo11-chart-doc.ico", id: "i-chart", note: "chart" }
];

/* The OO.org 1.1 toolbar icons live on openoffice.org as 72x32 sprites holding
   the small (16x16) and the large (26x26) version side by side. `large` is only
   generated for the ones a heading uses. */
const TOOLBAR = [
  { file: "save_OOo1.png", small: "i-save-16", large: "i-save-26", note: "save" },
  { file: "copy_OOo1.png", small: "i-copy-16", large: "i-copy-26", note: "copy" },
  { file: "open_OOo1.png", small: "i-open-16", large: "i-open-26", note: "open" },
  { file: "help_OOo1.png", small: "i-help-16", note: "help" },
  { file: "hyperlink_OOo1.png", small: "i-link-16", note: "hyperlink" },
  { file: "hyperlink_OOo2.png", small: "i-hyperlink-16", note: "hyperlink, 2.1" },
  { file: "paste_OOo1.png", small: "i-paste-16", note: "paste" },
  { file: "cellaligntop_OOo1.png", small: "i-align-16", note: "cell align top" },
  { file: "text_OOo1.png", small: "i-text-16", note: "text" },
  { file: "spellcheck_OOo1.png", small: "i-spellcheck-16", note: "spellcheck" },
  { file: "navigator_OOo1.png", small: "i-navigator-16", note: "navigator" },
  { file: "plugin_OOo1.png", small: "i-plugin-16", note: "plugin" },
  { file: "ok_OOo1.png", small: "i-ok-16", note: "ok" },
  { file: "insertcolumn_OOo1.png", small: "i-column-16", note: "insert column" },
  { file: "stylist_OOo1.png", small: "i-stylist-16", note: "stylist" }
];
const SMALL = 16;
const LARGE = 26;

/* ------------------------------------------------------------------ decode */

/* Reads one .ico and returns the largest image it holds as RGBA pixels. */
function readIco(file) {
  const buffer = readFileSync(file);
  if (buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) {
    throw new Error(file + ": not an .ico");
  }
  const count = buffer.readUInt16LE(4);
  let best = null;
  for (let i = 0; i < count; i++) {
    const at = 6 + i * 16;
    const width = buffer[at] || 256;
    const height = buffer[at + 1] || 256;
    const entry = {
      width: width,
      height: height,
      bpp: buffer.readUInt16LE(at + 6),
      bytes: buffer.readUInt32LE(at + 8),
      offset: buffer.readUInt32LE(at + 12)
    };
    entry.area = entry.width * entry.height;
    /* at the same size, the deeper image is the better source */
    if (!best || entry.area > best.area || (entry.area === best.area && entry.bpp > best.bpp)) { best = entry; }
  }
  const data = buffer.subarray(best.offset, best.offset + best.bytes);
  const image = data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ? decodePng(data)
    : decodeDib(data, best);
  return { image: image, entry: best, count: count };
}


/* Uncompressed bitmaps: 32-, 24- or 8-bit, bottom-up, with the AND mask. */
function decodeDib(data, entry) {
  const headerSize = data.readUInt32LE(0);
  const width = data.readInt32LE(4);
  const doubled = data.readInt32LE(8);
  const height = Math.abs(doubled) / 2;
  const bpp = data.readUInt16LE(14);
  let palette = null;
  let offset = headerSize;
  if (bpp <= 8) {
    const declared = Math.max(0, headerSize - 40) / 4;
    const count = declared || (1 << bpp);
    palette = [];
    for (let i = 0; i < count; i++) {
      const at = headerSize + i * 4;
      palette.push([data[at + 2], data[at + 1], data[at], 255]);
    }
    offset = headerSize + count * 4;
  }
  const bottomUp = doubled > 0;
  const rowBytes = (((bpp * width) + 31) >> 5) * 4;
  const maskRow = ((width + 31) >> 5) * 4;
  const maskStart = offset + rowBytes * height;
  const rgba = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    const source = offset + (bottomUp ? height - 1 - y : y) * rowBytes;
    const mask = maskStart + (bottomUp ? height - 1 - y : y) * maskRow;
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 255;
      if (bpp === 32) {
        r = data[source + x * 4 + 2]; g = data[source + x * 4 + 1]; b = data[source + x * 4]; a = data[source + x * 4 + 3];
      } else if (bpp === 24) {
        r = data[source + x * 3 + 2]; g = data[source + x * 3 + 1]; b = data[source + x * 3];
      } else {
        /* 1, 2, 4 or 8 bits per pixel, most significant pixel first */
        const perByte = 8 / bpp;
        const byte = data[source + Math.floor(x / perByte)];
        const shift = 8 - bpp * ((x % perByte) + 1);
        const entryColour = palette[(byte >> shift) & ((1 << bpp) - 1)] || [0, 0, 0, 255];
        r = entryColour[0]; g = entryColour[1]; b = entryColour[2];
      }
      const masked = (data[mask + (x >> 3)] >> (7 - (x & 7))) & 1;
      const at = (y * width + x) * 4;
      rgba[at] = r; rgba[at + 1] = g; rgba[at + 2] = b;
      /* the AND mask carries the shape of the icon, so it decides alpha */
      rgba[at + 3] = masked ? 0 : a;
    }
  }
  return { width: width, height: height, pixels: rgba };
}

/* --------------------------------------------------------------- reduction */

/* Box-average down to size x size, then hard edges and palette-only colours. */
function toPixelArt(image, size) {
  const grid = [];
  const stepX = image.width / size;
  const stepY = image.height / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      const y0 = Math.floor(y * stepY), y1 = Math.max(y0 + 1, Math.floor((y + 1) * stepY));
      const x0 = Math.floor(x * stepX), x1 = Math.max(x0 + 1, Math.floor((x + 1) * stepX));
      for (let sy = y0; sy < y1 && sy < image.height; sy++) {
        for (let sx = x0; sx < x1 && sx < image.width; sx++) {
          const at = (sy * image.width + sx) * 4;
          const alpha = image.pixels[at + 3] / 255;
          r += image.pixels[at] * alpha; g += image.pixels[at + 1] * alpha; b += image.pixels[at + 2] * alpha;
          a += alpha; n++;
        }
      }
      if (!n || a / n < 0.5) { grid.push(null); continue; }
      grid.push(nearest(r / a, g / a, b / a));
    }
  }
  return grid;
}

/* The toolbar sprites sit on an opaque tile. Clear the background that touches
   the border and leave the drawing alone -- white *inside* an icon stays. */
function punchBackground(image, background, tolerance) {
  const close = (x, y) => {
    const at = (y * image.width + x) * 4;
    if (image.pixels[at + 3] === 0) { return true; }
    return Math.abs(image.pixels[at] - background[0]) + Math.abs(image.pixels[at + 1] - background[1]) +
      Math.abs(image.pixels[at + 2] - background[2]) <= tolerance;
  };
  const seen = new Uint8Array(image.width * image.height);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) { return; }
    const index = y * image.width + x;
    if (seen[index] || !close(x, y)) { return; }
    seen[index] = 1;
    stack.push(index);
  };
  for (let x = 0; x < image.width; x++) { push(x, 0); push(x, image.height - 1); }
  for (let y = 0; y < image.height; y++) { push(0, y); push(image.width - 1, y); }
  while (stack.length) {
    const index = stack.pop();
    const x = index % image.width;
    const y = (index - x) / image.width;
    image.pixels[index * 4 + 3] = 0;
    push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
  }
  return image;
}

/* A sprite holds two icons side by side on a plain background: split it on the
   columns that hold nothing but background and return each icon cropped to its
   own drawing, squared off so it keeps its proportions when it is scaled. */
function splitSprite(image, background) {
  const differs = (x, y) => {
    const at = (y * image.width + x) * 4;
    if (image.pixels[at + 3] < 20) { return false; }
    return Math.abs(image.pixels[at] - background[0]) + Math.abs(image.pixels[at + 1] - background[1]) +
      Math.abs(image.pixels[at + 2] - background[2]) > 24;
  };
  const columns = [];
  for (let x = 0; x < image.width; x++) {
    let hit = false;
    for (let y = 0; y < image.height && !hit; y++) { hit = differs(x, y); }
    columns.push(hit);
  }
  const boxes = [];
  let start = -1;
  for (let x = 0; x <= image.width; x++) {
    if (x < image.width && columns[x]) {
      if (start === -1) { start = x; }
    } else if (start !== -1) {
      let top = image.height, bottom = -1, left = image.width, right = -1;
      for (let sx = start; sx < x; sx++) {
        for (let sy = 0; sy < image.height; sy++) {
          if (!differs(sx, sy)) { continue; }
          if (sy < top) { top = sy; }
          if (sy > bottom) { bottom = sy; }
          if (sx < left) { left = sx; }
          if (sx > right) { right = sx; }
        }
      }
      boxes.push({ left: left, top: top, width: right - left + 1, height: bottom - top + 1 });
      start = -1;
    }
  }
  return boxes.map((box) => {
    const side = Math.max(box.width, box.height);
    const padX = Math.floor((side - box.width) / 2);
    const padY = Math.floor((side - box.height) / 2);
    const pixels = Buffer.alloc(side * side * 4);
    for (let y = 0; y < side; y++) {
      for (let x = 0; x < side; x++) {
        const sx = box.left + x - padX;
        const sy = box.top + y - padY;
        if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) { continue; }
        const from = (sy * image.width + sx) * 4;
        const to = (y * side + x) * 4;
        pixels[to] = image.pixels[from];
        pixels[to + 1] = image.pixels[from + 1];
        pixels[to + 2] = image.pixels[from + 2];
        pixels[to + 3] = image.pixels[from + 3];
      }
    }
    return { width: side, height: side, pixels: pixels, box: box };
  });
}

function nearest(r, g, b) {
  let best = 0;
  let bestDistance = Infinity;
  PALETTE.forEach((candidate, index) => {
    /* green matters most to the eye, and this keeps the palette readable */
    const distance = 2 * (r - candidate[0]) ** 2 + 4 * (g - candidate[1]) ** 2 + 3 * (b - candidate[2]) ** 2;
    if (distance < bestDistance) { bestDistance = distance; best = index; }
  });
  return best;
}

/* ---------------------------------------------------------------- writing */

/* Greedy rectangles: flat areas become one <rect> instead of a row of them,
   which keeps the page small. */
function rectangles(grid, size) {
  const used = new Uint8Array(size * size);
  const out = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const at = y * size + x;
      const colour = grid[at];
      if (colour === null || used[at]) { continue; }
      let width = 1;
      while (x + width < size && grid[y * size + x + width] === colour && !used[y * size + x + width]) { width++; }
      let height = 1;
      while (y + height < size) {
        let fits = true;
        for (let i = 0; i < width && fits; i++) {
          const below = (y + height) * size + x + i;
          if (grid[below] !== colour || used[below]) { fits = false; }
        }
        if (!fits) { break; }
        height++;
      }
      for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < width; dx++) { used[(y + dy) * size + x + dx] = 1; }
      }
      out.push({ x: x, y: y, width: width, height: height, colour: colour });
    }
  }
  return out;
}

function symbol(id, grid, label, size) {
  const lines = [];
  lines.push('  <symbol id="' + id + '" viewBox="0 0 ' + size + " " + size + '">');
  lines.push("    <!-- " + label + ": OpenOffice.org 1.1 icon, see docs/credits.md -->");
  rectangles(grid, size).forEach((rect) => {
    lines.push('    <rect x="' + rect.x + '" y="' + rect.y + '" width="' + rect.width +
      '" height="' + rect.height + '" fill="' + hexColour(PALETTE[rect.colour]) + '"/>');
  });
  lines.push("  </symbol>");
  return lines.join("\n");
}

const generated = [];
const report = [];
const grids = {};

/* the document pictograms, from the .ico files */
ICONS.forEach((icon) => {
  const decoded = readIco(join(root, "icons", "ooo11", icon.file));
  const grid = toPixelArt(decoded.image, SIZE);
  grids[icon.id] = { grid: grid, size: SIZE };
  generated.push(symbol(icon.id, grid, icon.note, SIZE));
  report.push(icon.file + " -> " + icon.id + "  (" + decoded.count + " sizes, using " +
    decoded.entry.width + "x" + decoded.entry.height + " at " + decoded.entry.bpp + "bpp)  " +
    grid.filter((c) => c !== null).length + " solid pixels");
  if (icon.large) {
    const big = toPixelArt(decoded.image, LARGE);
    grids[icon.large] = { grid: big, size: LARGE };
    generated.push(symbol(icon.large, big, icon.note, LARGE));
    report.push(icon.file + " -> " + icon.large + "  (same source at " + LARGE + "x" + LARGE + ")  " +
      big.filter((c) => c !== null).length + " solid pixels");
  }
});

/* the toolbar icons, both sizes out of each 72x32 sprite */
TOOLBAR.forEach((icon) => {
  const sprite = decodePng(readFileSync(join(root, "icons", "ooo11", "toolbar", icon.file)));
  /* the sprite sits on a plain background, so that is what we key off */
  const background = [sprite.pixels[0], sprite.pixels[1], sprite.pixels[2]];
  punchBackground(sprite, background, 24);
  const parts = splitSprite(sprite, background);
  if (parts.length !== 2) {
    throw new Error(icon.file + ": expected 2 icons in the sprite, found " + parts.length);
  }
  /* the sprite is laid out small first, then large */
  const ordered = parts.slice().sort((a, b) => a.width - b.width);
  [[ordered[0], icon.small, SMALL], [ordered[1], icon.large, LARGE]].forEach((pair) => {
    if (!pair[1]) { return; }
    const grid = toPixelArt(pair[0], pair[2]);
    grids[pair[1]] = { grid: grid, size: pair[2] };
    generated.push(symbol(pair[1], grid, icon.note, pair[2]));
    report.push(icon.file + " -> " + pair[1] + "  (" + pair[0].box.width + "x" + pair[0].box.height +
      " at " + pair[0].box.left + "," + pair[0].box.top + " -> " + pair[2] + "x" + pair[2] + ")  " +
      grid.filter((c) => c !== null).length + " solid pixels");
  });
});

const page = readFileSync(join(root, "site", "index.html"), "utf8");
const block = "<!-- ooo11:start -->\n" + generated.join("\n") + "\n  <!-- ooo11:end -->";
const pattern = /<!-- ooo11:start -->[\s\S]*?<!-- ooo11:end -->/;
if (!pattern.test(page)) { throw new Error("site/index.html has no ooo11:start marker"); }
writeFileSync(join(root, "site", "index.html"), page.replace(pattern, block));

/* The favicon is the same artwork as a standalone file, because a favicon
   cannot point at an inline <symbol>. */
const FAVICON = process.env.ODT_FAVICON || "i-save-16";
const favicon = grids[FAVICON];
if (!favicon) { throw new Error("favicon source " + FAVICON + " was not generated"); }
const faviconLines = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + favicon.size + " " +
  favicon.size + '" width="' + favicon.size + '" height="' + favicon.size + '" shape-rendering="crispEdges">'];
rectangles(favicon.grid, favicon.size).forEach((rect) => {
  faviconLines.push('  <rect x="' + rect.x + '" y="' + rect.y + '" width="' + rect.width +
    '" height="' + rect.height + '" fill="' + hexColour(PALETTE[rect.colour]) + '"/>');
});
faviconLines.push("</svg>");
writeFileSync(join(root, "site", "favicon.svg"), faviconLines.join("\n") + "\n");

/* The five symbols that used to be hand-written into index.html, in the same form
   as everything else: a character a pixel, a hex digit for a palette colour and a
   dot for nothing at all. */
const DRAWN = [
  { id: "i-close", rows: [
    "................",
    "................",
    "................",
    "....00....00....",
    "....000..000....",
    ".....000000.....",
    "......0000......",
    "......0000......",
    ".....000000.....",
    "....000..000....",
    "....00....00....",
    "................",
    "................",
    "................",
    "................",
    "................"
  ] },
  { id: "i-min", rows: [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "....00000000....",
    "....00000000....",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................"
  ] },
  { id: "i-max", rows: [
    "................",
    "................",
    "................",
    "....00000000....",
    "....00000000....",
    "....00777700....",
    "....00777700....",
    "....00777700....",
    "....00777700....",
    "....00000000....",
    "....00000000....",
    "................",
    "................",
    "................",
    "................",
    "................"
  ] },
  { id: "i-box", rows: [
    "................",
    "................",
    "................",
    "................",
    "..000000000000..",
    "..0bbbb77bbbb0..",
    "..0b3337733300..",
    "..0b3337733300..",
    "..0b3337733300..",
    "..0b3337733300..",
    "..0b3337733300..",
    "..0b0007700000..",
    "..000000000000..",
    "................",
    "................",
    "................"
  ] },
  { id: "i-mail", rows: [
    "................",
    "................",
    "................",
    ".00000000000000.",
    ".04fffffffff4f0.",
    ".0f4fffffff4ff0.",
    ".0ff4fffff4fff0.",
    ".0fff4fff4ffff0.",
    ".0ffff444fffff0.",
    ".0ffffffffffff0.",
    ".0ffffffffffff0.",
    ".00000000000000.",
    "................",
    "................",
    "................",
    "................"
  ] }
];

/* ---------------------------------------------------------------------------
 * The same icons as one PNG, plus a rule per icon saying where it sits in it.
 * Two rows: the 16px icons along the top, the 26px ones under them, each at its
 * own size so nothing is ever scaled. Both files are committed and the page
 * links them, which is why this is a sheet rather than an .svg per icon: a page
 * opened straight off disk cannot resolve an external <use href="file.svg#id">,
 * and 29 separate requests is a worse trade than one image.
 * --------------------------------------------------------------------------- */
/* The hand-drawn five join the sheet and nothing else: they are no longer emitted
   as inline symbols, so every icon the page shows comes from one image. */
DRAWN.forEach((icon) => {
  grids[icon.id] = { grid: icon.rows.join("").split("").map((c) => (c === "." ? null : parseInt(c, 16))), size: SIZE };
});

const smalls = Object.keys(grids).filter((id) => grids[id].size === SIZE);
const larges = Object.keys(grids).filter((id) => grids[id].size !== SIZE);
const sheetWidth = Math.max(smalls.length * SIZE, larges.length * LARGE);
const sheetHeight = SIZE + LARGE;
const indices = Buffer.alloc(sheetWidth * sheetHeight);
const places = {};
function place(id, x0, y0) {
  const entry = grids[id];
  for (let y = 0; y < entry.size; y++) {
    for (let x = 0; x < entry.size; x++) {
      const colour = entry.grid[y * entry.size + x];
      /* index 0 is the transparent entry the encoder puts at the front */
      indices[(y0 + y) * sheetWidth + (x0 + x)] = colour === null ? 0 : colour + 1;
    }
  }
  places[id] = { x: x0, y: y0 };
}
smalls.forEach((id, i) => place(id, i * SIZE, 0));
larges.forEach((id, i) => place(id, i * LARGE, SIZE));

writeFileSync(join(root, "site", "icons.png"), encodePalettePng({
  width: sheetWidth, height: sheetHeight, colours: PALETTE, indices: indices, transparent: true
}));

const rules = ["/* Generated by tools/make-icons.mjs: where each icon sits in icons.png.",
  "   Do not edit this file, run the tool. */", ""];
Object.keys(places).forEach((id) => {
  const at = places[id];
  rules.push("." + id + " { background-position: " + (-at.x) + "px " + (-at.y) + "px; }");
});
writeFileSync(join(root, "site", "icons.css"), rules.join("\n") + "\n");

console.log("wrote site/icons.png (" + sheetWidth + "x" + sheetHeight + ", " +
  smalls.length + " at " + SIZE + "px and " + larges.length + " at " + LARGE + "px)");
console.log("wrote site/icons.css with " + Object.keys(places).length + " places");

console.log(report.join("\n"));
console.log("wrote " + generated.length + " symbols into site/index.html");
console.log("wrote site/favicon.svg from " + FAVICON);

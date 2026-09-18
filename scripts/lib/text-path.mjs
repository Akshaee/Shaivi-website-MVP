// Converts text to SVG path data using the bundled Fontsource families.
// Everything the asset pipeline rasterises is vectorised here first, so image
// generation never depends on fonts installed in the OS.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import wawoff2 from "wawoff2";
import opentype from "opentype.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cache = new Map();

const SOURCES = {
  "exo2-600": "@fontsource/exo-2/files/exo-2-latin-600-normal.woff2",
  "exo2-700": "@fontsource/exo-2/files/exo-2-latin-700-normal.woff2",
  "exo2-400": "@fontsource/exo-2/files/exo-2-latin-400-normal.woff2",
  "opensans-600": "@fontsource/open-sans/files/open-sans-latin-600-normal.woff2",
  "opensans-400": "@fontsource/open-sans/files/open-sans-latin-400-normal.woff2",
  "dancing-600": "@fontsource/dancing-script/files/dancing-script-latin-600-normal.woff2",
};

export async function loadFont(key) {
  if (cache.has(key)) return cache.get(key);
  const file = path.join(root, "node_modules", SOURCES[key]);
  const ttf = Buffer.from(await wawoff2.decompress(fs.readFileSync(file)));
  const font = opentype.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength));
  cache.set(key, font);
  return font;
}

export async function ttfBuffer(key) {
  const file = path.join(root, "node_modules", SOURCES[key]);
  return Buffer.from(await wawoff2.decompress(fs.readFileSync(file)));
}

/** Width of `text` at `size`, including per-character tracking. */
export async function measure(fontKey, text, size, tracking = 0) {
  const font = await loadFont(fontKey);
  const scale = size / font.unitsPerEm;
  let w = 0;
  const glyphs = font.stringToGlyphs(text);
  glyphs.forEach((g, i) => {
    w += g.advanceWidth * scale;
    if (i < glyphs.length - 1) w += tracking * size;
  });
  return w;
}

/**
 * Path data for `text` with its baseline at (x, y).
 * `tracking` is in em units (like CSS letter-spacing in em).
 */
export async function textPath(fontKey, text, { x = 0, y = 0, size = 100, tracking = 0, anchor = "start" } = {}) {
  const font = await loadFont(fontKey);
  const scale = size / font.unitsPerEm;
  const total = await measure(fontKey, text, size, tracking);
  let cursor = anchor === "middle" ? x - total / 2 : anchor === "end" ? x - total : x;
  const combined = new opentype.Path();
  for (const glyph of font.stringToGlyphs(text)) {
    combined.extend(glyph.getPath(cursor, y, size));
    cursor += glyph.advanceWidth * scale + tracking * size;
  }
  return { d: combined.toPathData(3), width: total };
}

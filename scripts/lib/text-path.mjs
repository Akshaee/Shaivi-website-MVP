// Converts text to SVG path data using the bundled Fontsource families.
// Everything the asset pipeline rasterises is vectorised here first, so image
// generation never depends on fonts installed in the OS.
//
// Two quirks shape this file and must not be undone:
//
//   1. opentype.js 2.0's `Glyph.getPath()` / `Path.toPathData()` return NaN
//      coordinates for a scattering of glyphs in these fonts (for Exo 2
//      SemiBold, "a", "g", "m", "y" and "2" among them) even though the parsed
//      contours are perfectly well formed. So this module reads `glyph.path`
//      directly and does its own scaling and serialising, which is a handful of
//      lines and is exact.
//   2. librsvg can stop partway through a single very long `d` attribute, which
//      silently drops the end of a line of text. Every glyph is emitted as its
//      own `<path>` so no `d` is long enough to trigger it.
//
// `npm run assets` rasterises probe strings and checks the ink width, so if
// either quirk resurfaces the build fails instead of shipping broken artwork.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import wawoff2 from "wawoff2";
import opentype from "opentype.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const buffers = new Map();

const SOURCES = {
  "exo2-600": "@fontsource/exo-2/files/exo-2-latin-600-normal.woff2",
  "exo2-700": "@fontsource/exo-2/files/exo-2-latin-700-normal.woff2",
  "exo2-400": "@fontsource/exo-2/files/exo-2-latin-400-normal.woff2",
  "opensans-600": "@fontsource/open-sans/files/open-sans-latin-600-normal.woff2",
  "opensans-400": "@fontsource/open-sans/files/open-sans-latin-400-normal.woff2",
  "dancing-600": "@fontsource/dancing-script/files/dancing-script-latin-600-normal.woff2",
};

/** Decompressed TTF bytes for a family, cached per process. */
export async function ttfBuffer(key) {
  if (buffers.has(key)) return buffers.get(key);
  const source = SOURCES[key];
  if (!source) throw new Error(`Unknown font key "${key}"`);
  const ttf = Buffer.from(await wawoff2.decompress(fs.readFileSync(path.join(root, "node_modules", source))));
  buffers.set(key, ttf);
  return ttf;
}

/** A fresh Font. Never share one across calls — see the note at the top. */
export async function loadFont(key) {
  const ttf = await ttfBuffer(key);
  return opentype.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength));
}

/**
 * Lays out `text` once: the advance width of the whole run, and one path string
 * per glyph positioned with its baseline at (x, y).
 * `tracking` is in em units, like CSS letter-spacing in em.
 */
export async function textPath(
  fontKey,
  text,
  { x = 0, y = 0, size = 100, tracking = 0, anchor = "start" } = {},
) {
  const font = await loadFont(fontKey);
  const scale = size / font.unitsPerEm;
  const glyphs = font.stringToGlyphs(text);

  let width = 0;
  glyphs.forEach((glyph, i) => {
    width += glyph.advanceWidth * scale;
    if (i < glyphs.length - 1) width += tracking * size;
  });

  // One serialisation per distinct glyph, drawn at the origin on the baseline.
  const drawn = new Map();
  for (const glyph of glyphs) {
    if (!drawn.has(glyph.index)) drawn.set(glyph.index, serialise(glyph, scale, y, fontKey, text));
  }

  let cursor = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
  const parts = [];
  for (const glyph of glyphs) {
    const d = drawn.get(glyph.index);
    if (d) parts.push({ d, dx: cursor });
    cursor += glyph.advanceWidth * scale + tracking * size;
  }

  return { parts, width };
}

const round = (value) => {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isFinite(rounded) ? String(rounded) : null;
};

/** Scales a glyph's own contours into SVG path data with the baseline at `y`. */
function serialise(glyph, scale, baseline, fontKey, text) {
  const commands = glyph.path?.commands ?? [];
  const out = [];

  for (const command of commands) {
    // Font units are y-up; SVG is y-down, hence the sign flip on every y.
    const nums = [];
    const push = (px, py) => {
      nums.push(round(px * scale), round(baseline - py * scale));
    };

    switch (command.type) {
      case "M":
      case "L":
        push(command.x, command.y);
        break;
      case "Q":
        push(command.x1, command.y1);
        push(command.x, command.y);
        break;
      case "C":
        push(command.x1, command.y1);
        push(command.x2, command.y2);
        push(command.x, command.y);
        break;
      case "Z":
        break;
      default:
        throw new Error(`Unexpected path command "${command.type}" in ${fontKey}`);
    }

    if (nums.some((value) => value === null)) {
      throw new Error(`Corrupt glyph "${glyph.name ?? glyph.index}" in ${fontKey} while rendering "${text}"`);
    }
    out.push(command.type === "Z" ? "Z" : command.type + nums.join(" "));
  }

  return out.join("");
}

/** Advance width of `text` at `size`, including per-character tracking. */
export async function measure(fontKey, text, size, tracking = 0) {
  return (await textPath(fontKey, text, { size, tracking })).width;
}

/** `<path>` elements for `text`, one per glyph, ready to drop into an SVG. */
export async function textSvg(fontKey, text, options = {}, attributes = "") {
  const { parts, width } = await textPath(fontKey, text, options);
  const svg = parts
    .map(({ d, dx }) => `<path ${attributes} transform="translate(${dx.toFixed(3)} 0)" d="${d}"/>`)
    .join("");
  return { svg, width };
}

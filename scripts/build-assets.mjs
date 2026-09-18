/**
 * Generates the brand and image assets the site imports.
 *
 * The original kit (vector logos, seven brochure photographs, icon set, OG image,
 * "Elevating" font subset) was not supplied, so this script derives everything it
 * can from the §4 brand tokens and marks the rest as pending client artwork.
 * Re-run with `npm run assets` after replacing any source file.
 *
 * Every photograph it writes is a clearly-labelled PLACEHOLDER. Replace the files
 * in src/assets/images/ with the client's originals (same names) before launch.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import subsetFont from "subset-font";
import { textPath, textSvg, ttfBuffer } from "./lib/text-path.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = (...s) => path.join(root, ...s);
const write = (rel, data) => {
  fs.mkdirSync(path.dirname(p(rel)), { recursive: true });
  fs.writeFileSync(p(rel), data);
  console.log("  ·", rel, typeof data === "string" ? `${data.length} B` : `${data.length} B`);
};

const C = {
  red: "#d13d23",
  charcoal: "#383332",
  purple: "#643c8e",
  cerulean: "#478cb9",
  indigo: "#34419a",
  orchid: "#9460b8",
  violet: "#6649ae",
  magenta: "#a1388b",
  plum: "#70206a",
  deep: "#491568",
  inkIndigo: "#35306a",
  ink: "#24201d",
  royal50: "#f9f5ff",
  royal100: "#efeaf6",
  royal200: "#ded7e9",
  neutral400: "#a09da5",
  neutral600: "#6a676f",
  white: "#ffffff",
};

/* ------------------------------------------------------------------ mark */
// Shield silhouette with a cut-out care cross, pinched at the waist so it
// echoes the brochure's bridge motif. Drawn once, recoloured per variant.
const SHIELD =
  "M32 3.5 56.5 12.6 A1 1 0 0 1 57 13.5 V31.8 c0 8.4-3.4 15.3-8.6 20.3 C43.4 56.8 37.6 59.5 32 61 " +
  "c-5.6-1.5-11.4-4.2-16.4-8.9 C10.4 47.1 7 40.2 7 31.8 V13.5 a1 1 0 0 1 .5-.9 Z";
const CROSS =
  "M28.6 17.8 h6.8 a1.2 1.2 0 0 1 1.2 1.2 v7.6 h7.6 a1.2 1.2 0 0 1 1.2 1.2 v6.8 " +
  "a1.2 1.2 0 0 1-1.2 1.2 h-7.6 v7.6 a1.2 1.2 0 0 1-1.2 1.2 h-6.8 a1.2 1.2 0 0 1-1.2-1.2 " +
  "v-7.6 h-7.6 a1.2 1.2 0 0 1-1.2-1.2 v-6.8 a1.2 1.2 0 0 1 1.2-1.2 h7.6 v-7.6 a1.2 1.2 0 0 1 1.2-1.2 Z";

const markSvg = (fill) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="SHAIVI">` +
  `<path fill="${fill}" fill-rule="evenodd" d="${SHIELD}${CROSS}"/></svg>`;

/* ------------------------------------------------------------------ logos */
async function lockup({ horizontal, wordFill, taglineFill, markFill }) {
  const WORD = 64; // wordmark cap size
  const TAG = 15.5;

  const measureOnly = async (key, str, size, tracking) => (await textPath(key, str, { size, tracking })).width;
  const wordW = await measureOnly("exo2-600", "SHAIVI", WORD, 0.055);
  const tmW = await measureOnly("exo2-600", "\u2122", WORD * 0.3, 0);
  const tagW = await measureOnly("opensans-600", "SAFETY MEETS CARE", TAG, 0.22);
  const textW = Math.max(wordW + 4 + tmW, tagW);

  const word = async (x, y) =>
    (await textSvg("exo2-600", "SHAIVI", { size: WORD, tracking: 0.055, x, y }, `fill="${wordFill}"`)).svg;
  const tm = async (x, y) =>
    (await textSvg("exo2-600", "\u2122", { size: WORD * 0.3, x, y }, `fill="${wordFill}"`)).svg;
  const tag = async (x, y) =>
    (await textSvg("opensans-600", "SAFETY MEETS CARE", { size: TAG, tracking: 0.22, x, y }, `fill="${taglineFill}"`)).svg;

  if (horizontal) {
    const markSize = 60;
    const gap = 20;
    const W = Math.ceil(markSize + gap + textW) + 8;
    const H = 76;
    const mx = 4;
    const tx = mx + markSize + gap;
    const baseline = 44;
    return {
      w: W,
      h: H,
      svg:
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="SHAIVI — Safety Meets Care">` +
        `<g transform="translate(${mx} 8) scale(${markSize / 64})"><path fill="${markFill}" fill-rule="evenodd" d="${SHIELD}${CROSS}"/></g>` +
        (await word(tx, baseline)) +
        (await tm(tx + wordW + 4, baseline - WORD * 0.52)) +
        (await tag(tx, baseline + 22)) +
        `</svg>`,
    };
  }

  const markSize = 84;
  const W = Math.ceil(Math.max(textW, markSize)) + 16;
  const H = 210;
  const cx = W / 2;
  const wordX = cx - (wordW + 4 + tmW) / 2;
  return {
    w: W,
    h: H,
    svg:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="SHAIVI — Safety Meets Care">` +
      `<g transform="translate(${cx - markSize / 2} 6) scale(${markSize / 64})"><path fill="${markFill}" fill-rule="evenodd" d="${SHIELD}${CROSS}"/></g>` +
      (await word(wordX, 160)) +
      (await tm(wordX + wordW + 4, 160 - WORD * 0.52)) +
      (await tag(cx - tagW / 2, 188)) +
      `</svg>`,
  };
}

/* ------------------------------------------------- placeholder photographs */
async function placeholder({ w, h, key, label, alpha = false, tint = "light" }) {
  const dark = tint === "dark";
  const bg = dark ? C.deep : C.royal50;
  const stroke = dark ? "#ffffff" : C.purple;
  const textFill = dark ? "#ffffff" : C.plum;
  const subFill = dark ? "#ded7e9" : C.neutral600;
  const base = Math.min(w, h);

  const title = await textSvg("exo2-700", "PHOTO PENDING", {
    size: base * 0.062,
    tracking: 0.12,
    x: w / 2,
    y: h / 2 + base * 0.11,
    anchor: "middle",
  }, `fill="${textFill}"`);
  const sub = await textSvg("exo2-400", key, {
    size: base * 0.042,
    tracking: 0.02,
    x: w / 2,
    y: h / 2 + base * 0.185,
    anchor: "middle",
  }, `fill="${subFill}"`);
  const note = await textSvg("opensans-400", label, {
    size: base * 0.03,
    tracking: 0.04,
    x: w / 2,
    y: h / 2 + base * 0.25,
    anchor: "middle",
  }, `fill="${subFill}"`);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    `<defs>` +
    `<pattern id="h" width="24" height="24" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">` +
    `<line x1="0" y1="0" x2="0" y2="24" stroke="${stroke}" stroke-opacity="0.10" stroke-width="8"/></pattern>` +
    `</defs>` +
    // Cut-outs are transparent, but a translucent plate keeps the "pending" notice
    // legible when the image sits on a violet panel rather than on white.
    (alpha
      ? `<rect x="${base * 0.02}" y="${base * 0.02}" width="${w - base * 0.04}" height="${h - base * 0.04}" rx="${base * 0.05}" fill="#ffffff" fill-opacity="0.9"/>`
      : `<rect width="${w}" height="${h}" fill="${bg}"/>`) +
    `<rect width="${w}" height="${h}" fill="url(#h)"/>` +
    `<rect x="${base * 0.03}" y="${base * 0.03}" width="${w - base * 0.06}" height="${h - base * 0.06}" ` +
    `fill="none" stroke="${stroke}" stroke-opacity="0.5" stroke-width="${Math.max(2, base * 0.006)}" ` +
    `stroke-dasharray="${base * 0.05} ${base * 0.03}" rx="${base * 0.04}"/>` +
    // camera glyph
    `<g transform="translate(${w / 2 - base * 0.085} ${h / 2 - base * 0.155}) scale(${base * 0.0053})" ` +
    `fill="none" stroke="${stroke}" stroke-opacity="0.75" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M3 9a2 2 0 0 1 2-2h2.2l1.2-2h6.8l1.2 2H21a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>` +
    `<circle cx="13" cy="13.5" r="4"/></g>` +
    title.svg +
    sub.svg +
    note.svg +
    `</svg>`;

  const img = sharp(Buffer.from(svg));
  return alpha ? img.png({ compressionLevel: 9 }).toBuffer() : img.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

/* ----------------------------------------------------------------- icons */
function icoFromPng(png) {
  // ICO container with a single embedded PNG image (valid since Vista).
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0); // width
  entry.writeUInt8(32, 1); // height
  entry.writeUInt8(0, 2); // palette
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

/* ------------------------------------------------------------------- run */
console.log("Brand assets");
const horizontal = await lockup({ horizontal: true, wordFill: C.charcoal, taglineFill: C.purple, markFill: C.red });
const horizontalWhite = await lockup({ horizontal: true, wordFill: C.white, taglineFill: "#ded7e9", markFill: C.white });
const stacked = await lockup({ horizontal: false, wordFill: C.charcoal, taglineFill: C.purple, markFill: C.red });
const stackedWhite = await lockup({ horizontal: false, wordFill: C.white, taglineFill: "#ded7e9", markFill: C.white });

// Logos ship from public/ so they can be referenced as plain <img> with explicit
// intrinsic sizes; src/assets/brand/ keeps the same files as the design source.
for (const [file, svg] of Object.entries({
  "shaivi-logo-horizontal.svg": horizontal.svg,
  "shaivi-logo-horizontal-white.svg": horizontalWhite.svg,
  "shaivi-logo-stacked.svg": stacked.svg,
  "shaivi-logo-stacked-white.svg": stackedWhite.svg,
  "shaivi-mark.svg": markSvg(C.red),
  "shaivi-mark-white.svg": markSvg(C.white),
})) {
  write(`public/brand/${file}`, svg);
}
write(
  "src/assets/brand/logo-sizes.json",
  JSON.stringify(
    {
      horizontal: { width: horizontal.w, height: horizontal.h },
      stacked: { width: stacked.w, height: stacked.h },
      mark: { width: 64, height: 64 },
    },
    null,
    2,
  ) + "\n",
);
write("src/assets/brand/shaivi-logo-horizontal.svg", horizontal.svg);
write("src/assets/brand/shaivi-logo-horizontal-white.svg", horizontalWhite.svg);
write("src/assets/brand/shaivi-logo-stacked.svg", stacked.svg);
write("src/assets/brand/shaivi-logo-stacked-white.svg", stackedWhite.svg);
write("src/assets/brand/shaivi-mark.svg", markSvg(C.red));
write("src/assets/brand/shaivi-mark-white.svg", markSvg(C.white));

// Static full-colour bridge band (used where a CSS mask isn't needed).
write(
  "src/assets/brand/bridge-band.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 300" width="1600" height="300" aria-hidden="true">` +
    `<defs><linearGradient id="b" x1="0" x2="1"><stop offset="0" stop-color="#643c8e"/><stop offset=".25" stop-color="#5e4e94"/>` +
    `<stop offset=".48" stop-color="#56609c"/><stop offset=".8" stop-color="#4777a9"/><stop offset="1" stop-color="#478cb9"/></linearGradient>` +
    `<radialGradient id="s"><stop offset="0" stop-color="#15163a" stop-opacity=".7"/><stop offset="1" stop-color="#15163a" stop-opacity="0"/></radialGradient></defs>` +
    `<path fill="url(#b)" d="M0 0 H1000 C880 0 800 118 766 118 C732 118 700 0 560 0 H1600 V300 H560 C700 300 732 182 766 182 C800 182 880 300 1000 300 H0 Z"/>` +
    `<rect width="1600" height="300" fill="url(#b)"/>` +
    `</svg>`,
);

// Three-layer mask middle tile: full height at both edges, pinched at 47.9%.
write(
  "public/brand/bridge-waist-mask.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 640" width="1000" height="640" preserveAspectRatio="none">` +
    `<path fill="#000" d="M0 0 C160 0 330 252 479 252 C628 252 840 0 1000 0 L1000 640 C840 640 628 388 479 388 C330 388 160 640 0 640 Z"/>` +
    `</svg>`,
);

console.log("Icons and social image");
const markPng = (size, pad = 0) =>
  sharp(Buffer.from(markSvg(C.red)))
    .resize(size - pad * 2, size - pad * 2, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

write("public/favicon.svg", markSvg(C.red));
write("public/favicon.ico", icoFromPng(await markPng(32)));
write(
  "public/apple-touch-icon.png",
  await sharp(Buffer.from(markSvg(C.red)))
    .resize(148, 148, { fit: "contain", background: "#ffffff" })
    .extend({ top: 16, bottom: 16, left: 16, right: 16, background: "#ffffff" })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer(),
);
write("public/icon-192.png", await markPng(192, 16));
write("public/icon-512.png", await markPng(512, 40));
// Maskable icon: the mark sits inside the safe zone on a solid brand field.
write(
  "public/icon-mask-512.png",
  await sharp(Buffer.from(markSvg(C.white)))
    .resize(280, 280, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 116, bottom: 116, left: 116, right: 116, background: C.deep })
    .png()
    .toBuffer(),
);

// 1200×630 social preview
{
  const w = 1200;
  const h = 630;
  const word = await textSvg("exo2-600", "SHAIVI", { size: 116, tracking: 0.055, x: w / 2, y: 330, anchor: "middle" }, 'fill="#ffffff"');
  const tag = await textSvg("opensans-600", "SAFETY MEETS CARE", { size: 30, tracking: 0.22, x: w / 2, y: 384, anchor: "middle" }, 'fill="#ded7e9"');
  const line = await textSvg(
    "exo2-400",
    "Surgical disposables \u00b7 ISO 13485 certified \u00b7 Bhatkal, Karnataka",
    { size: 30, tracking: 0.01, x: w / 2, y: 500, anchor: "middle" },
    'fill="#efeaf6"',
  );
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    `<defs><linearGradient id="d" x1="0" x2="1"><stop offset="0" stop-color="#34419a"/><stop offset=".45" stop-color="#6042a7"/>` +
    `<stop offset=".8" stop-color="#8f53b5"/><stop offset="1" stop-color="#9460b8"/></linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="#491568"/>` +
    `<rect width="${w}" height="${h}" fill="url(#d)" opacity="0.92"/>` +
    `<g transform="translate(${w / 2 - 54} 120) scale(1.7)"><path fill="#ffffff" fill-rule="evenodd" d="${SHIELD}${CROSS}"/></g>` +
    word.svg + tag.svg +
    `<rect x="${w / 2 - 90}" y="440" width="180" height="3" rx="1.5" fill="#ffffff" opacity="0.6"/>` +
    line.svg + `</svg>`;
  write("public/og/shaivi-og.jpg", await sharp(Buffer.from(svg)).jpeg({ quality: 88, mozjpeg: true }).toBuffer());
}

write(
  "public/brand/shaivi-logo-512.png",
  await sharp(Buffer.from(stacked.svg))
    .resize(512, 512, { fit: "contain", background: "#ffffff" })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer(),
);

console.log("Placeholder photographs (replace with client originals)");
const PHOTOS = [
  { key: "hero-nurse", w: 1200, h: 1500, label: "Home hero · replace with client photograph", cutout: true },
  { key: "operating-room-team", w: 2000, h: 1125, label: "CTA band background · decorative", tint: "dark" },
  { key: "factory-bhatkal", w: 1600, h: 1067, label: "About hero · facility photograph", cutout: true },
  { key: "md-sharath-kumar-shetty", w: 516, h: 516, label: "Managing Director portrait" },
  { key: "surgical-gown-model", w: 1000, h: 1400, label: "Products gowns header", cutout: true },
  { key: "surgical-team-face-shields", w: 1600, h: 1067, label: "Reinforced and BVB gowns", cutout: true },
];
for (const photo of PHOTOS) {
  write(`src/assets/images/${photo.key}.jpg`, await placeholder({ ...photo, alpha: false }));
  if (photo.cutout) {
    write(`src/assets/images/${photo.key}-cutout.png`, await placeholder({ ...photo, alpha: true }));
  }
}

// Emblem: a real brand asset rather than a pending photograph.
{
  const size = 480;
  const name = await textSvg("exo2-600", "DHRITHI", { size: 46, tracking: 0.16, x: size / 2, y: 372, anchor: "middle" }, `fill="${C.inkIndigo}"`);
  const sub = await textSvg("opensans-600", "SURGICAL SOLUTIONS", { size: 20, tracking: 0.16, x: size / 2, y: 408, anchor: "middle" }, `fill="${C.purple}"`);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">` +
    `<rect width="${size}" height="${size}" fill="#ffffff"/>` +
    `<circle cx="240" cy="200" r="150" fill="none" stroke="${C.purple}" stroke-width="6"/>` +
    `<circle cx="240" cy="200" r="136" fill="${C.royal50}"/>` +
    `<g transform="translate(160 120) scale(2.5)"><path fill="${C.red}" fill-rule="evenodd" d="${SHIELD}${CROSS}"/></g>` +
    name.svg + sub.svg + `</svg>`;
  write("src/assets/images/dhrithi-emblem.png", await sharp(Buffer.from(svg)).png().toBuffer());
}

console.log("Fonts");
{
  // Exo 2 variable (300-700), Latin only, copied verbatim from Fontsource.
  fs.copyFileSync(
    p("node_modules/@fontsource-variable/exo-2/files/exo-2-latin-wght-normal.woff2"),
    p("src/assets/fonts/exo2-latin-variable.woff2"),
  );
  console.log("  ·", "src/assets/fonts/exo2-latin-variable.woff2");

  // Open Sans only sets eyebrows and the cover tagline, so a Latin subset is plenty.
  const TAGLINE_CHARS =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 &.,:;'\u2019\u2018\u201c\u201d\u00b7-\u2013\u2014()/%!?";
  for (const weight of [400, 600]) {
    const subset = await subsetFont(await ttfBuffer(`opensans-${weight}`), TAGLINE_CHARS, {
      targetFormat: "woff2",
    });
    write(`src/assets/fonts/open-sans-${weight}-latin.woff2`, subset);
  }

  // Dancing Script carries exactly the letters of the word "Elevating".
  const subset = await subsetFont(await ttfBuffer("dancing-600"), "Elevating", { targetFormat: "woff2" });
  write("src/assets/fonts/dancing-script-600-elevating.woff2", subset);

  for (const [src, dest] of [
    ["node_modules/@fontsource-variable/exo-2/LICENSE", "src/assets/fonts/OFL-Exo2.txt"],
    ["node_modules/@fontsource/open-sans/LICENSE", "src/assets/fonts/OFL-OpenSans.txt"],
    ["node_modules/@fontsource/dancing-script/LICENSE", "src/assets/fonts/OFL-DancingScript.txt"],
  ]) {
    fs.copyFileSync(p(src), p(dest));
    console.log("  ·", dest);
  }
}

console.log("Brand board");
{
  const w = 1600;
  const h = 1100;
  const swatches = [
    ["brand-red", C.red],
    ["brand-purple", C.purple],
    ["brand-cerulean", C.cerulean],
    ["brand-indigo", C.indigo],
    ["brand-orchid", C.orchid],
    ["brand-violet", C.violet],
    ["brand-magenta", C.magenta],
    ["brand-plum", C.plum],
    ["brand-deep", C.deep],
    ["brand-ink-indigo", C.inkIndigo],
    ["brand-charcoal", C.charcoal],
    ["ink", C.ink],
  ];
  let body = `<rect width="${w}" height="${h}" fill="#ffffff"/>`;
  const title = await textSvg("exo2-600", "SHAIVI brand board", { size: 52, x: 72, y: 96 }, `fill="${C.plum}"`);
  body += title.svg;
  const note = await textSvg(
    "opensans-400",
    "Generated from the tokens in src/styles/global.css \u2014 confirm against the designer's source files.",
    { size: 22, x: 72, y: 132 },
    `fill="${C.neutral600}"`,
  );
  body += note.svg;

  for (let i = 0; i < swatches.length; i++) {
    const [name, hex] = swatches[i];
    const x = 72 + (i % 6) * 246;
    const y = 180 + Math.floor(i / 6) * 200;
    const label = await textSvg("exo2-600", name, { size: 20, x, y: y + 158 }, `fill="${C.ink}"`);
    const val = await textSvg("opensans-400", hex.toUpperCase(), { size: 18, x, y: y + 182 }, `fill="${C.neutral600}"`);
    body += `<rect x="${x}" y="${y}" width="216" height="140" rx="16" fill="${hex}"/>`;
    body += label.svg + val.svg;
  }

  const grads = [
    ["bridge", ["#643c8e", "#5e4e94", "#56609c", "#4777a9", "#478cb9"]],
    ["dusk", ["#34419a", "#4b40a1", "#6042a7", "#7243a5", "#8f53b5", "#9460b8"]],
    ["ribbon", ["#a1388b", "#b04f9f", "#8e5a97", "#653e97"]],
    ["violet", ["#663d9e", "#6649ae", "#604eb6", "#7e63b5"]],
    ["orb", ["#8d3e97", "#7d3d9b", "#713f9f", "#6649ae"]],
  ];
  let defs = "";
  for (let i = 0; i < grads.length; i++) {
    const [name, stops] = grads[i];
    defs +=
      `<linearGradient id="g${i}" x1="0" x2="1">` +
      stops.map((s, j) => `<stop offset="${(j / (stops.length - 1)).toFixed(3)}" stop-color="${s}"/>`).join("") +
      `</linearGradient>`;
    const y = 620 + i * 84;
    const label = await textSvg("exo2-600", `gradient-${name}`, { size: 20, x: 72, y: y + 40 }, `fill="${C.ink}"`);
    body += label.svg;
    body += `<rect x="330" y="${y}" width="1190" height="56" rx="12" fill="url(#g${i})"/>`;
  }

  const typeTitle = await textSvg("exo2-600", "Exo 2 600 \u2014 headings and body", { size: 34, x: 72, y: 1060 }, `fill="${C.inkIndigo}"`);
  const script = await textSvg("dancing-600", "Elevating", { size: 54, x: 1020, y: 1064 }, `fill="${C.plum}"`);
  body += typeTitle.svg + script.svg;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${body}</svg>`;
  write("docs/brand-board.png", await sharp(Buffer.from(svg)).png().toBuffer());
}

console.log("Verifying rendered text");
{
  // Text is vectorised, so a renderer or font bug that drops glyphs fails
  // silently. Rasterise probe strings and check both the overall ink width and
  // that no interior gap is wide enough to be a missing character.
  const probes = [
    ["exo2-400", "surgical-gown-model", 0.02],
    ["exo2-400", "abcdefghijklmnopqrstuvwxyz0123456789", 0.01],
    ["exo2-600", "SHAIVI brand-magenta", 0.055],
    ["exo2-700", "PHOTO PENDING", 0.12],
    ["opensans-600", "SAFETY MEETS CARE", 0.22],
    ["opensans-400", "Innovating safety", 0.04],
    ["dancing-600", "Elevating", 0],
  ];

  for (const [font, str, tracking] of probes) {
    const size = 48;
    const { svg: glyphs, width } = await textSvg(font, str, { size, tracking, x: 40, y: 90 }, 'fill="#000000"');
    const canvasW = Math.ceil(width) + 120;
    const doc =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasW} 140" width="${canvasW}" height="140">` +
      `<rect width="${canvasW}" height="140" fill="#ffffff"/>${glyphs}</svg>`;
    const { data, info } = await sharp(Buffer.from(doc)).greyscale().raw().toBuffer({ resolveWithObject: true });

    const inked = [];
    for (let x = 0; x < info.width; x++) {
      let hit = false;
      for (let y = 0; y < info.height; y++) {
        if (data[y * info.width + x] < 200) {
          hit = true;
          break;
        }
      }
      inked.push(hit);
    }

    const first = inked.indexOf(true);
    const last = inked.lastIndexOf(true);
    const inkWidth = last - first;

    // Side bearings and the trailing tracking space mean ink is always a little
    // narrower than the advance width; under 80% means glyphs were lost.
    if (!(inkWidth > width * 0.8)) {
      throw new Error(`Text truncated: "${str}" in ${font} drew ${inkWidth}px of an expected ${Math.round(width)}px`);
    }

    // The widest blank run inside the ink should be an inter-word space at most.
    let gap = 0;
    let run = 0;
    for (let x = first; x <= last; x++) {
      run = inked[x] ? 0 : run + 1;
      if (run > gap) gap = run;
    }
    // A real word space is the space advance plus one tracking step, plus the
    // side bearings either side of it; anything much wider is a lost glyph.
    const spaceWidth = str.includes(" ") ? (await textSvg(font, " ", { size })).width + tracking * size : 0;
    const allowed = Math.max(size * 0.45, spaceWidth * 1.9);
    if (gap > allowed) {
      throw new Error(`Glyph missing from "${str}" in ${font}: ${gap}px gap exceeds ${Math.round(allowed)}px`);
    }
  }
  console.log("  \u00b7 all probes rendered in full");
}

console.log("\nDone. Placeholder photographs are marked PHOTO PENDING — swap in the client's originals.");

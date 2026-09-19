/**
 * Recomputes the contrast ratio of every text/background pair the site actually
 * uses, including each stop of every gradient, and fails below the WCAG 2.2 AA
 * threshold: 4.5:1 for body text, 3:1 for large text and non-text UI boundaries.
 *
 * Add a row here whenever a new colour combination appears in the UI.
 */

const TOKENS = {
  white: "#ffffff",
  black: "#000000",
  "brand-red": "#d13d23",
  "brand-purple": "#643c8e",
  "brand-cerulean": "#478cb9",
  "brand-indigo": "#34419a",
  "brand-orchid": "#9460b8",
  "brand-violet": "#6649ae",
  "brand-magenta": "#a1388b",
  "brand-plum": "#70206a",
  "brand-deep": "#491568",
  "brand-ink-indigo": "#35306a",
  "brand-charcoal": "#383332",
  ink: "#24201d",
  "royal-50": "#f9f5ff",
  "royal-100": "#efeaf6",
  "royal-200": "#ded7e9",
  "royal-300": "#c4b7d7",
  "royal-700": "#633b8c",
  "cerulean-600": "#396f92",
  "neutral-200": "#dcd9e1",
  "neutral-400": "#a09da5",
  "neutral-600": "#6a676f",
  danger: "#b42318",
  "danger-bg": "#fef3f2",
  success: "#166534",
  "success-bg": "#f0fdf4",
  surface: "#ffffff",
  "surface-tint": "#f9f5ff",
};

const GRADIENTS = {
  bridge: ["#643c8e", "#5e4e94", "#56609c", "#4777a9", "#478cb9"],
  dusk: ["#34419a", "#4b40a1", "#6042a7", "#7243a5", "#8f53b5", "#9460b8"],
  ribbon: ["#a1388b", "#b04f9f", "#8e5a97", "#653e97"],
  violet: ["#663d9e", "#6649ae", "#604eb6", "#7e63b5"],
  orb: ["#8d3e97", "#7d3d9b", "#713f9f", "#6649ae"],
};

/**
 * Every pair in the built UI.
 * `size: "large"` means 24px+ or 18.66px+ bold, where 3:1 is the AA threshold.
 * `size: "ui"` means a non-text boundary (input borders, focus rings), also 3:1.
 */
const PAIRS = [
  // Body and headings on white
  ["body text", "ink", "surface"],
  ["secondary text", "neutral-600", "surface"],
  ["H1", "brand-ink-indigo", "surface"],
  ["H2/H3 plum", "brand-plum", "surface"],
  ["eyebrow", "brand-magenta", "surface"],
  ["links", "brand-indigo", "surface"],
  ["link hover", "royal-700", "surface"],
  ["script word Elevating", "brand-plum", "surface", "large"],
  ["error text", "danger", "surface"],
  ["error text on its panel", "danger", "danger-bg"],
  ["success text", "success", "surface"],
  ["success text on its panel", "success", "success-bg"],

  // Tinted surfaces
  ["body text on tint", "ink", "surface-tint"],
  ["secondary text on tint", "neutral-600", "surface-tint"],
  ["heading on tint", "brand-plum", "surface-tint"],
  ["link on tint", "brand-indigo", "surface-tint"],
  ["chip text", "brand-plum", "royal-50"],
  ["active nav item", "brand-plum", "royal-50"],
  ["category icon", "brand-purple", "royal-50", "ui"],

  // Solid brand backgrounds
  ["button label", "white", "brand-purple"],
  ["button hover label", "white", "royal-700"],
  ["footer text", "royal-100", "brand-deep"],
  ["footer muted text", "royal-200", "brand-deep"],
  ["footer links", "royal-100", "brand-deep"],
  ["ISO badge", "white", "brand-deep"],
  ["panel body text", "royal-50", "brand-violet"],
  ["panel heading", "white", "brand-violet"],

  // Borders and outlines
  ["card border", "neutral-200", "surface", "ui-decorative"],
  ["input border", "neutral-600", "surface", "ui"],
  ["focus ring", "brand-indigo", "surface", "ui"],
  ["focus ring on dark", "white", "brand-deep", "ui"],
  ["secondary button outline", "brand-purple", "surface", "ui"],
];

// Text sits only on the flat left-hand part of the bridge band, which ends at
// the 80% stop; the stops beyond it never carry text.
const GRADIENT_PAIRS = [
  ["bridge tagline", "white", "bridge", [0, 1, 2, 3]],
  ["ribbon label", "white", "ribbon", "all"],
  ["violet panel text", "white", "violet", "all"],
  ["violet panel body", "royal-50", "violet", "all"],
  ["orb text", "white", "orb", "all"],
];

function srgbToLinear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function ratio(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

/** Alpha-composites `foreground` over `background`. */
function over(foreground, background, alpha) {
  const f = foreground.replace("#", "");
  const b = background.replace("#", "");
  let out = "#";
  for (let i = 0; i < 6; i += 2) {
    const value = Math.round(alpha * parseInt(f.slice(i, i + 2), 16) + (1 - alpha) * parseInt(b.slice(i, i + 2), 16));
    out += value.toString(16).padStart(2, "0");
  }
  return out;
}

function resolve(name) {
  const hex = TOKENS[name];
  if (!hex) throw new Error(`Unknown colour token "${name}"`);
  return hex;
}

const thresholdFor = (size) => (size === "large" || size === "ui" ? 3 : size === "ui-decorative" ? 1 : 4.5);

const rows = [];
const failures = [];

for (const [label, fg, bg, size] of PAIRS) {
  const value = ratio(resolve(fg), resolve(bg));
  const threshold = thresholdFor(size);
  const pass = value >= threshold;
  rows.push({ label: `${label} (${fg} on ${bg})`, value, threshold, pass });
  if (!pass) failures.push(`${label}: ${fg} on ${bg} is ${value.toFixed(2)}:1, needs ${threshold}:1`);
}

for (const [label, fg, gradient, stops] of GRADIENT_PAIRS) {
  const all = GRADIENTS[gradient];
  const indices = stops === "all" ? all.map((_, i) => i) : stops;
  let worst = Infinity;
  let worstStop = "";
  for (const index of indices) {
    const value = ratio(resolve(fg), all[index]);
    if (value < worst) {
      worst = value;
      worstStop = all[index];
    }
  }
  const pass = worst >= 4.5;
  rows.push({ label: `${label} (${fg} on ${gradient}, worst stop ${worstStop})`, value: worst, threshold: 4.5, pass });
  if (!pass) failures.push(`${label}: ${fg} on ${gradient} stop ${worstStop} is ${worst.toFixed(2)}:1, needs 4.5:1`);
}

// The CTA band stacks a decorative photo, the dusk gradient at 94% and a
// brand-deep scrim at 25%. The gradient's lightest stops are too light for AA on
// their own, so the composite is what has to pass — modelled here against a pure
// white photo pixel, the worst case the photo can produce.
for (const [label, fg] of [
  ["CTA band heading", "white"],
  ["CTA band body", "royal-50"],
]) {
  let worst = Infinity;
  let worstStop = "";
  for (const stop of GRADIENTS.dusk) {
    const composited = over(resolve("brand-deep"), over(stop, "#ffffff", 0.94), 0.25);
    const value = ratio(resolve(fg), composited);
    if (value < worst) {
      worst = value;
      worstStop = composited;
    }
  }
  const pass = worst >= 4.5;
  rows.push({ label: `${label} (${fg} on photo+dusk+scrim, worst ${worstStop})`, value: worst, threshold: 4.5, pass });
  if (!pass) failures.push(`${label}: ${fg} over the CTA band stack is ${worst.toFixed(2)}:1, needs 4.5:1`);
}

const width = Math.max(...rows.map((row) => row.label.length));
for (const row of rows) {
  console.log(
    `${row.pass ? "  ok " : "FAIL "}${row.label.padEnd(width)}  ${row.value.toFixed(2)}:1  (min ${row.threshold})`,
  );
}

if (failures.length > 0) {
  console.error(`\ncontrast: ${failures.length} pair(s) below threshold`);
  for (const failure of failures) console.error("  ✗", failure);
  process.exit(1);
}

console.log(`\ncontrast: ${rows.length} pairs pass WCAG 2.2 AA`);

// Rewrites every bare hex color in src/styles.css as `light-dark(<light>, <dark>)`.
// The dark value is the original; the light value is derived by inverting
// perceptual lightness in OKLCH (hue kept, chroma gamut-clipped). Idempotent:
// colors already inside light-dark() are left alone, so new dark-only colors can
// be converted by rerunning `node scripts/lightify-css.mjs`.
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../src/styles.css', import.meta.url);

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function rgbToOklch([r, g, b]) {
  [r, g, b] = [r, g, b].map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)];
}

function oklchToRgb([L, C, h]) {
  const A = C * Math.cos(h), B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(toGamma);
}

// Surfaces (L ≤ .2) keep their elevation order: the page stays a soft grey and
// raised panels get whiter. Borders and neutral text invert to grey/ink, while
// chromatic accents land mid-tone so they keep their identity on white.
const neutral = (L) =>
  L <= 0.2 ? 0.982 + (L - 0.1) * 0.18
  : L <= 0.35 ? 1 - ((L - 0.2) / 0.15) * 0.08
  : Math.min(0.92, 1 - L ** 2.2);
const accent = (L) => (L <= 0.5 ? neutral(L) : 0.95 - L * 0.5);
function mapLightness(L, C) {
  const t = Math.min(1, Math.max(0, (C - 0.03) / 0.06));
  return Math.min(1, Math.max(0.2, neutral(L) * (1 - t) + accent(L) * t));
}

const inGamut = (rgb) => rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4);

function lightVariant(hex) {
  let h = hex.slice(1);
  if (h.length <= 4) h = [...h].map((c) => c + c).join('');
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  let alpha = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  const [L, C, hue] = rgbToOklch(rgb);
  let out;
  if (L < 0.05 && alpha < 1) {
    // Translucent black = drop shadow / scrim: stay black, but softer on light paper.
    out = [0, 0, 0];
    alpha *= 0.45;
  } else {
    const L2 = mapLightness(L, C);
    let c = C * (L2 < 0.6 ? 1.1 : 0.9);
    out = oklchToRgb([L2, c, hue]);
    while (!inGamut(out) && c > 0) { c -= 0.004; out = oklchToRgb([L2, Math.max(0, c), hue]); }
  }
  const byte = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return `#${out.map(byte).join('')}${alpha < 1 ? byte(alpha) : ''}`;
}

const source = readFileSync(file, 'utf8');
let converted = 0;
// Only touch declaration blocks (innermost braces), never selectors like `#root`.
const result = source.replace(/\{([^{}]*)\}/g, (_, body) => {
  const masked = [];
  const safe = body.replace(/light-dark\([^()]*\)/g, (m) => `\u0000${masked.push(m) - 1}\u0000`);
  const next = safe.replace(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g, (hex) => {
    converted += 1;
    return `light-dark(${lightVariant(hex)},${hex})`;
  });
  return `{${next.replace(/\u0000(\d+)\u0000/g, (_, i) => masked[Number(i)])}}`;
});
writeFileSync(file, result);
console.log(`Converted ${converted} colors.`);

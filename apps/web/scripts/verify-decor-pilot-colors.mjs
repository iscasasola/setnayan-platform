// One-off verification: re-sample the dominant retintable region of each of
// the 10 decor-pilot SVGs and compare against the sampled_hex values already
// committed in supabase/migrations/20271194970382_..._pilot.sql.
//
// Uses the CORRECT method documented in reception-decor-pilot-prompts.ts's
// docblock — exclude pixels by RGB distance to the exact backgroundColor used
// per (zone, style) cell (from DECOR_PROMPTS), not a generic saturation
// threshold. scratchpad/decor-pilot/sample-colors.mjs uses the naive
// threshold and, run against these same files, mis-samples 5/10 assets as
// their own background color (verified below) — exactly the failure mode
// that docblock warns about ("a warm cream background has enough HSL
// 'saturation' ... to fool a naive filter").
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { DECOR_PROMPTS } from './reception-decor-pilot-prompts.ts';

const ROOT = path.join(process.cwd(), 'scripts', 'decor-pilot-output');
const SLUGS = {
  'elegant · simple · classic': 'elegant-simple-classic',
  'bridgerton · regal': 'bridgerton-regal',
  'editorial cream': 'editorial-cream',
  'tropical heritage': 'tropical-heritage',
  'modern minimalist': 'modern-minimalist',
};

const MIGRATION_HEX = {
  'backdrop/elegant-simple-classic.svg': '#f7c680',
  'backdrop/bridgerton-regal.svg': '#a92193',
  'backdrop/editorial-cream.svg': '#d98ba6',
  'backdrop/tropical-heritage.svg': '#9cb29a',
  'backdrop/modern-minimalist.svg': '#4a3b45',
  'ceiling/elegant-simple-classic.svg': '#c9a059',
  'ceiling/bridgerton-regal.svg': '#8c6ba6',
  'ceiling/editorial-cream.svg': '#d98ba6',
  'ceiling/tropical-heritage.svg': '#9cb29a',
  'ceiling/modern-minimalist.svg': '#4a3b45',
};

const hex = (r, g, b) => '#' + [r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
function hexToRgb(h) {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function rgbDist(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt(0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db) / 2.55;
}

async function sampleOne(svgPath, backgroundColor) {
  const [bgR, bgG, bgB] = hexToRgb(backgroundColor);
  const img = sharp(svgPath, { density: 96 }).resize(300, 300, { fit: 'inside' });
  const { data, info } = await img.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const buckets = new Map();
  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    // Exclude pixels close to the KNOWN background color (RGB distance, not
    // a generic saturation threshold — see docblock).
    if (rgbDist(r, g, b, bgR, bgG, bgB) < 12) continue;
    // Exclude near-white / near-black line-art strokes.
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum > 235 || lum < 20) continue;
    const key = `${Math.round(r / 12)}_${Math.round(g / 12)}_${Math.round(b / 12)}`;
    const cur = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    cur.count++; cur.r += r; cur.g += g; cur.b += b;
    buckets.set(key, cur);
  }
  let best = null;
  for (const v of buckets.values()) if (!best || v.count > best.count) best = v;
  const totalPixels = width * height;
  if (!best) return { sampledHex: '#CCCCCC', matchedFrac: 0 };
  return {
    sampledHex: hex(best.r / best.count, best.g / best.count, best.b / best.count),
    matchedFrac: +((best.count / totalPixels) * 100).toFixed(1),
  };
}

async function run() {
  const rows = [];
  for (const entry of DECOR_PROMPTS) {
    const slug = SLUGS[entry.style];
    const rel = `${entry.zone}/${slug}.svg`;
    const filePath = path.join(ROOT, entry.zone, `${slug}.svg`);
    if (!fs.existsSync(filePath)) { rows.push({ rel, error: 'MISSING FILE' }); continue; }
    const { sampledHex, matchedFrac } = await sampleOne(filePath, entry.backgroundColor);
    const migrationHex = MIGRATION_HEX[rel] ?? null;
    const deltaE = migrationHex
      ? rgbDist(...hexToRgb(sampledHex), ...hexToRgb(migrationHex))
      : null;
    rows.push({ rel, backgroundColor: entry.backgroundColor, sampledHex, matchedFrac, migrationHex, deltaE });
  }
  console.log(JSON.stringify(rows, null, 2));
}
run();

/**
 * scripts/build-cipher-fonts.mts — cipher-monogram font prebuild.
 *
 * Generates the static glyph-geometry JSON the cipher editor + save path
 * share (apps/web/public/cipher/). Run once (or after changing the font set):
 *
 *   pnpm tsx scripts/build-cipher-fonts.mts
 *
 * Outputs (committed — deterministic, no runtime font parsing):
 *   public/cipher/strokes/<key>.json — single-line fonts: A–Z centerline
 *     substrokes (resampled open polylines, Y-flipped to screen space,
 *     centered on the glyph bbox) + the index of the MAIN (longest) substroke
 *     used for the restroke join.
 *   public/cipher/glyphs/<key>.json — filled fonts: A–Z outline path `d`
 *     (opentype.js) + bbox, centered on the glyph bbox.
 *
 * WHY paths instead of <text>: the saved monogram renders via data-URI <img>
 * on the wedding site hero — an inert context that cannot load webfonts. Pure
 * paths are self-contained everywhere (hero, print, QR pack). Sources are all
 * SIL OFL — see assets/cipher-fonts/LICENSES.md.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import opentype from 'opentype.js';
import { parseGlyphSubstrokes, resample, type Pt } from '../lib/calligraphy';

const ASSETS = join(import.meta.dirname, '../assets/cipher-fonts');
const OUT = join(import.meta.dirname, '../public/cipher');
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const STROKE_FONTS: Record<string, string> = {
  allure: 'EMSAllure.svg',
  society: 'EMSSociety.svg',
  swiss: 'EMSSwiss.svg',
  decorous: 'EMSDecorousScript.svg',
  invite: 'EMSInvite.svg',
};

const FILLED_FONTS: Record<string, string> = {
  'mr-de-haviland': 'mr-de-haviland.ttf',
  'pinyon-script': 'pinyon-script.ttf',
  'herr-von-muellerhoff': 'herr-von-muellerhoff.ttf',
  cinzel: 'cinzel.ttf',
  cormorant: 'cormorant.ttf',
  'bodoni-moda': 'bodoni-moda.ttf',
  'libre-caslon-display': 'libre-caslon-display.ttf',
  vidaloka: 'vidaloka.ttf',
  'luxurious-script': 'luxurious-script.ttf',
  tangerine: 'tangerine.ttf',
};

mkdirSync(join(OUT, 'strokes'), { recursive: true });
mkdirSync(join(OUT, 'glyphs'), { recursive: true });

function bbox(pts: Pt[]) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const p of pts) {
    x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y);
    x2 = Math.max(x2, p.x); y2 = Math.max(y2, p.y);
  }
  return { x1, y1, x2, y2 };
}

// ── Single-line fonts ───────────────────────────────────────────────────────
for (const [key, file] of Object.entries(STROKE_FONTS)) {
  const svg = readFileSync(join(ASSETS, file), 'utf8');
  const glyphs: Record<string, { subs: number[][][]; main: number }> = {};
  for (const ch of LETTERS) {
    const m = svg.match(new RegExp(`<glyph unicode="${ch}"[^>]*\\sd="([^"]*)"`));
    if (!m) continue;
    // parseGlyphSubstrokes Y-flips to screen space; resample for smooth pen.
    const subs = parseGlyphSubstrokes(m[1]).map((s) => resample(s, 18));
    if (!subs.length) continue;
    const bb = bbox(subs.flat());
    const cx = (bb.x1 + bb.x2) / 2, cy = (bb.y1 + bb.y2) / 2;
    // Longest substroke = the connecting writing stroke (entry/exit carrier).
    let main = 0, best = -1;
    subs.forEach((s, i) => {
      let len = 0;
      for (let j = 1; j < s.length; j++) len += Math.hypot(s[j].x - s[j - 1].x, s[j].y - s[j - 1].y);
      if (len > best) { best = len; main = i; }
    });
    glyphs[ch] = {
      subs: subs.map((s) => s.map((p) => [Math.round(p.x - cx), Math.round(p.y - cy)])),
      main,
    };
  }
  const out = { kind: 'stroke', key, glyphs };
  writeFileSync(join(OUT, 'strokes', `${key}.json`), JSON.stringify(out));
  console.log(`strokes/${key}.json — ${Object.keys(glyphs).length} glyphs, ${(JSON.stringify(out).length / 1024) | 0}KB`);
}

// ── Filled fonts (outline → path d, centered on glyph bbox) ────────────────
const SIZE = 1000; // render em — large for precision; render scales down
for (const [key, file] of Object.entries(FILLED_FONTS)) {
  const buf = readFileSync(join(ASSETS, file));
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const glyphs: Record<string, { d: string; w: number; h: number }> = {};
  for (const ch of LETTERS) {
    const path = font.getPath(ch, 0, 0, SIZE);
    const bb = path.getBoundingBox();
    if (!isFinite(bb.x1) || bb.x2 - bb.x1 < 1) continue;
    const cx = (bb.x1 + bb.x2) / 2, cy = (bb.y1 + bb.y2) / 2;
    // Recompute the path translated so the bbox center sits at the origin —
    // identical centering logic to the stroke fonts, so placement math is
    // shared. opentype Path has no transform API; re-render at offset.
    const path2 = font.getPath(ch, -cx, -cy, SIZE);
    glyphs[ch] = {
      d: path2.toPathData(1),
      w: Math.round(bb.x2 - bb.x1),
      h: Math.round(bb.y2 - bb.y1),
    };
  }
  const out = { kind: 'filled', key, glyphs };
  writeFileSync(join(OUT, 'glyphs', `${key}.json`), JSON.stringify(out));
  console.log(`glyphs/${key}.json — ${Object.keys(glyphs).length} glyphs, ${(JSON.stringify(out).length / 1024) | 0}KB`);
}
console.log('cipher font prebuild complete');

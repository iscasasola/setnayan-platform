#!/usr/bin/env node
/**
 * 🖨 Generates `lib/print-seal-art.generated.ts` — the four v84 seals (Top 10 · Clients' Choice · Most In-Demand ·
 * Verified Partner) READY FOR PAPER, from the owner-approved prototype `badge-milestones_v84.html` (`const SEALS`).
 * No. 1 is not here: the app already ships it (`app/_components/award/no1-seal-svg.ts`).
 *
 * What changes from the prototype, and only this:
 *   · every <animate>/<animateTransform> is dropped (paper does not move — the base pose stays);
 *   · the screen-only light (`.sheen`, `.glint`, opacity 0 at rest) and the plaque's `.sl-slot` (display:none off
 *     the plaque — the prototype's own `stripSlot`) are dropped;
 *   · every <text> becomes Cinzel Bold OUTLINES (a print shop has no Cinzel; the same reason as the No. 1 art), laid
 *     out the way SVG lays them: `text-anchor="middle"`, letter-spacing between glyphs, and on a <textPath> each
 *     glyph's middle on the path, turned to its tangent;
 *   · the year on the ribbon ("2026", "SINCE 2026") becomes a `{{YEAR}}` slot, filled with the AWARD's own year;
 *   · every def id gets a `§` prefix (each copy on a print gets its own).
 *
 * Usage (from apps/web):  node scripts/gen-print-seal-art.mjs <badge-milestones_v84.html> <Cinzel-Bold.ttf>
 * Cinzel Bold: Google Fonts' static 700 (the same outlines as the No. 1 art's digits — `CINZEL_DIGITS`).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import opentype from 'opentype.js';

const [, , protoPath, fontPath] = process.argv;
if (!protoPath || !fontPath) {
  console.error('usage: node scripts/gen-print-seal-art.mjs <badge-milestones_v84.html> <Cinzel-Bold.ttf>');
  process.exit(2);
}
const html = readFileSync(protoPath, 'utf8');
const font = opentype.parse(readFileSync(fontPath).buffer);
if (font.tables.os2.usWeightClass !== 700) throw new Error('need Cinzel Bold (700)');
const at = html.indexOf('const SEALS={');
const SEALS = JSON.parse(html.slice(at + 12, html.indexOf('};', at) + 1));
const KEYS = ['medal', 'heart', 'crest', 'partner'];
const r3 = (n) => +n.toFixed(3);
const UPM = font.unitsPerEm;

/** Drops the element opened at `a` (a <g …> or <rect …/>) with its children. */
function dropAt(sv, a) {
  const tag = /^<(\w+)/.exec(sv.slice(a))[1];
  const open = sv.indexOf('>', a);
  if (sv[open - 1] === '/') return sv.slice(0, a) + sv.slice(open + 1);
  const re = new RegExp(`<${tag}[\\s>]|</${tag}>`, 'g');
  re.lastIndex = a;
  let d = 0;
  let m;
  while ((m = re.exec(sv))) {
    if (m[0] === `</${tag}>`) {
      if (--d === 0) return sv.slice(0, a) + sv.slice(re.lastIndex);
    } else d++;
  }
  throw new Error('unbalanced ' + tag);
}
function dropClass(sv, cls) {
  for (;;) {
    const k = sv.indexOf(`class="${cls}"`);
    if (k < 0) return sv;
    sv = dropAt(sv, sv.lastIndexOf('<', k));
  }
}

function glyphsOf(str) {
  const gs = font.stringToGlyphs(str);
  return gs.map((g, i) => ({ g, adv: g.advanceWidth + (i < gs.length - 1 ? font.getKerningValue(g, gs[i + 1]) : 0) }));
}
const glyphD = (g) => g.path.toPathData(1);

/** A point function for the two path shapes the seals' textPaths use: a circular arc and one cubic. */
function pathFn(d) {
  const n = (d.match(/-?\d*\.?\d+/g) || []).map(Number);
  if (/A/.test(d)) {
    const [x0, y0, r, , , , , x1, y1] = n;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    if (Math.abs(Math.hypot(x1 - x0, y1 - y0) / 2 - r) > 0.01) throw new Error('arc is not a half circle: ' + d);
    return (u) => [cx + r * Math.cos(Math.PI + u * Math.PI), cy + r * Math.sin(Math.PI + u * Math.PI)];
  }
  if (/C/.test(d)) {
    const [x0, y0, x1, y1, x2, y2, x3, y3] = n;
    return (u) => {
      const v = 1 - u;
      const a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, e = u * u * u;
      return [a * x0 + b * x1 + c * x2 + e * x3, a * y0 + b * y1 + c * y2 + e * y3];
    };
  }
  throw new Error('unknown textPath shape: ' + d);
}
function sampler(pt) {
  const NS = 400;
  const P = [pt(0)];
  const L = [0];
  for (let i = 1; i <= NS; i++) {
    const q = pt(i / NS);
    const p = P[i - 1];
    P.push(q);
    L.push(L[i - 1] + Math.hypot(q[0] - p[0], q[1] - p[1]));
  }
  return {
    len: L[NS],
    at(s) {
      let i = 1;
      while (i < NS && L[i] < s) i++;
      const a = P[i - 1];
      const b = P[i];
      const t = (s - L[i - 1]) / (L[i] - L[i - 1] || 1);
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI];
    },
  };
}

/** Outlines `str` on the path `d` (`startOffset="50%" text-anchor="middle"`). */
function onPath(str, d, size, ls) {
  const s = sampler(pathFn(d));
  const k = size / UPM;
  const gl = glyphsOf(str);
  const w = gl.reduce((a, x) => a + x.adv * k, 0) + ls * (gl.length - 1);
  let pen = s.len / 2 - w / 2;
  return gl
    .map(({ g, adv }) => {
      const a = adv * k;
      const [x, y, ang] = s.at(pen + a / 2);
      pen += a + ls;
      if (!g.path.commands.length) return '';
      return `<g transform="translate(${r3(x)} ${r3(y)}) rotate(${r3(ang)})"><path transform="scale(${r3(k)} ${r3(-k)}) translate(${r3(-g.advanceWidth / 2)} 0)" d="${glyphD(g)}"/></g>`;
    })
    .join('');
}
/** Outlines `str` centred on (x, y) (`text-anchor="middle"`). */
function straight(str, x, y, size, ls) {
  const k = size / UPM;
  const gl = glyphsOf(str);
  const w = gl.reduce((a, g) => a + g.adv * k, 0) + ls * (gl.length - 1);
  let pen = x - w / 2;
  return gl
    .map(({ g, adv }) => {
      const out = g.path.commands.length ? `<path transform="translate(${r3(pen)} ${r3(y)}) scale(${r3(k)} ${r3(-k)})" d="${glyphD(g)}"/>` : '';
      pen += adv * k + ls;
      return out;
    })
    .join('');
}

const YEAR_RE = /^(.*?)(20\d\d)$/;
const slots = {};
const out = {};
for (const key of KEYS) {
  let sv = SEALS[key];
  sv = sv.replace(/<(animate|animateTransform|animateMotion|set)\b[^>]*\/>/g, '');
  if (/<animate/.test(sv)) throw new Error(key + ': an animation was not self-closing');
  for (const c of ['sheen', 'glint', 'sl-slot']) sv = dropClass(sv, c);
  sv = sv.replace(/ class="[^"]*"/g, '');
  // the path ids the textPaths ride, with their shapes
  const pathD = {};
  for (const m of sv.matchAll(/<path id="([^"]+)" d="([^"]+)"/g)) pathD[m[1]] = m[2];
  let slot = null;
  sv = sv.replace(/<text\b([^>]*)>([\s\S]*?)<\/text>/g, (_, attrs, inner) => {
    const style = /style="([^"]*)"/.exec(attrs)?.[1] ?? '';
    const size = Number(/font-size:([\d.]+)px/.exec(style)?.[1]);
    const ls = Number(/letter-spacing:([\d.]+)px/.exec(style)?.[1] ?? 0);
    if (!/font-weight:700/.test(style) || !/Cinzel/.test(style) || !size) throw new Error(`${key}: unexpected text style ${style}`);
    if (!/text-anchor="middle"/.test(attrs)) throw new Error(`${key}: text not centred`);
    const tp = /<textPath href="#([^"]+)"[^>]*>([^<]*)<\/textPath>/.exec(inner);
    if (tp) {
      const d = pathD[tp[1]];
      if (!d) throw new Error(`${key}: no path ${tp[1]}`);
      const words = tp[2].trim();
      const y = YEAR_RE.exec(words);
      if (y) {
        if (slot) throw new Error(`${key}: two year slots`);
        slot = { lead: y[1], d, size, ls };
        return '{{YEAR}}';
      }
      return onPath(words, d, size, ls);
    }
    if (/</.test(inner)) throw new Error(`${key}: nested text markup`);
    const x = Number(/\bx="([\d.-]+)"/.exec(attrs)[1]);
    const yy = Number(/\by="([\d.-]+)"/.exec(attrs)[1]);
    if (YEAR_RE.test(inner.trim())) throw new Error(`${key}: a year outside a textPath`);
    return straight(inner.trim(), x, yy, size, ls);
  });
  if (/<text/.test(sv)) throw new Error(key + ': text left');
  if (!slot) throw new Error(key + ': no year slot');
  slots[key] = slot;
  // § on every def id and every reference to one
  const ids = [...sv.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  for (const id of new Set(ids)) {
    const e = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    sv = sv.replace(new RegExp(` id="${e}"`, 'g'), ` id="§${id}"`).replace(new RegExp(`#${e}(?=["')])`, 'g'), `#§${id}`);
  }
  sv = sv.replace(/^<svg /, '<svg xmlns="http://www.w3.org/2000/svg" ');
  out[key] = sv;
}

// The glyphs a year slot can need: its words before the year, and the ten digits.
const need = new Set('0123456789');
for (const s of Object.values(slots)) for (const ch of s.lead) need.add(ch);
const glyphs = {};
for (const ch of [...need].sort()) {
  const g = font.charToGlyph(ch);
  glyphs[ch] = [g.advanceWidth, glyphD(g)];
}
const kern = {};
for (const a of need) for (const b of need) {
  const v = font.getKerningValue(font.charToGlyph(a), font.charToGlyph(b));
  if (v) kern[a + b] = v;
}

const ts = `/**
 * 🖨 GENERATED by \`scripts/gen-print-seal-art.mjs\` from the owner-approved \`badge-milestones_v84.html\` (\`const SEALS\`)
 * — do not edit by hand; regenerate. The four seals still, for paper: no animation, no screen-only light, every letter a
 * Cinzel Bold OUTLINE. \`§\` marks every def id (each copy gets its own prefix); \`{{YEAR}}\` is where the award's year
 * rides the ribbon (\`PRINT_SEAL_YEAR_SLOT\`, set by \`lib/print-seal-art.ts\`).
 * ⚠ ~240 KB: SERVER ONLY — imported by the print routes' art loader, never by a client file (guarded by
 * \`lib/prints-wear-only-v84-badges.test.ts\`).
 */
// prettier-ignore
export const PRINT_SEAL_SVG = ${JSON.stringify(out)} as const;
// prettier-ignore
export const PRINT_SEAL_YEAR_SLOT = ${JSON.stringify(slots)} as const;
// prettier-ignore
export const PRINT_SEAL_GLYPHS: Record<string, readonly [number, string]> = ${JSON.stringify(glyphs)};
// prettier-ignore
export const PRINT_SEAL_KERN: Record<string, number> = ${JSON.stringify(kern)};
export const PRINT_SEAL_UPM = ${UPM};
`;
writeFileSync(new URL('../lib/print-seal-art.generated.ts', import.meta.url), ts);
console.log('wrote lib/print-seal-art.generated.ts', Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])), slots);

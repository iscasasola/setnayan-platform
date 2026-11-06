// NOTE: deliberately NOT 'server-only' — like lib/glyph-path.ts it runs anywhere Node runs, so `tsx --test` can draw a
// REAL print, rasterise it and scan its QR back (lib/supplier-prints-decode.test.ts).
import QRCode from 'qrcode';
import { loadOtFont, type OtFont } from '@/lib/glyph-path';
import { setnayanMarkSvg } from '@/lib/qr-style-svg';
import { badgePill } from '@/lib/shop-badge-print';
import { formatCount } from '@/lib/format-number';
import type { ShopBadge } from '@/lib/shop-badges';
import {
  PRINT_QR,
  pieceHasQr,
  printHidden,
  type PrintBlock,
  type PrintDesign,
  type PrintFace,
  type PrintPiece,
  type PrintSide,
  type PrintQrMode,
} from '@/lib/supplier-prints';

/**
 * 🖨 renderPrint — THE ONE RENDERER of the supplier's prints (prototype `renderPiece`, "used by the gallery, the big
 * view, Save, the contact sheets and the photos"). It draws a piece as ONE SVG:
 *
 *   · the screen shows it (`<img>` of `/api/vendor/prints`), the photos warp that same image onto their surfaces, and
 *     Save hands over the same drawing at its exact size with a 3 mm bleed — so what the supplier sees is what prints;
 *   · 🔑 EVERY LETTER IS OUTLINED from a TTF bundled in `public/print-fonts/` (the fonts each look names in the
 *     prototype, at the weights it draws): a print shop's machine has none of these faces, and librsvg on a lambda
 *     draws a `<text>` blank (the finding `lib/glyph-path.ts` records). Nothing here asks the host for a font;
 *   · the QR is the app's own `qrcode` library at level H (the shop's real address, never a drawn pattern), dark on a
 *     white plate, with every ornament masked out of the piece's keep-out zone;
 *   · the badges on the big pieces are the shipped pill (`badgePill`, `lib/shop-badge-print.ts`).
 *
 * The layout is the prototype's CSS, re-stated in piece units (width = 100, so 1 unit = the prototype's 1cqw): each
 * piece has ONE fixed layout, and a design only sets the look. The words are the prototype's, never invented.
 */

/** The shop's facts, as read at print time (`lib/supplier-prints.server.ts`). Nothing here is typed. */
export type PrintShop = {
  name: string;
  /** The trade line under the name. Empty = none. */
  line: string;
  /** The monogram's letters (`shopInitials`). */
  ini: string;
  /** `setnayan.com/v/<slug>` — the card back's handle. */
  handle: string;
  verified: boolean;
  rating: { avg: number; count: number } | null;
  /** Every badge the shop wears today, in the shipped order (`shopBadges`). */
  badges: readonly ShopBadge[];
  /*
   * PRINTS BY PURPOSE AND SIZE (owner 2026-11-06) — each one optional: a fact the shop does not have is absent, and
   * its block is not printed (never a zero, never an empty box). NO PRICE and NO phone/email exist here at all.
   */
  /** `vendor_profiles.logo_url`, drawn in the monogram's place. */
  logo?: PrintImage | null;
  /** `vendor_profiles.tagline`. */
  tagline?: string | null;
  /** `vendor_services.title` of the shop's active services, in their order — names only, never a price. */
  services?: readonly string[];
  /** "In business since 2016" (`in_business_since_year`). */
  since?: string | null;
  /** The print's reach line — a ring or nationwide (`shopReachLine`), else the city alone (`printReachLine`). */
  area?: string | null;
  /** The Page hero when set, else the first portfolio photo. */
  photo?: PrintImage | null;
  /** `microsite_about` — only where the plan shows it on the page. */
  about?: string | null;
  /** The shop's own verified web address (`ownWebAddress`), printed above the Setnayan one. */
  ownDomain?: string | null;
};

/** A picture a print carries — a `data:` URI the route made from the shop's stored file, and its pixel size. */
export type PrintImage = { href: string; w: number; h: number };

/** The personal calling card's front (owner 2026-11-06, "Yes"): the member's account name and, only when set, their Team label. */
export type PrintMember = { name: string; role: string | null };

export type PrintQr = { mode: PrintQrMode; url: string };

const FACE_FILE: Readonly<Record<PrintFace, string>> = {
  'cormorant-700': 'cormorant-700',
  'cormorant-600': 'cormorant-600',
  'playfair-700': 'playfair-700',
  'playfair-500': 'playfair-500',
  'playfair-500i': 'playfair-500i',
  'bodoni-600': 'bodoni-600',
  'caslon-text-700': 'caslon-text-700',
  'caslon-text-400': 'caslon-text-400',
  'jost-500': 'jost-500',
  'jost-600': 'jost-600',
  'jost-700': 'jost-700',
  'syne-800': 'syne-800',
  'syne-700': 'syne-700',
  'manrope-500': 'manrope-500',
  'italiana-400': 'italiana-400',
  'fraunces-700': 'fraunces-700',
  'marcellus-400': 'marcellus-400',
};
export const PRINT_FACE_FILES = Object.values(FACE_FILE).map((f) => `public/print-fonts/${f}.ttf`);

const faces = new Map<PrintFace, OtFont>();
function font(f: PrintFace): OtFont {
  let o = faces.get(f);
  if (!o) {
    o = loadOtFont(`public/print-fonts/${FACE_FILE[f]}.ttf`);
    faces.set(f, o);
  }
  return o;
}

const n = (v: number) => String(Math.round(v * 1000) / 1000);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A colour as SVG paint attributes — rgba() split into a hex and an opacity (some RIPs read no CSS colour 4). */
function paint(c: string, attr: 'fill' | 'stroke' = 'fill'): string {
  if (c.startsWith('url(')) return `${attr}="${c}"`;
  const m = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/.exec(c);
  if (!m) return `${attr}="${c}"`;
  const hex = '#' + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('');
  return `${attr}="${hex}" ${attr}-opacity="${m[4]}"`;
}

/* ── type ─────────────────────────────────────────────────────────────────────────────────────────────────────── */

type PathCmd = { type: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number };
type Glyphish = { index: number; advanceWidth?: number; getPath: (x: number, y: number, size: number) => { commands: PathCmd[] } };

/** A glyph's outline as path data, written here — opentype.js's own `toPathData` can print a NaN for a point it
 *  rounds (measured: the S of "WEDDINGS" at 4 units in Jost 500), and one NaN makes a renderer drop the rest. */
function pathData(cmds: PathCmd[]): string {
  let d = '';
  for (const c of cmds) {
    if (c.type === 'Z') d += 'Z';
    else if (c.type === 'M' || c.type === 'L') d += `${c.type}${n(c.x!)} ${n(c.y!)}`;
    else if (c.type === 'Q') d += `Q${n(c.x1!)} ${n(c.y1!)} ${n(c.x!)} ${n(c.y!)}`;
    else if (c.type === 'C') d += `C${n(c.x1!)} ${n(c.y1!)} ${n(c.x2!)} ${n(c.y2!)} ${n(c.x!)} ${n(c.y!)}`;
  }
  return d;
}
type FontLike = OtFont & {
  unitsPerEm: number;
  charToGlyph: (c: string) => Glyphish;
  getKerningValue: (a: Glyphish, b: Glyphish) => number;
  tables: { hhea: { ascender: number; descender: number } };
};

/** Glyph by glyph (no shaping — Manrope's GSUB trips opentype.js), with the face's kerning and `ls` em after each. */
function run(face: PrintFace, s: string, size: number, ls: number, x = 0, y = 0, draw = false): { w: number; d: string } {
  const f = font(face) as unknown as FontLike;
  const scale = size / f.unitsPerEm;
  const space = f.charToGlyph(' ');
  let pen = x;
  let prev: Glyphish | null = null;
  let d = '';
  const chars = Array.from(s);
  chars.forEach((ch, i) => {
    let g = f.charToGlyph(ch);
    if (!g || g.index === 0) g = space; // a glyph the face lacks is a gap, never a .notdef box on a tarp
    if (prev) {
      try {
        pen += f.getKerningValue(prev, g) * scale;
      } catch {
        /* no kerning for this pair */
      }
    }
    if (draw && g !== space) d += pathData(g.getPath(pen, y, size).commands);
    pen += (g.advanceWidth ?? 0) * scale + (i < chars.length - 1 ? ls * size : 0);
    prev = g;
  });
  return { w: pen - x, d };
}

function metrics(face: PrintFace): { asc: number; desc: number } {
  const f = font(face) as unknown as FontLike;
  return { asc: f.tables.hhea.ascender / f.unitsPerEm, desc: -f.tables.hhea.descender / f.unitsPerEm };
}

type Box = { w: number; h: number; draw: (x: number, y: number) => string };
const EMPTY: Box = { w: 0, h: 0, draw: () => '' };

let gradSeq = 0;
/** A CSS `linear-gradient(<deg>, …)` over a box, as an SVG gradient in user space. */
function cssGrad(stops: readonly string[], x: number, y: number, w: number, h: number, deg: number): { id: string; def: string } {
  const id = `g${(gradSeq = (gradSeq + 1) % 1e9)}`;
  const a = (deg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const L = Math.abs(w * dx) + Math.abs(h * dy);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const def =
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n(cx - (dx * L) / 2)}" y1="${n(cy - (dy * L) / 2)}" x2="${n(cx + (dx * L) / 2)}" y2="${n(cy + (dy * L) / 2)}">` +
    stops.map((c, i) => `<stop offset="${n(i / Math.max(1, stops.length - 1))}" stop-color="${c}"/>`).join('') +
    `</linearGradient>`;
  return { id, def };
}

/** The words broken into lines no wider than `maxW` — and, for `balance`, as even as that line count allows. */
function wrap(words: string[], measure: (s: string) => number, maxW: number, balance: boolean): string[] {
  const greedy = (W: number) => {
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (!cur || measure(t) <= W) cur = t;
      else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };
  const first = greedy(maxW);
  if (!balance || first.length < 2) return first;
  let lo = Math.max(...words.map(measure));
  let hi = maxW;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (greedy(mid).length <= first.length) hi = mid;
    else lo = mid;
  }
  return greedy(hi);
}

/**
 * Every line of words a print draws, while `renderPrint({ words })` runs — the letters are OUTLINED, so the SVG holds no
 * text to search; this is how a guard reads what was printed (no price, no phone, no email). Sync: set and cleared
 * inside one `renderPrint` call.
 */
let traced: string[] | null = null;

type TextOpts = { face: PrintFace; size: number; ls?: number; lh: number; upper?: boolean; color: string; align: 'start' | 'middle'; maxW: number; balance?: boolean; foil?: readonly string[] | null; maxLines?: number };

function textBox(raw: string, o: TextOpts, defs: string[]): Box {
  const s = o.upper ? raw.toUpperCase() : raw;
  if (!s.trim()) return EMPTY;
  const ls = o.ls ?? 0;
  const measure = (t: string) => run(o.face, t, o.size, ls).w;
  let lines = wrap(s.split(/\s+/).filter(Boolean), measure, o.maxW, o.balance ?? false);
  if (o.maxLines && lines.length > o.maxLines) {
    // the prototype's line clamp: the kept lines, the last one ending in an ellipsis that still fits
    lines = lines.slice(0, o.maxLines);
    const words = lines[lines.length - 1]!.split(' ');
    while (words.length > 1 && measure(`${words.join(' ')}…`) > o.maxW) words.pop();
    lines[lines.length - 1] = `${words.join(' ').replace(/[\s,.;:—-]+$/, '')}…`;
  }
  const widths = lines.map(measure);
  const w = Math.min(o.maxW, Math.max(...widths));
  const { asc, desc } = metrics(o.face);
  const lineH = o.lh * o.size;
  const base = (lineH - (asc + desc) * o.size) / 2 + asc * o.size;
  return {
    w,
    h: lines.length * lineH,
    draw: (x, y) => {
      traced?.push(...lines);
      let d = '';
      lines.forEach((ln, i) => {
        const lx = o.align === 'middle' ? x + (w - widths[i]!) / 2 : x;
        d += run(o.face, ln, o.size, ls, lx, y + i * lineH + base, true).d;
      });
      if (!o.foil) return `<path d="${d}" ${paint(o.color)}/>`;
      const g = cssGrad(o.foil, x, y, w, lines.length * lineH, 100);
      defs.push(g.def);
      return `<path d="${d}" fill="url(#${g.id})"/>`;
    },
  };
}

function stack(items: Box[], gap: number, align: 'start' | 'middle'): Box {
  const kept = items;
  const w = Math.max(0, ...kept.map((b) => b.w));
  const h = kept.reduce((a, b) => a + b.h, 0) + gap * Math.max(0, kept.length - 1);
  return {
    w,
    h,
    draw: (x, y) => {
      let out = '';
      let cy = y;
      for (const b of kept) {
        out += b.draw(align === 'middle' ? x + (w - b.w) / 2 : x, cy);
        cy += b.h + gap;
      }
      return out;
    },
  };
}

/* ── the parts every piece is made of (the prototype's .mono · .nm · .rule · .sub · .meta · .qr · .mk) ─────────── */

const HAIR = 0.3; // the prototype's 1 px hairline, at the size its gallery draws a piece

type Ctx = {
  d: PrintDesign;
  /** The shop's facts AFTER the `On your prints ▾` pick (`onPrint`) — a block switched off is simply absent here. */
  shop: PrintShop;
  defs: string[];
  qr: PrintQr | null;
  modules: { size: number; get: (r: number, c: number) => boolean } | null;
  /** The web address block — null when switched off. */
  reach: { own: string | null; handle: string } | null;
  /** Where the code was drawn (plate + caption) — the ornament's keep-out zone follows it. */
  qrAt?: { x: number; y: number; w: number; h: number };
};

/**
 * 🔒 NO PRICE, NO DOOR OUT — the words a supplier typed (tagline, About, service titles, role) reach a print only through
 * here: an email, a phone number or a peso amount inside them is taken out, so a print never carries a price or a way
 * around the app (owner 2026-11-06: no prices on prints · `lib/no-door-out-of-the-app.test.ts`). Empty after → null.
 */
export function printSafe(s: string | null | undefined): string | null {
  if (!s) return null;
  const out = s
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ' ')
    .replace(/(?:₱|\bPHP|\bPhp|\bP(?=\s?\d))\s?\d[\d,.]*(?:\s?[kKmM]\b)?/g, ' ')
    .replace(/\d[\d,.]*\s?(?:pesos?|PHP)\b/gi, ' ')
    .replace(/₱/g, ' ')
    .replace(/\+?\(?\d[\d\s().-]{5,}\d/g, (m) => (m.replace(/\D/g, '').length >= 7 ? ' ' : m))
    .replace(/\s+/g, ' ')
    .trim();
  return out.replace(/^[·|,/\-–—:\s]+|[·|,/\-–—:(\s]+$/g, '').replace(/\s+([·|,])(\s+[·|,])+/g, ' $1') || null;
}

/** The shop's facts with the switched-off blocks taken out — every block reads THIS, so one switch reaches every piece. */
export function onPrint(shop: PrintShop, hidden: readonly PrintBlock[]): { shop: PrintShop; reach: Ctx['reach'] } {
  const off = new Set(hidden);
  const txt = (s: string | null | undefined) => printSafe(s);
  return {
    shop: {
      ...shop,
      logo: off.has('logo') ? null : (shop.logo ?? null),
      tagline: off.has('tagline') ? null : txt(shop.tagline),
      services: off.has('services') ? [] : [...new Set((shop.services ?? []).map((t) => txt(t)).filter((t): t is string => !!t))],
      rating: off.has('stars') ? null : shop.rating,
      badges: off.has('badges') ? [] : shop.badges,
      since: off.has('since') ? null : txt(shop.since),
      area: off.has('area') ? null : txt(shop.area),
      photo: off.has('photo') ? null : (shop.photo ?? null),
      about: off.has('about') ? null : txt(shop.about),
      ownDomain: off.has('reach') ? null : txt(shop.ownDomain),
      // a trade line that IS the tagline (a shop with no services) leaves with the tagline
      line: off.has('tagline') && txt(shop.tagline) && txt(shop.line) === txt(shop.tagline) ? '' : (txt(shop.line) ?? ''),
    },
    reach: off.has('reach') ? null : { own: txt(shop.ownDomain), handle: shop.handle },
  };
}

function mono(c: Ctx, D: number, fs: number): Box {
  const ini = c.shop.ini;
  const t = textBox(ini, { face: c.d.monoFace, size: fs, ls: 0.06, lh: 1, color: c.d.acc, align: 'middle', maxW: D * 2, foil: c.d.foil }, c.defs);
  return {
    w: D,
    h: D,
    draw: (x, y) =>
      `<circle cx="${n(x + D / 2)}" cy="${n(y + D / 2)}" r="${n(D / 2 - HAIR / 2)}" fill="none" ${paint(c.d.acc, 'stroke')} stroke-width="${HAIR}"/>` +
      t.draw(x + (D - t.w) / 2, y + (D - t.h) / 2),
  };
}

function nmK(name: string, nmFit: number): number {
  const L = name.length;
  const W = Math.max(...name.split(/\s+/).map((w) => w.length));
  const kL = L <= 10 ? 1 : L <= 16 ? 0.9 : L <= 24 ? 0.78 : L <= 34 ? 0.68 : 0.6;
  const kW = W <= 8 ? 1 : W <= 11 ? 0.86 : W <= 14 ? 0.74 : 0.62;
  return Math.min(kL, kW) * nmFit;
}

function nm(c: Ctx, nmS: number, maxW: number, align: 'start' | 'middle'): Box {
  let size = nmS * nmK(c.shop.name, c.d.nmFit);
  const o = { face: c.d.nameFace, ls: c.d.nameLs, lh: 1.04, upper: c.d.nameUpper, color: c.d.ink, align, maxW, balance: true, foil: c.d.foil };
  // overflow-wrap: a single word wider than the line is set smaller until it fits — never cut off a tarp's edge
  const longest = Math.max(...(o.upper ? c.shop.name.toUpperCase() : c.shop.name).split(/\s+/).map((w) => run(o.face, w, size, o.ls).w));
  if (longest > maxW) size *= maxW / longest;
  return textBox(c.shop.name, { ...o, size }, c.defs);
}

function rule(c: Ctx, w: number): Box {
  return { w, h: HAIR, draw: (x, y) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${HAIR}" ${paint(c.d.acc)}/>` };
}

function sub(c: Ctx, fs: number, maxW: number, align: 'start' | 'middle'): Box {
  return textBox(c.shop.line, { face: c.d.subFace, size: fs, ls: 0.24, lh: 1.35, upper: true, color: c.d.sub, align, maxW }, c.defs);
}

/** The small pieces' quiet lines: the Verified seal, the rating, the badges — each only if the shop has it. */
function lnBox(c: Ctx, s: string, fs: number, maxW: number, align: 'start' | 'middle', color = c.d.sub): Box {
  return textBox(s, { face: c.d.subFace, size: fs, ls: 0.2, lh: 1.3, upper: true, color, align, maxW, balance: true }, c.defs);
}

function sealLn(c: Ctx, fs: number, maxW: number): Box {
  if (!c.shop.verified) return EMPTY;
  const col = c.d.sealC ?? c.d.acc;
  const icon = 1.15 * fs;
  const gap = 0.55 * fs;
  const t = lnBox(c, 'Setnayan Verified', fs, maxW - icon - gap, 'start', col);
  const h = Math.max(icon, t.h);
  return { w: icon + gap + t.w, h, draw: (x, y) => setnayanMarkSvg(x + icon / 2, y + h / 2, icon, col) + t.draw(x + icon + gap, y + (h - t.h) / 2) };
}

function rateLn(c: Ctx, fs: number, maxW: number, align: 'start' | 'middle'): Box {
  const r = c.shop.rating;
  return r ? lnBox(c, `${r.avg.toFixed(1)} · ${formatCount(r.count)} review${r.count === 1 ? '' : 's'}`, fs, maxW, align) : EMPTY;
}

function badgeLn(c: Ctx, fs: number, maxW: number, align: 'start' | 'middle', max: number): Box {
  const words = c.shop.badges.filter((b) => b.kind !== 'verified' && b.kind !== 'rating').slice(0, max).map((b) => b.label);
  return words.length ? lnBox(c, words.join(' · '), fs, maxW, align) : EMPTY;
}

function meta(lines: Box[], fs: number, align: 'start' | 'middle'): Box {
  const kept = lines.filter((b) => b.h > 0);
  return kept.length ? stack(kept, 0.75 * fs, align) : EMPTY;
}

/**
 * The big pieces' badges: the shipped pills (`badgePill`), `h` units tall, wrapped like the prototype's flex row.
 * 🔑 ONE FACT, ONE PLACE (the prototype's `pills(…, drawn)`): where the piece draws the stars line it drops the rating
 * pill; where it draws the "In business since" line, the years pill.
 */
function pills(c: Ctx, h: number, maxW: number, justify: 'start' | 'middle', cap: number, drawn: { stars: boolean; since: boolean } = { stars: true, since: false }): Box {
  const list = c.shop.badges
    .filter((b) => !(drawn.stars && c.shop.rating && b.kind === 'rating') && !(drawn.since && c.shop.since && b.kind === 'years'))
    .slice(0, cap);
  if (list.length === 0 || h <= 0) return EMPTY;
  const lightInk = /^#(F|E)|^#FFF|rgba\(25/i.test(c.d.ink);
  // the shipped pill is drawn at its own 34 pt em (its 1.4 pt edge is sized for that) and scaled down to h units tall
  const EM = 34;
  const raw = list.map((b, i) => ({ ...badgePill(b, EM, lightInk ? 'dark' : 'white', i), kind: b.kind }));
  const k = h / Math.max(...raw.map((d) => d.height));
  const F = EM * k;
  const items = raw.map((d) => ({ ...d, width: d.width * k, height: d.height * k }));
  return flowPills(c, items, k, F, maxW, justify);
}

function flowPills(c: Ctx, drawn: Array<{ svg: string; defs: string; width: number; height: number; kind?: string }>, k: number, F: number, maxW: number, justify: 'start' | 'middle'): Box {
  const rows: Array<{ items: typeof drawn; w: number }> = [];
  const gx = 0.55 * F;
  const gy = 0.6 * F;
  for (const p of drawn) {
    const pw = p.width;
    const last = rows[rows.length - 1];
    if (last && last.w + gx + pw <= maxW) {
      last.items.push(p);
      last.w += gx + pw;
    } else rows.push({ items: [p], w: pw });
  }
  const rowH = Math.max(...drawn.map((p) => p.height));
  const w = Math.max(...rows.map((r) => r.w));
  c.defs.push(...drawn.map((p) => p.defs));
  return {
    w,
    h: rows.length * rowH + (rows.length - 1) * gy,
    draw: (x, y) =>
      rows
        .map((r, ri) => {
          let px = justify === 'middle' ? x + (w - r.w) / 2 : x;
          return r.items
            .map((p) => {
              const g = `<g${p.kind ? ` data-print-badge="${esc(p.kind)}"` : ''} transform="translate(${n(px)} ${n(y + ri * (rowH + gy))}) scale(${k.toFixed(6)})">${p.svg}</g>`;
              px += p.width + gx;
              return g;
            })
            .join('');
        })
        .join(''),
  };
}

function qrBox(c: Ctx, w: number, fs: number, capFs: number, capLs = 0.18): Box {
  const m = c.modules;
  if (!m || !c.qr) return EMPTY;
  const pad = 0.45 * fs;
  const cap = textBox(PRINT_QR[c.qr.mode].cap, { face: c.d.subFace, size: capFs, ls: capLs, lh: 1.25, upper: true, color: c.d.sub, align: 'middle', maxW: w }, c.defs);
  const gap = 0.6 * fs;
  return {
    w,
    h: w + gap + cap.h,
    draw: (x, y) => {
      c.qrAt = { x, y, w, h: w + gap + cap.h };
      const ring = c.d.plateRing;
      const rw = ring ? ring[1] * fs : HAIR;
      const ringPaint = ring ? ring[0] : 'rgba(0,0,0,.08)';
      const mod = (w - 2 * pad) / m.size;
      let d = '';
      for (let r = 0; r < m.size; r++) {
        let cStart = -1;
        for (let col = 0; col <= m.size; col++) {
          const on = col < m.size && m.get(r, col);
          if (on && cStart < 0) cStart = col;
          if (!on && cStart >= 0) {
            d += `M${n(x + pad + cStart * mod)} ${n(y + pad + r * mod)}h${n((col - cStart) * mod)}v${n(mod)}h${n(-(col - cStart) * mod)}z`;
            cStart = -1;
          }
        }
      }
      return (
        `<g data-print-qr="${esc(c.qr!.url)}">` +
        `<rect x="${n(x - rw / 2)}" y="${n(y - rw / 2)}" width="${n(w + rw)}" height="${n(w + rw)}" rx="${n(0.3 * fs + rw / 2)}" fill="none" ${paint(ringPaint, 'stroke')} stroke-width="${n(rw)}"/>` +
        `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(w)}" rx="${n(0.3 * fs)}" fill="#FFFFFF"/>` +
        `<path d="${d}" fill="#1b1816" shape-rendering="crispEdges"/></g>` +
        cap.draw(x + (w - cap.w) / 2, y + w + gap)
      );
    },
  };
}

/** The Setnayan mark + the word — `column` for the door print's "We are part of" lockup. */
function mk(c: Ctx, fs: number, opts: { icon?: number; column?: boolean; gap?: number; ls?: number } = {}): Box {
  const icon = opts.icon ?? 1.3 * fs;
  const t = textBox('Setnayan', { face: c.d.subFace, size: fs, ls: opts.ls ?? 0.3, lh: 1.1, upper: true, color: c.d.mkC, align: 'middle', maxW: 1e3 }, c.defs);
  if (opts.column) {
    const gap = opts.gap ?? 0.5 * fs;
    const w = Math.max(icon, t.w);
    return { w, h: icon + gap + t.h, draw: (x, y) => setnayanMarkSvg(x + w / 2, y + icon / 2, icon, c.d.mkC) + t.draw(x + (w - t.w) / 2, y + icon + gap) };
  }
  const gap = 0.5 * fs;
  const h = Math.max(icon, t.h);
  return { w: icon + gap + t.w, h, draw: (x, y) => setnayanMarkSvg(x + icon / 2, y + h / 2, icon, c.d.mkC) + t.draw(x + icon + gap, y + (h - t.h) / 2) };
}

/* ── the blocks PRINTS BY PURPOSE AND SIZE adds (the prototype's logo · svc · stars · meta · photo · about · reach) ── */

/** The shop's logo in the monogram's circle (the prototype's `.logo`: round, contained) — else the monogram, as before. */
function logoBox(c: Ctx, D: number): Box {
  const img = c.shop.logo;
  if (!img) return mono(c, D, D * 0.36);
  return {
    w: D,
    h: D,
    draw: (x, y) => {
      const id = `lg${(gradSeq = (gradSeq + 1) % 1e9)}`;
      return (
        `<clipPath id="${id}"><circle cx="${n(x + D / 2)}" cy="${n(y + D / 2)}" r="${n(D / 2)}"/></clipPath>` +
        `<image data-print-block="logo" href="${img.href}" x="${n(x)}" y="${n(y)}" width="${n(D)}" height="${n(D)}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${id})"/>`
      );
    },
  };
}

/** A line of words in the trade line's style (uppercase, tracked) — the tagline, a role, the shop name on a member's card. */
function subTxt(c: Ctx, s: string | null | undefined, fs: number, maxW: number, align: 'start' | 'middle', ls = 0.24, color = c.d.sub): Box {
  return textBox(s ?? '', { face: c.d.subFace, size: fs, ls, lh: 1.35, upper: true, color, align, maxW }, c.defs);
}

/** Boxes side by side, centred on one another (the prototype's `display:flex;align-items:center`). */
function hrow(items: Box[], gap: number): Box {
  const kept = items.filter((b) => b.w > 0 && b.h > 0);
  if (kept.length === 0) return EMPTY;
  const w = kept.reduce((a, b) => a + b.w, 0) + gap * (kept.length - 1);
  const h = Math.max(...kept.map((b) => b.h));
  return {
    w,
    h,
    draw: (x, y) => {
      let out = '';
      let cx = x;
      for (const b of kept) {
        out += b.draw(cx, y + (h - b.h) / 2);
        cx += b.w + gap;
      }
      return out;
    },
  };
}

/** Boxes stacked with one gap, empties closed up (the prototype's `flex-direction:column; gap`). */
function vstack(items: Box[], gap: number, align: 'start' | 'middle'): Box {
  const kept = items.filter((b) => b.h > 0);
  return kept.length ? stack(kept, gap, align) : EMPTY;
}

/** Boxes in rows that wrap at `maxW` (`flex-wrap:wrap`), each row centred on its own items. */
function flow(items: Box[], gx: number, gy: number, maxW: number, justify: 'start' | 'middle'): Box {
  const kept = items.filter((b) => b.w > 0 && b.h > 0);
  if (kept.length === 0) return EMPTY;
  const rows: Box[][] = [];
  let cur: Box[] = [];
  let curW = 0;
  for (const b of kept) {
    if (cur.length && curW + gx + b.w > maxW) {
      rows.push(cur);
      cur = [];
      curW = 0;
    }
    curW += (cur.length ? gx : 0) + b.w;
    cur.push(b);
  }
  rows.push(cur);
  return vstack(rows.map((r) => hrow(r, gx)), gy, justify);
}

/** The stars line — "4.7 ★ · 3 reviews": the number in ink, the star in the accent, the count quiet. */
function starsBox(c: Ctx, fs: number): Box {
  const r = c.shop.rating;
  if (!r) return EMPTY;
  const o = { face: c.d.subFace, size: fs, ls: 0.2, lh: 1.3, upper: true, align: 'start' as const, maxW: 1e3 };
  const num = textBox(r.avg.toFixed(1), { ...o, color: c.d.ink }, c.defs);
  const rest = textBox(`· ${formatCount(r.count)} review${r.count === 1 ? '' : 's'}`, { ...o, color: c.d.sub }, c.defs);
  const s = 0.95 * fs;
  const star: Box = {
    w: s,
    h: s,
    draw: (x, y) => {
      const cx = x + s / 2;
      const cy = y + s * 0.53;
      const pts = Array.from({ length: 10 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rad = i % 2 ? s * 0.21 : s * 0.5;
        return `${n(cx + rad * Math.cos(a))},${n(cy + rad * Math.sin(a))}`;
      }).join(' ');
      return `<polygon points="${pts}" ${paint(c.d.acc)}/>`;
    },
  };
  const line = hrow([num, star, rest], 0.42 * fs);
  return { ...line, draw: (x, y) => `<g data-print-block="stars">${line.draw(x, y)}</g>` };
}

/** The shop's services — names only, one a line (owner 2026-11-06: NO price on any print; a printed price cannot update). */
function svcBox(c: Ctx, max: number, fs: number, maxW: number, align: 'start' | 'middle'): Box {
  const list = (c.shop.services ?? []).slice(0, max);
  if (list.length === 0) return EMPTY;
  const b = stack(
    list.map((t) => textBox(t, { face: c.d.subFace, size: fs, ls: 0, lh: 1.45, color: c.d.ink, align, maxW, maxLines: 1 }, c.defs)),
    0,
    align,
  );
  return { ...b, draw: (x, y) => `<g data-print-block="services" data-print-count="${list.length}">${b.draw(x, y)}</g>` };
}

/** "In business since 2016 · Serves up to 100 km around Tagaytay" — each part only if the shop has it. */
function metaBox(c: Ctx, fs: number, maxW: number, align: 'start' | 'middle'): Box {
  const parts = [c.shop.since, c.shop.area].filter((s): s is string => !!s);
  return parts.length ? lnBox(c, parts.join(' · '), fs, maxW, align) : EMPTY;
}

/** A photo, cropped to cover its frame (the prototype's `object-fit:cover`, `posX` its `object-position`). */
function photoBox(c: Ctx, w: number, h: number, posX = 0.5, border = 0): Box {
  const img = c.shop.photo;
  if (!img || w <= 0 || h <= 0) return EMPTY;
  return {
    w,
    h,
    draw: (x, y) => {
      const id = `ph${(gradSeq = (gradSeq + 1) % 1e9)}`;
      const k = Math.max(w / img.w, h / img.h);
      const dw = img.w * k;
      const dh = img.h * k;
      return (
        `<clipPath id="${id}"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"/></clipPath>` +
        `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="#000"/>` +
        `<image data-print-block="photo" href="${img.href}" x="${n(x + (w - dw) * posX)}" y="${n(y + (h - dh) / 2)}" width="${n(dw)}" height="${n(dh)}" preserveAspectRatio="none" clip-path="url(#${id})"/>` +
        (border ? `<rect x="${n(x + border / 2)}" y="${n(y + border / 2)}" width="${n(w - border)}" height="${n(h - border)}" fill="none" ${paint(c.d.acc, 'stroke')} stroke-width="${n(border)}"/>` : '')
      );
    },
  };
}

/** The About, clamped to `lines` lines (Pro+ — the route hands it in only where the page shows it). */
function aboutBox(c: Ctx, fs: number, lines: number, w: number): Box {
  const b = textBox(c.shop.about ?? '', { face: c.d.subFace, size: fs, ls: 0, lh: 1.45, color: c.d.ink, align: 'start', maxW: w, maxLines: lines }, c.defs);
  return b.h ? { ...b, draw: (x, y) => `<g data-print-block="about">${b.draw(x, y)}</g>` } : EMPTY;
}

/** One unbreakable line (a web address has no space to wrap at), set smaller until it fits — never cut off. */
function fitLine(c: Ctx, s: string, o: TextOpts): Box {
  const w = run(o.face, o.upper ? s.toUpperCase() : s, o.size, o.ls ?? 0).w;
  return textBox(s, { ...o, size: w > o.maxW ? (o.size * o.maxW) / w : o.size }, c.defs);
}

/** The web address: the shop's own domain, the Setnayan address small under it — else the Setnayan address alone. */
function reachBox(c: Ctx, fs: number, maxW: number, align: 'start' | 'middle'): Box {
  const r = c.reach;
  if (!r) return EMPTY;
  const o = { face: c.d.subFace, ls: 0.06, lh: 1.3, align, maxW } as const;
  const top = fitLine(c, r.own ?? r.handle, { ...o, size: fs, color: c.d.ink });
  const b = r.own ? stack([top, fitLine(c, r.handle, { ...o, size: 0.8 * fs, ls: 0.04, color: c.d.sub })], 0.3 * fs, align) : top;
  return { ...b, draw: (x, y) => `<g data-print-block="reach">${b.draw(x, y)}</g>` };
}

/**
 * A column of blocks (the prototype's flex column): a number is a fixed gap, a box a block. A gap belongs to the block
 * after it, so a block with nothing behind it takes its gap with it and the rest closes up. `between` shares the free
 * space between every item (CSS `space-between`, the gaps counted as items); with no free space it packs from the top.
 */
function column(items: Array<Box | number>, x: number, w: number, top: number, bot: number, justify: 'start' | 'center' | 'between', align: 'start' | 'middle'): string {
  const kept: Array<Box | number> = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    if (typeof it === 'number') {
      const next = items[i + 1];
      if (next !== undefined && typeof next !== 'number' && next.h <= 0) continue;
      kept.push(it);
    } else if (it.h > 0) kept.push(it);
  }
  // a piece never spills past its own edge: when the blocks outgrow it, the gaps give way first (down to 30 %)
  const gaps = kept.reduce<number>((a, it) => a + (typeof it === 'number' ? it : 0), 0);
  const boxes = kept.reduce<number>((a, it) => a + (typeof it === 'number' ? 0 : it.h), 0);
  const squeeze = gaps > 0 && boxes + gaps > bot - top ? Math.max(0.3, (bot - top - boxes) / gaps) : 1;
  const size = (it: Box | number) => (typeof it === 'number' ? it * squeeze : it.h);
  const total = kept.reduce<number>((a, it) => a + size(it), 0);
  const free = bot - top - total;
  const share = justify === 'between' && kept.length > 1 && free > 0 ? free / (kept.length - 1) : 0;
  let y = top + (justify === 'center' && free > 0 ? free / 2 : 0);
  let out = '';
  for (const it of kept) {
    if (typeof it !== 'number') out += it.draw(align === 'middle' ? x + (w - it.w) / 2 : x, y);
    y += size(it) + share;
  }
  return out;
}

/* ── the ornaments — the prototype's `O` and each design's `orn`, verbatim, with the bleed `b` for a Save file ───── */

function ornament(c: Ctx, w: number, h: number, b: number): string {
  const grain = (op: number, seed: number) =>
    `<filter id="grain${seed}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="${seed}"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="${op}"/></feComponentTransfer></filter><rect x="${n(-b)}" y="${n(-b)}" width="${n(w + 2 * b)}" height="${n(h + 2 * b)}" filter="url(#grain${seed})"/>`;
  const frame = (col: string, inset = 3.2, sw = 0.25, gap = 0) =>
    `<rect x="${inset}" y="${inset}" width="${n(w - 2 * inset)}" height="${n(h - 2 * inset)}" fill="none" stroke="${col}" stroke-width="${sw}"/>` +
    (gap ? `<rect x="${inset + gap}" y="${inset + gap}" width="${n(w - 2 * (inset + gap))}" height="${n(h - 2 * (inset + gap))}" fill="none" stroke="${col}" stroke-width="${n(sw * 0.6)}"/>` : '');
  const diamonds = (col: string, inset = 3.2) =>
    ([[inset, inset], [w - inset, inset], [inset, h - inset], [w - inset, h - inset]] as const).map(([x, y]) => `<path d="M${n(x)} ${n(y - 1)}l1 1-1 1-1-1z" fill="${col}"/>`).join('');
  const ticks = (col: string, i = 3.2, l = 4) =>
    `<path d="M${i} ${i + l}V${i}h${l}M${n(w - i - l)} ${i}h${l}v${l}M${i} ${n(h - i - l)}v${l}h${l}M${n(w - i)} ${n(h - i - l)}v${l}h${-l}" fill="none" stroke="${col}" stroke-width=".3"/>`;
  const rules = (col: string, y = 3.6, gap = 0.9) =>
    `<path d="M${n(w * 0.08)} ${y}H${n(w * 0.92)}M${n(w * 0.08)} ${n(y + gap)}H${n(w * 0.92)}M${n(w * 0.08)} ${n(h - y)}H${n(w * 0.92)}M${n(w * 0.08)} ${n(h - y - gap)}H${n(w * 0.92)}" stroke="${col}" stroke-width=".22"/>`;
  const all = `x="${n(-b)}" y="${n(-b)}" width="${n(w + 2 * b)}" height="${n(h + 2 * b)}"`;
  switch (c.d.id) {
    case 'inkgold':
      return `<linearGradient id="gf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a6a2c"/><stop offset=".3" stop-color="#d9b866"/><stop offset=".5" stop-color="#f6e7b0"/><stop offset=".7" stop-color="#b88d3b"/><stop offset="1" stop-color="#e6c97d"/></linearGradient>${frame('url(#gf)', 2.8, 0.3, 0.9)}${diamonds('url(#gf)', 2.8)}`;
    case 'ivory':
      return grain(0.07, 1) + `<linearGradient id="gf2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b88d3b"/><stop offset=".5" stop-color="#e9cf86"/><stop offset="1" stop-color="#8e6b2b"/></linearGradient>${frame('url(#gf2)', 3.2, 0.28)}${ticks('url(#gf2)', 2.2, 3)}`;
    case 'marble':
      return `<linearGradient id="mb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".6" stop-color="#F4F2EF"/><stop offset="1" stop-color="#FBFAF8"/></linearGradient><rect ${all} fill="url(#mb)"/><g fill="none" stroke-linecap="round"><path d="M-3 ${n(h * 0.2)}C${n(w * 0.2)} ${n(h * 0.12)} ${n(w * 0.3)} ${n(h * 0.46)} ${n(w * 0.52)} ${n(h * 0.32)}S${n(w * 0.8)} ${n(h * 0.06)} ${n(w + 3)} ${n(h * 0.22)}" stroke="#B4B9C1" stroke-opacity=".38" stroke-width=".35"/><path d="M-3 ${n(h * 0.24)}C${n(w * 0.2)} ${n(h * 0.18)} ${n(w * 0.3)} ${n(h * 0.5)} ${n(w * 0.52)} ${n(h * 0.38)}S${n(w * 0.8)} ${n(h * 0.12)} ${n(w + 3)} ${n(h * 0.28)}" stroke="#D3D6DB" stroke-opacity=".45" stroke-width=".8"/><path d="M${n(w * 0.1)} ${n(h + 3)}C${n(w * 0.25)} ${n(h * 0.7)} ${n(w * 0.55)} ${n(h * 0.95)} ${n(w * 0.7)} ${n(h * 0.74)}S${n(w * 0.95)} ${n(h * 0.52)} ${n(w + 3)} ${n(h * 0.62)}" stroke="#BEC3CA" stroke-opacity=".3" stroke-width=".3"/><path d="M${n(w * 0.62)} -3C${n(w * 0.64)} ${n(h * 0.2)} ${n(w * 0.52)} ${n(h * 0.35)} ${n(w * 0.58)} ${n(h * 0.55)}" stroke="#C8CCD2" stroke-opacity=".35" stroke-width=".25"/></g>`;
    case 'classic':
      return grain(0.045, 3) + rules('#1F1C19');
    case 'sage':
      return `<pattern id="linen" width="1.1" height="1.1" patternUnits="userSpaceOnUse"><path d="M0 .55H1.1M.55 0V1.1" stroke="#C3CDBC" stroke-width=".14"/></pattern><rect ${all} fill="url(#linen)" opacity=".45"/>` + frame('#5C6B5B', 3.4, 0.24);
    case 'terracotta': {
      // the ghost initials — outlined, like every other letter (the prototype set them as <text> in Jost 700)
      const size = Math.min(w, h) * 0.95;
      const t = run('jost-700', c.shop.ini, size, -0.04);
      return `<path d="${run('jost-700', c.shop.ini, size, -0.04, w * 1.02 - t.w, h * 1.02, true).d}" fill="#FFFFFF" fill-opacity=".07"/>`;
    }
    case 'mono':
      return `<rect x="${n(-b)}" y="${n(-b)}" width="${n(2.4 + b)}" height="${n(h + 2 * b)}" fill="#111"/>`;
    case 'spotlight':
      return `<radialGradient id="spot" cx="50%" cy="-25%" r="95%"><stop offset="0" stop-color="#E9C77A" stop-opacity=".8"/><stop offset=".4" stop-color="#E9C77A" stop-opacity=".16"/><stop offset="1" stop-color="#E9C77A" stop-opacity="0"/></radialGradient><rect ${all} fill="url(#spot)"/>`;
    case 'electric':
      return `<g fill="none" stroke="#FFFFFF" stroke-width=".22"><circle cx="${n(w * 0.86)}" cy="${n(h * 0.5)}" r="${n(h * 0.78)}" stroke-opacity=".35"/><circle cx="${n(w * 0.86)}" cy="${n(h * 0.5)}" r="${n(h * 0.52)}" stroke-opacity=".25"/></g>`;
    case 'fiesta':
      return `<rect x="${n(-b)}" y="${n(h * 0.88)}" width="${n(w + 2 * b)}" height="${n(h * 0.12 + b)}" fill="#C8401E"/>`;
    case 'blush': {
      const r = Math.max(w, h) * 0.8;
      return `<radialGradient id="wash" cx="${n(w * 0.98)}" cy="${n(h * 0.02)}" r="${n(r)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#E9A9A8" stop-opacity=".7"/><stop offset=".55" stop-color="#E9A9A8" stop-opacity=".18"/><stop offset="1" stop-color="#E9A9A8" stop-opacity="0"/></radialGradient><rect ${all} fill="url(#wash)"/>`;
    }
    case 'kraft':
      return grain(0.3, 4) + frame('#F6ECDC', 3.2, 0.28);
    case 'forest':
      return frame('#C9A961', 3, 0.26);
    case 'pearl':
      return `<linearGradient id="pearl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".35" stop-color="#F3EFF2"/><stop offset=".65" stop-color="#E8EEF5"/><stop offset="1" stop-color="#FBF2EC"/></linearGradient><rect ${all} fill="url(#pearl)"/><linearGradient id="pearl2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF" stop-opacity=".7"/><stop offset=".5" stop-color="#FFF" stop-opacity="0"/></linearGradient><rect ${all} fill="url(#pearl2)"/>${frame('#B9C2CF', 3.2, 0.22)}`;
    case 'slate':
      return frame('#8FB4D9', 3, 0.22);
  }
}

/* ── the seven layouts (the prototype's .p-card … .p-table, in piece units) ───────────────────────────────────────── */

function centreX(b: Box, left: number, width: number): number {
  return left + (width - b.w) / 2;
}

/**
 * One side of a piece. PRINTS BY PURPOSE AND SIZE (owner 2026-11-06, "Yes ship it"): each piece is the approved
 * prototype's layout (`index.src.html` → `L.card … L.backdrop`), re-stated in piece units — what it carries follows
 * who reads it from how far (`PRINT_PURPOSE`). The door print is unchanged. No price, no phone, no email anywhere.
 */
function layout(c: Ctx, p: PrintPiece, side: PrintSide, H: number, member: PrintMember | null): string {
  // ── CALLING CARD · front — handed over, read in the hand (40 cm): identity only
  if (p.id === 'card' && side === 'f' && member) return personalFront(c, H, member);
  if (p.id === 'card' && side === 'f') {
    const L = 9, W = 82;
    return column(
      [logoBox(c, 12), 2.2, nm(c, 8.2, W, 'middle'), 2.2, rule(c, 12), 2.2, subTxt(c, c.shop.tagline || c.shop.line, 2.5, W, 'middle'), 2.6, sealLn(c, 2.2, W)],
      L, W, 8, H - 7.5, 'center', 'middle',
    );
  }
  // ── CALLING CARD · back — the Setnayan address, the stars line, two badge words, the code
  if (p.id === 'card') {
    const L = 9, R = 91, leftW = R - L - 26 - 7;
    const q = qrBox(c, 26, 2.2, 1.8, 0.14);
    const hand = c.reach ? fitLine(c, c.reach.handle, { face: c.d.subFace, size: 2.9, ls: 0.06, lh: 1.1, color: c.d.ink, align: 'start', maxW: leftW }) : EMPTY;
    const left = vstack([mk(c, 3.2), rule(c, 14), hand, starsBox(c, 2.1), badgeLn(c, 2.1, leftW, 'start', p.maxBadges)], 2.6, 'start');
    return left.draw(L, H / 2 - left.h / 2) + q.draw(R - 26, H / 2 - q.h / 2);
  }
  // ── A5 STANDEE — on a desk or welcome table, read at arm's length (0.8 m): services + rating + QR
  if (p.id === 'standee') {
    const L = 9, W = 82;
    return column(
      [
        logoBox(c, 13), 2.2, nm(c, 8.6, W, 'middle'), 1.8, rule(c, 14), 1.8, subTxt(c, c.shop.tagline, 2.5, W, 'middle'),
        3.5, svcBox(c, 3, 3, W, 'middle'), 2.6, starsBox(c, 2.6),
        3.5, qrBox(c, 34, 2.5, 2.5), 3.5, pills(c, 5.6, W, 'middle', 3), 3, mk(c, 2.8),
      ],
      L, W, 7.5, H - 5.5, 'between', 'middle',
    );
  }
  // ── DOOR PRINT — unchanged (owner: "door unchanged")
  if (p.id === 'door') {
    const top = 8.5, bot = H - 7.5, L = 9, W = 82, g = 3.2;
    const sc = textBox('We are part of', { face: c.d.subFace, size: 3.2, ls: 0.22, lh: 1.3, upper: true, color: c.d.sub, align: 'middle', maxW: W }, c.defs);
    const we = stack([sc, mk(c, 6.4, { icon: 12, column: true, gap: 2.6, ls: 0.34 })], 3, 'middle');
    const who = stack([nm(c, 6.6, W, 'middle'), rule(c, 14), sub(c, 2.8, W, 'middle')], 2.2, 'middle');
    const q = qrBox(c, 44, 2.8, 2.7);
    const me = meta([sealLn(c, 2.5, W), rateLn(c, 2.5, W, 'middle'), badgeLn(c, 2.5, W, 'middle', p.maxBadges)], 2.5, 'middle');
    const meY = bot - me.h;
    const a = top + we.h + g + who.h + g, z = meY - g;
    return we.draw(centreX(we, L, W), top) + who.draw(centreX(who, L, W), top + we.h + g) + q.draw(centreX(q, L, W), a + (z - a - q.h) / 2) + me.draw(centreX(me, L, W), meY);
  }
  // ── TABLE-FRONT — hangs on the table edge at waist height, read walking up (2–3 m)
  if (p.id === 'table') {
    const py = 4.5, px = 5.5, qw = 21, cg = 5;
    const leftW = 100 - 2 * px - qw - cg;
    const textW = leftW - 8.5 - 2.6;
    const head = hrow([logoBox(c, 8.5), vstack([nm(c, 4.8, textW, 'start'), rule(c, 10), subTxt(c, c.shop.tagline, 1.7, Math.min(56, textW), 'start')], 1.1, 'start')], 2.6);
    const foot = flow([starsBox(c, 1.9), pills(c, 3.3, leftW, 'start', 3)], 3, 1, leftW, 'start');
    const q = qrBox(c, qw, 1.6, 1.6);
    return column([head, 2, svcBox(c, 3, 2.1, leftW, 'start'), 2, foot], px, leftW, py, H - py, 'between', 'start') + q.draw(100 - px - qw, (H - q.h) / 2);
  }
  // ── TARP — on a wall, read from across a room (5 m): + since, area, web address, a big QR
  if (p.id === 'tarp') {
    const py = 5, px = 6, qw = 26, cg = 5;
    const leftW = 100 - 2 * px - qw - cg;
    const textW = leftW - 10 - 3;
    const head = hrow([logoBox(c, 10), vstack([nm(c, 6.2, textW, 'start'), rule(c, 12), subTxt(c, c.shop.tagline, 1.9, Math.min(56, textW), 'start')], 1.2, 'start')], 3);
    const foot = vstack([flow([starsBox(c, 2), pills(c, 3.4, leftW, 'start', 5, { stars: true, since: true })], 2.6, 1.2, leftW, 'start'), metaBox(c, 1.8, leftW, 'start')], 1.2, 'start');
    return (
      column([head, 1.2, svcBox(c, 4, 2.1, leftW, 'start'), 1.2, foot], px, leftW, py, H - py, 'between', 'start') +
      column([qrBox(c, qw, 1.8, 1.8), 2, reachBox(c, 1.7, qw, 'middle')], 100 - px - qw, qw, py, H - py, 'center', 'middle')
    );
  }
  // ── BOOTH BACKDROP — seen from a few steps and in photos: big brand across the top, one photo, the QR at the side
  if (p.id === 'backdrop') {
    const P = 7, W = 100 - 2 * P;
    const textW = W - 13 - 4;
    const head = hrow([logoBox(c, 13), vstack([nm(c, 7.6, textW, 'start'), rule(c, 16), subTxt(c, c.shop.tagline, 2.4, Math.min(62, textW), 'start')], 1.6, 'start')], 4);
    const top2 = P + head.h + 3.5, bot2 = H - 6.5;
    const ph = photoBox(c, 44, bot2 - top2, 0.7, 0.4);
    const colX = ph.h ? P + 44 + 5 : P;
    const colW = ph.h ? W - 44 - 5 : W;
    const info = vstack([starsBox(c, 2), pills(c, 3.2, colW, 'middle', 5, { stars: true, since: true }), metaBox(c, 1.7, colW, 'middle')], 1.8, 'middle');
    return (
      head.draw(P + (W - head.w) / 2, P) +
      (ph.h ? ph.draw(P, top2) : '') +
      column([qrBox(c, ph.h ? 30 : 36, 2.1, 2.1), 2, reachBox(c, 1.9, colW, 'middle'), 2, info, 2, mk(c, 2.4)], colX, colW, top2, bot2, 'between', 'middle')
    );
  }
  // ── ROLL-UP — beside a table, read top to bottom as people approach (3 m → 0.5 m): photo, story, QR at hand height
  const L = 11, W = 78;
  return column(
    [
      9, logoBox(c, 16), 3.5, nm(c, 12, W, 'middle'), 3, rule(c, 18), 3, subTxt(c, c.shop.tagline, 3.6, W, 'middle'),
      4.5, photoBox(c, 78, 28), 4, aboutBox(c, 2.8, 3, 78),
      5, qrBox(c, 52, 3.4, 3.4), 5, svcBox(c, 6, 3.4, W, 'middle'),
      4.5, flow([starsBox(c, 3.1), pills(c, 5.8, W, 'middle', 5, { stars: true, since: true })], 3.5, 2, W, 'middle'),
      4, metaBox(c, 2.6, W, 'middle'), 4, flow([reachBox(c, 2.8, W, 'middle'), mk(c, 3.4)], 5, 2, W, 'middle'),
    ],
    L, W, 0, H - 9, 'start', 'middle',
  );
}

/**
 * The PERSONAL calling card's front (owner 2026-11-06, "Yes"): the shop's logo, then the member's account name, their
 * Team label ONLY when they have one (never the access level, never an invented title), a rule, the shop's name.
 */
function personalFront(c: Ctx, H: number, m: PrintMember): string {
  const L = 9, W = 82, D = 15, gap = 5;
  const tw = W - D - gap;
  const name = m.name.replace(/\s+/g, ' ').trim();
  let size = 6.2;
  const longest = Math.max(...name.split(' ').map((w) => run(c.d.nameFace, w, size, 0).w));
  if (longest > tw) size *= tw / longest;
  const who = textBox(name, { face: c.d.nameFace, size, ls: 0, lh: 1.05, color: c.d.ink, align: 'start', maxW: tw, balance: true }, c.defs);
  const role = m.role?.trim() ? subTxt(c, m.role.trim(), 2.4, tw, 'start', 0.2) : EMPTY;
  const col = vstack([
    { ...who, draw: (x, y) => `<g data-print-block="member">${who.draw(x, y)}</g>` },
    role.h ? { ...role, draw: (x: number, y: number) => `<g data-print-block="role">${role.draw(x, y)}</g>` } : EMPTY,
    rule(c, 10),
    lnBox(c, c.shop.name, 2.3, tw, 'start', c.d.acc),
  ], 1.8, 'start');
  const row = hrow([logoBox(c, D), col], gap);
  return row.draw(L, (H - row.h) / 2);
}

/** One side of a piece as SVG content in piece units (0 0 100 H), with `b` units of bleed drawn around the ground. */
function side(p: PrintPiece, d: PrintDesign, raw: PrintShop, qr: PrintQr | null, s: PrintSide, b: number, idp: string, hidden: readonly PrintBlock[], member: PrintMember | null): string {
  const H = 100 / p.ratio;
  const hasQr = pieceHasQr(p.id, s) && qr !== null;
  let modules: Ctx['modules'] = null;
  if (hasQr) {
    const code = QRCode.create(qr!.url, { errorCorrectionLevel: 'H' });
    modules = { size: code.modules.size, get: (r, col) => Boolean(code.modules.get(r, col)) };
  }
  const { shop, reach } = onPrint(raw, hidden);
  const c: Ctx = { d, shop, defs: [], qr: hasQr ? qr : null, modules, reach };
  const ground =
    typeof d.ground === 'string'
      ? `<rect x="${n(-b)}" y="${n(-b)}" width="${n(100 + 2 * b)}" height="${n(H + 2 * b)}" fill="${d.ground}"/>`
      : (() => {
          const g = cssGrad([d.ground.from, d.ground.to], -b, -b, 100 + 2 * b, H + 2 * b, 135);
          c.defs.push(g.def);
          return `<rect x="${n(-b)}" y="${n(-b)}" width="${n(100 + 2 * b)}" height="${n(H + 2 * b)}" fill="url(#${g.id})"/>`;
        })();
  const orn = ornament(c, 100, H, b);
  const body = layout(c, p, s, H, p.id === 'card' && s === 'f' ? member : null);
  // the keep-out zone: the door's fixed one (unchanged); every other piece masks where its code was actually drawn
  const at = c.qrAt;
  const k = p.id !== 'door' && at ? { x: n(at.x - 1.5), y: n(at.y - 1.5), w: n(at.w + 3), h: n(at.h + 3) } : p.keep;
  const ornWrapped = hasQr
    ? `<mask id="ko" maskUnits="userSpaceOnUse" x="${n(-b)}" y="${n(-b)}" width="${n(100 + 2 * b)}" height="${n(H + 2 * b)}"><rect x="${n(-b)}" y="${n(-b)}" width="${n(100 + 2 * b)}" height="${n(H + 2 * b)}" fill="#fff"/><rect x="${k.x}" y="${k.y}" width="${k.w}" height="${k.h}" rx="1.2" fill="#000"/></mask><g mask="url(#ko)">${orn}</g>`
    : orn;
  const out = `${ground}<defs>${c.defs.join('')}</defs>${ornWrapped}${body}`;
  // every id in this side gets the side's prefix — a calling card's two sides share one file
  return out.replace(/\bid="([^"]+)"/g, `id="${idp}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${idp}$1)`);
}

export type RenderPrintOpts = {
  piece: PrintPiece;
  design: PrintDesign;
  shop: PrintShop;
  qr: PrintQr | null;
  side?: PrintSide;
  /**
   * 'screen' — one side in piece units, for the gallery and the photos.
   * 'print'  — the Save file: the exact size in millimetres with a 3 mm bleed; the calling card's front AND back.
   */
  for?: 'screen' | 'print';
  /** The blocks the `On your prints ▾` pick switched off — the picture and the Save file both leave them out. */
  hide?: readonly PrintBlock[] | string | null;
  /** The calling card only: the signed-in member's own card (their name + role on the front; the shop's back). */
  member?: PrintMember | null;
  /**
   * Every letter is outlined, so the SVG holds no searchable words — a guard passes an array here and gets back each
   * line of words the print drew (`lib/prints-by-purpose-and-size.test.ts`: no ₱, no phone, no email).
   */
  words?: string[];
};

export const PRINT_BLEED_MM = 3;
/** The gap between the calling card's front and back in its Save file. */
const CARD_GAP_MM = 10;

export function renderPrint(o: RenderPrintOpts): string {
  traced = o.words ?? null;
  try {
    return renderPrintTraced(o);
  } finally {
    traced = null;
  }
}

function renderPrintTraced(o: RenderPrintOpts): string {
  const p = o.piece;
  const H = 100 / p.ratio;
  const hidden = printHidden(o.hide ?? []);
  const member = p.id === 'card' && o.member?.name.trim() ? { name: o.member.name.trim(), role: printSafe(o.member.role) } : null;
  const title = `<title>${esc(`${member ? `${member.name.trim()} · ` : ''}${o.shop.name} · ${p.name} · ${p.size} · ${o.design.name} · SETNAYAN`)}</title>`;
  if (o.for !== 'print') {
    const s = o.side ?? 'f';
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 ${n(H)}" width="1000" height="${n(H * 10)}" data-print-piece="${p.id}" data-print-design="${o.design.id}" data-print-side="${s}">` +
      title +
      `<svg viewBox="0 0 100 ${n(H)}" width="100" height="${n(H)}" overflow="hidden">${side(p, o.design, o.shop, o.qr, s, 0, `${s}-`, hidden, member)}</svg></svg>`
    );
  }
  const u = 100 / p.mm.w; // piece units per millimetre
  const b = PRINT_BLEED_MM * u;
  const fw = 100 + 2 * b;
  const fh = H + 2 * b;
  const sides: PrintSide[] = p.sides === 2 ? ['f', 'b'] : ['f'];
  const gap = CARD_GAP_MM * u;
  const totalH = sides.length * fh + (sides.length - 1) * gap;
  const mmW = p.mm.w + 2 * PRINT_BLEED_MM;
  const mmH = (totalH / u);
  const parts = sides
    .map((s, i) => `<svg x="0" y="${n(i * (fh + gap))}" width="${n(fw)}" height="${n(fh)}" viewBox="${n(-b)} ${n(-b)} ${n(fw)} ${n(fh)}" overflow="hidden" data-print-side="${s}">${side(p, o.design, o.shop, o.qr, s, b, `${s}-`, hidden, member)}</svg>`)
    .join('');
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(mmW)}mm" height="${n(mmH)}mm" viewBox="0 0 ${n(fw)} ${n(totalH)}" data-print-piece="${p.id}" data-print-design="${o.design.id}" data-bleed-mm="${PRINT_BLEED_MM}">` +
    title +
    parts +
    `</svg>`
  );
}

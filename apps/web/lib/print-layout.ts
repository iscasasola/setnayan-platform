/**
 * lib/print-layout.ts — ONE LAYOUT PER PIECE, DRAWN TWICE.
 *
 * The build plan asks for "React at two scales (screen sample vs print) so the
 * sample IS the design". This is that idea without two renderers to keep in
 * step: each piece is laid out ONCE, here, as a flat list of drawing operations
 * in points (top-left origin), and two small backends draw the same list —
 * `lib/print-render-svg.ts` for the Maker's on-screen sample, and
 * `lib/print-render-pdf.ts` for the downloadable PDF. A card cannot look one way
 * on screen and another on paper, because there is only one card.
 *
 * Type is drawn as vector OUTLINES from TTFs that ship in the repo
 * (`lib/glyph-path.ts`, the same pipeline the QR monogram and the seating PDF
 * use) — so the SVG, the sample and the print-ready file are the same glyphs,
 * and no renderer ever asks a host for a font (the librsvg-on-Vercel trap
 * glyph-path.ts documents).
 *
 * NOT `server-only`: it reads fonts with node:fs, which the Node test runner can
 * do, so the tests measure real layouts instead of flags.
 */
import { loadOtFont, type OtFont } from '@/lib/glyph-path';
import type { FlatMark } from '@/lib/print-mark';
import { roleLabel, type EntourageGroup, type EntouragePerson } from '@/lib/entourage';
import {
  BLEED_MM,
  PRINT_FONT_FILES,
  PRINT_PIECES,
  PT_PER_MM,
  SAFE_MM,
  PRINT_FORMATS,
  NFC_STICKER_DIAMETER_MM,
  NFC_STICKER_MARGIN_MM,
  dieCutFor,
  formatFor,
  maskAccountLine,
  menuHasDishes,
  parentLine,
  printableText,
  storyHasMoments,
  type DieCut,
  type MenuMoment,
  type PrintDetails,
  type PrintFontKey,
  type PrintFormat,
  type PrintLook,
  type PrintMode,
  type PrintPieceKey,
  type PrintSetKey,
  type PrintStoryChapter,
} from '@/lib/print-pieces';

// ─── The drawing vocabulary ─────────────────────────────────────────────────

/** Spot layers of the print-ready file (named for the print shop). */
export type PrintLayer = 'foil' | 'white' | 'die';

export type PrintOp =
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; sw?: number; opacity?: number; dash?: boolean; layer?: PrintLayer }
  | { t: 'path'; d: string; fill?: string; stroke?: string; sw?: number; opacity?: number; layer?: PrintLayer; evenOdd?: boolean }
  | { t: 'image'; ref: string; x: number; y: number; w: number; h: number; opacity?: number }
  | { t: 'circle'; cx: number; cy: number; r: number; fill?: string; stroke?: string; sw?: number; opacity?: number; dash?: boolean; nfc?: boolean };

/**
 * ✍ THE WORDS A COUPLE CAN TAP ON A CARD (owner 2026-09-28, "tap it, edit it on
 * the right"): the print-only lines typed in Details — the opening line (The
 * Invitation) and "Kindly reply" (The Finer Details). Every other word on a card
 * is a fact with its own home; these two live only in `events.print_details`.
 */
export type PrintField = 'opening_line' | 'rsvp';
/** Where a field was drawn, in the doc's own points (screen: no bleed). */
export type PrintFieldBox = { field: PrintField; x: number; y: number; w: number; h: number };

export type PrintDoc = {
  piece: PrintPieceKey;
  /** The tappable print-only words, where they landed — see `PrintField`. */
  fields?: PrintFieldBox[];
  /** Trim size, points. */
  w: number;
  h: number;
  /** Bleed laid out beyond the trim (0 on screen and in samples). */
  bleed: number;
  die: DieCut;
  /** The die outline in trim coordinates. */
  diePath: string;
  ops: PrintOp[];
};

/** The images a layout names by `ref`; the backends are handed the bytes. */
export type PrintImages = Record<string, { bytes: Uint8Array; mime: 'image/png' | 'image/jpeg' } | null | undefined>;

// ─── What a piece prints ────────────────────────────────────────────────────

/**
 * The couple's logo, ready for paper: the ONE resolved mark (`resolveEventMonogram`,
 * the Event Hub hero's resolver) flattened to outlines by `lib/print-mark.ts`
 * (`kind: 'outline'`), or the uploaded raster logo handed to the backends as the
 * `mark` image (`kind: 'image'`). Null → the card prints the couple's initials.
 */
export type PrintMonogram =
  | ({ kind: 'outline' } & FlatMark)
  | { kind: 'image'; w: number; h: number };

export type PrintSetData = {
  names: { first: string; second: string | null };
  /** "The wedding of" / "The celebration of". */
  eyebrow: string;
  dateLabel: string | null;
  ceremonyTime: string | null;
  ceremonyVenue: string | null;
  receptionTime: string | null;
  receptionVenue: string | null;
  monogram: PrintMonogram | null;
  initials: string;
  details: PrintDetails;
  entourage: EntourageGroup[];
  attire: Array<{ label: string; line: string }>;
  swatches: string[];
  /** Printed under the event QR — the address guests can type. */
  hubAddress: string | null;
  /** The Menu card's moments, in order (the couple's own, else their caterer's package lines). */
  menu?: MenuMoment[];
  /** The Our Story poster's chapters — the Love Story, in reading order (`printStoryChapters`, lib/love-story-moments.ts). */
  story?: PrintStoryChapter[];
  /** Is the theme's still (or the couple's hero) in `images.still`? */
  hasStill: boolean;
  hasEventQr: boolean;
};

export type PrintPass = { name: string; seat: string | null; seatNumber?: string | null; qrRef: string | null; serial: string | null };

// ─── Fonts ──────────────────────────────────────────────────────────────────

const fontCache = new Map<PrintFontKey, OtFont>();
export function printFont(key: PrintFontKey): OtFont {
  let f = fontCache.get(key);
  if (!f) {
    f = loadOtFont(PRINT_FONT_FILES[key]);
    fontCache.set(key, f);
  }
  return f;
}

function hasGlyph(font: OtFont, ch: string): boolean {
  // Real at runtime; absent from opentype.js's shipped types.
  return (font as unknown as { charToGlyphIndex(c: string): number }).charToGlyphIndex(ch) > 0;
}

type Run = { font: OtFont; ch: string; adv: number };

/**
 * ⚡ ONE LOOKUP PER CHARACTER, NOT PER DRAW. Which face draws a character, and
 * its advance at 1 pt, are asked of opentype once per (face, character) and
 * kept: an advance scales linearly with the size (opentype multiplies the
 * glyph's advance by size / unitsPerEm), so any size is a multiplication.
 * Measured 2026-09-29: the Our Story poster re-wraps a long Love Story at every
 * type size it tries, and asking opentype per character per try took 26 s for
 * 28 moments.
 */
const glyphCache = new Map<PrintFontKey, Map<string, { font: OtFont; unit: number } | null>>();
function glyphFor(key: PrintFontKey, ch: string): { font: OtFont; unit: number } | null {
  let m = glyphCache.get(key);
  if (!m) {
    m = new Map();
    glyphCache.set(key, m);
  }
  let hit = m.get(ch);
  if (hit === undefined) {
    const primary = printFont(key);
    const fallback = printFont('cardo');
    const font = ch === ' ' || hasGlyph(primary, ch) ? primary : hasGlyph(fallback, ch) ? fallback : null;
    hit = font ? { font, unit: font.getAdvanceWidth(ch, 1) } : null;
    m.set(ch, hit);
  }
  return hit;
}

/** Characters → glyph runs, falling back to Cardo, then dropping a character
 *  no bundled face can draw (a `.notdef` box on a wedding invitation is worse
 *  than a missing ornament). */
function runsFor(text: string, key: PrintFontKey, size: number, tracking: number): Run[] {
  const out: Run[] = [];
  for (const ch of [...text]) {
    const g = glyphFor(key, ch);
    if (!g) continue;
    out.push({ font: g.font, ch, adv: g.unit * size + tracking });
  }
  return out;
}

export function measure(text: string, key: PrintFontKey, size: number, tracking = 0): number {
  // The runs' advances summed without building them (`runsFor`'s arithmetic).
  let total = 0;
  let n = 0;
  for (const ch of text) {
    const g = glyphFor(key, ch);
    if (!g) continue;
    total += g.unit * size + tracking;
    n += 1;
  }
  return n ? total - tracking : 0;
}

type TextOpts = {
  font: PrintFontKey;
  size: number;
  color: string;
  align?: 'left' | 'center' | 'right';
  tracking?: number;
  caps?: boolean;
  /** Shrink to fit this width rather than overrun it. */
  maxWidth?: number;
  layer?: PrintLayer;
  opacity?: number;
};

/**
 * A glyph's commands → SVG path data, written here rather than with
 * opentype's `toPathData(2)`.
 *
 * 🪤 MEASURED 2026-09-25: `toPathData(2)` emits "NaN" for some glyphs at some
 * positions (Cardo "m" at x = 27.75, 6.4 pt — the commands themselves are all
 * finite). pdf-lib then throws on the whole path, and an SVG renderer silently
 * drops the letter: "Ceremony" printed as "Cere ony". A non-finite coordinate
 * here drops the glyph rather than the card.
 */
type Cmd = { type: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number };
export function pathData(commands: readonly Cmd[]): string {
  const r = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? String(Math.round(v * 100) / 100) : null);
  const out: string[] = [];
  for (const c of commands) {
    let seg: Array<string | null>;
    if (c.type === 'M' || c.type === 'L') seg = [r(c.x), r(c.y)];
    else if (c.type === 'Q') seg = [r(c.x1), r(c.y1), r(c.x), r(c.y)];
    else if (c.type === 'C') seg = [r(c.x1), r(c.y1), r(c.x2), r(c.y2), r(c.x), r(c.y)];
    else if (c.type === 'Z') seg = [];
    else continue;
    if (seg.some((v) => v === null)) return '';
    out.push(c.type + seg.join(' '));
  }
  return out.join('');
}

/** One line of type as an outline path, baseline at `y`. Returns its width. */
function text(ops: PrintOp[], raw: string, x: number, y: number, o: TextOpts): number {
  let s = printableText(raw);
  if (o.caps) s = s.toUpperCase();
  if (!s) return 0;
  let size = o.size;
  const tracking = (o.tracking ?? 0) * size;
  let width = measure(s, o.font, size, tracking);
  if (o.maxWidth && width > o.maxWidth) {
    size = Math.max(size * (o.maxWidth / width), size * 0.55);
    width = measure(s, o.font, size, (o.tracking ?? 0) * size);
  }
  const tr = (o.tracking ?? 0) * size;
  let cx = o.align === 'center' ? x - width / 2 : o.align === 'right' ? x - width : x;
  const parts: string[] = [];
  for (const r of runsFor(s, o.font, size, tr)) {
    if (r.ch !== ' ') {
      const d = pathData(r.font.getPath(r.ch, cx, y, size).commands);
      if (d) parts.push(d);
    }
    cx += r.adv;
  }
  if (parts.length) ops.push({ t: 'path', d: parts.join(' '), fill: o.color, layer: o.layer, opacity: o.opacity });
  return width;
}

/** The same type setter, for the free group's A4 documents (lib/print-report.ts). */
export const drawText = text;
export type PrintTextOpts = TextOpts;

/** Greedy word wrap by measured width. */
export function wrap(raw: string, key: PrintFontKey, size: number, maxWidth: number): string[] {
  const words = printableText(raw).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && measure(next, key, size) > maxWidth) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// ─── Shapes ─────────────────────────────────────────────────────────────────

const f2 = (n: number) => Math.round(n * 100) / 100;

/** The die outline of a sheet, in trim coordinates (SVG path, y down). */
export function diePathFor(die: DieCut, w: number, h: number): string {
  switch (die) {
    case 'rounded': {
      const r = Math.min(w, h) * 0.055;
      return `M${f2(r)} 0H${f2(w - r)}Q${f2(w)} 0 ${f2(w)} ${f2(r)}V${f2(h - r)}Q${f2(w)} ${f2(h)} ${f2(w - r)} ${f2(h)}H${f2(r)}Q0 ${f2(h)} 0 ${f2(h - r)}V${f2(r)}Q0 0 ${f2(r)} 0Z`;
    }
    case 'arch': {
      const r = w / 2;
      return `M0 ${f2(r)}A${f2(r)} ${f2(r)} 0 0 1 ${f2(w)} ${f2(r)}V${f2(h)}H0Z`;
    }
    case 'chevron': {
      const c = w * 0.18;
      return `M0 ${f2(c)}L${f2(w / 2)} 0L${f2(w)} ${f2(c)}V${f2(h)}H0Z`;
    }
    case 'scallop': {
      const n = Math.max(8, Math.round(w / 26));
      const s = w / n;
      const r = s / 2;
      let d = `M0 ${f2(r)}`;
      for (let i = 0; i < n; i += 1) d += `A${f2(r)} ${f2(r)} 0 0 1 ${f2((i + 1) * s)} ${f2(r)}`;
      d += `V${f2(h - r)}`;
      for (let i = n; i > 0; i -= 1) d += `A${f2(r)} ${f2(r)} 0 0 1 ${f2((i - 1) * s)} ${f2(h - r)}`;
      return `${d}Z`;
    }
    case 'deckle': {
      // A torn top edge: a fixed irregular rhythm (deterministic — the same
      // card must cut the same way every time it is downloaded).
      const steps = Math.max(12, Math.round(w / 10));
      const jag = [0, 2.2, 0.8, 3, 1.2, 2.6, 0.4, 1.8, 3.2, 1];
      let d = `M0 ${f2(jag[0]!)}`;
      for (let i = 1; i <= steps; i += 1) d += `L${f2((i * w) / steps)} ${f2(jag[i % jag.length]!)}`;
      return `${d}V${f2(h)}H0Z`;
    }
    default:
      return `M0 0H${f2(w)}V${f2(h)}H0Z`;
  }
}

/** The theme's rule: two hairlines and a small diamond between them. */
function rule(ops: PrintOp[], cx: number, y: number, half: number, color: string) {
  ops.push({ t: 'rect', x: cx - half, y, w: half - 6, h: 0.5, fill: color, opacity: 0.7 });
  ops.push({ t: 'rect', x: cx + 6, y, w: half - 6, h: 0.5, fill: color, opacity: 0.7 });
  ops.push({ t: 'path', d: `M${f2(cx)} ${f2(y - 2.6)}L${f2(cx + 2.6)} ${f2(y + 0.25)}L${f2(cx)} ${f2(y + 3.1)}L${f2(cx - 2.6)} ${f2(y + 0.25)}Z`, fill: color });
}

/** Relative luminance of `#rrggbb` (WCAG). */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const v = parseInt(m[1]!, 16);
  const ch = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch((v >> 16) & 255) + 0.7152 * ch((v >> 8) & 255) + 0.0722 * ch(v & 255);
}
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/**
 * THE COUPLE'S LOGO ON PAPER — drawn in its own colours, fitted to the crest's
 * box (a little wider than tall, so a wordmark is not shrunk to a coin). Parts
 * with no colour of their own (`currentColor` — the ink policy's "follow our
 * mood board") take the theme's accent. A logo whose every colour would vanish
 * into this paper (a black mark on Luxe's black stock) is painted in the accent
 * instead — a mark nobody can see is not the couple's mark either.
 */
function drawMark(ops: PrintOp[], look: PrintLook, m: PrintMonogram, cx: number, cy: number, r: number) {
  const boxW = r * 2.4;
  const boxH = r * 2;
  if (m.kind === 'image') {
    const s = Math.min(boxW / m.w, boxH / m.h);
    ops.push({ t: 'image', ref: 'mark', x: cx - (m.w * s) / 2, y: cy - (m.h * s) / 2, w: m.w * s, h: m.h * s });
    return;
  }
  const { x: bx, y: by, w: bw, h: bh } = m.bounds;
  const s = Math.min(boxW / bw, boxH / bh);
  const ox = cx - (bx + bw / 2) * s;
  const oy = cy - (by + bh / 2) * s;
  const own = m.parts.map((p) => p.fill).filter((f): f is string => Boolean(f));
  const vanishes = own.length > 0 && own.every((f) => contrast(f, look.paper) < 1.6);
  for (const p of m.parts) {
    ops.push({ t: 'path', d: scalePath(p.d, s, ox, oy), fill: vanishes || !p.fill ? look.accent : p.fill, evenOdd: p.evenOdd || undefined });
  }
}

/** The couple's logo (the Maker's Logo tool), or their initials in a ring when they have none. */
function medallion(ops: PrintOp[], look: PrintLook, data: PrintSetData, cx: number, cy: number, r: number, plate: boolean) {
  if (plate) ops.push({ t: 'circle', cx, cy, r: r + 3, fill: look.paper });
  const m = data.monogram;
  if (m) {
    drawMark(ops, look, m, cx, cy, r);
    return;
  }
  ops.push({ t: 'circle', cx, cy, r, stroke: look.accent, sw: Math.max(0.6, r / 40) });
  text(ops, data.initials, cx, cy + r * 0.28, { font: look.headFont, size: r * 0.8, color: look.accent, align: 'center' });
}

/** Scale + translate SVG path data (absolute or relative commands, no arcs'
 *  flags touched). Coordinates are rewritten number-pair by number-pair. */
export function scalePath(d: string, s: number, ox: number, oy: number): string {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const out: string[] = [];
  let cmd = '';
  let idx = 0;
  let rel = false;
  for (const tok of tokens) {
    if (/^[a-zA-Z]$/.test(tok)) {
      cmd = tok;
      rel = tok === tok.toLowerCase();
      idx = 0;
      out.push(tok);
      continue;
    }
    const n = Number(tok);
    const C = cmd.toUpperCase();
    let v = n;
    if (C === 'H') v = rel ? n * s : n * s + ox;
    else if (C === 'V') v = rel ? n * s : n * s + oy;
    else if (C === 'A') {
      const k = idx % 7;
      if (k === 0 || k === 1) v = n * s;
      else if (k === 5) v = rel ? n * s : n * s + ox;
      else if (k === 6) v = rel ? n * s : n * s + oy;
      else v = n;
    } else {
      v = rel ? n * s : idx % 2 === 0 ? n * s + ox : n * s + oy;
    }
    idx += 1;
    out.push(String(f2(v)));
  }
  return out.join(' ');
}

/** The still, placed the theme's way, with its veil. Drawn to the bleed. */
function still(ops: PrintOp[], look: PrintLook, data: PrintSetData, w: number, h: number, b: number, band = 0.44) {
  if (!data.hasStill || look.still === 'none') return { top: 0, left: 0 };
  if (look.still === 'full') {
    ops.push({ t: 'image', ref: 'still', x: -b, y: -b, w: w + 2 * b, h: h + 2 * b });
    if (look.scrim) ops.push({ t: 'rect', x: -b, y: -b, w: w + 2 * b, h: h + 2 * b, fill: look.scrim.color, opacity: look.scrim.opacity });
    return { top: 0, left: 0 };
  }
  if (look.still === 'left') {
    ops.push({ t: 'image', ref: 'still', x: -b, y: -b, w: w * 0.42 + b, h: h + 2 * b });
    ops.push({ t: 'rect', x: w * 0.42, y: -b, w: 0.8, h: h + 2 * b, fill: look.accent });
    return { top: 0, left: w * 0.42 };
  }
  // top band, faded into the paper
  const bh = h * band;
  ops.push({ t: 'image', ref: 'still', x: -b, y: -b, w: w + 2 * b, h: bh + b });
  const steps = 32;
  const fadeFrom = bh * 0.45;
  for (let i = 0; i < steps; i += 1) {
    const y0 = fadeFrom + ((bh - fadeFrom) * i) / steps;
    ops.push({ t: 'rect', x: -b, y: y0, w: w + 2 * b, h: (bh - fadeFrom) / steps + 0.5, fill: look.paper, opacity: Math.min(1, (i + 1) / steps) });
  }
  return { top: bh, left: 0 };
}

/** The two names, stacked: first · and · second. `layer` = foil where the theme foils. */
function lockup(ops: PrintOp[], look: PrintLook, data: PrintSetData, cx: number, y: number, size: number, foil: boolean, maxWidth: number, align: 'center' | 'left' = 'center'): number {
  const layer: PrintLayer | undefined = foil ? 'foil' : undefined;
  const { first, second } = data.names;
  text(ops, first, cx, y, { font: look.headFont, size, color: look.heading, align, caps: look.capsNames, maxWidth, layer });
  if (!second) return y + size * 0.3;
  const andY = y + size * 0.78;
  text(ops, look.scriptFont ? 'and' : '&', cx, andY, { font: look.scriptFont ?? look.headFont, size: size * 0.6, color: look.accent, align });
  const y2 = andY + size * 0.95;
  text(ops, second, cx, y2, { font: look.headFont, size, color: look.heading, align, caps: look.capsNames, maxWidth, layer });
  return y2 + size * 0.3;
}

function eyebrow(ops: PrintOp[], look: PrintLook, s: string, x: number, y: number, size: number, align: 'center' | 'left' = 'center', color?: string) {
  text(ops, s, x, y, { font: look.bodyFont, size, color: color ?? look.muted, align, caps: true, tracking: 0.22 });
}

// ─── The pieces ─────────────────────────────────────────────────────────────

type Ctx = { look: PrintLook; data: PrintSetData; mode: PrintMode; foil: boolean };

function sheet(piece: PrintPieceKey, ctx: Ctx, size?: { w: number; h: number }): PrintDoc {
  const spec = PRINT_PIECES[piece];
  const w = size?.w ?? spec.widthPt;
  const h = size?.h ?? spec.heightPt;
  const bleed = ctx.mode === 'print' ? BLEED_MM * PT_PER_MM : 0;
  const die = dieCutFor(ctx.look.theme, piece, size && size.w > size.h ? { wMm: size.w / PT_PER_MM, hMm: size.h / PT_PER_MM } : null);
  const doc: PrintDoc = { piece, w, h, bleed, die, diePath: diePathFor(die, w, h), ops: [] };
  doc.ops.push({ t: 'rect', x: -bleed, y: -bleed, w: doc.w + 2 * bleed, h: doc.h + 2 * bleed, fill: ctx.look.paper });
  return doc;
}

/** The safe area, shown ON SCREEN ONLY — a guide, never ink. */
function safeGuide(doc: PrintDoc, ctx: Ctx) {
  if (ctx.mode !== 'screen') return;
  const s = SAFE_MM * PT_PER_MM;
  doc.ops.push({ t: 'rect', x: s, y: s, w: doc.w - 2 * s, h: doc.h - 2 * s, stroke: ctx.look.ink, sw: 0.4, opacity: 0.22, dash: true });
}

// ─── The safe area, as the print shop cuts it ──────────────────────────────

/** The safe inset, points (5 mm — THEMES-2026-09-24.md "Print"). */
export const SAFE_PT = SAFE_MM * PT_PER_MM;

/**
 * THE SMALLEST TYPE A CARD MAY PRINT — 6 pt.
 *
 * Owner 2026-09-28: *"make sure prints out fit properly"*, looking at The
 * Entourage running off the foot of the card. The old fit shrank the names
 * toward a hard floor of 5 pt and then drew anyway. 6 pt is the floor US
 * federal labelling law sets for text the public must read on printed
 * packaging (21 CFR 101.9(d)(1)(iii): Nutrition Facts information "in type
 * size no smaller than 6 point"), and the smallest body size print shops
 * accept for a serif. Below it the card continues on its BACK (a second page)
 * — a name is never shrunk to nothing and never dropped.
 */
export const PRINT_MIN_BODY_PT = 6;

/** Ink above / below a baseline, in ems — generous enough for an accented
 *  capital (Á) and a descender (g, j, J) in every bundled face. */
const ASC_EM = 1;
const DESC_EM = 0.42;

/** Is (x, y) — trim coordinates — inside the safe area of this die-cut sheet? */
export function safeContains(die: DieCut, w: number, h: number, x: number, y: number, eps = 0.01): boolean {
  const s = SAFE_PT;
  if (x < s - eps || x > w - s + eps || y < s - eps || y > h - s + eps) return false;
  switch (die) {
    case 'rounded': {
      const r = Math.min(w, h) * 0.055;
      if (r <= s) return true;
      const rr = r - s;
      const corners: Array<[number, number, boolean]> = [
        [r, r, x < r && y < r],
        [w - r, r, x > w - r && y < r],
        [r, h - r, x < r && y > h - r],
        [w - r, h - r, x > w - r && y > h - r],
      ];
      for (const [ccx, ccy, inCorner] of corners) {
        if (inCorner && Math.hypot(x - ccx, y - ccy) > rr + eps) return false;
      }
      return true;
    }
    case 'arch': {
      const r = w / 2;
      return y >= r || Math.hypot(x - r, y - r) <= r - s + eps;
    }
    case 'chevron': {
      const c = w * 0.18;
      const k = (2 * c) / w;
      const x2 = Math.min(x, w - x); // the two slopes are mirror images
      return (y - c + k * x2) / Math.sqrt(1 + k * k) >= s - eps;
    }
    case 'scallop': {
      const n = Math.max(8, Math.round(w / 26));
      const r = w / n / 2;
      return y >= r + s - eps && y <= h - r - s + eps;
    }
    case 'deckle':
      return y >= 3.2 + s - eps;
    default:
      return true;
  }
}

/** Is this whole box inside the safe area? (Every safe region here is convex along each edge.) */
export function safeContainsBox(die: DieCut, w: number, h: number, b: { x: number; y: number; w: number; h: number }): boolean {
  const xs = [b.x, b.x + b.w / 2, b.x + b.w];
  const ys = [b.y, b.y + b.h / 2, b.y + b.h];
  return xs.every((x) => ys.every((y) => safeContains(die, w, h, x, y)));
}

// ─── The corner QR ──────────────────────────────────────────────────────────

/**
 * THE QR IS ALWAYS PRINTED — owner 2026-09-25: *"QR is automatic. NFC is
 * optional. we need that QR code since it is universal and works for all"*.
 * Every card carries the Event Hub QR in a reserved corner (inside the safe
 * area, on a white plate so it scans on any paper); the Finer Details card and
 * the poster carry it large, and a pass carries the guest's own code.
 *
 * WHICH CORNER DEPENDS ON THE CUT. Top-right — unless the theme's die cuts it
 * away: an ARCH (Cinderella, Regency) and a CHEVRON (Great Gatsby) remove the
 * top corners, and a QR drawn there was trimmed off by the print shop
 * (measured 2026-09-28 by `every-print-fits.test.ts`). Those cards carry it
 * bottom-right, and the card's words stop above it (`wordsFloor`).
 */
export const CORNER_QR_PT = 34;
const QR_PLATE = 3;
export type QrSlot = { x: number; y: number; size: number; at: 'top' | 'bottom' };

export function cornerQrSlot(die: DieCut, w: number, h: number): QrSlot {
  const q = CORNER_QR_PT;
  const plate = (x: number, y: number) => ({ x: x - QR_PLATE, y: y - QR_PLATE, w: q + 2 * QR_PLATE, h: q + 2 * QR_PLATE });
  const base = SAFE_PT + 4;
  for (const at of ['top', 'bottom'] as const) {
    for (let nudge = 0; nudge <= 14; nudge += 1) {
      const x = w - base - q - nudge;
      const y = at === 'top' ? base + nudge : h - base - q - nudge;
      if (safeContainsBox(die, w, h, plate(x, y))) return { x, y, size: q, at };
    }
  }
  return { x: w - base - q, y: h - base - q, size: q, at: 'bottom' };
}

function cornerQr(doc: PrintDoc) {
  const slot = cornerQrSlot(doc.die, doc.w, doc.h);
  doc.ops.push({ t: 'rect', x: slot.x - QR_PLATE, y: slot.y - QR_PLATE, w: slot.size + 2 * QR_PLATE, h: slot.size + 2 * QR_PLATE, fill: '#ffffff' });
  doc.ops.push({ t: 'image', ref: 'eventqr', x: slot.x, y: slot.y, w: slot.size, h: slot.size });
}

/** The lowest baseline a card's words may use — clear of the safe line and of a bottom-corner QR. */
function wordsFloor(doc: PrintDoc, ctx: Ctx, descender: number): number {
  let floor = doc.h - SAFE_PT - descender;
  if (ctx.data.hasEventQr) {
    const slot = cornerQrSlot(doc.die, doc.w, doc.h);
    if (slot.at === 'bottom') floor = Math.min(floor, slot.y - QR_PLATE - 6 - descender);
  }
  return floor;
}

/**
 * THE INVITATION, drawn at a type scale `k` and a still band `band`. Returns
 * the card and the lowest ink it drew, so `layoutInvitation` can MEASURE the
 * card it would print rather than estimate it.
 */
function drawInvitation(ctx: Ctx, k: number, band: number): { doc: PrintDoc; end: number } {
  const { look, data } = ctx;
  const doc = sheet('invitation', ctx);
  const { w, h, bleed, ops } = doc;
  const placed = still(ops, look, data, w, h, bleed, band);
  const left = placed.left;
  const cx = left + (w - left) / 2;
  const inner = w - left - 52;
  let y: number;
  if (placed.top > 0) {
    medallion(ops, look, data, cx, placed.top, 30 * k, true);
    y = placed.top + 50 * k;
  } else {
    medallion(ops, look, data, cx, 64, 30 * k, false);
    y = 64 + 54 * k;
  }
  const d = data.details;
  if (d.openingLine) {
    const top = y - 8.4 * k;
    for (const line of wrap(d.openingLine, look.bodyFont, 8.4 * k, inner)) {
      text(ops, line, cx, y, { font: look.bodyFont, size: 8.4 * k, color: look.muted, align: 'center' });
      y += 11 * k;
    }
    // The box the couple taps: the lines' full measure, cap to descender.
    doc.fields = [{ field: 'opening_line', x: cx - inner / 2, y: top, w: inner, h: y - 11 * k + 8.4 * k * DESC_EM - top }];
    y += 4 * k;
  }
  const groom = d.parents.filter((p) => p.side === 'groom');
  const bride = d.parents.filter((p) => p.side === 'bride');
  if (groom.length || bride.length) {
    const colW = inner / 2 - 6;
    // Each column wraps its own long names (a title and a suffix can pass 40
    // characters); the row is as tall as its taller side.
    for (let i = 0; i < Math.max(groom.length, bride.length); i += 1) {
      const gl = groom[i] ? wrap(parentLine(groom[i]!), look.bodyFont, 8 * k, colW) : [];
      const bl = bride[i] ? wrap(parentLine(bride[i]!), look.bodyFont, 8 * k, colW) : [];
      for (let j = 0; j < Math.max(gl.length, bl.length); j += 1) {
        if (gl[j]) text(ops, gl[j]!, cx - 6, y, { font: look.bodyFont, size: 8 * k, color: look.ink, align: 'right', maxWidth: colW });
        if (bl[j]) text(ops, bl[j]!, cx + 6, y, { font: look.bodyFont, size: 8 * k, color: look.ink, align: 'left', maxWidth: colW });
        y += 10.5 * k;
      }
    }
    y += 6 * k;
  }
  eyebrow(ops, look, data.eyebrow, cx, y, 7.2 * k);
  y += 30 * k;
  y = lockup(ops, look, data, cx, y, 27 * k, ctx.foil, inner);
  y += 14 * k;
  rule(ops, cx, y, 40, look.accent);
  y += 16 * k;
  let end = y;
  if (data.dateLabel) {
    text(ops, data.dateLabel, cx, y, { font: look.bodyFont, size: 9 * k, color: look.ink, align: 'center', caps: true, tracking: 0.12, maxWidth: inner });
    end = y + 9 * k * DESC_EM;
    y += 12 * k;
  }
  if (data.ceremonyTime) {
    text(ops, `Ceremony at ${data.ceremonyTime}`, cx, y, { font: look.bodyFont, size: 8.4 * k, color: look.muted, align: 'center' });
    end = y + 8.4 * k * DESC_EM;
    y += 14 * k;
  }
  // Every line of a venue prints — a long church name is not cut to two lines.
  if (data.ceremonyVenue) {
    for (const line of wrap(data.ceremonyVenue, look.bodyFont, 9.2 * k, inner)) {
      text(ops, line, cx, y, { font: look.bodyFont, size: 9.2 * k, color: look.heading, align: 'center' });
      end = y + 9.2 * k * DESC_EM;
      y += 11.5 * k;
    }
    y += 4 * k;
  }
  if (data.receptionVenue || data.receptionTime) {
    const bits = ['Reception to follow', data.receptionVenue, data.receptionTime].filter(Boolean).join(' · ');
    for (const line of wrap(bits, look.bodyFont, 8.2 * k, inner)) {
      text(ops, line, cx, y, { font: look.bodyFont, size: 8.2 * k, color: look.muted, align: 'center' });
      end = y + 8.2 * k * DESC_EM;
      y += 10.5 * k;
    }
  }
  if (data.hasEventQr) cornerQr(doc);
  safeGuide(doc, ctx);
  return { doc, end };
}

/**
 * The invitation at the largest type that ends above its floor (the safe line,
 * this die's foot, a bottom-corner QR) — first by shrinking the type toward
 * `PRINT_MIN_BODY_PT` (its smallest line is the 7.2 pt eyebrow), then by giving
 * a theme's photo band less of the card. Measured on the drawn card.
 */
function layoutInvitation(ctx: Ctx): PrintDoc {
  const kMin = PRINT_MIN_BODY_PT / 7.2;
  let last: { doc: PrintDoc; end: number } | null = null;
  for (const band of [0.44, 0.38, 0.32, 0.26]) {
    for (let k = 1; k >= kMin - 1e-9; k = Math.round((k - 0.02) * 1000) / 1000) {
      const drawn = drawInvitation(ctx, k, band);
      const floor = Math.min(wordsFloor(drawn.doc, ctx, 0), safeBottom(drawn.doc, 26, drawn.doc.w - 26));
      if (drawn.end <= floor) return drawn.doc;
      last = drawn;
    }
    if (!ctx.data.hasStill || ctx.look.still !== 'top') break;
  }
  return last!.doc;
}

function cardHead(ctx: Ctx, doc: PrintDoc, small: string, title: string): number {
  const { look, data } = ctx;
  const cx = doc.w / 2;
  // The crest sits 44 pt down — lower when this die's edge (a scallop's
  // cusps, a deckle's tear) needs it to clear the safe line.
  const r = 17;
  let cy = 44;
  for (let k = 0; k < 60 && !safeContainsBox(doc.die, doc.w, doc.h, { x: cx - r * 1.2, y: cy - r, w: r * 2.4, h: r * 2 }); k += 1) cy += 1;
  const d = cy - 44;
  medallion(doc.ops, look, data, cx, cy, r, false);
  eyebrow(doc.ops, look, small, cx, 78 + d, 7);
  text(doc.ops, title, cx, 102 + d, { font: look.headFont, size: 22, color: look.heading, align: 'center', caps: look.capsNames, maxWidth: doc.w - 60, layer: ctx.foil ? 'foil' : undefined });
  rule(doc.ops, cx, 114 + d, 30, look.accent);
  return 132 + d;
}

function sectionHead(ops: PrintOp[], look: PrintLook, s: string, cx: number, y: number, half: number, size = 7) {
  const width = measure(s.toUpperCase(), look.bodyFont, size, 0.24 * size);
  text(ops, s, cx, y, { font: look.bodyFont, size, color: look.accent, align: 'center', caps: true, tracking: 0.24, maxWidth: half * 2 });
  const gap = width / 2 + 7;
  if (half > gap + 6) {
    ops.push({ t: 'rect', x: cx - half, y: y - 2.6, w: half - gap, h: 0.5, fill: look.accent, opacity: 0.6 });
    ops.push({ t: 'rect', x: cx + gap, y: y - 2.6, w: half - gap, h: 0.5, fill: look.accent, opacity: 0.6 });
  }
}

// ─── The Entourage: measured, balanced, never off the card ─────────────────

/** One printed line of a group: a pair across the middle, or one name down it. */
export type EntourageLine = { l?: string; r?: string; c?: string };

/**
 * A group as printed lines.
 *
 * ⚖ Owner 2026-09-14: *"two columns, paired across"* — a real pair (both halves
 * in this group) keeps its shared line, in the columns their roles say.
 * ⚖ Owner 2026-09-28: *"make sure prints out fit properly"* — on cale-ice's card
 * the twelve bridesmaids ran down the left column and the twelve groomsmen
 * started in the right column only BELOW them, one long ragged list. So the
 * UNPAIRED halves now stack per column, side by side, and the two columns end
 * together; a long one-sided remainder flows into two columns. Nobody is moved
 * to the other family's side of a real pair, and nobody is dropped.
 *
 * A group with no pairs whose people all sit on one side (bearers, flower
 * girls, the secondary sponsors) reads down the middle — or, when `flow` is on
 * because the card is full, in two balanced columns.
 */
export function printedEntourageLines(g: EntourageGroup, flow: boolean): EntourageLine[] {
  const pairs: EntourageLine[] = [];
  const left: string[] = [];
  const right: string[] = [];
  const withRole = (p: EntouragePerson) => {
    const label = roleLabel(p.role);
    return g.key === 'secondary_sponsors' && label ? `${p.name} · ${label}` : p.name;
  };
  for (const [l, r] of g.rows) {
    if (l && r) pairs.push({ l: l.name, r: r.name });
    else if (l) left.push(withRole(l));
    else if (r) right.push(withRole(r));
  }
  const twoCols = (list: string[]): EntourageLine[] => {
    const half = Math.ceil(list.length / 2);
    return list.slice(0, half).map((l, i) => ({ l, r: list[half + i] }));
  };
  if (!pairs.length && (!left.length || !right.length)) {
    const list = left.length ? left : right;
    return flow && list.length >= 3 ? twoCols(list) : list.map((c) => ({ c }));
  }
  const out = [...pairs];
  if (left.length && right.length) {
    for (let i = 0; i < Math.max(left.length, right.length); i += 1) out.push({ l: left[i], r: right[i] });
  } else if (left.length + right.length > 1) out.push(...twoCols(left.length ? left : right));
  else if (left.length) out.push({ l: left[0] });
  else if (right.length) out.push({ r: right[0] });
  return out;
}

type PlacedText = { s: string; x: number; y: number; align: 'left' | 'right' | 'center'; width: number };

/**
 * One name → its printed line(s) in a column this wide. A name a hair too long
 * is set a touch tighter (never below 88 % of the size, never below the floor)
 * rather than stranding its "Jr." on a line of its own; a genuinely long one
 * breaks into two BALANCED lines.
 */
export function nameLines(s: string, font: PrintFontKey, size: number, width: number): string[] {
  const full = measure(printableText(s), font, size);
  if (full <= width) return [s];
  if (size * (width / full) >= Math.max(PRINT_MIN_BODY_PT, size * 0.88)) return [s];
  const lines = wrap(s, font, size, width);
  if (lines.length !== 2) return lines;
  // "Name · Candle Sponsor" breaks at its separator — the role on its own line.
  const dot = s.lastIndexOf(' · ');
  if (dot > 0) {
    const a = s.slice(0, dot);
    const b = s.slice(dot + 3);
    if (measure(a, font, size) <= width && measure(b, font, size) <= width) return [a, b];
  }
  const words = printableText(s).split(/\s+/).filter(Boolean);
  let best = lines;
  let bestW = Math.max(...lines.map((l) => measure(l, font, size)));
  for (let i = 1; i < words.length; i += 1) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const wMax = Math.max(measure(a, font, size), measure(b, font, size));
    if (wMax <= width && wMax < bestW) {
      best = [a, b];
      bestW = wMax;
    }
  }
  return best;
}
type PlannedPage = { heads: Array<{ label: string; y: number }>; texts: PlacedText[] };

/**
 * Where every line of the Entourage goes — computed with the SAME widths,
 * leading and wrapping the drawing uses, so "it fits" is a measurement of the
 * card that will be drawn, not an estimate of it. Returns one page per side.
 */
function planEntourage(
  groups: EntourageGroup[],
  size: number,
  flow: boolean,
  geo: { w: number; h: number; die: DieCut; font: PrintFontKey; top: (page: number) => number; floor: (page: number) => number },
): PlannedPage[] {
  const { w } = geo;
  const cx = w / 2;
  const colW = (w - 56) / 2 - 6;
  const fullW = w - 60;
  const lead = size * 1.36;
  const gap = 22 * (size / 8.4);
  const desc = size * DESC_EM;
  const pages: PlannedPage[] = [{ heads: [], texts: [] }];
  let page = 0;
  let y = geo.top(0);
  // A line's ink must sit inside the die's safe area at BOTH ends (arch and
  // chevron cuts narrow the top of the card).
  const lineSafe = (base: number, x0: number, x1: number) =>
    [x0, x1].every((x) => safeContains(geo.die, geo.w, geo.h, x, base - size * ASC_EM) && safeContains(geo.die, geo.w, geo.h, x, base + desc));
  const newPage = () => {
    page += 1;
    pages.push({ heads: [], texts: [] });
    y = geo.top(page);
  };
  for (const g of groups) {
    const lines = printedEntourageLines(g, flow);
    let headDone = false;
    for (let i = 0; i < lines.length; i += 1) {
      const row = lines[i]!;
      const wrapped = row.c !== undefined
        ? { c: nameLines(row.c, geo.font, size, fullW) }
        : { l: row.l ? nameLines(row.l, geo.font, size, colW) : [], r: row.r ? nameLines(row.r, geo.font, size, colW) : [] };
      const n = 'c' in wrapped ? wrapped.c!.length : Math.max(wrapped.l!.length, wrapped.r!.length);
      const headH = headDone ? 0 : gap;
      if (y + headH + n * lead + desc > geo.floor(page) && (pages[page]!.texts.length > 0 || pages[page]!.heads.length > 0)) {
        newPage();
        headDone = false;
      }
      const x0 = row.c !== undefined ? cx - fullW / 2 : cx - 6 - colW;
      const x1 = row.c !== undefined ? cx + fullW / 2 : cx + 6 + colW;
      if (!headDone) {
        y += gap * 0.78;
        for (let k = 0; k < 400 && !lineSafe(y, cx - (w - 56) / 2, cx + (w - 56) / 2); k += 1) y += 1;
        pages[page]!.heads.push({ label: i > 0 ? `${g.label} · continued` : g.label, y });
        y += gap * 0.2;
        headDone = true;
      }
      for (let k = 0; k < n; k += 1) {
        y += lead;
        for (let t = 0; t < 400 && !lineSafe(y, x0, x1); t += 1) y += 1;
        if ('c' in wrapped) {
          const s = wrapped.c![k]!;
          pages[page]!.texts.push({ s, x: cx, y, align: 'center', width: fullW });
        } else {
          const l = wrapped.l![k];
          const r = wrapped.r![k];
          if (l) pages[page]!.texts.push({ s: l, x: cx - 6, y, align: 'right', width: colW });
          if (r) pages[page]!.texts.push({ s: r, x: cx + 6, y, align: 'left', width: colW });
        }
      }
    }
  }
  // A plan whose last line still overflows (one enormous row) reports it by
  // having a text below the floor — the chooser rejects it.
  return pages;
}

function planFits(pages: PlannedPage[], floor: (page: number) => number, size: number): boolean {
  return pages.every((p, i) => p.texts.every((t) => t.y + size * DESC_EM <= floor(i) + 0.01) && p.heads.every((hd) => hd.y <= floor(i)));
}

/**
 * THE ENTOURAGE — every name, inside the safe area, as large as it can be.
 *
 * The size is CHOSEN by laying the card out (`planEntourage`) at each size from
 * 8.4 pt down to `PRINT_MIN_BODY_PT`, straight and then flowed into two
 * columns, and keeping the largest that fits on the fewest sides. When even the
 * floor will not fit one side, the card continues on its BACK — a second page
 * of the same PDF, shown in the Maker as "Front · Back". It never draws past
 * the safe line and never drops a name (owner 2026-09-28, "make sure prints out
 * fit properly").
 */
function layoutEntourage(ctx: Ctx): PrintDoc[] {
  const { look, data } = ctx;
  const front = sheet('entourage', ctx);
  const { w, h } = front;
  const cx = w / 2;
  if (look.still === 'full' && data.hasStill) still(front.ops, look, data, w, h, front.bleed);
  const firstTop = cardHead(ctx, front, 'The', 'Entourage');
  const groups = data.entourage;
  if (!groups.length) {
    let y = firstTop;
    for (const line of wrap('Your entourage prints here once roles are set on the Guest list.', look.bodyFont, 8.4, w - 80)) {
      text(front.ops, line, cx, y + 20, { font: look.bodyFont, size: 8.4, color: look.muted, align: 'center' });
      y += 11;
    }
    if (data.hasEventQr) cornerQr(front);
    safeGuide(front, ctx);
    return [front];
  }
  const backTop = continuedHead(sheet('entourage', ctx), ctx, 'The Entourage');
  const geo = {
    w,
    h,
    die: front.die,
    font: look.bodyFont,
    top: (p: number) => (p === 0 ? firstTop : backTop),
    // The back carries no QR (it rides the front), so only the safe line binds it.
    floor: (p: number) => (p === 0 ? wordsFloor(front, ctx, 0) : h - SAFE_PT),
  };
  let best: { pages: PlannedPage[]; size: number } | null = null;
  for (let size = 8.4; size >= PRINT_MIN_BODY_PT - 1e-9; size = Math.round((size - 0.2) * 10) / 10) {
    for (const flow of [false, true]) {
      const pages = planEntourage(groups, size, flow, geo);
      if (!planFits(pages, geo.floor, size)) continue;
      if (!best || pages.length < best.pages.length) best = { pages, size };
    }
    if (best && best.pages.length === 1) break;
  }
  // Nothing fits even across sides (a single impossible row) — draw at the floor anyway; the fit test names it.
  if (!best) best = { pages: planEntourage(groups, PRINT_MIN_BODY_PT, true, geo), size: PRINT_MIN_BODY_PT };
  const size = best.size;
  const docs: PrintDoc[] = [];
  best.pages.forEach((p, i) => {
    const doc = i === 0 ? front : sheet('entourage', ctx);
    if (i > 0) {
      if (look.still === 'full' && data.hasStill) still(doc.ops, look, data, w, h, doc.bleed);
      continuedHead(doc, ctx, 'The Entourage');
    }
    for (const hd of p.heads) sectionHead(doc.ops, look, hd.label, cx, hd.y, (w - 56) / 2);
    for (const t of p.texts) text(doc.ops, t.s, t.x, t.y, { font: look.bodyFont, size, color: look.ink, align: t.align, maxWidth: t.width });
    if (i === 0 && data.hasEventQr) cornerQr(doc);
    safeGuide(doc, ctx);
    docs.push(doc);
  });
  return docs;
}

/** Radius of the NFC sticker spot, in points — true to the 25 mm sticker. */
export const NFC_SPOT_R = (NFC_STICKER_DIAMETER_MM * PT_PER_MM) / 2;
/** The spot plus its clear margin, as a radius. */
export const NFC_SPOT_CLEAR_R = NFC_SPOT_R + NFC_STICKER_MARGIN_MM * PT_PER_MM;

/** Can a 25 mm spot + its 2 mm margin sit in an area this size, beside the lockup? */
export function nfcFits(areaW: number, areaH: number): boolean {
  return areaH >= NFC_SPOT_CLEAR_R * 2 && areaW >= NFC_SPOT_CLEAR_R * 2 + 80;
}

/**
 * "PLACE NFC STICKER HERE" — a 25 mm dashed guide ring, true to size (owner:
 * *"The NFC Sticker recommended is the 25mm diameter stickers"*), with an NFC
 * glyph and "Tap here" inside, drawn where the sticker will cover it. The
 * caller keeps ≥ 2 mm clear around it (`NFC_SPOT_CLEAR_R`).
 */
function nfcSpot(ops: PrintOp[], look: PrintLook, cx: number, cy: number) {
  const r = NFC_SPOT_R;
  ops.push({ t: 'circle', cx, cy, r, stroke: look.muted, sw: 0.6, dash: true, nfc: true });
  const x0 = cx - r * 0.22;
  const y0 = cy - r * 0.12;
  for (const k of [0.16, 0.28, 0.4]) {
    const a = (40 * Math.PI) / 180;
    const rr = r * k;
    ops.push({
      t: 'path',
      d: `M${f2(x0 + rr * Math.cos(-a))} ${f2(y0 + rr * Math.sin(-a))}A${f2(rr)} ${f2(rr)} 0 0 1 ${f2(x0 + rr * Math.cos(a))} ${f2(y0 + rr * Math.sin(a))}`,
      stroke: look.muted,
      sw: 0.9,
    });
  }
  text(ops, 'Tap here', cx, cy + r * 0.52, { font: look.bodyFont, size: Math.max(5, r * 0.2), color: look.muted, align: 'center', caps: true, tracking: 0.14 });
}

// ─── A card of flowing words: measured, paged, never off the card ──────────

/**
 * One line (or one small figure) of a flowing card. `adv` is the space above
 * its baseline, `after` the space below it before the next row; `top`/`below`
 * are its ink above and below the baseline; `x0`/`x1` its horizontal extent,
 * so a die cut that narrows the card (an arch, a chevron) can push it down.
 */
type FlowRow = {
  adv: number;
  after: number;
  top: number;
  below: number;
  x0: number;
  x1: number;
  /** A heading never ends a side — it moves with the line under it. */
  keepWithNext?: boolean;
  /** The print-only words this row draws, so the Maker can make them tappable. */
  field?: PrintField;
  draw: (ops: PrintOp[], y: number) => void;
};

/** The tappable boxes of the rows placed on one side — one box per field, their union. */
function fieldBoxes(placed: Array<{ row: FlowRow; y: number }>): PrintFieldBox[] {
  const out = new Map<PrintField, { x0: number; y0: number; x1: number; y1: number }>();
  for (const { row, y } of placed) {
    if (!row.field) continue;
    const b = { x0: row.x0, y0: y - row.top, x1: row.x1, y1: y + row.below };
    const had = out.get(row.field);
    out.set(
      row.field,
      had ? { x0: Math.min(had.x0, b.x0), y0: Math.min(had.y0, b.y0), x1: Math.max(had.x1, b.x1), y1: Math.max(had.y1, b.y1) } : b,
    );
  }
  return [...out].map(([field, b]) => ({ field, x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 }));
}

type FlowGeo = { die: DieCut; w: number; h: number; top: (page: number) => number; floor: (page: number) => number };

/** Place rows side by side down the card, continuing on a new side when the floor is reached. */
function flowPages(rows: FlowRow[], geo: FlowGeo): { pages: Array<Array<{ row: FlowRow; y: number }>>; fits: boolean } {
  const pages: Array<Array<{ row: FlowRow; y: number }>> = [[]];
  let page = 0;
  let y = geo.top(0);
  let fits = true;
  const safeAt = (r: FlowRow, base: number) =>
    [r.x0, r.x1].every((x) => safeContains(geo.die, geo.w, geo.h, x, base - r.top) && safeContains(geo.die, geo.w, geo.h, x, base + r.below));
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i]!;
    const next = rows[i + 1];
    const need = (base: number) => base + r.below <= geo.floor(page) && (!r.keepWithNext || !next || base + r.after + next.adv + next.below <= geo.floor(page));
    let base = y + r.adv;
    if (!need(base) && pages[page]!.length > 0) {
      page += 1;
      pages.push([]);
      y = geo.top(page);
      base = y + r.adv;
    }
    for (let k = 0; k < 400 && !safeAt(r, base); k += 1) base += 1;
    if (base + r.below > geo.floor(page) + 0.01) fits = false;
    pages[page]!.push({ row: r, y: base });
    y = base + r.after;
  }
  return { pages, fits };
}

/**
 * The head of a card's BACK: "<Title> · continued" and the theme's rule, placed
 * where the die cut leaves room for it. Returns where the words may start.
 */
function continuedHead(doc: PrintDoc, ctx: Ctx, title: string): number {
  const { look } = ctx;
  const cx = doc.w / 2;
  const label = `${title} · continued`;
  const half = measure(label.toUpperCase(), look.bodyFont, 7, 0.22 * 7) / 2;
  let y = SAFE_PT + 22;
  for (let k = 0; k < 200 && !safeContainsBox(doc.die, doc.w, doc.h, { x: cx - half, y: y - 6, w: half * 2, h: 8 }); k += 1) y += 1;
  eyebrow(doc.ops, look, label, cx, y, 7);
  rule(doc.ops, cx, y + 10, 30, look.accent);
  return y + 22;
}

/** The lowest y the words may reach at the foot of the card, across [x0, x1], for this die. */
function safeBottom(doc: PrintDoc, x0: number, x1: number): number {
  let y = doc.h - SAFE_PT;
  while (y > 0 && ![x0, x1].every((x) => safeContains(doc.die, doc.w, doc.h, x, y))) y -= 1;
  return y;
}

/**
 * Choose the largest type scale (1 → the floor where the smallest line is
 * `PRINT_MIN_BODY_PT`) at which the rows fit on the FEWEST sides.
 */
function chooseScale(build: (f: number) => FlowRow[], geo: FlowGeo, smallest: number): { f: number; pages: ReturnType<typeof flowPages>['pages'] } {
  const fMin = Math.min(1, PRINT_MIN_BODY_PT / smallest);
  let best: { f: number; pages: ReturnType<typeof flowPages>['pages'] } | null = null;
  for (let f = 1; f >= fMin - 1e-9; f = Math.round((f - 0.02) * 1000) / 1000) {
    const { pages, fits } = flowPages(build(f), geo);
    if (!fits) continue;
    if (!best || pages.length < best.pages.length) best = { f, pages };
    if (best.pages.length === 1) break;
  }
  return best ?? { f: fMin, pages: flowPages(build(fMin), geo).pages };
}

/** Rows for one wrapped, centred paragraph. */
function paraRows(look: PrintLook, s: string, size: number, color: string, cx: number, inner: number, lead = size * 1.4, first = 0): FlowRow[] {
  return wrap(s, look.bodyFont, size, inner).map((line, i) => ({
    adv: (i === 0 ? first : 0) + lead,
    after: 0,
    top: size * ASC_EM,
    below: size * DESC_EM,
    x0: cx - inner / 2,
    x1: cx + inner / 2,
    draw: (ops: PrintOp[], y: number) => {
      text(ops, line, cx, y, { font: look.bodyFont, size, color, align: 'center', maxWidth: inner });
    },
  }));
}

function headRow(look: PrintLook, label: string, cx: number, inner: number, before: number, after: number, size = 7): FlowRow {
  return {
    adv: before,
    after,
    top: size * 0.8,
    below: 1,
    x0: cx - inner / 2,
    x1: cx + inner / 2,
    keepWithNext: true,
    draw: (ops, y) => sectionHead(ops, look, label, cx, y, inner / 2, size),
  };
}

function layoutDetails(ctx: Ctx): PrintDoc[] {
  const { look, data } = ctx;
  const front = sheet('details', ctx);
  const { w, h } = front;
  if (look.still === 'full' && data.hasStill) still(front.ops, look, data, w, h, front.bleed);
  const firstTop = cardHead(ctx, front, 'The', 'Finer Details');
  const cx = w / 2;
  const inner = w - 68;

  // The Event Hub: the one address every guest can use — RSVP, the schedule,
  // the venue map. The QR is ALWAYS printed; its room is reserved at the foot
  // of the FRONT, placed on this die's safe line, and the words stop above it.
  const q = 56;
  const hubBase = Math.min(h - 18, safeBottom(front, cx - inner / 2, cx + inner / 2) - 2.5);
  const qy = hubBase - 26 - q;
  const withNfc = data.details.nfc === true;
  {
    const ops = front.ops;
    const qx = withNfc ? cx - q / 2 - NFC_SPOT_CLEAR_R - 4 : cx;
    ops.push({ t: 'rect', x: qx - q / 2 - 4, y: qy - 4, w: q + 8, h: q + 8, fill: '#ffffff' });
    ops.push({ t: 'image', ref: 'eventqr', x: qx - q / 2, y: qy, w: q, h: q });
    if (withNfc) nfcSpot(ops, look, cx + q / 2 + 4, qy + q / 2);
    eyebrow(ops, look, withNfc ? 'Scan or tap for our Event Hub' : 'Scan for our Event Hub', cx, qy + q + 16, 6.6);
    if (data.hubAddress) text(ops, data.hubAddress, cx, hubBase, { font: look.bodyFont, size: 7, color: look.muted, align: 'center', maxWidth: inner });
  }
  const frontFloor = Math.min(qy - 4, withNfc ? qy + q / 2 - NFC_SPOT_R : qy - 4) - 8;

  const build = (f: number): FlowRow[] => {
    const rows: FlowRow[] = [];
    const body = 8.2 * f;
    const small = 7.6 * f;
    const head = Math.max(PRINT_MIN_BODY_PT, 7 * f);
    if (data.attire.length || data.swatches.length) {
      rows.push(headRow(look, 'Dress code', cx, inner, 14 * f, 4 * f, head));
      for (const a of data.attire) rows.push(...paraRows(look, `${a.label} — ${a.line}`, body, look.ink, cx, inner));
      if (data.swatches.length) {
        const n = Math.min(6, data.swatches.length);
        const step = 15;
        rows.push({
          adv: 13 * f,
          after: 6 * f,
          top: 8,
          below: 2,
          x0: cx - ((n - 1) * step) / 2 - 5,
          x1: cx + ((n - 1) * step) / 2 + 5,
          draw: (ops, y) => {
            let sx = cx - ((n - 1) * step) / 2;
            for (const c of data.swatches.slice(0, n)) {
              ops.push({ t: 'circle', cx: sx, cy: y - 3, r: 5, fill: c, stroke: look.ink, sw: 0.3 });
              sx += step;
            }
          },
        });
      }
    }
    if (data.details.rsvpContact) {
      rows.push(
        ...[headRow(look, 'Kindly reply', cx, inner, 16 * f, 2 * f, head), ...paraRows(look, data.details.rsvpContact, body, look.ink, cx, inner)].map(
          (r) => ({ ...r, field: 'rsvp' as const }),
        ),
      );
    }
    if (data.details.giftLines.length) {
      rows.push(headRow(look, 'Gifts', cx, inner, 16 * f, 2 * f, head));
      for (const g of data.details.giftLines) rows.push(...paraRows(look, maskAccountLine(g), body, look.ink, cx, inner));
    }
    if (data.details.thankYou) rows.push(...paraRows(look, data.details.thankYou, 7.4 * f, look.muted, cx, inner, 10 * f, 6 * f));
    if (data.details.program?.length) {
      rows.push(headRow(look, 'The program', cx, inner, 16 * f, 2 * f, head));
      for (const line of data.details.program) rows.push(...paraRows(look, line, small, look.ink, cx, inner));
    }
    if (data.details.storyExcerpt) {
      rows.push(headRow(look, 'Our story', cx, inner, 16 * f, 2 * f, head));
      rows.push(...paraRows(look, data.details.storyExcerpt, small, look.muted, cx, inner));
    }
    if (data.details.specialMessage) rows.push(...paraRows(look, data.details.specialMessage, small, look.ink, cx, inner, 10.5 * f, 10 * f));
    return rows;
  };

  const backTopProbe = sheet('details', ctx);
  const geo: FlowGeo = {
    die: front.die,
    w,
    h,
    top: (p) => (p === 0 ? firstTop : continuedHead(backTopProbe, ctx, 'The Finer Details')),
    floor: (p) => (p === 0 ? frontFloor : h - SAFE_PT),
  };
  const { pages } = chooseScale(build, geo, 7.4);
  const docs: PrintDoc[] = [];
  pages.forEach((placed, i) => {
    const doc = i === 0 ? front : sheet('details', ctx);
    if (i > 0) {
      if (look.still === 'full' && data.hasStill) still(doc.ops, look, data, w, h, doc.bleed);
      continuedHead(doc, ctx, 'The Finer Details');
    }
    for (const { row, y } of placed) row.draw(doc.ops, y);
    const boxes = fieldBoxes(placed);
    if (boxes.length) doc.fields = boxes;
    safeGuide(doc, ctx);
    docs.push(doc);
  });
  return docs;
}

/**
 * THE MENU — owner 2026-09-28: *"add to print out our meals for tonight. from
 * vendors from ceremony, to cocktail to the buffet."* Each moment of the night
 * as a heading (in the order the couple set), its dishes beneath, in the same
 * theme, crest and QR corner as the Entourage and the Finer Details. Measured
 * and paged by the same engine: the largest type that fits, a back side when
 * a long buffet needs one, never past the safe line.
 *
 * With no dishes the card is NEVER printed (the route refuses it and the Maker
 * offers no download); the Maker's picture of it carries the "add your menu"
 * prompt instead, so a couple sees where the card will be.
 */
function layoutMenu(ctx: Ctx): PrintDoc[] {
  const { look, data } = ctx;
  const front = sheet('menu', ctx);
  const { w, h } = front;
  if (look.still === 'full' && data.hasStill) still(front.ops, look, data, w, h, front.bleed);
  const firstTop = cardHead(ctx, front, 'The', 'Menu');
  const cx = w / 2;
  const inner = w - 68;
  const moments = (data.menu ?? []).filter((m) => m.dishes.length > 0);
  if (!menuHasDishes(moments)) {
    let y = firstTop + 20;
    for (const line of wrap('Add your menu in Details — the moments of your night, and the dishes of each.', look.bodyFont, 8.4, w - 80)) {
      text(front.ops, line, cx, y, { font: look.bodyFont, size: 8.4, color: look.muted, align: 'center' });
      y += 11;
    }
    if (data.hasEventQr) cornerQr(front);
    safeGuide(front, ctx);
    return [front];
  }
  const build = (f: number): FlowRow[] => {
    const rows: FlowRow[] = [];
    const dish = 9 * f;
    const head = Math.max(PRINT_MIN_BODY_PT, 7.4 * f);
    moments.forEach((m, i) => {
      const before = (i === 0 ? 12 : 22) * f;
      if (m.title) rows.push(headRow(look, m.title, cx, inner, before, 4 * f, head));
      m.dishes.forEach((d, j) => rows.push(...paraRows(look, d, dish, look.ink, cx, inner, dish * 1.5, !m.title && j === 0 ? before : 0)));
    });
    return rows;
  };
  const backProbe = sheet('menu', ctx);
  const geo: FlowGeo = {
    die: front.die,
    w,
    h,
    top: (p) => (p === 0 ? firstTop : continuedHead(backProbe, ctx, 'The Menu')),
    floor: (p) => (p === 0 ? wordsFloor(front, ctx, 0) : h - SAFE_PT),
  };
  const { pages } = chooseScale(build, geo, 9);
  return pages.map((placed, i) => {
    const doc = i === 0 ? front : sheet('menu', ctx);
    if (i > 0) {
      if (look.still === 'full' && data.hasStill) still(doc.ops, look, data, w, h, doc.bleed);
      continuedHead(doc, ctx, 'The Menu');
    }
    for (const { row, y } of placed) row.draw(doc.ops, y);
    if (i === 0 && data.hasEventQr) cornerQr(doc);
    safeGuide(doc, ctx);
    return doc;
  });
}

// ─── The Our Story poster ────────────────────────────────────────────────────

type ColumnPlacement = { i: number; y: number; sheet: number; col: number };

/**
 * Rows down COLUMNS, then onto a further sheet — the poster's own flow (the
 * cards flow one column, `flowPages`). The poster is cut straight (`rect`), so
 * only the floor bounds a row, never the die. `colFloor` caps the first sheet's
 * columns lower than the sheet allows, to balance two columns.
 */
function flowColumns(
  rows: readonly FlowRow[],
  cols: number,
  top: (sheet: number) => number,
  floor: (sheet: number) => number,
  colFloor = Infinity,
): { placed: ColumnPlacement[]; sheets: number; fits: boolean; bottom: number } {
  const placed: ColumnPlacement[] = [];
  let sheet = 0;
  let col = 0;
  let y = top(0);
  let inCol = 0;
  let fits = true;
  let bottom = y;
  const fl = () => Math.min(floor(sheet), sheet === 0 ? colFloor : Infinity);
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i]!;
    const next = rows[i + 1];
    const need = (base: number) => base + r.below <= fl() && (!r.keepWithNext || !next || base + r.after + next.adv + next.below <= fl());
    let base = y + r.adv;
    if (!need(base) && inCol > 0) {
      col += 1;
      if (col === cols) {
        col = 0;
        sheet += 1;
      }
      y = top(sheet);
      inCol = 0;
      base = y + r.adv;
    }
    if (base + r.below > fl() + 0.01) fits = false;
    placed.push({ i, y: base, sheet, col });
    bottom = Math.max(bottom, sheet === 0 ? base + r.below : bottom);
    y = base + r.after;
    inCol += 1;
  }
  return { placed, sheets: sheet + 1, fits, bottom };
}

/**
 * THE OUR STORY POSTER — owner 2026-09-26, verbatim: *"is it possible to
 * generate a A3 printable of their stories? so they can print it and frame
 * it?"* The couple's Love Story on an A3 sheet, in their theme: the theme's
 * still where it puts one, their logo, "Our story", their names and date, then
 * every chapter — its name, and each moment's date, words and place.
 *
 * MEASURED, LIKE EVERY PRINT. A short story sits in one column; a longer one in
 * two balanced columns; the type comes down toward `PRINT_MIN_BODY_PT` before a
 * story continues on a second sheet — no moment is shortened or dropped, and
 * nothing passes the safe line (`every-print-fits.test.ts`). The Event Hub QR
 * rides its corner, as on every card.
 *
 * With no story the poster is NEVER printed (the route refuses it and leaves it
 * out of the set); the Maker's picture of it says where the story comes from.
 */
function layoutStoryPoster(ctx: Ctx): PrintDoc[] {
  const { look, data } = ctx;
  const front = sheet('story-poster', ctx);
  const { w, h, bleed } = front;
  const placed = still(front.ops, look, data, w, h, bleed, 0.3);
  const left = placed.left;
  const cx = left + (w - left) / 2;
  const inner = w - left - 140;
  const ops = front.ops;
  let y = placed.top > 0 ? placed.top + 6 : 150;
  medallion(ops, look, data, cx, y, 40, placed.top > 0);
  y += 82;
  eyebrow(ops, look, 'Our story', cx, y, 14);
  y += 58;
  y = lockup(ops, look, data, cx, y, 46, ctx.foil, inner);
  y += 22;
  rule(ops, cx, y, 90, look.accent);
  y += 30;
  if (data.dateLabel) {
    text(ops, data.dateLabel, cx, y, { font: look.bodyFont, size: 13, color: look.ink, align: 'center', caps: true, tracking: 0.14, maxWidth: inner });
    y += 20;
  }
  const bodyTop = y + 34;

  const chapters = (data.story ?? []).filter((c) => c.moments.length > 0);
  if (!storyHasMoments(chapters)) {
    let py = bodyTop + 40;
    for (const line of wrap('Your Love Story prints here — every chapter, with each moment’s date, words and place. Add it in the Maker’s Love Story.', look.bodyFont, 14, Math.min(520, inner))) {
      text(ops, line, cx, py, { font: look.bodyFont, size: 14, color: look.muted, align: 'center' });
      py += 20;
    }
    if (data.hasEventQr) cornerQr(front);
    safeGuide(front, ctx);
    return [front];
  }

  // Rows of one column, centred on `ccx` — flowed at 0 (a row's height does
  // not depend on where it stands), drawn at their column's centre.
  const build = (f: number, colW: number, ccx = 0): FlowRow[] => {
    const rows: FlowRow[] = [];
    const head = Math.max(PRINT_MIN_BODY_PT, 11 * f);
    const when = Math.max(PRINT_MIN_BODY_PT, 9.5 * f);
    const body = 13 * f;
    const where = Math.max(PRINT_MIN_BODY_PT, 10.5 * f);
    chapters.forEach((c, ci) => {
      rows.push(headRow(look, c.label, ccx, colW, (ci === 0 ? 10 : 34) * f, 6 * f, head));
      c.moments.forEach((m, mi) => {
        const gap = (mi === 0 ? 8 : 20) * f;
        if (m.when) {
          rows.push({
            adv: gap + when,
            after: 0,
            top: when * ASC_EM,
            below: when * DESC_EM,
            x0: ccx - colW / 2,
            x1: ccx + colW / 2,
            keepWithNext: true,
            draw: (o, yy) => {
              text(o, m.when, ccx, yy, { font: look.bodyFont, size: when, color: look.accent, align: 'center', caps: true, tracking: 0.2, maxWidth: colW });
            },
          });
        }
        if (m.line) {
          const lines = paraRows(look, m.line, body, look.ink, ccx, colW, body * 1.45, m.when ? 3 * f : gap);
          // A place never starts a column on its own — it moves with the words it belongs to.
          if (m.place && lines.length) lines[lines.length - 1] = { ...lines[lines.length - 1]!, keepWithNext: true };
          rows.push(...lines);
        }
        if (m.place) rows.push(...paraRows(look, m.place, where, look.muted, ccx, colW, where * 1.5, m.line ? 2 * f : m.when ? 3 * f : gap));
      });
    });
    return rows;
  };

  const pad = SAFE_PT + 42;
  const avail = w - left - 2 * pad;
  const gutter = 44;
  const floor = (s: number) => h - SAFE_PT - (s === 0 ? 34 : 24);
  // Where a further sheet's words start — asked once (it draws the head to find out).
  const backTop = continuedHead(sheet('story-poster', ctx), ctx, 'Our Story') + 10;
  const top = (s: number) => (s === 0 ? bodyTop : backTop);
  const fMin = PRINT_MIN_BODY_PT / 9.5;

  // One narrow column while the story is short and the type stays large; then
  // two (where the sheet is wide enough — beside a left-hand still it is not);
  // then, at the smallest type, as many sheets as the story needs.
  type Plan = { cols: number; colW: number; f: number; flow: ReturnType<typeof flowColumns> };
  const twoCols = avail >= 600;
  const tries: Array<{ cols: number; colW: number; fLow: number }> = [
    { cols: 1, colW: Math.min(560, avail), fLow: twoCols ? 0.84 : fMin },
    ...(twoCols ? [{ cols: 2, colW: (avail - gutter) / 2, fLow: fMin }] : []),
  ];
  // The largest type (to 1 %) at which the story takes `sheets` sheets or
  // fewer — found by halving, not by stepping: a long story is re-wrapped at
  // every size tried, and stepping 2 % at a time tried twenty sizes per column.
  const largest = (t: (typeof tries)[number], sheets: number): Plan | null => {
    const at = (f: number) => ({ cols: t.cols, colW: t.colW, f, flow: flowColumns(build(f, t.colW), t.cols, top, floor) });
    const ok = (p: Plan) => p.flow.fits && p.flow.sheets <= sheets;
    const hiPlan = at(1);
    if (ok(hiPlan)) return hiPlan;
    let lo = at(t.fLow);
    if (!ok(lo)) return null;
    let hi = 1;
    while (hi - lo.f > 0.01) {
      const mid = at(Math.round(((lo.f + hi) / 2) * 1000) / 1000);
      if (ok(mid)) lo = mid;
      else hi = mid.f;
    }
    return lo;
  };
  let plan: Plan | null = null;
  for (const t of tries) {
    plan = largest(t, 1);
    if (plan) break;
  }
  if (!plan) {
    // Too long for one sheet even at the smallest type: the fewest sheets it
    // takes there, at the largest type that still takes no more.
    const t = tries[tries.length - 1]!;
    const floorFlow = flowColumns(build(fMin, t.colW), t.cols, top, floor);
    plan = largest(t, floorFlow.sheets) ?? { cols: t.cols, colW: t.colW, f: fMin, flow: floorFlow };
  }
  // Two columns on one sheet end TOGETHER: the lowest column floor that still fits.
  if (plan.cols === 2 && plan.flow.sheets === 1) {
    const rows = build(plan.f, plan.colW);
    let lo = bodyTop;
    let hi = floor(0);
    for (let k = 0; k < 14; k += 1) {
      const mid = (lo + hi) / 2;
      const flow = flowColumns(rows, 2, top, floor, mid);
      if (flow.fits && flow.sheets === 1) hi = mid;
      else lo = mid;
    }
    plan = { ...plan, flow: flowColumns(rows, 2, top, floor, hi) };
  }

  const centres =
    plan.cols === 1 ? [cx] : [left + pad + plan.colW / 2, left + pad + plan.colW + gutter + plan.colW / 2];
  const rows = build(plan.f, plan.colW);
  const colRows = centres.map((c) => build(plan!.f, plan!.colW, c));
  // A further sheet carries no left-hand still, so one column sits in ITS middle.
  const backRows = plan.cols === 1 && left > 0 ? [build(plan.f, plan.colW, w / 2)] : colRows;
  // A short story in one column sits in the middle of the room it has, not under the header.
  const lift = plan.cols === 1 && plan.flow.sheets === 1 ? Math.min(120, Math.max(0, (floor(0) - plan.flow.bottom) / 2)) : 0;
  const docs: PrintDoc[] = [front];
  for (let s = 1; s < plan.flow.sheets; s += 1) {
    const doc = sheet('story-poster', ctx);
    if (look.still === 'full' && data.hasStill) still(doc.ops, look, data, doc.w, doc.h, doc.bleed);
    continuedHead(doc, ctx, 'Our Story');
    docs.push(doc);
  }
  for (const p of plan.flow.placed) (p.sheet === 0 ? colRows : backRows)[p.col]![p.i]!.draw(docs[p.sheet]!.ops, p.y + (p.sheet === 0 ? lift : 0));
  // Two columns: a hairline down the gutter, from the first line to the longer column's foot.
  if (plan.cols === 2) {
    docs.forEach((doc, s) => {
      const mine = plan!.flow.placed.filter((p) => p.sheet === s);
      if (!mine.some((p) => p.col === 1)) return;
      const y0 = Math.min(...mine.map((p) => p.y - rows[p.i]!.top));
      const y1 = Math.max(...mine.map((p) => p.y + rows[p.i]!.below));
      doc.ops.push({ t: 'rect', x: left + pad + plan!.colW + gutter / 2 - 0.25, y: y0, w: 0.5, h: y1 - y0, fill: look.accent, opacity: 0.45 });
    });
  }
  if (data.hasEventQr) cornerQr(front);
  for (const doc of docs) safeGuide(doc, ctx);
  return docs;
}

/**
 * THE PASS, in any of its formats (`PRINT_FORMATS`): a calling card, a CR80 ID
 * card, a train ticket (landscape, tear line) or a boarding pass (a stub, and
 * TABLE · SEAT · TIME where a gate and a seat would be). One composition, sized
 * from the sheet's own height — so a format is laid out, never stretched.
 */
function layoutPass(ctx: Ctx, pass: PrintPass, fmt: PrintFormat = PRINT_FORMATS['calling-card']): PrintDoc {
  const { look, data } = ctx;
  const doc = sheet('pass', ctx, { w: fmt.wMm * PT_PER_MM, h: fmt.hMm * PT_PER_MM });
  const { w, h, bleed, ops } = doc;
  const k = h / 153; // the composition was drawn at 153 pt tall (CR80)
  const style = fmt.style ?? 'card';
  const stubW = style === 'boarding' ? w * 0.3 : style === 'train' ? w * 0.28 : Math.min(w * 0.36, 84 * k);
  const mainW = w - stubW;
  if (data.hasStill && look.still !== 'none') {
    ops.push({ t: 'image', ref: 'still', x: -bleed, y: -bleed, w: mainW + bleed, h: h + 2 * bleed });
    const veil = look.scrim ?? { color: look.paper, opacity: 0.8 };
    ops.push({ t: 'rect', x: -bleed, y: -bleed, w: mainW + bleed, h: h + 2 * bleed, fill: veil.color, opacity: Math.max(veil.opacity, 0.72) });
  }
  // Never inside the 5 mm safe line — the composition's 14 pt pad sat 0.2 pt
  // outside it, and a glyph's overhang further (every-print-fits.test.ts).
  const pad = Math.max(14 * k, SAFE_PT + 2);
  const nfcOn = data.details.nfc === true && nfcFits(mainW, h);
  const nfcRoom = nfcOn ? NFC_SPOT_CLEAR_R * 2 : 0;
  /**
   * The date / time / venue lines — WRAPPED, not squeezed: a long church name
   * used to be shrunk to fit one line, down to 3.5 pt. Lines beside the NFC
   * spot are narrower than the lines above it. The type comes down toward
   * `PRINT_MIN_BODY_PT` only if the lines would pass the safe line.
   */
  const passMeta = (meta: string[], y0: number) => {
    const spotTop = nfcOn ? h - SAFE_PT - 2 * NFC_SPOT_R - NFC_STICKER_MARGIN_MM * PT_PER_MM : Infinity;
    const floor = h - SAFE_PT;
    const plan = (size: number) => {
      const lead = size * 1.31;
      const out: Array<{ s: string; y: number; width: number }> = [];
      let yy = y0;
      for (const m of meta) {
        const words = printableText(m).split(/\s+/).filter(Boolean);
        let line = '';
        const widthAt = (base: number) => (base + size * DESC_EM < spotTop - 2 ? mainW - pad * 2 : mainW - pad * 2 - nfcRoom);
        for (const wd of words) {
          const next = line ? `${line} ${wd}` : wd;
          if (line && measure(next, look.bodyFont, size) > widthAt(yy)) {
            out.push({ s: line, y: yy, width: widthAt(yy) });
            yy += lead;
            line = wd;
          } else line = next;
        }
        if (line) {
          out.push({ s: line, y: yy, width: widthAt(yy) });
          yy += lead;
        }
      }
      return out;
    };
    const top = 6.4 * k;
    let lines = plan(top);
    for (let size = top; size >= PRINT_MIN_BODY_PT - 1e-9; size = Math.round((size - 0.2) * 10) / 10) {
      lines = plan(size);
      if (lines.every((l) => l.y + size * DESC_EM <= floor)) {
        for (const l of lines) text(ops, l.s, pad, l.y, { font: look.bodyFont, size, color: look.muted, align: 'left', maxWidth: l.width });
        return;
      }
    }
    // Nothing fits even at the floor: set the lines as they are and let the
    // width-fit shrink them — the fit test names the card that needs it.
    for (const l of lines) text(ops, l.s, pad, Math.min(l.y, floor - 2), { font: look.bodyFont, size: PRINT_MIN_BODY_PT, color: look.muted, align: 'left', maxWidth: l.width });
  };
  const kind = style === 'boarding' ? 'Boarding pass' : style === 'train' ? 'Admit one' : 'Event pass';
  eyebrow(ops, look, kind, pad, pad + 6 * k, 5.8 * k, 'left');
  if (pass.serial) text(ops, pass.serial, mainW - 10 * k, pad + 6 * k, { font: 'poppins', size: 5.4 * k, color: look.muted, align: 'right' });
  let y = pad + 32 * k;
  y = lockup(ops, look, data, pad, y, 15 * k, ctx.foil, mainW - pad * 2 - nfcRoom, 'left');
  y += 10 * k;
  if (style === 'boarding') {
    // Gate · Seat · Boarding → Table · Seat · Time, each a small labelled field.
    const fields: Array<[string, string | null]> = [
      ['Table', pass.seat ? pass.seat.replace(/^Table\s+/i, '') : null],
      ['Seat', pass.seatNumber ?? null],
      ['Time', data.ceremonyTime],
    ];
    const colW = (mainW - pad * 2) / 3;
    fields.forEach(([label, value], i) => {
      const fx = pad + i * colW;
      eyebrow(ops, look, label, fx, y, 5 * k, 'left');
      text(ops, value ?? '—', fx, y + 12 * k, { font: look.headFont, size: 11 * k, color: look.heading, align: 'left', maxWidth: colW - 4 });
    });
    y += 26 * k;
    passMeta([data.dateLabel, data.ceremonyVenue].filter(Boolean) as string[], y);
  } else {
    passMeta([data.dateLabel, data.ceremonyTime ? `Ceremony ${data.ceremonyTime}` : null, data.ceremonyVenue].filter(Boolean) as string[], y);
  }
  // An NFC sticker spot, 25 mm true to size, in the main area's corner (on a
  // calling card that is the only place a 25 mm sticker fits).
  // Its ring sits on the safe line, never past it.
  if (nfcOn) nfcSpot(ops, look, mainW - NFC_SPOT_CLEAR_R, h - SAFE_PT - NFC_SPOT_R);
  // the stub, and its tear line
  ops.push({ t: 'rect', x: mainW, y: -bleed, w: stubW + bleed, h: h + 2 * bleed, fill: look.paper });
  const dash = style === 'train' ? 3 : 5;
  for (let py = SAFE_PT; py + (dash / 2) * k <= h - SAFE_PT; py += dash * k) ops.push({ t: 'rect', x: mainW - 0.3, y: py, w: 0.6, h: (dash / 2) * k, fill: look.ink, opacity: 0.45 });
  // The stub's words and QR are centred in what is SAFE of it: from the tear
  // line to 5 mm inside the card's right edge.
  const stubRight = w - SAFE_PT;
  const stubInner = stubRight - mainW - 8;
  const sx = (mainW + stubRight) / 2;
  eyebrow(ops, look, style === 'boarding' ? 'Passenger' : 'Admit', sx, Math.max(18 * k, SAFE_PT + 6), 5.4 * k);
  // The Guest list toggle: a couple may print passes without names (hand-written, or for walk-ins).
  if (data.details.guestNames !== false) text(ops, pass.name, sx, 34 * k, { font: look.headFont, size: 10.5 * k, color: look.heading, align: 'center', maxWidth: stubInner });
  if (pass.seat && style !== 'boarding') text(ops, pass.seat, sx, 45 * k, { font: look.bodyFont, size: 6.4 * k, color: look.accent, align: 'center', caps: true, tracking: 0.18, maxWidth: stubInner });
  const q = Math.min(50 * k, stubInner - 6 * k);
  const footY = h - SAFE_PT - 1.5; // "Scan at the door", on the safe line
  const qy = footY - 8 * k - q - 3 * k;
  if (pass.qrRef) {
    ops.push({ t: 'rect', x: sx - q / 2 - 3 * k, y: qy - 3 * k, w: q + 6 * k, h: q + 6 * k, fill: '#ffffff' });
    ops.push({ t: 'image', ref: pass.qrRef, x: sx - q / 2, y: qy, w: q, h: q });
  }
  eyebrow(ops, look, 'Scan at the door', sx, footY, 4.8 * k);
  return doc;
}

function layoutPoster(ctx: Ctx): PrintDoc {
  const { look, data } = ctx;
  const doc = sheet('poster', ctx);
  const { w, h, bleed, ops } = doc;
  // A band of 40 % leaves the QR panel its reserved room at the foot (the QR
  // is always printed — it must never be pushed off the sheet).
  const placed = still(ops, look, data, w, h, bleed, 0.4);
  const left = placed.left;
  const cx = left + (w - left) / 2;
  const inner = w - left - 120;
  let y = placed.top > 0 ? placed.top + 10 : 190;
  medallion(ops, look, data, cx, y, 52, placed.top > 0);
  y += 96;
  eyebrow(ops, look, `Welcome to ${data.eyebrow.replace(/^The /, 'the ')}`, cx, y, 15);
  y += 72;
  y = lockup(ops, look, data, cx, y, 66, ctx.foil, inner);
  y += 26;
  rule(ops, cx, y, 110, look.accent);
  y += 34;
  if (data.dateLabel) {
    text(ops, data.dateLabel, cx, y, { font: look.bodyFont, size: 19, color: look.ink, align: 'center', caps: true, tracking: 0.12, maxWidth: inner });
    y += 28;
  }
  if (data.ceremonyVenue) {
    text(ops, data.ceremonyVenue, cx, y, { font: look.bodyFont, size: 17, color: look.muted, align: 'center', maxWidth: inner });
    y += 26;
  }
  {
    // The QR is always printed; an NFC spot rides beside the panel when added.
    // Panel + spot are centred TOGETHER in what the still leaves of the sheet
    // — beside a left-hand still (Modern) a 440 pt panel plus the spot ran off
    // the poster's right edge (every-print-fits.test.ts).
    const nfcW = data.details.nfc ? NFC_SPOT_CLEAR_R * 2 + 12 : 0;
    const avail = w - left - 2 * (SAFE_PT + 24);
    const panelW = Math.min(440, avail - nfcW);
    const q = Math.min(150, Math.round(panelW * 0.4));
    const gx = cx - (panelW + nfcW) / 2 + panelW / 2; // the panel's centre, with the spot to its right
    // Reserved at the foot, always inside the sheet.
    const py = Math.min(Math.max(y + 24, h - q - 110), h - q - 36 - SAFE_MM * PT_PER_MM - 20);
    ops.push({ t: 'rect', x: gx - panelW / 2, y: py, w: panelW, h: q + 36, fill: look.paper, stroke: look.accent, sw: 1 });
    ops.push({ t: 'rect', x: gx - panelW / 2 + 16, y: py + 16, w: q + 4, h: q + 4, fill: '#ffffff' });
    ops.push({ t: 'image', ref: 'eventqr', x: gx - panelW / 2 + 18, y: py + 18, w: q, h: q });
    const tx = gx - panelW / 2 + q + 42;
    text(ops, 'Scan for our', tx, py + 70, { font: look.bodyFont, size: 16, color: look.ink, align: 'left', caps: true, tracking: 0.14, maxWidth: panelW - q - 60 });
    text(ops, 'Event Hub', tx, py + 94, { font: look.bodyFont, size: 16, color: look.ink, align: 'left', caps: true, tracking: 0.14, maxWidth: panelW - q - 60 });
    text(ops, 'Photos · your table · the schedule', tx, py + 118, { font: look.bodyFont, size: 11, color: look.muted, align: 'left', maxWidth: panelW - q - 60 });
    if (data.hubAddress) text(ops, data.hubAddress, tx, py + 136, { font: look.bodyFont, size: 10, color: look.muted, align: 'left', maxWidth: panelW - q - 60 });
    if (data.details.nfc) nfcSpot(ops, look, gx + panelW / 2 + 12 + NFC_SPOT_CLEAR_R, py + (q + 36) / 2);
  }
  safeGuide(doc, ctx);
  return doc;
}

function layoutCard(ctx: Ctx): PrintDoc {
  const { look, data } = ctx;
  const doc = sheet('card', ctx);
  const { w, h, bleed, ops } = doc;
  const placed = still(ops, look, data, w, h, bleed, 0.5);
  const cx = placed.left + (w - placed.left) / 2;
  const inner = w - placed.left - 40;
  let y = placed.top > 0 ? placed.top : h * 0.3;
  medallion(ops, look, data, cx, y, 28, placed.top > 0);
  y += 52;
  eyebrow(ops, look, data.eyebrow, cx, y, 7.4);
  y += 36;
  y = lockup(ops, look, data, cx, y, 28, ctx.foil, inner);
  y += 16;
  rule(ops, cx, y, 34, look.accent);
  y += 18;
  if (data.dateLabel) {
    text(ops, data.dateLabel, cx, y, { font: look.bodyFont, size: 8.2, color: look.ink, align: 'center', caps: true, tracking: 0.12, maxWidth: inner });
    y += 12;
  }
  if (data.ceremonyVenue) text(ops, data.ceremonyVenue, cx, y, { font: look.bodyFont, size: 8.2, color: look.muted, align: 'center', maxWidth: inner });
  if (data.hasEventQr) cornerQr(doc);
  safeGuide(doc, ctx);
  return doc;
}

/** The event card on a LANDSCAPE index card: the still on the left, the words on the right. */
function layoutCardLandscape(ctx: Ctx, fmt: PrintFormat): PrintDoc {
  const { look, data } = ctx;
  const doc = sheet('card', ctx, { w: fmt.wMm * PT_PER_MM, h: fmt.hMm * PT_PER_MM });
  const { w, h, bleed, ops } = doc;
  const k = h / 216; // drawn at a 5 × 3 in index card
  let left = 0;
  if (data.hasStill && look.still !== 'none') {
    left = w * 0.42;
    ops.push({ t: 'image', ref: 'still', x: -bleed, y: -bleed, w: left + bleed, h: h + 2 * bleed });
    if (look.still === 'full' && look.scrim) ops.push({ t: 'rect', x: -bleed, y: -bleed, w: left + bleed, h: h + 2 * bleed, fill: look.scrim.color, opacity: look.scrim.opacity * 0.5 });
    ops.push({ t: 'rect', x: left, y: -bleed, w: 0.8, h: h + 2 * bleed, fill: look.accent });
  }
  const cx = left + (w - left) / 2;
  const inner = w - left - 28 * k;
  let y = 40 * k;
  // Lower when this die's edge (a scallop's cusps) needs the crest to clear the safe line.
  for (let n = 0; n < 60 && !safeContainsBox(doc.die, w, h, { x: cx - 18 * k * 1.2, y: y - 18 * k, w: 36 * k * 1.2, h: 36 * k }); n += 1) y += 1;
  medallion(ops, look, data, cx, y, 18 * k, false);
  y += 36 * k;
  eyebrow(ops, look, data.eyebrow, cx, y, 6.4 * k);
  y += 26 * k;
  y = lockup(ops, look, data, cx, y, 21 * k, ctx.foil, inner);
  y += 12 * k;
  rule(ops, cx, y, 26 * k, look.accent);
  y += 14 * k;
  if (data.dateLabel) {
    text(ops, data.dateLabel, cx, y, { font: look.bodyFont, size: 7 * k, color: look.ink, align: 'center', caps: true, tracking: 0.1, maxWidth: inner });
    y += 10 * k;
  }
  if (data.ceremonyVenue) text(ops, data.ceremonyVenue, cx, y, { font: look.bodyFont, size: 7 * k, color: look.muted, align: 'center', maxWidth: inner });
  if (data.hasEventQr) cornerQr(doc);
  safeGuide(doc, ctx);
  return doc;
}

/**
 * Fit a card laid out at its design size onto another sheet — ONE uniform
 * scale (no stretching), centred across, anchored at the top so the still still
 * reaches the top bleed; the paper is repainted to the full new sheet and the
 * die line is recut for it.
 */
function fitDoc(doc: PrintDoc, w: number, h: number, ctx: Ctx): PrintDoc {
  if (Math.abs(doc.w - w) < 0.01 && Math.abs(doc.h - h) < 0.01) return doc;
  const s = Math.min(w / doc.w, h / doc.h);
  const ox = (w - doc.w * s) / 2;
  const oy = 0;
  const ops: PrintOp[] = [{ t: 'rect', x: -doc.bleed, y: -doc.bleed, w: w + 2 * doc.bleed, h: h + 2 * doc.bleed, fill: ctx.look.paper }];
  for (const o of doc.ops.slice(1)) {
    if (o.t === 'rect') ops.push({ ...o, x: o.x * s + ox, y: o.y * s + oy, w: o.w * s, h: o.h * s, sw: o.sw ? o.sw * s : o.sw });
    else if (o.t === 'image') ops.push({ ...o, x: o.x * s + ox, y: o.y * s + oy, w: o.w * s, h: o.h * s });
    // An NFC spot stays TRUE TO SIZE (25 mm) — a sticker does not scale with the card.
    else if (o.t === 'circle') ops.push({ ...o, cx: o.cx * s + ox, cy: o.cy * s + oy, r: o.nfc ? o.r : o.r * s, sw: o.sw ? o.sw * s : o.sw });
    else ops.push({ ...o, d: scalePath(o.d, s, ox, oy), sw: o.sw ? o.sw * s : o.sw });
  }
  return { ...doc, w, h, diePath: diePathFor(doc.die, w, h), ops };
}

/** The free do-it-yourself sheet: every guest's QR with their name, A4, 3 × 4. */
function layoutQrSheet(title: string, cells: Array<{ name: string; sub: string | null; qrRef: string }>): PrintDoc[] {
  const spec = PRINT_PIECES['qr-codes'];
  const perPage = 12;
  const pages: PrintDoc[] = [];
  const margin = 12 * PT_PER_MM;
  const cols = 3;
  const rows = 4;
  const cw = (spec.widthPt - margin * 2) / cols;
  const ch = (spec.heightPt - margin * 2 - 16) / rows;
  for (let p = 0; p * perPage < Math.max(cells.length, 1); p += 1) {
    const doc: PrintDoc = { piece: 'qr-codes', w: spec.widthPt, h: spec.heightPt, bleed: 0, die: 'rect', diePath: diePathFor('rect', spec.widthPt, spec.heightPt), ops: [] };
    doc.ops.push({ t: 'rect', x: 0, y: 0, w: doc.w, h: doc.h, fill: '#ffffff' });
    text(doc.ops, `${title} · page ${p + 1}`, margin, margin - 2, { font: 'poppins', size: 7, color: '#6b6b6b', align: 'left' });
    cells.slice(p * perPage, (p + 1) * perPage).forEach((c, i) => {
      const x = margin + (i % cols) * cw;
      const y = margin + 8 + Math.floor(i / cols) * ch;
      doc.ops.push({ t: 'rect', x: x + 4, y: y + 4, w: cw - 8, h: ch - 8, stroke: '#1a1a1a', sw: 0.4, opacity: 0.3, dash: true });
      const q = Math.min(cw - 40, ch - 60);
      doc.ops.push({ t: 'image', ref: c.qrRef, x: x + (cw - q) / 2, y: y + 14, w: q, h: q });
      text(doc.ops, c.name, x + cw / 2, y + 14 + q + 18, { font: 'poppinsMedium', size: 10, color: '#1a1a1a', align: 'center', maxWidth: cw - 20 });
      if (c.sub) text(doc.ops, c.sub, x + cw / 2, y + 14 + q + 30, { font: 'poppins', size: 7.4, color: '#6b6b6b', align: 'center', maxWidth: cw - 20 });
    });
    pages.push(doc);
  }
  return pages;
}

// ─── Entry points ───────────────────────────────────────────────────────────

/**
 * WHITE INK — on dark or kraft stock, light type needs a white underprint or it
 * sinks into the paper. Every inked outline (type, the mark, the rule's
 * diamond) gets an identical white copy UNDER it, on the "White ink" layer.
 * Print-ready only; a sample carries no spot layers (owner 2026-09-25).
 */
function underprintWhite(doc: PrintDoc): PrintDoc {
  const ops: PrintOp[] = [];
  for (const o of doc.ops) {
    if (o.t === 'path' && o.fill && !o.layer) ops.push({ ...o, fill: '#ffffff', layer: 'white', opacity: undefined });
    ops.push(o);
  }
  return { ...doc, ops };
}

type LayoutInput = {
  look: PrintLook;
  data: PrintSetData;
  mode: PrintMode;
  foil: boolean;
  whiteInk?: boolean;
  /** A `PRINT_FORMATS` id; a piece that cannot wear it gets its default. */
  format?: string | null;
};

/**
 * EVERY SIDE OF A PIECE — the front, and a back when the words need one (the
 * Entourage of a large wedding, `layoutEntourage`). The print-ready PDF prints
 * every side, one per page; nothing that draws a piece for a couple may keep
 * only the first (`every-print-fits.test.ts` holds the route to this).
 */
export function layoutPieceDocs(piece: PrintSetKey, input: LayoutInput & { pass?: PrintPass }): PrintDoc[] {
  const ctx: Ctx = { look: input.look, data: input.data, mode: input.mode, foil: input.foil };
  const fmt = formatFor(piece, input.format);
  const w = (fmt?.wMm ?? 0) * PT_PER_MM;
  const h = (fmt?.hMm ?? 0) * PT_PER_MM;
  const docs = ((): PrintDoc[] => {
    switch (piece) {
      case 'invitation':
        return [fitDoc(layoutInvitation(ctx), w, h, ctx)];
      case 'entourage':
        return layoutEntourage(ctx).map((d) => fitDoc(d, w, h, ctx));
      case 'details':
        return layoutDetails(ctx).map((d) => fitDoc(d, w, h, ctx));
      case 'menu':
        return layoutMenu(ctx).map((d) => fitDoc(d, w, h, ctx));
      case 'pass':
        return [
          layoutPass(
            ctx,
            input.pass ?? { name: 'Your guest’s name', seat: 'Table 1', seatNumber: '3', qrRef: 'eventqr', serial: 'Nº 0001' },
            fmt ?? PRINT_FORMATS['calling-card'],
          ),
        ];
      case 'poster':
        return [layoutPoster(ctx)];
      case 'story-poster':
        return layoutStoryPoster(ctx);
      case 'card':
        return [fmt && fmt.wMm > fmt.hMm ? layoutCardLandscape(ctx, fmt) : fitDoc(layoutCard(ctx), w, h, ctx)];
    }
  })();
  return input.mode === 'print' && input.whiteInk ? docs.map(underprintWhite) : docs;
}

/** The FRONT of a piece. A caller that prints or shows a piece uses `layoutPieceDocs` / `layoutPieceView`. */
export function layoutPiece(piece: PrintSetKey, input: LayoutInput & { pass?: PrintPass }): PrintDoc {
  return layoutPieceDocs(piece, input)[0]!;
}

/**
 * A piece as the Maker SHOWS it: one sheet, or — when it has a back — both
 * sides side by side, labelled "Front" and "Back", in one picture (the sample
 * JPEG and the on-screen SVG are single images).
 */
export function spreadDocs(docs: PrintDoc[]): PrintDoc {
  if (docs.length <= 1) return docs[0]!;
  const gap = 18;
  const labelH = 18;
  const H = Math.max(...docs.map((d) => d.h));
  const W = docs.reduce((a, d) => a + d.w, 0) + gap * (docs.length - 1);
  const ops: PrintOp[] = [];
  const dies: string[] = [];
  const fields: PrintFieldBox[] = [];
  let ox = 0;
  docs.forEach((d, i) => {
    for (const b of d.fields ?? []) fields.push({ ...b, x: b.x + ox });
    for (const o of d.ops) {
      if (o.t === 'rect' || o.t === 'image') ops.push({ ...o, x: o.x + ox });
      else if (o.t === 'circle') ops.push({ ...o, cx: o.cx + ox });
      else ops.push({ ...o, d: scalePath(o.d, 1, ox, 0) });
    }
    dies.push(scalePath(d.diePath, 1, ox, 0));
    text(ops, i === 0 ? 'Front' : i === 1 ? 'Back' : `Side ${i + 1}`, ox + d.w / 2, H + 13, { font: 'poppinsMedium', size: 9, color: '#6b6b6b', align: 'center', caps: true, tracking: 0.18 });
    ox += d.w + gap;
  });
  dies.push(`M0 ${f2(H)}H${f2(W)}V${f2(H + labelH)}H0Z`);
  return { ...docs[0]!, w: W, h: H + labelH, diePath: dies.join(' '), ops, ...(fields.length ? { fields } : {}) };
}

/** What the Maker draws for a piece: the front alone, or "Front · Back". */
export function layoutPieceView(piece: PrintSetKey, input: LayoutInput & { pass?: PrintPass }): PrintDoc {
  return spreadDocs(layoutPieceDocs(piece, input));
}

export function layoutPasses(input: LayoutInput, passes: PrintPass[]): PrintDoc[] {
  return passes.map((pass) => {
    const doc = layoutPass({ look: input.look, data: input.data, mode: input.mode, foil: input.foil }, pass, formatFor('pass', input.format)!);
    return input.mode === 'print' && input.whiteInk ? underprintWhite(doc) : doc;
  });
}

export function layoutQrCodes(title: string, cells: Array<{ name: string; sub: string | null; qrRef: string }>): PrintDoc[] {
  return layoutQrSheet(title, cells);
}

/** How many ops of a layer a doc carries — for the tests and the route's log. */
export function opsOnLayer(doc: PrintDoc, layer: PrintLayer): number {
  return doc.ops.filter((o) => 'layer' in o && o.layer === layer).length;
}

// ─── The free sample's watermark ────────────────────────────────────────────

/** Rotate absolute SVG path data (M · L · Q · C · Z — what `pathData` emits) about (cx, cy). */
export function rotatePath(d: string, deg: number, cx: number, cy: number): string {
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return d.replace(/([MLQC])([^MLQCZ]*)/g, (_m, cmd: string, args: string) => {
    const n = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    const out: string[] = [];
    for (let i = 0; i + 1 < n.length; i += 2) {
      const x = n[i]! - cx;
      const y = n[i + 1]! - cy;
      out.push(`${f2(cx + x * cos - y * sin)} ${f2(cy + x * sin + y * cos)}`);
    }
    return cmd + out.join(' ');
  });
}

/**
 * THE "SAMPLE · SETNAYAN" WATERMARK — owner 2026-09-25: *"make sure sample has
 * a watermark as sample so they cannot simply edit and remove watermark
 * easily"*.
 *
 * A tiled, diagonal, repeating line across the WHOLE sheet — over the names,
 * the date and the QR, never a corner mark that can be cropped or cloned out —
 * at an opacity that varies row to row (12–22 %), drawn ON TOP of the design so
 * removing it damages the design. Type is outlines from a bundled face, so the
 * raster it is burned into (`lib/print-sample-raster.ts`) never depends on a
 * host font. Mid-grey reads on light paper and on the dark themes alike.
 */
export const WATERMARK_PHRASE = 'SAMPLE · SETNAYAN · ';

export function watermarkOps(w: number, h: number): PrintOp[] {
  const size = Math.max(7, Math.min(w, h) / 13);
  const tracking = 0.12;
  const unit = measure(WATERMARK_PHRASE, 'poppinsBold', size, tracking * size);
  const diag = Math.hypot(w, h);
  const reps = Math.ceil((diag * 1.6) / Math.max(unit, 1)) + 1;
  const line = WATERMARK_PHRASE.repeat(reps);
  const cx = w / 2;
  const cy = h / 2;
  const step = size * 2.4;
  const ops: PrintOp[] = [];
  let row = 0;
  for (let y = cy - diag * 0.75; y < cy + diag * 0.75; y += step, row += 1) {
    const tmp: PrintOp[] = [];
    const shift = (row % 3) * (unit / 3);
    text(tmp, line, cx - diag * 0.8 - shift, y, { font: 'poppinsBold', size, color: '#7a7a7a', align: 'left', tracking });
    const opacity = 0.12 + ((row * 37) % 11) / 100; // 0.12 … 0.22, varying row to row
    for (const o of tmp) if (o.t === 'path') ops.push({ t: 'path', d: rotatePath(o.d, -30, cx, cy), fill: '#7a7a7a', opacity });
  }
  return ops;
}

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
import { roleLabel, type EntourageGroup } from '@/lib/entourage';
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
  parentLine,
  printableText,
  type DieCut,
  type PrintDetails,
  type PrintFontKey,
  type PrintFormat,
  type PrintLook,
  type PrintMode,
  type PrintPieceKey,
  type PrintSetKey,
} from '@/lib/print-pieces';

// ─── The drawing vocabulary ─────────────────────────────────────────────────

/** Spot layers of the print-ready file (named for the print shop). */
export type PrintLayer = 'foil' | 'white' | 'die';

export type PrintOp =
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; sw?: number; opacity?: number; dash?: boolean; layer?: PrintLayer }
  | { t: 'path'; d: string; fill?: string; stroke?: string; sw?: number; opacity?: number; layer?: PrintLayer }
  | { t: 'image'; ref: string; x: number; y: number; w: number; h: number; opacity?: number }
  | { t: 'circle'; cx: number; cy: number; r: number; fill?: string; stroke?: string; sw?: number; opacity?: number; dash?: boolean; nfc?: boolean };

export type PrintDoc = {
  piece: PrintPieceKey;
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

export type PrintMonogram = { viewBox: [number, number, number, number]; paths: string[] };

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

/** Characters → glyph runs, falling back to Cardo, then dropping a character
 *  no bundled face can draw (a `.notdef` box on a wedding invitation is worse
 *  than a missing ornament). */
function runsFor(text: string, key: PrintFontKey, size: number, tracking: number): Run[] {
  const primary = printFont(key);
  const fallback = printFont('cardo');
  const out: Run[] = [];
  for (const ch of [...text]) {
    if (ch === ' ') {
      out.push({ font: primary, ch, adv: primary.getAdvanceWidth(' ', size) + tracking });
      continue;
    }
    const font = hasGlyph(primary, ch) ? primary : hasGlyph(fallback, ch) ? fallback : null;
    if (!font) continue;
    out.push({ font, ch, adv: font.getAdvanceWidth(ch, size) + tracking });
  }
  return out;
}

export function measure(text: string, key: PrintFontKey, size: number, tracking = 0): number {
  const runs = runsFor(text, key, size, tracking);
  const total = runs.reduce((a, r) => a + r.adv, 0);
  return runs.length ? total - tracking : 0;
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

/** The couple's mark inside a circle, or their initials when there is no mark. */
function medallion(ops: PrintOp[], look: PrintLook, data: PrintSetData, cx: number, cy: number, r: number, plate: boolean) {
  if (plate) ops.push({ t: 'circle', cx, cy, r: r + 3, fill: look.paper });
  ops.push({ t: 'circle', cx, cy, r, stroke: look.accent, sw: Math.max(0.6, r / 40) });
  const m = data.monogram;
  if (m && m.paths.length) {
    const [vx, vy, vw, vh] = m.viewBox;
    const box = r * 1.25;
    const scale = box / Math.max(vw, vh);
    const ox = cx - (vw * scale) / 2 - vx * scale;
    const oy = cy - (vh * scale) / 2 - vy * scale;
    ops.push({ t: 'path', d: scalePath(m.paths.join(' '), scale, ox, oy), fill: look.accent });
  } else {
    text(ops, data.initials, cx, cy + r * 0.28, { font: look.headFont, size: r * 0.8, color: look.accent, align: 'center' });
  }
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
  const die = dieCutFor(ctx.look.theme, piece);
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

function layoutInvitation(ctx: Ctx): PrintDoc {
  const { look, data } = ctx;
  const doc = sheet('invitation', ctx);
  const { w, h, bleed, ops } = doc;
  const placed = still(ops, look, data, w, h, bleed);
  const left = placed.left;
  const cx = left + (w - left) / 2;
  const inner = w - left - 52;
  let y: number;
  if (placed.top > 0) {
    medallion(ops, look, data, cx, placed.top, 30, true);
    y = placed.top + 50;
  } else {
    medallion(ops, look, data, cx, 64, 30, false);
    y = 118;
  }
  const d = data.details;
  if (d.openingLine) {
    for (const line of wrap(d.openingLine, look.bodyFont, 8.4, inner)) {
      text(ops, line, cx, y, { font: look.bodyFont, size: 8.4, color: look.muted, align: 'center' });
      y += 11;
    }
    y += 4;
  }
  const groom = d.parents.filter((p) => p.side === 'groom');
  const bride = d.parents.filter((p) => p.side === 'bride');
  if (groom.length || bride.length) {
    const rows = Math.max(groom.length, bride.length);
    const colW = inner / 2 - 6;
    for (let i = 0; i < rows; i += 1) {
      const g = groom[i];
      const b = bride[i];
      if (g) text(ops, parentLine(g), cx - 6, y, { font: look.bodyFont, size: 8, color: look.ink, align: 'right', maxWidth: colW });
      if (b) text(ops, parentLine(b), cx + 6, y, { font: look.bodyFont, size: 8, color: look.ink, align: 'left', maxWidth: colW });
      y += 10.5;
    }
    y += 6;
  }
  eyebrow(ops, look, data.eyebrow, cx, y, 7.2);
  y += 30;
  y = lockup(ops, look, data, cx, y, 27, ctx.foil, inner);
  y += 14;
  rule(ops, cx, y, 40, look.accent);
  y += 16;
  if (data.dateLabel) {
    text(ops, data.dateLabel, cx, y, { font: look.bodyFont, size: 9, color: look.ink, align: 'center', caps: true, tracking: 0.12, maxWidth: inner });
    y += 12;
  }
  if (data.ceremonyTime) {
    text(ops, `Ceremony at ${data.ceremonyTime}`, cx, y, { font: look.bodyFont, size: 8.4, color: look.muted, align: 'center' });
    y += 14;
  }
  if (data.ceremonyVenue) {
    for (const line of wrap(data.ceremonyVenue, look.bodyFont, 9.2, inner).slice(0, 2)) {
      text(ops, line, cx, y, { font: look.bodyFont, size: 9.2, color: look.heading, align: 'center' });
      y += 11.5;
    }
    y += 4;
  }
  if (data.receptionVenue || data.receptionTime) {
    const bits = ['Reception to follow', data.receptionVenue, data.receptionTime].filter(Boolean).join(' · ');
    for (const line of wrap(bits, look.bodyFont, 8.2, inner).slice(0, 2)) {
      text(ops, line, cx, y, { font: look.bodyFont, size: 8.2, color: look.muted, align: 'center' });
      y += 10.5;
    }
  }
  if (data.hasEventQr) cornerQr(ops, w);
  safeGuide(doc, ctx);
  return doc;
}

function cardHead(ctx: Ctx, doc: PrintDoc, small: string, title: string): number {
  const { look, data } = ctx;
  const cx = doc.w / 2;
  medallion(doc.ops, look, data, cx, 44, 17, false);
  eyebrow(doc.ops, look, small, cx, 78, 7);
  text(doc.ops, title, cx, 102, { font: look.headFont, size: 22, color: look.heading, align: 'center', caps: look.capsNames, maxWidth: doc.w - 60, layer: ctx.foil ? 'foil' : undefined });
  rule(doc.ops, cx, 114, 30, look.accent);
  return 132;
}

function sectionHead(ops: PrintOp[], look: PrintLook, s: string, cx: number, y: number, half: number) {
  const width = measure(s.toUpperCase(), look.bodyFont, 7, 0.24 * 7);
  text(ops, s, cx, y, { font: look.bodyFont, size: 7, color: look.accent, align: 'center', caps: true, tracking: 0.24 });
  const gap = width / 2 + 7;
  if (half > gap + 6) {
    ops.push({ t: 'rect', x: cx - half, y: y - 2.6, w: half - gap, h: 0.5, fill: look.accent, opacity: 0.6 });
    ops.push({ t: 'rect', x: cx + gap, y: y - 2.6, w: half - gap, h: 0.5, fill: look.accent, opacity: 0.6 });
  }
}

function layoutEntourage(ctx: Ctx): PrintDoc {
  const { look, data } = ctx;
  const doc = sheet('entourage', ctx);
  const { w, h, ops } = doc;
  if (look.still === 'full' && data.hasStill) still(ops, look, data, w, h, doc.bleed);
  let y = cardHead(ctx, doc, 'The', 'Entourage');
  const cx = w / 2;
  const groups = data.entourage;
  if (!groups.length) {
    for (const line of wrap('Your entourage prints here once roles are set on the Guest list.', look.bodyFont, 8.4, w - 80)) {
      text(ops, line, cx, y + 20, { font: look.bodyFont, size: 8.4, color: look.muted, align: 'center' });
      y += 11;
    }
    if (data.hasEventQr) cornerQr(ops, w);
    safeGuide(doc, ctx);
    return doc;
  }
  // Fit: every name prints. The size comes down before anybody is dropped.
  const rowCount = groups.reduce((a, g) => a + g.rows.length, 0);
  const avail = h - y - 22;
  const perGroup = 22;
  let size = 8.4;
  while (size > 5 && rowCount * size * 1.36 + groups.length * perGroup * (size / 8.4) > avail) size -= 0.2;
  const lead = size * 1.36;
  const gap = perGroup * (size / 8.4);
  const colW = (w - 56) / 2 - 6;
  for (const g of groups) {
    y += gap * 0.78;
    sectionHead(ops, look, g.label, cx, y, (w - 56) / 2);
    y += gap * 0.2;
    for (const [l, r] of g.rows) {
      y += lead;
      if (l && r) {
        text(ops, l.name, cx - 6, y, { font: look.bodyFont, size, color: look.ink, align: 'right', maxWidth: colW });
        text(ops, r.name, cx + 6, y, { font: look.bodyFont, size, color: look.ink, align: 'left', maxWidth: colW });
      } else if (l || r) {
        const p = (l ?? r)!;
        const one = g.rows.every(([a, b]) => !(a && b));
        // A group with no pairs at all reads down the middle; an unpartnered
        // line in a paired group keeps its column (owner 2026-09-14).
        if (one) {
          const label = roleLabel(p.role);
          const withRole = g.key === 'secondary_sponsors' && label ? `${p.name} · ${label}` : p.name;
          text(ops, withRole, cx, y, { font: look.bodyFont, size, color: look.ink, align: 'center', maxWidth: w - 60 });
        } else if (l) text(ops, l.name, cx - 6, y, { font: look.bodyFont, size, color: look.ink, align: 'right', maxWidth: colW });
        else text(ops, p.name, cx + 6, y, { font: look.bodyFont, size, color: look.ink, align: 'left', maxWidth: colW });
      }
    }
  }
  if (data.hasEventQr) cornerQr(ops, w);
  safeGuide(doc, ctx);
  return doc;
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

/**
 * THE QR IS ALWAYS PRINTED — owner 2026-09-25: *"QR is automatic. NFC is
 * optional. we need that QR code since it is universal and works for all"*.
 * Every card carries the Event Hub QR in its reserved top-right corner (inside
 * the safe area, on a white plate so it scans on any paper); the Finer Details
 * card and the poster carry it large, and a pass carries the guest's own code.
 */
export const CORNER_QR_PT = 34;
function cornerQr(ops: PrintOp[], w: number) {
  const inset = SAFE_MM * PT_PER_MM + 4;
  ops.push({ t: 'rect', x: w - inset - CORNER_QR_PT - 3, y: inset - 3, w: CORNER_QR_PT + 6, h: CORNER_QR_PT + 6, fill: '#ffffff' });
  ops.push({ t: 'image', ref: 'eventqr', x: w - inset - CORNER_QR_PT, y: inset, w: CORNER_QR_PT, h: CORNER_QR_PT });
}

function layoutDetails(ctx: Ctx): PrintDoc {
  const { look, data } = ctx;
  const doc = sheet('details', ctx);
  const { w, h, ops } = doc;
  if (look.still === 'full' && data.hasStill) still(ops, look, data, w, h, doc.bleed);
  let y = cardHead(ctx, doc, 'The', 'Finer Details');
  const cx = w / 2;
  const inner = w - 68;
  const para = (s: string, size = 8.2, color = look.ink) => {
    for (const line of wrap(s, look.bodyFont, size, inner)) {
      y += size * 1.4;
      text(ops, line, cx, y, { font: look.bodyFont, size, color, align: 'center' });
    }
  };
  let any = false;
  if (data.attire.length || data.swatches.length) {
    any = true;
    y += 14;
    sectionHead(ops, look, 'Dress code', cx, y, inner / 2);
    y += 4;
    for (const a of data.attire.slice(0, 7)) para(`${a.label} — ${a.line}`);
    if (data.swatches.length) {
      y += 13;
      const n = Math.min(6, data.swatches.length);
      const step = 15;
      let sx = cx - ((n - 1) * step) / 2;
      for (const c of data.swatches.slice(0, n)) {
        ops.push({ t: 'circle', cx: sx, cy: y - 3, r: 5, fill: c, stroke: look.ink, sw: 0.3 });
        sx += step;
      }
      y += 6;
    }
  }
  if (data.details.rsvpContact) {
    any = true;
    y += 16;
    sectionHead(ops, look, 'Kindly reply', cx, y, inner / 2);
    y += 2;
    para(data.details.rsvpContact);
  }
  if (data.details.giftLines.length) {
    any = true;
    y += 16;
    sectionHead(ops, look, 'Gifts', cx, y, inner / 2);
    y += 2;
    for (const g of data.details.giftLines) para(maskAccountLine(g));
  }
  if (data.details.thankYou) {
    any = true;
    y += 6;
    for (const line of wrap(data.details.thankYou, look.bodyFont, 7.4, inner).slice(0, 3)) {
      y += 10;
      text(ops, line, cx, y, { font: look.bodyFont, size: 7.4, color: look.muted, align: 'center' });
    }
  }
  if (data.details.program?.length) {
    any = true;
    y += 16;
    sectionHead(ops, look, 'The program', cx, y, inner / 2);
    y += 2;
    for (const line of data.details.program) para(line, 7.6);
  }
  if (data.details.storyExcerpt) {
    any = true;
    y += 16;
    sectionHead(ops, look, 'Our story', cx, y, inner / 2);
    y += 2;
    para(data.details.storyExcerpt, 7.6, look.muted);
  }
  if (data.details.specialMessage) {
    any = true;
    y += 10;
    for (const line of wrap(data.details.specialMessage, look.bodyFont, 7.6, inner).slice(0, 3)) {
      y += 10.5;
      text(ops, line, cx, y, { font: look.bodyFont, size: 7.6, color: look.ink, align: 'center' });
    }
  }
  // The Event Hub: the one address every guest can use — RSVP, the schedule,
  // the venue map. The QR is ALWAYS printed (its room is reserved at the foot);
  // an NFC sticker spot sits beside it when the couple adds one.
  {
    const q = 56;
    const qy = h - q - 44;
    const withNfc = data.details.nfc === true;
    const qx = withNfc ? cx - q / 2 - NFC_SPOT_CLEAR_R - 4 : cx;
    ops.push({ t: 'rect', x: qx - q / 2 - 4, y: qy - 4, w: q + 8, h: q + 8, fill: '#ffffff' });
    ops.push({ t: 'image', ref: 'eventqr', x: qx - q / 2, y: qy, w: q, h: q });
    if (withNfc) nfcSpot(ops, look, cx + q / 2 + 4, qy + q / 2);
    eyebrow(ops, look, withNfc ? 'Scan or tap for our Event Hub' : 'Scan for our Event Hub', cx, qy + q + 16, 6.6);
    if (data.hubAddress) text(ops, data.hubAddress, cx, qy + q + 26, { font: look.bodyFont, size: 7, color: look.muted, align: 'center', maxWidth: inner });
    any = true;
  }
  if (!any) {
    y += 20;
    para('Add a dress code, a reply contact and your gift lines — they print here.', 8.2, look.muted);
  }
  safeGuide(doc, ctx);
  return doc;
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
  const pad = 14 * k;
  const kind = style === 'boarding' ? 'Boarding pass' : style === 'train' ? 'Admit one' : 'Event pass';
  eyebrow(ops, look, kind, pad, pad + 6 * k, 5.8 * k, 'left');
  if (pass.serial) text(ops, pass.serial, mainW - 10 * k, pad + 6 * k, { font: 'poppins', size: 5.4 * k, color: look.muted, align: 'right' });
  let y = pad + 32 * k;
  y = lockup(ops, look, data, pad, y, 15 * k, ctx.foil, mainW - pad * 2, 'left');
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
    const meta = [data.dateLabel, data.ceremonyVenue].filter(Boolean) as string[];
    for (const m of meta) {
      text(ops, m, pad, y, { font: look.bodyFont, size: 6.4 * k, color: look.muted, align: 'left', maxWidth: mainW - pad * 2 });
      y += 8.4 * k;
    }
  } else {
    const nfcRoom = data.details.nfc === true && nfcFits(mainW, h) ? NFC_SPOT_CLEAR_R * 2 : 0;
    const meta = [data.dateLabel, data.ceremonyTime ? `Ceremony ${data.ceremonyTime}` : null, data.ceremonyVenue].filter(Boolean) as string[];
    for (const m of meta.slice(0, 3)) {
      text(ops, m, pad, y, { font: look.bodyFont, size: 6.4 * k, color: look.muted, align: 'left', maxWidth: mainW - pad * 2 - nfcRoom });
      y += 8.4 * k;
    }
  }
  // An NFC sticker spot, 25 mm true to size, in the main area's corner (on a
  // calling card that is the only place a 25 mm sticker fits).
  if (data.details.nfc === true && nfcFits(mainW, h)) nfcSpot(ops, look, mainW - NFC_SPOT_CLEAR_R, h - NFC_SPOT_CLEAR_R);
  // the stub, and its tear line
  ops.push({ t: 'rect', x: mainW, y: -bleed, w: stubW + bleed, h: h + 2 * bleed, fill: look.paper });
  const dash = style === 'train' ? 3 : 5;
  for (let py = 8 * k; py < h - 8 * k; py += dash * k) ops.push({ t: 'rect', x: mainW - 0.3, y: py, w: 0.6, h: (dash / 2) * k, fill: look.ink, opacity: 0.45 });
  const sx = mainW + stubW / 2;
  eyebrow(ops, look, style === 'boarding' ? 'Passenger' : 'Admit', sx, 18 * k, 5.4 * k);
  // The Guest list toggle: a couple may print passes without names (hand-written, or for walk-ins).
  if (data.details.guestNames !== false) text(ops, pass.name, sx, 34 * k, { font: look.headFont, size: 10.5 * k, color: look.heading, align: 'center', maxWidth: stubW - 12 * k });
  if (pass.seat && style !== 'boarding') text(ops, pass.seat, sx, 45 * k, { font: look.bodyFont, size: 6.4 * k, color: look.accent, align: 'center', caps: true, tracking: 0.18, maxWidth: stubW - 12 * k });
  const q = Math.min(50 * k, stubW - 16 * k);
  if (pass.qrRef) {
    ops.push({ t: 'rect', x: sx - q / 2 - 3 * k, y: h - q - 30 * k, w: q + 6 * k, h: q + 6 * k, fill: '#ffffff' });
    ops.push({ t: 'image', ref: pass.qrRef, x: sx - q / 2, y: h - q - 27 * k, w: q, h: q });
  }
  eyebrow(ops, look, 'Scan at the door', sx, h - 12 * k, 4.8 * k);
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
    const q = 150;
    const panelW = 440;
    // Reserved at the foot, always inside the sheet.
    const py = Math.min(Math.max(y + 24, h - q - 110), h - q - 36 - SAFE_MM * PT_PER_MM - 20);
    ops.push({ t: 'rect', x: cx - panelW / 2, y: py, w: panelW, h: q + 36, fill: look.paper, stroke: look.accent, sw: 1 });
    ops.push({ t: 'rect', x: cx - panelW / 2 + 16, y: py + 16, w: q + 4, h: q + 4, fill: '#ffffff' });
    ops.push({ t: 'image', ref: 'eventqr', x: cx - panelW / 2 + 18, y: py + 18, w: q, h: q });
    const tx = cx - panelW / 2 + q + 42;
    text(ops, 'Scan for our', tx, py + 70, { font: look.bodyFont, size: 16, color: look.ink, align: 'left', caps: true, tracking: 0.14 });
    text(ops, 'Event Hub', tx, py + 94, { font: look.bodyFont, size: 16, color: look.ink, align: 'left', caps: true, tracking: 0.14 });
    text(ops, 'Photos · your table · the schedule', tx, py + 118, { font: look.bodyFont, size: 11, color: look.muted, align: 'left', maxWidth: panelW - q - 60 });
    if (data.hubAddress) text(ops, data.hubAddress, tx, py + 136, { font: look.bodyFont, size: 10, color: look.muted, align: 'left', maxWidth: panelW - q - 60 });
    if (data.details.nfc) nfcSpot(ops, look, cx + panelW / 2 + NFC_SPOT_CLEAR_R + 12, py + (q + 36) / 2);
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
  if (data.hasEventQr) cornerQr(ops, w);
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
  if (data.hasEventQr) cornerQr(ops, w);
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

export function layoutPiece(
  piece: PrintSetKey,
  input: LayoutInput & { pass?: PrintPass },
): PrintDoc {
  const ctx: Ctx = { look: input.look, data: input.data, mode: input.mode, foil: input.foil };
  const fmt = formatFor(piece, input.format);
  const w = (fmt?.wMm ?? 0) * PT_PER_MM;
  const h = (fmt?.hMm ?? 0) * PT_PER_MM;
  const doc = (() => {
    switch (piece) {
      case 'invitation':
        return fitDoc(layoutInvitation(ctx), w, h, ctx);
      case 'entourage':
        return fitDoc(layoutEntourage(ctx), w, h, ctx);
      case 'details':
        return fitDoc(layoutDetails(ctx), w, h, ctx);
      case 'pass':
        return layoutPass(
          ctx,
          input.pass ?? { name: 'Your guest’s name', seat: 'Table 1', seatNumber: '3', qrRef: 'eventqr', serial: 'Nº 0001' },
          fmt ?? PRINT_FORMATS['calling-card'],
        );
      case 'poster':
        return layoutPoster(ctx);
      case 'card':
        return fmt && fmt.wMm > fmt.hMm ? layoutCardLandscape(ctx, fmt) : fitDoc(layoutCard(ctx), w, h, ctx);
    }
  })();
  return input.mode === 'print' && input.whiteInk ? underprintWhite(doc) : doc;
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

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
import { LOGO_FONT_OUTLINE, pinLogoFaceWeight, type OtFace } from '@/lib/logo-fonts';
import type { HubFontKey } from '@/lib/hub-fonts';
import { flattenSvgMark, type FlatMark } from '@/lib/print-mark';
import { SETNAYAN_MARK_PATH, SETNAYAN_MARK_TRANSFORM, SETNAYAN_MARK_VIEWBOX } from '@/lib/qr-style-svg';
import { entourageCellWord, loneRoleWord, roleBlocks, lineNames, pairsShareALine, type EntourageGroup } from '@/lib/entourage';
import { guestPassFacts } from '@/lib/guest-pass';
import { DEFAULT_PASS_CARD_DESIGN, PASS_CARD_FORMAT_ID, PASS_CARD_WORDS, type PassCardDesign } from '@/lib/pass-card';
import type { QrShape } from '@/lib/qr-look';
import { MIN_CONTRAST, groundsAt, hexRgb, legibleInk, lum, over, pathBounds, samplePoints, worstContrast } from '@/lib/print-ground';
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
  printBrandOf,
  menuHasDishes,
  parentLine,
  printableText,
  storyHasMoments,
  type DieCut,
  type MenuMoment,
  type PrintDetails,
  type PrintFontKey,
  type PrintFormat,
  type PrintBrand,
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
  | { t: 'path'; d: string; fill?: string; stroke?: string; sw?: number; opacity?: number; layer?: PrintLayer; evenOdd?: boolean; text?: PrintTextMeta; mark?: true; brand?: PrintBrand }
  | { t: 'image'; ref: string; x: number; y: number; w: number; h: number; opacity?: number }
  | { t: 'circle'; cx: number; cy: number; r: number; fill?: string; stroke?: string; sw?: number; opacity?: number; dash?: boolean; nfc?: boolean };

/**
 * 📏 WHAT A LINE OF TYPE WAS, kept on its outline path so a measurement can
 * read the drawn card rather than re-derive it (`lib/print-fit-measure.ts`,
 * `the-printed-pass-fits.test.ts`): the words as drawn (after `printableText`
 * and caps), the size they were SET at, the size the layout ASKED for, and the
 * width they had to fit. The backends ignore it — it changes no ink.
 */
export type PrintTextMeta = { s: string; size: number; asked: number; maxWidth?: number; width: number; box?: { x: number; y: number; w: number; h: number } };

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
  /** 👫 The entourage style the Hub wears (`PrintEntourageStyle`) — absent: the print's own card. */
  entourageStyle?: PrintEntourageStyle;
  /** Is the theme's still (or the couple's hero) in `images.still`? */
  hasStill: boolean;
  /** 🖼 The couple chose their own photo for the Our Story poster (`images.posterBg`). */
  hasPosterBg?: boolean;
  hasEventQr: boolean;
  /**
   * The SHAPE of every code on this set (the event's `QrLook.shape`,
   * lib/qr-look.ts) — the slot a code sits in follows it (`qrPlate`). Absent =
   * square, so a caller that never resolved a look draws what it always drew.
   */
  qrShape?: QrShape;
  /** The event type's own word, capitalised ("Wedding", "Debut") — the pass card's when-line. */
  eventWord?: string;
  /**
   * "As of September 29, 2026" — stamped on a PRINTED pass card only (owner
   * 2026-09-29, via the controller: tickets are drawn live from today's data,
   * and paper says which day that was). A saved PNG carries none.
   */
  asOf?: string | null;
};

export type PrintPass = {
  name: string;
  seat: string | null;
  seatNumber?: string | null;
  qrRef: string | null;
  serial: string | null;
  /** When the doors open, already formatted — the phone card's ARRIVE. Null/absent = unknown, omitted. */
  arrive?: string | null;
  /** A NAMED, confirmed companion — never a mere allowance (lib/guest-pass.ts). */
  bringing?: string | null;
  /** How many NAMED companions who are coming — the card's "and 1 guest". 0/absent = none. */
  party?: number | null;
  /**
   * 🔓 A REQUEST NOT YET ACCEPTED (owner 2026-09-29, "IT IS THEIR DIGITAL TICKET,
   * IN A 'REQUEST PENDING' STATE"; prototype guest_ticket_flow_2026-09-29.html
   * frame B): the band's second line ("waiting for Indalecio & Claire"). Set →
   * no Table / Arrive / party, a dashed "Request pending" band where the facts
   * sit, and "Not valid at the door yet" at the foot. Classic layout only.
   */
  pending?: string | null;
};

// ─── Fonts ──────────────────────────────────────────────────────────────────

/**
 * The file a print face is read from: a bundled print face, or a Hub face's outline file — the SAME TrueType the
 * Logo outlines that face from (`LOGO_FONT_OUTLINE`), served from `public/` and traced into the print lambda
 * (`next.config.ts`).
 */
export function printFontFile(key: PrintFontKey): string {
  if (key.startsWith('hub-')) return `public${LOGO_FONT_OUTLINE[key.slice(4) as HubFontKey]}`;
  return PRINT_FONT_FILES[key as keyof typeof PRINT_FONT_FILES];
}

const fontCache = new Map<PrintFontKey, OtFont>();

/** Do a face's capitals and round letters stay within two em of the baseline — i.e. are its outlines real letters? */
function outlinesStayInTheirBox(f: OtFont): boolean {
  for (const ch of 'OAEgQ') {
    const b = f.getPath(ch, 0, 0, 100).getBoundingBox();
    if (!(b.y2 - b.y1 < 200 && b.x2 - b.x1 < 200)) return false;
  }
  return true;
}
export function printFont(key: PrintFontKey): OtFont {
  let f = fontCache.get(key);
  if (!f) {
    f = loadOtFont(printFontFile(key));
    if (key.startsWith('hub-')) {
      pinLogoFaceWeight(f as unknown as OtFace, key.slice(4) as HubFontKey);
      /* 🪤 MEASURED 2026-10-21: Josefin Sans pinned to the stage's 400 (`LOGO_FONT_VARIATION`) draws its "O" 27 em
         tall in this opentype.js — spikes across the whole card. A face whose letters leave their em box cannot go on
         paper; the card is set in the print's own body face instead, never in broken outlines. */
      if (!outlinesStayInTheirBox(f)) f = key === 'cardo' ? f : printFont('cardo');
    }
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
  // The ink box, from the same commands the outline is written from (control
  // points included — never smaller than the ink), so nothing re-parses the path.
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of runsFor(s, o.font, size, tr)) {
    if (r.ch !== ' ') {
      const commands = r.font.getPath(r.ch, cx, y, size).commands as readonly Cmd[];
      const d = pathData(commands);
      if (d) {
        parts.push(d);
        for (const c of commands) {
          for (const [px, py] of [[c.x, c.y], [c.x1, c.y1], [c.x2, c.y2]] as const) {
            if (typeof px !== 'number' || typeof py !== 'number') continue;
            if (px < x0) x0 = px;
            if (px > x1) x1 = px;
            if (py < y0) y0 = py;
            if (py > y1) y1 = py;
          }
        }
      }
    }
    cx += r.adv;
  }
  if (parts.length) {
    const box = Number.isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : undefined;
    ops.push({ t: 'path', d: parts.join(' '), fill: o.color, layer: o.layer, opacity: o.opacity, text: { s, size, asked: o.size, maxWidth: o.maxWidth, width, box } });
  }
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
    ops.push({ t: 'path', d: scalePath(p.d, s, ox, oy), fill: vanishes || !p.fill ? look.accent : p.fill, evenOdd: p.evenOdd || undefined, mark: true });
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
    if (look.frame) {
      paperPanel(ops, look, look.frame, w, h, b);
      return { top: 0, left: 0 };
    }
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

/**
 * 🖼 THE HUB'S PICTURE, PRINT-SAFE (`PrintLook.frame`, lib/print-hub-look.ts). The picture runs to the bleed under
 * the Hub's OWN scrim — the paper veil the guest page lays over it (`resolveAdaptiveTheme(…).scrim`) — so the edge
 * of the card is the Hub's background as the guest sees it. The words sit on a paper panel `inset` points in from
 * the trim, at `inner` (never below the Hub's scrim; raised until every ink reads on the picture's lightest and
 * darkest parts), its edge feathered into the margin so the panel is a fade, not a box. Opacities STACK the way
 * the backends composite them (`over`), so the panel's own steps are solved for the total they must reach.
 */

function paperPanel(ops: PrintOp[], look: PrintLook, frame: NonNullable<PrintLook['frame']>, w: number, h: number, b: number) {
  const paper = look.scrim?.color ?? look.paper;
  if (frame.outer > 0) ops.push({ t: 'rect', x: -b, y: -b, w: w + 2 * b, h: h + 2 * b, fill: paper, opacity: frame.outer });
  if (frame.inner <= frame.outer) return;
  const steps = 6;
  /* Outermost ring first; ring i covers everything inside it, so the middle carries every ring and reaches `inner`,
     and each band toward the edge carries one ring fewer. Each ring adds just enough paper, over what lies under it,
     for its band to reach its share of the way from `outer` to `inner`. */
  let had = frame.outer;
  for (let i = 1; i <= steps; i += 1) {
    const want = frame.outer + ((frame.inner - frame.outer) * i) / steps;
    const add = had >= 1 ? 0 : (want - had) / (1 - had);
    const pad = frame.inset + (frame.feather * (i - 1)) / (steps - 1);
    if (add > 0) ops.push({ t: 'rect', x: pad, y: pad, w: w - 2 * pad, h: h - 2 * pad, fill: paper, opacity: Math.min(1, add) });
    had = want;
  }
}

/** The couple's own poster photo, full bleed, under a paper veil so the story reads over it. */
function posterGround(ops: PrintOp[], look: PrintLook, w: number, h: number, b: number): { top: number; left: number } {
  ops.push({ t: 'image', ref: 'posterBg', x: -b, y: -b, w: w + 2 * b, h: h + 2 * b });
  ops.push({ t: 'rect', x: -b, y: -b, w: w + 2 * b, h: h + 2 * b, fill: look.paper, opacity: 0.8 });
  return { top: 0, left: 0 };
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
  text(ops, s, x, y, { font: look.labelFont ?? look.bodyFont, size, color: color ?? look.muted, align, caps: true, tracking: 0.22 });
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

function cornerQr(doc: PrintDoc, data: PrintSetData) {
  const slot = cornerQrSlot(doc.die, doc.w, doc.h);
  qrPlate(doc.ops, data.qrShape, slot.x, slot.y, slot.size, QR_PLATE);
  doc.ops.push({ t: 'image', ref: 'eventqr', x: slot.x, y: slot.y, w: slot.size, h: slot.size });
}

/**
 * ⭕ THE SLOT FOLLOWS THE CODE — owner 2026-09-30, verbatim: *"Custom QR when
 * shape is changed the slot for the QR should also be round on the prints if
 * the QR is round and not have a square frame with round QR"*.
 *
 * EVERY white plate a code sits on is drawn here, and nowhere else: a square
 * code (`QrShape` 'square', and every free event) on the square plate it has
 * always had; a round code (a Pro couple's Circle, lib/qr-look.ts) on a round
 * plate, CONCENTRIC with the code, `pad` wider than the code's own disc on
 * every side — the white ring a scanner needs round a round code, exactly as
 * the square plate is the white margin round a square one. A circle plate
 * sits inside the square plate's box, so every slot that fitted still fits.
 * `lib/a-round-code-sits-in-a-round-slot.test.ts` holds it on every surface,
 * and decodes the round code where it sits.
 */
function qrPlate(ops: PrintOp[], shape: QrShape | undefined, x: number, y: number, size: number, pad: number, fill = '#ffffff') {
  if (shape === 'circle') ops.push({ t: 'circle', cx: x + size / 2, cy: y + size / 2, r: size / 2 + pad, fill });
  else ops.push({ t: 'rect', x: x - pad, y: y - pad, w: size + 2 * pad, h: size + 2 * pad, fill });
}

/**
 * 🏷 THE ROOM A FREE FRONT KEEPS AT ITS FOOT for the "Made with Setnayan" line (`brandPiece`, owner 2026-10-21): the
 * line's ink, its clearance and a point — so the line sits ON the bottom edge, under the card's words, never over them.
 * 0 on a Pro look: its tiny mark finds an edge of its own.
 */
function brandFoot(doc: PrintDoc, ctx: Ctx): number {
  if (printBrandOf(ctx.look) !== 'line') return 0;
  const o = brandLineOpts(brandSize(doc, 'line'), '#000000');
  const ink = lineInk(PRINT_BRAND_WORDS, o);
  const half = text([], PRINT_BRAND_WORDS, 0, 0, o) / 2;
  // Measured from the trim: where this die's safe area ends under the line (a scallop's cusps sit higher than a rect's edge).
  const edge = safeBottom(doc, doc.w / 2 - half, doc.w / 2 + half);
  // …plus a little air, so the line reads as the sheet's foot and not as the last line of the card's own words.
  return doc.h - edge + 0.5 + (ink.bottom - ink.top) + BRAND_CLEAR + 2.5;
}

/** The lowest baseline a card's FRONT words may use — clear of the safe line, of the free brand line, and of a bottom-corner QR. */
function wordsFloor(doc: PrintDoc, ctx: Ctx, descender: number): number {
  let floor = Math.min(doc.h - SAFE_PT, doc.h - brandFoot(doc, ctx)) - descender;
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
  if (data.hasEventQr) cornerQr(doc, data);
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
  text(doc.ops, title, cx, 102 + d, { font: look.headingFont ?? look.headFont, size: 22, color: look.heading, align: 'center', caps: look.capsNames, maxWidth: doc.w - 60, layer: ctx.foil ? 'foil' : undefined });
  rule(doc.ops, cx, 114 + d, 30, look.accent);
  return 132 + d;
}

function sectionHead(ops: PrintOp[], look: PrintLook, s: string, cx: number, y: number, half: number, size = 7) {
  const width = measure(s.toUpperCase(), look.labelFont ?? look.bodyFont, size, 0.24 * size);
  text(ops, s, cx, y, { font: look.labelFont ?? look.bodyFont, size, color: look.accent, align: 'center', caps: true, tracking: 0.24, maxWidth: half * 2 });
  const gap = width / 2 + 7;
  if (half > gap + 6) {
    ops.push({ t: 'rect', x: cx - half, y: y - 2.6, w: half - gap, h: 0.5, fill: look.accent, opacity: 0.6 });
    ops.push({ t: 'rect', x: cx + gap, y: y - 2.6, w: half - gap, h: 0.5, fill: look.accent, opacity: 0.6 });
  }
}

/** Lines' group heading — the page's `.pahina-eyebrow`: small caps in the accent, flush left, a short rule after. */
function linesHead(ops: PrintOp[], look: PrintLook, s: string, x: number, y: number, maxW: number, size = 7) {
  const font = look.labelFont ?? look.bodyFont;
  const width = Math.min(maxW, measure(s.toUpperCase(), font, size, 0.24 * size));
  text(ops, s, x, y, { font, size, color: look.accent, align: 'left', caps: true, tracking: 0.24, maxWidth: maxW });
  const rule = Math.min(40, maxW - width - 8);
  if (rule > 8) ops.push({ t: 'rect', x: x + width + 8, y: y - 2.6, w: rule, h: 0.5, fill: look.accent, opacity: 0.55 });
}

// ─── The Entourage: measured, balanced, never off the card ─────────────────

/**
 * One printed line of a group: a pair across the middle, or one name down it —
 * or `sub`, a small role sub-heading (Secondary Sponsors' "Candle"), which is
 * not a name and carries none.
 */
export type EntourageLine = {
  l?: string;
  r?: string;
  c?: string;
  sub?: string;
  /** `c` holds a data-paired couple on one line ("Hon. Ricardo & Mrs. Jessica Villahermosa") — TWO people. */
  pair?: true;
  /** A lone person's role word, printed small under their centred name (the Hub's `loneRoleWord` / `entourageCellWord`). */
  word?: string;
};

/**
 * 👫 THE ENTOURAGE STYLE THE HUB WEARS (`events.style_preferences.scene_styles.entourage`, lib/scene-styles-stages.ts;
 * owner 2026-10-15 "ON THE AXIS · LINES · THE MARCH"). Absent = the print's own card as it always was.
 */
export type PrintEntourageStyle = 'roll-call' | 'lines';

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
export function printedEntourageLines(g: EntourageGroup, flow: boolean, style?: PrintEntourageStyle): EntourageLine[] {
  /* ⚖ OWNER 2026-09-30 — the Secondary Sponsors print BY ROLE, as on the
     invitation page: "Candle" once as a small sub-heading, the pair(s) under
     it, and no "· Candle Sponsor" after any name. Same `roleBlocks` the page
     uses, so the card and the page cannot group them differently. */
  const blocks = roleBlocks(g);
  if (blocks) {
    return blocks.flatMap((b) => [
      { sub: b.label },
      ...printedEntourageLines({ ...g, key: `${g.key}:${b.key}`, rows: b.rows }, flow, style),
    ]);
  }
  if (style) return hubEntourageLines(g, flow, style);
  const pairs: EntourageLine[] = [];
  const left: string[] = [];
  const right: string[] = [];
  /* ⚖ Owner 2026-09-30, option 1: in the Principal Sponsors and the crews a
     real pair is ONE centred line, as on the page — `lineNames` writes it.
     Unpaired halves still stack in their columns below (2026-09-28 fit). */
  const oneLine = pairsShareALine(g);
  for (const [l, r] of g.rows) {
    if (l && r) pairs.push(oneLine ? { c: lineNames([l, r]), pair: true } : { l: l.name, r: r.name });
    else if (l) left.push(l.name);
    else if (r) right.push(r.name);
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

/**
 * 👫 THE HUB'S OWN ROWS, ON PAPER — what `EntourageSection` draws for On the axis and Lines, row for row: each row of
 * the group (`buildEntourage` — a walk, or one person alone) is one printed line. A pair keeps its two cells, the
 * right cell the left cell's partner (owner 2026-10-15); anyone ALONE is centred (owner 2026-10-17, "center it
 * instead of just 1 side"), with the role word the page gives them (`loneRoleWord` On the axis, `entourageCellWord`
 * in Lines). Nobody is moved into an empty cell. Only when the card is full (`flow`) does a group with no pairs at
 * all flow into two columns — the fit's last resort, as before.
 */
function hubEntourageLines(g: EntourageGroup, flow: boolean, style: PrintEntourageStyle): EntourageLine[] {
  const oneLine = pairsShareALine(g);
  const lone = g.rows.every(([l, r]) => !(l && r));
  if (flow && lone && g.rows.length >= 3) {
    const list = g.rows.map(([l, r]) => (l ?? r)!.name);
    const half = Math.ceil(list.length / 2);
    return list.slice(0, half).map((l, i) => ({ l, r: list[half + i] }));
  }
  return g.rows.map(([l, r]): EntourageLine => {
    if (l && r) return oneLine ? { c: lineNames([l, r]), pair: true } : { l: l.name, r: r.name };
    const one = (l ?? r)!;
    const word = style === 'lines' ? entourageCellWord(g, one) : loneRoleWord(g, one);
    return word ? { c: one.name, word } : { c: one.name };
  });
}

type PlacedText = { s: string; x: number; y: number; align: 'left' | 'right' | 'center'; width: number; sub?: boolean };

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
  geo: { w: number; h: number; die: DieCut; font: PrintFontKey; top: (page: number) => number; floor: (page: number) => number; style?: PrintEntourageStyle },
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
    const lines = printedEntourageLines(g, flow, geo.style);
    let headDone = false;
    for (let i = 0; i < lines.length; i += 1) {
      const row = lines[i]!;
      if (row.sub !== undefined) {
        /* A role sub-heading: one small muted line, kept with the name after
           it — never stranded at the foot of a side. */
        const subLead = size * 1.2;
        const headH = headDone ? 0 : gap;
        if (y + headH + subLead + lead + desc > geo.floor(page) && (pages[page]!.texts.length > 0 || pages[page]!.heads.length > 0)) {
          newPage();
          headDone = false;
        }
        if (!headDone) {
          y += gap * 0.78;
          for (let k = 0; k < 400 && !lineSafe(y, cx - (w - 56) / 2, cx + (w - 56) / 2); k += 1) y += 1;
          pages[page]!.heads.push({ label: i > 0 ? `${g.label} · continued` : g.label, y });
          y += gap * 0.2;
          headDone = true;
        }
        y += subLead + (i > 0 ? size * 0.4 : 0);
        for (let t = 0; t < 400 && !lineSafe(y, cx - fullW / 2, cx + fullW / 2); t += 1) y += 1;
        pages[page]!.texts.push({ s: row.sub, x: cx, y, align: 'center', width: fullW, sub: true });
        continue;
      }
      const wrapped = row.c !== undefined
        ? { c: nameLines(row.c, geo.font, size, fullW) }
        : { l: row.l ? nameLines(row.l, geo.font, size, colW) : [], r: row.r ? nameLines(row.r, geo.font, size, colW) : [] };
      const n = 'c' in wrapped ? wrapped.c!.length : Math.max(wrapped.l!.length, wrapped.r!.length);
      const headH = headDone ? 0 : gap;
      const wordH = row.word ? size * 1.05 : 0;
      if (y + headH + n * lead + wordH + desc > geo.floor(page) && (pages[page]!.texts.length > 0 || pages[page]!.heads.length > 0)) {
        newPage();
        headDone = false;
      }
      const x0 = row.c !== undefined ? cx - fullW / 2 : cx - 6 - colW;
      const x1 = row.c !== undefined ? cx + fullW / 2 : cx + 6 + colW;
      /* Lines: pairs flush-left in two columns; On the axis (and the print's own card): they meet at the centre. */
      const flushLeft = geo.style === 'lines';
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
          if (l) pages[page]!.texts.push(flushLeft ? { s: l, x: cx - 6 - colW, y, align: 'left', width: colW } : { s: l, x: cx - 6, y, align: 'right', width: colW });
          if (r) pages[page]!.texts.push({ s: r, x: cx + 6, y, align: 'left', width: colW });
        }
      }
      if (row.word) {
        y += wordH;
        for (let t = 0; t < 400 && !lineSafe(y, cx - fullW / 2, cx + fullW / 2); t += 1) y += 1;
        pages[page]!.texts.push({ s: row.word, x: cx, y, align: 'center', width: fullW, sub: true });
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
    if (data.hasEventQr) cornerQr(front, data);
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
    style: data.entourageStyle,
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
    p.heads.forEach((hd, k) => {
      if (data.entourageStyle !== 'lines') return sectionHead(doc.ops, look, hd.label, cx, hd.y, (w - 56) / 2);
      /* Lines: the page's own eyebrow — flush left, a short rule after it — and a hairline between groups. */
      const x0 = cx - (w - 56) / 2;
      if (k > 0) doc.ops.push({ t: 'rect', x: x0, y: hd.y - 22 * (size / 8.4) * 0.62, w: w - 56, h: 0.4, fill: look.ink, opacity: 0.18 });
      linesHead(doc.ops, look, hd.label, x0, hd.y, w - 56);
    });
    for (const t of p.texts) {
      if (t.sub) text(doc.ops, t.s, t.x, t.y, { font: look.bodyFont, size: size * 0.82, color: look.muted, align: t.align, maxWidth: t.width });
      else text(doc.ops, t.s, t.x, t.y, { font: look.bodyFont, size, color: look.ink, align: t.align, maxWidth: t.width });
    }
    if (i === 0 && data.hasEventQr) cornerQr(doc, data);
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
  const half = measure(label.toUpperCase(), look.labelFont ?? look.bodyFont, 7, 0.22 * 7) / 2;
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
  const hubBase = Math.min(h - 18, safeBottom(front, cx - inner / 2, cx + inner / 2) - 2.5, h - brandFoot(front, ctx) - 2.5);
  const qy = hubBase - 26 - q;
  const withNfc = data.details.nfc === true;
  {
    const ops = front.ops;
    const qx = withNfc ? cx - q / 2 - NFC_SPOT_CLEAR_R - 4 : cx;
    qrPlate(ops, data.qrShape, qx - q / 2, qy, q, 4);
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
    for (const line of wrap('Add your menu in Event Details — the moments of your night, and the dishes of each.', look.bodyFont, 8.4, w - 80)) {
      text(front.ops, line, cx, y, { font: look.bodyFont, size: 8.4, color: look.muted, align: 'center' });
      y += 11;
    }
    if (data.hasEventQr) cornerQr(front, data);
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
    if (i === 0 && data.hasEventQr) cornerQr(doc, data);
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
  // 🖼 The couple's own photo behind the whole poster (owner 2026-09-29, OWNER
  // ANSWERS (1)), veiled in the paper colour so every line reads; else the
  // theme's picture, as before.
  const placed = data.hasPosterBg ? posterGround(front.ops, look, w, h, bleed) : still(front.ops, look, data, w, h, bleed, 0.3);
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
    if (data.hasEventQr) cornerQr(front, data);
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
  if (data.hasEventQr) cornerQr(front, data);
  for (const doc of docs) safeGuide(doc, ctx);
  return docs;
}

/**
 * THE PASS, in any of its formats (`PRINT_FORMATS`): a calling card, a CR80 ID
 * card, a train ticket (landscape, tear line) or a boarding pass (a stub, and
 * TABLE · SEAT · TIME where a gate and a seat would be). One composition, sized
 * from the sheet's own height — so a format is laid out, never stretched.
 */
function layoutPass(ctx: Ctx, rawPass: PrintPass, fmt: PrintFormat = PRINT_FORMATS['calling-card']): PrintDoc {
  // 🎟 The table / seat is drawn only when the reader filled it — on the day
  // (`ticketShowsTable`, lib/guests-may-see-seats.ts).
  const pass = rawPass;
  // The phone card is its own composition (portrait, the QR the hero) — the
  // same one the 1080 × 1440 picture a guest saves is drawn from.
  // 🏷 On paper the card carries Setnayan ONCE — never the saved picture's foot mark: a free card draws the print's line as
  // the lowest line of its own foot, inside its frame (`cardFoot` — there is no room below a frame that sits on the safe
  // line); a Pro card takes the mark from `brandPiece`.
  if (fmt.style === 'phone') {
    const printed: Ctx = { ...ctx, data: { ...ctx.data, details: { ...ctx.data.details, setnayanMark: false, brandLine: printBrandOf(ctx.look) === 'line' } } };
    return PASS_CARD_LAYOUTS[ctx.data.details.passDesign ?? DEFAULT_PASS_CARD_DESIGN](printed, pass, fmt);
  }
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
  // 🏷 A free pass keeps its foot for the "Made with Setnayan" line (`brandFoot`): the words and the NFC spot stand above it.
  const foot = Math.max(0, brandFoot(doc, ctx) - SAFE_PT);
  const nfcOn = data.details.nfc === true && nfcFits(mainW, h - foot);
  const nfcRoom = nfcOn ? NFC_SPOT_CLEAR_R * 2 : 0;
  const spotTop = nfcOn ? h - SAFE_PT - foot - 2 * NFC_SPOT_R - NFC_STICKER_MARGIN_MM * PT_PER_MM : Infinity;
  const floor = h - SAFE_PT - foot;
  /** The room a line has across the main area — narrower beside the NFC spot. */
  const widthAt = (base: number, size: number) => (base + size * DESC_EM < spotTop - 2 ? mainW - pad * 2 : mainW - pad * 2 - nfcRoom);

  // ── The top line: the kind, the serial — and the stub's ADMIT on the SAME
  // baseline, at the SAME size (siblings across the tear line line up).
  const eyeSize = Math.max(PRINT_MIN_BODY_PT, 5.8 * k);
  const eyeY = pad + 6 * k;
  const kind = style === 'boarding' ? 'Boarding pass' : style === 'train' ? 'Admit one' : 'Event pass';
  const kindW = measure(kind.toUpperCase(), look.bodyFont, eyeSize, 0.22 * eyeSize);
  eyebrow(ops, look, kind, pad, eyeY, eyeSize, 'left');
  if (pass.serial) {
    const room = mainW - 10 * k - (pad + kindW + 8);
    const fit = fitWords(pass.serial, { font: 'poppins', size: Math.max(PRINT_MIN_BODY_PT, 5.4 * k), maxWidth: room, floor: PRINT_MIN_BODY_PT });
    drawFit(ops, { lines: fit.lines.slice(0, 1), size: fit.size }, mainW - 10 * k, eyeY, { font: 'poppins', size: fit.size, color: look.muted, align: 'right' });
  }

  /**
   * THE MAIN STACK, MEASURED — the couple, (the boarding fields,) then the
   * date / time / venue lines — laid out at a scale `f`; the largest scale at
   * which the last line clears the safe line is drawn. Before, the names were
   * squeezed to 0.55 and drawn wider than the card anyway, and a venue that
   * did not fit was stacked onto the line above it.
   */
  type Plan = { draw: Array<() => void>; bottom: number; cut: boolean; small: boolean };
  const plan = (f: number, last: boolean): Plan => {
    const draw: Array<() => void> = [];
    const size = 15 * k * f;
    const layer: PrintLayer | undefined = ctx.foil ? 'foil' : undefined;
    let y = eyeY + 11 * k + size;
    const nameO = { font: look.headFont, color: look.heading, align: 'left' as const, caps: look.capsNames, layer };
    let inkBelow = 0;
    let cut = false;
    let small = false;
    const nameLines = (s: string, at: number) => {
      // The couple is the pass's secondary line (the guest's name is its first): it may go to the 6 pt floor before it is cut.
      const spec = (wd: number): FitSpec => ({ font: look.headFont, size, maxWidth: wd, floor: Math.min(size, PRINT_MIN_BODY_PT), wrapBelow: Math.min(size, Math.max(8, size * 0.62)), maxLines: 2, caps: look.capsNames });
      let fit = fitWords(s, spec(widthAt(at, size)));
      if (fit.lines.some((l) => l.endsWith('…'))) cut = true;
      if (fit.size < 8) small = true;
      let bases = fitBaselines(fit, pad, at, { ...nameO, size: fit.size, lead: 1.08 });
      if (widthAt(bases[bases.length - 1]!, fit.size) < widthAt(at, size)) {
        fit = fitWords(s, spec(widthAt(bases[bases.length - 1]!, fit.size)));
        if (fit.lines.some((l) => l.endsWith('…'))) cut = true;
        if (fit.size < 8) small = true;
        bases = fitBaselines(fit, pad, at, { ...nameO, size: fit.size, lead: 1.08 });
      }
      const f2t = fit;
      draw.push(() => drawFit(ops, f2t, pad, at, { ...nameO, size: f2t.size, lead: 1.08 }));
      const lastBase = bases[bases.length - 1]!;
      inkBelow = lastBase + lineInk(fit.lines[fit.lines.length - 1] ?? '', { ...nameO, size: fit.size }).bottom;
      return lastBase;
    };
    y = nameLines(data.names.first, y);
    if (data.names.second) {
      const andO = { font: look.scriptFont ?? look.headFont, size: Math.max(PRINT_MIN_BODY_PT, size * 0.6), color: look.accent, align: 'left' as const };
      const andWord = look.scriptFont ? 'and' : '&';
      const andInk = lineInk(andWord, andO);
      // "and" sits under the first name's ink, never on it (a ç or a J descends).
      const andY = Math.max(y + size * 0.78, inkBelow + Math.max(0.8, size * 0.06) - andInk.top);
      draw.push(() => text(ops, andWord, pad, andY, andO));
      const secondTop = lineInk(data.names.second, { ...nameO, size }).top;
      y = nameLines(data.names.second, Math.max(andY + size * 0.95, andY + andInk.bottom + Math.max(0.8, size * 0.06) - secondTop));
    }
    y += size * 0.3 + 10 * k * f;
    if (style === 'boarding') {
      // Gate · Seat · Boarding → Table · Seat · Time, each a small labelled field.
      // 🎟 A Table or Seat the ticket does not carry (before the day, or not
      // placed) goes, not print "—": an empty field reads as a table the guest
      // was never given.
      const fields: Array<[string, string | null]> = (
        [
          ['Table', pass.seat ? pass.seat.replace(/^Table\s+/i, '') : null],
          ['Seat', pass.seatNumber ?? null],
          ['Time', data.ceremonyTime],
        ] as Array<[string, string | null]>
      ).filter(([label, value]) => (label !== 'Table' && label !== 'Seat') || value !== null);
      const labelSize = Math.max(PRINT_MIN_BODY_PT, 5 * k);
      const vSize = 11 * k * Math.max(f, 0.8);
      const valueY = y + labelSize * 0.4 + vSize;
      const colW = widthAt(valueY + vSize * 1.2, vSize) / 3;
      let rowEnd = valueY;
      fields.forEach(([label, value], i) => {
        const fx = pad + i * colW;
        const fit = fitWords(value ?? '—', { font: look.headFont, size: vSize, maxWidth: colW - 6, floor: PRINT_MIN_BODY_PT, wrapBelow: 8, maxLines: 2 });
        if (fit.lines.some((l) => l.endsWith('…'))) cut = true;
        const vb = fitBaselines(fit, fx, valueY, { font: look.headFont, size: fit.size, color: look.heading, align: 'left', lead: 1.12 });
        const lastV = vb[vb.length - 1]!;
        rowEnd = Math.max(rowEnd, lastV);
        const labelY = y;
        draw.push(() => {
          eyebrow(ops, look, label, fx, labelY, labelSize, 'left');
          drawFit(ops, fit, fx, valueY, { font: look.headFont, size: fit.size, color: look.heading, align: 'left', lead: 1.12 });
        });
      });
      y = rowEnd + vSize * DESC_EM + 8 * k * f;
    }
    // The date / time / venue lines — WRAPPED, not squeezed (a long church name
    // used to be shrunk to fit one line, down to 3.5 pt); narrower beside the NFC spot.
    const meta = (style === 'boarding'
      ? [data.dateLabel, data.ceremonyVenue]
      : [data.dateLabel, data.ceremonyTime ? `Ceremony ${data.ceremonyTime}` : null, data.ceremonyVenue]
    ).filter(Boolean) as string[];
    const mSize = Math.max(PRINT_MIN_BODY_PT, 6.4 * k * f);
    const lead = mSize * 1.31;
    let yy = y + mSize * 0.7;
    const lines: Array<{ s: string; y: number; width: number }> = [];
    for (const m of meta) {
      const words = printableText(m).split(/\s+/).filter(Boolean);
      let line = '';
      for (const wd of words) {
        const next = line ? `${line} ${wd}` : wd;
        if (line && measure(next, look.bodyFont, mSize) > widthAt(yy, mSize)) {
          lines.push({ s: line, y: yy, width: widthAt(yy, mSize) });
          yy += lead;
          line = wd;
        } else line = next;
      }
      if (line) {
        lines.push({ s: line, y: yy, width: widthAt(yy, mSize) });
        yy += lead;
      }
    }
    let kept = lines;
    if (last) {
      // Nothing fits even at the smallest scale: keep the lines that do, the last one ending in "…".
      kept = lines.filter((l) => l.y + mSize * DESC_EM <= floor);
      if (kept.length < lines.length && kept.length) {
        const tail = kept[kept.length - 1]!;
        const rest = lines.slice(kept.length - 1).map((l) => l.s).join(' ');
        kept[kept.length - 1] = { ...tail, s: ellipsize(rest, (t) => measure(t, look.bodyFont, mSize) <= tail.width * 0.999) };
      }
    }
    for (const l of kept) {
      const fit = fitWords(l.s, { font: look.bodyFont, size: mSize, maxWidth: l.width, floor: PRINT_MIN_BODY_PT });
      draw.push(() => text(ops, fit.lines[0] ?? '', pad, l.y, { font: look.bodyFont, size: fit.size, color: look.muted, align: 'left' }));
    }
    if (lines.some((l) => measure(l.s, look.bodyFont, mSize) > l.width)) cut = true;
    const bottom = lines.length ? lines[lines.length - 1]!.y + mSize * DESC_EM : y;
    return { draw, bottom, cut, small };
  };
  // The largest scale at which everything fits WHOLE; else the largest at which it fits at all.
  // In order: whole and the couple ≥ 8 pt · whole · fits at all — each at the largest scale that does.
  const plans: Plan[] = [];
  for (let f = 1; f >= 0.5 - 1e-9; f = Math.round((f - 0.05) * 100) / 100) {
    const p = plan(f, false);
    if (p.bottom <= floor) plans.push(p);
  }
  const chosen = plans.find((p) => !p.cut && !p.small) ?? plans.find((p) => !p.cut) ?? plans[0] ?? null;
  for (const d of (chosen ?? plan(0.5, true)).draw) d();
  // An NFC sticker spot, 25 mm true to size, in the main area's corner (on a
  // calling card that is the only place a 25 mm sticker fits).
  // Its ring sits on the safe line, never past it.
  if (nfcOn) nfcSpot(ops, look, mainW - NFC_SPOT_CLEAR_R, h - SAFE_PT - foot - NFC_SPOT_R);
  // the stub, and its tear line
  ops.push({ t: 'rect', x: mainW, y: -bleed, w: stubW + bleed, h: h + 2 * bleed, fill: look.paper });
  const dash = style === 'train' ? 3 : 5;
  for (let py = SAFE_PT; py + (dash / 2) * k <= h - SAFE_PT; py += dash * k) ops.push({ t: 'rect', x: mainW - 0.3, y: py, w: 0.6, h: (dash / 2) * k, fill: look.ink, opacity: 0.45 });
  // The stub's words and QR are centred in what is SAFE of it: from the tear
  // line to 5 mm inside the card's right edge, 4 pt clear of each.
  const stubRight = w - SAFE_PT;
  const stubInner = stubRight - mainW - 8;
  const sx = (mainW + stubRight) / 2;
  const stubEye = fitWords(style === 'boarding' ? 'Passenger' : 'Admit', { font: look.bodyFont, size: eyeSize, maxWidth: stubInner, floor: PRINT_MIN_BODY_PT, caps: true, tracking: 0.22, minTracking: 0.08 });
  text(ops, stubEye.lines[0] ?? '', sx, eyeY, { font: look.bodyFont, size: stubEye.size, color: look.muted, align: 'center', caps: true, tracking: stubEye.tracking ?? 0.22 });
  let stubY = eyeY + eyeSize * DESC_EM;
  // The Guest list toggle: a couple may print passes without names (hand-written, or for walk-ins).
  if (data.details.guestNames !== false && pass.name) {
    const size = 10.5 * k;
    const fit = fitWords(pass.name, { font: look.headFont, size, maxWidth: stubInner, floor: 8, wrapBelow: Math.max(8, size * 0.8), maxLines: 2 });
    const first = Math.max(34 * k, stubY + 4 * k + fit.size);
    stubY = drawFit(ops, fit, sx, first, { font: look.headFont, size: fit.size, color: look.heading, align: 'center', lead: 1.12 }) + fit.size * DESC_EM;
  }
  if (pass.seat && style !== 'boarding') {
    const size = Math.max(PRINT_MIN_BODY_PT, 6.4 * k);
    const fit = fitWords(pass.seat, { font: look.bodyFont, size, maxWidth: stubInner, floor: PRINT_MIN_BODY_PT, maxLines: 2, caps: true, tracking: 0.18, minTracking: 0.06 });
    const first = Math.max(45 * k, stubY + 3 * k + fit.size * 0.75);
    stubY = drawFit(ops, fit, sx, first, { font: look.bodyFont, size: fit.size, color: look.accent, align: 'center', caps: true, tracking: 0.18, lead: 1.25 }) + fit.size * 0.3;
  }
  const footY = h - SAFE_PT - 1.5; // "Scan at the door", on the safe line
  const door = fitWords('Scan at the door', { font: look.bodyFont, size: Math.max(PRINT_MIN_BODY_PT, 4.8 * k), maxWidth: stubInner, floor: PRINT_MIN_BODY_PT, caps: true, tracking: 0.22, minTracking: 0.04 });
  // Too wide even closed up (a calling card's stub is 62 pt): two lines, the last on the safe line.
  const doorFit = door.lines[0]?.endsWith('…') ? fitWords('Scan at the door', { font: look.bodyFont, size: Math.max(PRINT_MIN_BODY_PT, 4.8 * k), maxWidth: stubInner, floor: PRINT_MIN_BODY_PT, maxLines: 2, caps: true, tracking: 0.12 }) : door;
  const doorLead = doorFit.size * 1.2;
  const doorFirst = footY - (doorFit.lines.length - 1) * doorLead;
  const doorTop = doorFirst - doorFit.size * 0.75;
  const platePad = 3 * k;
  // The code: as large as the stub allows, never over the words above it nor the door line below.
  const q = Math.max(0, Math.min(50 * k, stubInner - 6 * k, doorTop - 3 * k - platePad - (stubY + 3 * k + platePad)));
  const qy = doorTop - 3 * k - platePad - q;
  if (pass.qrRef) {
    qrPlate(ops, data.qrShape, sx - q / 2, qy, q, platePad);
    ops.push({ t: 'image', ref: pass.qrRef, x: sx - q / 2, y: qy, w: q, h: q });
  }
  doorFit.lines.forEach((l, i) => text(ops, l, sx, doorFirst + i * doorLead, { font: look.bodyFont, size: doorFit.size, color: look.muted, align: 'center', caps: true, tracking: doorFit === door ? (door.tracking ?? 0.22) : 0.12 }));
  return settlePassInk(doc, look);
}

/**
 * THE PASS CARD — 3 : 4 portrait, the picture a guest saves to Photos and the
 * `phone-card` print format, ONE composition per look (owner 2026-09-29; the
 * three looks are `Setnayan/prototypes/pass_card_designs_2026-09-29.html`,
 * approved "event pass for digital downloads approved"):
 *
 *   A · classic — couple and date on top, the guest's name above a large code,
 *                 Table · Arrive in one row beneath;
 *   B · ticket  — a portrait ticket: whose day and who this is for above a
 *                 perforation (real notches in the die), the code with Table
 *                 and Arrive on the tear-off stub;
 *   C · poster  — the couple's cover photo (or the theme's colour band) across
 *                 the top third with the name over it, the code in a white
 *                 rounded tile with Table and Arrive inside it.
 *
 * THE FACTS AND THEIR OMIT RULE ARE THE PROTOTYPE'S: couple mark · couple ·
 * "<Event> · <date>" · the guest's name, biggest · "and 1 guest" only for a
 * NAMED, confirmed companion · Table and Arrive only when they exist (never
 * "Table TBA") · the code, always black on white · "Scans once at the door" ·
 * a small Setnayan mark on free events only.
 *
 * Drawn in the prototype's own units (a 360 × 480 card) scaled by `u`, so the
 * picture and the paper are one drawing at any size.
 */
/** One line that FITS: set at the size that meets `maxWidth`, rather than the
 *  0.55 floor `text` stops shrinking at (a long couple in caps ran past the
 *  safe line — every-print-fits.test.ts). */
function fitLine(ops: PrintOp[], raw: string, x: number, y: number, o: TextOpts): number {
  if (o.maxWidth) {
    let t = printableText(raw);
    if (o.caps) t = t.toUpperCase();
    const width = measure(t, o.font, o.size, (o.tracking ?? 0) * o.size);
    if (width > o.maxWidth) o = { ...o, size: o.size * (o.maxWidth / width) * 0.995 };
  }
  return text(ops, raw, x, y, o);
}

/**
 * 📏 A LINE THAT MAY NOT FIT, SET THE ONE WAY (owner 2026-10-16, on the Event
 * pass: *"make sure nothing overlaps, make everything legible"*). Measured
 * before, a guest's name on a calling card's stub was squeezed by `text`'s
 * 0.55 floor to 5.8 pt and then drawn ANYWAY — wider than the stub, across the
 * tear line and off the card; a 22-letter name already did it.
 *
 * In order, and never past the `floor`:
 *   1. one line at the asked size;
 *   2. one line SHRUNK to fit, down to `wrapBelow` (a hero name wraps long
 *      before it is shrunk to the floor — the slot's own judgement, never
 *      below `floor`);
 *   3. up to `maxLines` lines — balanced, at the largest size from `wrapBelow`
 *      down to the floor at which every line fits;
 *   4. at the floor, the last line ends in "…" — a name is never cut silently
 *      and never runs into its neighbour.
 * The words are measured exactly as `text` will draw them (printable, caps,
 * tracking), so a line this returns never needs `text`'s own shrink.
 */
export type FitSpec = { font: PrintFontKey; size: number; maxWidth: number; floor: number; wrapBelow?: number; maxLines?: number; caps?: boolean; tracking?: number; minTracking?: number };
export type Fitted = { lines: string[]; size: number; tracking?: number };
export function fitWords(raw: string, f: FitSpec): Fitted {
  // 1b. a spaced-caps label (SCAN AT THE DOOR) closes its letter-spacing before it wraps or is cut.
  if (f.minTracking !== undefined && (f.tracking ?? 0) > f.minTracking) {
    const first = fitWordsAt(raw, { ...f, maxLines: 1 });
    if (first.lines.length === 1 && !first.lines[0]!.endsWith('…')) return first;
    for (let t = f.tracking ?? 0; t >= f.minTracking - 1e-9; t = Math.round((t - 0.02) * 100) / 100) {
      const at = fitWordsAt(raw, { ...f, tracking: t, maxLines: 1 });
      if (at.lines.length === 1 && !at.lines[0]!.endsWith('…')) return { ...at, tracking: t };
    }
    return { ...fitWordsAt(raw, { ...f, tracking: f.minTracking }), tracking: f.minTracking };
  }
  return fitWordsAt(raw, f);
}
function fitWordsAt(raw: string, f: FitSpec): Fitted {
  const prep = (s: string) => (f.caps ? s.toUpperCase() : s);
  const s = printableText(raw).replace(/\s+/g, ' ').trim();
  if (!s) return { lines: [], size: f.size };
  const room = f.maxWidth * 0.999;
  const w = (t: string, size: number) => measure(prep(t), f.font, size, (f.tracking ?? 0) * size);
  const top = f.size;
  const floor = Math.min(f.floor, top);
  const wrapBelow = Math.max(floor, Math.min(top, f.wrapBelow ?? floor));
  const maxLines = Math.max(1, f.maxLines ?? 1);
  const full = w(s, top);
  if (full <= room) return { lines: [s], size: top };
  // Tracking scales with the size, so the width is linear in it.
  const one = top * (room / full);
  if (one >= wrapBelow) return { lines: [s], size: one };
  const words = s.split(' ');
  /** The fewest, most even lines at `size`, or null if a word alone is too wide. */
  const balanced = (size: number, n: number): string[] | null => {
    if (n === 1) return w(s, size) <= room ? [s] : null;
    if (n === 2) {
      let best: string[] | null = null;
      let bestW = Infinity;
      for (let i = 1; i < words.length; i += 1) {
        const a = words.slice(0, i).join(' ');
        const b = words.slice(i).join(' ');
        const m = Math.max(w(a, size), w(b, size));
        if (m <= room && m < bestW) {
          best = [a, b];
          bestW = m;
        }
      }
      return best;
    }
    const lines = wrap(s, f.font, size, room / (1 + (f.tracking ?? 0)));
    return lines.length <= n && lines.every((l) => w(l, size) <= room) ? lines : null;
  };
  if (maxLines > 1) {
    for (let size = wrapBelow; size >= floor - 1e-9; size = Math.round((size - 0.1) * 100) / 100) {
      for (let n = 2; n <= maxLines; n += 1) {
        const lines = balanced(size, n);
        if (lines) return { lines, size };
      }
    }
  }
  // At the floor: as many words as fit on each line, the last one ending in "…".
  const size = floor;
  const lines: string[] = [];
  let rest = [...words];
  while (rest.length && lines.length < maxLines) {
    const last = lines.length === maxLines - 1;
    let n = 0;
    while (n < rest.length && w(rest.slice(0, n + 1).join(' '), size) <= room) n += 1;
    if (last || n === 0) {
      lines.push(ellipsize(rest.join(' '), (t) => w(t, size) <= room));
      rest = [];
    } else {
      lines.push(rest.slice(0, n).join(' '));
      rest = rest.slice(n);
    }
  }
  return { lines, size };
}

/** The longest start of `s` that fits with "…" after it (cut back to a word end where one is near). */
function ellipsize(s: string, fits: (t: string) => boolean): string {
  if (fits(s)) return s;
  const chars = [...s];
  for (let n = chars.length - 1; n > 0; n -= 1) {
    const head = chars.slice(0, n).join('').replace(/[\s·,&–—-]+$/u, '');
    if (head && fits(`${head}…`)) return `${head}…`;
  }
  return '…';
}

/**
 * Where `fitWords` lines go: the first baseline at `y`, then `lead` × size
 * apart — or further, MEASURED: the next line starts below the ink of the one
 * above (a "J" that descends, an "Á" that rises), never on it.
 */
function fitBaselines(fit: Fitted, x: number, y: number, o: TextOpts & { lead?: number }): number[] {
  if (fit.tracking !== undefined) o = { ...o, tracking: fit.tracking };
  const step = fit.size * (o.lead ?? 1.18);
  const gap = Math.max(0.6, fit.size * 0.08);
  const out: number[] = [];
  let prevBottom = -Infinity;
  for (const line of fit.lines) {
    const { top, bottom } = lineInk(line, { ...o, size: fit.size }); // ink above (negative) / below the baseline
    let base = out.length ? out[out.length - 1]! + step : y;
    if (out.length && base + top < prevBottom + gap) base = prevBottom + gap - top;
    out.push(base);
    prevBottom = base + bottom;
  }
  return out;
}

/** A line's ink above (negative) and below its baseline, measured from its outline (kept: the same line is asked many times). */
const inkCache = new Map<string, { top: number; bottom: number }>();
function lineInk(line: string, o: TextOpts): { top: number; bottom: number } {
  const key = `${o.font}|${o.size}|${o.caps ? 1 : 0}|${o.tracking ?? 0}|${o.maxWidth ?? 0}|${line}`;
  const hit = inkCache.get(key);
  if (hit) return hit;
  const scratch: PrintOp[] = [];
  text(scratch, line, 0, 0, o);
  const first = scratch[0];
  const box = first && first.t === 'path' ? first.text?.box : undefined;
  const out = box ? { top: box.y, bottom: box.y + box.h } : { top: -o.size * 0.8, bottom: o.size * 0.2 };
  if (inkCache.size > 5000) inkCache.clear();
  inkCache.set(key, out);
  return out;
}

/** Draw `fitWords` lines (`fitBaselines`). Returns the last baseline. */
function drawFit(ops: PrintOp[], fit: Fitted, x: number, y: number, o: TextOpts & { lead?: number }): number {
  if (fit.tracking !== undefined) o = { ...o, tracking: fit.tracking };
  const bases = fitBaselines(fit, x, y, o);
  fit.lines.forEach((line, i) => text(ops, line, x, bases[i]!, { ...o, size: fit.size }));
  return bases.length ? bases[bases.length - 1]! : y;
}

/**
 * 🎨 EVERY LINE OF A PASS READS ON WHAT IS UNDER IT (owner 2026-10-16, "make
 * everything legible"). Measured before: Classic's heading gold read 4.47 : 1
 * on its paper and its accent gold 2.55 : 1 ("and", the initials, the date
 * line); Modern's muted grey under the veil read below 4.5 : 1 on the light
 * end of its still. Run once at the end of a pass layout: each line keeps its
 * colour if it reads ≥ 4.5 : 1 (WCAG AA) on every ground under it
 * (`lib/print-ground.ts` — the photo at both of its extremes); else a
 * see-through line is made solid; else its colour is taken toward black or
 * white, the same hue, by the least step that reads. Nothing is moved.
 */
function settlePassInk(doc: PrintDoc, look: PrintLook): PrintDoc {
  doc.ops.forEach((o, i) => {
    if (o.t !== 'path' || !o.text || !o.fill || o.layer === 'white') return;
    const box = o.text.box ?? inkBox(o.d);
    if (!box) return;
    const grounds = samplePoints(box).flatMap(([x, y]) => groundsAt(doc.ops, look.theme, i, x, y));
    if (worstContrast(hexRgb(o.fill), o.opacity ?? 1, grounds) >= MIN_CONTRAST + 0.02) return;
    if (o.opacity !== undefined && worstContrast(hexRgb(o.fill), 1, grounds) >= MIN_CONTRAST + 0.02) {
      doc.ops[i] = { ...o, opacity: undefined };
      return;
    }
    const ink = legibleInk(o.fill, grounds);
    if (ink) doc.ops[i] = { ...o, fill: ink, opacity: undefined };
  });
  return doc;
}

/** The ink box of a glyph outline (`pathData` writes coordinate PAIRS only). */
function inkBox(d: string): { x: number; y: number; w: number; h: number } | null {
  return pathBounds(d);
}

type CardFacts = { label: string; value: string }[];

/**
 * 🎟 THE TABLE ON A TICKET — ON THE DAY. Owner, 2026-09-30, verbatim: *"their
 * digital Ticket will also update on the date of the event with the seat
 * number"* (it replaced the same day's *"no seat plan for the moment"*).
 *
 * The drawing is pure and draws what the pass carries. WHETHER it carries a
 * table is decided by the readers, on ONE rule — `ticketShowsTable` in
 * `lib/guests-may-see-seats.ts` (from 00:00 Manila on the event's date): the
 * Digital ticket's kit (`lib/pass-card.server.ts`) and the Printed ticket batch
 * (`loadGuestPasses`, lib/print-set.server.ts) fill `seat` only then.
 *
 * The facts a pass card prints, in order — Table and Arrive, each only when it exists.
 */
export function passCardFacts(pass: PrintPass): CardFacts {
  return guestPassFacts({
    displayName: pass.name,
    // Under a "TABLE" label the value is the table's own name ("7", "VIP").
    tableLabel: pass.seat ? pass.seat.replace(/^Table\s+/i, '') : null,
    arriveLabel: pass.arrive ?? null,
  }).filter((f) => f.label === 'Table' || f.label === 'Arrive');
}

/** "and 1 guest" / "and 3 guests" — only for companions who are NAMED and coming. */
export function partyLine(n: number | null | undefined): string | null {
  return n && n > 0 ? `and ${n} ${n === 1 ? 'guest' : 'guests'}` : null;
}

/** "Wedding · Friday, December 18, 2026" (the event's own word, the long date). */
function cardWhen(data: PrintSetData, withWord: boolean): string | null {
  const date = data.dateLabel ? data.dateLabel.replace(' · ', ', ') : null;
  const fromEyebrow = /^the (.+) of$/i.exec(data.eyebrow.trim())?.[1] ?? null;
  const word = data.eventWord ?? (fromEyebrow ? fromEyebrow.charAt(0).toUpperCase() + fromEyebrow.slice(1) : null);
  if (!withWord) return date;
  return [word, date].filter(Boolean).join(' · ') || null;
}

/**
 * ⭕ HOW BIG A ROUND CODE IS DRAWN on each Digital ticket design, in the card's
 * 360-unit width. A round code's box also holds its filler ring, so at the
 * square code's size its modules are ~1.4× smaller; on a ticket shown 300 px
 * wide at 1× (the guest's Me) the Photo-poster code measured ~1.9 px a module
 * and did not decode, while 2× did (controller, 2026-09-30). These are the
 * sizes each design has room for; `a-round-code-sits-in-a-round-slot.test.ts`
 * decodes every design at 300 px wide.
 */
export const ROUND_CODE_ROOM = { classic: 210, ticket: 210, poster: 200 } as const;

/**
 * The code on its white tile — ALWAYS black on white, whatever the theme (it
 * must scan). The rounded tile is two rects and four corner discs, not a
 * path: a filled PATH next to a code is what the fit guard reads as ink
 * touching it (`every-print-fits.test.ts`); a plate is not ink.
 *
 * A ROUND code sits on a round plate instead (`qrPlate`) — never the rounded
 * square — and the tile's `extraH` (the Poster's facts) is not drawn: the
 * caller sets those facts on the card's own paper.
 */
function codeTile(ops: PrintOp[], pass: PrintPass, x: number, y: number, size: number, pad: number, radius: number, extraH = 0, shape?: QrShape) {
  if (shape === 'circle') {
    qrPlate(ops, shape, x + pad, y + pad, size, pad);
    if (pass.qrRef) ops.push({ t: 'image', ref: pass.qrRef, x: x + pad, y: y + pad, w: size, h: size });
    return;
  }
  const w = size + pad * 2;
  const h = size + pad * 2 + extraH;
  const r = Math.min(radius, w / 2, h / 2);
  ops.push({ t: 'rect', x: x + r, y, w: w - r * 2, h, fill: '#ffffff' });
  ops.push({ t: 'rect', x, y: y + r, w, h: h - r * 2, fill: '#ffffff' });
  for (const [cx, cy] of [[x + r, y + r], [x + w - r, y + r], [x + r, y + h - r], [x + w - r, y + h - r]] as const) {
    ops.push({ t: 'circle', cx, cy, r, fill: '#ffffff' });
  }
  if (pass.qrRef) ops.push({ t: 'image', ref: pass.qrRef, x: x + pad, y: y + pad, w: size, h: size });
}

/** The couple's mark in a ring — their logo, else their initials ("IC"). */
function cardMark(ops: PrintOp[], look: PrintLook, data: PrintSetData, cx: number, cy: number, r: number, onPhoto: boolean) {
  if (data.monogram) {
    drawMark(ops, look, data.monogram, cx, cy, r * 0.78);
    return;
  }
  const ring = onPhoto ? '#ffffff' : look.accent;
  ops.push({ t: 'circle', cx, cy, r, stroke: ring, sw: Math.max(0.5, r / 16), opacity: onPhoto ? 0.8 : 1 });
  const initials = data.initials.replace(/\s*&\s*/g, '');
  fitLine(ops, initials, cx, cy + r * 0.3, { font: look.headFont, size: r * 0.8, color: onPhoto ? '#ffffff' : look.accent, align: 'center', caps: true, tracking: 0.06, maxWidth: r * 1.6 });
}

/**
 * "SCANS ONCE AT THE DOOR" · and, on a free event, "● SETNAYAN". On paper, "As of <date>" above it.
 * Returns the TOP of the ink it drew, so the card's content stops above it
 * (before, "As of" was set 13 units over the door line, ON the DATE · ARRIVE row).
 */
function cardFoot(ops: PrintOp[], look: PrintLook, data: PrintSetData, u: number, x0: number, x1: number, y: number, mode: PrintMode, door = 'Scans once at the door'): number {
  const o = { font: look.bodyFont, size: Math.max(PRINT_MIN_BODY_PT, 9.5 * u), color: look.muted, caps: true, tracking: 0.16 } as const;
  const gap = Math.max(1.2, 3 * u);
  if (data.details.brandLine) {
    // 🏷 The printed card's Setnayan line — the lowest line of the foot; the door line stands above it.
    const bo = { ...brandLineOpts(PRINT_MIN_BODY_PT, contrast(PRINT_BRAND_GREY, look.paper) >= MIN_CONTRAST ? PRINT_BRAND_GREY : look.muted), align: 'center' as const, maxWidth: x1 - x0 };
    const drawn: PrintOp[] = [];
    text(drawn, PRINT_BRAND_WORDS, (x0 + x1) / 2, y, bo);
    for (const d of drawn) ops.push(d.t === 'path' ? { ...d, brand: 'line' } : d);
    y = y + lineInk(PRINT_BRAND_WORDS, bo).top - Math.max(2.5, gap);
  }
  let top = y;
  if (data.details.setnayanMark) {
    const markO = { ...o, tracking: 0.2 };
    const markW = measure('SETNAYAN', o.font, o.size, 0.2 * o.size);
    const room = x1 - x0 - markW - 8 * u - 10 * u;
    const fit = fitWords(door, { font: o.font, size: o.size, maxWidth: room, floor: PRINT_MIN_BODY_PT, caps: true, tracking: 0.16, minTracking: 0.04 });
    const line = fit.lines[0] ?? '';
    text(ops, line, x0, y, { ...o, size: fit.size, align: 'left', tracking: fit.tracking ?? 0.16 });
    const w = text(ops, 'Setnayan', x1, y, { ...markO, align: 'right' });
    ops.push({ t: 'circle', cx: x1 - w - 5 * u, cy: y - 3.2 * u, r: 3 * u, fill: look.accent });
    top = Math.min(y + lineInk(line, { ...o, size: fit.size }).top, y + lineInk('SETNAYAN', markO).top, y - 6.2 * u);
  } else {
    const fit = fitWords(door, { font: o.font, size: o.size, maxWidth: x1 - x0, floor: PRINT_MIN_BODY_PT, caps: true, tracking: 0.16, minTracking: 0.04 });
    const line = fit.lines[0] ?? '';
    text(ops, line, (x0 + x1) / 2, y, { ...o, size: fit.size, align: 'center', tracking: fit.tracking ?? 0.16 });
    top = y + lineInk(line, { ...o, size: fit.size }).top;
  }
  if (mode === 'print' && data.asOf) {
    const aO = { font: look.bodyFont, size: Math.max(PRINT_MIN_BODY_PT, 7 * u), color: look.muted, align: 'center' as const, opacity: 0.8 };
    const fit = fitWords(data.asOf, { font: aO.font, size: aO.size, maxWidth: x1 - x0, floor: PRINT_MIN_BODY_PT });
    const line = fit.lines[0] ?? '';
    const ink = lineInk(line, { ...aO, size: fit.size });
    const ay = top - gap - ink.bottom;
    text(ops, line, (x0 + x1) / 2, ay, { ...aO, size: fit.size });
    top = ay + ink.top;
  }
  return top;
}

/**
 * Label over value, centred on `cx` — the value fitted (shrunk, then two
 * lines, then "…", never under 6 pt; a long table name measured 3.4 pt
 * before). Returns the bottom of its ink.
 */
function cardFact(ops: PrintOp[], look: PrintLook, f: { label: string; value: string }, cx: number, y: number, u: number, size: number, maxWidth: number, ink = look.ink, muted = look.muted): number {
  const lO = { font: look.bodyFont, size: Math.max(PRINT_MIN_BODY_PT, 9.5 * u), color: muted, align: 'center' as const, caps: true, tracking: 0.18 };
  const lfit = fitWords(f.label, { font: lO.font, size: lO.size, maxWidth, floor: PRINT_MIN_BODY_PT, caps: true, tracking: 0.18 });
  text(ops, lfit.lines[0] ?? '', cx, y, { ...lO, size: lfit.size });
  const vO = { font: look.headFont, size: size * u, color: ink, align: 'center' as const };
  const vfit = fitWords(f.value, { font: vO.font, size: vO.size, maxWidth, floor: PRINT_MIN_BODY_PT, wrapBelow: Math.max(8, vO.size * 0.7), maxLines: 2 });
  const labelBottom = y + lineInk(lfit.lines[0] ?? '', { ...lO, size: lfit.size }).bottom;
  const first = Math.max(y + (size + 3) * u - (vO.size - vfit.size) * 0.3, labelBottom + Math.max(1, 2 * u) - lineInk(vfit.lines[0] ?? '', { ...vO, size: vfit.size }).top);
  const last = drawFit(ops, vfit, cx, first, { ...vO, size: vfit.size, lead: 1.1 });
  return last + lineInk(vfit.lines[vfit.lines.length - 1] ?? '', { ...vO, size: vfit.size }).bottom;
}

function cardSheet(ctx: Ctx, fmt: PrintFormat): { doc: PrintDoc; u: number } {
  const doc = sheet('pass', ctx, { w: fmt.wMm * PT_PER_MM, h: fmt.hMm * PT_PER_MM });
  return { doc, u: doc.w / 360 };
}

/**
 * 🎟 A · CLASSIC IS THE FABLE TICKET (owner 2026-09-30, DECISION_LOG "APPROVED —
 * THE FABLE DESIGNS FOR THE GUEST CARD, THE GUEST LIST ROWS AND THE GUEST
 * LANDING PAGE"; `prototypes/guest_landing_page_2026-09-30_fable.html`, the
 * 3 : 4 ticket "identical everywhere"). Top to bottom, centred inside a fine
 * inner border: the couple's mark in a ring · the couple, in the heading face ·
 * a rule with the theme's ornament · the guest's name, biggest · "and 1 guest",
 * or ON THE DAY the seat as a pill ("Table 7 · Seat 3" — `ticketShowsTable`
 * decides upstream whether `seat` is filled) · the code in a round slot · a
 * foot row, DATE left and ARRIVE right. One drawing: the screen shows this PNG,
 * Save hands it over, and the phone-card print draws the same function.
 *
 * ⭕ The code keeps `ROUND_CODE_ROOM.classic` — the Fable proportions would
 * draw it smaller than decodes at 300 px (a-round-code-sits-in-a-round-slot).
 */
function layoutPassCardClassic(ctx: Ctx, pass: PrintPass, fmt: PrintFormat): PrintDoc {
  const { look, data } = ctx;
  const { doc, u } = cardSheet(ctx, fmt);
  const { ops, w, h } = doc;
  const X = (v: number) => v * u;
  // the fine inner border (the Fable ticket's gilt hairline) sits just inside
  // the safe line; everything else sits inside it
  const inset = SAFE_PT + 1;
  const pad = inset + Math.max(X(12), 4);
  const foil: PrintLayer | undefined = ctx.foil ? 'foil' : undefined;
  const inner = w - pad * 2;
  const frameW = Math.max(0.4, X(1));

  ops.push({ t: 'path', d: roundRectPath(inset, inset, w - inset * 2, h - inset * 2, X(17)), stroke: look.accent, sw: frameW, opacity: 0.35 });

  // head — the mark in its ring, the couple, the ornament rule
  cardMark(ops, look, data, w / 2, pad + X(20), X(20), false);
  const couple = data.names.second ? `${data.names.first} & ${data.names.second}` : data.names.first;
  const coupleO = { font: look.scriptFont ?? look.headFont, size: X(22), color: look.heading, align: 'center' as const, caps: look.capsNames, tracking: 0.03, layer: foil };
  const coupleFit = fitWords(couple, { font: coupleO.font, size: coupleO.size, maxWidth: inner, floor: 8, wrapBelow: X(22) * 0.7, maxLines: 2, caps: look.capsNames, tracking: 0.03 });
  // A couple too long for one line takes two, and the card below moves down by the second.
  const coupleLast = drawFit(ops, coupleFit, w / 2, pad + X(64), { ...coupleO, size: coupleFit.size, lead: 1.1 });
  const coupleBottom = coupleLast + lineInk(coupleFit.lines[coupleFit.lines.length - 1] ?? '', { ...coupleO, size: coupleFit.size }).bottom;
  const ruleY = Math.max(pad + X(76), coupleBottom + X(6));
  const gapHalf = X(10);
  ops.push({ t: 'rect', x: pad, y: ruleY, w: w / 2 - gapHalf - pad, h: Math.max(0.4, X(1)), fill: look.accent, opacity: 0.35 });
  ops.push({ t: 'rect', x: w / 2 + gapHalf, y: ruleY, w: w / 2 - gapHalf - pad, h: Math.max(0.4, X(1)), fill: look.accent, opacity: 0.35 });
  const dm = X(4);
  ops.push({ t: 'path', d: `M${f2(w / 2)} ${f2(ruleY - dm)}L${f2(w / 2 + dm)} ${f2(ruleY + X(0.5))}L${f2(w / 2)} ${f2(ruleY + dm + X(1))}L${f2(w / 2 - dm)} ${f2(ruleY + X(0.5))}Z`, fill: look.accent });
  const diamondFoot = ruleY + dm + X(1);

  // the guest, then "and 1 guest" — or on the day, the seat as a pill.
  // The name's ink stays CLEAR of the diamond (coordinator 2026-10-16: "make
  // sure the name's ascenders and any 2-line name never touch it") — measured
  // from the name's own outline, so an Á or an Ñ is held off it too.
  const nameO = { font: look.headFont, size: X(28), color: look.heading, align: 'center' as const };
  const nameFit = fitWords(pass.name, { font: nameO.font, size: nameO.size, maxWidth: inner, floor: 8, wrapBelow: X(28) * 0.6, maxLines: 2 });
  const nameTop = lineInk(nameFit.lines[0] ?? '', { ...nameO, size: nameFit.size }).top;
  const nameY = Math.max(ruleY + X(30), diamondFoot + X(5) - nameTop);
  const nameLast = drawFit(ops, nameFit, w / 2, nameY, { ...nameO, size: nameFit.size, lead: 1.08 });
  let y = nameLast + X(20);
  const party = pass.pending ? null : partyLine(pass.party);
  const seat = pass.pending || !pass.seat ? null : [pass.seat, pass.seatNumber ? `Seat ${pass.seatNumber}` : null].filter(Boolean).join(' · ');
  if (seat) {
    const size = X(11);
    const sO = { font: look.bodyFont, size, color: look.heading, align: 'center' as const, caps: true, tracking: 0.16 };
    const fit = fitWords(seat, { font: sO.font, size, maxWidth: inner - X(24), floor: PRINT_MIN_BODY_PT, maxLines: 2, caps: true, tracking: 0.16 });
    const bases = fitBaselines(fit, w / 2, y, { ...sO, size: fit.size, lead: 1.25 });
    const widest = Math.max(...fit.lines.map((l) => measure(printableText(l).toUpperCase(), sO.font, fit.size, 0.16 * fit.size)));
    const sw = Math.min(inner, widest + X(24));
    const ph = X(20) + (bases[bases.length - 1]! - bases[0]!);
    ops.push({ t: 'path', d: roundRectPath(w / 2 - sw / 2, y - X(20) + X(6), sw, ph, Math.min(X(10), ph / 2)), fill: look.accent, opacity: 0.14 });
    drawFit(ops, fit, w / 2, y, { ...sO, size: fit.size, lead: 1.25 });
    // the pill's foot — what the code's slot must clear
    y = bases[bases.length - 1]! + X(6);
  } else if (party) {
    fitLine(ops, party, w / 2, y, { font: look.bodyFont, size: X(11), color: look.muted, align: 'center', caps: true, tracking: 0.2, maxWidth: inner });
  }

  // foot — the door line (and the small Setnayan mark on a free event), INSIDE
  // the frame: it printed ON the frame's bottom stroke before (owner's phone
  // card, 2026-10-16 — "a text overlaps on lines"; the frame sits at
  // h − inset and the line's baseline sat 0.4 pt above it).
  const footY = h - inset - frameW - X(12);
  const footTop = cardFoot(ops, look, data, u, pad, w - pad, footY, ctx.mode, pass.pending ? 'Not valid at the door yet' : undefined);

  // the DATE · ARRIVE row above it — a pending request's band takes its place
  const facts = pass.pending ? [{ label: '', value: '' }] : cardFootFacts(data, pass);
  const metaTop = footTop - X(9) - X(34);
  // the code in its slot, centred between the name block and the foot row
  const round = data.qrShape === 'circle';
  const tile = X(round ? ROUND_CODE_ROOM.classic : 176);
  const tilePad = X(10);
  // A round code's slot ring reaches X(6) beyond its tile on every side — kept clear of the seat pill and the foot row.
  const ringOut = round ? X(6) + Math.max(0.4, X(1)) : 0;
  const slotTop = y + X(6) + ringOut;
  const slotFoot = metaTop - X(6) - ringOut;
  const size = Math.min(tile, slotFoot - slotTop - tilePad * 2);
  const codeY = slotTop + Math.max(0, (slotFoot - slotTop - size - tilePad * 2) / 2);
  if (round) {
    // the round slot — a soft well of the paper colour, with a fine ring
    ops.push({ t: 'circle', cx: w / 2, cy: codeY + tilePad + size / 2, r: size / 2 + tilePad + X(6), fill: look.ink, opacity: 0.05 });
    ops.push({ t: 'circle', cx: w / 2, cy: codeY + tilePad + size / 2, r: size / 2 + tilePad + X(6), stroke: look.accent, sw: Math.max(0.4, X(1)), opacity: 0.45 });
  }
  codeTile(ops, pass, w / 2 - size / 2 - tilePad, codeY, size, tilePad, X(16), 0, data.qrShape);

  if (pass.pending) {
    // The dashed band (frame B) — "REQUEST PENDING" over "waiting for <couple>".
    const bw = inner - X(20);
    const by = metaTop + X(2);
    ops.push({ t: 'rect', x: (w - bw) / 2, y: by - X(4), w: bw, h: X(38), stroke: look.accent, sw: Math.max(0.5, X(1.2)), dash: true });
    fitLine(ops, 'Request pending', w / 2, by + X(13), { font: look.headFont, size: X(16), color: look.heading, align: 'center', caps: true, tracking: 0.12, maxWidth: bw - X(16) });
    const wait = fitWords(pass.pending, { font: look.bodyFont, size: X(11), maxWidth: bw - X(16), floor: PRINT_MIN_BODY_PT });
    text(ops, wait.lines[0] ?? '', w / 2, by + X(27), { font: look.bodyFont, size: wait.size, color: look.muted, align: 'center' });
  } else if (facts.length) {
    ops.push({ t: 'rect', x: pad, y: metaTop, w: inner, h: Math.max(0.4, X(1)), fill: look.ink, opacity: 0.12 });
    facts.forEach((f, i) => {
      const right = i === 1 || (facts.length === 1 && f.label === 'Arrive');
      const x = right ? w - pad : pad;
      const align = right ? 'right' : 'left';
      fitLine(ops, f.label, x, metaTop + X(15), { font: look.bodyFont, size: Math.max(PRINT_MIN_BODY_PT, X(9.5)), color: look.accent, align, caps: true, tracking: 0.22 });
      const v = fitWords(f.value, { font: look.headFont, size: X(19), maxWidth: inner / 2 - X(6), floor: PRINT_MIN_BODY_PT });
      text(ops, v.lines[0] ?? '', x, metaTop + X(34), { font: look.headFont, size: v.size, color: look.heading, align });
    });
  }
  return settlePassInk(doc, look);
}

/** The Fable ticket's foot row: DATE (the day, without the weekday) and ARRIVE — each only when it exists. */
function cardFootFacts(data: PrintSetData, pass: PrintPass): CardFacts {
  const date = data.dateLabel ? (data.dateLabel.split(' · ').pop() ?? '').trim() : '';
  return [
    date ? { label: 'Date', value: date } : null,
    pass.arrive ? { label: 'Arrive', value: pass.arrive } : null,
  ].filter((f): f is { label: string; value: string } => f !== null);
}

/** A rounded rectangle as a path (the ticket's inner border, the seat pill). */
function roundRectPath(x: number, y: number, w: number, h: number, r: number): string {
  // Every command carries an x AND a y (no H / V) — the fit checks read a path's box as pairs.
  const k = 0.5523 * r;
  const [x1, y1] = [x + w, y + h];
  return (
    `M${f2(x + r)} ${f2(y)}L${f2(x1 - r)} ${f2(y)}C${f2(x1 - r + k)} ${f2(y)} ${f2(x1)} ${f2(y + r - k)} ${f2(x1)} ${f2(y + r)}` +
    `L${f2(x1)} ${f2(y1 - r)}C${f2(x1)} ${f2(y1 - r + k)} ${f2(x1 - r + k)} ${f2(y1)} ${f2(x1 - r)} ${f2(y1)}` +
    `L${f2(x + r)} ${f2(y1)}C${f2(x + r - k)} ${f2(y1)} ${f2(x)} ${f2(y1 - r + k)} ${f2(x)} ${f2(y1 - r)}` +
    `L${f2(x)} ${f2(y + r)}C${f2(x)} ${f2(y + r - k)} ${f2(x + r - k)} ${f2(y)} ${f2(x + r)} ${f2(y)}Z`
  );
}

/** The ticket's outline: rounded corners and a half-circle notch in each side at the perforation. */
function ticketDie(w: number, h: number, r: number, perfY: number, notch: number): string {
  const k = 0.5523 * r;
  return (
    `M${f2(r)} 0H${f2(w - r)}C${f2(w - r + k)} 0 ${f2(w)} ${f2(r - k)} ${f2(w)} ${f2(r)}` +
    `V${f2(perfY - notch)}A${f2(notch)} ${f2(notch)} 0 0 0 ${f2(w)} ${f2(perfY + notch)}` +
    `V${f2(h - r)}C${f2(w)} ${f2(h - r + k)} ${f2(w - r + k)} ${f2(h)} ${f2(w - r)} ${f2(h)}` +
    `H${f2(r)}C${f2(r - k)} ${f2(h)} 0 ${f2(h - r + k)} 0 ${f2(h - r)}` +
    `V${f2(perfY + notch)}A${f2(notch)} ${f2(notch)} 0 0 0 0 ${f2(perfY - notch)}` +
    `V${f2(r)}C0 ${f2(r - k)} ${f2(r - k)} 0 ${f2(r)} 0Z`
  );
}

function layoutPassCardTicket(ctx: Ctx, pass: PrintPass, fmt: PrintFormat): PrintDoc {
  const { look, data } = ctx;
  const { doc, u } = cardSheet(ctx, fmt);
  const { ops, w, h } = doc;
  const X = (v: number) => v * u;
  const pad = Math.max(X(22), SAFE_PT + 2);
  // ⭕ A round code needs more of the stub (`ROUND_CODE_ROOM`), so its perforation sits higher.
  const perfY = X(data.qrShape === 'circle' ? 206 : 228);
  // The notches are part of the CUT (the die), so they are transparent in the
  // picture and cut on paper — a ticket even in Photos.
  doc.diePath = ticketDie(w, h, X(18), perfY, X(12));
  const foil: PrintLayer | undefined = ctx.foil ? 'foil' : undefined;
  const room = w - pad * 2;

  // top half — whose day, and who this is for
  cardMark(ops, look, data, pad + X(22), pad + X(22), X(22), false);
  const word = cardWhen(data, true)?.split(' · ')[0] ?? null;
  const kindO = { font: look.bodyFont, size: Math.max(PRINT_MIN_BODY_PT, X(9.5)), color: look.muted, align: 'right' as const, caps: true, tracking: 0.2 };
  if (word && word !== cardWhen(data, false)) fitLine(ops, word, w - pad, pad + X(16), kindO);
  fitLine(ops, PASS_CARD_WORDS.kind, w - pad, pad + X(30), kindO);
  const couple = data.names.second ? `${data.names.first} & ${data.names.second}` : data.names.first;
  const coupleO = { font: look.headFont, size: X(24), color: look.heading, align: 'left' as const, caps: look.capsNames, layer: foil };
  const coupleFit = fitWords(couple, { font: coupleO.font, size: coupleO.size, maxWidth: room, floor: 8, wrapBelow: X(24) * 0.62, maxLines: 2, caps: look.capsNames });
  const coupleLast = drawFit(ops, coupleFit, pad, pad + X(80), { ...coupleO, size: coupleFit.size, lead: 1.08 });
  const date = cardWhen(data, false);
  let topBottom = coupleLast + lineInk(coupleFit.lines[coupleFit.lines.length - 1] ?? '', { ...coupleO, size: coupleFit.size }).bottom;
  if (date) {
    const dO = { font: look.bodyFont, size: X(11), color: look.accent, align: 'left' as const, caps: true, tracking: 0.14 };
    const dFit = fitWords(date, { font: dO.font, size: dO.size, maxWidth: room, floor: PRINT_MIN_BODY_PT, caps: true, tracking: 0.14 });
    const dy = Math.max(pad + X(98), topBottom + X(4) - lineInk(dFit.lines[0] ?? '', { ...dO, size: dFit.size }).top);
    text(ops, dFit.lines[0] ?? '', pad, dy, { ...dO, size: dFit.size });
    topBottom = dy + X(3);
  }
  // The guest's name sits on the perforation's side: a two-line name grows UP,
  // its "GUEST" label above its first line — never over the date above it.
  const party = partyLine(pass.party);
  const nameY = perfY - X(16) - (party ? X(22) : X(4));
  const nameO = { font: look.headFont, size: X(34), color: look.heading, align: 'left' as const };
  // The largest name that stays below the couple and the date (a long couple
  // on two lines and a long name on two lines meet in the middle otherwise).
  const placeName = (sz: number) => {
    const fit = fitWords(pass.name, { font: nameO.font, size: sz, maxWidth: room, floor: Math.min(sz, 8), wrapBelow: sz * 0.6, maxLines: 2 });
    const b = fitBaselines(fit, pad, 0, { ...nameO, size: fit.size, lead: 1.06 });
    const first = nameY - b[b.length - 1]!;
    return { fit, first, top: first + lineInk(fit.lines[0] ?? '', { ...nameO, size: fit.size }).top };
  };
  let placed = placeName(nameO.size);
  // Room for the GUEST label between the date and the name — the name shrinks for it, and only at its floor is the label left off.
  const labelRoom = X(8) + Math.max(PRINT_MIN_BODY_PT, X(9.5)) * 0.75 + X(6);
  for (let sz = nameO.size; placed.top < topBottom + labelRoom && sz > 8; sz = Math.max(8, sz - 0.5)) placed = placeName(sz);
  const { fit: nameFit, first: firstName, top: nameTop } = placed;
  const labelO = { font: look.bodyFont, size: Math.max(PRINT_MIN_BODY_PT, X(9.5)), color: look.muted, align: 'left' as const, caps: true, tracking: 0.18 };
  const labelY = Math.min(nameY - X(34), nameTop - X(6));
  if (labelY + lineInk('GUEST', labelO).top >= topBottom + X(8) - 0.01) fitLine(ops, 'Guest', pad, labelY, labelO);
  drawFit(ops, nameFit, pad, firstName, { ...nameO, size: nameFit.size, lead: 1.06 });
  if (party) fitLine(ops, party, pad, nameY + X(20), { font: look.bodyFont, size: X(15), color: look.muted, align: 'left', maxWidth: room });

  // the perforation, and the stub's slightly deeper paper
  ops.push({ t: 'rect', x: -doc.bleed, y: perfY, w: w + doc.bleed * 2, h: h - perfY + doc.bleed, fill: look.ink, opacity: 0.035 });
  // The dashes stay inside the safe line; the notches are the cut itself.
  const perfIn = Math.max(X(14), SAFE_PT + 1);
  for (let x = perfIn; x + X(4) <= w - perfIn; x += X(8)) ops.push({ t: 'rect', x, y: perfY - X(1), w: X(4), h: Math.max(0.5, X(2)), fill: look.ink, opacity: 0.2 });

  // the stub — the code, with Table and Arrive set like a gate and a time
  const footY = h - Math.max(X(16), SAFE_PT) - X(2);
  const footTop = cardFoot(ops, look, data, u, pad, w - pad, footY, ctx.mode);
  const facts = passCardFacts(pass);
  // ⭕ A round code takes the whole stub (`ROUND_CODE_ROOM`), its facts in a narrower column beside
  // it, on a thinner white ring: the code's own light ring (CIRCLE_GAP) is its quiet zone.
  const round = data.qrShape === 'circle';
  const tilePad = X(round ? 5 : 10);
  const stubFoot = Math.min(footY - X(20), footTop - X(6));
  const size = round ? Math.min(X(ROUND_CODE_ROOM.ticket), stubFoot - perfY - X(18) - tilePad * 2) : Math.min(X(128), stubFoot - perfY - X(18) - tilePad * 2);
  const tileY = perfY + X(18) + Math.max(0, (stubFoot - perfY - X(18) - size - tilePad * 2) / 2);
  const tileX = facts.length ? pad : w / 2 - size / 2 - tilePad;
  codeTile(ops, pass, tileX, tileY, size, tilePad, X(16), 0, data.qrShape);
  if (facts.length) {
    const cx0 = tileX + size + tilePad * 2 + X(round ? 10 : 16);
    const colW = w - pad - cx0;
    const lO = { font: look.bodyFont, size: Math.max(PRINT_MIN_BODY_PT, X(9.5)), color: look.muted, align: 'left' as const, caps: true, tracking: 0.18 };
    const vO = { font: look.headFont, size: X(30), color: look.heading, align: 'left' as const };
    // Each fact measured — a long table name takes two lines — then the column is centred on the code.
    const blocks = facts.map((f) => {
      const v = fitWords(f.value, { font: vO.font, size: vO.size, maxWidth: colW, floor: PRINT_MIN_BODY_PT, wrapBelow: Math.max(8, X(30) * 0.6), maxLines: 2 });
      const lInk = lineInk(f.label.toUpperCase(), lO);
      const vTop = lineInk(v.lines[0] ?? '', { ...vO, size: v.size }).top;
      const vOff = Math.max(X(31) - (vO.size - v.size) * 0.4, lInk.bottom + X(4) - vTop);
      const vb = fitBaselines(v, cx0, vOff, { ...vO, size: v.size, lead: 1.06 });
      const bottom = vb[vb.length - 1]! + lineInk(v.lines[v.lines.length - 1] ?? '', { ...vO, size: v.size }).bottom;
      return { f, v, vOff, top: lInk.top, bottom };
    });
    const gap = X(14);
    const total = blocks.reduce((a, b) => a + (b.bottom - b.top), 0) + gap * (blocks.length - 1);
    let y = tileY + (size + tilePad * 2) / 2 - total / 2;
    for (const b of blocks) {
      const base = y - b.top;
      fitLine(ops, b.f.label, cx0, base, { ...lO, maxWidth: colW });
      drawFit(ops, b.v, cx0, base + b.vOff, { ...vO, size: b.v.size, lead: 1.06 });
      y = base + b.bottom + gap;
    }
  }
  return settlePassInk(doc, look);
}

function layoutPassCardPoster(ctx: Ctx, pass: PrintPass, fmt: PrintFormat): PrintDoc {
  const { look, data } = ctx;
  const { doc, u } = cardSheet(ctx, fmt);
  const { ops, w, h, bleed } = doc;
  const X = (v: number) => v * u;
  const pad = Math.max(X(22), SAFE_PT + 2);
  const bandH = X(196);
  const room = w - pad * 2;

  // the band — their cover photo, or the theme's own colour when there is none
  // Every strip runs from its own top to the band's FOOT, so the strips only
  // ever stack — no two edges meet, and no hairline seam shows between steps.
  const band = (fill: string, from: number, to: number, steps: number) => {
    const a = 1 - Math.pow(1 - to, 1 / steps);
    for (let i = 0; i < steps; i += 1) {
      const y = -bleed + ((bandH + bleed) * i) / steps;
      ops.push({ t: 'rect', x: -bleed, y, w: w + bleed * 2, h: bandH - y, fill, opacity: i === 0 ? Math.max(from, a) : a });
    }
  };
  if (data.hasStill) {
    ops.push({ t: 'image', ref: 'still', x: -bleed, y: -bleed, w: w + bleed * 2, h: bandH + bleed });
  } else {
    ops.push({ t: 'rect', x: -bleed, y: -bleed, w: w + bleed * 2, h: bandH + bleed, fill: look.accent });
    // The theme's accent, deepening toward the foot (the prototype's band).
    band('#140f0f', 0.12, 0.55, 28);
  }
  /**
   * The veil that keeps white type readable on any photo — at LEAST as deep
   * as white type needs to read 4.5 : 1 on the band's LIGHTEST ground (the
   * photo's light extreme, or the theme's accent), measured, not guessed.
   * Before, the veil began at 5 %: white names over Modern's light still, or
   * Classic's gold band, read 1.3–2.6 : 1.
   */
  const lightest = groundsAt(ops, look.theme, ops.length, w / 2, X(2)).reduce((a, g) => (lum(g) > lum(a) ? g : a));
  let floorVeil = 0;
  while (floorVeil < 0.9 && worstContrast(hexRgb('#ffffff'), 1, [over(hexRgb('#000000'), lightest, floorVeil)]) < MIN_CONTRAST + 0.1) floorVeil += 0.02;
  if (floorVeil > 0) ops.push({ t: 'rect', x: -bleed, y: -bleed, w: w + bleed * 2, h: bandH + bleed, fill: '#000000', opacity: Math.round(floorVeil * 100) / 100 });
  band('#000000', 0.05, 0.45, 20);
  const top = Math.max(X(18), SAFE_PT + 2);
  cardMark(ops, look, data, pad + X(17), top + X(17), X(17), true);
  const couple = data.names.second ? `${data.names.first} & ${data.names.second}` : data.names.first;
  const cO = { font: look.headFont, size: X(19), color: '#ffffff', align: 'left' as const, caps: look.capsNames };
  const cFit = fitWords(couple, { font: cO.font, size: cO.size, maxWidth: room - X(44), floor: 8, wrapBelow: X(19) * 0.65, maxLines: 2, caps: look.capsNames });
  const cBases = fitBaselines(cFit, pad + X(44), 0, { ...cO, size: cFit.size, lead: 1.08 });
  // one line sits level with the mark as before; two lines centre on it
  const cFirst = cFit.lines.length > 1 ? top + X(17) - cBases[cBases.length - 1]! / 2 + cFit.size * 0.33 : top + X(24);
  const cLast = drawFit(ops, cFit, pad + X(44), cFirst, { ...cO, size: cFit.size, lead: 1.08 });
  let headBottom = Math.max(top + X(34), cLast + lineInk(cFit.lines[cFit.lines.length - 1] ?? '', { ...cO, size: cFit.size }).bottom);
  const when = cardWhen(data, true);
  if (when) {
    const wO = { font: look.bodyFont, size: X(11), color: '#ffffff', opacity: 0.85, align: 'left' as const, caps: true, tracking: 0.14 };
    const wFit = fitWords(when, { font: wO.font, size: wO.size, maxWidth: room, floor: PRINT_MIN_BODY_PT, caps: true, tracking: 0.14 });
    const wy = Math.max(top + X(56), headBottom + X(6) - lineInk(wFit.lines[0] ?? '', { ...wO, size: wFit.size }).top);
    text(ops, wFit.lines[0] ?? '', pad, wy, { ...wO, size: wFit.size });
    headBottom = wy + X(3);
  }
  const party = partyLine(pass.party);
  const nameY = bandH - X(16) - (party ? X(22) : X(6));
  const nO = { font: look.headFont, size: X(36), color: '#ffffff', align: 'left' as const };
  // A two-line name grows UP the band, never into the couple and the date.
  const placeName = (sz: number) => {
    const fit = fitWords(pass.name, { font: nO.font, size: sz, maxWidth: room, floor: Math.min(sz, 8), wrapBelow: sz * 0.6, maxLines: 2 });
    const b = fitBaselines(fit, pad, 0, { ...nO, size: fit.size, lead: 1.06 });
    const first = nameY - b[b.length - 1]!;
    return { fit, first, top: first + lineInk(fit.lines[0] ?? '', { ...nO, size: fit.size }).top };
  };
  let placed = placeName(nO.size);
  for (let sz = nO.size; placed.top < headBottom + X(6) && sz > 8; sz = Math.max(8, sz - 0.5)) placed = placeName(sz);
  drawFit(ops, placed.fit, pad, placed.first, { ...nO, size: placed.fit.size, lead: 1.06 });
  if (party) fitLine(ops, party, pad, nameY + X(20), { font: look.bodyFont, size: X(15), color: '#ffffff', opacity: 0.85, align: 'left', maxWidth: room });

  // below — the code in a white rounded tile, Table and Arrive inside it
  const footY = h - Math.max(X(16), SAFE_PT) - X(2);
  const footTop = cardFoot(ops, look, data, u, pad, w - pad, footY, ctx.mode);
  const below = Math.min(footY - X(20), footTop - X(6));
  const facts = passCardFacts(pass);
  const tp = X(14);
  /** How tall a fact block draws (label + value, a long value on two lines). */
  const factH = (f: { label: string; value: string }, maxW: number) => cardFact([], look, f, 0, 0, u, 18, maxW) + X(9.5) * 0.75;
  if (data.qrShape === 'circle') {
    // ⭕ A round code has no tile to hold the facts, and needs more room than the tile
    // gave (`ROUND_CODE_ROOM`): the disc takes the whole height below the band, and
    // Table · Arrive stand beside it on the card's own paper, in its own ink.
    const colW = facts.length ? X(96) : 0;
    const space = below - bandH - X(18);
    const size = Math.min(X(ROUND_CODE_ROOM.poster), space - tp * 2, w - pad * 2 - tp * 2 - colW);
    const disc = size + tp * 2;
    const x0 = facts.length ? pad : w / 2 - disc / 2;
    const y0 = bandH + X(18) + Math.max(0, (space - disc) / 2);
    codeTile(ops, pass, x0, y0, size, tp, X(22), 0, 'circle');
    if (facts.length) {
      const cx = w - pad - colW / 2;
      const hs = facts.map((f) => factH(f, colW - X(4)));
      const gap = X(12);
      let y = y0 + disc / 2 - (hs.reduce((a, b) => a + b, 0) + gap * (hs.length - 1)) / 2 + X(9.5) * 0.75;
      facts.forEach((f, i) => {
        cardFact(ops, look, f, cx, y, u, 18, colW - X(4));
        y += hs[i]! + gap;
      });
    }
  } else {
    const tileW = Math.min(X(150) + tp * 2, room);
    const gap = facts.length ? Math.min(X(96), tileW / facts.length) : 0;
    // Table · Arrive start below the code's quiet zone (the tile's own `tp` of
    // white round the code), never inside it.
    const capH = Math.max(PRINT_MIN_BODY_PT, X(9.5)) * 0.75;
    const factsH = facts.length ? Math.max(...facts.map((f) => factH(f, gap - X(6)))) : 0;
    const factsGap = facts.length ? tp + X(3) : 0;
    const footPad = facts.length ? X(10) : tp;
    // The code shrinks (never the type) when the facts need two lines and the card has no more room.
    const size = Math.min(X(150), tileW - tp * 2, below - bandH - X(18) - (tp + factsGap + factsH + footPad));
    const tileH = tp + size + factsGap + factsH + footPad;
    const tileY = bandH + X(18) + Math.max(0, (below - bandH - X(18) - tileH) / 2);
    codeTile(ops, pass, w / 2 - (size + tp * 2) / 2, tileY, size, tp, X(22), tileH - (size + tp * 2), data.qrShape);
    if (facts.length) {
      const labelBase = tileY + tp + size + factsGap + capH;
      facts.forEach((f, i) => cardFact(ops, look, f, w / 2 + (i - (facts.length - 1) / 2) * gap, labelBase, u, 18, gap - X(6), '#2b241c', '#7a7368'));
    }
  }
  return settlePassInk(doc, look);
}

/** Every pass-card look, by key. The route, the zip and the print format all come through here. */
const PASS_CARD_LAYOUTS: Record<PassCardDesign, (ctx: Ctx, pass: PrintPass, fmt: PrintFormat) => PrintDoc> = {
  classic: layoutPassCardClassic,
  ticket: layoutPassCardTicket,
  poster: layoutPassCardPoster,
};

/**
 * The pass card for ONE guest, in a given look — the picture a guest saves.
 * The print format (`phone-card` in `layoutPasses`) draws the SAME function.
 */
export function layoutPassCard(input: LayoutInput, rawPass: PrintPass, design?: PassCardDesign): PrintDoc {
  const ctx: Ctx = { look: input.look, data: input.data, mode: input.mode, foil: input.foil };
  const pass = rawPass; // 🎟 the table only on the day — `ticketShowsTable`, decided by the reader
  const doc = PASS_CARD_LAYOUTS[design ?? input.data.details.passDesign ?? DEFAULT_PASS_CARD_DESIGN](ctx, pass, PRINT_FORMATS[PASS_CARD_FORMAT_ID]);
  return input.mode === 'print' && input.whiteInk ? underprintWhite(doc) : doc;
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
    qrPlate(ops, data.qrShape, gx - panelW / 2 + 18, py + 18, q, 2);
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
  if (data.hasEventQr) cornerQr(doc, data);
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
  if (data.hasEventQr) cornerQr(doc, data);
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
  /* 🖼 THE HUB'S PICTURE FILLS THE PAPER IT IS FITTED TO (`PrintLook.frame`, lib/print-hub-look.ts): a 3 : 4 card fitted to
     A5 would otherwise wear the picture on its top part and bare paper below. The picture and its panel are drawn again at
     the fitted size, and the ones laid at the design size are left out — the words are fitted as before. */
  const refit = Boolean(ctx.look.frame && ctx.data.hasStill && ctx.look.still === 'full');
  const drawnAtDesignSize = new Set<string>();
  if (refit) {
    const design: PrintOp[] = [];
    still(design, ctx.look, ctx.data, doc.w, doc.h, doc.bleed);
    for (const o of design) drawnAtDesignSize.add(JSON.stringify(o));
    still(ops, ctx.look, ctx.data, w, h, doc.bleed);
  }
  for (const o of doc.ops.slice(1)) {
    if (refit && drawnAtDesignSize.has(JSON.stringify(o))) continue;
    if (o.t === 'rect') ops.push({ ...o, x: o.x * s + ox, y: o.y * s + oy, w: o.w * s, h: o.h * s, sw: o.sw ? o.sw * s : o.sw });
    else if (o.t === 'image') ops.push({ ...o, x: o.x * s + ox, y: o.y * s + oy, w: o.w * s, h: o.h * s });
    // An NFC spot stays TRUE TO SIZE (25 mm) — a sticker does not scale with the card.
    else if (o.t === 'circle') ops.push({ ...o, cx: o.cx * s + ox, cy: o.cy * s + oy, r: o.nfc ? o.r : o.r * s, sw: o.sw ? o.sw * s : o.sw });
    else ops.push({ ...o, d: scalePath(o.d, s, ox, oy), sw: o.sw ? o.sw * s : o.sw });
  }
  return { ...doc, w, h, diePath: diePathFor(doc.die, w, h), ops };
}

/** The free do-it-yourself sheet: every guest's QR with their name, A4, 3 × 4. */
function layoutQrSheet(title: string, cells: Array<{ name: string; sub: string | null; qrRef: string }>, shape?: QrShape): PrintDoc[] {
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
      if (shape === 'circle') {
        // ⭕ A round code is cut out ROUND (`qrPlate`'s rule, on a cut line):
        // the dashed circle holds the code and the name beneath it.
        const cx = x + cw / 2;
        const cy = y + ch / 2;
        const r = Math.min(cw, ch) / 2 - 4;
        const q = r * 1.24;
        const qy = cy - r * 0.24 - q / 2;
        const chord = (yy: number) => Math.max(0, 2 * Math.sqrt(Math.max(0, r * r - (yy - cy) ** 2)) - 14);
        doc.ops.push({ t: 'circle', cx, cy, r, stroke: '#1a1a1a', sw: 0.4, opacity: 0.3, dash: true });
        doc.ops.push({ t: 'image', ref: c.qrRef, x: cx - q / 2, y: qy, w: q, h: q });
        text(doc.ops, c.name, cx, qy + q + 16, { font: 'poppinsMedium', size: 10, color: '#1a1a1a', align: 'center', maxWidth: chord(qy + q + 19) });
        if (c.sub) text(doc.ops, c.sub, cx, qy + q + 27, { font: 'poppins', size: 7.4, color: '#6b6b6b', align: 'center', maxWidth: chord(qy + q + 29) });
        return;
      }
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

// ─── Every print carries Setnayan ───────────────────────────────────────────

/**
 * 🏷 EVERY PRINT CARRIES SETNAYAN — owner 2026-10-21, verbatim: *"i want the prints branded with setnayan"* (option A).
 *
 *   · FREE — the plain-white print (`plainPrintLook`, `brand: 'line'`) and every plain A4 utility sheet (the QR sheet,
 *     the guest list, the seating pack, the caterer counts, the entrance chart): ONE small line, "Made with Setnayan ·
 *     setnayan.com", in small caps, neutral grey, on the FRONT's bottom edge;
 *   · PRO — the Hub-look print (`brand: 'mark'`): a tiny Setnayan mark — the shipped artwork itself (`SETNAYAN_MARK_PATH`,
 *     verbatim public/brand/setnayan-mark.svg), never a redraw — in the Hub's own ink at low contrast, on the BACK when the
 *     piece has one, else at the very edge of its one side, so the design stays clean.
 *
 * ONCE PER PIECE, and its place is MEASURED, never assumed (`brandSpot`): inside the safe area of the sheet's own die cut,
 * clear of every word, mark, plate and QR the layout drew — the bottom edge first, then its corners, then (the mark only)
 * the top corners, rising a point at a time. Applied AFTER a piece is laid out, so no layout's fit is touched.
 * Held by `lib/every-print-carries-setnayan.test.ts`.
 */
export const PRINT_BRAND_WORDS = 'Made with Setnayan · setnayan.com';
/** The free line's ink — the plain print's neutral grey (5.3 : 1 on white). */
export const PRINT_BRAND_GREY = '#6b6b6b';
/** The Pro mark's veil: the Hub's ink, quiet. */
export const PRINT_BRAND_MARK_OPACITY = 0.38;
/** Clearance kept round every drawn thing, and round a QR (its white plate plus a point). */
const BRAND_CLEAR = 2;
const BRAND_QR_CLEAR = 4;

/** The type size of the free line, and the side of the Pro mark, on a sheet of this size. */
export function brandSize(doc: Pick<PrintDoc, 'w' | 'h'>, kind: PrintBrand): number {
  const big = Math.min(doc.w, doc.h) >= 800; // the A3 posters, the entrance charts
  return kind === 'line' ? (big ? 8 : PRINT_MIN_BODY_PT) : big ? 12 : 7;
}

let brandMarkFlat: FlatMark | null = null;
/** The Setnayan mark as outlines, in its own units — flattened ONCE from the shipped artwork. */
function brandMarkOutline(): FlatMark {
  if (!brandMarkFlat) {
    brandMarkFlat = flattenSvgMark(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SETNAYAN_MARK_VIEWBOX}"><path d="${SETNAYAN_MARK_PATH}" transform="${SETNAYAN_MARK_TRANSFORM}"/></svg>`,
    );
    if (!brandMarkFlat) throw new Error('[print-layout] the Setnayan mark did not flatten');
  }
  return brandMarkFlat;
}

type BrandBox = { x: number; y: number; w: number; h: number };

/** A doc's ground — what is MEANT to sit under everything: the paper, a still, a veil or fade, the screen's safe guide. */
function isBrandGround(doc: PrintDoc, o: PrintOp): boolean {
  if (o.t === 'image') return o.ref === 'still' || o.ref === 'posterBg';
  if (o.t !== 'rect') return false;
  if (o.dash && Math.abs(o.x - SAFE_PT) < 0.5 && Math.abs(o.y - SAFE_PT) < 0.5) return true;
  if (!o.fill || o.stroke) return false;
  // Anything as large as the sheet (the paper, a veil) — or a band of the sheet's own paper spanning it (a still's fade, the
  // words' panel, a pass's stub). A small white plate under a code is NOT ground, even on white paper.
  const first = doc.ops[0];
  const paper = first && first.t === 'rect' ? first.fill : undefined;
  if (o.w >= doc.w * 0.6 && o.h >= doc.h * 0.6) return true;
  return o.fill === paper && (o.w >= doc.w * 0.6 || o.h >= doc.h * 0.6);
}

/** Everything the brand must stay clear of, each grown by its clearance. */
function brandObstacles(doc: PrintDoc): BrandBox[] {
  const out: BrandBox[] = [];
  const grow = (b: BrandBox, c: number) => out.push({ x: b.x - c, y: b.y - c, w: b.w + 2 * c, h: b.h + 2 * c });
  for (const o of doc.ops) {
    if (isBrandGround(doc, o)) continue;
    if (o.t === 'image') {
      const qr = o.ref !== 'mark';
      grow({ x: o.x, y: o.y, w: o.w, h: o.h }, qr ? BRAND_QR_CLEAR : BRAND_CLEAR);
    } else if (o.t === 'rect') {
      if (o.stroke && !o.fill) {
        // A frame or a cut line: its four edges, not the room inside it.
        const sw = o.sw ?? 0.5;
        grow({ x: o.x, y: o.y, w: o.w, h: sw }, BRAND_CLEAR);
        grow({ x: o.x, y: o.y + o.h - sw, w: o.w, h: sw }, BRAND_CLEAR);
        grow({ x: o.x, y: o.y, w: sw, h: o.h }, BRAND_CLEAR);
        grow({ x: o.x + o.w - sw, y: o.y, w: sw, h: o.h }, BRAND_CLEAR);
      } else grow({ x: o.x, y: o.y, w: o.w, h: o.h }, BRAND_CLEAR);
    } else if (o.t === 'circle') {
      grow({ x: o.cx - o.r, y: o.cy - o.r, w: o.r * 2, h: o.r * 2 }, BRAND_CLEAR);
    } else {
      const b = o.text?.box ?? pathBounds(o.d);
      if (!b) continue;
      if (o.stroke && !o.fill && b.w >= doc.w * 0.5 && b.h >= doc.h * 0.5) {
        // A drawn frame (a rounded inner border): its four sides, not the card inside it.
        const sw = o.sw ?? 0.5;
        grow({ x: b.x - sw / 2, y: b.y - sw / 2, w: b.w + sw, h: sw }, BRAND_CLEAR);
        grow({ x: b.x - sw / 2, y: b.y + b.h - sw / 2, w: b.w + sw, h: sw }, BRAND_CLEAR);
        grow({ x: b.x - sw / 2, y: b.y - sw / 2, w: sw, h: b.h + sw }, BRAND_CLEAR);
        grow({ x: b.x + b.w - sw / 2, y: b.y - sw / 2, w: sw, h: b.h + sw }, BRAND_CLEAR);
      } else grow(b, BRAND_CLEAR);
    }
  }
  return out;
}

const boxesMeet = (a: BrandBox, b: BrandBox) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export type BrandEdge = 'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
const LINE_EDGES: readonly BrandEdge[] = ['bottom-center', 'bottom-left', 'bottom-right'];
const MARK_EDGES: readonly BrandEdge[] = ['bottom-center', 'bottom-right', 'bottom-left', 'top-left', 'top-right'];

/**
 * WHERE THE BRAND GOES on this sheet — the first `edges` spot, rising a point at a time up to `lift`, whose whole box is
 * inside the die's safe area and touches nothing drawn. A cut die (a scallop's cusps, an arch's shoulders) moves a spot
 * inward until it fits. Null = no clear spot (the guard says which sheet).
 */
function brandSpot(doc: PrintDoc, bw: number, bh: number, edges: readonly BrandEdge[], lift: number): { x: number; y: number } | null {
  const obstacles = brandObstacles(doc);
  const e = 0.5;
  /* The die's own edge under a box at x: the lowest (or highest) y at which it is wholly safe — a rect's safe line, a
     scallop's cusps, a deckle's torn edge. Null: no room at this x. */
  const edgeY = (x: number, bottom: boolean): number | null => {
    for (let k = 0; k <= doc.h / 3; k += 0.5) {
      const y = bottom ? doc.h - SAFE_PT - e - bh - k : SAFE_PT + e + k;
      if (safeContainsBox(doc.die, doc.w, doc.h, { x, y, w: bw, h: bh })) return y;
    }
    return null;
  };
  for (let up = 0; up <= lift; up += 1) {
    for (const at of edges) {
      const bottom = at.startsWith('bottom');
      const x0 = at.endsWith('center') ? (doc.w - bw) / 2 : at.endsWith('left') ? SAFE_PT + e : doc.w - SAFE_PT - e - bw;
      const step = at.endsWith('left') ? 1 : at.endsWith('right') ? -1 : 0;
      for (let n = 0; n <= (step ? 40 : 0); n += 1) {
        const x = x0 + step * n;
        const edge = edgeY(x, bottom);
        if (edge === null) continue;
        const box = { x, y: bottom ? edge - up : edge + up, w: bw, h: bh };
        if (!safeContainsBox(doc.die, doc.w, doc.h, box)) continue;
        if (obstacles.some((o) => boxesMeet(box, o))) continue;
        return { x: box.x, y: box.y };
      }
    }
  }
  return null;
}

/** The free line's type: small caps in the house sans, tracked open. */
function brandLineOpts(size: number, color: string): TextOpts {
  return { font: 'poppins', size, color, caps: true, tracking: 0.14, align: 'left' };
}

/** The free line on this sheet, at its measured spot (else the bottom centre, for the guard to name). */
function brandLineOps(doc: PrintDoc, look: Pick<PrintLook, 'theme' | 'ink'>): PrintOp[] {
  const size = brandSize(doc, 'line');
  const probe = brandLineOpts(size, PRINT_BRAND_GREY);
  const ink = lineInk(PRINT_BRAND_WORDS, probe);
  const width = text([], PRINT_BRAND_WORDS, 0, 0, probe);
  const bh = ink.bottom - ink.top;
  const spot = brandSpot(doc, width, bh, LINE_EDGES, Math.round(size * 3)) ?? { x: (doc.w - width) / 2, y: doc.h - SAFE_PT - 0.5 - bh };
  /* Neutral grey — on whatever the line actually sits on (white paper on every free print); where that ground is not
     light enough for it, the least change of the grey that reads (`legibleInk`), as every pass line does. */
  const grounds = samplePoints({ x: spot.x, y: spot.y, w: width, h: bh }).flatMap(([x, y]) => groundsAt(doc.ops, look.theme, doc.ops.length, x, y));
  const color = legibleInk(PRINT_BRAND_GREY, grounds) ?? look.ink;
  const ops: PrintOp[] = [];
  text(ops, PRINT_BRAND_WORDS, spot.x, spot.y - ink.top, { ...probe, color });
  return ops.map((p) => (p.t === 'path' ? { ...p, brand: 'line' as const } : p));
}

/** The Pro mark on this sheet, at its measured spot. */
function brandMarkOps(doc: PrintDoc, look: Pick<PrintLook, 'ink'>): PrintOp[] {
  const side = brandSize(doc, 'mark');
  const m = brandMarkOutline();
  const s = side / Math.max(m.bounds.w, m.bounds.h);
  const bw = m.bounds.w * s;
  const bh = m.bounds.h * s;
  const spot = brandSpot(doc, bw, bh, MARK_EDGES, Math.round(side * 4)) ?? { x: (doc.w - bw) / 2, y: doc.h - SAFE_PT - 0.5 - bh };
  const ox = spot.x - m.bounds.x * s;
  const oy = spot.y - m.bounds.y * s;
  return m.parts.map((p) => ({ t: 'path' as const, d: scalePath(p.d, s, ox, oy), fill: look.ink, opacity: PRINT_BRAND_MARK_OPACITY, evenOdd: p.evenOdd || undefined, brand: 'mark' as const }));
}

/** One sheet, carrying the brand. */
export function brandSheet(doc: PrintDoc, look: Pick<PrintLook, 'theme' | 'ink'>, kind: PrintBrand): PrintDoc {
  const ops = kind === 'mark' ? brandMarkOps(doc, look) : brandLineOps(doc, look);
  return { ...doc, ops: [...doc.ops, ...ops] };
}

/**
 * ONE PIECE'S SIDES, carrying the brand ONCE: the free line on the front; the Pro mark on the back when there is one
 * (the last side), else on the front's edge.
 */
export function brandPiece(docs: PrintDoc[], look: PrintLook): PrintDoc[] {
  // A piece that drew the brand in its own composition (the printed phone card's foot, `cardFoot`) already carries it.
  if (docs.some((d) => d.ops.some((o) => o.t === 'path' && o.brand))) return docs;
  const kind: PrintBrand = printBrandOf(look);
  const at = kind === 'mark' && docs.length > 1 ? docs.length - 1 : 0;
  return docs.map((d, i) => (i === at ? brandSheet(d, look, kind) : d));
}

/** The plain look of the utility sheets (white paper) — their line's grey reads on it. */
const UTILITY_PAPER = { theme: 'house', ink: '#1a1a1a' } as const;

/** A plain A4 utility sheet (QR codes, guest list, seating pack, caterer counts, entrance chart): EVERY page carries the line. */
export function brandUtilityPage(doc: PrintDoc): PrintDoc {
  return brandSheet(doc, UTILITY_PAPER, 'line');
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

export type LayoutInput = {
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
  /* 🏷 Every piece carries Setnayan, once (`brandPiece`) — before the white underprint, so its ink is underprinted too. */
  const branded = brandPiece(docs, input.look);
  return input.mode === 'print' && input.whiteInk ? branded.map(underprintWhite) : branded;
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
    // 🏷 Every guest's ticket is cut out and handed over on its own — each one carries Setnayan (`brandPiece`).
    const doc = brandPiece([layoutPass({ look: input.look, data: input.data, mode: input.mode, foil: input.foil }, pass, formatFor('pass', input.format)!)], input.look)[0]!;
    return input.mode === 'print' && input.whiteInk ? underprintWhite(doc) : doc;
  });
}

export function layoutQrCodes(title: string, cells: Array<{ name: string; sub: string | null; qrRef: string }>, shape?: QrShape): PrintDoc[] {
  return layoutQrSheet(title, cells, shape).map(brandUtilityPage);
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

/**
 * lib/share-pdf.ts — 📤 THE SHARED "SHARE AS PDF" ENGINE: a Setnayan-styled A4 document of what a data view shows.
 *
 * Owner 2026-10-29: *"each print lives where its data lives"* — every data view (Budget first; then Guests › List, Seats
 * by table / A–Z + floor plan, March, Map) gets the same ONE Share button that makes a PDF of what is on screen. This
 * module draws that PDF for ANY view; the view only describes its content. The button is
 * `app/_components/share-pdf-button.tsx` (`SharePdfButton`), and the file route is the view's own.
 *
 * ── HOW A VIEW USES IT ──────────────────────────────────────────────────────
 *   1. A pure model builder for the view (e.g. `budgetPdf` in `lib/budget-pdf.ts`) turns the view's OWN resolved data
 *      into a `SharePdfDoc` — strings already formatted, nothing computed here — and REFUSES when its reads were not
 *      all answered (a refused read is not an empty list; never print ₱0 or "No guests" for "unknown").
 *   2. `await sharePdf(doc)` → the PDF bytes.
 *   3. The view's route (behind the view's own access gate) answers `application/pdf` with `Content-Disposition:
 *      attachment`, and the view mounts `<SharePdfButton href=… fileName=… />` — which fetches it with the session and
 *      hands it to the phone's share sheet (Print · Files · AirDrop · Messages · Viber…) or downloads it on a computer.
 *
 *   const bytes = await sharePdf({
 *     kind: 'GUEST LIST',                      // the eyebrow, top right
 *     title: 'Rosa & Ben',                     // the event's name
 *     meta: ['Saturday · December 12, 2026', 'Manila Hotel'],
 *     summary: { figures: [{ label: 'INVITED', value: '180' }, { label: 'COMING', value: '142' }] },
 *     sections: [{
 *       title: 'Table 1', aside: '10 seats',
 *       columns: [{ label: 'SIDE', width: 70 }, { label: 'MEAL', width: 70, align: 'left' }],
 *       rows: [{ main: 'Maria Santos', sub: 'Plus one: Jun', cells: ['Bride', 'Fish'] }],
 *       total: { label: 'Total · Table 1', cells: ['10', ''] },
 *     }],
 *     notes: ['Printed from Setnayan.'],
 *     generatedAt: new Date(),
 *   });
 *
 * ── PAPER ─────────────────────────────────────────────────────────────────
 * `paper` + `orientation` are parameters (`lib/share-pdf-papers.ts`): documents default to A4 portrait and offer
 * Letter (short bond) and Long bond (8.5 × 13 in); posters offer A4 · A3 · A2 · A1 · A0 · Custom W×H, portrait or
 * landscape (owner 2026-10-29). The view's Share shows the choice as `Paper ▾` (`PaperPicker`, inside
 * `SharePdfButton papers="document" | "poster"`), sends it as `?paper=`, and its route reads it back with
 * `sharePdfPaper(raw, allowedList)`. The document layout here reflows margins, columns and page breaks to the sheet; a
 * poster brings its own layout (and must embed any photo at print resolution) — everything drawn here is vector.
 *
 * ── WHAT EVERY FILE GETS (the view cannot opt out — that is the template) ───
 *   page 1   the Setnayan mark + SETNAYAN · the kind · the title in Fraunces · the meta line · the summary figures
 *            (eyebrow + figure, one terracotta rule above, an optional meter and notes)
 *   then     sections: a heading (+ aside) carrying the column labels, rows (a main line wrapping to two lines, a soft
 *            sub line, right-aligned figures), an optional total row. A row is NEVER split across pages, a heading
 *            never sits alone at a page's foot, and a section that runs on is headed "(continued)".
 *   last     the notes
 *   every    page: a slim head (mark · title · kind) after page 1, and "Generated <date> · setnayan.com" + "Page n of N".
 *   Light only: paper is paper — warm Atelier paper #FBFAF7, ink #2C2A29, terracotta #C24E25 on rules and eyebrows, the
 *   mark in its gold. No device chrome and no buttons ever reach the page — the doc has no field for them.
 *
 * ── HOW IT DRAWS ────────────────────────────────────────────────────────────
 * On the PDF engine every paper in this app uses (`pdf-lib`). The house type as OUTLINES — Jost (body, figures) and
 * Fraunces (title, headings, summary) from the Logo's own TrueType files (`public/logo-fonts/*.ttf`, traced into every
 * lambda by next.config.ts) read with opentype.js — the `lib/lockup-pdf.ts` / `lib/glyph-path.ts` approach; no fontkit
 * is installed and none is added. Each glyph is written ONCE as a form XObject and placed wherever it is used, the way
 * an embedded font works (a 64-line budget: 128 KB, ~0.25 s). Those subsets have no "₱": it is the face's own "P" with
 * the peso sign's two bars. Under the outlines an INVISIBLE Helvetica layer (render mode 3) carries the same words, so
 * the file can be searched, copied from and read aloud — and tests read the file's real words back from it.
 *
 * PURE: no database, no env. Built on demand by a route — never when a page opens.
 */
import {
  PDFDocument,
  StandardFonts,
  TextRenderingMode,
  appendBezierCurve,
  appendQuadraticCurve,
  beginText,
  closePath,
  concatTransformationMatrix,
  drawObject,
  endText,
  fill,
  lineTo,
  moveText,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  setFillingColor,
  setFontAndSize,
  setTextRenderingMode,
  showText,
  type PDFFont,
  type PDFName,
  type PDFOperator,
  type PDFPage,
  type PDFRef,
  type RGB,
} from 'pdf-lib';
import path from 'node:path';
import { loadOtFont } from '@/lib/glyph-path';
import { formatCount } from '@/lib/format-number';
import { SHARE_PDF_PAPERS, sheetPoints, type SharePdfPaper } from '@/lib/share-pdf-papers';

// The papers live in their own pure module so the Paper ▾ picker (a client component) can import them without this
// file's pdf-lib / node:fs. Re-exported here so a route needs one import.
export * from '@/lib/share-pdf-papers';
import { flattenSvgMark, type FlatMark } from '@/lib/print-mark';
import { SETNAYAN_MARK_PATH, SETNAYAN_MARK_TRANSFORM, SETNAYAN_MARK_VIEWBOX } from '@/lib/qr-style-svg';

// ── the document a view describes ─────────────────────────────────────────────
/** How a figure or cell is inked: `ink` (default), `soft` (secondary / a zero), `accent` (terracotta — owed, overdue). */
export type SharePdfTone = 'ink' | 'soft' | 'accent';

/** A fixed column right of the main text, laid out from the page's right edge. `align` default `right` (figures). */
export type SharePdfColumn = { label: string; width: number; align?: 'left' | 'right' };

/** A cell: plain text, or text with its tone. */
export type SharePdfCell = string | { text: string; tone?: SharePdfTone };

export type SharePdfRow = {
  /** The row's main words (wraps to two lines, then "…"). */
  main: string;
  /** A soft line under it (a supplier, a +1) — one line. */
  sub?: string | null;
  /** One per `columns` entry, in order. */
  cells: SharePdfCell[];
};

export type SharePdfSection = {
  title: string;
  /** Small faint words after the title on its line ("Planned ₱300,000"). */
  aside?: string | null;
  columns: SharePdfColumn[];
  rows: SharePdfRow[];
  /** A total row under a rule; `label` is set in small caps. */
  total?: { label: string; cells: SharePdfCell[] } | null;
  /** Drawn under the title when `rows` is empty ("When you book a supplier…"). */
  empty?: string | null;
  /** A faint footnote under the section. */
  note?: string | null;
};

export type SharePdfDoc = {
  /** The eyebrow, top right, upper-case: 'BUDGET', 'GUEST LIST', 'SEAT PLAN'. */
  kind: string;
  /** The event's name. */
  title: string;
  /** The line under the title (date, venue) — blanks dropped. */
  meta?: ReadonlyArray<string | null | undefined>;
  summary?: {
    /** Up to four, side by side: an eyebrow and a figure. A figure nobody knows is "—", never a zero. */
    figures: ReadonlyArray<{ label: string; value: string }>;
    /** One bar under the figures: each part a 0–1 fraction of the whole, drawn from the left, later parts on top. */
    meter?: ReadonlyArray<{ fraction: number; tone: 'gold' | 'accent' }>;
    notes?: ReadonlyArray<{ text: string; tone?: SharePdfTone }>;
  };
  sections: SharePdfSection[];
  /** Faint lines at the very end. */
  notes?: ReadonlyArray<string>;
  generatedAt: Date;
  /** The PDF's own title (the viewer's window title). Default "<title> — <kind lower-case>". */
  fileTitle?: string;
  /** The sheet — default A4. Every margin, column and page break follows it. */
  paper?: SharePdfPaper;
  /** Default portrait; a floor plan may take landscape. */
  orientation?: 'portrait' | 'landscape';
};

// ── the sheet ────────────────────────────────────────────────────────────────
/** A4 portrait — kept as the named default. */
export const A4 = { w: SHARE_PDF_PAPERS.a4.w, h: SHARE_PDF_PAPERS.a4.h } as const;
const MX = 48; // side margin
const TOP = 46;
const FOOT = 52; // the footer's band; content never goes below `h - FOOT`

const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const PAPER = hex('#FBFAF7'); // Atelier paper
const INK = hex('#2C2A29'); // espresso
const SOFT = hex('#6B6660');
const FAINT = hex('#9A948B');
const HAIR = hex('#E7E1D6');
const TERRACOTTA = hex('#C24E25'); // the house CTA terracotta
const GOLD = hex('#CB9E4B'); // the mark's own gold
const GOLD_SOFT = hex('#E9DCC1');


// ── type ─────────────────────────────────────────────────────────────────────
/**
 * The part of an opentype.js Font this engine uses. `types/opentype.js.d.ts` declares only what `lib/glyph-path.ts`
 * needs, and widening that ambient claim for everyone is how a wrong one shipped before (its docblock); so the extra
 * surface — `charToGlyph`, `forEachGlyph`, `tables.os2` — is named HERE, for this file, and exercised by its tests on
 * the real font files.
 */
type FaceGlyph = { index: number; getPath(x: number, y: number, fontSize: number): { commands: ReadonlyArray<PathCmd> } };
type PathCmd = { type: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number };
export type Face = {
  unitsPerEm: number;
  getAdvanceWidth(text: string, fontSize: number): number;
  charToGlyph(ch: string): FaceGlyph | null;
  forEachGlyph(text: string, x: number, y: number, fontSize: number, options: undefined, cb: (g: FaceGlyph, x: number) => void): number;
  tables?: { os2?: { sCapHeight?: number } };
};
const face = (rel: string) => loadOtFont(rel) as unknown as Face;
let _jost: Face | null = null;
let _fraunces: Face | null = null;
/** House body face — Jost 400, the Logo's own outline file. */
export const jost = () => (_jost ??= face(path.join('public', 'logo-fonts', 'jost.ttf')));
/** House display face — Fraunces 400, the Logo's own outline file. */
export const fraunces = () => (_fraunces ??= face(path.join('public', 'logo-fonts', 'fraunces.ttf')));

const PESO = '₱';
const has = (f: Face, ch: string) => {
  const g = f.charToGlyph(ch);
  return Boolean(g && g.index !== 0);
};

type Pen = {
  page: PDFPage;
  /** The sheet's height — every top-down y is flipped against it. */
  h: number;
  helv: PDFFont;
  helvKey: PDFName;
  glyph: Typeset;
};

/** WinAnsi-safe words for the invisible layer (search / copy). */
function plain(helv: PDFFont, s: string): string {
  const out: string[] = [];
  for (const ch of s.replace(/₱/g, 'PHP ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')) {
    try {
      helv.encodeText(ch);
      out.push(ch);
    } catch {
      out.push(' ');
    }
  }
  return out.join('');
}

/** Width of `s` at `size`, as `draw` will set it. */
export function measure(f: Face, s: string, size: number, tracking = 0): number {
  if (!s) return 0;
  if (tracking) {
    const chars = [...s];
    return chars.reduce((w, ch) => w + charWidth(f, ch, size), 0) + tracking * (chars.length - 1);
  }
  let w = 0;
  for (const run of runs(f, s)) w += run.kind === 'text' ? f.getAdvanceWidth(run.s, size) : charWidth(f, run.s, size);
  return w;
}

function charWidth(f: Face, ch: string, size: number): number {
  if (has(f, ch)) return f.getAdvanceWidth(ch, size);
  if (ch === PESO) return f.getAdvanceWidth('P', size);
  return f.getAdvanceWidth('?', size);
}

/** Split into runs the face can set (kerned together) and single characters it cannot. */
function runs(f: Face, s: string): Array<{ kind: 'text' | 'other'; s: string }> {
  const out: Array<{ kind: 'text' | 'other'; s: string }> = [];
  for (const ch of s) {
    const kind = has(f, ch) ? 'text' : 'other';
    const last = out[out.length - 1];
    if (kind === 'text' && last?.kind === 'text') last.s += ch;
    else out.push({ kind, s: ch });
  }
  return out;
}

type Glyph = FaceGlyph;

/**
 * ONE drawing per glyph, placed wherever it is used. Each glyph a face sets is written ONCE into the file as a form
 * XObject (its outline in font units, filled with whatever colour is current), and every letter on every page is a
 * four-number placement of it — the way an embedded font works. Drawing each letter as its own path instead made a
 * 64-line budget a 1.2 MB file in 1.2 s; a file meant for Messenger and Viber is kept small.
 *
 * The outline is read from the glyph's own commands, never `OtPath.toPathData`: its rounding writes `NaN` for some
 * coordinates (measured: Jost "G" at x = 528.912 drew "… NaN 56.72Q …"), which pdf-lib's path reader throws on.
 */
function glyphOperators(f: Face, g: Glyph): PDFOperator[] {
  const ops: PDFOperator[] = [];
  // `getPath(0, 0, upm)` is the outline in font units with y down; the XObject is y up, so y is negated.
  for (const c of g.getPath(0, 0, f.unitsPerEm).commands) {
    const X = (v: number | undefined) => v ?? 0;
    const Y = (v: number | undefined) => -(v ?? 0);
    if (c.type === 'M') ops.push(moveTo(X(c.x), Y(c.y)));
    else if (c.type === 'L') ops.push(lineTo(X(c.x), Y(c.y)));
    else if (c.type === 'Q') ops.push(appendQuadraticCurve(X(c.x1), Y(c.y1), X(c.x), Y(c.y)));
    else if (c.type === 'C') ops.push(appendBezierCurve(X(c.x1), Y(c.y1), X(c.x2), Y(c.y2), X(c.x), Y(c.y)));
    else if (c.type === 'Z') ops.push(closePath());
  }
  if (ops.length) ops.push(fill());
  return ops;
}

/** The typesetter for one document: glyph drawings are shared by every page; each page names the ones it uses. */
function typesetter(doc: PDFDocument) {
  const refs = new Map<string, PDFRef | null>();
  const names = new WeakMap<PDFPage, Map<string, PDFName>>();
  return (page: PDFPage, faceKey: string, f: Face, g: Glyph): PDFName | null => {
    const key = `${faceKey}:${g.index}`;
    let ref = refs.get(key);
    if (ref === undefined) {
      const ops = glyphOperators(f, g);
      const upm = f.unitsPerEm;
      ref = ops.length ? doc.context.register(doc.context.formXObject(ops, { BBox: doc.context.obj([-upm, -upm, 2 * upm, 2 * upm]) })) : null;
      refs.set(key, ref);
    }
    if (!ref) return null; // a space: nothing to draw
    let onPage = names.get(page);
    if (!onPage) names.set(page, (onPage = new Map()));
    let name = onPage.get(key);
    if (!name) onPage.set(key, (name = page.node.newXObject('G', ref)));
    return name;
  };
}

type Typeset = ReturnType<typeof typesetter>;

/**
 * Set `s` with its baseline at top-down `baseline`. `align` anchors x at the left, right or centre. Returns the width.
 * The outlines are what is seen; the same words go underneath as invisible Helvetica so the file reads as text.
 * "₱" (not in these subsets) is the face's own "P" with the peso sign's two bars across its bowl.
 */
function draw(
  pen: Pen,
  f: Face,
  s: string,
  x: number,
  baseline: number,
  size: number,
  color: RGB,
  opts: { align?: 'left' | 'right' | 'center'; tracking?: number } = {},
): number {
  if (!s) return 0;
  const tracking = opts.tracking ?? 0;
  const w = measure(f, s, size, tracking);
  let cx = opts.align === 'right' ? x - w : opts.align === 'center' ? x - w / 2 : x;
  const left = cx;
  const faceKey = f === jost() ? 'J' : 'F';
  const k = size / f.unitsPerEm;
  const ops: PDFOperator[] = [pushGraphicsState(), setFillingColor(color)];
  const place = (g: Glyph, gx: number) => {
    const name = pen.glyph(pen.page, faceKey, f, g);
    if (name) ops.push(pushGraphicsState(), concatTransformationMatrix(k, 0, 0, k, gx, pen.h - baseline), drawObject(name), popGraphicsState());
  };
  const pieces = tracking ? [...s].map((ch) => ({ kind: has(f, ch) ? 'text' : 'other', s: ch })) : runs(f, s);
  for (const r of pieces) {
    if (r.kind === 'text') {
      // Kerned as a run: the face's own pair spacing, as `getAdvanceWidth` measured it.
      f.forEachGlyph(r.s, cx, baseline, size, undefined, (g, gx) => place(g, gx));
      cx += f.getAdvanceWidth(r.s, size) + tracking * [...r.s].length;
      continue;
    }
    if (r.s === PESO) {
      const pg = f.charToGlyph('P');
      if (pg) place(pg, cx);
      const adv = f.getAdvanceWidth('P', size);
      const cap = ((f.tables?.os2?.sCapHeight ?? 0.7 * f.unitsPerEm) / f.unitsPerEm) * size;
      const t = Math.max(0.35, size * 0.055);
      for (const yc of [baseline - cap * 0.78, baseline - cap * 0.6]) {
        ops.push(rectangle(cx - adv * 0.06, pen.h - yc - t / 2, adv * 0.98, t), fill());
      }
    } else if (r.s.trim()) {
      const qg = f.charToGlyph('?');
      if (qg) place(qg, cx);
    }
    cx += charWidth(f, r.s, size) + tracking;
  }
  ops.push(popGraphicsState());
  pen.page.pushOperators(...ops);
  // The invisible words — searchable, selectable, read aloud; never seen or printed.
  const words = plain(pen.helv, s);
  if (words.trim()) {
    pen.page.pushOperators(
      pushGraphicsState(),
      beginText(),
      setFontAndSize(pen.helvKey, size),
      setTextRenderingMode(TextRenderingMode.Invisible),
      moveText(left, pen.h - baseline),
      showText(pen.helv.encodeText(words)),
      endText(),
      popGraphicsState(),
    );
  }
  return w;
}

/** Wrap to at most `maxLines`, the last one ending "…" when the words run out of room. */
export function wrap(f: Face, s: string, size: number, maxW: number, maxLines: number): string[] {
  const words = s.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  let i = 0;
  for (; i < words.length; i++) {
    const next = cur ? `${cur} ${words[i]}` : words[i]!;
    if (!cur || measure(f, next, size) <= maxW) {
      cur = next;
      continue;
    }
    lines.push(cur);
    cur = words[i]!;
    if (lines.length === maxLines) break;
  }
  const truncated = i < words.length;
  if (!truncated && cur) lines.push(cur);
  return lines.map((l, n) => {
    let line = l;
    const last = n === lines.length - 1;
    if (measure(f, line, size) > maxW || (last && truncated)) {
      while (line.length > 1 && measure(f, `${line}…`, size) > maxW) line = line.slice(0, -1).trimEnd();
      line = `${line}…`;
    }
    return line;
  });
}

// ── figures ──────────────────────────────────────────────────────────────────
/** `1250000` → "₱1,250,000"; a credit → "–₱5,000"; no figure → "—" (never "₱0"). */
export function peso(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const r = Math.round(n);
  const s = Math.abs(r).toLocaleString('en-PH', { maximumFractionDigits: 0 });
  return r < 0 ? `–${PESO}${s}` : `${PESO}${s}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** `2026-10-01` → "Oct 1, 2026". */
export function dueWord(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return '—';
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

function generatedWord(d: Date): string {
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' });
}

// ── the mark ─────────────────────────────────────────────────────────────────
let _mark: FlatMark | null = null;
function setnayanMark(): FlatMark | null {
  if (!_mark) {
    _mark = flattenSvgMark(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SETNAYAN_MARK_VIEWBOX}"><path d="${SETNAYAN_MARK_PATH}" transform="${SETNAYAN_MARK_TRANSFORM}"/></svg>`,
    );
  }
  return _mark;
}
function drawMark(page: PDFPage, h: number, x: number, top: number, side: number) {
  const m = setnayanMark();
  if (!m) return;
  const s = side / Math.max(m.bounds.w, m.bounds.h);
  for (const p of m.parts) {
    page.drawSvgPath(p.d, { x: x - m.bounds.x * s, y: h - top + m.bounds.y * s, scale: s, color: GOLD, borderWidth: 0 });
  }
}


const toneColor = (t: SharePdfTone | undefined) => (t === 'soft' ? SOFT : t === 'accent' ? TERRACOTTA : INK);
const cellOf = (c: SharePdfCell | undefined): { text: string; tone?: SharePdfTone } =>
  c == null ? { text: '' } : typeof c === 'string' ? { text: c } : c;

/** The columns' x positions, laid out right-to-left from the page's right edge with a 12 pt gap between. */
function layoutColumns(W: number, columns: ReadonlyArray<SharePdfColumn>): { mainW: number; at: Array<{ x: number; align: 'left' | 'right' }> } {
  const GAP = 12;
  let right = W - MX;
  const at: Array<{ x: number; align: 'left' | 'right' }> = new Array(columns.length);
  for (let i = columns.length - 1; i >= 0; i--) {
    const c = columns[i]!;
    const align = c.align ?? 'right';
    at[i] = { x: align === 'right' ? right : right - c.width, align };
    right -= c.width + GAP;
  }
  return { mainW: Math.max(120, right - MX), at };
}

/** The PDF bytes for a view's document. See the docblock at the top for the shape every file takes. */
export async function sharePdf(d: SharePdfDoc): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(d.fileTitle ?? `${d.title} — ${d.kind.toLowerCase()}`, { showInWindowTitleBar: true });
  doc.setAuthor('Setnayan');
  doc.setCreator('Setnayan');
  doc.setProducer('Setnayan');
  doc.setLanguage('en-PH');
  doc.setCreationDate(d.generatedAt);
  doc.setModificationDate(d.generatedAt);
  const { w: W, h: H } = sheetPoints(d.paper ?? 'a4', d.orientation ?? 'portrait');
  const BOTTOM_Y = H - FOOT;
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const glyph = typesetter(doc);

  const J = jost();
  const F = fraunces();
  const pages: Pen[] = [];
  const newPage = (): Pen => {
    const page = doc.addPage([W, H]);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
    const pen: Pen = { page, h: H, helv, helvKey: page.node.newFontDictionary(helv.name, helv.ref), glyph };
    pages.push(pen);
    return pen;
  };
  const rule = (pen: Pen, y: number, color: RGB, thickness = 0.5, x0 = MX, x1 = W - MX) =>
    pen.page.drawLine({ start: { x: x0, y: H - y }, end: { x: x1, y: H - y }, thickness, color });

  // ── page 1 · the head ──
  let pen = newPage();
  let y = TOP;
  drawMark(pen.page, H, MX, y, 16);
  draw(pen, J, 'SETNAYAN', MX + 22, y + 11.6, 8.5, INK, { tracking: 2.2 });
  draw(pen, J, d.kind.toUpperCase(), W - MX, y + 11.6, 8, TERRACOTTA, { align: 'right', tracking: 2 });
  y += 30;
  rule(pen, y, HAIR);
  y += 38;
  for (const line of wrap(F, d.title, 26, W - 2 * MX, 2)) {
    draw(pen, F, line, MX, y, 26, INK);
    y += 30;
  }
  const meta = (d.meta ?? []).filter((s): s is string => Boolean(s && s.trim()));
  for (const line of meta.length ? wrap(J, meta.join('  ·  '), 10.5, W - 2 * MX, 2) : []) {
    draw(pen, J, line, MX, y - 6, 10.5, SOFT);
    y += 15;
  }
  y += 14;

  // ── the summary ──
  if (d.summary && d.summary.figures.length) {
    const figs = d.summary.figures.slice(0, 4);
    const colW = (W - 2 * MX) / Math.max(4, figs.length);
    rule(pen, y, TERRACOTTA, 1.2, MX, MX + 28);
    y += 18;
    figs.forEach((f, i) => {
      const x = MX + i * colW;
      draw(pen, J, f.label.toUpperCase(), x, y, 7.5, SOFT, { tracking: 1.4 });
      // 19 pt, smaller only when a long figure would cross into the next column.
      const size = Math.min(19, (19 * (colW - 10)) / Math.max(1, measure(F, f.value, 19)));
      draw(pen, F, f.value, x, y + 24, size, INK);
    });
    y += 38;
    if (d.summary.meter?.length) {
      const full = W - 2 * MX;
      const yy = H - y;
      pen.page.drawRectangle({ x: MX, y: yy - 4, width: full, height: 4, color: HAIR });
      for (const part of d.summary.meter) {
        const w = Math.min(1, Math.max(0, Number.isFinite(part.fraction) ? part.fraction : 0)) * full;
        if (w > 0) pen.page.drawRectangle({ x: MX, y: yy - 4, width: w, height: 4, color: part.tone === 'gold' ? GOLD_SOFT : TERRACOTTA });
      }
      y += 16;
    }
    for (const n of d.summary.notes ?? []) {
      draw(pen, J, n.text, MX, y, 8.5, n.tone === 'accent' ? TERRACOTTA : n.tone === 'ink' ? INK : FAINT);
      y += 14;
    }
    y += 16;
  }

  // ── the sections ──
  const ROW_PAD = 7;
  const MAIN_SIZE = 9.5;
  const SUB_SIZE = 8;
  const HEAD_H = 30;
  const TOTAL_H = 24;

  const continuation = () => {
    pen = newPage();
    y = TOP;
    drawMark(pen.page, H, MX, y, 11);
    draw(pen, J, wrap(J, d.title, 8.5, W - 2 * MX - 120, 1)[0] ?? '', MX + 17, y + 8.6, 8.5, SOFT);
    draw(pen, J, d.kind.toUpperCase(), W - MX, y + 8.6, 8, TERRACOTTA, { align: 'right', tracking: 2 });
    y += 22;
    rule(pen, y, HAIR);
    y += 24;
  };

  for (const s of d.sections) {
    const { mainW, at } = layoutColumns(W, s.columns);
    const rows = s.rows.map((r) => {
      const main = wrap(J, r.main || '—', MAIN_SIZE, mainW, 2);
      const sub = r.sub ? wrap(J, r.sub, SUB_SIZE, mainW, 1) : [];
      return { r, main, sub, h: ROW_PAD * 2 + main.length * 12 + sub.length * 10.5 };
    });
    const head = (continued: boolean) => {
      const aside = !continued && s.aside ? s.aside : '';
      const asideW = aside ? measure(J, aside, 7.8) + 10 : 0;
      const firstCol = at.length ? (at[0]!.align === 'right' ? at[0]!.x - s.columns[0]!.width : at[0]!.x) : W - MX;
      const room = firstCol - 12 - MX;
      const title = continued ? `${s.title} (continued)` : s.title;
      // The aside rides the title's line when both fit; otherwise the title keeps its words and the aside takes a
      // small line of its own under it — a heading is never cut short for its footnote.
      const besideFits = !aside || measure(F, title, 13) + asideW <= room;
      const name = wrap(F, title, 13, Math.max(110, besideFits ? room - asideW : room), 1)[0] ?? '';
      const nameW = draw(pen, F, name, MX, y + 12, 13, INK);
      if (aside && besideFits) draw(pen, J, aside, MX + nameW + 10, y + 12, 7.8, FAINT);
      s.columns.forEach((c, i) => draw(pen, J, c.label.toUpperCase(), at[i]!.x, y + 12, 6.8, FAINT, { align: at[i]!.align, tracking: 1.1 }));
      y += 19;
      if (aside && !besideFits) {
        draw(pen, J, aside, MX, y + 4, 7.8, FAINT);
        y += 11;
      }
      if (rows.length) {
        rule(pen, y, INK, 0.6);
        y += 2;
      }
    };
    // Keep the heading with its first row (and with the total when there is only one row).
    const firstNeed = HEAD_H + 14 + (rows[0]?.h ?? 20) + (rows.length === 1 && s.total ? TOTAL_H : 0);
    y += 10;
    if (y + firstNeed > BOTTOM_Y) continuation();
    head(false);
    if (!rows.length && s.empty) {
      draw(pen, J, s.empty, MX, y + 4, 9, SOFT);
      y += 16;
    }
    rows.forEach((row, i) => {
      const last = i === rows.length - 1;
      // A row never splits; the last row takes its total with it.
      if (y + row.h + (last && s.total ? TOTAL_H : 0) > BOTTOM_Y) {
        continuation();
        head(true);
      }
      let ty = y + ROW_PAD + 9;
      const top = ty;
      for (const line of row.main) {
        draw(pen, J, line, MX, ty, MAIN_SIZE, INK);
        ty += 12;
      }
      for (const line of row.sub) {
        draw(pen, J, line, MX, ty - 1, SUB_SIZE, SOFT);
        ty += 10.5;
      }
      s.columns.forEach((c, k) => {
        const cell = cellOf(row.r.cells[k]);
        if (cell.text) draw(pen, J, cell.text, at[k]!.x, top, c.align === 'left' ? 8.5 : MAIN_SIZE, toneColor(cell.tone), { align: at[k]!.align });
      });
      y += row.h;
      if (!last) rule(pen, y, HAIR, 0.4);
    });
    if (s.total) {
      rule(pen, y, INK, 0.6);
      const ty = y + 15;
      draw(pen, J, wrap(J, s.total.label.toUpperCase(), 7, mainW, 1)[0] ?? '', MX, ty, 7, SOFT, { tracking: 1.1 });
      s.columns.forEach((_, k) => {
        const cell = cellOf(s.total!.cells[k]);
        if (cell.text) draw(pen, J, cell.text, at[k]!.x, ty, MAIN_SIZE, toneColor(cell.tone), { align: at[k]!.align });
      });
      y += TOTAL_H;
    } else if (rows.length) {
      rule(pen, y, HAIR, 0.4);
    }
    if (s.note) {
      if (y + 18 > BOTTOM_Y) continuation();
      draw(pen, J, s.note, MX, y + 13, 7.5, FAINT);
      y += 18;
    }
  }

  // ── the notes ──
  if (d.notes?.length) {
    y += 18;
    for (const n of d.notes) {
      if (y + 14 > BOTTOM_Y) continuation();
      draw(pen, J, n, MX, y, 8, FAINT);
      y += 13;
    }
  }

  // ── every page's foot ──
  const generated = `Generated ${generatedWord(d.generatedAt)}  ·  setnayan.com`;
  pages.forEach((p, i) => {
    const fy = H - 28;
    rule(p, fy - 14, HAIR, 0.4);
    draw(p, J, generated, MX, fy, 7.5, FAINT);
    draw(p, J, `Page ${formatCount(i + 1)} of ${formatCount(pages.length)}`, W - MX, fy, 7.5, FAINT, { align: 'right' });
  });

  return doc.save({ useObjectStreams: true });
}

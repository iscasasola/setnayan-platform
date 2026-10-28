/**
 * lib/budget-pdf.ts — 📤 THE BUDGET AS A FILE TO SHARE: one A4 PDF, drawn with the PDF engine every other paper in this
 * app is drawn with (`pdf-lib` — the seat plan, the concept book, the prints).
 *
 * Owner 2026-10-29, from the iPhone app: *"Print Budget can be just a share button if it has the print and share there
 * as well? and maximize every other method to share that file? … fix how that pdf file/page looks"*. So Budget's
 * "Print" page (an HTML page with "‹ Done" and a print button in it) became ONE Share button, and Share hands the
 * phone THIS file — the system sheet then offers Print, Save to Files, AirDrop, Messages, Viber, Mail… A file has no
 * buttons in it and no device chrome, so nothing on paper can say "‹ Done" again.
 *
 * ── HOW IT LOOKS ────────────────────────────────────────────────────────────
 * The house type, as OUTLINES: Jost (body, figures) and Fraunces (names, sections) from the TrueType files that already
 * ship for the Logo (`public/logo-fonts/*.ttf`, traced into every lambda by next.config.ts), drawn with opentype.js +
 * `drawSvgPath` — the `lib/lockup-pdf.ts` / `lib/glyph-path.ts` approach (no fontkit in this repo, and none added).
 * Those subsets carry no "₱", so the peso sign is drawn as the face's own "P" with its two bars. Under the outlines an
 * INVISIBLE text layer (render mode 3) carries the same words, so the file can still be searched and copied from.
 * Warm paper (#FBFAF7), ink #2C2A29, terracotta #C24E25 on the rules and eyebrows, the Setnayan mark in its gold.
 *
 *   page 1 · the mark + SETNAYAN · the event's name · date · venue · Target · Agreed · Paid · Owed · one meter
 *   then   · each category as a section: its lines (item · supplier · agreed · paid · owed · due) and its total
 *   last   · categories planned but with nothing agreed yet
 *   every page · "Generated …" and "Page n of N" at the foot
 *
 * A row is never split across pages, and a category's heading never sits alone at the foot of one.
 *
 * ── ONE SET OF BOOKS · AGREED MONEY ONLY ───────────────────────────────────
 * Every figure is `/budget`'s own: `EventMoney` (`resolveEventMoney`) and `BudgetLedger` (`buildBudgetLedger`), the
 * lines filtered and ordered by `exportableLines` exactly as the CSV is. Quotes (`kind === 'estimated'`) never print.
 *
 * ── 🛑 A FAILED READ NEVER PRINTS ₱0 ───────────────────────────────────────
 * When any of the three money reads was refused (`EventMoney.reads`), Agreed and Paid are sums over rows that are not
 * there — a floor, not a fact — and a file of them would be a confident wrong budget sent to a parent or a planner.
 * `budgetPdf` REFUSES (`BudgetUnreadError`) instead; the route turns that into a sentence and no file. A figure that is
 * simply absent (no target set) prints "—", never "₱0". Guard: `lib/budget-share-is-one-file.test.ts`.
 *
 * Pure layout: the route (`app/api/budget/[eventId]/export/route.ts`) does every read and hands the answers in.
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
import type { EventMoney, MoneyLine } from '@/lib/budget-truth';
import { moneyReadsAllOk } from '@/lib/budget-truth';
import type { BudgetLedger } from '@/lib/budget-ledger';
import { categoryLabeller, exportableLines } from '@/lib/budget-export';
import { loadOtFont, type OtFont } from '@/lib/glyph-path';
import { flattenSvgMark, type FlatMark } from '@/lib/print-mark';
import { SETNAYAN_MARK_PATH, SETNAYAN_MARK_TRANSFORM, SETNAYAN_MARK_VIEWBOX } from '@/lib/qr-style-svg';

export type BudgetPdfInput = {
  eventName: string;
  /** The event's date as paper prints it (`printedDate` — as precise as the Event Hub holds it). Null → no date. */
  eventDate: string | null;
  /** The Event Hub's venues on one line (`venueNamesLine`). Null → no venue. */
  venue: string | null;
  money: EventMoney;
  ledger: BudgetLedger;
  generatedAt: Date;
};

/** The money reads were not all answered — a file now would print a floor as a fact. */
export class BudgetUnreadError extends Error {
  constructor() {
    super("Your budget can't be shared right now — part of it didn't load. Please try again in a few minutes.");
    this.name = 'BudgetUnreadError';
  }
}

// ── the sheet ────────────────────────────────────────────────────────────────
/** A4 portrait, points. */
export const A4 = { w: 595.28, h: 841.89 } as const;
const MX = 48; // side margin
const TOP = 46;
const FOOT = 40; // space kept for the footer
const BOTTOM = A4.h - FOOT - 12; // content never goes below this (top-down y)

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

// Columns (top-down x). Numbers are right-aligned to their edge; Due is left-aligned.
const COL_DUE = A4.w - MX - 60;
const COL_OWED = COL_DUE - 14;
const COL_PAID = COL_OWED - 74;
const COL_AGREED = COL_PAID - 74;
const ITEM_W = COL_AGREED - 74 - MX;

// ── type ─────────────────────────────────────────────────────────────────────
type Face = OtFont;
let _jost: Face | null = null;
let _fraunces: Face | null = null;
const jost = () => (_jost ??= loadOtFont(path.join('public', 'logo-fonts', 'jost.ttf')));
const fraunces = () => (_fraunces ??= loadOtFont(path.join('public', 'logo-fonts', 'fraunces.ttf')));

const PESO = '₱';
const has = (f: Face, ch: string) => {
  const g = f.charToGlyph(ch);
  return Boolean(g && g.index !== 0);
};

type Pen = {
  page: PDFPage;
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

type Glyph = ReturnType<Face['charToGlyph']>;

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
  for (const c of g.getPath(0, 0, f.unitsPerEm).commands as ReadonlyArray<{ type: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number }>) {
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
    if (name) ops.push(pushGraphicsState(), concatTransformationMatrix(k, 0, 0, k, gx, A4.h - baseline), drawObject(name), popGraphicsState());
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
      place(f.charToGlyph('P'), cx);
      const adv = f.getAdvanceWidth('P', size);
      const cap = (((f as unknown as { tables?: { os2?: { sCapHeight?: number } } }).tables?.os2?.sCapHeight ?? 0.7 * f.unitsPerEm) / f.unitsPerEm) * size;
      const t = Math.max(0.35, size * 0.055);
      for (const yc of [baseline - cap * 0.78, baseline - cap * 0.6]) {
        ops.push(rectangle(cx - adv * 0.06, A4.h - yc - t / 2, adv * 0.98, t), fill());
      }
    } else if (r.s.trim()) {
      place(f.charToGlyph('?'), cx);
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
      moveText(left, A4.h - baseline),
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
function drawMark(page: PDFPage, x: number, top: number, side: number) {
  const m = setnayanMark();
  if (!m) return;
  const s = side / Math.max(m.bounds.w, m.bounds.h);
  for (const p of m.parts) {
    page.drawSvgPath(p.d, { x: x - m.bounds.x * s, y: A4.h - top + m.bounds.y * s, scale: s, color: GOLD, borderWidth: 0 });
  }
}

// ── the model: what is printed, in order ────────────────────────────────────
export type BudgetPdfSection = {
  bucketId: string;
  label: string;
  plannedPhp: number | null;
  plannedSuggested: boolean;
  lines: MoneyLine[];
  total: { agreedPhp: number; paidPhp: number; owedPhp: number };
};

/** Categories with agreed lines (as sections, in the export's order), then categories planned with nothing agreed. */
export function budgetPdfModel(money: EventMoney, ledger: BudgetLedger): {
  sections: BudgetPdfSection[];
  plannedOnly: Array<{ label: string; plannedPhp: number; suggested: boolean }>;
} {
  const label = categoryLabeller(money, ledger);
  const byRow = new Map(ledger.rows.map((r) => [r.bucketId, r]));
  const sections: BudgetPdfSection[] = [];
  for (const l of exportableLines(money, label)) {
    let s = sections[sections.length - 1];
    if (!s || s.bucketId !== l.bucket) {
      const r = byRow.get(l.bucket);
      s = {
        bucketId: l.bucket,
        label: label(l.bucket),
        plannedPhp: r?.plannedPhp ?? null,
        plannedSuggested: r?.plannedSource === 'suggested',
        lines: [],
        total: { agreedPhp: 0, paidPhp: 0, owedPhp: 0 },
      };
      sections.push(s);
    }
    s.lines.push(l);
  }
  // A category's total is the resolver's own (the ledger row = `byBucket`), the figure `/budget` prints for it; the
  // sum of its printed lines only where the ledger has no row for it.
  for (const s of sections) {
    const r = byRow.get(s.bucketId);
    s.total = r
      ? { agreedPhp: r.agreedPhp, paidPhp: r.paidPhp, owedPhp: r.owedPhp }
      : {
          agreedPhp: s.lines.reduce((a, l) => a + l.amountPhp, 0),
          paidPhp: s.lines.reduce((a, l) => a + l.paidPhp, 0),
          owedPhp: s.lines.reduce((a, l) => a + l.stillOwedPhp, 0),
        };
  }
  const withLines = new Set(sections.map((s) => s.bucketId));
  const plannedOnly = ledger.rows
    .filter((r) => !withLines.has(r.bucketId) && r.plannedPhp != null && r.plannedPhp > 0)
    .map((r) => ({ label: r.label, plannedPhp: r.plannedPhp as number, suggested: r.plannedSource === 'suggested' }));
  return { sections, plannedOnly };
}

// ── the file ─────────────────────────────────────────────────────────────────
export async function budgetPdf(input: BudgetPdfInput): Promise<Uint8Array> {
  const { money, ledger } = input;
  // 🛑 A refused read is not a smaller budget. Refuse rather than print a floor as a fact.
  if (!moneyReadsAllOk(money)) throw new BudgetUnreadError();

  const doc = await PDFDocument.create();
  const title = `${input.eventName} — budget`;
  doc.setTitle(title, { showInWindowTitleBar: true });
  doc.setAuthor('Setnayan');
  doc.setCreator('Setnayan');
  doc.setProducer('Setnayan');
  doc.setSubject('Budget — agreed money only');
  doc.setLanguage('en-PH');
  doc.setCreationDate(input.generatedAt);
  doc.setModificationDate(input.generatedAt);
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const glyph = typesetter(doc);

  const J = jost();
  const F = fraunces();
  const pages: Pen[] = [];

  const newPage = (): Pen => {
    const page = doc.addPage([A4.w, A4.h]);
    page.drawRectangle({ x: 0, y: 0, width: A4.w, height: A4.h, color: PAPER });
    const helvKey = page.node.newFontDictionary(helv.name, helv.ref);
    const pen: Pen = { page, helv, helvKey, glyph };
    pages.push(pen);
    return pen;
  };
  const rule = (pen: Pen, y: number, color: RGB, thickness = 0.5, x0 = MX, x1 = A4.w - MX) =>
    pen.page.drawLine({ start: { x: x0, y: A4.h - y }, end: { x: x1, y: A4.h - y }, thickness, color });

  // ── page 1 · the head ──
  let pen = newPage();
  let y = TOP;
  drawMark(pen.page, MX, y, 16);
  draw(pen, J, 'SETNAYAN', MX + 22, y + 11.6, 8.5, INK, { tracking: 2.2 });
  draw(pen, J, 'BUDGET', A4.w - MX, y + 11.6, 8, TERRACOTTA, { align: 'right', tracking: 2 });
  y += 30;
  rule(pen, y, HAIR);
  y += 38;
  for (const line of wrap(F, input.eventName, 26, A4.w - 2 * MX, 2)) {
    draw(pen, F, line, MX, y, 26, INK);
    y += 30;
  }
  const meta = [input.eventDate, input.venue].filter((s): s is string => Boolean(s && s.trim()));
  if (meta.length) {
    for (const line of wrap(J, meta.join('  ·  '), 10.5, A4.w - 2 * MX, 2)) {
      draw(pen, J, line, MX, y - 6, 10.5, SOFT);
      y += 15;
    }
  }
  y += 14;

  // ── the summary: Target · Agreed · Paid · Owed (the screen's own four words) ──
  const colW = (A4.w - 2 * MX) / 4;
  const figures: Array<[string, number | null]> = [
    ['TARGET', money.targetPhp],
    ['AGREED', money.committed],
    ['PAID', money.paid],
    ['OWED', money.stillOwed],
  ];
  rule(pen, y, TERRACOTTA, 1.2, MX, MX + 28);
  y += 18;
  figures.forEach(([k, v], i) => {
    const x = MX + i * colW;
    draw(pen, J, k, x, y, 7.5, SOFT, { tracking: 1.4 });
    // 19 pt, smaller only when a long figure would cross into the next column.
    const fig = peso(v);
    const figSize = Math.min(19, (19 * (colW - 10)) / Math.max(1, measure(F, fig, 19)));
    draw(pen, F, fig, x, y + 24, figSize, INK);
  });
  y += 38;
  if (money.targetPhp == null) {
    draw(pen, J, 'No target set yet.', MX, y, 8.5, FAINT);
    y += 14;
  } else if (money.targetPhp > 0) {
    // One meter: agreed (gold) and paid (terracotta) against the target.
    const full = A4.w - 2 * MX;
    const yy = A4.h - y;
    const agreedW = Math.min(1, Math.max(0, money.committed / money.targetPhp)) * full;
    const paidW = Math.min(1, Math.max(0, money.paid / money.targetPhp)) * full;
    pen.page.drawRectangle({ x: MX, y: yy - 4, width: full, height: 4, color: HAIR });
    if (agreedW > 0) pen.page.drawRectangle({ x: MX, y: yy - 4, width: agreedW, height: 4, color: GOLD_SOFT });
    if (paidW > 0) pen.page.drawRectangle({ x: MX, y: yy - 4, width: paidW, height: 4, color: TERRACOTTA });
    y += 16;
    const pct = Math.round((money.committed / money.targetPhp) * 100);
    const note = money.isOverBudget
      ? `Agreed is ${peso(money.overBudgetByPhp)} over your target.`
      : `${pct}% of your target is agreed.`;
    draw(pen, J, note, MX, y, 8.5, money.isOverBudget ? TERRACOTTA : SOFT);
    y += 14;
  }
  if (money.overpaid > 0) {
    draw(pen, J, `${peso(money.overpaid)} was paid beyond what was agreed.`, MX, y, 8.5, SOFT);
    y += 14;
  }
  y += 16;

  // ── the sections ──
  const { sections, plannedOnly } = budgetPdfModel(money, ledger);
  const ROW_PAD = 7;
  const ITEM_SIZE = 9.5;
  const SUB_SIZE = 8;
  const HEAD_H = 30;
  const TOTAL_H = 24;

  const continuation = () => {
    pen = newPage();
    y = TOP;
    drawMark(pen.page, MX, y, 11);
    draw(pen, J, input.eventName.length > 60 ? `${input.eventName.slice(0, 59)}…` : input.eventName, MX + 17, y + 8.6, 8.5, SOFT);
    draw(pen, J, 'BUDGET', A4.w - MX, y + 8.6, 8, TERRACOTTA, { align: 'right', tracking: 2 });
    y += 22;
    rule(pen, y, HAIR);
    y += 24;
  };

  const sectionHead = (s: BudgetPdfSection, continued: boolean) => {
    // The plan sits on the heading's own line, after the name — never under it; the name gives way to it.
    const plan =
      !continued && s.plannedPhp != null && s.plannedPhp > 0
        ? `Planned ${peso(s.plannedPhp)}${s.plannedSuggested ? ' (suggested)' : ''}`
        : '';
    const room = COL_AGREED - 50 - MX;
    const planW = plan ? measure(J, plan, 7.8) + 10 : 0;
    const name = wrap(F, continued ? `${s.label} (continued)` : s.label, 13, Math.max(110, room - planW), 1)[0] ?? '';
    const nameW = draw(pen, F, name, MX, y + 12, 13, INK);
    if (plan) draw(pen, J, plan, MX + nameW + 10, y + 12, 7.8, FAINT);
    const cols: Array<[string, number, 'right' | 'left']> = [
      ['AGREED', COL_AGREED, 'right'],
      ['PAID', COL_PAID, 'right'],
      ['OWED', COL_OWED, 'right'],
      ['DUE', COL_DUE, 'left'],
    ];
    for (const [k, x, align] of cols) draw(pen, J, k, x, y + 12, 6.8, FAINT, { align, tracking: 1.1 });
    y += 19;
    rule(pen, y, INK, 0.6);
    y += 2;
  };

  const rowLayout = (l: MoneyLine) => {
    const item = wrap(J, l.label || 'Untitled', ITEM_SIZE, ITEM_W, 2);
    const supplier = l.vendorName ? wrap(J, l.vendorName, SUB_SIZE, ITEM_W, 1) : [];
    const h = ROW_PAD * 2 + item.length * 12 + supplier.length * 10.5;
    return { item, supplier, h };
  };

  if (!sections.length) {
    draw(pen, F, 'Nothing agreed yet.', MX, y + 12, 13, INK);
    y += 20;
    draw(pen, J, 'When you book a supplier or add an expense, it is listed here.', MX, y + 4, 9, SOFT);
    y += 20;
  }

  for (const s of sections) {
    const rows = s.lines.map(rowLayout);
    // Keep the heading with its first row (and the total when the category is one row).
    const firstNeed = HEAD_H + 14 + (rows[0]?.h ?? 0) + (rows.length === 1 ? TOTAL_H : 0);
    y += 10;
    if (y + firstNeed > BOTTOM) continuation();
    sectionHead(s, false);
    rows.forEach((r, i) => {
      const l = s.lines[i]!;
      const last = i === rows.length - 1;
      // A row never splits; the last row takes its total with it.
      if (y + r.h + (last ? TOTAL_H : 0) > BOTTOM) {
        continuation();
        sectionHead(s, true);
      }
      let ty = y + ROW_PAD + 9;
      const top = ty;
      for (const line of r.item) {
        draw(pen, J, line, MX, ty, ITEM_SIZE, INK);
        ty += 12;
      }
      for (const line of r.supplier) {
        draw(pen, J, line, MX, ty - 1, SUB_SIZE, SOFT);
        ty += 10.5;
      }
      draw(pen, J, peso(l.amountPhp), COL_AGREED, top, ITEM_SIZE, INK, { align: 'right' });
      draw(pen, J, peso(l.paidPhp), COL_PAID, top, ITEM_SIZE, SOFT, { align: 'right' });
      draw(pen, J, peso(l.stillOwedPhp), COL_OWED, top, ITEM_SIZE, l.stillOwedPhp > 0 ? INK : SOFT, { align: 'right' });
      draw(pen, J, dueWord(l.dueDate), COL_DUE, top, 8.5, l.dueState === 'overdue' ? TERRACOTTA : SOFT);
      y += r.h;
      if (!last) rule(pen, y, HAIR, 0.4);
    });
    // The category's total.
    rule(pen, y, INK, 0.6);
    const ty = y + 15;
    draw(pen, J, `TOTAL · ${s.label.toUpperCase()}`.slice(0, 48), MX, ty, 7, SOFT, { tracking: 1.1 });
    draw(pen, J, peso(s.total.agreedPhp), COL_AGREED, ty, ITEM_SIZE, INK, { align: 'right' });
    draw(pen, J, peso(s.total.paidPhp), COL_PAID, ty, ITEM_SIZE, INK, { align: 'right' });
    draw(pen, J, peso(s.total.owedPhp), COL_OWED, ty, ITEM_SIZE, s.total.owedPhp > 0 ? TERRACOTTA : INK, { align: 'right' });
    y += TOTAL_H;
  }

  if (plannedOnly.length) {
    y += 12;
    if (y + HEAD_H + 22 > BOTTOM) continuation();
    draw(pen, F, 'Planned, nothing agreed yet', MX, y + 12, 13, INK);
    draw(pen, J, 'PLANNED', COL_AGREED, y + 12, 6.8, FAINT, { align: 'right', tracking: 1.1 });
    y += 19;
    rule(pen, y, INK, 0.6);
    for (const p of plannedOnly) {
      if (y + 22 > BOTTOM) {
        continuation();
        rule(pen, y, INK, 0.6);
      }
      draw(pen, J, p.label, MX, y + 15, ITEM_SIZE, INK);
      draw(pen, J, `${peso(p.plannedPhp)}${p.suggested ? '*' : ''}`, COL_AGREED, y + 15, ITEM_SIZE, SOFT, { align: 'right' });
      y += 22;
      rule(pen, y, HAIR, 0.4);
    }
    if (plannedOnly.some((p) => p.suggested)) {
      draw(pen, J, '* suggested split — you have not set your own figure for it yet.', MX, y + 13, 7.5, FAINT);
      y += 18;
    }
  }

  y += 18;
  if (y + 14 > BOTTOM) continuation();
  draw(pen, J, "Agreed money only — quotes you're still weighing aren't included.", MX, y, 8, FAINT);

  // ── every page's foot ──
  const total = pages.length;
  const generated = `Generated ${generatedWord(input.generatedAt)}  ·  setnayan.com`;
  pages.forEach((p, i) => {
    const fy = A4.h - 28;
    rule(p, fy - 14, HAIR, 0.4);
    draw(p, J, generated, MX, fy, 7.5, FAINT);
    draw(p, J, `Page ${i + 1} of ${total}`, A4.w - MX, fy, 7.5, FAINT, { align: 'right' });
  });

  return doc.save({ useObjectStreams: true });
}

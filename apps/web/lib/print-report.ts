/**
 * lib/print-report.ts — the FREE group's A4 documents, as `PrintDoc` pages.
 *
 * Owner 2026-09-25 (DECISION_LOG "PRINTS & TICKETS HOLDS EVERY PRINT"): the
 * Maker's Prints & Tickets lists every free print beside the themed set. The
 * ones that are lists — the guest registry, the seating pack's directory, the
 * caterer's meal counts — are laid out here, once, as a table that breaks
 * across A4 pages, in the SAME op vocabulary the themed set uses
 * (lib/print-layout.ts). So one layout draws twice: `renderPrintSvg` for the
 * thumbnail the Maker shows, `renderPrintPdf(…, { mode: 'plain' })` for the
 * file the couple saves. A thumbnail cannot disagree with its PDF.
 *
 * Type is outlines from the repo's own TTFs (`drawText`), so no host font and
 * no WinAnsi encoding error on a name like "Ñiño" or "Nguyễn".
 *
 * PURE. No I/O beyond the fonts the Node test runner can read.
 */
import { diePathFor, drawText, wrap, type PrintDoc, type PrintOp } from '@/lib/print-layout';
import { PRINT_PIECES, PT_PER_MM, type PrintPieceKey } from '@/lib/print-pieces';

export const REPORT_INK = '#1a1a1a';
export const REPORT_MUTED = '#6b6b6b';
export const REPORT_RULE = '#d8d4cc';
export const REPORT_ZEBRA = '#f6f4f0';

const MARGIN = 14 * PT_PER_MM;
const BODY = 9;
const LINE = 12;
const ROW_PAD = 7;

export type ReportColumn = {
  label: string;
  /** Share of the table width; the shares of one table sum to 1. */
  width: number;
  align?: 'left' | 'center' | 'right';
  /** `box` — an empty square to tick; `line` — a rule to sign on; `text` (default). */
  kind?: 'text' | 'box' | 'line';
  /** Wrap onto several lines instead of shrinking to fit. */
  wrap?: boolean;
};

export type ReportRow = {
  cells: string[];
  /** A smaller second line under the first cell (a companion's name, a note). */
  sub?: string | null;
  /** Greyed — listed, not counted. */
  muted?: boolean;
};

export type ReportSection = {
  heading?: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  /** Printed when there are no rows — never a silent blank table. */
  empty: string;
};

export type ReportInput = {
  piece: PrintPieceKey;
  title: string;
  subtitle?: string | null;
  /** One line of totals under the title. */
  summary?: string | null;
  sections: ReportSection[];
  /** A note printed once, under the last table. */
  footnote?: string | null;
};

function blankPage(piece: PrintPieceKey): PrintDoc {
  const spec = PRINT_PIECES[piece];
  return {
    piece,
    w: spec.widthPt,
    h: spec.heightPt,
    bleed: 0,
    die: 'rect',
    diePath: diePathFor('rect', spec.widthPt, spec.heightPt),
    ops: [{ t: 'rect', x: 0, y: 0, w: spec.widthPt, h: spec.heightPt, fill: '#ffffff' }],
  };
}

/** The lines a cell prints — wrapped when its column wraps, else one line. */
function cellLines(value: string, col: ReportColumn, width: number): string[] {
  if (col.kind === 'box' || col.kind === 'line') return [''];
  if (!col.wrap) return [value];
  const lines = wrap(value, 'poppins', BODY, width - 8);
  return lines.length ? lines : [''];
}

/**
 * Lay a report out on as many A4 pages as it needs. Page 1 carries the title
 * block; every page after it a running head; every page a "page n of N" foot.
 * A table's header row repeats at the top of each page it continues onto.
 */
export function layoutReport(input: ReportInput): PrintDoc[] {
  const pages: PrintDoc[] = [];
  let page = blankPage(input.piece);
  pages.push(page);
  const W = page.w;
  const H = page.h;
  const tableW = W - MARGIN * 2;
  const bottom = H - MARGIN - 18;

  // ── Title block (page 1 only).
  let y = MARGIN + 18;
  drawText(page.ops, input.title, MARGIN, y, { font: 'cardoBold', size: 20, color: REPORT_INK, maxWidth: tableW });
  y += 16;
  if (input.subtitle) {
    drawText(page.ops, input.subtitle, MARGIN, y, { font: 'poppins', size: 9, color: REPORT_MUTED, maxWidth: tableW });
    y += 14;
  }
  if (input.summary) {
    page.ops.push({ t: 'rect', x: MARGIN, y: y - 4, w: tableW, h: 0.6, fill: REPORT_RULE });
    drawText(page.ops, input.summary, MARGIN, y + 10, { font: 'poppinsMedium', size: 9, color: REPORT_INK, maxWidth: tableW });
    page.ops.push({ t: 'rect', x: MARGIN, y: y + 17, w: tableW, h: 0.6, fill: REPORT_RULE });
    y += 30;
  } else y += 8;

  const newPage = () => {
    page = blankPage(input.piece);
    pages.push(page);
    drawText(page.ops, input.title, MARGIN, MARGIN, { font: 'poppins', size: 7, color: REPORT_MUTED, maxWidth: tableW });
    y = MARGIN + 16;
  };

  const header = (cols: ReportColumn[]) => {
    let x = MARGIN;
    for (const c of cols) {
      const w = c.width * tableW;
      const ax = c.align === 'center' ? x + w / 2 : c.align === 'right' ? x + w - 4 : x + 4;
      drawText(page.ops, c.label, ax, y, { font: 'poppinsMedium', size: 6.8, color: REPORT_MUTED, align: c.align ?? 'left', caps: true, tracking: 0.08, maxWidth: w - 6 });
      x += w;
    }
    page.ops.push({ t: 'rect', x: MARGIN, y: y + 5, w: tableW, h: 0.8, fill: REPORT_INK, opacity: 0.6 });
    y += 9;
  };

  for (const section of input.sections) {
    const cols = section.columns;
    // A heading never strands at a page foot with no row under it.
    if (y + 60 > bottom) newPage();
    if (section.heading) {
      y += 8;
      drawText(page.ops, section.heading, MARGIN, y, { font: 'cardoBold', size: 12, color: REPORT_INK, maxWidth: tableW });
      y += 12;
    }
    y += 6;
    header(cols);
    if (!section.rows.length) {
      y += 14;
      drawText(page.ops, section.empty, MARGIN + 4, y, { font: 'poppins', size: BODY, color: REPORT_MUTED, maxWidth: tableW - 8 });
      y += 10;
      continue;
    }
    section.rows.forEach((row, i) => {
      const widths = cols.map((c) => c.width * tableW);
      const lines = cols.map((c, k) => cellLines(row.cells[k] ?? '', c, widths[k]!));
      const n = Math.max(1, ...lines.map((l) => l.length)) + (row.sub ? 1 : 0);
      const h = n * LINE + ROW_PAD;
      if (y + h > bottom) {
        newPage();
        header(cols);
      }
      if (i % 2 === 1) page.ops.push({ t: 'rect', x: MARGIN, y, w: tableW, h, fill: REPORT_ZEBRA });
      const color = row.muted ? REPORT_MUTED : REPORT_INK;
      let x = MARGIN;
      cols.forEach((c, k) => {
        const w = widths[k]!;
        const base = y + ROW_PAD / 2 + LINE - 3;
        if (c.kind === 'box') {
          const s = 9;
          page.ops.push({ t: 'rect', x: x + (w - s) / 2, y: base - s + 1.5, w: s, h: s, stroke: REPORT_INK, sw: 0.7 });
        } else if (c.kind === 'line') {
          page.ops.push({ t: 'rect', x: x + 4, y: y + h - 5, w: w - 8, h: 0.5, fill: REPORT_INK, opacity: 0.45 });
        } else {
          const ax = c.align === 'center' ? x + w / 2 : c.align === 'right' ? x + w - 4 : x + 4;
          lines[k]!.forEach((line, li) => {
            if (!line) return;
            drawText(page.ops, line, ax, base + li * LINE, {
              font: k === 0 ? 'poppinsMedium' : 'poppins',
              size: BODY,
              color,
              align: c.align ?? 'left',
              maxWidth: c.wrap ? undefined : w - 8,
            });
          });
          if (k === 0 && row.sub) {
            drawText(page.ops, row.sub, ax, base + lines[k]!.length * LINE - 1, { font: 'poppins', size: 7.2, color: REPORT_MUTED, maxWidth: w - 8 });
          }
        }
        x += w;
      });
      y += h;
      page.ops.push({ t: 'rect', x: MARGIN, y: y - 0.3, w: tableW, h: 0.3, fill: REPORT_RULE });
    });
    y += 8;
  }

  if (input.footnote) {
    const lines = wrap(input.footnote, 'poppins', 7.6, tableW);
    if (y + lines.length * 10 + 10 > bottom) newPage();
    y += 6;
    for (const l of lines) {
      drawText(page.ops, l, MARGIN, y, { font: 'poppins', size: 7.6, color: REPORT_MUTED });
      y += 10;
    }
  }

  // "page n of N" on every page, now that N is known.
  pages.forEach((p, i) => {
    drawText(p.ops, `Printed from Setnayan · page ${i + 1} of ${pages.length}`, W - MARGIN, H - MARGIN + 4, {
      font: 'poppins',
      size: 6.8,
      color: REPORT_MUTED,
      align: 'right',
    });
  });
  return pages;
}

/** A page's ops, for a caller that adds its own drawing (the seating pack's signs and cards). */
export function reportPage(piece: PrintPieceKey): { doc: PrintDoc; ops: PrintOp[] } {
  const doc = blankPage(piece);
  return { doc, ops: doc.ops };
}

export { printFileName } from '@/lib/print-pieces';

/**
 * lib/print-seating-pack.ts — the SEATING PACK as a PDF: table directory, one
 * table sign per table (with its QR), place cards (each guest's own QR).
 *
 * The pack has shipped since June as printable HTML (`seating/print/route.ts`)
 * that asks the browser's print dialog to "Save as PDF". On a phone that is
 * several taps through a dialog, and inside the App Store app it is nothing at
 * all — a web view has no print dialog to open. Owner 2026-09-25 ("PRINTS &
 * TICKETS HOLDS EVERY PRINT") wants every free print to SAVE a file. So the
 * same three parts are laid out here in the print op vocabulary and drawn by
 * `renderPrintPdf(…, { mode: 'plain' })` — the HTML stays for anyone who
 * prefers the dialog.
 *
 * Same content, same order, same grouping as the HTML: linked tables print as
 * ONE unit under their shared label with the lead table's QR (owner-locked
 * 2026-06-10). The look is the plain Classic one — ink, cream and the house
 * gold — so it is free for every event (`kind: 'free'`).
 *
 * PURE. The route renders the QR PNGs and hands them in by ref.
 */
import { drawText, type PrintDoc } from '@/lib/print-layout';
import { layoutReport, reportPage, REPORT_INK, REPORT_MUTED } from '@/lib/print-report';
import { PT_PER_MM } from '@/lib/print-pieces';

const GOLD = '#a8843f';
const MARGIN = 14 * PT_PER_MM;

export type SeatingPackUnit = {
  label: string;
  /** How many tables are joined into this unit (1 = a single table). */
  joined: number;
  /** Image ref of the unit's QR (the lead table's). */
  qrRef: string;
  guests: Array<{ name: string; qrRef: string }>;
};

export function layoutSeatingPack(input: { coupleName: string; dateLabel: string | null; units: SeatingPackUnit[] }): PrintDoc[] {
  const seated = input.units.reduce((a, u) => a + u.guests.length, 0);
  const directory = layoutReport({
    piece: 'seating-pack',
    title: input.coupleName,
    subtitle: [input.dateLabel, 'Seating pack'].filter(Boolean).join(' · '),
    summary: `${input.units.length} ${input.units.length === 1 ? 'table' : 'tables'} · ${seated} seated ${seated === 1 ? 'guest' : 'guests'}`,
    sections: [
      {
        columns: [
          { label: 'Table', width: 0.3 },
          { label: 'Guests', width: 0.7, wrap: true },
        ],
        rows: input.units.map((u) => ({
          cells: [u.label, u.guests.map((g) => g.name).join(', ') || '— no one seated —'],
          sub: u.joined > 1 ? `${u.joined} tables joined` : null,
        })),
        empty: 'No tables yet.',
      },
    ],
    footnote: 'One table sign per page follows, then the place cards — eight to a page, cut along the dashed lines.',
  });

  const pages: PrintDoc[] = [...directory];

  // ── One sign per unit.
  for (const u of input.units) {
    const { doc, ops } = reportPage('seating-pack');
    const cx = doc.w / 2;
    let y = doc.h * 0.2;
    drawText(ops, input.coupleName, cx, y, { font: 'poppinsMedium', size: 10, color: GOLD, align: 'center', caps: true, tracking: 0.3, maxWidth: doc.w - MARGIN * 2 });
    y += 76;
    drawText(ops, u.label, cx, y, { font: 'cardo', size: 64, color: REPORT_INK, align: 'center', maxWidth: doc.w - MARGIN * 2 });
    y += 34;
    const q = 250;
    ops.push({ t: 'image', ref: u.qrRef, x: cx - q / 2, y, w: q, h: q });
    y += q + 26;
    drawText(ops, 'Scan to visit our wedding', cx, y, { font: 'poppins', size: 11, color: REPORT_MUTED, align: 'center' });
    y += 18;
    drawText(ops, `${u.guests.length} seated${input.dateLabel ? ` · ${input.dateLabel}` : ''}`, cx, y, { font: 'poppins', size: 9, color: REPORT_MUTED, align: 'center' });
    pages.push(doc);
  }

  // ── Place cards, 2 × 4 per A4, dashed cut lines.
  const cards = input.units.flatMap((u) => u.guests.map((g) => ({ ...g, table: u.label })));
  const cols = 2;
  const rows = 4;
  for (let start = 0; start < cards.length; start += cols * rows) {
    const { doc, ops } = reportPage('seating-pack');
    const cw = (doc.w - MARGIN * 2) / cols;
    const ch = (doc.h - MARGIN * 2) / rows;
    cards.slice(start, start + cols * rows).forEach((c, i) => {
      const x = MARGIN + (i % cols) * cw;
      const y = MARGIN + Math.floor(i / cols) * ch;
      ops.push({ t: 'rect', x: x + 3, y: y + 3, w: cw - 6, h: ch - 6, stroke: REPORT_INK, sw: 0.5, opacity: 0.4, dash: true });
      const mid = x + cw / 2;
      drawText(ops, c.name, mid, y + 44, { font: 'cardo', size: 20, color: REPORT_INK, align: 'center', maxWidth: cw - 30 });
      drawText(ops, c.table, mid, y + 62, { font: 'poppinsMedium', size: 8.5, color: GOLD, align: 'center', caps: true, tracking: 0.08, maxWidth: cw - 30 });
      const q = Math.min(84, ch - 96);
      ops.push({ t: 'image', ref: c.qrRef, x: mid - q / 2, y: y + 74, w: q, h: q });
    });
    pages.push(doc);
  }
  return pages;
}

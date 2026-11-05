/**
 * ✂🚫 A NAME IS NEVER CUT ON PAPER — owner 2026-10-29, on the printouts: *"same goes to the print outs where some names
 * get the ..."* · *"we do not want that"*.
 *
 * The long-name fixture — `Ninong Ramon Francisco Dela Cruz-Villanueva “Monching”` (prefix · first · last, the
 * nickname beside it: `guestPrintName`) — is run through every print that names a guest and read back from what is
 * DRAWN (the PDF's own text, the print ops' own words), never from a flag:
 *   1. `guestPrintName` gives the full name with the nickname beside it;
 *   2. `fitName` never answers "…", every line fits its room, never under the floor, and the lines give the name back;
 *   3. the seat plan (`buildSeatingPdf`) — the legend and the unseated box;
 *   4. the entrance chart, by table and A to Z (`layoutEntranceChart`);
 *   5. place cards and the table directory (`layoutSeatingPack`) — and the card's name stays inside its card;
 *   6. `fitWords(…, { name: true })` (the passes' and the couple's names) at a room too small for it.
 * In each: the whole name is on the paper and no "…" is.
 *
 * 🛡 SABOTAGE (2026-10-29, seen RED, then restored): the seat plan legend's old cutter put back
 * (`while (… > COL_W) t = t.slice(0, -2) + '…'`) → test 3 fails ("the seat plan cuts a name").
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { guestPrintName } from '@/lib/guests';
import { fitName, nameLinesJoin } from '@/lib/print-name-fit';
import { buildSeatingPdf } from '@/lib/seating-pdf';
import { DEFAULT_FLOOR_PLAN, type EventTableRow } from '@/lib/seating';
import { azEntries, chartUnits, layoutEntranceChart, seatingUnits, type SeatPlanPerson } from '@/lib/print-entrance-chart';
import { layoutSeatingPack } from '@/lib/print-seating-pack';
import { PRINT_MIN_BODY_PT, fitWords, measure, type PrintDoc } from '@/lib/print-layout';
import { printableText } from '@/lib/print-pieces';

const GUEST = { guest_id: 'long', name_prefix: 'Ninong', first_name: 'Ramon Francisco', middle_name: null, last_name: 'Dela Cruz-Villanueva', name_suffix: null, display_name: 'Monching' };
const LONG = 'Ninong Ramon Francisco Dela Cruz-Villanueva “Monching”';
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
/** Whitespace aside — a name may wrap at a space or after a hyphen ("Dela Cruz-" / "Villanueva"). */
const bare = (s: string) => s.replace(/\s+/g, '');

test('1 · a printout names a guest in full, the nickname beside it', () => {
  assert.equal(guestPrintName(GUEST), LONG);
  // No nickname, or one the full name already says → the full name alone.
  assert.equal(guestPrintName({ ...GUEST, display_name: null }), 'Ninong Ramon Francisco Dela Cruz-Villanueva');
  assert.equal(guestPrintName({ ...GUEST, display_name: 'Ramon' }), 'Ninong Ramon Francisco Dela Cruz-Villanueva');
});

test('2 · fitName never cuts: it wraps, steps down to the floor, breaks a too-long word, and gives the name back whole', () => {
  const width = (t: string, z: number) => measure(printableText(t), 'cardo', z);
  for (const room of [400, 160, 90, 40, 20]) {
    const fit = fitName(LONG, { size: 20, floor: PRINT_MIN_BODY_PT, maxWidth: room, width });
    assert.ok(fit.lines.length > 0);
    assert.ok(!fit.lines.some((l) => l.includes('…')), `room ${room}: a line was cut — ${JSON.stringify(fit.lines)}`);
    assert.ok(fit.size >= PRINT_MIN_BODY_PT - 1e-9, `room ${room}: set under the floor (${fit.size})`);
    for (const l of fit.lines) assert.ok(width(l, fit.size) <= room + 1e-6 || [...l].length === 1, `room ${room}: "${l}" is wider than its room`);
    assert.equal(nameLinesJoin(fit), LONG, `room ${room}: the lines do not give the whole name back`);
  }
});

/** The words each page of a pdf-lib file draws, in order (`<hex> Tj` and `(literal) Tj`). */
async function pdfWords(bytes: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes);
  const out: string[] = [];
  for (const page of doc.getPages()) {
    const contents = page.node.get(PDFName.of('Contents'));
    const refs = contents && 'asArray' in contents ? (contents as unknown as { asArray(): unknown[] }).asArray() : [contents];
    for (const ref of refs) {
      const stream = doc.context.lookup(ref as never);
      if (!(stream instanceof PDFRawStream)) continue;
      const raw = Buffer.from(stream.contents);
      const text = (stream.dict.get(PDFName.of('Filter')) ? inflateSync(raw) : raw).toString('latin1');
      for (const m of text.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)) {
        out.push(Buffer.from(m[1]!, 'hex').toString('latin1').replace(/\x93/g, '“').replace(/\x94/g, '”').replace(/\x85/g, '…'));
      }
    }
  }
  return out;
}

function tbl(over: Partial<EventTableRow> & Pick<EventTableRow, 'table_id'>): EventTableRow {
  return { public_id: over.table_id, event_id: 'evt', table_label: over.table_id, table_type: 'round_10', capacity: 10, sort_order: 0, x_pos: 50, y_pos: 50, rotation_deg: 0, removed_seats: [], link_group_id: null, link_group_label: null, ...over };
}

test('3 · the seat plan prints the whole name — in the legend and in the unseated box', async () => {
  const bytes = await buildSeatingPdf({
    mode: 'moodboard',
    appUrl: 'https://example.test',
    event: { display_name: 'Ana & Ben', slug: null, event_date: '2026-12-12', monogram_text: 'A · B', monogram_color: '#a8843f' },
    tables: [tbl({ table_id: 't1', table_label: 'Table 1', x_pos: 40, y_pos: 40 })],
    assignments: [{ assignment_id: 'a1', table_id: 't1', guest_id: 'seated', seat_number: 0 }],
    guests: [
      { guest_id: 'seated', name: LONG, role: 'guest', rsvp_status: 'attending' },
      { guest_id: 'waiting', name: `${LONG} Jr.`, role: 'guest', rsvp_status: 'attending' },
    ],
    floorPlan: { ...DEFAULT_FLOOR_PLAN, venue_width_m: 20, venue_length_m: 30 },
    booths: [],
    signs: [],
    coupleRoles: new Set(['bride', 'groom']),
    palette: [],
    logoPng: null,
  });
  const words = await pdfWords(bytes);
  assert.ok(words.length > 10, `only ${words.length} words read — the reader is broken`);
  const cut = words.filter((w) => w.includes('…'));
  assert.deepEqual(cut, [], `the seat plan cuts a name: ${cut.join(' | ')}`);
  const all = squash(words.join(' '));
  assert.ok(bare(all).includes(bare(LONG)), 'the seated guest’s whole name is not on the plan');
  assert.ok(bare(all).includes(bare(`${LONG} Jr.`)), 'the unseated guest’s whole name is not on the plan');
});

test('4 · the entrance chart prints the whole name — by table and A to Z', () => {
  const people: SeatPlanPerson[] = [
    { ...GUEST, guest_id: 'long', plus_one_of_guest_id: null, rsvp_status: 'attending' as const },
    ...Array.from({ length: 30 }, (_, i): SeatPlanPerson => ({ guest_id: `g${i}`, first_name: `Guest${i}`, last_name: 'Santos', display_name: null, name_suffix: null, plus_one_of_guest_id: null, rsvp_status: 'attending' })),
  ];
  const tables = [
    { table_id: 't1', table_label: 'Table 1', link_group_id: null, link_group_label: null },
    { table_id: 't2', table_label: 'Table 2', link_group_id: null, link_group_label: null },
    { table_id: 't3', table_label: 'Table 3', link_group_id: null, link_group_label: null },
  ];
  const assignments = people.map((p, i) => ({ table_id: tables[i % 3]!.table_id, guest_id: p.guest_id }));
  const units = seatingUnits(tables, assignments, people);
  for (const layout of ['table', 'az'] as const) {
    const r = layoutEntranceChart({ coupleName: 'Ana & Ben', dateLabel: 'December 12, 2026', layout, size: 'a3', units: chartUnits(units), entries: azEntries(units, people) });
    assert.ok(r.ok, `${layout}: the chart did not fit`);
    const texts = r.doc.ops.flatMap((o) => (o.t === 'path' && o.text ? [o.text.s] : []));
    assert.deepEqual(texts.filter((t) => t.includes('…')), [], `${layout}: a name is cut`);
    // A to Z files by surname and prints surname first — the whole name, the nickname still beside it.
    const want = layout === 'az' ? 'Dela Cruz-Villanueva, Ninong Ramon Francisco “Monching”' : LONG;
    const near = texts.slice(Math.max(0, texts.findIndex((t) => t.startsWith('Dela'))), texts.findIndex((t) => t.startsWith('Dela')) + 4);
    assert.ok(bare(texts.join(' ')).includes(bare(want)), `${layout}: the whole name is not on the chart (want "${want}", drew ${JSON.stringify(near)})`);
  }
});

test('5 · place cards and the table directory print the whole name — inside the card', () => {
  const pages: PrintDoc[] = layoutSeatingPack({
    coupleName: 'Ana & Ben',
    dateLabel: 'December 12, 2026',
    units: [{ label: 'Table 1', joined: 1, qrRef: 'qr-t1', guests: [{ name: LONG, qrRef: 'qr-g' }, { name: 'Ana Reyes', qrRef: 'qr-a' }] }],
    signLine: 'Scan to visit our wedding',
  });
  const texts = pages.flatMap((d) => d.ops.flatMap((o) => (o.t === 'path' && o.text ? [o.text] : [])));
  assert.deepEqual(texts.filter((t) => t.s.includes('…')).map((t) => t.s), [], 'a name is cut on the pack');
  assert.ok(bare(texts.map((t) => t.s).join(' ')).includes(bare(LONG)), 'the whole name is not on a place card');
  // The card page: every line of the name sits inside its card (two cards across an A4).
  const cardPage = pages[pages.length - 2] ?? pages[pages.length - 1]!;
  const cardW = (cardPage.w - 2 * (14 * 72) / 25.4) / 2;
  for (const t of cardPage.ops.flatMap((o) => (o.t === 'path' && o.text && LONG.includes(o.text.s) ? [o.text] : []))) {
    assert.ok(t.width <= cardW - 20, `"${t.s}" is ${t.width.toFixed(1)} pt wide on a ${cardW.toFixed(1)} pt card`);
    assert.ok(t.size >= PRINT_MIN_BODY_PT - 1e-9, `"${t.s}" is set at ${t.size} pt`);
  }
});

test('6 · fitWords never cuts a name, even in a room too small for it', () => {
  const fit = fitWords(LONG, { font: 'cardo', size: 14, maxWidth: 60, floor: 8, maxLines: 2, name: true });
  assert.ok(!fit.lines.some((l) => l.includes('…')), `cut: ${JSON.stringify(fit.lines)}`);
  assert.equal(squash(fit.lines.join(' ')).replace(/\s/g, ''), LONG.replace(/\s/g, ''));
  // Anything that is not a name keeps its last-resort ellipsis.
  const other = fitWords(`Venue: ${LONG}`, { font: 'cardo', size: 14, maxWidth: 60, floor: 8, maxLines: 2 });
  assert.ok(other.lines.some((l) => l.endsWith('…')), 'the non-name fallback changed too');
});

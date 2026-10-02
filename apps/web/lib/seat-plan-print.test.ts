/**
 * THE A3 SEAT PLAN PRINTS WHAT THE OWNER NAMED (P1b, 2026-10-02).
 *
 * DECISION_LOG 2026-10-01 "THE SEAT PLAN IS THE VENUE FLOOR PLAN — ON THE
 * PHONE, IN 3D AND ON PAPER" (*"when it prints, we need to show the elements,
 * the tables with chairs, the stage, and the rest."*) and "SEAT PLAN: LINKED
 * TABLES ARE ONE TABLE · NOTHING OVERLAPS" (one legend entry per unit).
 *
 *   1 · a linked pair is ONE legend entry — its own name, the seats summed;
 *   2 · every table prints exactly one chair per seat (deleted chairs are not
 *       chairs), and a filled chair is a seated guest;
 *   3 · the unseated box is the one rule (`guestsStillToSeat`): not declined,
 *       not seated, not the couple;
 *   4 · the file itself: one A3 landscape page, drawn from booths, signs,
 *       a linked unit, a removed chair — without throwing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { seatPlanPrintModel, unitPlanName } from './seat-plan-print';
import { buildSeatingPdf, A3_LANDSCAPE, longEventDate } from './seating-pdf';
import { DEFAULT_FLOOR_PLAN, effectiveCapacity, type EventTableRow } from './seating';

function tbl(over: Partial<EventTableRow> & Pick<EventTableRow, 'table_id'>): EventTableRow {
  return {
    public_id: over.table_id,
    event_id: 'evt',
    table_label: over.table_id,
    table_type: 'round_10',
    capacity: 10,
    sort_order: 0,
    x_pos: 50,
    y_pos: 50,
    rotation_deg: 0,
    removed_seats: [],
    link_group_id: null,
    link_group_label: null,
    ...over,
  };
}

const TABLES: EventTableRow[] = [
  tbl({ table_id: 't1', table_label: 'Table 1', table_type: 'long_banquet_10', link_group_id: 'g', link_group_label: '1 + 2', x_pos: 30, y_pos: 30 }),
  tbl({ table_id: 't2', table_label: 'Table 2', table_type: 'long_banquet_10', link_group_id: 'g', link_group_label: '1 + 2', x_pos: 45, y_pos: 30 }),
  tbl({ table_id: 't3', table_label: 'Table 3', x_pos: 70, y_pos: 60, removed_seats: [9] }),
  tbl({ table_id: 'sw', table_label: 'A & B', table_type: 'sweetheart_2', capacity: 2, x_pos: 50, y_pos: 12 }),
];
const GUESTS = [
  { guest_id: 'a', name: 'Ana Reyes', role: 'guest', rsvp_status: 'attending' },
  { guest_id: 'b', name: 'Ben Santos', role: 'guest', rsvp_status: 'attending' },
  { guest_id: 'c', name: 'Carlo Cruz', role: 'guest', rsvp_status: 'pending' },
  { guest_id: 'd', name: 'Dina Lim', role: 'guest', rsvp_status: 'declined' },
  { guest_id: 'bride', name: 'Maria', role: 'bride', rsvp_status: 'attending' },
  { guest_id: 'e', name: 'Ella Tan', role: 'guest', rsvp_status: 'attending' },
];
const ASSIGN = [
  { table_id: 't1', guest_id: 'a', seat_number: 0 },
  { table_id: 't2', guest_id: 'b', seat_number: 3 },
  { table_id: 't3', guest_id: 'e', seat_number: null },
];
const COUPLE = new Set(['bride', 'groom']);

test('1 · a linked pair is ONE legend entry — its name, its seats summed', () => {
  const m = seatPlanPrintModel({ tables: TABLES, assignments: ASSIGN, guests: GUESTS, coupleRoles: COUPLE });
  const linked = m.units.filter((u) => u.tableIds.includes('t1') || u.tableIds.includes('t2'));
  assert.equal(linked.length, 1, 'two linked tables print as one entry');
  assert.equal(linked[0]!.label, '1 + 2');
  assert.deepEqual(linked[0]!.tableIds, ['t1', 't2']);
  assert.equal(linked[0]!.seats, 20);
  assert.equal(linked[0]!.seated, 2);
  assert.equal(linked[0]!.kind, 'Long · linked');
  assert.equal(m.units.length, 3, '1 + 2 · Table 3 · the sweetheart');
  assert.equal(m.tableCount, 2, 'the sweetheart is not a guest table; a linked unit counts once');
  assert.deepEqual(m.linkedLabels, ['1 + 2']);
  assert.equal(unitPlanName(linked[0]!, ['Table 1', 'Table 2']), '1 + 2');
  assert.equal(unitPlanName({ label: 'Family' }, ['Family']), 'Family');
});

test('2 · one chair per seat — a deleted chair is not printed; a filled chair is a seated guest', () => {
  const m = seatPlanPrintModel({ tables: TABLES, assignments: ASSIGN, guests: GUESTS, coupleRoles: COUPLE });
  for (const t of TABLES) {
    const chairs = m.chairs.get(t.table_id)!;
    assert.equal(chairs.length, effectiveCapacity(t.capacity, t.removed_seats), `${t.table_label}: chair count = seats`);
    assert.ok(!chairs.some((c) => (t.removed_seats ?? []).includes(c.seat)), `${t.table_label}: a deleted chair is drawn`);
  }
  assert.equal(m.chairs.get('t3')!.length, 9);
  assert.equal(m.chairs.get('t1')!.find((c) => c.seat === 0)!.name, 'Ana Reyes');
  assert.equal(m.chairs.get('t2')!.find((c) => c.seat === 3)!.name, 'Ben Santos');
  assert.equal(m.chairs.get('t3')!.filter((c) => c.name).length, 1, 'an unnumbered guest still fills a chair');
  // The legend roster walks the same chairs: open seats shown as open.
  const three = m.units.find((u) => u.label === 'Table 3')!;
  assert.equal(three.roster.length, 9);
  assert.equal(three.roster.filter((n) => n === null).length, 8);
  assert.equal(m.seatedCount, 3);
});

test('3 · the unseated box: not declined, not seated, not the couple', () => {
  const m = seatPlanPrintModel({ tables: TABLES, assignments: ASSIGN, guests: GUESTS, coupleRoles: COUPLE });
  assert.deepEqual(m.unseated, ['Carlo Cruz']);
});

test('4 · the file: one A3 landscape page with every element, a linked unit and a deleted chair', async () => {
  const bytes = await buildSeatingPdf({
    mode: 'moodboard',
    appUrl: 'https://example.test',
    event: { display_name: 'Ana & Ben', slug: null, event_date: '2026-10-03', monogram_text: 'A · B', monogram_color: '#a8843f' },
    tables: TABLES,
    assignments: ASSIGN.map((a, i) => ({ ...a, assignment_id: `x${i}` })),
    guests: GUESTS,
    floorPlan: {
      ...DEFAULT_FLOOR_PLAN,
      venue_width_m: 20,
      venue_length_m: 30,
      dance_enabled: true,
      entrance_enabled: true,
      service_entrance_enabled: true,
    },
    booths: [{ booth_id: 'b1', label: 'Buffet', x_pos: 90, y_pos: 20, event_vendor_id: 'v1', zone: 'reception' }],
    signs: [{ sign_id: 's1', label: 'Sign', x_pos: 10, y_pos: 10 }],
    coupleRoles: COUPLE,
    palette: [],
    logoPng: null,
  });
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  const { width, height } = pdf.getPage(0).getSize();
  assert.ok(Math.abs(width - A3_LANDSCAPE.w) < 0.5 && Math.abs(height - A3_LANDSCAPE.h) < 0.5, 'A3 landscape');
  assert.equal(longEventDate('2026-10-03'), 'Saturday 3 October 2026');
});

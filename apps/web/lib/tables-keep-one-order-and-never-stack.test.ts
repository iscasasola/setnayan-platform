/**
 * tables-keep-one-order-and-never-stack.test.ts — 🪑 the owner, live on his own event (2026-11-01): *"not organizing the
 * seats properly"*. Measured there (read-only): Tables 1–3 all at sort_order 0, the rest 1…22 out of label order, two
 * tables stored on one spot (100, 100), two on the bottom edge. Reproduced here on DUMMY rows of the same shape.
 *
 *   1 · ONE ORDER: the label read naturally, then sort_order — every seats reader gets it from `fetchTables`.
 *   2 · NO STACK: two tables on one spot are drawn apart and an edge table drawn inside — display only, rows untouched;
 *       the 2D plan and the 3D room both draw through it.
 *   3 · A new table takes the NEXT sort_order (no more ties).
 *   4 · BESIDE EACH OTHER: a guest and their +1s take a run of consecutive chairs, on a cale-ice-shaped room
 *       (25 tables, ~230 guests, groups, pairs, a half-filled table).
 *
 * SABOTAGE (each seen red, then restored): `compareTables` by sort_order only → 1 · `spreadForDisplay` returning the
 * rows as given → 2 · the `consecutiveRun` branch removed from `computeAutoSeat` → 4.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { compareTables, sortTables, spreadForDisplay, EDGE_INSET } from './table-order';
import { computeAutoSeat, consecutiveRun, type AutoSeatGuest, type EventTableRow, type SeatAssignmentRow } from './seating';

const read = (rel: string) => stripComments(readFileSync(join(__dirname, '..', rel), 'utf8'));

/** A cale-ice-shaped room: Table 1…25, Tables 1–3 tied at sort_order 0, the rest shuffled; 17 & 18 on one spot. */
function room(): EventTableRow[] {
  const order = [0, 0, 0, ...Array.from({ length: 22 }, (_, i) => ((i * 7) % 22) + 1)];
  return Array.from({ length: 25 }, (_, i) => ({
    table_id: `t${String(i + 1).padStart(2, '0')}`,
    public_id: `S89T-DUMMY${i}`,
    event_id: 'dummy',
    table_label: `Table ${i + 1}`,
    table_type: 'round_10' as EventTableRow['table_type'],
    capacity: 10,
    sort_order: order[i]!,
    x_pos: i === 16 || i === 17 ? 100 : i === 12 || i === 13 ? 20 + i * 5 : 10 + (i % 5) * 20,
    y_pos: i === 16 || i === 17 ? 100 : i === 12 || i === 13 ? 100 : 15 + Math.floor(i / 5) * 15,
    removed_seats: [],
  }));
}

test('1 · one order: the label read naturally, then sort_order — ties and shuffles never reorder the tables', () => {
  const shuffled = [...room()].sort((a, b) => a.sort_order - b.sort_order || b.table_id.localeCompare(a.table_id));
  assert.deepEqual(sortTables(shuffled).map((t) => t.table_label), Array.from({ length: 25 }, (_, i) => `Table ${i + 1}`));
  assert.ok(compareTables({ table_id: 'a', table_label: 'Table 2', sort_order: 9 }, { table_id: 'b', table_label: 'Table 10', sort_order: 0 }) < 0, '"Table 10" sorts before "Table 2"');
  assert.ok(compareTables({ table_id: 'a', table_label: 'VIP', sort_order: 1 }, { table_id: 'b', table_label: 'vip', sort_order: 2 }) < 0, 'a label tie does not fall back to sort_order');
  assert.match(read('lib/seating.ts'), /return sortTables\(\(data \?\? \[\]\)\.map\(/, 'fetchTables hands the readers its own stored order');
});

test('2 · no stack: one spot is fanned out, an edge table drawn inside, nothing written — the 2D plan and the 3D room draw it', () => {
  const rows = room();
  const before = JSON.stringify(rows);
  const drawn = spreadForDisplay(rows);
  assert.equal(JSON.stringify(rows), before, 'the rows themselves were changed');
  const at = (id: string) => drawn.find((t) => t.table_id === id)!;
  const a = at('t17');
  const b = at('t18');
  assert.ok(Math.hypot(a.x_pos! - b.x_pos!, a.y_pos! - b.y_pos!) >= 5, 'Tables 17 and 18 are still drawn on one spot');
  for (const t of drawn) {
    assert.ok(t.x_pos! >= EDGE_INSET && t.x_pos! <= 100 - EDGE_INSET && t.y_pos! >= EDGE_INSET && t.y_pos! <= 100 - EDGE_INSET, `${t.table_label} is drawn on the plan's edge`);
  }
  assert.equal(at('t01').x_pos, 10, 'a table on its own spot was moved');
  assert.match(read('app/dashboard/[eventId]/seating/page.tsx'), /tables=\{spreadForDisplay\(tables\)\}/, 'the 2D plan draws the stored spots');
  assert.match(read('app/dashboard/[eventId]/seating/lab/page.tsx'), /spreadForDisplay\(tablesRaw\)\.map\(/, 'the 3D room draws the stored spots');
});

test('3 · a new table takes the next sort_order', () => {
  const act = read('app/dashboard/[eventId]/seating/actions.ts');
  const fn = act.slice(act.indexOf('export async function createTable('));
  assert.match(fn.slice(0, 4000), /const nextSort = \(\(last as \{ sort_order\?: number \} \| null\)\?\.sort_order \?\? -1\) \+ 1;[\s\S]{0,400}?sort_order: nextSort,/, 'a new table is left at sort_order 0');
  assert.match(act, /sort_order: maxSort \+ 1 \+ i,/, 'auto arrange’s added tables no longer number on from the last');
});

test('4 · beside each other: a guest and their +1s take consecutive chairs (cale-ice-shaped room)', () => {
  assert.deepEqual(consecutiveRun(new Set([1, 3]), 10, 2), [4, 5]);
  assert.deepEqual(consecutiveRun(new Set([1, 2, 3, 4, 5, 6, 7]), 10, 3), [8, 9, 0], 'the run does not wrap past the last chair');
  assert.equal(consecutiveRun(new Set([0, 2, 4, 6, 8]), 10, 2), null);
  const tables = room();
  // Every table already has chairs 0 and 2 taken (seated by hand) — the old seater handed a pair chairs 1 and 3.
  const assignments: SeatAssignmentRow[] = tables.flatMap((t) => [0, 2].map((s) => ({ assignment_id: `a${t.table_id}${s}`, table_id: t.table_id, guest_id: `pre${t.table_id}${s}`, seat_number: s })));
  const guests: AutoSeatGuest[] = [];
  let n = 0;
  const add = (over: Partial<AutoSeatGuest>) => {
    const g: AutoSeatGuest = { guest_id: `g${n++}`, role: 'guest', group_category: 'friends', rsvp_status: 'attending', plus_one_of_guest_id: null, last_name: 'Cruz', first_name: `G${n}`, group_id: null, ...over } as AutoSeatGuest;
    guests.push(g);
    return g;
  };
  for (let grp = 0; grp < 20; grp++) {
    for (let k = 0; k < 9; k++) {
      const host = add({ group_id: `grp${grp}` });
      if (k % 3 === 0) add({ group_id: `grp${grp}`, plus_one_of_guest_id: host.guest_id });
    }
  }
  for (const p of assignments) guests.push({ guest_id: p.guest_id, role: 'guest', group_category: 'friends', rsvp_status: 'attending', plus_one_of_guest_id: null, last_name: 'Pre', first_name: 'P', group_id: null } as AutoSeatGuest);
  const rows = computeAutoSeat(tables, guests, assignments);
  assert.ok(rows.length > 180, `only ${rows.length} seated — the fixture is not cale-ice-shaped`);
  const seat = new Map(rows.map((r) => [r.guest_id, r]));
  let pairs = 0;
  for (const g of guests) {
    if (!g.plus_one_of_guest_id) continue;
    const a = seat.get(g.plus_one_of_guest_id);
    const b = seat.get(g.guest_id);
    if (!a || !b) continue;
    pairs++;
    assert.equal(a.table_id, b.table_id, `${g.guest_id} sits at another table than the guest who brings them`);
    const gap = Math.abs(a.seat_number - b.seat_number);
    assert.ok(gap === 1 || gap === 9, `${g.guest_id} is not beside the guest who brings them (seats ${a.seat_number} · ${b.seat_number})`);
  }
  assert.ok(pairs >= 40, `only ${pairs} pairs checked`);
});

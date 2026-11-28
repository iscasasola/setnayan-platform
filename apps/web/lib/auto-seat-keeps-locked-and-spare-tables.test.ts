/**
 * 🔒 AUTO ARRANGE NEVER SEATS ANYONE AT A LOCKED TABLE OR A SPARE ONE (seat plan § 5 hard rules; corpus
 * SEAT-PLAN-COMPLETE-2026-11-27.md: "locked seats and locked tables", "Spare tables stay empty", and § 7 property
 * "nobody is ever seated at a Spare table" / "no locked guest or locked table moves"). Executed on the shipped seater.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { autoSeatRoom, autoSeatTakesTable, computeAutoSeat, type AutoSeatGuest, type EventTableRow } from '@/lib/seating';
import { seatsThatStay, seatsToClear } from '@/lib/seat-plan-scope';

const table = (id: string, n: number, over: Partial<EventTableRow> = {}): EventTableRow => ({
  table_id: id,
  public_id: `S89T-${id}`,
  event_id: 'e',
  table_label: `Table ${n}`,
  table_type: 'round_10',
  capacity: 10,
  sort_order: n,
  x_pos: 20 * n,
  y_pos: 30,
  ...over,
});

const guests = (n: number): AutoSeatGuest[] =>
  Array.from({ length: n }, (_, i) => ({
    guest_id: `g${String(i).padStart(2, '0')}`,
    role: 'guest',
    group_category: 'friends',
    rsvp_status: 'attending',
    plus_one_of_guest_id: null,
    last_name: `L${i}`,
    first_name: `F${i}`,
    group_id: null,
  }));

test('the one rule: sweetheart, locked and spare tables are closed to the seater', () => {
  assert.equal(autoSeatTakesTable({ table_type: 'round_10' }), true);
  assert.equal(autoSeatTakesTable({ table_type: 'sweetheart_2' }), false);
  assert.equal(autoSeatTakesTable({ table_type: 'round_10', locked: true }), false);
  assert.equal(autoSeatTakesTable({ table_type: 'round_10', table_kind: 'spare' }), false);
  assert.equal(autoSeatTakesTable({ table_type: 'round_10', table_kind: 'vip' }), true);
  assert.equal(autoSeatTakesTable({ table_type: 'round_10', table_kind: 'elders' }), true);
});

test('nobody is seated at a Spare table or a locked one, even when the open tables run out', () => {
  const tables = [table('open', 1), table('spare', 2, { table_kind: 'spare' }), table('lock', 3, { locked: true })];
  const rows = computeAutoSeat(tables, guests(25), []);
  assert.ok(rows.length > 0);
  for (const r of rows) assert.equal(r.table_id, 'open', `${r.guest_id} was seated at ${r.table_id}`);
  assert.equal(rows.length, 10, 'only the open table\'s ten chairs are used');
});

test('the room count leaves the closed tables out, so auto arrange adds tables instead', () => {
  const tables = [table('open', 1), table('spare', 2, { table_kind: 'spare' }), table('lock', 3, { locked: true })];
  const room = autoSeatRoom(tables, guests(25), []);
  assert.equal(room.freeSeats, 10);
  assert.equal(room.shortfall, 15);
});

test('"seat everyone again" keeps a locked table exactly as it is', () => {
  const seats = [
    { guest_id: 'a', table_id: 'lock', seat_number: 0, locked: false },
    { guest_id: 'b', table_id: 'open', seat_number: 0, locked: false },
    { guest_id: 'c', table_id: 'open', seat_number: 1, locked: true },
  ];
  const lockedTables = new Set(['lock']);
  assert.deepEqual(seatsToClear(seats, true, lockedTables).map((s) => s.guest_id), ['b']);
  assert.deepEqual(seatsThatStay(seats, true, lockedTables).map((s) => s.guest_id), ['a', 'c']);
  // "Clear all, locked too" is the host's own choice and clears everything.
  assert.deepEqual(seatsToClear(seats, false, lockedTables).map((s) => s.guest_id), ['a', 'b', 'c']);
});

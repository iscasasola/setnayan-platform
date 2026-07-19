/**
 * Unit suite for reconcileProvisionalSeats (smart seat-plan · Phase 5 — live
 * provisional seating). Load-bearing invariants:
 *  - a newly-added (unseated) guest is gap-filled without a reseat flag (#3),
 *  - a LOCKED (Phase 4) seat is never vacated, even when flagged for reseat,
 *  - reseating a custom group re-clusters its members onto one table (#9),
 *  - a guest who had a seat is never silently double-booked — a vacated seat
 *    reused by someone else releases the stale row instead,
 *  - the pass is idempotent (everyone seated → empty delta).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  reconcileProvisionalSeats,
  type EventTableRow,
  type AutoSeatGuest,
  type SeatAssignmentRow,
} from './seating';

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
    qr_token: '',
    qr_published_at: null,
    link_group_id: null,
    link_group_label: null,
    ...over,
  } as EventTableRow;
}

function guest(over: Partial<AutoSeatGuest> & Pick<AutoSeatGuest, 'guest_id'>): AutoSeatGuest {
  return {
    role: 'friend',
    group_category: 'friends',
    rsvp_status: 'attending',
    plus_one_of_guest_id: null,
    last_name: over.guest_id,
    first_name: over.guest_id,
    group_id: null,
    seating_priority: null,
    ...over,
  };
}

function seat(
  guest_id: string,
  table_id: string,
  seat_number: number,
  locked = false,
): SeatAssignmentRow {
  return { assignment_id: `${guest_id}@${table_id}`, table_id, guest_id, seat_number, locked };
}

// A near table (small y) beats a far one for stage proximity (stage = y≈8).
const near = tbl({ table_id: 'near', capacity: 10, y_pos: 10 });
const far = tbl({ table_id: 'far', capacity: 10, y_pos: 90 });

// ── #3 — a new guest is auto-seated with no reseat flag ──────────────────────

test('gap-fill: an unseated (newly-added) guest is placed without a reseat flag', () => {
  const t = tbl({ table_id: 't', capacity: 2 });
  const res = reconcileProvisionalSeats({
    tables: [t],
    guests: [guest({ guest_id: 'g0' }), guest({ guest_id: 'g1' })],
    assignments: [seat('g0', 't', 0)],
  });
  assert.equal(res.assign.length, 1);
  assert.equal(res.assign[0]?.guest_id, 'g1');
  assert.equal(res.assign[0]?.table_id, 't');
  assert.deepEqual(res.release, []);
  assert.deepEqual(res.needsTable, []);
});

// ── idempotence — everyone seated, nothing flagged → empty delta ─────────────

test('idempotent: a fully-seated list with no reseat yields an empty delta', () => {
  const t = tbl({ table_id: 't', capacity: 4 });
  const res = reconcileProvisionalSeats({
    tables: [t],
    guests: [guest({ guest_id: 'a' }), guest({ guest_id: 'b' })],
    assignments: [seat('a', 't', 0), seat('b', 't', 1)],
  });
  assert.deepEqual(res.assign, []);
  assert.deepEqual(res.release, []);
  assert.deepEqual(res.needsTable, []);
});

// ── locked seats are immovable even when flagged for reseat ──────────────────

test('a LOCKED seat is never vacated, even when its guest is flagged for reseat', () => {
  const res = reconcileProvisionalSeats({
    tables: [near, far],
    guests: [guest({ guest_id: 'gL' })],
    assignments: [seat('gL', 'far', 0, /* locked */ true)],
    reseatGuestIds: ['gL'],
  });
  // The pin holds: no move proposed, nothing released, guest still seated.
  assert.deepEqual(res.assign, []);
  assert.deepEqual(res.release, []);
  assert.deepEqual(res.needsTable, []);
});

// ── #9 — reseating a group re-clusters its members onto one table ────────────

test('reseat re-clusters a custom group onto a single table (#9 group priority)', () => {
  const gA = guest({ guest_id: 'gA', group_id: 'grp' });
  const gB = guest({ guest_id: 'gB', group_id: 'grp' });
  // Both currently scattered on the far table; flag both for reseat.
  const res = reconcileProvisionalSeats({
    tables: [near, far],
    guests: [gA, gB],
    assignments: [seat('gA', 'far', 0), seat('gB', 'far', 1)],
    reseatGuestIds: ['gA', 'gB'],
  });
  assert.equal(res.assign.length, 2);
  const tables = new Set(res.assign.map((r) => r.table_id));
  assert.equal(tables.size, 1); // clustered onto one table…
  assert.equal([...tables][0], 'near'); // …the stage-closest one
  assert.deepEqual(res.release, []);
});

// ── no double-booking: a vacated seat reused by another releases the stale row ─

test('reseat never double-books: a reused seat releases the displaced guest', () => {
  const t = tbl({ table_id: 't', capacity: 1 });
  // 'z' holds the only seat; 'a' is unseated and sorts first by name.
  const res = reconcileProvisionalSeats({
    tables: [t],
    guests: [guest({ guest_id: 'a' }), guest({ guest_id: 'z' })],
    assignments: [seat('z', 't', 0)],
    reseatGuestIds: ['z'],
  });
  // 'a' takes the freed seat; 'z' can't be re-placed and its stale row is released.
  assert.equal(res.assign.length, 1);
  assert.equal(res.assign[0]?.guest_id, 'a');
  assert.deepEqual(res.release, ['z']);
  assert.ok(res.needsTable.includes('z'));
  // Invariant: no two placements share a table+seat.
  const keys = res.assign.map((r) => `${r.table_id}#${r.seat_number}`);
  assert.equal(new Set(keys).size, keys.length);
});

// ── needsTable surfaces guests the pool can't seat; declined are excluded ─────

test('needsTable lists eligible guests with no seat; declined guests are excluded', () => {
  const t = tbl({ table_id: 't', capacity: 1 });
  const res = reconcileProvisionalSeats({
    tables: [t],
    guests: [
      guest({ guest_id: 'seated' }),
      guest({ guest_id: 'overflow1' }),
      guest({ guest_id: 'overflow2' }),
      guest({ guest_id: 'nope', rsvp_status: 'declined' }),
    ],
    assignments: [seat('seated', 't', 0)],
  });
  assert.deepEqual(res.assign, []); // table is full
  assert.ok(res.needsTable.includes('overflow1'));
  assert.ok(res.needsTable.includes('overflow2'));
  assert.ok(!res.needsTable.includes('seated'));
  assert.ok(!res.needsTable.includes('nope')); // declined never needs a table
});

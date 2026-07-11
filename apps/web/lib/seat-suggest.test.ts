/**
 * Unit suite for the pure seat-SUGGESTION heuristic (Living Roster · P3). Proves
 * `suggestTableFor` without a browser: the role-tier → stage-proximity banding,
 * the side split for general guests, the free-seat preference, and the graceful
 * fallbacks (no tables / sweetheart-only / everything full).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestTableFor, type SuggestGuest } from './seat-suggest';
import type { EventTableRow, SeatAssignmentRow } from './seating';

// A table at x=50 so its stage distance is purely (y - 8)^2 → ascending `y`
// gives a deterministic stage-nearest-first order (T1 nearest … Tn farthest).
function mk(
  label: string,
  y: number,
  opts: { capacity?: number; type?: EventTableRow['table_type'] } = {},
): EventTableRow {
  return {
    table_id: `id-${label}`,
    public_id: `pub-${label}`,
    event_id: 'evt',
    table_label: label,
    table_type: opts.type ?? 'round_10',
    capacity: opts.capacity ?? 8,
    sort_order: y,
    x_pos: 50,
    y_pos: y,
    rotation_deg: 0,
    removed_seats: [],
  };
}

// Six round tables, stage-nearest (T1) → farthest (T6).
const SIX: EventTableRow[] = [
  mk('T1', 10),
  mk('T2', 20),
  mk('T3', 30),
  mk('T4', 40),
  mk('T5', 50),
  mk('T6', 60),
];

const BASE: SuggestGuest = {
  role: 'guest',
  group_category: 'other',
  side: 'both',
  seating_priority: null,
};

const noSeats: SeatAssignmentRow[] = [];

// Fill a table to (below) capacity so it has no free chair left.
function fill(tableId: string, n: number): SeatAssignmentRow[] {
  return Array.from({ length: n }, (_, i) => ({
    assignment_id: `a-${tableId}-${i}`,
    table_id: tableId,
    guest_id: `g-${tableId}-${i}`,
    seat_number: i,
    locked: false,
  }));
}

// ── empty / degenerate ───────────────────────────────────────────────────────

test('no tables → null', () => {
  assert.equal(suggestTableFor(BASE, [], noSeats), null);
});

test('only the couple sweetheart → null (nothing left to suggest)', () => {
  const tables = [mk('Sweetheart', 6, { type: 'sweetheart_2', capacity: 2 })];
  assert.equal(suggestTableFor(BASE, tables, noSeats), null);
});

// ── tier → stage-proximity banding (via explicit seating_priority override) ────

test('priority tier 1 → the stage-nearest table', () => {
  assert.equal(suggestTableFor({ ...BASE, seating_priority: 1 }, SIX, noSeats), 'T1');
});

test('priority tier 2 → second-nearest table', () => {
  assert.equal(suggestTableFor({ ...BASE, seating_priority: 2 }, SIX, noSeats), 'T2');
});

test('priority tier 3 → third-nearest table', () => {
  assert.equal(suggestTableFor({ ...BASE, seating_priority: 3 }, SIX, noSeats), 'T3');
});

// ── general guests split by side ───────────────────────────────────────────────

test('tier 4 · bride side → the tier-4 band (T4)', () => {
  assert.equal(
    suggestTableFor({ ...BASE, seating_priority: 4, side: 'bride' }, SIX, noSeats),
    'T4',
  );
});

test('tier 4 · groom side → one table over (T5), so the families lean apart', () => {
  assert.equal(
    suggestTableFor({ ...BASE, seating_priority: 4, side: 'groom' }, SIX, noSeats),
    'T5',
  );
});

// ── role-derived tier (proves the guestTier integration, not just overrides) ───

test('a plain "guest" role derives tier 4 → banded table by side', () => {
  // No seating_priority → tier comes from guestTier('guest', 'other') = 4.
  assert.equal(suggestTableFor({ ...BASE, side: 'bride' }, SIX, noSeats), 'T4');
  assert.equal(suggestTableFor({ ...BASE, side: 'groom' }, SIX, noSeats), 'T5');
});

test('a tier-1 role (principal_sponsor) → the stage-nearest table', () => {
  assert.equal(
    suggestTableFor({ ...BASE, role: 'principal_sponsor' }, SIX, noSeats),
    'T1',
  );
});

// ── free-seat preference ───────────────────────────────────────────────────────

test('a full banded table is skipped for the next table with room', () => {
  // T1 (capacity 8) is completely taken → a tier-1 guest walks to T2.
  const assignments = fill('id-T1', 8);
  assert.equal(
    suggestTableFor({ ...BASE, seating_priority: 1 }, SIX, assignments),
    'T2',
  );
});

test('a partially-full banded table still has room → keeps it', () => {
  const assignments = fill('id-T1', 7); // 1 chair left of 8
  assert.equal(
    suggestTableFor({ ...BASE, seating_priority: 1 }, SIX, assignments),
    'T1',
  );
});

test('every table full → falls back to the banded label (hint, not a guarantee)', () => {
  const assignments = SIX.flatMap((t) => fill(t.table_id, 8));
  assert.equal(
    suggestTableFor({ ...BASE, seating_priority: 2 }, SIX, assignments),
    'T2',
  );
});

// ── clamps past the pool ───────────────────────────────────────────────────────

test('tier band past the last table clamps to the farthest table', () => {
  // Only two tables, a tier-4 groom would index to 4 → clamp to the last (T2).
  const two = [mk('T1', 10), mk('T2', 20)];
  assert.equal(
    suggestTableFor({ ...BASE, seating_priority: 4, side: 'groom' }, two, noSeats),
    'T2',
  );
});

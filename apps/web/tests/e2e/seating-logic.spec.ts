import { expect, test } from '@playwright/test';
import {
  computeAutoSeat,
  computeSeatingStats,
  defaultTablePosition,
  effectiveCapacity,
  fitFloorTransform,
  removedSeatSet,
  rotatePoint,
  roleTier,
  tableGeometry,
  TABLE_TYPE_CATALOG,
  type AutoSeatGuest,
  type EventTableRow,
  type SeatAssignmentRow,
} from '../../lib/seating';

/**
 * Pure-logic tests for the seat-plan engine (iteration 0008).
 *
 * These run inside the existing Playwright job with NO browser/page and NO
 * dev server — they exercise lib/seating.ts directly, so the auto-seat
 * algorithm, capacity math and table geometry are pinned in CI on every PR.
 * (The repo has no separate unit-test runner; the Playwright suite is the
 * standing test harness per playwright.config.ts.)
 */

// --- tiny fixture builders --------------------------------------------------

let seq = 0;
function mkTable(partial: Partial<EventTableRow> & Pick<EventTableRow, 'table_id'>): EventTableRow {
  seq += 1;
  return {
    public_id: `T-TEST${seq}`,
    event_id: 'evt-1',
    table_label: `Table ${seq}`,
    table_type: 'round_8',
    capacity: 8,
    sort_order: seq,
    x_pos: null,
    y_pos: null,
    rotation_deg: 0,
    removed_seats: [],
    ...partial,
  };
}

function mkGuest(partial: Partial<AutoSeatGuest> & Pick<AutoSeatGuest, 'guest_id'>): AutoSeatGuest {
  return {
    role: 'guest',
    group_category: 'friends',
    rsvp_status: 'attending',
    plus_one_of_guest_id: null,
    last_name: partial.guest_id,
    first_name: 'Test',
    group_id: null,
    ...partial,
  };
}

const STAGE = { x: 50, y: 0 };

// --- removedSeatSet / effectiveCapacity --------------------------------------

test.describe('seat removal math', () => {
  test('removedSeatSet keeps only valid in-range indices', () => {
    const set = removedSeatSet([0, 3, 7, -1, 8, 2.5, 99], 8);
    expect([...set].sort()).toEqual([0, 3, 7]);
  });

  test('removedSeatSet handles null/undefined', () => {
    expect(removedSeatSet(null, 8).size).toBe(0);
    expect(removedSeatSet(undefined, 8).size).toBe(0);
  });

  test('effectiveCapacity subtracts only valid removals', () => {
    expect(effectiveCapacity(8, [0, 1])).toBe(6);
    expect(effectiveCapacity(8, [99, -1])).toBe(8); // out-of-range ignored
    expect(effectiveCapacity(2, [0, 1])).toBe(0); // fully removed
  });
});

// --- roleTier -----------------------------------------------------------------

test.describe('roleTier', () => {
  test('classifies the four tiers like the auto-seat rings', () => {
    expect(roleTier('principal_sponsor', 'friends')).toBe(1);
    expect(roleTier('officiant', 'work')).toBe(1);
    expect(roleTier('best_man', 'friends')).toBe(2);
    expect(roleTier('flower_girl', 'family')).toBe(2); // role beats category
    expect(roleTier('guest', 'family')).toBe(3);
    expect(roleTier('guest', 'friends')).toBe(4);
  });
});

// --- tableGeometry -------------------------------------------------------------

test.describe('tableGeometry', () => {
  test('every catalog type yields its capacity in seats with a positive box', () => {
    for (const entry of TABLE_TYPE_CATALOG) {
      const geo = tableGeometry(entry.shapeHint, entry.defaultCapacity);
      expect(geo.seats.length, entry.type).toBe(
        entry.shapeHint === 'sweetheart'
          ? Math.min(entry.defaultCapacity, 2)
          : entry.shapeHint === 'serpentine'
            ? Math.min(entry.defaultCapacity, 5)
            : entry.defaultCapacity,
      );
      expect(geo.box.w, entry.type).toBeGreaterThan(0);
      expect(geo.box.h, entry.type).toBeGreaterThan(0);
    }
  });

  test('sweetheart caps at 2 side-by-side seats; serpentine at 5 with a ribbon outline', () => {
    expect(tableGeometry('sweetheart', 10).seats.length).toBe(2);
    const serp = tableGeometry('serpentine', 12);
    expect(serp.seats.length).toBe(5);
    expect(serp.outline && serp.outline.length).toBeGreaterThan(8);
  });
});

// --- rotatePoint / fitFloorTransform -------------------------------------------

test.describe('geometry transforms', () => {
  test('rotatePoint rotates 90° clockwise in y-down seat space', () => {
    const p = rotatePoint({ x: 10, y: 0 }, 90);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(10, 6);
  });

  test('rotatePoint with 0° is identity', () => {
    expect(rotatePoint({ x: 3, y: 4 }, 0)).toEqual({ x: 3, y: 4 });
  });

  test('fitFloorTransform is identity when points are inside 0–100', () => {
    const tf = fitFloorTransform([
      { x: 10, y: 10 },
      { x: 90, y: 90 },
    ]);
    expect(tf(10, 10)).toEqual({ x: 10, y: 10 });
  });

  test('fitFloorTransform maps a spread layout back into bounds', () => {
    const pts = [
      { x: -50, y: 0 },
      { x: 250, y: 300 },
    ];
    const tf = fitFloorTransform(pts, 6);
    for (const p of pts) {
      const m = tf(p.x, p.y);
      expect(m.x).toBeGreaterThanOrEqual(5.9);
      expect(m.x).toBeLessThanOrEqual(94.1);
      expect(m.y).toBeGreaterThanOrEqual(5.9);
      expect(m.y).toBeLessThanOrEqual(94.1);
    }
  });
});

// --- computeAutoSeat -------------------------------------------------------------

test.describe('computeAutoSeat', () => {
  test('seats only attending, unseated, non-couple guests', () => {
    const tables = [mkTable({ table_id: 't1', x_pos: 50, y_pos: 10 })];
    const guests = [
      mkGuest({ guest_id: 'attending' }),
      mkGuest({ guest_id: 'declined', rsvp_status: 'declined' }),
      mkGuest({ guest_id: 'pending', rsvp_status: 'pending' }),
      mkGuest({ guest_id: 'bride', role: 'bride' }),
      mkGuest({ guest_id: 'groom', role: 'groom' }),
    ];
    const rows = computeAutoSeat(tables, guests, [], STAGE);
    expect(rows.map((r) => r.guest_id)).toEqual(['attending']);
  });

  test('is idempotent — already-seated guests are never moved or duplicated', () => {
    const tables = [mkTable({ table_id: 't1', x_pos: 50, y_pos: 10, capacity: 4 })];
    const assignments: SeatAssignmentRow[] = [
      { assignment_id: 'a1', table_id: 't1', guest_id: 'g-seated', seat_number: 0 },
    ];
    const guests = [mkGuest({ guest_id: 'g-seated' }), mkGuest({ guest_id: 'g-new' })];
    const rows = computeAutoSeat(tables, guests, assignments, STAGE);
    expect(rows.map((r) => r.guest_id)).toEqual(['g-new']);
    // seat 0 is taken by the existing assignment — never reused
    expect(rows[0]!.seat_number).not.toBe(0);
  });

  test('fills the nearest table to the stage first, tier by tier', () => {
    const near = mkTable({ table_id: 'near', x_pos: 50, y_pos: 10, capacity: 2 });
    const far = mkTable({ table_id: 'far', x_pos: 50, y_pos: 90, capacity: 8 });
    const guests = [
      mkGuest({ guest_id: 'sponsor', role: 'principal_sponsor', last_name: 'zz' }),
      mkGuest({ guest_id: 'friend', role: 'guest', group_category: 'friends', last_name: 'aa' }),
    ];
    const rows = computeAutoSeat([far, near], guests, [], STAGE);
    const byGuest = new Map(rows.map((r) => [r.guest_id, r.table_id]));
    // tier-1 sponsor lands on the nearest table even though the friend sorts first by name
    expect(byGuest.get('sponsor')).toBe('near');
  });

  test('never seats anyone at a sweetheart table', () => {
    const sweetheart = mkTable({
      table_id: 'sh',
      table_type: 'sweetheart_2',
      capacity: 2,
      x_pos: 50,
      y_pos: 5,
    });
    const round = mkTable({ table_id: 'r1', x_pos: 50, y_pos: 50, capacity: 2 });
    const guests = [mkGuest({ guest_id: 'g1' }), mkGuest({ guest_id: 'g2' }), mkGuest({ guest_id: 'g3' })];
    const rows = computeAutoSeat([sweetheart, round], guests, [], STAGE);
    expect(rows.every((r) => r.table_id === 'r1')).toBe(true);
    expect(rows.length).toBe(2); // round full; g3 stays unseated rather than touch the sweetheart
  });

  test('never fills a removed chair and respects effective capacity', () => {
    const t = mkTable({ table_id: 't1', capacity: 4, removed_seats: [0, 1], x_pos: 50, y_pos: 10 });
    const guests = [mkGuest({ guest_id: 'g1' }), mkGuest({ guest_id: 'g2' }), mkGuest({ guest_id: 'g3' })];
    const rows = computeAutoSeat([t], guests, [], STAGE);
    expect(rows.length).toBe(2); // effective capacity 2
    for (const r of rows) expect([2, 3]).toContain(r.seat_number);
  });

  test('keeps a plus-one adjacent to their primary', () => {
    const t = mkTable({ table_id: 't1', capacity: 8, x_pos: 50, y_pos: 10 });
    const guests = [
      mkGuest({ guest_id: 'zfriend', last_name: 'zz' }),
      mkGuest({ guest_id: 'primary', last_name: 'mm' }),
      mkGuest({ guest_id: 'plusone', plus_one_of_guest_id: 'primary', last_name: 'aa' }),
    ];
    const rows = computeAutoSeat([t], guests, [], STAGE);
    const order = rows.map((r) => r.guest_id);
    expect(order.indexOf('plusone')).toBe(order.indexOf('primary') + 1);
  });

  test('clusters custom-group members contiguously in fill order', () => {
    // Documented guarantee (lib/seating.ts): a group's members are CONTIGUOUS
    // in the fill sequence → same or neighbouring tables. (Whole-group
    // same-table packing — skip a table that can't fit the whole group — is a
    // possible future enhancement, not the shipped contract.)
    const t1 = mkTable({ table_id: 't1', capacity: 2, x_pos: 50, y_pos: 10 });
    const t2 = mkTable({ table_id: 't2', capacity: 2, x_pos: 50, y_pos: 50 });
    const guests = [
      mkGuest({ guest_id: 'a-solo', last_name: 'aa' }),
      mkGuest({ guest_id: 'z1', group_id: 'barkada', last_name: 'zy' }),
      mkGuest({ guest_id: 'z2', group_id: 'barkada', last_name: 'zz' }),
    ];
    const rows = computeAutoSeat([t1, t2], guests, [], STAGE);
    const order = rows.map((r) => r.guest_id);
    // never split by an unrelated guest — z2 follows z1 immediately
    expect(order.indexOf('z2')).toBe(order.indexOf('z1') + 1);
    // and with room for the whole group on one table, they DO share it
    const t3 = mkTable({ table_id: 't3', capacity: 8, x_pos: 50, y_pos: 10 });
    const rows2 = computeAutoSeat([t3], guests, [], STAGE);
    const tableOf = new Map(rows2.map((r) => [r.guest_id, r.table_id]));
    expect(tableOf.get('z1')).toBe(tableOf.get('z2'));
  });

  test('returns nothing when the pool is exhausted', () => {
    const t = mkTable({ table_id: 't1', capacity: 1, x_pos: 50, y_pos: 10 });
    const guests = [mkGuest({ guest_id: 'g1', last_name: 'aa' }), mkGuest({ guest_id: 'g2', last_name: 'bb' })];
    const rows = computeAutoSeat([t], guests, [], STAGE);
    expect(rows.length).toBe(1);
  });
});

// --- stats + default placement ---------------------------------------------------

test.describe('stats + placement', () => {
  test('computeSeatingStats math', () => {
    const tables = [mkTable({ table_id: 't1', capacity: 8 }), mkTable({ table_id: 't2', capacity: 10 })];
    const assignments: SeatAssignmentRow[] = [
      { assignment_id: 'a1', table_id: 't1', guest_id: 'g1', seat_number: 0 },
    ];
    const stats = computeSeatingStats(tables, assignments, 20);
    expect(stats).toEqual({ tableCount: 2, totalCapacity: 18, assignedCount: 1, unassignedCount: 19 });
  });

  test('packed default positions stay within the canvas', () => {
    for (let i = 0; i < 12; i++) {
      const p = defaultTablePosition(i, 12, false);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(100);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(100);
    }
  });
});

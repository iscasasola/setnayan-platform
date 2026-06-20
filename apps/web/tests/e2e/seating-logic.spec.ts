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

// --- Auto Arrange (2026-06-13 expansion) --------------------------------------
// rankTablesByStage · guestTier override · computeAutoLayout · booth perimeter.

import {
  DEFAULT_FLOOR_PLAN,
  boothPerimeterSlots,
  clampBoothToPerimeter,
  computeAutoLayout,
  guestTier,
  rankTablesByStage,
  stageWallOf,
} from '../../lib/seating';

const RECT = { width: 1000, height: 750 };
// Constant-footprint stub: layout math is exercised in percent space without
// dragging the real chair geometry into these tests.
const STUB_FOOT = () => ({ w: 120, h: 120 });

test.describe('rankTablesByStage', () => {
  test('closer to the stage = higher priority score, deterministic ties', () => {
    const near = mkTable({ table_id: 'near', x_pos: 50, y_pos: 20 });
    const far = mkTable({ table_id: 'far', x_pos: 50, y_pos: 80 });
    const mid = mkTable({ table_id: 'mid', x_pos: 20, y_pos: 40 });
    const ranked = rankTablesByStage([far, mid, near], { x: 50, y: 6 });
    expect(ranked.map((r) => r.table.table_id)).toEqual(['near', 'mid', 'far']);
    expect(ranked[0]!.priorityScore).toBeGreaterThan(ranked[1]!.priorityScore);
    expect(ranked[1]!.priorityScore).toBeGreaterThan(ranked[2]!.priorityScore);
    // Re-running on the same input gives the identical order + scores.
    expect(rankTablesByStage([far, mid, near], { x: 50, y: 6 })).toEqual(ranked);
  });
});

test.describe('guestTier override', () => {
  test('explicit seating_priority beats the role-derived tier', () => {
    expect(guestTier('guest', 'friends', null)).toBe(4);
    expect(guestTier('guest', 'friends', 1)).toBe(1);
    expect(guestTier('principal_sponsor', 'friends', 4)).toBe(4);
    // Out-of-range / absent overrides fall back to derivation.
    expect(guestTier('guest', 'family', 0)).toBe(3);
    expect(guestTier('guest', 'family', undefined)).toBe(3);
  });

  test('computeAutoSeat seats an overridden P1 guest before tier-2 entourage', () => {
    const front = mkTable({ table_id: 'front', x_pos: 50, y_pos: 20, capacity: 1 });
    const back = mkTable({ table_id: 'back', x_pos: 50, y_pos: 80, capacity: 8 });
    const bestMan = mkGuest({ guest_id: 'bestman', role: 'best_man' }); // tier 2
    const vip = mkGuest({ guest_id: 'vip', role: 'guest', seating_priority: 1 }); // 4 → 1
    const rows = computeAutoSeat([front, back], [bestMan, vip], [], STAGE);
    expect(rows.find((r) => r.guest_id === 'vip')!.table_id).toBe('front');
    expect(rows.find((r) => r.guest_id === 'bestman')!.table_id).toBe('back');
  });
});

test.describe('computeAutoLayout', () => {
  const fp = { ...DEFAULT_FLOOR_PLAN };

  test('places every table inside the playable band, off the dance floor, deterministically', () => {
    const tables = [
      mkTable({ table_id: 'sw', table_type: 'sweetheart_2', capacity: 2 }),
      ...Array.from({ length: 9 }, (_, i) => mkTable({ table_id: `r${i}` })),
    ];
    const danceFp = { ...fp, dance_enabled: true, dance_x: 50, dance_y: 55, dance_w: 22, dance_h: 18 };
    const layout = computeAutoLayout({ tables, floorPlan: danceFp, rect: RECT, footprintOf: STUB_FOOT });
    expect(Object.keys(layout)).toHaveLength(tables.length);
    for (const p of Object.values(layout)) {
      expect(p.x).toBeGreaterThanOrEqual(10);
      expect(p.x).toBeLessThanOrEqual(90);
      expect(p.y).toBeGreaterThanOrEqual(10);
      expect(p.y).toBeLessThanOrEqual(90);
    }
    // Sweetheart is pinned nearest the stage (row 0, on the stage axis).
    const swPos = layout['sw']!;
    for (const [id, p] of Object.entries(layout)) {
      if (id !== 'sw') expect(p.y).toBeGreaterThanOrEqual(swPos.y - 0.01);
    }
    expect(swPos.x).toBeCloseTo(50, 0);
    // Deterministic: identical input → identical output.
    expect(computeAutoLayout({ tables, floorPlan: danceFp, rect: RECT, footprintOf: STUB_FOOT })).toEqual(
      layout,
    );
  });

  test('stage-distance order follows the priority table types (head tables nearest)', () => {
    const tables = [
      mkTable({ table_id: 'banquet', table_type: 'long_banquet_8' }),
      mkTable({ table_id: 'head', table_type: 'family_head_12', capacity: 12 }),
      mkTable({ table_id: 'round', table_type: 'round_10', capacity: 10 }),
    ];
    const layout = computeAutoLayout({ tables, floorPlan: fp, rect: RECT, footprintOf: STUB_FOOT });
    const d = (id: string) =>
      (layout[id]!.x - fp.stage_x) ** 2 + (layout[id]!.y - fp.stage_y) ** 2;
    expect(d('head')).toBeLessThanOrEqual(d('round'));
    expect(d('round')).toBeLessThanOrEqual(d('banquet'));
  });
});

test.describe('booth perimeter rules', () => {
  const fp = {
    ...DEFAULT_FLOOR_PLAN,
    entrance_enabled: true,
    entrance_x: 50,
    entrance_y: 94,
    service_entrance_enabled: true,
    service_entrance_x: 97,
    service_entrance_y: 50,
  };
  const onPerimeterBand = (p: { x: number; y: number }) => {
    const nearV = p.x <= 6 || p.x >= 94;
    const nearH = p.y <= 6 || p.y >= 94;
    return nearV || nearH;
  };

  test('anchor slots hug the walls, never the stage wall, clear of doors', () => {
    const slots = boothPerimeterSlots(fp, 5);
    expect(slots).toHaveLength(5);
    expect(stageWallOf(fp)).toBe('top');
    for (const s of slots) {
      expect(onPerimeterBand(s)).toBe(true);
      expect(s.y).toBeGreaterThan(10); // stage wall (top) carries no booths
      // Entrance corridor (bottom-centre door at x=50): booths on the bottom
      // wall keep ≥ the door-clear distance away.
      if (s.y >= 94) expect(Math.abs(s.x - 50)).toBeGreaterThanOrEqual(12);
      // Service door (right wall at y=50) keeps its corridor too.
      if (s.x >= 94) expect(Math.abs(s.y - 50)).toBeGreaterThanOrEqual(12);
    }
    // Deterministic.
    expect(boothPerimeterSlots(fp, 5)).toEqual(slots);
    // Spaced apart (no two slots stacked).
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const dist = Math.hypot(slots[i]!.x - slots[j]!.x, slots[i]!.y - slots[j]!.y);
        expect(dist).toBeGreaterThanOrEqual(10);
      }
    }
  });

  test('a mid-room drop snaps to the perimeter; a stage-wall drop lands elsewhere', () => {
    const mid = clampBoothToPerimeter(50, 50, fp, []);
    expect(onPerimeterBand(mid)).toBe(true);
    // Dropped right onto the stage (top-centre): forbidden wall, so it must
    // resolve to one of the other three.
    const nearStage = clampBoothToPerimeter(50, 4, fp, []);
    expect(nearStage.y).toBeGreaterThan(10);
    expect(onPerimeterBand(nearStage)).toBe(true);
  });

  test('booths slide along the wall instead of stacking on a neighbour', () => {
    const first = clampBoothToPerimeter(30, 96, fp, []);
    const second = clampBoothToPerimeter(30, 96, fp, [first]);
    expect(onPerimeterBand(second)).toBe(true);
    const dist = Math.hypot(first.x - second.x, first.y - second.y);
    expect(dist).toBeGreaterThanOrEqual(10);
  });
});

// --- serpentine chaining (2026-06-13: tips snap together) ----------------------

import {
  SERPENTINE_SWEEP_DEG,
  serpentineChainSnap,
  serpentineEndsWorld,
} from '../../lib/seating';

const endGap = (
  a: { x: number; y: number; rot: number; scale: number },
  b: { x: number; y: number; rot: number; scale: number },
) => {
  const ea = serpentineEndsWorld(a);
  const eb = serpentineEndsWorld(b);
  let min = Infinity;
  for (const p of ea) for (const q of eb) min = Math.min(min, Math.hypot(p.x - q.x, p.y - q.y));
  return min;
};

test.describe('serpentine chain snap', () => {
  const B = { x: 500, y: 500, rot: 0, scale: 1 };

  test('snapping near a candidate glues the tips together exactly', () => {
    // Probe a ring of drag points around the anchor: every snap that fires
    // must land the dragged wedge with one end midpoint EXACTLY on one of the
    // anchor's end midpoints (tangent-continuous chain), never stacked on top.
    let fired = 0;
    for (let deg = 0; deg < 360; deg += 30) {
      const probe = {
        x: B.x + 170 * Math.cos((deg * Math.PI) / 180),
        y: B.y + 170 * Math.sin((deg * Math.PI) / 180),
      };
      const snap = serpentineChainSnap(probe, [B], 120);
      if (!snap) continue;
      fired += 1;
      const A = { ...snap, scale: 1 };
      expect(endGap(A, B)).toBeLessThan(1e-6);
      expect(Math.hypot(A.x - B.x, A.y - B.y)).toBeGreaterThan(60); // beside, not on top
      // Junction angles are the only legal ones: ±sweep (circle) or 180 (S).
      const r = ((snap.rot % 360) + 360) % 360;
      expect(
        [SERPENTINE_SWEEP_DEG, 360 - SERPENTINE_SWEEP_DEG, 180].some((v) => Math.abs(r - v) < 1e-6),
      ).toBe(true);
    }
    expect(fired).toBeGreaterThan(0);
  });

  test('S-bend and circle-continue are both offered, deterministically', () => {
    const all = new Set<number>();
    for (let deg = 0; deg < 360; deg += 10) {
      const probe = {
        x: B.x + 190 * Math.cos((deg * Math.PI) / 180),
        y: B.y + 190 * Math.sin((deg * Math.PI) / 180),
      };
      const snap = serpentineChainSnap(probe, [B], 160);
      if (snap) all.add(Math.round(((snap.rot % 360) + 360) % 360));
    }
    expect(all.has(180)).toBe(true); // S-bend
    expect(all.has(SERPENTINE_SWEEP_DEG) || all.has(360 - SERPENTINE_SWEEP_DEG)).toBe(true); // circle
    // Determinism: same probe → same answer.
    const p = { x: B.x + 150, y: B.y + 40 };
    expect(serpentineChainSnap(p, [B], 160)).toEqual(serpentineChainSnap(p, [B], 160));
  });

  test('far away → no snap (free drag)', () => {
    expect(serpentineChainSnap({ x: B.x + 900, y: B.y + 900 }, [B], 36)).toBeNull();
    expect(serpentineChainSnap({ x: 0, y: 0 }, [], 36)).toBeNull();
  });

  test('chairs clear each other across every junction type', () => {
    // World chair centres of a wedge = geometry seats, scaled + rotated + offset.
    const chairsWorld = (w: { x: number; y: number; rot: number }) => {
      const geo = tableGeometry('serpentine', 5);
      return geo.seats.map((s) => {
        const r = rotatePoint(s, w.rot);
        return { x: w.x + r.x, y: w.y + r.y };
      });
    };
    // Build each junction by snapping right at the candidates around B.
    for (let deg = 0; deg < 360; deg += 15) {
      const probe = {
        x: B.x + 180 * Math.cos((deg * Math.PI) / 180),
        y: B.y + 180 * Math.sin((deg * Math.PI) / 180),
      };
      const snap = serpentineChainSnap(probe, [B], 140);
      if (!snap) continue;
      const ca = chairsWorld(snap);
      const cb = chairsWorld(B);
      for (const p of ca)
        for (const q of cb) {
          // CHAIR_PX is 40 — centres must keep at least a chair-width apart
          // (minus a small visual tolerance) so seam chairs never stack.
          expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThan(38);
        }
    }
  });
});

// --- rect run + round kiss chaining (2026-06-13 follow-up) ---------------------

import { CHAIR_PX, ROUND_KISS_GAP, rectChainSnap, roundKissSnap } from '../../lib/seating';

test.describe('rect chain snap (banquet / family head runs)', () => {
  // long_banquet_8: per=4 → hubW = 4·40+16 = 176 → halfLen 88.
  // family_head_14: per=7 → hubW = 7·44+16 = 324 → halfLen 162.
  const halfBanquet = tableGeometry('long_banquet', 8).hub.w / 2;
  const halfHead = tableGeometry('family_head', 14).hub.w / 2;

  test('ends join flush and collinear, adopting the anchor rotation', () => {
    const B = { x: 600, y: 400, rot: 30, halfLen: halfHead };
    const dir = rotatePoint({ x: 1, y: 0 }, 30);
    const want = {
      x: B.x + dir.x * (halfHead + halfBanquet),
      y: B.y + dir.y * (halfHead + halfBanquet),
    };
    const snap = rectChainSnap({ x: want.x + 10, y: want.y - 8 }, halfBanquet, [B]);
    expect(snap).not.toBeNull();
    expect(snap!.rot).toBe(30);
    expect(Math.hypot(snap!.x - want.x, snap!.y - want.y)).toBeLessThan(1e-9);
    // Tabletop gap along the run axis is EXACTLY zero (flush seam).
    const along =
      (snap!.x - B.x) * dir.x + (snap!.y - B.y) * dir.y - (halfHead + halfBanquet);
    expect(Math.abs(along)).toBeLessThan(1e-9);
  });

  test('seam chair columns keep one chair-gap spacing (chairs adjust)', () => {
    // Two banquet_8s joined flush at rot 0: A's right column and B's left
    // column must sit ~one chair-gap apart — same rhythm as inside one table.
    const geo = tableGeometry('long_banquet', 8);
    const half = geo.hub.w / 2;
    const A = { x: 0, y: 0 };
    const B = { x: 2 * half, y: 0 }; // flush at the seam x = half
    const ax = geo.seats.map((s) => A.x + s.x);
    const bx = geo.seats.map((s) => B.x + s.x);
    const seamGap = Math.min(...bx) - Math.max(...ax);
    expect(seamGap).toBeGreaterThanOrEqual(CHAIR_PX - 2);
  });

  test('both ends offered; far away → null', () => {
    const B = { x: 600, y: 400, rot: 0, halfLen: halfBanquet };
    const left = rectChainSnap({ x: 600 - 2 * halfBanquet, y: 402 }, halfBanquet, [B]);
    const right = rectChainSnap({ x: 600 + 2 * halfBanquet, y: 398 }, halfBanquet, [B]);
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    expect(left!.x).toBeLessThan(B.x);
    expect(right!.x).toBeGreaterThan(B.x);
    expect(rectChainSnap({ x: 0, y: 0 }, halfBanquet, [B])).toBeNull();
  });
});

test.describe('round kiss snap', () => {
  const rB = tableGeometry('round', 10).box.w / 2;
  const rA = tableGeometry('round', 8).box.w / 2;
  const B = { x: 500, y: 500, radius: rB };

  test('snaps onto the line of centres at kiss distance, direction preserved', () => {
    const drag = { x: B.x + rA + rB + 20, y: B.y - 14 };
    const snap = roundKissSnap(drag, rA, [B]);
    expect(snap).not.toBeNull();
    const dist = Math.hypot(snap!.x - B.x, snap!.y - B.y);
    expect(Math.abs(dist - (rA + rB + ROUND_KISS_GAP))).toBeLessThan(1e-9);
    // Direction from the anchor is the drag direction (the couple picks the side).
    const want = Math.atan2(drag.y - B.y, drag.x - B.x);
    const got = Math.atan2(snap!.y - B.y, snap!.x - B.x);
    expect(Math.abs(want - got)).toBeLessThan(1e-9);
  });

  test('kissed rounds stay clear of the collision threshold (chairs never overlap)', () => {
    // Editor collision: AABB halves + 10px gap. Kiss distance must exceed it
    // so the mount resolver never separates a kissed pair — and the chair
    // rings (inside the boxes) cannot intersect.
    const snap = roundKissSnap({ x: B.x + rA + rB + 5, y: B.y }, rA, [B]);
    const dist = Math.hypot(snap!.x - B.x, snap!.y - B.y);
    expect(dist).toBeGreaterThan(rA + rB + 10);
  });

  test('dead-centre drop and far drops do not snap', () => {
    expect(roundKissSnap({ x: B.x, y: B.y }, rA, [B])).toBeNull();
    expect(roundKissSnap({ x: B.x + rA + rB + 200, y: B.y }, rA, [B])).toBeNull();
  });
});

// --- free-venue booth placement (no walls — gardens / open fields) ------------

import { freeBoothSlots, BOOTH_W } from '../../lib/seating';

test.describe('freeBoothSlots', () => {
  const stage = { x: 50, y: 8 };

  test('lays a row beyond the furthest table, centred on the stage line', () => {
    const tables = [
      { x: 30, y: 30 },
      { x: 70, y: 30 },
      { x: 50, y: 60 }, // furthest from the stage (top)
    ];
    const slots = freeBoothSlots(stage, tables, 3);
    expect(slots).toHaveLength(3);
    // The whole row sits below (further from the stage than) every table.
    const maxTableY = Math.max(...tables.map((t) => t.y));
    for (const s of slots) expect(s.y).toBeGreaterThan(maxTableY);
    // Centred on the stage's x; evenly spaced; deterministic.
    const mid = slots[1]!;
    expect(Math.abs(mid.x - stage.x)).toBeLessThan(1e-9);
    expect(Math.abs(Math.abs(slots[2]!.x - slots[1]!.x) - (BOOTH_W + 3))).toBeLessThan(1e-9);
    expect(freeBoothSlots(stage, tables, 3)).toEqual(slots);
  });

  test('never forces a wall — coordinates are free, not pinned to 0/100', () => {
    const tables = [{ x: 48, y: 40 }, { x: 52, y: 40 }];
    const slots = freeBoothSlots(stage, tables, 2);
    // A perimeter anchor would land on a 0–100 edge band; a free row does not.
    for (const s of slots) {
      expect(s.x).toBeGreaterThan(5);
      expect(s.x).toBeLessThan(95);
      expect(s.y).toBeLessThan(96); // just past y=40 tables, nowhere near a "wall"
    }
  });

  test('no tables yet → a horizontal row opposite the stage; n=0 → empty', () => {
    const slots = freeBoothSlots(stage, [], 2);
    expect(slots).toHaveLength(2);
    expect(slots.every((s) => s.y === 90)).toBe(true); // stage near top → row near bottom
    expect(freeBoothSlots(stage, [], 0)).toEqual([]);
  });
});

// --- rect connect catch radius (2026-06-13: easier to join long tables) -------

test.describe('rect chain snap catch radius', () => {
  const half = tableGeometry('family_head', 14).hub.w / 2; // wide → far flush point
  test('a generous tolerance catches a drag that the tight default misses', () => {
    const B = { x: 600, y: 400, rot: 0, halfLen: half };
    const flushX = B.x + 2 * half; // where the moving table's centre sits when flush
    // Drop the moving centre a half-table SHORT of the flush point.
    const probe = { x: flushX - half * 0.6, y: 402 };
    // Tight default (36px) can't reach across most of a tabletop…
    expect(rectChainSnap(probe, half, [B], 36)).toBeNull();
    // …the size-scaled tolerance does, and still lands it exactly flush.
    const snapped = rectChainSnap(probe, half, [B], Math.max(40, half * 0.9));
    expect(snapped).not.toBeNull();
    expect(Math.abs(snapped!.x - flushX)).toBeLessThan(1e-9);
    expect(snapped!.rot).toBe(0);
  });
});

// --- booth catalog contract (place-then-pick) ---------------------------------

import { BOOTH_CATALOG as PICKABLE_BOOTHS } from '../../lib/seating';

test.describe('booth catalog', () => {
  test('the picker offers real kinds and never the unassigned placeholder', () => {
    const types = PICKABLE_BOOTHS.map((b) => b.type);
    expect(types).toEqual([
      'photo_booth',
      'mobile_bar',
      'dessert_station',
      'gift_table',
      'souvenir_table',
      'registration_desk',
      'custom',
    ]);
    expect(types).not.toContain('unassigned');
  });
});

// --- "Build my seating" draft sizing (draft, don't blank) ---------------------

import { recommendTableSet, type RecommendGuest } from '../../lib/seating';

function mkRG(n: number, rsvp: string, role = 'guest'): RecommendGuest[] {
  return Array.from({ length: n }, () => ({ role, rsvp_status: rsvp }));
}

test.describe('recommendTableSet', () => {
  test('no guests → just the couple’s Sweetheart, no round tables', () => {
    expect(recommendTableSet([])).toEqual([
      { type: 'sweetheart_2', capacity: 2, label: 'Sweetheart' },
    ]);
  });

  test('sizes one round_10 per 10 not-declined heads, labelled Table 1..n', () => {
    const set = recommendTableSet(mkRG(25, 'attending'));
    expect(set[0]).toEqual({ type: 'sweetheart_2', capacity: 2, label: 'Sweetheart' });
    const rounds = set.slice(1);
    expect(rounds).toHaveLength(3); // ceil(25 / 10)
    expect(rounds.every((t) => t.type === 'round_10' && t.capacity === 10)).toBe(true);
    expect(rounds.map((t) => t.label)).toEqual(['Table 1', 'Table 2', 'Table 3']);
  });

  test('pending guests are sized for (a floor is built before RSVPs are in)', () => {
    expect(recommendTableSet(mkRG(10, 'pending'))).toHaveLength(2); // sweetheart + 1 round
  });

  test('declined guests are excluded from the count', () => {
    // 10 attending size one round table; the 40 declined add nothing.
    expect(recommendTableSet([...mkRG(10, 'attending'), ...mkRG(40, 'declined')])).toHaveLength(2);
  });

  test('the couple (bride/groom) take the Sweetheart, not a round seat', () => {
    expect(
      recommendTableSet([
        { role: 'bride', rsvp_status: 'attending' },
        { role: 'groom', rsvp_status: 'attending' },
      ]),
    ).toEqual([{ type: 'sweetheart_2', capacity: 2, label: 'Sweetheart' }]);
  });

  test('a single not-declined guest still gets one round table', () => {
    expect(recommendTableSet(mkRG(1, 'attending'))).toHaveLength(2);
  });

  test('caps round tables so a runaway import can’t spawn hundreds', () => {
    expect(recommendTableSet(mkRG(5000, 'attending')).slice(1)).toHaveLength(60);
  });
});

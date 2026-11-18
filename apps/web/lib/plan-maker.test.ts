/**
 * 🔒 lib/plan-maker.ts — the seat plan's drawing core without an event (owner 2026-11-18, "Rooms & seating = the
 * shipped seat plan and room makers, improved and adapted").
 *
 * What fails here if somebody breaks it:
 *   · a couple table drawn differently from the couple's own `tableGeometry` (the couple's plan must stay identical);
 *   · the three supplier shapes losing their rules (ends counted in the one number; Long ≤ 4 without ends = square);
 *   · a door that can sit off a wall; the couple editor growing its own nearest-wall copy again;
 *   · "Line up" stacking two tables, leaving the room, or not being the couple's own Auto-arrange.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TABLE_TYPE_CATALOG, DEFAULT_FLOOR_PLAN, shapeHintFor, tableGeometry } from './seating';
import {
  PLAN_TABLE_SHAPES,
  addDoor,
  alongToAt,
  atToAlong,
  clampChairs,
  doorPoint,
  lineUpPlan,
  nearestWall,
  nextPlanTableLabel,
  planAspect,
  planDrawnShape,
  planFromSeating,
  planSeatCount,
  planSeatTotal,
  planTableGeometry,
  planTablePositions,
  planTableWords,
  planTablesInOrder,
  parsePlanSide,
  snapDoor,
  type Plan,
  type PlanTable,
} from './plan-maker';

const table = (over: Partial<PlanTable> & Pick<PlanTable, 'kind' | 'chairs'>): PlanTable => ({
  id: over.id ?? `t-${over.kind}-${over.chairs}`,
  label: over.label ?? 'T1',
  x: null,
  y: null,
  ...over,
});

test('every couple table type is drawn by the couple’s own tableGeometry, byte for byte', () => {
  for (const c of TABLE_TYPE_CATALOG) {
    for (const linked of [false, true]) {
      const t = table({ kind: c.type, chairs: c.defaultCapacity, linked });
      assert.deepEqual(
        planTableGeometry(t),
        tableGeometry(shapeHintFor(c.type), c.defaultCapacity, linked),
        `${c.type} linked=${linked}`,
      );
    }
  }
});

test('a couple table counts its seats the couple’s way — deleted chairs come off', () => {
  assert.equal(planSeatCount(table({ kind: 'round_10', chairs: 10, removedSeats: [0, 3] })), 8);
});

test('Round is the couple’s round, with one chair count', () => {
  assert.deepEqual(planTableGeometry(table({ kind: 'round', chairs: 6 })), tableGeometry('round', 6));
});

test('Long: chairs at the ends are COUNTED in the one number', () => {
  const t = table({ kind: 'long', chairs: 10, chairsAtEnds: true });
  const g = planTableGeometry(t);
  assert.equal(g.seats.length, 10);
  assert.equal(planSeatCount(t), 10);
  // exactly two chairs sit level with the table's middle, one past each end of the top
  const ends = g.seats.filter((s) => s.y === 0);
  assert.equal(ends.length, 2);
  assert.ok(ends.every((s) => Math.abs(s.x) > g.hub.w / 2));
  assert.match(planTableWords(t), /^Long · 10 chairs · 2 at the ends$/);
});

test('Long with no ends and more than 4 chairs is the couple’s banquet table', () => {
  assert.deepEqual(planTableGeometry(table({ kind: 'long', chairs: 8 })), tableGeometry('long_banquet', 8));
});

test('a Long table with 4 chairs or fewer and no ends draws as a square', () => {
  for (const n of [1, 2, 3, 4]) {
    const t = table({ kind: 'long', chairs: n });
    assert.equal(planDrawnShape(t), 'square');
    const g = planTableGeometry(t);
    assert.equal(g.hub.w, g.hub.h);
    assert.equal(g.seats.length, n);
    assert.match(planTableWords(t), /^Square · /);
  }
  assert.equal(planDrawnShape(table({ kind: 'long', chairs: 4, chairsAtEnds: true })), 'long');
  assert.equal(planDrawnShape(table({ kind: 'long', chairs: 5 })), 'long');
});

test('Half-moon booth: a curved cushion, every seat along it, the room side open', () => {
  const t = table({ kind: 'half_moon', chairs: 5 });
  const g = planTableGeometry(t);
  assert.equal(g.seats.length, 5);
  assert.ok(g.outline && g.outline.length > 10);
  assert.ok(g.seats.every((s) => s.y < 0), 'seats sit on the cushion side, never the open side');
  assert.equal(planTableWords(t), 'Half-moon booth · seats 5');
});

test('chair counts are whole and between 1 and 60', () => {
  assert.equal(clampChairs(0), 1);
  assert.equal(clampChairs(7.8), 7);
  assert.equal(clampChairs(999), 60);
  assert.equal(clampChairs(Number.NaN), 1);
});

test('the supplier catalogue is the three shapes, in the drawing’s order', () => {
  assert.deepEqual(
    PLAN_TABLE_SHAPES.map((s) => s.key),
    ['round', 'long', 'half_moon'],
  );
});

test('room size: Wide × Deep sets the shape; blank means unsized; nonsense is refused', () => {
  assert.equal(planAspect({ widthM: 30, depthM: 15 }), 2);
  assert.equal(planAspect({ widthM: null, depthM: null }), 20 / 15);
  assert.equal(parsePlanSide(''), null);
  assert.equal(parsePlanSide('12.34'), 12.3);
  assert.equal(parsePlanSide('0'), 'bad');
  assert.equal(parsePlanSide('501'), 'bad');
  assert.equal(parsePlanSide('abc'), 'bad');
});

test('a door dropped anywhere snaps onto the nearest wall, clear of the corners', () => {
  assert.deepEqual(snapDoor(50, 97), { wall: 'bottom', at: 50 });
  assert.deepEqual(snapDoor(3, 40), { wall: 'left', at: 40 });
  assert.deepEqual(snapDoor(99, 1), { wall: 'top', at: 94 });
  for (const [x, y] of [[10, 10], [90, 60], [50, 50], [0, 0], [100, 100]] as const) {
    const p = doorPoint(snapDoor(x, y));
    assert.ok(p.x === 0 || p.x === 100 || p.y === 0 || p.y === 100, `door at ${x},${y} is on a wall`);
  }
});

test('nearestWall breaks ties top · bottom · left · right (the couple editor’s walk-through order)', () => {
  assert.equal(nearestWall(50, 50), 'top');
  assert.equal(nearestWall(0, 100), 'bottom');
  assert.equal(nearestWall(0, 50), 'left');
  assert.equal(nearestWall(100, 50), 'right');
});

test('the couple editor uses this nearestWall, not a copy of its own', () => {
  const src = readFileSync(join(__dirname, '..', 'app/dashboard/[eventId]/seating/_components/seating-editor.tsx'), 'utf8');
  assert.match(src, /import \{ nearestWall \} from '@\/lib\/plan-maker';/);
  assert.match(src, /const wall = nearestWall\(entrance\.x, entrance\.y\);/);
  assert.doesNotMatch(src, /const dRight = 100 - entrance\.x;/);
});

test('＋ Door: the first one is the main door; the next goes on a free wall', () => {
  let p: Plan = { room: { widthM: 20, depthM: 10 }, doors: [], tables: [] };
  p = addDoor(p, 'd1');
  assert.deepEqual(p.doors[0], { id: 'd1', kind: 'main', wall: 'bottom', at: 50 });
  p = addDoor(p, 'd2');
  assert.equal(p.doors[1]!.kind, 'service');
  assert.notEqual(p.doors[1]!.wall, 'bottom');
});

test('the storage’s three spots along a wall round-trip', () => {
  for (const a of ['left', 'middle', 'right'] as const) assert.equal(atToAlong(alongToAt(a)), a);
});

test('Line up: every table in rows, inside the walls, none on another’s spot, away from the main door', () => {
  const tables: PlanTable[] = Array.from({ length: 9 }, (_, i) =>
    table({ id: `t${i}`, label: `T${9 - i}`, kind: i % 3 === 0 ? 'long' : i % 3 === 1 ? 'round' : 'half_moon', chairs: 6, x: 50, y: 50, rotationDeg: 45 }),
  );
  const plan: Plan = { room: { widthM: 24, depthM: 16 }, doors: [{ id: 'm', kind: 'main', wall: 'bottom', at: 50 }], tables };
  const out = lineUpPlan(plan);
  const spots = new Set<string>();
  for (const t of out.tables) {
    assert.ok(t.x !== null && t.y !== null);
    assert.ok(t.x! >= 0 && t.x! <= 100 && t.y! >= 0 && t.y! <= 100);
    assert.equal(t.rotationDeg, 0);
    spots.add(`${t.x},${t.y}`);
  }
  assert.equal(spots.size, tables.length, 'no two tables on one spot');
  // the first row is the one farthest from the main door (bottom) → the smallest y; T1 sits in it
  const t1 = out.tables.find((t) => t.label === 'T1')!;
  const minY = Math.min(...out.tables.map((t) => t.y!));
  assert.equal(t1.y, minY);
  // chairs and kinds are untouched
  assert.deepEqual(out.tables.map((t) => [t.kind, t.chairs]), tables.map((t) => [t.kind, t.chairs]));
});

test('Line up on an empty plan changes nothing', () => {
  const p: Plan = { room: { widthM: null, depthM: null }, doors: [], tables: [] };
  assert.equal(lineUpPlan(p), p);
});

test('Grid order is the name read naturally; unplaced tables get the couple’s default spot', () => {
  const ts = ['T10', 'T2', 'T1'].map((label, i) => table({ id: String(i), label, kind: 'round', chairs: 4 }));
  assert.deepEqual(planTablesInOrder(ts).map((t) => t.label), ['T1', 'T2', 'T10']);
  const pos = planTablePositions(ts);
  assert.equal(new Set(pos.map((p) => `${p.x},${p.y}`)).size, 3);
  assert.equal(nextPlanTableLabel(ts), 'T4');
  assert.equal(planSeatTotal({ tables: ts }), 12);
});

test('a couple’s plan reads as a Plan with nothing lost', () => {
  const plan = planFromSeating(
    [
      { table_id: 'a', table_label: 'Table 1', table_type: 'round_10', capacity: 10, x_pos: 30, y_pos: 40, rotation_deg: 15, removed_seats: [2], link_group_id: null },
      { table_id: 'b', table_label: 'Table 2', table_type: 'serpentine', capacity: 5, x_pos: null, y_pos: null, link_group_id: 'g' },
    ],
    { ...DEFAULT_FLOOR_PLAN, venue_width_m: 20, venue_length_m: 30, entrance_enabled: true, entrance_x: 50, entrance_y: 94 },
  );
  assert.deepEqual(plan.room, { widthM: 20, depthM: 30 });
  assert.deepEqual(plan.doors, [{ id: 'entrance', kind: 'main', wall: 'bottom', at: 50 }]);
  assert.equal(plan.tables[0]!.kind, 'round_10');
  assert.equal(planSeatCount(plan.tables[0]!), 9);
  assert.equal(plan.tables[1]!.linked, true);
  assert.deepEqual(planTableGeometry(plan.tables[1]!), tableGeometry('serpentine', 5, true));
});

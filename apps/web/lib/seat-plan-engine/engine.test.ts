/**
 * 🔒 lib/seat-plan-engine — ONE SEAT-PLAN ENGINE FOR THE COUPLE AND THE SUPPLIER (DECISION_LOG 2026-11-20).
 *
 * What fails here if somebody breaks it:
 *   · a second copy of the table geometry appears in `lib/seating.ts` (the couple and the supplier drift apart);
 *   · the couple's Seat plan stops importing its tables, chairs and room box from the engine;
 *   · a shared floor plan removes a booked room, or a floor stops numbering its own rooms;
 *   · a supplier seat takes a guest, an event seat takes a booking, or a couple can see which table is booked;
 *   · the check lets two tables overlap or a table leave a sized room.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as seating from '../seating';
import * as engine from './index';
import {
  applyFloorPlan,
  canFill,
  copyFloor,
  coupleSeesOfBookings,
  duplicateNames,
  fillNextSeat,
  fillState,
  fillWords,
  floorPlanServesWords,
  floorRangeWords,
  genericSpaceName,
  makeFloorDifferent,
  nextFreeSeat,
  nextGenericNames,
  planViewsFor,
  roomNamesOnFloor,
  validatePlan,
  type Plan,
  type PlanFloor,
  type PlanTable,
  type SeatFill,
} from './index';

const read = (rel: string) => readFileSync(join(__dirname, '..', '..', rel), 'utf8');

const T = (over: Partial<PlanTable> & Pick<PlanTable, 'id'>): PlanTable => ({
  label: over.id,
  kind: 'round_10',
  chairs: 10,
  x: null,
  y: null,
  ...over,
});
const room = (tables: PlanTable[], over: Partial<Plan> = {}): Plan => ({
  room: { widthM: 20, depthM: 30 },
  doors: [],
  tables,
  stage: { x: 50, y: 6, w: 30, h: 8 },
  ...over,
});

// ── One engine ───────────────────────────────────────────────────────────────

test('Line up and the couple’s Auto-arrange space a row with the same gap', () => {
  assert.equal(engine.SLOT_GAP_PCT, 3);
  assert.match(read('lib/seating.ts'), /const SLOT_GAP = SLOT_GAP_PCT;/, 'Auto-arrange stopped reading the engine’s gap');
  // Line up centres each row through the grid's `centredRun` at GRID_GAP (#8057), and GRID_GAP IS the engine's gap.
  assert.match(read('lib/seat-plan-engine/plan.ts'), /centredRun\(.*, 50, GRID_GAP\);/, 'Line up stopped centring its rows at the grid gap');
  assert.match(read('lib/seat-plan-engine/rows.ts'), /export const GRID_GAP = SLOT_GAP_PCT;/, 'the grid stopped reading the engine’s gap');
});

test('lib/seating re-exports the engine’s geometry — the very same functions, not copies', () => {
  for (const name of ['tableGeometry', 'shapeHintFor', 'effectiveCapacity', 'defaultTablePosition', 'roomBoxM', 'pctToWorldM', 'metricScale'] as const) {
    assert.equal(seating[name], engine[name], `${name} is not the engine’s`);
  }
  assert.equal(seating.TABLE_TYPE_CATALOG, engine.TABLE_TYPE_CATALOG);
  assert.equal(seating.TABLE_FOOTPRINT_M, engine.TABLE_FOOTPRINT_M);
  const src = read('lib/seating.ts');
  assert.doesNotMatch(src, /export function tableGeometry\(/, 'lib/seating.ts grew its own table geometry again');
  assert.doesNotMatch(src, /export const TABLE_FOOTPRINT_M/, 'lib/seating.ts grew its own footprints again');
  assert.doesNotMatch(read('lib/seat-plan-engine/geometry.ts'), /^import /m, 'the geometry must import nothing');
});

test('the couple’s Seat plan draws its tables, chairs and room from the engine', () => {
  for (const f of ['app/dashboard/[eventId]/seating/_components/seating-editor.tsx', 'app/dashboard/[eventId]/seating/_components/seating-context-dock.tsx', 'app/dashboard/[eventId]/seating/actions.ts']) {
    const src = read(f);
    const engineImport = /import \{([^}]*)\} from '@\/lib\/seat-plan-engine';/.exec(src)?.[1] ?? '';
    assert.match(engineImport, /\btableGeometry\b|\bTABLE_TYPE_CATALOG\b/, `${f} does not import from the engine`);
    const seatingImport = /import \{([^}]*)\} from '@\/lib\/seating';/.exec(src)?.[1] ?? '';
    assert.doesNotMatch(seatingImport, /\btableGeometry\b|\bTABLE_TYPE_CATALOG\b|\bshapeHintFor\b/, `${f} still takes geometry from lib/seating`);
  }
});

test('the engine runs nothing on import (it rides in the couple editor’s chunk)', () => {
  for (const f of ['plan', 'floors', 'validate', 'occupants']) {
    const src = read(`lib/seat-plan-engine/${f}.ts`);
    assert.doesNotMatch(src, /^const \w+ = new /m, `${f}.ts builds something at import`);
    assert.doesNotMatch(src, /from '@\/lib\/supabase|from 'react'|'use client'/, `${f}.ts is not pure`);
  }
});

// ── Floors (19 Nov rulings) ───────────────────────────────────────────────────

test('names: generic by kind below Pro, counting on; by floor and letters per floor', () => {
  assert.equal(genericSpaceName('room', 1), 'Room001');
  assert.equal(genericSpaceName('item', 12), 'Item012');
  assert.deepEqual(nextGenericNames('hall', ['Hall001', 'Hall004', 'Grand'], 2), ['Hall005', 'Hall006']);
  assert.deepEqual(roomNamesOnFloor('by_floor', 2, 3), ['201', '202', '203']);
  assert.deepEqual(roomNamesOnFloor('by_floor', 3, 2, 201), ['301', '302'], 'on 3F they read 301 …');
  assert.deepEqual(roomNamesOnFloor('letters', 2, 3), ['2A', '2B', '2C']);
  assert.equal(roomNamesOnFloor('generic', 2, 3), null);
  assert.deepEqual(duplicateNames(['Room001', 'room001 ', 'Hall'], ), ['Room001']);
  assert.equal(floorRangeWords([5, 2, 3, 4]), '2F to 5F');
  assert.equal(floorRangeWords([1]), 'Ground floor');
  assert.deepEqual(planViewsFor('supplier', false), ['grid'], 'Floor plan is Pro and up');
  assert.deepEqual(planViewsFor('supplier', true), ['grid', 'floor']);
});

test('one floor plan, many floors: edit once, each floor numbers its own rooms', () => {
  const id = (l: number, s: number) => `r${l}-${s}`;
  let floors: PlanFloor[] = engine.setFloorPlanOn([], 'std', [2, 3, 4, 5], (l) => `f${l}`);
  floors = applyFloorPlan(floors, 'std', 12, 'by_floor', id).floors;
  assert.equal(floorPlanServesWords(floors, 'std'), '4 floors · 48 rooms');
  assert.deepEqual(floors.find((f) => f.level === 3)!.rooms.slice(0, 2).map((r) => r.name), ['301', '302']);
  floors = makeFloorDifferent(floors, 'f5', 'own-5');
  const shrunk = applyFloorPlan(floors, 'std', 10, 'by_floor', id).floors;
  assert.equal(shrunk.find((f) => f.id === 'f5')!.rooms.length, 12, '5F made different is untouched');
  assert.equal(shrunk.find((f) => f.id === 'f2')!.rooms.length, 10);
  const copied = copyFloor(shrunk, 'f2', [6], (l) => `f${l}`);
  assert.equal(copied.find((f) => f.level === 6)!.layoutId, 'std');
});

test('a booked room is never removed by a plan change — the change to it waits', () => {
  const floors: PlanFloor[] = [
    { id: 'f2', level: 2, layoutId: 'std', rooms: [0, 1, 2].map((s) => ({ id: `r${s}`, slot: s, name: `20${s + 1}`, booked: s === 2 })) },
  ];
  const { floors: after, held } = applyFloorPlan(floors, 'std', 2, 'by_floor', (l, s) => `n${l}${s}`);
  assert.deepEqual(after[0]!.rooms.map((r) => r.id), ['r0', 'r1', 'r2']);
  assert.deepEqual(held.map((h) => h.room.id), ['r2']);
});

// ── Validation ────────────────────────────────────────────────────────────────

test('one check for both sides: overlaps (the couple’s oracle), the room, chairs, names, doors', () => {
  assert.deepEqual(validatePlan(room([T({ id: 'A', x: 30, y: 40 }), T({ id: 'B', x: 70, y: 40 })])), []);
  const overlap = validatePlan(room([T({ id: 'A', x: 50, y: 40 }), T({ id: 'B', x: 51, y: 40 })]));
  assert.ok(overlap.some((p) => p.kind === 'overlap' && p.words === 'A overlaps B.'));
  const supplier = validatePlan(room([T({ id: 'S1', kind: 'long', chairs: 10, x: 50, y: 50 }), T({ id: 'S2', kind: 'half_moon', chairs: 4, x: 50.5, y: 50 })], { stage: null }));
  assert.ok(supplier.some((p) => p.kind === 'overlap'), 'supplier shapes go through the same oracle');
  const kinds = validatePlan({
    room: { widthM: 20, depthM: null },
    doors: [
      { id: 'd1', kind: 'main', wall: 'bottom', at: 2 },
      { id: 'd2', kind: 'main', wall: 'top', at: 50 },
    ],
    tables: [T({ id: 'A', label: 'T1', chairs: 0, x: 120, y: 40 }), T({ id: 'B', label: 't1', x: 20, y: 40 })],
  }).map((p) => p.kind);
  for (const k of ['room_size', 'chairs', 'duplicate_name', 'door'] as const) assert.ok(kinds.includes(k), k);
  const outside = validatePlan(room([T({ id: 'A', x: 120, y: 40 })]));
  assert.ok(outside.some((p) => p.kind === 'outside'));
  const freeBoard = validatePlan(room([T({ id: 'A', x: 120, y: 40 })], { room: { widthM: null, depthM: null } }));
  assert.ok(!freeBoard.some((p) => p.kind === 'outside'), 'a free board may grow past its edges (contract § 1)');
});

// ── Who fills a seat ──────────────────────────────────────────────────────────

test('an event seat takes a guest, a supplier seat takes a booking — nothing else', () => {
  assert.equal(canFill('event', { kind: 'guest' }), true);
  assert.equal(canFill('event', { kind: 'booking' }), false);
  assert.equal(canFill('supplier', { kind: 'booking' }), true);
  assert.equal(canFill('supplier', { kind: 'guest' }), false);
  const t = T({ id: 'T1', removedSeats: [0] });
  assert.equal(fillNextSeat('supplier', t, [], { kind: 'guest', id: 'g', name: 'Ana' }), null);
});

test('tap a name: they take the next free seat, and deleted chairs are skipped', () => {
  const t = T({ id: 'T1', removedSeats: [0] });
  const fills: SeatFill[] = [];
  const a = fillNextSeat('event', t, fills, { kind: 'guest', id: 'g1', name: 'Test Ana' })!;
  assert.equal(a.seat, 1);
  fills.push(a);
  assert.equal(nextFreeSeat(t, fills), 2);
  assert.equal(fillWords('event', t, fills), '1 of 9 seated');
  assert.equal(fillState(t, fills), 'has_room');
  assert.equal(fillState(t, []), 'empty');
});

test('a booking may hold a whole table; a couple sees only how many are free', () => {
  const t1 = T({ id: 'T1', kind: 'round', chairs: 6 });
  const t2 = T({ id: 'T2', kind: 'round', chairs: 4 });
  const fills: SeatFill[] = [{ tableId: 'T1', seat: null, occupant: { kind: 'booking', id: 'b1', name: 'Reyes party', party: 6 } }];
  assert.equal(fillWords('supplier', t1, fills), '6 of 6 booked');
  assert.equal(nextFreeSeat(t1, fills), null);
  const seen = coupleSeesOfBookings([t1, t2], fills);
  assert.deepEqual(seen, { available: 4 });
  assert.deepEqual(Object.keys(seen), ['available'], 'a couple is never told which table');
});

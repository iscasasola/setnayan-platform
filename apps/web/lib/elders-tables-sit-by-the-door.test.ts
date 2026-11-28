/**
 * 🧓 TABLE KINDS AS SOLVER RULES (seat plan § 4.7, table kinds E; corpus SEAT-PLAN-COMPLETE-2026-11-27.md):
 *   · Elders: the elders (grandparents) are seated at an Elders table first, with their +1s; the Elders tables near a
 *     way out and away from the speakers fill first;
 *   · Spare: never used by auto arrange, nor by the Guests list's seat hint;
 *   · the floor plan reads the Speakers element and the two ⋯ switches.
 * Executed on the shipped seater.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_FLOOR_PLAN,
  computeAutoSeat,
  elderTableOrder,
  isElderRole,
  seatRoomPoints,
  type AutoSeatGuest,
  type EventTableRow,
} from '@/lib/seating';
import { suggestTableFor } from '@/lib/seat-suggest';

const table = (id: string, n: number, over: Partial<EventTableRow> = {}): EventTableRow => ({
  table_id: id,
  public_id: `S89T-${id}`,
  event_id: 'e',
  table_label: `Table ${n}`,
  table_type: 'round_10',
  capacity: 10,
  sort_order: n,
  x_pos: 10 * n,
  y_pos: 30,
  ...over,
});

const guest = (id: string, over: Partial<AutoSeatGuest> = {}): AutoSeatGuest => ({
  guest_id: id,
  role: 'guest',
  group_category: 'friends',
  rsvp_status: 'attending',
  plus_one_of_guest_id: null,
  last_name: id,
  first_name: id,
  group_id: null,
  ...over,
});

test('the elder roles are the grandparents of either side', () => {
  assert.equal(isElderRole('bride_grandparents'), true);
  assert.equal(isElderRole('groom_grandparents'), true);
  assert.equal(isElderRole('bride_parents'), false);
  assert.equal(isElderRole('guest'), false);
  assert.equal(isElderRole(null), false);
});

test('the room points read the doors and the speakers only when they are on the plan', () => {
  const off = seatRoomPoints(DEFAULT_FLOOR_PLAN);
  assert.deepEqual(off, { exits: [], speakers: null });
  const on = seatRoomPoints({ ...DEFAULT_FLOOR_PLAN, entrance_enabled: true, speakers_enabled: true, speakers_x: 5, speakers_y: 6 });
  assert.deepEqual(on.exits, [{ x: DEFAULT_FLOOR_PLAN.entrance_x, y: DEFAULT_FLOOR_PLAN.entrance_y }]);
  assert.deepEqual(on.speakers, { x: 5, y: 6 });
});

test('Elders tables order: away from the speakers first, then nearest a way out', () => {
  const pts: Record<string, { x: number; y: number }> = { a: { x: 10, y: 10 }, b: { x: 80, y: 90 }, c: { x: 50, y: 50 }, r: { x: 90, y: 95 } };
  const tables = [
    table('a', 1, { table_kind: 'elders' }),
    table('b', 2, { table_kind: 'elders' }),
    table('c', 3, { table_kind: 'elders' }),
    table('r', 4),
  ];
  const room = { exits: [{ x: 90, y: 95 }], speakers: { x: 12, y: 12 } };
  const order = elderTableOrder(tables, room, (t) => pts[t.table_id]!).map((t) => t.table_id);
  assert.deepEqual(order, ['b', 'c', 'a'], 'a sits by the speakers so it is last; b is nearest the door; a regular table is no Elders table');
});

test('the grandparents and their +1s sit at the Elders table first, the rest go on as before', () => {
  const tables = [table('front', 1), table('eld', 2, { table_kind: 'elders' })];
  const guests = [
    guest('lola', { role: 'bride_grandparents', last_name: 'A' }),
    guest('lolo', { role: 'groom_grandparents', last_name: 'B' }),
    guest('lolo-plus', { plus_one_of_guest_id: 'lolo' }),
    guest('friend1'),
    guest('friend2'),
  ];
  const rows = computeAutoSeat(tables, guests, []);
  const at = new Map(rows.map((r) => [r.guest_id, r.table_id]));
  assert.equal(at.get('lola'), 'eld');
  assert.equal(at.get('lolo'), 'eld');
  assert.equal(at.get('lolo-plus'), 'eld', 'a +1 rides with their elder');
  assert.equal(rows.length, 5, 'everyone still gets a seat');
});

test('with no Elders table nothing changes: the grandparents are seated by the old rules', () => {
  const tables = [table('front', 1), table('back', 2)];
  const guests = [guest('lola', { role: 'bride_grandparents' }), guest('friend')];
  const withKinds = computeAutoSeat(tables, guests, [], undefined, null, undefined, true, null, { room: { exits: [{ x: 99, y: 99 }], speakers: null } });
  const plain = computeAutoSeat(tables, guests, []);
  assert.deepEqual(withKinds, plain);
});

test('an elder the Elders tables cannot hold goes on through the rules, never unseated', () => {
  const tables = [table('front', 1), table('eld', 2, { table_kind: 'elders', capacity: 2 })];
  const guests = [
    guest('g1', { role: 'bride_grandparents', last_name: 'A' }),
    guest('g2', { role: 'bride_grandparents', last_name: 'B' }),
    guest('g3', { role: 'groom_grandparents', last_name: 'C' }),
  ];
  const rows = computeAutoSeat(tables, guests, []);
  assert.equal(rows.length, 3);
  assert.equal(rows.filter((r) => r.table_id === 'eld').length, 2);
});

test('the Elders table by the door is filled before the one by the speakers', () => {
  const tables = [
    table('loud', 1, { table_kind: 'elders', capacity: 2, x_pos: 10, y_pos: 10 }),
    table('door', 2, { table_kind: 'elders', capacity: 2, x_pos: 85, y_pos: 90 }),
  ];
  const guests = [guest('lola', { role: 'bride_grandparents' })];
  const rows = computeAutoSeat(tables, guests, [], undefined, null, undefined, true, null, {
    room: { exits: [{ x: 90, y: 95 }], speakers: { x: 8, y: 8 } },
  });
  assert.equal(rows[0]?.table_id, 'door');
});

test('the Guests list seat hint never points at a Spare or a locked table', () => {
  const tables = [table('spare', 1, { table_kind: 'spare' }), table('lock', 2, { locked: true }), table('open', 3)];
  const label = suggestTableFor({ role: 'guest', group_category: 'friends', side: 'both', seating_priority: null }, tables, []);
  assert.equal(label, 'Table 3');
});

test('the floor plan reads the Speakers element and both ⋯ switches (only an explicit false turns one off)', () => {
  const src = readFileSync(join(__dirname, 'seating.ts'), 'utf8');
  assert.match(src, /guest_seat_view,speakers_enabled,speakers_x,speakers_y,auto_seat_rsvps,seat_suggestions'/);
  assert.match(src, /auto_seat_rsvps: \(data as \{ auto_seat_rsvps\?: unknown \}\)\.auto_seat_rsvps !== false/);
  assert.match(src, /seat_suggestions: \(data as \{ seat_suggestions\?: unknown \}\)\.seat_suggestions !== false/);
  const actions = readFileSync(join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'seating', 'actions.ts'), 'utf8');
  assert.equal((actions.match(/room: seatRoomPoints\(floorPlan\)/g) ?? []).length, 4, 'every auto-seat run in the editor knows the room');
  assert.match(readFileSync(join(__dirname, 'seating-reconcile.ts'), 'utf8'), /room: seatRoomPoints\(floorPlan\)/);
});

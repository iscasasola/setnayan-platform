/**
 * 🔒 THE TABLES AND DOORS IN A HALL OR ROOM (lib/space-tables.ts — #7968's piece A, hung on a space, owner 2026-11-19).
 *   · names and ranges are parsed whole or refused whole (never half-made);
 *   · Line up is name order a person expects (T9 before T10);
 *   · a Long table's one number counts EVERY chair, ends included; ≤ 4 with no ends draws square;
 *   · a room size is both sides or neither, ≤ 500 m (the shop's own CHECK).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { chairPoints, lineUp, moveStep, parseRoomSize, parseUnitNames, shapeDrawn, tableWords, type Unit } from './space-tables';

test('names: commas, new lines and runs; a typo is refused whole', () => {
  assert.deepEqual(parseUnitNames('301-303, Penthouse'), { ok: true, names: ['301', '302', '303', 'Penthouse'] });
  assert.deepEqual(parseUnitNames('T1-T3'), { ok: true, names: ['T1', 'T2', 'T3'] });
  assert.deepEqual(parseUnitNames('Room 1-2'), { ok: true, names: ['Room 1', 'Room 2'] });
  assert.deepEqual(parseUnitNames('01-03'), { ok: true, names: ['01', '02', '03'] });
  assert.equal(parseUnitNames('').ok, false);
  assert.equal(parseUnitNames('10-1').ok, false, 'a run counting down was made');
  assert.equal(parseUnitNames('1-10000').ok, false, 'ten thousand tables were made from a typo');
  assert.equal(parseUnitNames('301, 301').ok, false, 'one name typed twice was made twice');
});

test('Line up: T9 before T10, per hall or room', () => {
  const u = (id: string, groupId: string, name: string): Unit => ({ id, groupId, kind: 'table', name, shape: 'round', chairs: 8, chairsAtEnds: false, sortOrder: 0 });
  const order = lineUp([u('a', 'g', 'T10'), u('b', 'g', 'T9'), u('c', 'h', 'B2'), u('d', 'h', 'B1')]);
  assert.deepEqual(order.get('g'), ['b', 'a']);
  assert.deepEqual(order.get('h'), ['d', 'c']);
  assert.deepEqual(moveStep(['a', 'b', 'c'], 'b', -1), ['b', 'a', 'c']);
  assert.deepEqual(moveStep(['a', 'b', 'c'], 'a', -1), ['a', 'b', 'c'], 'an edge tile moved off the list');
});

test('tables: one chair count; ends belong to Long; small Long draws square', () => {
  assert.equal(chairPoints('long', 10, true).length, 10, 'a Long table with ends drew more or fewer than its one number');
  assert.equal(chairPoints('round', 8, false).length, 8);
  assert.equal(chairPoints('half_moon', 4, false).length, 4);
  assert.equal(shapeDrawn('long', 4, false), 'square');
  assert.equal(shapeDrawn('long', 4, true), 'long');
  assert.equal(tableWords('long', 10, true), 'Long · 10 chairs · 2 at the ends');
  assert.equal(tableWords('round', 8, true), 'Round · 8 chairs', 'a Round table said "at the ends"');
  assert.equal(tableWords('half_moon', 4, false), 'Half-moon booth · seats 4');
});

test('room size: both or neither, up to 500 m', () => {
  assert.deepEqual(parseRoomSize('20', '14'), { ok: true, widthM: 20, lengthM: 14 });
  assert.deepEqual(parseRoomSize('', ''), { ok: true, widthM: null, lengthM: null });
  assert.equal(parseRoomSize('20', '').ok, false);
  assert.equal(parseRoomSize('501', '10').ok, false);
  assert.equal(parseRoomSize('0', '10').ok, false);
});

test('a hall’s plan: its own size, tables and doors — never another hall’s', async () => {
  const { shopPlanOf } = await import('./space-tables');
  const data = {
    groups: [
      { id: 'h1', kind: 'hall' as const, name: 'Hall001', widthM: 20, lengthM: 30, sortOrder: 0 },
      { id: 'h2', kind: 'hall' as const, name: 'Hall002', widthM: null, lengthM: null, sortOrder: 1 },
    ],
    units: [
      { id: 't1', groupId: 'h1', kind: 'table' as const, name: 'T1', shape: 'round' as const, chairs: 8, chairsAtEnds: false, sortOrder: 0 },
      { id: 't2', groupId: 'h2', kind: 'table' as const, name: 'T1', shape: 'long' as const, chairs: 10, chairsAtEnds: true, sortOrder: 0 },
    ],
    doors: [{ id: 'd1', groupId: 'h1', kind: 'main' as const, wall: 'front' as const, along: 'middle' as const }],
  };
  const p = shopPlanOf(data, 'h1')!;
  assert.deepEqual(p.room, { widthM: 20, lengthM: 30 });
  assert.deepEqual(p.tables.map((t) => t.id), ['t1']);
  assert.deepEqual(p.doors.map((d) => d.id), ['d1']);
  assert.equal(shopPlanOf(data, 'h2')!.room, null, 'an unsized hall borrowed a size');
  assert.equal(shopPlanOf(data, 'nope'), null);
});

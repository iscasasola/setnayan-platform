/**
 * 🔒 ROOMS & SEATING (lib/rooms-seating.ts — piece A of the units map, owner 2026-11-18).
 *   · names and ranges are parsed whole or refused whole (never half-made);
 *   · Line up is name order a person expects (T9 before T10);
 *   · a Long table's one number counts EVERY chair, ends included; ≤ 4 with no ends draws square;
 *   · a room size is both sides or neither, ≤ 500 m (the shop's own CHECK).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { chairPoints, lineUp, moveStep, parseRoomSize, parseUnitNames, shapeDrawn, tableWords, type Unit } from './rooms-seating';

test('names: commas, new lines and runs; a typo is refused whole', () => {
  assert.deepEqual(parseUnitNames('301-303, Penthouse'), { ok: true, names: ['301', '302', '303', 'Penthouse'] });
  assert.deepEqual(parseUnitNames('T1-T3'), { ok: true, names: ['T1', 'T2', 'T3'] });
  assert.deepEqual(parseUnitNames('Room 1-2'), { ok: true, names: ['Room 1', 'Room 2'] });
  assert.deepEqual(parseUnitNames('01-03'), { ok: true, names: ['01', '02', '03'] });
  assert.equal(parseUnitNames('').ok, false);
  assert.equal(parseUnitNames('10-1').ok, false, 'a run counting down was made');
  assert.equal(parseUnitNames('1-10000').ok, false, 'ten thousand rooms were made from a typo');
  assert.equal(parseUnitNames('301, 301').ok, false, 'one name typed twice was made twice');
});

test('Line up: T9 before T10, per floor or area', () => {
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
  assert.equal(tableWords('long', 10, true), 'Long · 10 chairs · at the ends');
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

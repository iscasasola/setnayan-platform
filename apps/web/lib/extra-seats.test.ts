import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planExtraSeats, seatToName, type ExtraSeatRow } from '@/lib/extra-seats';

/** ⚖ Owner 2026-09-21: "+ will have seats beside the person invited". */

const tba = (id: string, at: string): ExtraSeatRow => ({ guest_id: id, first_name: 'TBA', confirmed_at: null, created_at: at });
const named = (id: string, at: string): ExtraSeatRow => ({ guest_id: id, first_name: 'Rosa', confirmed_at: at, created_at: at });

test('+3 with no seats yet creates three', () => {
  assert.deepEqual(planExtraSeats(3, []), { ok: true, create: 3, remove: [] });
});

test('raising tops up; the existing seats stay', () => {
  assert.deepEqual(planExtraSeats(4, [tba('a', '1'), named('b', '2')]), { ok: true, create: 2, remove: [] });
});

test('lowering removes placeholders only, newest first', () => {
  const rows = [tba('old', '1'), named('rosa', '2'), tba('new', '3')];
  assert.deepEqual(planExtraSeats(2, rows), { ok: true, create: 0, remove: ['new'] });
  assert.deepEqual(planExtraSeats(1, rows), { ok: true, create: 0, remove: ['new', 'old'] });
});

test('🔒 a named plus-one is never removed — going below them is refused, with the reason', () => {
  const plan = planExtraSeats(0, [named('rosa', '1'), tba('x', '2')], 'Ana');
  assert.equal(plan.ok, false);
  assert.match(!plan.ok ? plan.reason : '', /Ana’s plus-one is already named/);
});

test('an RSVP name fills the oldest open seat, never a named one', () => {
  assert.equal(seatToName([named('rosa', '1'), tba('b', '3'), tba('a', '2')]), 'a');
  assert.equal(seatToName([named('rosa', '1')]), null);
});

import { planSeatNames, readSeatNames } from '@/lib/extra-seats';

const form = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });

test('the reply reads one name per box, and an older reply’s single box still counts', () => {
  assert.deepEqual(
    readSeatNames(form({ plus_one_first_name_1: 'Rosa', plus_one_last_name_1: 'Cruz', plus_one_seat_id_1: 's1', plus_one_first_name_3: 'Ben' })),
    [{ seatId: 's1', first: 'Rosa', last: 'Cruz' }, { seatId: null, first: 'Ben', last: '' }],
  );
  assert.deepEqual(readSeatNames(form({ plus_one_first_name: 'Rosa' })), [{ seatId: null, first: 'Rosa', last: '' }]);
  assert.deepEqual(readSeatNames(form({ plus_one_first_name_1: '  ' })), [], 'a blank box is not a removal');
});

test('each name fills its own seat; a box without one takes the oldest open seat', () => {
  const seats = [tba('a', '1'), tba('b', '2'), named('c', '3')];
  assert.deepEqual(
    planSeatNames([{ seatId: 'c', first: 'Carl', last: '' }, { seatId: null, first: 'Ana', last: '' }], seats, 3),
    [{ kind: 'name', seatId: 'c', first: 'Carl', last: '' }, { kind: 'name', seatId: 'a', first: 'Ana', last: '' }],
  );
});

test('🔒 a reply can never make more seats than the couple gave, nor name someone else’s seat', () => {
  // A forged seat id from another guest is ignored — it takes an open seat instead.
  assert.deepEqual(planSeatNames([{ seatId: 'NOT-MINE', first: 'X', last: '' }], [tba('a', '1')], 1), [
    { kind: 'name', seatId: 'a', first: 'X', last: '' },
  ]);
  // Allowed 1, one seat already named: a second name is not saved, and nothing is made.
  assert.deepEqual(planSeatNames([{ seatId: null, first: 'Extra', last: '' }], [named('c', '1')], 1), []);
  // A +2 whose seats were never made gets them from the names — up to two.
  const ops = planSeatNames(
    [{ seatId: null, first: 'A', last: '' }, { seatId: null, first: 'B', last: '' }, { seatId: null, first: 'C', last: '' }],
    [],
    2,
  );
  assert.equal(ops.filter((o) => o.kind === 'create').length, 2);
});

import { plusOneNameSlots } from '@/lib/extra-seats';

test('the reply shows one box per seat, prefilled; no seats read → the old single box', () => {
  assert.deepEqual(plusOneNameSlots(3, [{ guest_id: 'a', name: 'Rosa Cruz' }, { guest_id: 'b', name: null }], null), [
    { seatId: 'a', name: 'Rosa Cruz' },
    { seatId: 'b', name: null },
    { seatId: null, name: null },
  ]);
  assert.deepEqual(plusOneNameSlots(2, undefined, 'Rosa'), [{ seatId: null, name: 'Rosa' }]);
});

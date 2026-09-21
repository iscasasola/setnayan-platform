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

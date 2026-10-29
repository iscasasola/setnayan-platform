import test from 'node:test';
import assert from 'node:assert/strict';

import { eventsByKind, eventsCountLabel } from '@/lib/shop-events-by-kind';

/**
 * "N events ›" and its by-kind sheet (owner 2026-10-30, item 114). Two sources that are not the same claim: the
 * receipt-backed Track record rows (exact, per kind) and the shop's own WEDDING count (an at-least, weddings only).
 */

const label = (k: string) => ({ wedding: 'Wedding', debut: 'Debut', corporate: 'Corporate event' })[k] ?? (k || 'Event');
const rows = (...types: Array<string | null>) => types.map((event_type) => ({ event_type }));

test('every kind is counted — the line says events, not weddings', () => {
  const out = eventsByKind({ completed: rows('wedding', 'debut', 'corporate', 'debut'), completedCapped: false, declaredWeddings: null, labelFor: label });
  assert.ok(out);
  assert.equal(out.total, 4);
  assert.equal(out.atLeast, false);
  assert.deepEqual(out.kinds.map((k) => [k.label, k.count, k.viaSetnayan]), [
    ['Wedding', 1, 1],
    ['Debut', 2, 2],
    ['Corporate event', 1, 1],
  ]);
  assert.equal(eventsCountLabel(out), '4 events');
});

test('🔑 the shop\'s own wedding count is the larger of the two, never the sum (it already includes Setnayan ones)', () => {
  const out = eventsByKind({ completed: rows('wedding', 'debut'), completedCapped: false, declaredWeddings: 84, labelFor: label });
  assert.ok(out);
  const w = out.kinds[0]!;
  assert.deepEqual([w.count, w.atLeast, w.viaSetnayan], [84, true, 1]);
  assert.equal(out.total, 85);
  assert.equal(out.atLeast, true);
  assert.equal(eventsCountLabel(out), '85+ events');
  // A shop whose Setnayan weddings outgrew what it once said: the measured number wins and is exact.
  const grown = eventsByKind({ completed: rows('wedding', 'wedding', 'wedding'), completedCapped: false, declaredWeddings: 2, labelFor: label });
  assert.deepEqual([grown!.kinds[0]!.count, grown!.kinds[0]!.atLeast, grown!.atLeast], [3, false, false]);
});

test('⚠ nothing measured and nothing said is null — never "0 events"', () => {
  assert.equal(eventsByKind({ completed: [], completedCapped: false, declaredWeddings: null, labelFor: label }), null);
  assert.equal(eventsByKind({ completed: [], completedCapped: false, declaredWeddings: 0, labelFor: label }), null);
  assert.equal(eventsByKind({ completed: [], completedCapped: false, declaredWeddings: Number.NaN, labelFor: label }), null);
});

test('a declared count alone still counts — the Wedding row, as an at-least', () => {
  const out = eventsByKind({ completed: [], completedCapped: false, declaredWeddings: 120, labelFor: label });
  assert.ok(out);
  assert.equal(eventsCountLabel(out), '120+ events');
  assert.equal(out.viaSetnayan, 0);
});

test('a capped Track record read makes the total an at-least', () => {
  const out = eventsByKind({ completed: rows('debut'), completedCapped: true, declaredWeddings: null, labelFor: label });
  assert.equal(eventsCountLabel(out!), '1+ events');
});

test('a row with no event type is counted under the vocabulary\'s fallback, not dropped', () => {
  const out = eventsByKind({ completed: rows(null, '  '), completedCapped: false, declaredWeddings: null, labelFor: label });
  assert.deepEqual(out!.kinds.map((k) => [k.label, k.count]), [['Event', 2]]);
  assert.equal(eventsCountLabel({ total: 1, atLeast: false }), '1 event');
});

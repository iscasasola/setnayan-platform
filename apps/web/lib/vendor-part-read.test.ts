import test from 'node:test';
import assert from 'node:assert/strict';
import { partReadOutcome } from './vendor-part-read';

test('a payload is ok', () => {
  assert.equal(partReadOutcome(null, { any: 1 }), 'ok');
});

test('a gate is an answer — the named refusals and an empty answer', () => {
  assert.equal(partReadOutcome({ code: '42501' }, null), 'gate'); // not_booked · category_not_* · fee_unsettled
  assert.equal(partReadOutcome({ code: 'P0002' }, null), 'gate'); // event_not_found · not_published
  assert.equal(partReadOutcome(null, null), 'gate');
});

test('anything else did not answer — it is said, never redirected', () => {
  assert.equal(partReadOutcome({ code: '57014' }, null), 'failed'); // statement timeout
  assert.equal(partReadOutcome({ code: 'PGRST301' }, null), 'failed');
  assert.equal(partReadOutcome({ code: null }, null), 'failed'); // fetch failed — no code at all
  assert.equal(partReadOutcome({}, { stale: true }), 'failed');
});

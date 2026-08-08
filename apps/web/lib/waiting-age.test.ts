import { test } from 'node:test';
import assert from 'node:assert/strict';

import { waitingAge } from './waiting-age';

const AT = Date.parse('2026-08-08T12:00:00+08:00');
const ago = (ms: number) => new Date(AT - ms).toISOString();

test('under an hour reads "just now", never "waiting 0 h"', () => {
  assert.deepEqual(waitingAge(ago(0), AT), { label: 'just now', overdue: false });
  assert.deepEqual(waitingAge(ago(59 * 60_000), AT), { label: 'just now', overdue: false });
});

test('hours up to a day, floored', () => {
  assert.equal(waitingAge(ago(2 * 3_600_000), AT)?.label, 'waiting 2 h');
  assert.equal(waitingAge(ago(2.9 * 3_600_000), AT)?.label, 'waiting 2 h');
  assert.equal(waitingAge(ago(23 * 3_600_000), AT)?.label, 'waiting 23 h');
  assert.equal(waitingAge(ago(23 * 3_600_000), AT)?.overdue, false);
});

test('a day or more reads in days, singular at one, and is overdue', () => {
  assert.deepEqual(waitingAge(ago(24 * 3_600_000), AT), { label: 'waiting 1 day', overdue: true });
  assert.deepEqual(waitingAge(ago(72 * 3_600_000), AT), { label: 'waiting 3 days', overdue: true });
});

test('🪤 elapsed time, not a calendar difference — the answer is the same in any zone', () => {
  // Two civil dates subtracted would drift here; milliseconds cannot.
  const created = '2026-08-06T23:30:00+08:00';
  const now = Date.parse('2026-08-08T00:30:00+08:00'); // 25 h later, 2 calendar days
  assert.equal(waitingAge(created, now)?.label, 'waiting 1 day');
});

test('🪤 a future timestamp is clock skew, not negative waiting', () => {
  assert.deepEqual(waitingAge(ago(-5 * 3_600_000), AT), { label: 'just now', overdue: false });
});

test('an unparseable timestamp says nothing rather than guessing', () => {
  assert.equal(waitingAge('not a date', AT), null);
  assert.equal(waitingAge('', AT), null);
});

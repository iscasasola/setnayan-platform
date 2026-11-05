import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lockLeadDaysFor, timelineStatusOf, usuallyBookedAheadLine } from './vendors-plan-budget';
import { stripComments } from '@/lib/strip-comments';

/**
 * usually-booked-ahead.test.ts
 *
 * Owner, 2026-10-12 (DECISION_LOG "SUPPLIERS PAGE — THE LAST OPEN APPROVALS
 * ANSWERED", approval 12): the "168 days overdue" line becomes a kind
 * "usually booked N months ahead" — NOW.
 *
 * The STATUS stays `overdue` — it still puts the category first in "Still needs
 * your decision" and the Coverage Strip. Only the words a couple reads change.
 */

const here = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => stripComments(readFileSync(join(here, '..', rel), 'utf8'));

test('the line names the category’s own lead, in whole months', () => {
  assert.equal(lockLeadDaysFor('reception_venue'), 270);
  assert.equal(usuallyBookedAheadLine('reception_venue'), 'Usually booked 9 months ahead');
  assert.equal(usuallyBookedAheadLine('photography'), 'Usually booked 8 months ahead');
  // 30 days → one month, singular.
  assert.equal(usuallyBookedAheadLine('accommodation'), 'Usually booked 1 month ahead');
  // Never "0 months": the shortest floor still says one.
  assert.match(usuallyBookedAheadLine('guest_shuttle'), /^Usually booked [1-9]\d* months? ahead$/);
});

test('the clock still calls it overdue (ordering), only the words are kind', () => {
  assert.equal(timelineStatusOf('reception_venue', 100, 'empty'), 'overdue');
});

test('no Suppliers surface prints a day count of overdue', () => {
  for (const rel of [
    'app/dashboard/[eventId]/vendors/_components/build-locked.tsx',
    'app/dashboard/[eventId]/vendors/_components/plan-budget-accordion.tsx',
  ]) {
    const code = src(rel);
    assert.ok(!/d overdue/.test(code), `${rel} must not say "Nd overdue"`);
    assert.match(code, /usuallyBookedAheadLine\(/, `${rel} must use the kind line`);
  }
  // The accordion chip is the quiet gold one, not the red warning.
  const acc = src('app/dashboard/[eventId]/vendors/_components/plan-budget-accordion.tsx');
  assert.ok(!/className="chip over"/.test(acc), 'the red overdue chip is gone');
});

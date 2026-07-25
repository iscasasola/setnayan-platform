/**
 * Rotation status maths (node:test via tsx · `pnpm test:unit`).
 *
 * These four states drive the red banner on /admin/secrets, so an off-by-one at
 * the boundary is the difference between "you are fine" and "you are 1 day past
 * a 90-day service-role key". Time is injected, never read from the clock.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeStatus,
  formatAge,
  isAlarming,
  resolveLastRotated,
  DUE_SOON_WINDOW_DAYS,
} from './status';

const NOW = new Date('2026-07-25T00:00:00.000Z');
const DAY = 86_400_000;

/** A date `days` before NOW. */
function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY);
}

test('policyDays null is always "manual" — even with no rotation ever recorded', () => {
  assert.equal(computeStatus({ policyDays: null }, null, NOW), 'manual');
  assert.equal(computeStatus({ policyDays: null }, daysAgo(5000), NOW), 'manual');
});

test('a scheduled secret with no recorded rotation is "unknown", not "ok"', () => {
  assert.equal(computeStatus({ policyDays: 90 }, null, NOW), 'unknown');
});

test('boundary: exactly at the policy age is still ok-side, one tick past is overdue', () => {
  const policyDays = 90;
  assert.equal(computeStatus({ policyDays }, daysAgo(90), NOW), 'due-soon');
  assert.equal(
    computeStatus({ policyDays }, new Date(NOW.getTime() - 90 * DAY - 1), NOW),
    'overdue',
  );
  assert.equal(computeStatus({ policyDays }, daysAgo(91), NOW), 'overdue');
});

test('boundary: the due-soon window opens exactly 14 days before the deadline', () => {
  const policyDays = 90;
  assert.equal(DUE_SOON_WINDOW_DAYS, 14);
  // 76 days old == policyDays - 14 exactly → still ok (strictly greater required).
  assert.equal(computeStatus({ policyDays }, daysAgo(76), NOW), 'ok');
  assert.equal(
    computeStatus({ policyDays }, new Date(NOW.getTime() - 76 * DAY - 1), NOW),
    'due-soon',
  );
  assert.equal(computeStatus({ policyDays }, daysAgo(89), NOW), 'due-soon');
});

test('a freshly rotated secret is ok; a future timestamp does not go negative-overdue', () => {
  assert.equal(computeStatus({ policyDays: 90 }, NOW, NOW), 'ok');
  assert.equal(computeStatus({ policyDays: 90 }, daysAgo(-5), NOW), 'ok');
});

test('short cadences work the same way (60-day Meta token)', () => {
  assert.equal(computeStatus({ policyDays: 60 }, daysAgo(30), NOW), 'ok');
  assert.equal(computeStatus({ policyDays: 60 }, daysAgo(50), NOW), 'due-soon');
  assert.equal(computeStatus({ policyDays: 60 }, daysAgo(61), NOW), 'overdue');
});

test('only overdue + unknown raise the banner', () => {
  assert.equal(isAlarming('overdue'), true);
  assert.equal(isAlarming('unknown'), true);
  assert.equal(isAlarming('due-soon'), false);
  assert.equal(isAlarming('ok'), false);
  assert.equal(isAlarming('manual'), false);
});

test('resolveLastRotated takes the NEWEST of the DB stamp and the Vercel env timestamps', () => {
  const def = { envVars: ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'] };

  // Vercel is newer than our stamp → Vercel wins.
  assert.deepEqual(
    resolveLastRotated(def, daysAgo(100), {
      R2_ACCESS_KEY_ID: daysAgo(10).getTime(),
      R2_SECRET_ACCESS_KEY: daysAgo(40).getTime(),
    }),
    daysAgo(10),
  );

  // Our stamp is newer → the stamp wins.
  assert.deepEqual(
    resolveLastRotated(def, daysAgo(3), {
      R2_ACCESS_KEY_ID: daysAgo(200).getTime(),
    }),
    daysAgo(3),
  );

  // Env-only (a secret rotated in the Vercel dashboard before this board existed).
  assert.deepEqual(
    resolveLastRotated(def, null, { R2_ACCESS_KEY_ID: daysAgo(7).getTime() }),
    daysAgo(7),
  );

  // Nothing anywhere → null, which computeStatus turns into 'unknown'.
  assert.equal(resolveLastRotated(def, null, {}), null);

  // Unrelated keys in the map are ignored.
  assert.equal(resolveLastRotated(def, null, { SOMETHING_ELSE: NOW.getTime() }), null);

  // Null/garbage timestamps are skipped, not coerced to 0 (epoch = maximally overdue).
  assert.equal(
    resolveLastRotated(def, null, { R2_ACCESS_KEY_ID: null, R2_SECRET_ACCESS_KEY: NaN }),
    null,
  );
});

test('formatAge reads as plain English at every scale', () => {
  assert.equal(formatAge(null, NOW), 'never recorded');
  assert.equal(formatAge(NOW, NOW), 'rotated today');
  assert.equal(formatAge(daysAgo(1), NOW), 'rotated 1 day ago');
  assert.equal(formatAge(daysAgo(12), NOW), 'rotated 12 days ago');
  assert.equal(formatAge(daysAgo(120), NOW), 'rotated ~4 months ago');
});

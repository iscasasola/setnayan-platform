/**
 * no-amount-set-is-not-no-plan.test.ts — Customers › Money (coordinator walk, 2026-10-23).
 *
 * A shop whose bookings' instalments are all "a % of a total that was never set" has bookedPhp 0, so pct is null —
 * and Money said "No payment plans yet — a couple's plan shows here once they book you" over that shop's own Next-in
 * rows. "Booked, amounts not set" is not "no plans": it is said as a count, and "no plans" is kept for nothing booked.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { moneyTopLine } from '@/lib/vendor-money';

const VIEW = join(__dirname, '_components', 'money-view.tsx');

test('the line under the figures: meter · amounts not set · no plans', () => {
  assert.equal(moneyTopLine({ pct: 40, unresolved: 0 }), 'meter');
  assert.equal(moneyTopLine({ pct: 40, unresolved: 2 }), 'meter', 'the meter already says "N with no amount set"');
  assert.equal(moneyTopLine({ pct: null, unresolved: 3 }), 'unset', 'booked with no amounts read as "no plans"');
  assert.equal(moneyTopLine({ pct: null, unresolved: 0 }), 'none');
});

test('Money draws "No payment plans yet" only when moneyTopLine says none', () => {
  const src = stripComments(readFileSync(VIEW, 'utf8'));
  const none = src.indexOf('data-money-none=""');
  const unset = src.indexOf('data-money-unset=""');
  assert.ok(none > 0 && unset > 0, 'the two lines are gone — re-point this guard');
  const branch = src.slice(src.indexOf('data-money-meter=""') - 200, none);
  assert.match(branch, /moneyTopLine\(totals\)\s*===\s*'meter'/, 'the meter is no longer chosen by moneyTopLine');
  assert.match(branch, /moneyTopLine\(totals\)\s*===\s*'unset'\s*\?/, 'amounts-not-set falls through to "no plans" again');
  assert.ok(unset < none, 'the amounts-not-set line must be decided before "no plans"');
});

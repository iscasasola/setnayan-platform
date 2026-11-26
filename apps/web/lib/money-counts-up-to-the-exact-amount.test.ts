/**
 * money-counts-up-to-the-exact-amount.test.ts — owner ruling, brief Add 39 (final check A2-P1, 25 Nov 2026).
 *
 * "Money counts up too, ending on the exact amount." Home's paid and owing figures keep counting up from ₱0 (the
 * owner's 7 Oct rule that every number animates, held by `app/dashboard/[eventId]/home-numbers-count.test.ts`). What
 * this file holds is the end: the count's last frame is the true value itself, never a rounding of it. So a figure
 * shown with centavos lands on its centavos, and a whole-peso face lands on exactly what the reader holds.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { countFrame, easeOutCubic } from '@/components/count';
import { formatPhp, formatPhpRounded } from '@/lib/php';

test('the last frame is the exact amount, centavos and all', () => {
  for (const value of [120_450.5, 44_550.25, 0.01, 999_999.99, 1_000_000]) {
    assert.equal(countFrame(0, value, 1), value, `${value} did not land on itself`);
    assert.equal(formatPhp(countFrame(0, value, 1)), formatPhp(value));
  }
  assert.equal(countFrame(0, 120_450.5, 1.4), 120_450.5, 'a late frame (t past 1) still lands exactly');
});

test('on the way it counts in whole steps, upward from ₱0, and never past the amount', () => {
  const value = 120_450.5;
  let last = -1;
  for (let i = 0; i < 60; i += 1) {
    const shown = countFrame(0, value, i / 60);
    assert.ok(Number.isInteger(shown), `frame ${i} showed ${shown}`);
    assert.ok(shown >= last && shown <= Math.ceil(value), `frame ${i} went backwards or past the amount`);
    last = shown;
  }
  assert.equal(countFrame(0, value, 0.5), Math.round(value * easeOutCubic(0.5)));
});

test('a whole-peso money face ends on exactly what the reader holds', () => {
  for (const value of [120_450, 44_550, 750_000]) {
    assert.equal(formatPhpRounded(countFrame(0, value, 1)), formatPhpRounded(value));
  }
});

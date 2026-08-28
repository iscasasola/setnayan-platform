/**
 * price-decides-reach.test.ts — the rules S5 exists to hold.
 *
 * Three of them, and each is here because it is the thing that quietly stops
 * being true:
 *
 *   1. THE BAND ARITHMETIC HAS ONE HOME. It had two, in two flows, at two
 *      points of the same range, and neither knew about the other. A third copy
 *      would be free to disagree with both.
 *   2. THE SEARCH OPTS IN EXPLICITLY. The band-derived budget is offered by the
 *      resolver and taken by the two surfaces that rank shops; nothing inherits
 *      it, and the two surfaces must never disagree about one couple's budget.
 *   3. SEGMENTATION NEVER HIDES A SHOP, AND NEVER SELLS PLACEMENT. A priceless
 *      card falls to a neutral fit, not out of the results; a dearer card never
 *      outranks a cheaper one for being dearer.
 *
 * Source-scanning rules read the file with COMMENTS STRIPPED — every file below
 * carries a comment describing the very thing being banned, so a raw match
 * reports the fix as the defect.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { bandRangePhp, bandMidBudgetPhp, bandReachBudgetPhp } from '@/lib/budget-band-money';
import { priceFitScore, isBudgetFiltered, PRICE_FIT_NEUTRAL } from '@/lib/smart-sort';

const WEB_ROOT = join(process.cwd(), process.cwd().endsWith('/apps/web') ? '' : 'apps/web');
const read = (rel: string) => stripComments(readFileSync(join(WEB_ROOT, rel), 'utf8'));

const BAND_MONEY = 'lib/budget-band-money.ts';
/** Every file that turns a budget band into pesos. Adding one means adding it
 *  here — the point is that the list is short and visible. */
const BAND_MONEY_CALLERS = [
  'lib/create-event-capture.ts',
  'lib/budget-allocation-data.ts',
  'app/onboarding/wedding/_components/onboarding-shell.tsx',
];

// ── 1 · ONE HOME FOR THE ARITHMETIC ───────────────────────────────────────

test('every band-to-pesos caller imports the shared module', () => {
  for (const rel of BAND_MONEY_CALLERS) {
    assert.match(
      read(rel),
      /from ['"](@\/lib|\.)\/budget-band-money['"]/,
      `${rel} must get the band arithmetic from ${BAND_MONEY}`,
    );
  }
});

test('no caller re-implements the band spread', () => {
  // 0.8 / 1.2 around the per-head median, rounded to ₱50,000 — the shape of the
  // copy that drifted. It may exist in exactly one file.
  for (const rel of BAND_MONEY_CALLERS) {
    const src = read(rel);
    assert.ok(!/\*\s*0\.8\s*\*/.test(src), `${rel} re-implements the band low end`);
    assert.ok(!/\*\s*1\.2\s*\*/.test(src), `${rel} re-implements the band high end`);
    assert.ok(!/\/\s*50000\s*\)\s*\*\s*50000/.test(src), `${rel} re-implements the ₱50k rounding`);
  }
  const home = read(BAND_MONEY);
  assert.match(home, /BAND_SPREAD_LOW/);
  assert.match(home, /BAND_SPREAD_HIGH/);
});

test('the two stored answers still differ, and the file says so', () => {
  // Not a bug to fix here — a decision to surface. If these ever converge,
  // somebody made a call about a couple's money and this test should be the
  // thing that notices.
  const mid = bandMidBudgetPhp(5000, 150);
  const top = bandReachBudgetPhp(5000, 150);
  assert.equal(mid, 750_000);
  assert.equal(top, 900_000);
  assert.ok(top! > mid!, 'the onboarding stores the top; create-event stores the middle');
});

// ── 2 · THE SEARCH OPTS IN, AND BOTH SURFACES AGREE ───────────────────────

test('the resolver reads the couple’s band on a query it already makes', () => {
  const src = read('lib/budget-allocation-data.ts');
  assert.match(src, /budget_band/, 'budget_band must be in the events_host select');
  assert.match(src, /estimatedBudgetPhp/);
  assert.match(src, /budgetSource/);
});

test('both ranking surfaces take the band-derived budget, the same way', () => {
  for (const rel of [
    'app/dashboard/[eventId]/vendors/_actions/category-search.ts',
    'app/dashboard/[eventId]/vendors/page.tsx',
  ]) {
    assert.match(
      read(rel),
      /alloc\.budgetPhp\s*\?\?\s*alloc\.estimatedBudgetPhp/,
      `${rel} must search with the stated budget, else the band-derived one`,
    );
  }
});

test('the Budget Planner is NOT given the estimate', () => {
  // A plan is the couple's to state. The planner page may read budgetPhp only —
  // filling a money plan in from a guess puts words in their mouth.
  const src = read('app/dashboard/[eventId]/budget/page.tsx');
  assert.ok(
    !/estimatedBudgetPhp/.test(src),
    'the planner must not silently adopt the band-derived estimate',
  );
});

// ── 3 · SEGMENTATION NEVER HIDES, NEVER SELLS PLACEMENT ───────────────────

test('an unpriced card scores neutral — it is never removed from the results', () => {
  assert.equal(priceFitScore(null, 900_000), PRICE_FIT_NEUTRAL);
  assert.equal(priceFitScore(undefined, 900_000), PRICE_FIT_NEUTRAL);
  assert.ok(PRICE_FIT_NEUTRAL > 0, 'a zero score would be a hidden shop');
  assert.equal(isBudgetFiltered('soft', null, 900_000), false);
  assert.equal(isBudgetFiltered('soft', 5_000_000, 90_000), false);
});

test('a shop over budget sinks but survives — every score stays above zero', () => {
  for (const over of [1, 2, 5, 20, 500]) {
    const score = priceFitScore(90_000 * (1 + over), 90_000);
    assert.ok(score > 0, `${over}× over budget scored ${score}`);
  }
});

test('a dearer shop never outranks a cheaper one for being dearer', () => {
  // Inside the budget every priced shop ties at 1.0, so price CANNOT climb the
  // ranking. This is the whole difference between segmentation and placement.
  const budget = 900_000;
  const cheap = priceFitScore(50_000, budget);
  const dear = priceFitScore(880_000, budget);
  assert.equal(cheap, dear);
  assert.equal(dear, 1);
  assert.ok(priceFitScore(1_800_000, budget) < dear, 'over budget must rank BELOW in budget');
});

test('a band-derived budget only ever widens who fits', () => {
  // The estimate is the TOP of the band precisely so it cannot sink a shop the
  // couple could have afforded.
  const med = 5000;
  const pax = 150;
  const range = bandRangePhp(med, pax)!;
  const startsAt = range.highPhp; // a shop at the very top of their band
  assert.equal(priceFitScore(startsAt, bandReachBudgetPhp(med, pax)), 1);
  assert.ok(priceFitScore(startsAt, range.lowPhp) < 1, 'the low end would have sunk it');
});

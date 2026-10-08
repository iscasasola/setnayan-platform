/**
 * budget-one-core.test.ts — the two screens a couple calls "our money" must do
 * their arithmetic in ONE place.
 *
 * WHAT THIS EXISTS TO STOP (BUD-8 · MARKETPLACE_FOUR_TABS_PLAN_2026-08-13 §3.3)
 * ───────────────────────────────────────────────────────────────────────────
 * `/dashboard/[eventId]/budget` moved onto the shared resolver in BUD-2. The
 * Merkado payments lens did not, and for six weeks the two computed the same
 * wedding's money with different formulas. Nothing was visibly wrong ONLY
 * because `NEXT_PUBLIC_BUDGET_TRUTH_ENABLED` is off: with it on, the prod
 * capture in `scripts/budget-parity.ts` has the lens printing **₱80,000 to go**
 * where `/budget` prints **₱0 still owed** (event `044f7e64…` — one
 * `considering` vendor whose headline is an estimate, not a commitment).
 *
 * `flag-chokepoint-scan.test.ts` already proves each surface still ASKS the
 * flag. It cannot prove the surface then does the arithmetic in the shared
 * core: a file that calls `isBudgetTruthEnabled()` and rolls its own totals
 * passes that scan and reintroduces this defect in full.
 *
 * So this asserts the wiring itself, on both surfaces:
 *
 *   1 · each imports and CALLS `budgetLiveSummaryMoney`;
 *   2 · every `buildBudgetLiveSummary(` in them is the `legacy:` argument to
 *       that call — never a total the surface reads directly. This is the
 *       counted assertion: bypass the core anywhere and the two counts diverge.
 *
 * Comments are stripped first, so a docblock naming a helper never reads as a
 * call — the same rule `flag-chokepoint-scan.test.ts` applies, and for the same
 * reason (this file's own docblock names both helpers).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The surfaces that print a couple's payment progress. Add one, inherit both checks. */
const MONEY_SURFACES = [
  'app/dashboard/[eventId]/budget/page.tsx',
  // The Merkado lens and the Home first screen read the SAME helper — lib/budget-live-read.ts
  // is where `budgetLiveSummaryMoney` runs for both (the lens used to carry its own copy).
  'lib/budget-live-read.ts',
  // ⤷ 2026-10-08 (Budget B1): `budget/actions.ts` was the third entry — the
  // Realtime refetch (`getBudgetLiveSummary`), a SECOND writer of the card
  // `budget/page.tsx` first-painted. The card and its refetch are deleted; a
  // Realtime change now re-runs the page's own render, so there is one writer.
  // The test below holds that the second writer does not come back.
] as const;

test('the /budget summary has ONE writer — no server action refetches its figures', () => {
  const actions = code(
    readFileSync(resolve(WEB, 'app/dashboard/[eventId]/budget/actions.ts'), 'utf8'),
  );
  for (const name of ['buildBudgetLiveSummary', 'budgetLiveSummaryMoney', 'resolveEventMoney', 'fetchBudgetSnapshot']) {
    assert.equal(
      count(actions, new RegExp(`\\b${name}\\b`, 'g')),
      0,
      `budget/actions.ts reads ${name} again — a server action that recomputes the summary is a ` +
        `second writer of the number the page renders (BA2: it swapped ₱0 for an unconfirmed ` +
        `supplier's ₱80,000 quote the moment a payment landed). Refresh the page instead.`,
    );
  }
});

/** Strip comments — a docblock mentioning a helper must not count as calling it. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function count(haystack: string, re: RegExp): number {
  return haystack.match(re)?.length ?? 0;
}

for (const rel of MONEY_SURFACES) {
  test(`${rel} does its payment-progress arithmetic in the shared core`, () => {
    const src = code(readFileSync(resolve(WEB, rel), 'utf8'));

    // `\b` anchored: `budgetLiveSummaryMoney` must not be satisfied by some
    // longer identifier that merely contains it.
    const calls = count(src, /\bbudgetLiveSummaryMoney\s*\(/g);
    assert.ok(
      calls >= 1,
      `${rel} must compute payment progress through budgetLiveSummaryMoney() — ` +
        `found ${calls} calls. Both money surfaces read ONE core, or they print ` +
        `different totals for the same wedding the day the flag flips.`,
    );

    assert.ok(
      /\bbudgetLiveSummaryMoney\b/.test(src) &&
        /from\s+['"](@\/lib\/budget-page-money|\.\/budget-page-money)['"]/.test(src),
      `${rel} must import budgetLiveSummaryMoney from lib/budget-page-money.`,
    );
  });

  test(`${rel} never reads the legacy total directly`, () => {
    const src = code(readFileSync(resolve(WEB, rel), 'utf8'));

    const legacyTotals = count(src, /\bbuildBudgetLiveSummary\s*\(/g);
    const asLegacyArg = count(src, /\blegacy:\s*buildBudgetLiveSummary\s*\(/g);

    assert.equal(
      legacyTotals,
      asLegacyArg,
      `${rel} calls buildBudgetLiveSummary() ${legacyTotals}× but only ${asLegacyArg} ` +
        `of those are the \`legacy:\` argument to budgetLiveSummaryMoney(). A direct ` +
        `read bypasses the flag and the resolver — that is exactly the divergence ` +
        `BUD-8 closed (₱80,000 apart on prod event 044f7e64…).`,
    );
  });
}

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
  'app/dashboard/[eventId]/vendors/_components/merkado-budget-lens.tsx',
  // BA2 · the Realtime refetch. Not a render surface — a server action — but it
  // WRITES the same card `budget/page.tsx` first-painted, so it is a money
  // surface by every meaning that matters. It returned the raw legacy summary
  // until 2026-09-02, which meant the /budget card swapped from the committed
  // total to "every vendor's itemized total, whatever their status" the moment
  // a payment landed: an unconfirmed supplier's quote, back on the page.
  'app/dashboard/[eventId]/budget/actions.ts',
] as const;

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

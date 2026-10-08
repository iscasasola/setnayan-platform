/**
 * the-skeleton-matches-the-page.test.ts — the loading skeleton is a PROMISE
 * about the page that replaces it, and a promise it breaks is a layout shift it
 * exists to prevent.
 *
 * ── The defect this pins ───────────────────────────────────────────────────
 * `budget/loading.tsx` once drew a FOUR-tile stat strip and NO header action
 * while the page rendered three stats and one action: the first thing a couple
 * saw on every budget load was a row re-flowing a beat later, with everything
 * under it jumping — and an action appearing out of nowhere.
 *
 * 🔑 NEITHER FILE IS WRONG ON ITS OWN. Each reviews cleanly in isolation;
 * typecheck passes, every other guard passes. The defect exists only in the
 * RELATIONSHIP between them, and only at render. A guard that checks ONE
 * surface can never see it.
 *
 * ── So this reads both, and DERIVES the numbers from the page ─────────────
 * The expected counts are not written down here. Since Budget B1 (2026-10-08)
 * the summary is `_components/budget-summary.tsx`, whose figures each carry a
 * `data-budget-cell` — so the number of figures is counted out of THAT file,
 * and whether the masthead carries an `actions=` slot is read out of
 * `page.tsx`. Change either and this tells you to change the skeleton.
 *
 * (Before B1 this counted `<SummaryStat` in `page.tsx`. That component is gone
 * with the boxed stat tile; the rule is the same rule, pointed at where the
 * figures now live.)
 *
 * 🛡 Mutation-checked: a fifth cell added to the summary, and `stats={3}` in
 * the loader, each seen red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const PAGE = join(__dirname, 'page.tsx');
const SUMMARY = join(__dirname, '_components', 'budget-summary.tsx');
const LOADING = join(__dirname, 'loading.tsx');

const read = (file: string) => stripComments(readFileSync(file, 'utf8'));

/** `stats={N}` / `actions={N}` off the skeleton call. */
function skeletonProp(name: 'stats' | 'actions' | 'rows'): number {
  const m = new RegExp(`${name}=\\{(\\d+)\\}`).exec(read(LOADING));
  assert.ok(
    m,
    `budget/loading.tsx no longer passes \`${name}\` to its skeleton — teach this guard the new shape rather than deleting it.`,
  );
  return Number(m[1]);
}

test('the page still draws its summary through the component this guard counts', () => {
  assert.match(
    read(PAGE),
    /<BudgetSummary\b/,
    'budget/page.tsx no longer renders <BudgetSummary> — the figures moved again; point this guard at where they live rather than deleting it.',
  );
});

test('the skeleton draws as many figures as the summary renders', () => {
  const rendered = [...read(SUMMARY).matchAll(/data-budget-cell="/g)].length;
  assert.ok(
    rendered > 0,
    'no `data-budget-cell` found in budget-summary.tsx — the count is derived from the component on purpose, so a match that stops matching would make this rule vacuous. Fix the match, do not hardcode a number.',
  );
  assert.equal(
    skeletonProp('stats'),
    rendered,
    `the skeleton promises ${skeletonProp('stats')} figures and the summary renders ${rendered}. ` +
      `The row visibly re-flows the moment the real page arrives, and everything below it jumps — ` +
      `which is the layout shift a skeleton exists to prevent.`,
  );
});

test('the skeleton draws a header action if the page has one', () => {
  const hasAction = /<PageMasthead[\s\S]{0,400}?actions=\{/.test(read(PAGE));
  const promised = skeletonProp('actions');
  if (hasAction) {
    assert.ok(
      promised >= 1,
      'the budget masthead carries an action (the exports) and the skeleton reserves no room for it, so a button appears out of nowhere when the page lands.',
    );
  } else {
    assert.equal(
      promised,
      0,
      'the skeleton reserves room for a header action the page no longer has, so the space collapses when the page lands.',
    );
  }
});

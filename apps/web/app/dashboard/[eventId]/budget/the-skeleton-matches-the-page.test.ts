/**
 * the-skeleton-matches-the-page.test.ts — the loading skeleton is a PROMISE
 * about the page that replaces it, and a promise it breaks is a layout shift it
 * exists to prevent.
 *
 * ── The defect this pins ───────────────────────────────────────────────────
 * `budget/loading.tsx` drew a FOUR-tile stat strip and NO header action.
 * `budget/page.tsx` renders THREE stats (Target · Committed · Budget left) and
 * ONE action (Export upcoming dates .ics). So the first thing a couple saw on
 * every budget load was a four-tile row becoming a three-tile row a beat later,
 * with everything under it jumping — and an action appearing out of nowhere.
 *
 * 🔑 NEITHER FILE IS WRONG ON ITS OWN. Each reviews cleanly in isolation;
 * typecheck passes, every other guard passes. The defect exists only in the
 * RELATIONSHIP between them, and only at render — the same shape as the two
 * pinned bars this repo already wrote a lint for, which the owner found by
 * looking at a phone. A guard that checks ONE surface can never see it.
 *
 * ── So this reads both, and DERIVES the numbers from the page ─────────────
 * The expected counts are not written down here. They are counted out of
 * `page.tsx` — how many `<SummaryStat` it renders, and whether its masthead
 * carries an `actions=` slot — so changing the page tells you to change the
 * skeleton instead of silently drifting from it. A hand-typed expectation on
 * both sides is two hand-typed lists, which is not a guard.
 *
 * 🛡 Mutation-checked by printed occurrence count, before → after.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PAGE = join(__dirname, 'page.tsx');
const LOADING = join(__dirname, 'loading.tsx');

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function page(): string {
  return stripComments(readFileSync(PAGE, 'utf8'));
}
function loading(): string {
  return stripComments(readFileSync(LOADING, 'utf8'));
}

/** `stats={N}` / `actions={N}` off the skeleton call. */
function skeletonProp(name: 'stats' | 'actions' | 'rows'): number {
  const m = new RegExp(`${name}=\\{(\\d+)\\}`).exec(loading());
  assert.ok(
    m,
    `budget/loading.tsx no longer passes \`${name}\` to its skeleton — teach this guard the new shape rather than deleting it.`,
  );
  return Number(m[1]);
}

test('the skeleton draws as many stat tiles as the page renders stats', () => {
  const rendered = [...page().matchAll(/<SummaryStat\b/g)].length;
  assert.ok(
    rendered > 0,
    'no <SummaryStat> found in budget/page.tsx — the count is derived from the page on purpose, so a match that stops matching would make this rule vacuous. Fix the match, do not hardcode a number.',
  );
  assert.equal(
    skeletonProp('stats'),
    rendered,
    `the skeleton promises ${skeletonProp('stats')} stat tiles and the page renders ${rendered}. ` +
      `The strip visibly re-flows the moment the real page arrives, and everything below it jumps — ` +
      `which is the layout shift a skeleton exists to prevent.`,
  );
});

test('the skeleton draws a header action if the page has one', () => {
  const hasAction = /<PageMasthead[\s\S]{0,400}?actions=\{/.test(page());
  const promised = skeletonProp('actions');
  if (hasAction) {
    assert.ok(
      promised >= 1,
      'the budget masthead carries an action (the .ics export) and the skeleton reserves no room for it, so a button appears out of nowhere when the page lands.',
    );
  } else {
    assert.equal(
      promised,
      0,
      'the skeleton reserves room for a header action the page no longer has, so the space collapses when the page lands.',
    );
  }
});

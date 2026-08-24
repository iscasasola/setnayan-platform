/**
 * the-tour-copy-does-not-drift.test.ts — the public tour's copy of a screen
 * must not keep a defect its original has already had fixed.
 *
 * ── Why this file exists ───────────────────────────────────────────────────
 * `/tour/budget` is STOP 4 of the public, no-login marketing tour, and its
 * per-supplier card is a declared read-only FORK of the couple's
 * `VendorItemizationCard`. On 2026-08-25 the original's money figures were
 * moved into the ledger face — the archetype asks for "every numeral … in Space
 * Mono like a bank book" — and the PR reported the budget screen clean.
 *
 * The fork was not touched. So the very defect the change existed to end, the
 * word "Paid" appearing on one screen in two typefaces, survived on the ONE
 * budget surface a person can reach without an account: a stranger evaluating
 * Setnayan saw the unfixed screen while the couple saw the fixed one.
 *
 * 🔑 A CLONE INHERITS THE BUG ITS TWIN ALREADY FIXED. This repo has paid for
 * that at least twice — the Live Studio camera seat kept the "one of the
 * couple" copy its Papic twin had corrected, surviving in the signed-out arm
 * because every review pass was made signed in. Same shape here: the fork is
 * the arm nobody is looking at.
 *
 * ── The rule reads BOTH files, on purpose ─────────────────────────────────
 * A rule that only knew the tour file would pin today's answer and say nothing
 * about the pair. This one asks whether the fork AGREES WITH ITS ORIGIN, so
 * fixing one and not the other fails in EITHER direction — including the
 * direction nobody watches, where the original regresses and the fork does not.
 *
 * 🛡 Mutation-checked by printed occurrence count, before → after.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FORK = join(__dirname, '_components', 'tour-vendor-itemization.tsx');
const ORIGIN = join(
  __dirname,
  '..',
  '..',
  'dashboard',
  '[eventId]',
  '_components',
  'vendor-itemization-card.tsx',
);

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * The typeface of the element that renders a money cell's FIGURE, in whichever
 * file. Both declare a `Money` component whose `<dd>` carries the value.
 */
function figureIsMono(path: string): boolean {
  const src = stripComments(readFileSync(path, 'utf8'));
  const at = src.indexOf('function Money(');
  assert.ok(
    at > 0,
    `${path} no longer declares a Money component — the pair moved; teach this guard the new shape rather than deleting it.`,
  );
  const body = src.slice(at, at + 1400);
  const dd = /<dd\b[^>]*>/.exec(body);
  assert.ok(dd, `${path}'s Money component renders no <dd> — re-anchor this guard on whatever carries the figure.`);
  return dd[0].includes('font-mono');
}

test('the public tour copy of the budget card wears the same face as the card it forks', () => {
  const fork = figureIsMono(FORK);
  const origin = figureIsMono(ORIGIN);

  assert.equal(
    origin,
    true,
    'the couple’s own supplier card lost the ledger face. That is the defect this pair exists to keep fixed on BOTH surfaces.',
  );
  assert.equal(
    fork,
    origin,
    'the public tour’s copy of the supplier card disagrees with the card it forks. ' +
      '/tour/budget is reachable with NO ACCOUNT, so a defect that survives there is the one a stranger ' +
      'evaluating Setnayan actually sees. A clone inherits the bug its twin already fixed — fix both, or neither.',
  );
});

test('the fork still declares itself a fork', () => {
  const src = readFileSync(FORK, 'utf8');
  assert.ok(
    /fork/i.test(src.slice(0, 2000)),
    'the tour card stopped saying it is a fork of VendorItemizationCard. That sentence is the only thing telling the next person to change two files, and this guard is the only thing that makes it true.',
  );
});

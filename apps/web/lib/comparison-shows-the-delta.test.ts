/**
 * The approved comparison archetype (owner-approved 2026-08-04, BINDING) states
 * its own rule:
 *
 *   > "Two to four things side by side. Working memory holds 3–4 items, so a
 *   > tier list that repeats every feature for every tier is unreadable. This
 *   > archetype shows the delta, never the repetition."
 *
 * ✅ HALF OF IT ALREADY SHIPPED and was NOT rebuilt: a LOCKED category already
 * collapses to a single full-width line reading "locked, the same in every
 * plan" (PR-F). RULE 0 — the repetition problem was already solved for the half
 * where the answer cannot vary.
 *
 * This covers the CANDIDATE half: a category where every plan happens to pick
 * the same supplier is repetition too, and now says so.
 *
 * ⚖ IT LABELS, IT DOES NOT HIDE. Collapsing a candidate row would take away the
 * per-column control the couple uses to CHANGE that pick — the whole point of
 * this half of the grid. The archetype asks that the delta be findable, not
 * that data be removed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 🪤 COMMENTS ARE STRIPPED BEFORE MATCHING, AND THIS GUARD PROVED WHY ON ITS OWN
 * FIRST RUN. Deleting the locked row's rendered wording left the test GREEN —
 * because the phrase also appears in the explanatory comment I had just written
 * two dozen lines below it. The guard was reading my note about the rule instead
 * of the rule. Same shape as the doors guard, which strips comments for exactly
 * this reason.
 */
const RAW = readFileSync(
  join(import.meta.dirname, '..', 'app/dashboard/[eventId]/vendors/_components/build-compare.tsx'),
  'utf8',
);
const SRC = RAW.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

test('a candidate row identical across every plan is marked as repetition', () => {
  assert.match(SRC, /sameEverywhere/, 'the delta marker is gone');
  assert.match(
    SRC,
    /— same in every plan/,
    'the marker lost its wording — it should echo the locked row\'s "the same in every plan"',
  );
});

test('the marker needs TWO OR MORE columns — one plan cannot be "the same as" anything', () => {
  // 🔑 A ONE-COLUMN GRID HAS NOTHING TO COMPARE. Without this, a couple with a
  // single saved plan would see "same in every plan" against every row — true
  // by vacuity and meaningless to read.
  assert.match(
    SRC,
    /columns\.length > 1 &&/,
    'the marker must require at least two columns before claiming sameness',
  );
});

test('an EMPTY pick is never called "the same"', () => {
  // Two columns that both picked NOTHING are not "the same supplier" — they are
  // two blanks. Claiming sameness there would tell the couple a decision was
  // made in both plans when none was made in either.
  assert.match(
    SRC,
    /ids\.every\(\(v\) => v !== null && v === ids\[0\]\)/,
    'the sameness test must exclude null picks',
  );
});

test('the LOCKED collapse still ships and was not rebuilt', () => {
  // RULE 0: the half that already honoured the archetype must survive this
  // change untouched. If this line goes, the locked rows have started repeating
  // across columns again and the port made the grid worse.
  assert.match(
    SRC,
    /locked, the same in every plan/,
    'the locked-row collapse is gone — that half of the archetype already shipped',
  );
  assert.match(SRC, /colSpan=\{columns\.length\}/, 'the locked row no longer spans the columns');
});

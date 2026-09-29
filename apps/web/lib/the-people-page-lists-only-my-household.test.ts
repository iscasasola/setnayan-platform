/**
 * THE PEOPLE PAGE LISTS ONLY MY HOUSEHOLD — owner, 2026-09-25, on his own People page:
 * *"i do not have a registered spouse"* — it showed another user's business,
 * "Indigo Caterers", tagged "Shared by your spouse". RLS admits an ADMIN to every
 * dependent on the platform, and the list rendered whatever came back, calling
 * every row that was not the viewer's own "Shared by your spouse".
 *
 * The page must decide membership itself: my rows · rows I handed over · rows my
 * ACTUAL spouse (current_spouse_user_ids) marked shared. Nothing else.
 *
 * 2026-09-29 — THE SAME ROW CAME BACK THROUGH A SECOND READER. The People
 * roster counted `dependents` without the rule, so the picker read "Loved ones
 * 1" above "No loved ones yet." The rule moved to ONE function
 * (`lib/my-loved-ones.ts`); this file now pins that EVERY reader uses it —
 * executed rules live in `my-loved-ones.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const SECTION = stripComments(
  readFileSync(
    join(__dirname, '..', 'app', 'dashboard', '(account)', 'people', '_components', 'dependents-section.tsx'),
    'utf8',
  ),
);
const ROSTER = stripComments(readFileSync(join(__dirname, 'people-roster.ts'), 'utf8'));

test('the Loved ones list is filtered by the ONE rule before it renders', () => {
  assert.match(
    SECTION,
    /const dependents = myLovedOnes\(rows, myUserId, spouseSet\);/,
    'the rendered list is the FILTERED rows, never the raw RLS result',
  );
  assert.match(SECTION, /const spouseSet = spouseIdSet\(spouseIds\);/, 'the spouse set is not the one current_spouse_user_ids returned');
});

test('🔴 the roster COUNTS and LISTS by the same rule — the count can never claim a row the view cannot show', () => {
  assert.match(ROSTER, /alagaCount = error \? null : myLovedOnes\(rows, userId, spouses\)\.length;/);
  assert.match(ROSTER, /for \(const d of lovedOnesInMyCare\(rows, userId, spouses\)\)/, 'roster alaga rows skip the rule');
  assert.match(ROSTER, /rpc\('current_spouse_user_ids'\)/, 'the roster guesses the spouse instead of reading it');
});

test('the raw result is never mapped straight into a list or a count', () => {
  assert.doesNotMatch(SECTION, /const dependents = \(data \?\? \[\]\)/, 'rendering the RLS result directly shows an admin everyone');
  assert.doesNotMatch(SECTION, /const dependents = rows\.filter\(/, 'a second, hand-written copy of the rule');
  const alaga = ROSTER.slice(ROSTER.indexOf("from('dependents')"), ROSTER.indexOf('const connections ='));
  assert.ok(alaga.length > 200, 're-anchor: the roster alaga read moved');
  assert.doesNotMatch(alaga, /for \(const d of \(data \?\? \[\]\)/, 'the roster lists the raw RLS result again');
  assert.doesNotMatch(alaga, /alagaCount = error \? null : rows\.length/, 'the roster counts the raw RLS result again');
});

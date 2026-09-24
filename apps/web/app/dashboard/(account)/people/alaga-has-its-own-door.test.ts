/**
 * alaga-has-its-own-door.test.ts — the Alaga section answers its own empty
 * state, and carries the way to create one, exactly as Samahan does.
 *
 * Owner, 2026-09-23, pointing at the live heading on /dashboard/people:
 * *"Alaga should be together meaning Alaga will have a button to create an
 * alaga under it same to samahan."*
 *
 * ── WHAT WAS WRONG ────────────────────────────────────────────────────────
 * With no alaga yet, `dependents-section.tsx` rendered its list branch or
 * `null`. Null is not an empty state: the page drew the word "Alaga" and then
 * the word "Samahan" underneath it, with nothing in between and no way in.
 * Samahan's section has always done the opposite — a sentence plus "Create
 * one" — so one column held two different ideas of what an empty list is.
 *
 * ── WHY THIS PINS THE PAIR, NOT JUST THE BUTTON ───────────────────────────
 * The obvious "tidy-up" is to notice that Add an alaga now appears twice and
 * delete one. Both are deliberate and BOTH are owner rulings: the top action
 * row is 2026-08-22 (*"where the buttons live"*, pinned by
 * `the-buttons-live-together.test.ts`) and the in-section door is the ruling
 * above. Samahan likewise offers "New samahan" at the top AND "Create one" in
 * its section — that duplication is what "same to samahan" means here. So this
 * asserts both ends; removing either is a red test, not a cleanup.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const SECTION_PATH = join(__dirname, '_components', 'dependents-section.tsx');
const SECTION = readFileSync(SECTION_PATH, 'utf8');
const PAGE = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

/**
 * ⚠ COMMENTS STRIPPED, AND THIS GUARD WOULD BE VACUOUS WITHOUT IT. The fix's
 * OWN explanatory comment names <AddAlagaButton> in prose, so a source-text
 * match would be satisfied by the paragraph explaining the button even if the
 * button itself were deleted. A rule mentioned in prose is not a rule the page
 * renders — the sibling guard in this folder learned the same lesson.
 *
 * 🔑 THE REPO'S ONE STRIPPER, NOT A HAND-ROLLED PAIR OF `.replace()` CALLS.
 * The obvious two-liner strips BLOCK comments first, so a `//` line carrying a
 * block opener — `content-type video/*`, which this codebase writes constantly
 * — opens a comment that never existed and swallows everything to the next
 * real close. `lint-one-comment-stripper.mjs` blocks a second implementation
 * for that reason, and it caught this file.
 */
const strip = stripComments;

const SECTION_CODE = strip(SECTION);
const PAGE_CODE = strip(PAGE);

test('the fixtures are real — both sources loaded and stripping kept the code', () => {
  assert.ok(SECTION.length > 2000, 'dependents-section.tsx did not load');
  assert.ok(PAGE.length > 2000, 'page.tsx did not load');
  assert.ok(SECTION_CODE.includes('<section'), 'comment stripping ate the section');
  assert.ok(PAGE_CODE.includes('PeopleRosterView'), 'comment stripping ate the page');
  // The strip must actually remove the prose that would otherwise satisfy the
  // assertions below — proving this guard reads code, not documentation.
  assert.ok(
    SECTION.includes('same to samahan'),
    'the owner quote left the file; re-anchor this guard before trusting it',
  );
  assert.ok(
    !SECTION_CODE.includes('same to samahan'),
    'comments were NOT stripped — every assertion below can pass on prose alone',
  );
});

test('🔴 the Alaga section carries its own way to create one', () => {
  assert.ok(
    SECTION_CODE.includes('<AddAlagaButton />'),
    'the Alaga section lost its create button — the heading is a dead end again',
  );
});

test('🔴 an empty Alaga list is answered, never rendered as nothing', () => {
  // The exact shape that shipped the defect: the list branch falling through
  // to a bare null, which draws a heading and stops.
  assert.ok(
    !/\)\s*:\s*null\}\s*\n\s*\{?\s*<AddAlagaButton/.test(SECTION_CODE),
    'the empty branch is back to `: null` — a heading with nothing under it',
  );
  assert.ok(
    /No alaga yet/.test(SECTION_CODE),
    'the empty state stopped saying anything — Samahan answers its own, this must too',
  );
});

test('🔒 the top action row KEEPS its copy — the duplication is the ruling', () => {
  assert.ok(
    PAGE_CODE.includes('<AddAlagaButton />'),
    'Add an alaga was removed from the top action row; that is the 2026-08-22 ruling, ' +
      'not a duplicate to clean up (see the-buttons-live-together.test.ts)',
  );
});

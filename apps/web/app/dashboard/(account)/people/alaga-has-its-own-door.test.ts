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
 * ── RE-POINTED 2026-09-28: ONE DOOR, AT THE HEAD OF THE ALAGA VIEW ────────
 * This file used to pin a PAIR — the top action row's copy (2026-08-22) AND an
 * in-section copy under the list (2026-09-23). The People redesign made Alaga a
 * view of its own, and the owner ruled where its door goes: *"we already agreed
 * this will be on the alaga and samahan row."* So the door is drawn ONCE, by
 * the page, at the head of the Alaga view — which is still "a button to create
 * an alaga under it" (under the Alaga name in the picker), still "same to
 * samahan" (whose view opens with "New samahan"). What this guards now:
 *   · the Alaga view carries its own way to create one, AHEAD of its list;
 *   · an empty Alaga list is still answered with a sentence, never nothing;
 *   · the section does not draw a SECOND copy (the drift the ruling ended).
 * `the-buttons-live-together.test.ts` pins the page-wide half: once, never in
 * the header.
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

test('🔴 the Alaga VIEW carries its own way to create one — ahead of the list', () => {
  const open = PAGE_CODE.indexOf("{view === 'alaga' ? (");
  assert.ok(open >= 0, 'the page has no Alaga view');
  const branch = PAGE_CODE.slice(open, PAGE_CODE.indexOf('{view ===', open + 10));
  const door = branch.indexOf('<AddAlagaButton />');
  assert.ok(door >= 0, 'the Alaga view lost its create button — the view is a dead end again');
  assert.ok(door < branch.indexOf('<DependentsSection />'), 'the create button trails the list');
});

test('🔴 an empty Alaga list is answered, never rendered as nothing', () => {
  // The exact shape that shipped the defect: the list branch falling through
  // to a bare null, which draws nothing and stops.
  assert.ok(
    !/\)\s*:\s*null\}\s*\n\s*<\/section>/.test(SECTION_CODE),
    'the empty branch is back to `: null` — a view with nothing in it',
  );
  assert.ok(
    /No alaga yet/.test(SECTION_CODE),
    'the empty state stopped saying anything — Samahan answers its own, this must too',
  );
});

test('🔒 the section does NOT draw a second copy — one door, one place', () => {
  assert.ok(
    !SECTION_CODE.includes('<AddAlagaButton'),
    'the Alaga section draws its own "Add an alaga" again — the page already heads the ' +
      'view with one (owner 2026-09-28: "we already agreed this will be on the alaga and samahan row")',
  );
  assert.equal(PAGE_CODE.split('<AddAlagaButton />').length - 1, 1, 'the page draws the door more than once');
});

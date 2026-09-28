/**
 * the-buttons-live-together.test.ts — each of the People page's own doors lives
 * at the HEAD OF ITS OWN VIEW, and nowhere else; and the one that cannot be
 * built honestly is not drawn.
 *
 * ── THE RULING THIS FILE PINS HAS CHANGED, AND THE FILE WAS RE-POINTED ────
 * 2026-08-22, owner, holding the approved mock next to the live page: *"where
 * the buttons live add an alaga, new group (samahan), import contacts."* That
 * put "Add an alaga" and "New samahan" in ONE header row, and this file pinned
 * the row.
 *
 * 2026-09-28, owner, pointing at the People redesign (people-redesign.html),
 * where the header holds only the view picker: *"we already agreed this will be
 * on the alaga and samahan row."* So each door now opens its own view — "Add an
 * alaga" at the head of Alaga, "New samahan" at the head of Samahan — and the
 * header row is gone. DECISION_LOG 2026-09-28 says in so many words that this
 * guard must be RE-POINTED, never deleted to go green. This is that.
 *
 * ── WHAT THIS PINS, AND WHY EACH HALF MATTERS ──────────────────────────────
 *   · each door EXISTS, in its view, before that view's list — so a port of the
 *     page cannot quietly drop one to the bottom as a text link;
 *   · each door exists ONCE — a second copy in the header or inside the section
 *     is the drift the ruling ended;
 *   · the header holds nothing but the picker;
 *   · "Import contacts" stays ABSENT — a fake door is worse than a missing one.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const PAGE = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
const SECTION = readFileSync(join(__dirname, '_components', 'dependents-section.tsx'), 'utf8');
const SAMAHAN = readFileSync(join(__dirname, '_components', 'samahan-people-section.tsx'), 'utf8');

/** Code only — a rule mentioned in prose is not a rule the page renders. The
 *  repo's ONE stripper (`lint-one-comment-stripper.mjs` blocks a second). */
const CODE = stripComments(PAGE);
const SECTION_CODE = stripComments(SECTION);
const SAMAHAN_CODE = stripComments(SAMAHAN);

/** The JSX of one view: from `view === '<key>' ?` to the next `view ===`. */
function viewBranch(key: string): string {
  const open = CODE.indexOf(`{view === '${key}' ? (`);
  assert.ok(open >= 0, `the page has no '${key}' view branch — the doors have nowhere to live`);
  const next = CODE.indexOf('{view ===', open + 10);
  return CODE.slice(open, next === -1 ? undefined : next);
}

const count = (hay: string, needle: string) => hay.split(needle).length - 1;

test('the fixture is real — the page source was actually read, and stripped', () => {
  assert.ok(PAGE.length > 2000, 'page.tsx did not load');
  assert.ok(CODE.includes('PeopleRosterView'), 'comment stripping ate the code');
  assert.ok(PAGE.includes('we already agreed'), 'the owner quote left page.tsx; re-anchor this guard');
  assert.ok(!CODE.includes('we already agreed'), 'comments were NOT stripped — prose could pass this guard');
});

test('🔴 "Add an alaga" is at the head of the Alaga view — before its list', () => {
  const alaga = viewBranch('alaga');
  const door = alaga.indexOf('<AddAlagaButton />');
  const list = alaga.indexOf('<DependentsSection />');
  assert.ok(door >= 0, 'the Alaga view lost its "Add an alaga" door');
  assert.ok(list >= 0, 'the Alaga view no longer draws the alaga cards');
  assert.ok(door < list, '"Add an alaga" must head the view, not trail the list');
});

test('🔴 "New samahan" is at the head of the Samahan view — before its list', () => {
  const samahan = viewBranch('samahan');
  const door = samahan.indexOf('href="/dashboard/samahan/new"');
  const list = samahan.indexOf('<SamahanPeopleSection');
  assert.ok(door >= 0, 'New samahan does not point at the page that creates one');
  assert.ok(samahan.includes('New samahan'), 'the Samahan view lost its "New samahan" door');
  assert.ok(door < list, '"New samahan" must head the view, not trail the list');
});

test('each door exists ONCE on the page — never also in the header', () => {
  assert.equal(count(CODE, '<AddAlagaButton />'), 1, '"Add an alaga" is drawn more than once (or not at all)');
  assert.equal(count(CODE, 'href="/dashboard/samahan/new"'), 1, '"New samahan" is drawn more than once');
  // …and the cards' own section does not draw a second copy under the list.
  assert.ok(!SECTION_CODE.includes('<AddAlagaButton'), 'the Alaga section draws a second "Add an alaga"');
  // The retired header action row, by its exact shape.
  assert.ok(
    !CODE.includes('className="mb-4 flex flex-wrap justify-end gap-2"'),
    'the 2026-08-22 header action row came back — the owner superseded it on 2026-09-28',
  );
});

test('the header holds ONLY the picker', () => {
  const at = CODE.indexOf('data-people-header');
  assert.ok(at >= 0, 'the header block moved; re-anchor this guard');
  const end = CODE.indexOf('</div>', at);
  const header = CODE.slice(at, end);
  assert.ok(header.includes('<PeopleViewPicker'), 'the picker left the header');
  for (const stray of ['AddAlagaButton', 'samahan/new', '<button', '<Link']) {
    assert.ok(!header.includes(stray), `the header draws "${stray}" beside the picker`);
  }
});

test('the Samahan view does not draw a second "Samahan" heading under its picker', () => {
  assert.match(viewBranch('samahan'), /<SamahanPeopleSection heading=\{false\} \/>/);
  assert.match(SAMAHAN_CODE, /heading \? \(/, 'the section can no longer hide its heading');
});

test('🔒 "Import contacts" is NOT drawn — it cannot be built honestly', () => {
  // A pasted address book is mostly people with no account, so the feature
  // reduces to telling you which of your contacts are registered — an
  // enumeration oracle over a list you supply, which is exactly what
  // `lib/people-search.ts` is written NOT to be — or to bulk-emailing
  // strangers. Either one is a worse product than the missing button.
  //
  // If this ever fails, the button was added: check it opens something real.
  assert.ok(
    !CODE.includes('Import contacts'),
    'a contacts-import button appeared — a fake door, or a feature that needs the account rule reopened',
  );
});

/**
 * the-buttons-live-together.test.ts — the People page's own actions sit in one
 * row at the top, and the one that cannot be built honestly is not drawn.
 *
 * Owner, 2026-08-22, holding the approved mock next to the live page: *"seems
 * different from your design. where the buttons live add an alaga, new group
 * (samahan), import contacts."* He was right — the mock puts three buttons in
 * the header and only one shipped, and I had reported the remaining gaps without
 * noticing this one.
 *
 * ── WHAT THIS PINS, AND WHY EACH HALF MATTERS ──────────────────────────────
 * That the row EXISTS with both real doors in it, so the next port of this page
 * cannot quietly drop one back to the bottom of the page as a text link. And
 * that "Import contacts" stays ABSENT — a fake door is worse than a missing one,
 * and the reason it cannot exist is a rule, not an opinion (see below).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PAGE = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

/** The page source with comments stripped — a rule mentioned in prose is not a
 *  rule the page renders. (The doors-are-designed guard learned this the hard
 *  way: it read a fix's own explanatory comment as the defect.) */
const CODE = PAGE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('the fixture is real — the page source was actually read', () => {
  assert.ok(PAGE.length > 2000, 'page.tsx did not load');
  assert.ok(CODE.includes('PeopleRosterView'), 'comment stripping ate the code');
});

test('🔴 both of the page’s own doors are in the action row', () => {
  assert.ok(CODE.includes('<AddAlagaButton />'), 'Add an alaga left the action row');
  assert.ok(CODE.includes('New samahan'), 'New samahan is not offered at the top of the page');
  assert.ok(
    CODE.includes('href="/dashboard/samahan/new"'),
    'New samahan does not point at the page that creates one',
  );
});

test('they are ONE row, not scattered', () => {
  // The mock's whole point: the actions belong together, above the list. A
  // second wrapper somewhere else is how they drift apart again.
  const row = CODE.match(/className="mb-4 flex flex-wrap justify-end gap-2"/g) ?? [];
  assert.equal(row.length, 1, 'the action row is missing or duplicated');
});

test('🔒 "Import contacts" is NOT drawn — it cannot be built honestly', () => {
  // The mock drew it; the owner locked the account rule the day before, and the
  // two cannot both hold. A pasted address book is mostly people with no
  // account, so the feature reduces to telling you which of your contacts are
  // registered — an enumeration oracle over a list you supply, which is exactly
  // what `lib/people-search.ts` is written NOT to be — or to bulk-emailing
  // strangers. Either one is a worse product than the missing button.
  //
  // If this ever fails, the button was added: check it opens something real.
  assert.ok(
    !CODE.includes('Import contacts'),
    'a contacts-import button appeared — a fake door, or a feature that needs the account rule reopened',
  );
});

test('the row appears for either surface, not only when both are on', () => {
  // Alaga and connections are separately flagged. Gating the row on BOTH would
  // hide "New samahan" from anybody who has one flag off — samahan is live
  // product and never was flagged.
  assert.ok(
    CODE.includes('{showConnections || showDependents ?'),
    'the action row is gated on both flags at once',
  );
});

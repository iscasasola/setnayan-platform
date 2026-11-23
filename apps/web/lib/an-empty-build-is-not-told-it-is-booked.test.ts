/**
 * "BOOK THIS BUILD" WITH NOTHING PICKED SAYS SO — never the ✓ "every pick is booked or already asked" (walk EB-173,
 * owner 2026-11-16 "Fix them too"). Measured live: an empty build, Book this build, and a green ✓ toast "Nothing to
 * book — every pick is booked or already asked". That was untrue and read as success.
 *
 * Held on the real rule (`nothingToBookNote`) and on its wiring: the button asks that rule, both callers pass how
 * many lines are in the build, and the toast's tone comes from the rule, not a fixed "ok".
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { NOTHING_PICKED, NOTHING_TO_BOOK, nothingToBookNote } from './book-this-build';
import { stripComments } from './strip-comments';

test('an empty build is told nothing is picked — with no ✓', () => {
  assert.deepEqual(nothingToBookNote(0, 0), { tone: 'note', text: NOTHING_PICKED });
  assert.doesNotMatch(NOTHING_PICKED, /booked|asked|✓/);
});

test('the ✓ "every pick is booked or already asked" only when there ARE picks and none is left', () => {
  assert.deepEqual(nothingToBookNote(3, 0), { tone: 'ok', text: NOTHING_TO_BOOK });
  assert.equal(nothingToBookNote(3, 2), null, 'picks left to ask, and the ask did not open');
  assert.equal(nothingToBookNote(0, 1), null);
});

const read = (p: string) => stripComments(readFileSync(join(__dirname, '..', p), 'utf8'));

test('the button asks the rule, and its toast wears the rule’s tone', () => {
  const src = read('app/dashboard/[eventId]/vendors/_components/book-this-build.tsx');
  assert.match(src, /const note = nothingToBookNote\(inBuild, picks\.length\);/);
  assert.doesNotMatch(src, /setToast\(NOTHING_TO_BOOK\)/, 'the ✓ line is said without asking the rule');
  assert.match(src, /<PeekToast key=\{toast\} tone=\{toastTone\}/, 'the toast is a fixed ✓ again');
});

test('the real page has no Book-this-build any more (owner 2026-11-17) — and the lab still passes how many lines are in it', () => {
  // 🛒 Drawing v15: "Book this build and its sheet go. Each supplier gets one 'Ask to book' on its card instead." With no
  // button there is no ✓ to say over an empty build; a pick asks only when there IS one (`askable`).
  const page = read('app/dashboard/[eventId]/vendors/page.tsx');
  assert.doesNotMatch(page, /<BookThisBuild\b/, 'Book this build is back on the Suppliers page');
  const body = read('app/dashboard/[eventId]/vendors/_components/build-body.tsx');
  assert.match(body, /const p = line\.pick;\s*return \(\s*p != null &&/, 'a line with no pick could offer "Ask to book"');
  const lab = read('app/dev/suppliers-lab/lab-build.tsx');
  const at = lab.indexOf('<BookThisBuild');
  if (at >= 0) assert.match(lab.slice(at, at + 400), /inBuild=\{[^}]*\.filter\(\(l\) => l\.pick \|\| l\.booked\)\.length\}/, 'the lab does not pass inBuild');
});

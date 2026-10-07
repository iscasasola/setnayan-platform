/**
 * the-phone-guest-list-is-frame-2.test.ts — the Guest list on a phone.
 *
 * ⤷ 2026-10-07 (Maker PR 4f — Guests › List and Map, owner: *"send these builds
 * home and guests as priority builds on the event hub maker build"*): frame 2 of
 * the simple phone app (title + ⋯ · Filter ▾ · Show ▾ · the round +) is
 * SUPERSEDED by the prototype `home_and_guests_2026-10-07_fable.html?page=guests`:
 * `List N · Map · Setup` · counts + replied meter · sections · the thumb row.
 * The file name stays so its history reads in one place.
 *
 * 🔑 NOTHING MAY BE DELETED BY A BREAKPOINT. The new screen draws the SAME
 * controls at every width — no `hidden lg:` / `lg:hidden` anywhere in it —
 * because the Wedding March once vanished from every phone behind one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const GUESTS = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests');
const read = (...p: string[]) => stripComments(readFileSync(join(GUESTS, ...p), 'utf8'));
const PAGE = read('page.tsx');
const SCREEN = read('_components', 'guests-screen.tsx');

test('one screen at every width — no breakpoint hides a control', () => {
  assert.doesNotMatch(SCREEN, /\b(?:hidden lg:|lg:hidden|sm:hidden|md:hidden)/, 'a control in the Guests screen is hidden at one width');
  for (const gone of ['guests-phone-menu.tsx', 'phone-show-pick.tsx', 'find-add-row.tsx', 'roster-tabs.tsx']) {
    assert.ok(!existsSync(join(GUESTS, '_components', gone)), `${gone} (the retired phone head) is back`);
  }
  assert.doesNotMatch(PAGE, /data-guests-phone-title|data-roster-doors-row/, 'the retired phone title or doors row is back on the page');
});

test('the add doors: ONE + (the thumb row’s Add) opens the sheet; the four other ways are ONE dropdown in it', () => {
  const sheet = read('_components', 'add-guest-sheet.tsx');
  assert.match(sheet, /<PickMenu\b[\s\S]{0,200}label="Add another way"/, 'the four other ways are not one dropdown');
  for (const w of ['From your people', 'With details', 'Import a file', 'Paste many names']) {
    assert.ok(sheet.includes(`'${w}'`), `the dropdown lost "${w}"`);
  }
  assert.match(SCREEN, /openAddGuest\(q\)/, 'the thumb row’s Add does not open the sheet with the typed name');
});

test('the add sheet says what the name box understands — one example, one Tips fold, for THIS event', () => {
  // ⚖ Owner 2026-10-01: "tips on adding names with the + or other grouping".
  // The words themselves are run through the real parser in lib/quick-add-tips.test.ts.
  assert.match(PAGE, /tips=\{quickAddTips\(\{ hasSides, offeredRoles: resolveRoleSet\(guestRoleSetKey\)\.offeredRoles \}\)\}/, 'the add sheet is not told what this event can use');
  const sheet = read('_components', 'add-guest-sheet.tsx');
  assert.match(sheet, /<p className="text-xs text-ink\/55">\{tips\.example\}<\/p>/, 'the one example line is gone');
  assert.match(sheet, /<details\b[\s\S]{0,400}Tips[\s\S]{0,300}\{tips\.tips\.map/, 'the tips are not one fold');
});

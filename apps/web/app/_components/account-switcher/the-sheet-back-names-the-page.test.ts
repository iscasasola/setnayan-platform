/**
 * GUARD — THE PROFILE MENU, ONE DESIGN FOR THE WHOLE WEBSITE (owner 16 Nov 2026, *"and the presentation of the profile
 * menu when opened on both phone and desktop. that applies to the whole website"* — approved drawing
 * `event_dashboard_clean_2026-11-16_fable.html` #profile-menu):
 *
 *   1. ‹ the back names the page the sheet opened over (the tab title's first part), "Today" when it has none;
 *   2. 📱 the phone's sheet rises FULL SCREEN with that back and ✕, and no grab bar;
 *   3. 🖥 the computer's panel is 360 wide and as tall as the screen allows (no 34rem cap);
 *   4. 📝 names are whole: nothing in the sheet's body is cut with "…".
 *
 * Sabotage: put `max-h-[90vh]` back (2 red) · `lg:w-80` (3 red) · one `truncate` in the body (4 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { sheetBackLabel } from '@/lib/sheet-back-label';

const CODE = stripComments(readFileSync(join(import.meta.dirname, 'account-switcher.tsx'), 'utf8'));
const panel = CODE.slice(CODE.indexOf('function renderPanel()'), CODE.indexOf('<SwitcherPanelBody', CODE.indexOf('function renderPanel()')));

test('1 · the back names the page it opened over', () => {
  assert.equal(sheetBackLabel('Budget · Setnayan'), 'Budget');
  assert.equal(sheetBackLabel('Guests · Setnayan'), 'Guests');
  assert.equal(sheetBackLabel('Setnayan'), 'Today', 'a page with no title of its own');
  assert.equal(sheetBackLabel(''), 'Today');
  assert.equal(sheetBackLabel(null), 'Today');
});

test('2 · the phone sheet is the whole screen, with ‹ back and ✕, no grab bar', () => {
  assert.match(panel, /'fixed inset-0 z-\[52\][^']*pt-\[env\(safe-area-inset-top\)\]/, 'the phone sheet is not full screen inside the safe area');
  assert.doesNotMatch(panel, /max-h-\[90vh\]|rounded-t-2xl/, 'the phone sheet is a bottom sheet again');
  assert.match(panel, /data-account-sheet-back=""/, 'the back is gone');
  assert.match(panel, /\{backTo\}/, 'the back does not name the page');
  assert.match(panel, /aria-label="Close"[^>]*data-account-sheet-close=""/, 'the ✕ is gone');
  assert.match(panel, /data-account-sheet-head="" [^>]*|className="[^"]*lg:hidden" data-account-sheet-head=""/, 'the head shows on the computer too');
  assert.doesNotMatch(panel, /h-1 w-10[^"]*rounded-full/, 'the grab bar is back');
});

test('3 · the computer panel is 360 wide and as tall as the screen allows', () => {
  const desk = /'(lg:inset-x-auto[^']*)'/.exec(panel)?.[1] ?? '';
  assert.match(desk, /\blg:w-\[360px\]/, `not 360 wide: ${desk}`);
  assert.match(desk, /\blg:max-h-\[calc\(100dvh_-_var\(--fd-bar,\d+px\)_-_16px\)\]/, `not screen-tall: ${desk}`);
  assert.doesNotMatch(desk, /34rem|lg:w-80/, 'the shipped 320 × 544 cap is back');
});

test('4 · nothing in the sheet body is cut with "…"', () => {
  const body = CODE.slice(CODE.indexOf("const ROW = 'flex min-h-[62px]"), CODE.indexOf('export function AccountSwitcher('));
  assert.ok(body.length > 1000, 'the sheet body anchor moved');
  assert.doesNotMatch(body, /\btruncate\b/, 'a line in the sheet is cut with "…" again');
  assert.doesNotMatch(body, /whitespace-nowrap/, 'a line in the sheet cannot wrap');
});

/**
 * the-guest-list-sheet-is-calm.test.ts — the Guests head and its ⋯ sheet, as
 * the owner reviewed them on his iPhone (maria-and-jose, 2026-10-04).
 *
 *  1 · THE SHEETS SIT ABOVE THE BOTTOM BAR. The page's <main> carries
 *      `view-transition-name` (`.sn-vt-page`), which makes it a stacking
 *      context: a `z-50` sheet drawn inside it can never rise above the
 *      bottom bar (`z-30`, drawn outside it). The Guest list sheet and the
 *      Add a guest sheet are drawn on <body>.
 *  2 · THE ROUND + IS SEEN. It was there all along — a 4px backdrop blur
 *      behind the open sheet dissolved its white + into a plain black circle.
 *      The blur behind the guest sheets is the Drawer's 1px.
 *  3 · ONE SORT. "Sort" was a row label AND the dropdown's own word.
 *  4 · ONE SEGMENTED CONTROL. Roster · Share the link were underline tabs
 *      beside the List · Mind map pill. The doors are one `.sn-seg` now, with
 *      List · Mind map standing where Roster stood.
 *
 *  ⤷ 2026-10-07 (Maker PR 4f): the ⋯ sheet is retired — its tools moved to the
 *     thumb row — and the doors are the prototype's `List N · Map · Setup`
 *     (`guests-screen.tsx`). 1 and 2 hold for the add sheet; 3 retires with the
 *     ⋯; 4 holds for the new segmented control.
 */
import { GUESTS_VIEW_LABEL, GUESTS_TOP_LABEL } from '@/lib/guests-views';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const ADD = read('add-guest-sheet.tsx');
const SCREEN = read('guests-screen.tsx');
const CSS = stripComments(readFileSync(join(HERE, '..', '..', '..', '..', 'globals.css'), 'utf8'));

test('1 · both guest sheets are drawn on <body>, above the bottom bar', () => {
  // The reason, so this guard dies loudly if the reason ever goes away.
  assert.match(CSS, /\.sn-vt-page\s*\{[^}]*view-transition-name/, 'the page <main> no longer names a view transition');
  // ⤷ 2026-10-09: the portal is `GuestPopup`'s, once, for every guest-list sheet; the add sheet is drawn by it.
  const popup = read('guest-popup.tsx');
  assert.match(popup, /createPortal\(/, 'guest-popup.tsx draws its sheet inside the page — the bottom bar covers it');
  assert.match(popup, /document\.body,?\s*\)/, 'guest-popup.tsx portals somewhere other than <body>');
  assert.match(ADD, /<GuestPopup\b/, 'the add sheet is not drawn by the shared pop-up');
  assert.doesNotMatch(ADD, /createPortal\(/, 'the add sheet draws a portal of its own');
});

test('2 · the dark behind a guest sheet is the app\'s ONE pop-up dark — no wash or blur written here', () => {
  // ⤷ 2026-10-09 (owner rule, INTERACTION_RULES § 9): dark AND blurred (`.sn-popup-dark`), a tap on it closes, nothing behind
  // works. This was a 1-px blur so the round + could be read through it; the rule replaced that.
  const popup = read('guest-popup.tsx');
  // ⤷ 2026-10-25: the dark IS the close button (`<OverlayBackdrop>`, `.sn-popup-dark` on the button itself) — a separate
  // close layer under the dark was made inert by the page lock, and a tap outside closed nothing.
  assert.match(popup, /<OverlayBackdrop onClose=\{onClose\} \/>/, 'the sheet has no pop-up dark, or a tap on it does not close the sheet');
  assert.doesNotMatch(popup, /pointer-events-none/, 'a dark that takes no tap is back over a separate close layer');
  for (const [name, src] of [['add-guest-sheet.tsx', ADD], ['guest-popup.tsx', popup]] as const) {
    assert.doesNotMatch(src, /backdrop-blur-|\bbg-ink\/\d/, `${name} writes a wash or blur of its own`);
  }
});

test('4 · the doors are ONE dropdown in ONE row — "Guests · List ▾" listing Guests · Seats · March, one word each, then the view’s counts, rounds and the ⚙ (owner 2026-10-27 ⚙; R4 2026-10-28; slice 2 2026-10-29; ONE row 2026-10-30)', () => {
  // ⤷ 2026-10-30 (owner, iPhone app: *"The menu does not work properly"*): the segmented `Guests | Seats ▾ | March` pill is
  // gone from every view — the doors are the ONE shared dropdown (`PickMenu`, "any set of choices is a dropdown").
  assert.doesNotMatch(SCREEN, /aria-label="Guest list views"|data-guests-segmented|<PillThumb \/>/, 'the segmented pill is back beside the ▾');
  assert.doesNotMatch(SCREEN, /styles\.seg\b/, 'the doors are drawn by this screen’s own CSS again');
  const menuAt = SCREEN.indexOf('const pinMenu = (');
  const menu = SCREEN.slice(menuAt, SCREEN.indexOf('\n  );', menuAt));
  assert.match(menu, /<PickMenu\b[^]*dataAttr="data-guests-pin-menu"[^]*buttonText=\{pinnedMenuWords\(gview, seatMode\)\}/, 'the doors are not the one shared dropdown naming the view');
  // Its groups are the TOPS this event has, each in its one word (`lib/guests-views.ts`).
  assert.match(SCREEN, /group: GUESTS_TOP_LABEL\.guests/);
  assert.match(SCREEN, /group: GUESTS_TOP_LABEL\.seats/);
  assert.match(SCREEN, /group: GUESTS_TOP_LABEL\.march/);
  const words = Object.values(GUESTS_TOP_LABEL);
  assert.deepEqual(words, ['Guests', 'Seats', 'March'], `the groups read ${words.join(' · ')}`);
  assert.ok(words.every((w) => !/\s/.test(w)), 'a group says more than one word');
  assert.deepEqual(Object.values(GUESTS_VIEW_LABEL), ['List', 'Map', 'Seats', 'March'], 'a view lost its one word');
  // The ⚙ ends the first row after the face (menu · counts) and the view's own rounds (Seats' Edit · ⋯).
  const rowAt = SCREEN.indexOf('data-first-row="" data-guests-top-row=""');
  assert.ok(rowAt > -1, 'the one top row is gone');
  assert.match(
    SCREEN.slice(rowAt),
    /^[\s\S]*?<PinnedSummary[\s\S]*?\/>\s*(?:\{\s*\}\s*)?<span ref=\{setToolsSlot\}[^>]*data-guests-view-rounds="" \/>\s*\{setup \? \(\s*<MenuSettingsButton menu="guests"/,
    'the ⚙ does not end the first row after the menu and the rounds',
  );
});

test('4 · the doors never pose as tabs', () => {
  assert.doesNotMatch(SCREEN, /role="tablist"|role="tab"|aria-selected/, 'the doors pose as tabs again');
});

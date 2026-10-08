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
  for (const [name, src] of [['add-guest-sheet.tsx', ADD]] as const) {
    assert.match(src, /createPortal\(/, `${name} draws its sheet inside the page — the bottom bar covers it`);
    assert.match(src, /document\.body,?\s*\)/, `${name} portals somewhere other than <body>`);
  }
});

test('2 · the blur behind a guest sheet is light enough to read the + through', () => {
  for (const [name, src] of [['add-guest-sheet.tsx', ADD]] as const) {
    const blurs = src.match(/backdrop-blur-\[(\d+)px\]/g) ?? [];
    assert.ok(blurs.length > 0, `${name} lost its scrim blur rule`);
    for (const b of blurs) assert.equal(b, 'backdrop-blur-[1px]', `${name}: ${b} turns the round + into a black circle`);
  }
});

test('4 · the doors are ONE segmented control — List · Map · Setup, one word each (G1)', () => {
  const nav = SCREEN.slice(SCREEN.indexOf('<nav'), SCREEN.indexOf('</nav>'));
  // 2026-10-08: the doors are drawn by the app's ONE pill selector (owner: "adjust all pill selectors to this"),
  // no longer by this screen's own `.seg` CSS — so the pin is the template's track and thumb.
  assert.match(nav, /className=\{`\$\{PILL_TRACK_CLASS\} \$\{PILL_TRACK_GROUND\}`\}/, 'the doors are not one segmented control');
  assert.match(nav, /<PillThumb \/>/, 'the doors lost the thumb that slides between them');
  assert.match(SCREEN, /className=\{`\$\{pillSegClass\(gview === key\)\} /, 'a door does not wear the pill selector’s look');
  assert.doesNotMatch(SCREEN, /styles\.seg\b/, 'the doors are drawn by this screen’s own CSS again');
  const words = [...nav.matchAll(/seg\('(\w+)', '([^']+)'/g)].map((m) => m[2]);
  assert.deepEqual(words, ['List', 'Map', 'Setup'], `the segments read ${words.join(' · ')}`);
});

test('4 · the segmented doors are a <nav> of LINKS — never a broken tab', () => {
  const nav = SCREEN.slice(SCREEN.indexOf('<nav'), SCREEN.indexOf('>', SCREEN.indexOf('<nav')));
  assert.match(nav, /aria-label="Guest list views"/, 'the doors lost their nav landmark name');
  assert.doesNotMatch(SCREEN, /role="tablist"|role="tab"|aria-selected/, 'the doors pose as tabs again');
  assert.match(SCREEN, /aria-current=\{gview === key \? 'page' : undefined\}/, 'the current door does not say it is the current page');
  assert.match(SCREEN, /<Link\b[\s\S]{0,400}?data-guests-seg=\{key\}/, 'a segment is not a link');
});

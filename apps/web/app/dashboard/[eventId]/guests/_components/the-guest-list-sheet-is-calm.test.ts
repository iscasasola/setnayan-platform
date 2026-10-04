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
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const MENU = read('guests-phone-menu.tsx');
const ADD = read('add-guest-sheet.tsx');
const TABS = read('roster-tabs.tsx');
const SWITCH = read('view-switcher.tsx');
const PAGE = read('../page.tsx');
const CSS = stripComments(readFileSync(join(HERE, '..', '..', '..', '..', 'globals.css'), 'utf8'));

test('1 · both guest sheets are drawn on <body>, above the bottom bar', () => {
  // The reason, so this guard dies loudly if the reason ever goes away.
  assert.match(CSS, /\.sn-vt-page\s*\{[^}]*view-transition-name/, 'the page <main> no longer names a view transition');
  for (const [name, src] of [['guests-phone-menu.tsx', MENU], ['add-guest-sheet.tsx', ADD]] as const) {
    assert.match(src, /createPortal\(/, `${name} draws its sheet inside the page — the bottom bar covers it`);
    assert.match(src, /document\.body,?\s*\)/, `${name} portals somewhere other than <body>`);
  }
});

test('2 · the blur behind a guest sheet is light enough to read the + through', () => {
  for (const [name, src] of [['guests-phone-menu.tsx', MENU], ['add-guest-sheet.tsx', ADD]] as const) {
    const blurs = src.match(/backdrop-blur-\[(\d+)px\]/g) ?? [];
    assert.ok(blurs.length > 0, `${name} lost its scrim blur rule`);
    for (const b of blurs) assert.equal(b, 'backdrop-blur-[1px]', `${name}: ${b} turns the round + into a black circle`);
  }
});

test('3 · the ⋯ sheet says Sort once — the dropdown names itself', () => {
  assert.match(MENU, /\{sort\}/, 'the ⋯ sheet dropped Sort');
  assert.doesNotMatch(MENU, />\s*Sort\s*</, 'a second "Sort" label is back beside the Sort dropdown');
});

test('4 · the doors are ONE segmented control', () => {
  assert.match(TABS, /className="sn-seg\b/, 'the doors are not the shipped .sn-seg control');
  assert.doesNotMatch(TABS, /border-b-2/, 'underline tabs are back beside the segmented pill');
  assert.match(TABS, /d\.key === 'roster' && viewSwitch/, 'List · Mind map no longer stand where Roster stood');
  assert.match(TABS, /className=\{SEG_ITEM\}/, 'a door is drawn in its own look, not the one segment look');
  // The switch, inside it, draws no pill of its own.
  assert.match(SWITCH, /if \(bare\) return <>\{items\}<\/>;/, 'the bare switch draws its own .sn-seg inside the doors');
  assert.match(PAGE, /<GuestsViewSwitcher [^>]*\bbare\b/, 'the page hands the doors a switch with its own pill — two controls');
});

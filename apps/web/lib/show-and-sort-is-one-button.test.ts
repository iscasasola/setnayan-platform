/**
 * show-and-sort-is-one-button.test.ts — A LIST'S ROW HAS ONE SHOW-AND-SORT BUTTON, AND IT LOOKS ONE WAY.
 *
 * Owner, 19 Nov 2026, verbatim: *"just one: show and sort"*; his final pick of its look the same day: lucide
 * `SlidersHorizontal`, icon only, in a 44 px circle exactly like the search's.
 *
 *   1 · the face is `SlidersHorizontal` alone — no word; not the funnel (`Filter`), not `ArrowUpWideNarrow`, not ≡
 *       (`ListFilter`), and no hand-drawn sort icon;
 *   2 · the dot (mulberry, top-right) is drawn ONLY when something is not the default; the name is "Show and sort",
 *       and "Show and sort · changed" with the dot;
 *   3 · the four lists wear it — Guests › List, Guests › Map, Suppliers › Find, Clients — each on its ONE button, fed
 *       by that list's own shipped "is anything not the default" measure;
 *   4 · each of those rows seats exactly ONE control after the search — never two pills;
 *   5 · it is the thumb row's 44 round — the same circle the search rests as — never a pill, never under 44 px.
 *
 * Sabotage — run 2026-11-19, each red then restored: `<SlidersHorizontal …>` → `<Filter …>` in sort-face.tsx (1) ·
 * the word "Sort" put back in the face (1) · `{on ? <i` → `{true ? <i` (2) · the dot's colour → `bg-terracotta`
 * (2) · Clients' `<SortFace on={on} />` → `<FilterFace on={on} />` (3) · a second seat put in the Find row's `right`
 * (4) · the face's `w-11` → `w-20` (5).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type * as FaceMod from '@/components/sort-face';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  Mod._extensions['.css'] = (m: { exports: unknown }) => {
    m.exports = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : String(k)) });
  };
}
const { SortFace, sortLabel } = require('@/components/sort-face') as typeof FaceMod;
const { ArrowUpWideNarrow, Filter, ListFilter, SlidersHorizontal } = require('lucide-react') as typeof import('lucide-react');

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const FACE = read('components/sort-face.tsx');
const ROW_CSS = read('components/thumb-row.module.css');
const G = 'app/dashboard/[eventId]/guests/_components/';
const SCREEN = read(`${G}guests-screen.tsx`);
const SHEET = read(`${G}guests-filter-sheet.tsx`);
const MENU = read(`${G}guests-filter-menu.tsx`);
const FIND_MENU = read('app/dashboard/[eventId]/vendors/_components/find-sort-menu.tsx');
const FIND_ROW = read('app/dashboard/[eventId]/vendors/_components/find-thumb-row.tsx');
const CLIENTS = read('app/vendor-dashboard/customers/_components/clients-show-sort.tsx');
const CLIENTS_PAGE = read('app/vendor-dashboard/customers/page.tsx');

/** The drawing of one lucide icon — its paths, whatever class it wears. */
const paths = (html: string) => [...html.matchAll(/<(?:path|line|circle) [^>]*?\/?>/g)].map((m) => m[0].replace(/ class="[^"]*"/, '')).join('|');
const iconPaths = (Icon: unknown) => paths(renderToStaticMarkup(createElement(Icon as never)));

test('1 · the face is SlidersHorizontal alone — no word, no other icon', () => {
  const want = iconPaths(SlidersHorizontal);
  assert.ok(want.length > 10, 'anti-vacuity: the icon drew nothing');
  for (const [name, Icon] of [['Filter', Filter], ['ArrowUpWideNarrow', ArrowUpWideNarrow], ['ListFilter', ListFilter]] as const) {
    assert.ok(iconPaths(Icon).length > 10, `anti-vacuity: lucide ${name} drew nothing`);
    assert.notEqual(iconPaths(Icon), want, `anti-vacuity: ${name} draws the same as SlidersHorizontal`);
  }
  for (const on of [false, true]) {
    const html = renderToStaticMarkup(createElement(SortFace, { on }));
    assert.equal(paths(html), want, 'the Show-and-Sort face is not the SlidersHorizontal drawing');
    assert.equal((html.match(/<svg\b/g) ?? []).length, 1, 'the face draws more than one icon');
    assert.equal(html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ''), '', 'the face carries a word — it is icon only');
    assert.match(html, /^<span aria-hidden="true"/, 'the face is read aloud — the host’s control carries the name');
  }
  assert.match(FACE, /import \{ SlidersHorizontal \} from 'lucide-react';/, 'the face imports another icon');
  assert.match(FACE, /<SlidersHorizontal className="h-\[18px\] w-\[18px\]" strokeWidth=\{1\.9\} \/>/);
  assert.doesNotMatch(FACE, /ArrowUpWideNarrow|\bFilter\b|ListFilter|<svg|sort-icon/, 'the face reaches for the funnel, the arrow, ≡ or a hand-drawn icon');
  assert.match(FACE, /export function SortFace\(\{ on \}: \{ on: boolean \}\)/, 'the face takes a current choice — it never shows one');
});

test('2 · the dot only when something is not the default — and the name says so', () => {
  const off = renderToStaticMarkup(createElement(SortFace, { on: false }));
  const on = renderToStaticMarkup(createElement(SortFace, { on: true }));
  assert.ok(!off.includes('data-sort-dot'), 'the dot shows on the default list');
  assert.equal((on.match(/data-sort-dot/g) ?? []).length, 1, 'no dot while something is not the default');
  assert.ok(off.includes('data-sort-face="off"') && on.includes('data-sort-face="on"'));
  assert.match(on, /<i class="absolute right-1\.5 top-1\.5 h-2 w-2 rounded-full bg-mulberry" data-sort-dot=""><\/i>/, 'the dot is not the small mulberry one at the top-right');
  assert.equal(sortLabel(false), 'Show and sort');
  assert.equal(sortLabel(true), 'Show and sort · changed');
});

test('3 · the four lists wear it, each on its one button, from its own measure', () => {
  // Guests › List — the sheet's opener.
  assert.match(SHEET, /const on = guestsFilterIsOn\(props\.filter, 'list'\) \|\| Boolean\(props\.plus\?\.value\) \|\| Boolean\(props\.asking\?\.on\) \|\| Boolean\(props\.pax\?\.value\);/);
  assert.match(SHEET, /aria-label=\{sortLabel\(on\)\}[\s\S]{0,400}<SortFace on=\{on\} \/>/, 'Guests › List does not wear the face');
  // Guests › Map — the shared menu, asked for the word.
  assert.match(MENU, /label: word \? sortLabel\(alsoOn \|\| guestsFilterIsOn\(filter, view\)\) : label,/);
  assert.match(MENU, /face: word \? <SortFace on=\{alsoOn \|\| guestsFilterIsOn\(filter, view\)\} \/> : <FilterFace/);
  assert.match(SCREEN, /const arrangeMenu: ThumbMenu = guestsFilterMenu\(\{[\s\S]{0,200}\bword: true,/, 'Guests › Map does not wear the face');
  // Suppliers › Find.
  assert.match(FIND_MENU, /label: sortLabel\(narrowing > 0 \|\| reordered\),/);
  assert.match(FIND_MENU, /face: <SortFace on=\{narrowing > 0 \|\| reordered\} \/>,/, 'Suppliers › Find does not wear the face');
  // Clients.
  assert.match(CLIENTS, /const on = applied > 0;/);
  assert.match(CLIENTS, /aria-label=\{sortLabel\(on\)\}[\s\S]{0,400}<SortFace on=\{on\} \/>/, 'Clients does not wear the face');
  for (const [name, src] of [['guests-filter-sheet', SHEET], ['find-sort-menu', FIND_MENU], ['clients-show-sort', CLIENTS]] as const) {
    assert.doesNotMatch(src, /FilterFace|ListFilter|\bFilter\b[^a-zA-Z]*from 'lucide-react'/, `${name} still draws the old face`);
  }
});

test('4 · each row seats exactly ONE control after the search — never two pills', () => {
  const seats = (src: string, start: string) => {
    const at = src.indexOf(start);
    assert.ok(at >= 0, `the row “${start.replace(/\s+/g, ' ')}” moved — re-aim this guard`);
    return src.slice(at, src.indexOf('\n', src.indexOf('right=', at)));
  };
  // 🎚 Amended 20 Nov 2026 (Guests redesign § 8, owner "Yes, your picks"): Guests' row gains ONE look round before the
  // button — *"Thumb row gains one round on Guests and Seats: search · (zoom on 2D) · look · Show and sort. This amends the
  // approved row in section 2."* Still exactly one Show-and-sort control; the look round is the only other seat.
  assert.match(seats(SCREEN, '<ThumbRow\n        name="guests"\n'), /right=\{lookMenu \? \[lookMenu, \{ node: filterSheet \}\] : \[\{ node: filterSheet \}\]\}/, 'Guests › List seats more than its look round and its one button');
  assert.match(seats(SCREEN, '<ThumbRow\n        name="guests-map"'), /right=\{lookMenu \? \[lookMenu, arrangeMenu\] : \[arrangeMenu\]\}/, 'Guests › Map seats more than its look round and its one button');
  assert.match(seats(FIND_ROW, '<ThumbRow\n        name="suppliers-find"'), /right=\{sortMenu \? \[sortMenu\] : \[\]\}/, 'Suppliers › Find seats more than its one button');
  const at = CLIENTS_PAGE.indexOf('<ThumbRow\n            name="customers"');
  const row = CLIENTS_PAGE.slice(at, CLIENTS_PAGE.indexOf('\n          />', at));
  assert.ok(at >= 0 && row.includes('right={['), 'the Clients row moved — re-aim this guard');
  assert.equal((row.slice(row.indexOf('right={[')).match(/\bnode: \(/g) ?? []).length, 1, 'Clients seats more than its one button');
  assert.match(row, /right=\{\[\s*\{\s*node: \(\s*<ClientsShowSort\b/);
});

test('5 · it is the thumb row’s 44 round — the search’s own circle — never a pill', () => {
  const face = /<span aria-hidden="true" class="([^"]*)"/.exec(renderToStaticMarkup(createElement(SortFace, { on: false })))?.[1] ?? '';
  assert.deepEqual(face.split(' ').sort(), ['grid', 'h-11', 'place-items-center', 'relative', 'text-ink', 'w-11'], 'the face is not the bare 44 round (a pill, a border or a fill of its own)');
  assert.doesNotMatch(ROW_CSS, /data-sort-face/, 'the thumb row widens the seat for this button');
  assert.match(ROW_CSS, /\.menu :global\(button\[aria-haspopup='listbox'\]\) \{ width: 44px; height: 44px; min-height: 44px;/, 'a menu seat is not the 44 round');
  for (const src of [SHEET, CLIENTS]) assert.match(src, /className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink"/, 'a sheet opener is not the 44 round');
});

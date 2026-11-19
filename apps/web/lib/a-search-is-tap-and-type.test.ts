/**
 * a-search-is-tap-and-type.test.ts — A THUMB-ROW SEARCH IS ONE TAP: THE ICON, THEN THE CURSOR AND THE KEYBOARD.
 *
 * Owner, 18 Nov 2026, verbatim: *"so it stays as 1 click. when they press the search icon it automatically places the
 * text indicator on the search bar and directly type.. So it shouldn't be tap to expand and press. it should be tap and
 * type."* This replaces — FOR THE RESTING STATE ONLY — the 22 Oct drawing in which the field is always the widest seat
 * ("field ≥ 60 %", still held for a row of worded buttons by `lib/action-button-is-icon-and-word.test.ts` T3b).
 *
 *   1 · AT REST a search is its icon: a 44 round — only when it is empty AND not being typed in, and only a search;
 *   2 · THE ICON IS THE REAL INPUT: at rest the <input> lies over the whole round, so the one tap lands on it;
 *   3 · THE FOCUS IS MADE INSIDE THE TAP: the seat's click handler calls `.focus()` synchronously — never in a timer, a
 *       frame, a promise or an animation's end (iPhone Safari opens the keyboard for nothing later);
 *   4 · WHILE FOCUSED it is the field again — the widest seat (≥ 60 %), the whole row on a touch screen;
 *   5 · IT CLOSES by itself: empty and blurred → the icon; holding words → it stays a field; the fold is played;
 *   6 · search on the LEFT of what is left in the row.
 *
 * Sabotage (each proved red, 18 Nov 2026): `:not(:focus-within)` dropped from the resting rule, so a focused search
 * stays an icon (1 · 4) · the resting input's `position: absolute; inset: 0` removed (2) · `input.focus(` wrapped in
 * `setTimeout` (3) · and in `requestAnimationFrame` (3) · the seats' `onClick={onFieldClick}` removed (3).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { focusSearchNow } from '../app/_components/search-grows';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const CSS = read('components/thumb-row.module.css');
const ROW = read('components/thumb-row.tsx');
const PART = read('app/_components/search-grows.ts');

const REST = ".row:not([data-search-force='open']) > [data-thumb-seat='field']:not(:focus-within):has(input[type='search']:placeholder-shown)";
/** The body of the rule whose selector list STARTS with `sel` + `tail`. */
function ruleAfter(sel: string, tail = ''): string {
  const at = CSS.indexOf(`${sel}${tail},`);
  assert.ok(at >= 0, `thumb-row.module.css has no rule starting “${sel}${tail},”`);
  const open = CSS.indexOf('{', at);
  return CSS.slice(open + 1, CSS.indexOf('}', open));
}

test('1 · at rest a search is its icon — a 44 round, only while empty and not typed in, only a search', () => {
  const body = ruleAfter(REST);
  assert.match(body, /flex:\s*0 0 44px;/, 'a resting search is not a 44 round');
  assert.match(body, /width:\s*44px;/);
  assert.match(body, /overflow:\s*hidden;/);
  // The three conditions are in the selector itself: not focused · empty · a search.
  assert.ok(REST.includes(':not(:focus-within)'), 'a search being typed in rests as an icon');
  assert.ok(REST.includes(':placeholder-shown'), 'a search holding words rests as an icon');
  assert.ok(REST.includes("input[type='search']"), 'a date or a composer rests as an icon');
  assert.ok(CSS.includes(`${REST},`), 'the resting rule is gone, or a focused / filled search matches it');
  // The magnifier is what is seen: the glyph is drawn in the seat, and nothing hides it at rest.
  assert.match(ROW, /<FieldIcon className=\{styles\.glyph\}/, 'anti-vacuity: the field draws no icon');
  assert.doesNotMatch(body, /display:\s*none|visibility:\s*hidden/);
});

test('2 · the icon IS the real input — at rest it lies over the whole round, unseen', () => {
  const body = ruleAfter(REST, " input[type='search']");
  assert.match(body, /position:\s*absolute;\s*inset:\s*0;/, 'the resting input does not cover the round — the tap lands on a wrapper, not the input');
  assert.match(body, /width:\s*100%;\s*height:\s*100%;/);
  assert.match(body, /opacity:\s*0;/, 'the resting input is drawn over the icon');
  assert.doesNotMatch(body, /pointer-events:\s*none|display:\s*none|visibility:\s*hidden/, 'the resting input cannot take the tap');
  // The seat is the input's frame.
  assert.match(ruleAfter(REST), /position:\s*relative;/);
  // It is still ONE input, the host's own — no second box is mounted for the open state.
  assert.equal((ROW.match(/<input\b/g) ?? []).length, 1, 'the row mounts a second input for the open state');
});

test('3 · the focus is made INSIDE the tap — synchronously, never after a timer, a frame or an animation', () => {
  const fn = /export function focusSearchNow\(seat: HTMLElement\): void \{([\s\S]*?)\n\}/.exec(PART)?.[1];
  assert.ok(fn, 'focusSearchNow is gone');
  assert.match(fn, /input\.focus\(\{ preventScroll: true \}\);/, 'it never focuses the input');
  assert.doesNotMatch(fn, /setTimeout|setInterval|requestAnimationFrame|requestIdleCallback|queueMicrotask|\.then\(|\bawait\b|animationend|transitionend|\.finished|addEventListener|=>/, 'the focus is deferred — iPhone Safari will not open the keyboard');
  // The seat's own click handler calls it directly, with the seat — on BOTH kinds of field seat.
  assert.match(ROW, /const onFieldClick = \(e: MouseEvent<HTMLElement>\) => focusSearchNow\(e\.currentTarget\);/, 'the tap handler does not focus at once');
  assert.equal((ROW.match(/onClick=\{onFieldClick\}/g) ?? []).length, 2, 'a field seat lost its tap handler');
  assert.doesNotMatch(ROW, /setTimeout\([^)]*focus|requestAnimationFrame\([^)]*focus/, 'the row focuses the search later');
  // Behaviour: by the time the call returns, the input has been focused — once, and not again if it already is.
  let focused = 0;
  const input = { focus: () => void focused++ };
  const seat = { querySelector: (sel: string) => (sel === "input[type='search']" ? input : null) };
  const g = globalThis as unknown as { document?: unknown };
  const had = g.document;
  g.document = { activeElement: null };
  try {
    focusSearchNow(seat as never);
    assert.equal(focused, 1, 'the input is not focused by the time the tap handler returns');
    g.document = { activeElement: input };
    focusSearchNow(seat as never);
    assert.equal(focused, 1, 'an input that already has the cursor is focused again');
    focusSearchNow({ querySelector: () => null } as never); // a seat with no search: nothing, no throw
  } finally {
    g.document = had;
  }
});

test('4 · while focused it is the field again — the widest seat, the whole row on a touch screen', () => {
  // The field's own shape is untouched: it takes every pixel the rounds leave (so ≥ 60 % of the row).
  assert.match(CSS, /\.field \{ display: flex; flex: 1 1 auto; min-width: 0; height: 44px;/, 'the field is no longer the widest seat');
  assert.match(CSS, /\.round \{ display: inline-flex; flex: 0 0 auto;/, 'anti-vacuity: a round can now grow');
  // …and on a touch screen the buttons fold the moment it has the cursor.
  const touch = /@media \(hover: none\) and \(pointer: coarse\) \{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? '';
  assert.match(touch, /\.row:not\(\[data-search-force='rest'\]\):has\(> \[data-thumb-seat='field'\]:focus-within input\[type='search'\]\) > \[data-thumb-seat\]:not\(\[data-thumb-seat='field'\]\)/, 'on a phone the focused search does not take the row');
  assert.match(touch, /\{ display: none; \}/);
  // The 22 Oct rule's own check stays, for rows of worded buttons.
  assert.match(readFileSync(join(WEB, 'lib/action-button-is-icon-and-word.test.ts'), 'utf8'), /3b — a text field keeps ≥ 60% of the row/, 'the ≥ 60 % check was deleted');
});

test('5 · it grows on focus and folds on blur — to the icon when empty, a field when it holds words', () => {
  assert.match(ROW, /const onFieldFocus = \(e: FocusEvent<HTMLElement>\) => \{\s*ride\.rowProps\.onFocus\(e\);[\s\S]{0,220}?playSearchGrows\(rowRef\.current, seat, true, forceShape\('rest'\)\);/, 'the field does not grow when it takes the cursor');
  assert.match(ROW, /const onFieldBlur = \(e: FocusEvent<HTMLElement>\) => \{\s*ride\.rowProps\.onBlur\(e\);[\s\S]{0,220}?playSearchGrows\(rowRef\.current, seat, false, forceShape\('open'\)\);/, 'the field does not fold when it loses the cursor');
  // A move of the cursor INSIDE the seat (to its ✕) is neither.
  assert.equal((ROW.match(/!seat\.contains\(e\.relatedTarget as Node \| null\)/g) ?? []).length, 2);
  // Empty → icon and words → field are the SAME selector's two halves; nothing in script decides it.
  assert.doesNotMatch(ROW, /setCollapsed|setSearchOpen|useState<boolean>\(/, 'the rest / open state moved into script — it can now disagree with what is typed');
  // The measuring switch never outlives the measure.
  assert.match(ROW, /row\?\.setAttribute\('data-search-force', shape\);\s*return \(\) => row\?\.removeAttribute\('data-search-force'\);/);
});

test('6 · search on the left: the seat after a resting search takes the free room', () => {
  assert.match(CSS, new RegExp(`${REST.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\+ \\[data-thumb-seat\\],`), 'nothing pushes the other seats to the right');
  assert.match(CSS, /\+ \[data-thumb-seat\] \{ margin-left: auto; \}/);
});

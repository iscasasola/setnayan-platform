/**
 * the-chips.test.ts — CHIPS (kind 11), AND THE FORM ROW'S TWO NEW HOOKS.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9; approved gallery `prototypes/control_templates_2026-10-08.html`
 * § 11): *"consistent size? or adaptive?"* → one height, a minimum width, the width follows the word, and a chip
 * never changes size when chosen · *"we want the whole app to be adaptive to the same feel"*.
 *
 *   (1) ONE LOOK, TWO STATES — chosen is the pill selector's own "on" (the accent and the ink that reads on it);
 *       not chosen is grey words on white. No third colour.
 *   (2) A CHIP NEVER CHANGES SIZE — chosen or not it wears the SAME shape: 40 px tall, at least 84 px wide, the same
 *       padding, border and weight; no icon comes and goes.
 *   (3) RENDERED — a named group of toggle buttons (`aria-pressed`), several on at once; a press tells the screen
 *       the chip and what it is NOW; the chips keep no state of their own.
 *   (4) THE FORM ROW'S MARK — a small mark after a row's name (the Pro mark), on a plain row and on a chosen one.
 *   (5) THE FORM ROW'S `onType` — the words as they are typed, and once more what the row is left holding; it is
 *       never the save.
 *   (6) THE WATCH — chips know no screen and write no accent.
 *   (7) AN EVEN GRID (owner 2026-10-08, on six chips that hugged their words: *"make RSVP ask buttons even"*) —
 *       every chip of a set is the same width and the same height and the columns fill the row edge to edge: all
 *       on one line where the row is wide enough, otherwise what a 375-px phone gets (three across if the longest
 *       word fits, else two) on every screen; a word is never shrunk, cut or wrapped. Painted: one grid, every chip
 *       its column's width. `even={false}` is the only way to hug.
 *       ⤷ MEASURED IN THE BROWSER (Chromium, 375 × 812, the review copy, 2026-10-09): "Song request" at the chip's
 *       14-px semibold is 83 px of words → a 121-px chip; three of those need 379 px and a phone's row has 343 → two
 *       across, three rows. `scratchpad/G1/setup.mjs` repeats the measure on the page itself.
 *
 * Mutations seen RED (2026-10-08), each restored: a chosen chip filled with a colour of its own → (1); a tick icon
 * drawn only on a chosen chip → (2); `font-bold` only when chosen → (2); `aria-pressed` dropped → (3); `onToggle`
 * told the OLD state → (3); the mark drawn outside the name (after the ⓘ) → (4); `onType` not told when ✕ leaves
 * the field → (5); `onType` wired to `onKeep` → (5); a chip hugging its word again (no `w-full`) → (7); the set a
 * wrapping row instead of a grid → (7); three across although the longest word does not fit (the phone's row read
 * as 400 px) → (7); a wide row given as many columns as fit (four, five) when not all fit on one line → (7); the
 * three-across step dropped (a computer back to two wide columns) → (7); a label allowed to wrap → (7).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const CHIPS = 'app/_components/chips.tsx';
const ROW = 'app/_components/form-row.tsx';
const PILL = 'app/_components/pill-selector.tsx';
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const h = React.createElement;

async function paint(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}

const OPTIONS = [
  { key: 'family', label: 'Family' },
  { key: 'friends', label: 'Friends' },
  { key: 'work', label: 'Work', testId: 'chip-work' },
  { key: 'sponsors', label: 'Sponsors' },
] as const;

test('(1) one look, two states: chosen is the pill selector’s own "on"; not chosen is grey words on white', async () => {
  const { CHIP_ON_CLASS, CHIP_OFF_CLASS } = await import(`../${CHIPS}`);
  const { PILL_ON_CLASS } = await import(`../${PILL}`);
  for (const cls of PILL_ON_CLASS.split(' ')) assert.ok(CHIP_ON_CLASS.split(' ').includes(cls), `a chosen chip does not wear the "on" look (${cls})`);
  assert.ok(CHIP_ON_CLASS.split(' ').includes('border-sn-accent'));
  assert.deepEqual(CHIP_OFF_CLASS.split(' ').sort(), ['bg-white', 'border-ink/15', 'text-ink/55']);
  // No third colour anywhere in the file.
  assert.doesNotMatch(read(CHIPS), /(?:bg|text|border|ring)-(?:success|danger|warn|terracotta|gild|emerald|green|red|amber)\b/, 'a chip wears a colour that is neither "on" nor grey');
});

test('(2) a chip never changes size: chosen or not, the same shape — 40 px, at least 84 px, the same padding, border and weight; no icon', async () => {
  const { CHIP_CLASS, CHIP_ON_CLASS, CHIP_OFF_CLASS, chipClass } = await import(`../${CHIPS}`);
  const shape = CHIP_CLASS.split(' ');
  for (const cls of ['h-10', 'min-h-10', 'min-w-[84px]', 'px-[18px]', 'border', 'rounded-full', 'whitespace-nowrap', 'text-[14px]', 'font-semibold']) {
    assert.ok(shape.includes(cls), `the chip's shape lost ${cls}`);
  }
  // Both states are that shape plus COLOURS only: nothing in "on" or "off" can change a chip's box.
  const SIZES = /^(?:h|w|min-h|min-w|max-w|p|px|py|pl|pr|m|mx|my|gap|text-\[|text-(?:xs|sm|base|lg)|font|leading|tracking|border-(?:0|2|4|8|\[)|ring-\d|scale)/;
  for (const cls of [...CHIP_ON_CLASS.split(' '), ...CHIP_OFF_CLASS.split(' ')]) assert.doesNotMatch(cls, SIZES, `a state changes the chip's size (${cls})`);
  assert.equal(chipClass(true), `${CHIP_CLASS} ${CHIP_ON_CLASS}`);
  assert.equal(chipClass(false), `${CHIP_CLASS} ${CHIP_OFF_CLASS}`);
  // The finger's target is 44 px: the 40-px chip plus 2 px above and below.
  assert.ok(shape.includes('after:-inset-y-0.5') && shape.includes('relative'));
  // Nothing comes and goes inside a chip: its only child is its label.
  const { Chips } = await import(`../${CHIPS}`);
  const html = await paint(h(Chips, { label: 'Groups', options: OPTIONS, value: ['family'], onToggle: () => {} } as Record<string, unknown>));
  assert.doesNotMatch(html, /<svg/, 'an icon is drawn in a chip');
  const [on, off] = [/data-chip="family"[^>]*class="([^"]*)"/.exec(html)?.[1], /data-chip="friends"[^>]*class="([^"]*)"/.exec(html)?.[1]];
  assert.ok(on && off, 'anti-vacuity: the two chips were not found');
  assert.equal(on!.replace(CHIP_ON_CLASS, ''), off!.replace(CHIP_OFF_CLASS, ''), 'a chosen chip is shaped differently from one that is not');
});

test('(3) rendered: a named group of toggles, several on at once; a press says the chip and what it is NOW', async () => {
  const { Chips } = await import(`../${CHIPS}`);
  const html = await paint(h(Chips, { label: 'Groups', data: 'groups', options: OPTIONS, value: ['family', 'work'], onToggle: () => {} } as Record<string, unknown>));
  assert.match(html, /^<div role="group" aria-label="Groups" data-chips="groups"/);
  assert.equal(count(html, /<button type="button" aria-pressed="(true|false)"/g), 4);
  assert.deepEqual([...html.matchAll(/aria-pressed="(true|false)"[^>]*data-chip="(\w+)"/g)].map((m) => `${m[2]}:${m[1]}`), ['family:true', 'friends:false', 'work:true', 'sponsors:false']);
  assert.match(html, /data-chip="work" data-testid="chip-work"/);
  assert.match(html, /><span data-chip-label="" class="whitespace-nowrap">Family<\/span><\/button>/);
  const src = read(CHIPS);
  assert.match(src, /const on = value\.includes\(o\.key\);/);
  assert.match(src, /onClick=\{\(\) => onToggle\(o\.key, !on\)\}/, 'a press does not say what the chip is now');
  // The only thing the chips remember is what they MEASURED (their widest word, their row) — never what is chosen.
  assert.equal(count(src, /useState</g), 1);
  assert.match(src, /const \[measured, setMeasured\] = useState<\{ widest: number; row: number \} \| null>\(null\);/);
  assert.doesNotMatch(src, /useReducer|setMeasured\([^)]*value|useState<[^>]*\bK\b/, 'the chips keep a state of what is chosen');
});

test('(4) the Form row’s mark: a small mark after the row’s NAME — on a plain row and on a chosen one', async () => {
  const { FormRow, ChosenRow, FormRows } = await import(`../${ROW}`);
  const mark = h('span', { 'data-mark': 'pro' }, '◆');
  const plain = await paint(h(FormRow, { name: 'Celebration', mark }, h('span', null, 'x')));
  assert.match(plain, /<span data-form-row-name=""[^>]*><span class="min-w-0"><span class="[^"]*">Celebration<span data-form-row-name-mark=""[^>]*><span data-mark="pro">◆<\/span><\/span><\/span>/, 'the mark is not inside the name');
  const chosen = await paint(h(FormRows, null, h(ChosenRow, { name: 'Celebration', mark, value: 'none', options: [{ key: 'none', label: 'None' }], onPick: () => {} } as Record<string, unknown>)));
  assert.equal(count(chosen, /data-form-row-name-mark=""/g), 1);
  // No mark handed in → nothing is drawn for one.
  assert.doesNotMatch(await paint(h(FormRow, { name: 'Celebration' }, h('span', null, 'x'))), /data-form-row-name-mark/);
});

test('(5) the Form row’s `onType`: the words as they are typed, once more what the row is left holding — never the save', () => {
  const src = read(ROW);
  // As they are typed: the open field tells every change.
  assert.match(src, /const setText = \(next: string\) => \{\s*setTextNow\(next\);\s*onType\?\.\(next\);\s*\};/);
  assert.equal(count(src, /onChange=\{\(e\) => setText\(e\.target\.value\)\}/g), 2, 'a field (the line or the long box) does not tell what is typed');
  // When it closes: what the row is left holding — the kept words, or what it held before on ✕ / Esc / nothing changed.
  assert.match(src, /onType\?\.\(out\.kind === 'send' \|\| out\.kind === 'wrong' \? out\.text : shown\);/, 'a preview drawn while typing is not put back when the field is left as it was');
  // Never the save: keeping is `onKeep`, in `send`, once.
  assert.equal(count(src, /\bonKeep\(/g), 1);
  assert.doesNotMatch(src, /onType\?\.\([^)]*\)[^;]*onKeep|onType=\{onKeep\}/, '`onType` is wired to the save');
  assert.match(src, /answer = onKeep\(text\);/);
});

test('(6) the watch: chips know no screen and write no accent', () => {
  const src = read(CHIPS);
  assert.ok(src.length > 400, 'anti-vacuity');
  assert.doesNotMatch(src, /\/launch\/|maker-|\/dashboard\/|rsvp/i, 'the chips know a screen');
  assert.doesNotMatch(src, /mulberry|#[0-9a-fA-F]{3,8}\b|\btext-white\b/, 'the chips write a colour for the accent');
  const watch = readFileSync(join(WEB, 'lib/the-accent-is-one-token.test.ts'), 'utf8');
  assert.ok(watch.includes(`'${CHIPS}'`), 'chips.tsx is not on the accent watch (TEMPLATE_FILES)');
});

/* ── (7) an even grid ─────────────────────────────────────────────────── */

test('(7) an even grid: one width, one height, edge to edge — all on one line, or what a phone gets; a word is never cut', async () => {
  const G = await import('./chips-grid');
  // THE RULE. "Song request" measures 83 px in the browser → a 121-px chip (18 + 1 each side).
  assert.equal(G.chipWidthFor(83), 121);
  assert.equal(G.chipWidthFor(20), G.CHIP_MIN_PX, 'a short word makes a chip narrower than the template’s floor');
  assert.equal(G.CHIP_PHONE_ROW_PX, 375 - 16 * 2);
  const six = (widest: number, row: number) => G.chipColumns({ count: 6, widest, row });
  // A phone: three across only if the LONGEST fits three across — 3 × 121 + 2 × 8 = 379 does not fit 343.
  assert.equal(six(121, 343), 2, 'three across although the longest word does not fit');
  assert.equal(six(121, 347), 2);
  assert.equal(six(109, 343), 3, 'two across although three fit (3 × 109 + 16 = 343)');
  assert.equal(six(110, 343), 2);
  assert.equal(G.chipPhoneColumns(6, 121), 2);
  assert.equal(G.chipPhoneColumns(6, 100), 3);
  assert.equal(G.chipPhoneColumns(2, 84), 2, 'two chips are not side by side');
  // A wider screen: ALL on one line where they fit with equal widths (6 × 121 + 5 × 8 = 766) …
  assert.equal(six(121, 766), 6);
  assert.equal(six(121, 1200), 6);
  // … otherwise THREE across where three of the widest fit the row (3 × 121 + 16 = 379): six chips are 3 × 2 on a
  // computer — Guests › Setup's 720-px row at 1280 — never two wide columns three rows deep …
  for (const row of [379, 520, 720, 765]) assert.equal(six(121, row), 3, `a ${row}-px row is not three across`);
  // … and below that the phone's count: a phone stays at two, and nothing is ever four or five across.
  for (const row of [343, 360, 378]) assert.equal(six(121, row), 2, `a ${row}-px row is given more columns than a phone`);
  for (let row = 250; row < 766; row += 7) assert.ok([2, 3].includes(six(121, row)), `a ${row}-px row is ${six(121, row)} across`);
  assert.equal(six(100, 600), 3);
  // Three or fewer chips that do not fit one line have no "three across" step of their own.
  assert.equal(G.chipColumns({ count: 3, widest: 121, row: 343 }), 2);
  // Never a chip narrower than its word: a row too narrow for the phone's count gets fewer columns.
  assert.equal(six(121, 250), 2);
  assert.equal(six(121, 249), 1);
  assert.equal(G.chipColumns({ count: 1, widest: 121, row: 343 }), 1);
  // Before the browser has measured, a word is guessed a little WIDE (too narrow would cut it): never under the measure.
  assert.ok(G.guessLabelPx('Song request') >= 83, 'the first paint can cut the longest word');
  assert.equal(G.chipColumns({ count: 6, widest: G.chipWidthFor(G.guessLabelPx('Song request')), row: G.CHIP_PHONE_ROW_PX }), 2, 'the first paint and the measured one disagree on a phone');

  // PAINTED: ONE grid; every chip its column's width; the words on one line.
  const { Chips } = await import(`../${CHIPS}`);
  const ASKS = ['Plus-ones', 'Meal', 'Dietary', 'Song request', 'A note', 'Mobile'].map((label, i) => ({ key: `k${i}`, label }));
  const html = await paint(h(Chips, { label: 'RSVP asks', options: ASKS, value: ['k0'], onToggle: () => {} } as Record<string, unknown>));
  assert.match(html, /^<div role="group" aria-label="RSVP asks" data-chips="" data-chips-columns="2" style="grid-template-columns:repeat\(2, minmax\(0, 1fr\)\)" class="grid gap-2 "/, 'the set is not one even grid');
  const chips = [...html.matchAll(/<button type="button" aria-pressed="(?:true|false)" data-chip="k\d" class="([^"]*)"><span data-chip-label="" class="whitespace-nowrap">/g)].map((m) => m[1]!.split(' '));
  assert.equal(chips.length, 6, 'anti-vacuity: the six chips were not found');
  for (const c of chips) {
    assert.ok(c.includes('w-full'), 'a chip hugs its word (it is not its column’s width)');
    assert.ok(c.includes('h-10') && c.includes('min-h-10'), 'a chip is not the one height');
  }
  // Three short words fit three across; all four of the earlier set do not fit one line on a phone.
  assert.match(await paint(h(Chips, { label: 'x', options: OPTIONS, value: [], onToggle: () => {} } as Record<string, unknown>)), /data-chips-columns="3"/);
  // Hugging is asked for, never the default.
  const hug = await paint(h(Chips, { label: 'x', options: ASKS, value: [], onToggle: () => {}, even: false } as Record<string, unknown>));
  assert.match(hug, /^<div role="group" aria-label="x" data-chips="" class="flex flex-wrap gap-2 "/);
  assert.doesNotMatch(hug, /w-full|grid-template-columns|data-chips-columns/);
  const src = read(CHIPS);
  assert.match(src, /even = true,/, 'even is not the default');
  // A word is never shrunk, cut or wrapped — and what is measured is the WORD, in the browser.
  assert.doesNotMatch(src, /truncate|text-ellipsis|overflow-hidden|line-clamp|whitespace-normal|text-\[1[0-3]px\]/, 'a chip may cut, wrap or shrink its word');
  assert.match(src, /el\.querySelectorAll<HTMLElement>\('\[data-chip-label\]'\)\.forEach\(\(w\) => \{\s*label = Math\.max\(label, w\.getBoundingClientRect\(\)\.width\);/);
  assert.match(src, /const next = \{ widest: chipWidthFor\(label\), row: el\.clientWidth \};/);
  assert.match(src, /new ResizeObserver\(measure\)/, 'a turned phone keeps the old columns');
});

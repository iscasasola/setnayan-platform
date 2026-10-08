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
 *
 * Mutations seen RED (2026-10-08), each restored: a chosen chip filled with a colour of its own → (1); a tick icon
 * drawn only on a chosen chip → (2); `font-bold` only when chosen → (2); `aria-pressed` dropped → (3); `onToggle`
 * told the OLD state → (3); the mark drawn outside the name (after the ⓘ) → (4); `onType` not told when ✕ leaves
 * the field → (5); `onType` wired to `onKeep` → (5).
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
  assert.match(html, />Family<\/button>/);
  const src = read(CHIPS);
  assert.match(src, /const on = value\.includes\(o\.key\);/);
  assert.match(src, /onClick=\{\(\) => onToggle\(o\.key, !on\)\}/, 'a press does not say what the chip is now');
  assert.doesNotMatch(src, /useState|useReducer|useEffect/, 'the chips keep a state of their own');
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

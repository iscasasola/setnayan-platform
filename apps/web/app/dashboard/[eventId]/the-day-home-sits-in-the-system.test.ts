/**
 * GUARD — the couple Home on the event day and after it sits on the large-screen grammar, and the Watch is drawn ONCE.
 *
 * Owner-approved tablet/desktop plan, D4 "Redo event-day/after Home" (2026-11-13), lane 4. The before-the-day Home
 * already rode the system; these two states still drew the legacy bento full-bleed, and the Watch was drawn twice
 * (`lg:hidden` fold + `hidden lg:block` copy). The rules this holds:
 *
 *   · below 701 the phone is unchanged — every wrapper is `display: contents`, so the stack and its order are the
 *     phone's own;
 *   · from 701 (`tab:`) the layout switches — the WIDE column (`tab:max-w-5xl`), one stack with a gap;
 *   · `lg:` may only ADD a column (the grid of two) — never a width or a display that `tab:` did not already set;
 *   · ONE Watch element — no `lg:hidden` / `hidden lg:block` pair in the dashboard bento.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const PAGE = read('page.tsx');
const BENTO = read('_components/event-dashboard.tsx');

const classOf = (attr: string) => {
  const m = new RegExp(`<div ${attr} className="([^"]*)"`).exec(PAGE);
  return m?.[1] ?? null;
};

for (const state of ['on', 'after'] as const) {
  test(`the ${state === 'on' ? 'event day' : 'after the day'} Home: phone untouched, wide from tab:, a column from lg`, () => {
    const cls = classOf(`data-home-day="${state}"`);
    assert.ok(cls, `the ${state} Home lost its data-home-day wrapper`);
    const words = cls.split(/\s+/);
    assert.equal(words[0], 'contents', 'below 701 the wrapper must be display: contents, or the phone stack changes');
    for (const w of ['tab:flex', 'tab:flex-col', 'tab:max-w-5xl', 'tab:mx-auto']) assert.ok(words.includes(w), `missing ${w}`);
    const unprefixed = words.filter((w) => !w.includes(':'));
    assert.deepEqual(unprefixed, ['contents'], `a phone class crept onto the wrapper: ${unprefixed.join(' ')}`);
    const lg = words.filter((w) => /^(lg|xl):/.test(w));
    for (const w of lg) assert.match(w, /^lg:(grid|grid-cols-2|items-start)$/, `lg:/xl: may only ADD a column — found ${w}`);
  });
}

test('each column of the two states is display: contents on a phone', () => {
  const cols = [...PAGE.matchAll(/<div data-home-day-(?:now|doors)="" className="([^"]*)"/g)].map((m) => m[1]!);
  assert.equal(cols.length, 4, `expected the now + doors column in each state, found ${cols.length}`);
  for (const c of cols) {
    assert.ok(c.startsWith('contents '), `a column is not display: contents below 701: "${c}"`);
    assert.deepEqual(c.split(/\s+/).filter((w) => !w.includes(':')), ['contents'], `a phone class on a column: "${c}"`);
  }
});

test('the receded planning tools span both columns from lg', () => {
  const planning = [...PAGE.matchAll(/<details className="([^"]*)">\s*<summary[^>]*>\s*Planning tools/g)].map((m) => m[1]!);
  assert.equal(planning.length, 2);
  for (const c of planning) assert.equal(c, 'sn-tile lg:col-span-2');
});

test('the Watch is ONE element — no phone fold beside a laptop copy', () => {
  assert.doesNotMatch(BENTO, /<details className="lg:hidden"/, 'the phone-only Watch fold is back');
  assert.doesNotMatch(BENTO, /<div className="hidden lg:block">/, 'the laptop-only Watch copy is back');
  assert.equal((BENTO.match(/Setnayan AI · The Watch/g) ?? []).length, 1, 'the Watch heading is drawn more than once');
  assert.equal((BENTO.match(/<WatchFold\b/g) ?? []).length, 1);
  const fold = read('_components/watch-fold.tsx');
  assert.match(fold, /WATCH_WIDE_QUERY = '\(min-width: 701px\)'/, 'the Watch no longer opens on the tab: line');
  assert.match(fold, /<summary\b/, 'the Watch lost its summary — a fold with no way to fold it');
});

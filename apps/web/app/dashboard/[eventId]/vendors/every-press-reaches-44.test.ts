import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { SUP_REACH_X, SUP_REACH_Y } from '@/lib/suppliers-shell';
import { MORE_TO_COMPARE_SAVE, MORE_TO_COMPARE_SAVING } from '@/lib/explore-info-copy';

/**
 * EVERY PRESS ON THE SUPPLIERS PAGE REACHES 44 PX — AND SAVE SAYS IT IS SAVING.
 *
 * 🚨 The batch-3 walk (2026-10-13, /dev/suppliers-lab, 375×812 touch): the Sort and "＋ Add to your event" menus were
 * 40 px tall, Expand all and the ＋ circle 40 px wide; and Save on a "More to compare" card read "Save" while its
 * write waited (owner rule: a press shows what is loading). (Find / Build / Booked measured 38 px — their FACE: every
 * pill selector's choice already reaches 3 px over its track, `pill-selector.tsx`, held by
 * `lib/selectors-are-pills-that-slide.test.ts`; scanned in both engines at 44.)
 *
 * The faces stay as they were; an invisible `::after` reaches past each on its short side. The press lengths were
 * SCANNED in Chromium and WebKit (`controller-2026-10-12/batch3-followups/scripts/reach.mjs`): 44 / 44 / 44 / 48 —
 * and 42 with a 2-px reach, because a face's 1-px border is inside an absolute inset. This holds what was measured:
 *   • the reach is 3 px, on the short side, and an `::after` (nothing drawn: `content-['']`, no fill);
 *   • each of the four controls wears it — Expand all's on a wrapper, because its glass clips what leaves it, and
 *     a press on that wrapper is the button's press;
 *   • Save's word while waiting is "Saving…", on THAT card's Save only (an Ask that saves first keeps "Save").
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const BENCH = src('_components/shortlist-categories.tsx');
const THUMB = src('_components/find-thumb-row.tsx');

test('the reach: 3 px past a bordered face, on the short side, drawing nothing', () => {
  for (const [reach, short, long] of [
    [SUP_REACH_Y, 'after:-inset-y-[3px]', 'after:inset-x-0'],
    [SUP_REACH_X, 'after:-inset-x-[3px]', 'after:inset-y-0'],
  ] as const) {
    for (const c of ['relative', 'after:absolute', short, long, "after:content-['']"]) assert.ok(reach.split(' ').includes(c), `${reach} lost ${c}`);
    assert.doesNotMatch(reach, /after:bg-|after:border|after:shadow|after:ring/, 'the reach must draw nothing — the look stays');
  }
});

test('Sort and "＋ Add to your event" reach 44 tall', () => {
  const sort = BENCH.slice(BENCH.indexOf('const sortMenu = ('), BENCH.indexOf('/>', BENCH.indexOf('const sortMenu = (')));
  assert.match(sort, /className=\{`border border-ink\/15 \$\{SUP_REACH_Y\}`\}/);
  const add = BENCH.slice(BENCH.indexOf('dataAttr="data-add-category"'), BENCH.indexOf('/>', BENCH.indexOf('dataAttr="data-add-category"')));
  assert.match(add, /className=\{`border border-ink\/15 \$\{SUP_REACH_Y\}`\}/);
});

test('Expand all and ＋ Add your own reach 44 wide (Expand all through a wrapper the glass cannot clip)', () => {
  assert.match(THUMB, /<ActionButton tone="brand" filled icon=\{Plus\} label="Add your own" onClick=\{onAdd\} className=\{SUP_REACH_X\} \/>/);
  const wrap = THUMB.slice(THUMB.indexOf('data-press-reach=""') - 120, THUMB.indexOf('sn-glass-row inline-flex shrink-0 rounded-full'));
  assert.match(wrap, /className=\{`\$\{SUP_REACH_X\} inline-flex shrink-0`\}/, 'the wrapper must carry the reach');
  assert.match(wrap, /if \(!\(e\.target as Element\)\.closest\('button'\)\) e\.currentTarget\.querySelector\('button'\)\?\.click\(\);/, 'a press on the reach must be the button’s press');
  assert.ok(THUMB.indexOf('data-press-reach=""') < THUMB.indexOf("label={allOpen ? 'Collapse all' : 'Expand all'}"), 'Expand all must sit inside the wrapper');
});

test('Save says "Saving…" while its own write waits', () => {
  assert.equal(MORE_TO_COMPARE_SAVING, 'Saving…');
  assert.match(BENCH, /label=\{saving \? MORE_TO_COMPARE_SAVING : MORE_TO_COMPARE_SAVE\}/);
  assert.match(BENCH, /saving=\{moreSaving === row\.vendorProfileId\}/);
  assert.match(BENCH, /onSave=\{\(\) => void saveFromMore\(row, true\)\}/, 'the Save press is the one that says Saving…');
  const save = BENCH.slice(BENCH.indexOf('const saveFromMore = async ('), BENCH.indexOf('const undoFromMore = async ('));
  assert.match(save, /if \(pressed\) setMoreSaving\(v\.vendorProfileId\);/);
  assert.match(save, /finally \{[^}]*if \(pressed\) setMoreSaving\(null\);/, 'Saving… must end however the write ends');
  assert.notEqual(MORE_TO_COMPARE_SAVE, MORE_TO_COMPARE_SAVING);
});

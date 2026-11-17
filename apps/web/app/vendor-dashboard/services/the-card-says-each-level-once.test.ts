/**
 * GUARD — ONE SERVICE CARD SAYS EACH THING ONCE (owner 17 Nov on the #7901 preview, Shop › Services).
 *
 *   1. The taxonomy trail never repeats a level: "Styling, Flowers & Lights › Lights & Sounds › Lights & Sounds" was
 *      drawn on the first card, the only one with a coverage. `pathLabel` drops a level equal to the one before it.
 *   2. The card's meta line adds the coverage's level ONLY when neither the group heading above nor the card's
 *      category already says it — so every card reads the same.
 *   3. The record rides inside the card as ONE quiet line (`compact`), not a ruled block of its own.
 *
 * Sabotage: drop the `filter` in pathLabel (1 red) · append the full path to the meta line (2 red) · drop `compact` (3 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '../../..');
const read = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));
const MANAGER = read('app/vendor-dashboard/services/_components/services-manager.tsx');

test('1 · the trail never says a level twice in a row', () => {
  const cov = read('lib/vendor-coverages.ts');
  assert.match(cov, /\[e\.parent, e\.branch, e\.leaf\]\.filter\(\(x, i, a\) => i === 0 \|\| x !== a\[i - 1\]\)\.join\(' › '\)/, 'pathLabel joins every level again, repeats included');
});

test('2 · the meta line adds the coverage only where the heading and the category do not already say it', () => {
  assert.doesNotMatch(MANAGER, /` · \$\{coverageLabelById\.get\(svc\.coverage_id\)\}`/, 'the meta line appends the whole coverage path again');
  assert.match(MANAGER, /const said = new Set\(\[\.\.\.covHeaderLabel\.split\(' › '\), displayServiceLabel\(svc\.category\)\]\);/);
  assert.match(MANAGER, /return leaf && !said\.has\(leaf\) \? ` · \$\{leaf\}` : '';/);
});

test('3 · the record is one quiet line inside the card', () => {
  assert.match(MANAGER, /<CardRecordSection record=\{rec\} variant="vendor" compact \/>/, 'the card record is a ruled block again');
  const rec = read('app/_components/card-record-section.tsx');
  assert.match(rec, /<section className=\{compact \? '' : 'mt-auto border-t border-ink\/10 pt-3'\}/, 'the compact record still draws a rule above it');
  assert.match(rec, /data-card-medal-line=""/);
});

/**
 * guest-rows-share-one-state.test.ts — EVERY GUEST ROW CHANGES STATE TOGETHER
 * (Maker PR 4f · G36 · BUTTON_RULE 3a). Owner 2026-10-07: *"what happend to (X)
 * and (remove)"* — a 4-button row went icon-only while a 3-button row stayed
 * text; *"the 3 buttons will all be icons at the same time, or text at the same
 * time or icon with text at the same time. not each"*.
 *
 * The rule is ONE answer for a GROUP: the tightest row decides (`pickRowState`),
 * written once on the group element (`fitGroup` → `data-row-state`), and CSS
 * keys every row's buttons off that one attribute.
 *
 * SABOTAGE (seen red): give each guest row its own `useRowState` (per-row fit).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { pickRowState, ROW_STATES, type RowState } from '@/lib/guest-roster-view';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const SCREEN = read('guests-screen.tsx');
const CSS = read('guests-screen.module.css');
const HOOK = read('use-row-state.ts');

test('the fit order is icon + word → word only → icon only, and the tightest row decides (executed)', () => {
  assert.deepEqual([...ROW_STATES], ['full', 'text', 'icon']);
  // Two rows: a roomy 2-button row and a tight 3-button row. Only the tight one
  // overflows at "full"; it fits at "text". The GROUP answer is "text" for both.
  const tight: Record<RowState, boolean[]> = { full: [false, true], text: [false, false], icon: [false, false] };
  assert.equal(pickRowState((s) => tight[s].some(Boolean)), 'text');
  // Nothing fits → icon only, never a mix.
  assert.equal(pickRowState(() => true), 'icon');
  assert.equal(pickRowState(() => false), 'full');
});

test('ONE group for every guest row: the list element is fitted once, never each row', () => {
  assert.equal((SCREEN.match(/useRowState\(/g) ?? []).length, 2, 'useRowState is called more or fewer than twice (the list group + the thumb row)');
  assert.match(SCREEN, /useRowState\(listRef,/, 'the guest rows are not fitted as one group');
  assert.match(SCREEN, /<div ref=\{listRef\} data-guest-rows="">/, 'the group element is not the list');
  const row = SCREEN.slice(SCREEN.indexOf('function GuestRowLine('));
  assert.doesNotMatch(row, /useRowState|fitGroup|useFitRow/, 'a guest row fits itself — rows would disagree');
  assert.match(row, /className=\{styles\.acts\} data-fit-row=""/, 'a row’s buttons are not measured as part of the group');
});

test('the state is written on the GROUP and CSS reads it from there', () => {
  assert.match(HOOK, /group\.setAttribute\('data-row-state', state\)/);
  assert.match(HOOK, /rows\.some\(/, 'the group state is not decided by the tightest row');
  assert.match(CSS, /\[data-row-state='text'\] \.acts :global\(\.ab\) svg/, 'word-only does not reach every row');
  assert.match(CSS, /\[data-row-state='icon'\] \.acts :global\(\.ab \.lbl\)/, 'icon-only does not reach every row');
  // The shipped per-button fit (`useFitRow`, right-to-left one at a time) would mix states.
  assert.doesNotMatch(SCREEN, /useFitRow|fitRow\(/, 'the per-button fit is used — buttons would drop one at a time');
});

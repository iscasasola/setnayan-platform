/**
 * GUARD — a typo still finds its trade, and the guess is kept apart from the answer (owner, 2026-11-06 gate walk:
 * "search that finds the compatible and most likely compatible (to help solve space, typo errors…)").
 *
 * Runs against the REAL taxonomy, like `taxonomy-search-rank.test.ts`, so a renamed service cannot leave this
 * green while nobody can find it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  rankTaxonomyOptions,
  rankTaxonomyOptionsWithClose,
  editDistanceWithin,
  closeMatchBudget,
} from './taxonomy-search-rank';
import { TAXONOMY_MAP } from './taxonomy';

const labelFor = (key: string): string =>
  key
    .split('_')
    .map((w) => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
const OPTIONS = Object.keys(TAXONOMY_MAP).map((key) => ({ key, label: labelFor(key) }));

test('ANCHOR — the real taxonomy is loaded', () => {
  assert.ok(OPTIONS.length > 100, `got ${OPTIONS.length}`);
  assert.ok(OPTIONS.some((o) => o.key === 'catering'));
  assert.ok(OPTIONS.some((o) => o.key === 'photo_booth'));
});

test('`matches` is byte-identical to the shipped ranker — every existing caller keeps its answers', () => {
  for (const q of ['photo', 'booth', 'photobooth', 'photo booth', 'caterer', 'emcee', 'catring', 'zz']) {
    assert.deepEqual(rankTaxonomyOptionsWithClose(OPTIONS, q).matches, rankTaxonomyOptions(OPTIONS, q), q);
  }
});

test('"photobooth" and "photo booth" both find Photo Booth as a real match', () => {
  for (const q of ['photobooth', 'photo booth']) {
    const { matches } = rankTaxonomyOptionsWithClose(OPTIONS, q);
    assert.ok(matches.some((m) => m.key === 'photo_booth'), `${q} → ${matches.map((m) => m.key)}`);
  }
});

test('"catring" → Catering, as a CLOSE match (never in the ranked list)', () => {
  const { matches, close } = rankTaxonomyOptionsWithClose(OPTIONS, 'catring');
  assert.ok(!matches.some((m) => m.key === 'catering'));
  assert.equal(close[0]?.key, 'catering', `close → ${close.map((c) => c.key)}`);
});

test('"photograper" → a Photographer, as a close match', () => {
  const { close } = rankTaxonomyOptionsWithClose(OPTIONS, 'photograper');
  assert.ok(close.length > 0);
  // Fewest edits first: every "… Photographer" (1 edit) sorts above "Photography" (2).
  assert.match(close[0]!.label, /photographer/i, close.map((c) => c.label).join(', '));
  const firstPhotography = close.findIndex((c) => c.label === 'Photography');
  const lastPhotographer = close.map((c) => /photographer/i.test(c.label)).lastIndexOf(true);
  assert.ok(firstPhotography === -1 || firstPhotography > lastPhotographer);
});

test('"fotobooth" (squashed + two edits) → Photo Booth', () => {
  const { close } = rankTaxonomyOptionsWithClose(OPTIONS, 'fotobooth');
  assert.ok(close.some((c) => c.key === 'photo_booth'), close.map((c) => c.key).join(', '));
});

test('nonsense → nothing at all, ranked or close', () => {
  for (const q of ['xqzvw', 'qqqqqqqq', 'zzkpt']) {
    const r = rankTaxonomyOptionsWithClose(OPTIONS, q);
    assert.deepEqual(r, { matches: [], close: [] }, q);
  }
});

test('a close match is found through a reviewed ALIAS too', () => {
  const opts = [{ key: 'sorbetes_cart', label: 'Sorbetes Cart', aliases: ['sorbetero'] }];
  assert.equal(rankTaxonomyOptionsWithClose(opts, 'sorbetiro').close[0]?.key, 'sorbetes_cart');
});

test('the budget: none under 4 letters, 1 edit up to 7, 2 beyond — and a 2-letter word never guesses', () => {
  // A5 (7 Nov): 6–7 letters dropped from 2 edits to 1 — at 2, "catring" reached "Choir String Quartet".
  assert.equal(closeMatchBudget(3), 0);
  assert.equal(closeMatchBudget(5), 1);
  assert.equal(closeMatchBudget(7), 1);
  assert.equal(closeMatchBudget(8), 2);
  assert.equal(editDistanceWithin('catring', 'catering', 2), 1);
  assert.equal(editDistanceWithin('photograhper', 'photographer', 2), 1, 'a swap is one edit');
  assert.ok(editDistanceWithin('cake', 'bike', 1) > 1);
  const opts = [{ key: 'dj', label: 'DJ' }];
  assert.deepEqual(rankTaxonomyOptionsWithClose(opts, 'dk').close, []);
  // 5 letters, two edits away → not close.
  assert.deepEqual(rankTaxonomyOptionsWithClose([{ key: 'cakes', label: 'Cakes' }], 'cooks').close, []);
});

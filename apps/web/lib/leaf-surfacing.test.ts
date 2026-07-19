/**
 * Unit suite for the leaf-surfacing re-ranker. Invariants: relevance-first,
 * cross-category diversity (no three-of-a-kind), the cap holds, the exposure
 * floor lifts starved leaves without overriding a clearly-better fit, and the
 * output is deterministic.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { selectDiverseLeaves, type LeafCandidate } from './leaf-surfacing';

const c = (key: string, category: string, relevance: number, timesShown = 0): LeafCandidate => ({
  key, category, relevance, timesShown,
});

test('respects the cap and never returns more than `limit`', () => {
  const cands = [c('a', 'x', 0.9), c('b', 'y', 0.8), c('d', 'z', 0.7), c('e', 'w', 0.6)];
  assert.equal(selectDiverseLeaves(cands, { limit: 2 }).length, 2);
  assert.equal(selectDiverseLeaves(cands, { limit: 3 }).length, 3);
  assert.equal(selectDiverseLeaves([], { limit: 3 }).length, 0);
  assert.equal(selectDiverseLeaves(cands, { limit: 0 }).length, 0);
});

test('relevance-first: the single best candidate is always picked first', () => {
  const cands = [c('low', 'x', 0.2), c('best', 'y', 0.95), c('mid', 'z', 0.5)];
  const out = selectDiverseLeaves(cands, { limit: 1 });
  assert.equal(out[0]!.key, 'best');
});

test('cross-category diversity: avoids three of the same category', () => {
  // Four photographers (high relevance) + one photo booth (lower). With a real
  // diversity pull, the booth should surface instead of a third photographer.
  const cands = [
    c('photog1', 'photography', 0.90),
    c('photog2', 'photography', 0.88),
    c('photog3', 'photography', 0.86),
    c('booth', 'booths', 0.70),
  ];
  const out = selectDiverseLeaves(cands, { limit: 3, lambda: 0.6 });
  const cats = out.map((o) => o.category);
  assert.ok(cats.includes('booths'), 'the distinct category surfaces');
  const photogCount = cats.filter((x) => x === 'photography').length;
  assert.ok(photogCount <= 2, 'no three-of-a-kind photography');
});

test('exposure floor: a never-shown leaf edges out an equally-relevant over-shown one', () => {
  const cands = [
    c('shown', 'x', 0.6, 5), // surfaced a lot already
    c('fresh', 'y', 0.6, 0), // never shown
  ];
  const out = selectDiverseLeaves(cands, { limit: 1, exposureWeight: 0.15 });
  assert.equal(out[0]!.key, 'fresh', 'starved leaf gets the fair-chance boost');
});

test('exposure floor is bounded — it does NOT override a clearly better fit', () => {
  const cands = [
    c('great', 'x', 0.95, 5), // much better fit, shown a lot
    c('weak', 'y', 0.30, 0), // poor fit, never shown
  ];
  const out = selectDiverseLeaves(cands, { limit: 1, exposureWeight: 0.15 });
  assert.equal(out[0]!.key, 'great', 'a big relevance gap still wins');
});

test('deterministic: identical inputs yield identical ordering', () => {
  const cands = [c('a', 'x', 0.7), c('b', 'x', 0.7), c('d', 'y', 0.7)];
  const a = selectDiverseLeaves(cands, { limit: 3 }).map((o) => o.key);
  const b = selectDiverseLeaves(cands, { limit: 3 }).map((o) => o.key);
  assert.deepEqual(a, b);
});

test('handles out-of-range relevance and missing timesShown safely', () => {
  const cands = [
    { key: 'hi', category: 'x', relevance: 5 }, // >1, clamped
    { key: 'lo', category: 'y', relevance: -2 }, // <0, clamped
  ];
  const out = selectDiverseLeaves(cands, { limit: 2 });
  assert.equal(out.length, 2);
  assert.equal(out[0]!.key, 'hi');
});

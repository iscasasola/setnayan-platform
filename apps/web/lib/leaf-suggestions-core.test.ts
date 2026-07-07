/**
 * Unit suite for leaf-suggestion candidate building + ranking. Invariants:
 * event-type gate, already-planned exclusion, only-when-it-fits (zero-vendor
 * leaves never surface), cross-tile diversity, and the cap.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLeafCandidates,
  rankLeafSuggestions,
  type LeafTaxNode,
} from './leaf-suggestions-core';

const leaf = (
  canonicalService: string,
  tileId: string,
  allowedEventTypes: string[] | null = null,
): LeafTaxNode => ({
  canonicalService,
  label: canonicalService,
  tileId,
  tileLabel: tileId,
  allowedEventTypes,
});

const LEAVES: LeafTaxNode[] = [
  leaf('photobooth', 'booths'),
  leaf('mobile_bar', 'feast'),
  leaf('drone', 'documentary'),
  leaf('lechon', 'feast'),
  leaf('wedding_coordinator', 'planning', ['wedding']), // wedding-only
];

const counts = (m: Record<string, number>) => (cs: string) => m[cs] ?? 0;

test('only-when-it-fits: a leaf with zero available vendors never surfaces', () => {
  const cands = buildLeafCandidates(
    LEAVES,
    counts({ photobooth: 3, mobile_bar: 0 }),
    { eventType: 'wedding', plannedTileIds: new Set() },
  );
  const keys = cands.map((c) => c.key);
  assert.ok(keys.includes('photobooth'));
  assert.ok(!keys.includes('mobile_bar'), 'zero-vendor leaf excluded');
});

test('event-type gate: a wedding-only leaf is dropped for a birthday', () => {
  const forBday = buildLeafCandidates(
    LEAVES,
    counts({ wedding_coordinator: 5, photobooth: 2 }),
    { eventType: 'birthday', plannedTileIds: new Set() },
  ).map((c) => c.key);
  assert.ok(!forBday.includes('wedding_coordinator'), 'wedding-only leaf dropped for birthday');
  // null allowedEventTypes leaves still pass
  assert.ok(forBday.includes('photobooth'));
});

test('already-planned tiles are not re-suggested', () => {
  const cands = buildLeafCandidates(
    LEAVES,
    counts({ photobooth: 3, lechon: 4, mobile_bar: 2 }),
    { eventType: 'wedding', plannedTileIds: new Set(['feast']) },
  ).map((c) => c.key);
  assert.ok(cands.includes('photobooth'));
  assert.ok(!cands.includes('lechon'), 'planned tile excluded');
  assert.ok(!cands.includes('mobile_bar'), 'planned tile excluded');
});

test('relevance rises with vendor count and is capped at 1', () => {
  const cands = buildLeafCandidates(
    [leaf('a', 't1'), leaf('b', 't2')],
    counts({ a: 2, b: 50 }),
    { eventType: null, plannedTileIds: new Set() },
  );
  const a = cands.find((c) => c.key === 'a')!;
  const b = cands.find((c) => c.key === 'b')!;
  assert.equal(a.relevance, 0.2);
  assert.equal(b.relevance, 1); // capped
});

test('rankLeafSuggestions: caps output and hydrates labels + counts, diverse tiles', () => {
  const sugg = rankLeafSuggestions(
    LEAVES,
    counts({ photobooth: 3, mobile_bar: 4, drone: 2, lechon: 5 }),
    { eventType: 'wedding', plannedTileIds: new Set(), limit: 2 },
  );
  assert.equal(sugg.length, 2);
  assert.ok(sugg.every((s) => s.vendorCount > 0));
  assert.ok(sugg.every((s) => s.label.length > 0));
  // With cross-tile diversity, two suggestions shouldn't both be the 'feast' tile
  // when other tiles are available.
  const tiles = new Set(sugg.map((s) => s.tileId));
  assert.equal(tiles.size, 2, 'suggestions span distinct tiles');
});

test('empty universe / no fits → no suggestions', () => {
  assert.deepEqual(
    rankLeafSuggestions([], counts({}), { eventType: 'wedding', plannedTileIds: new Set() }),
    [],
  );
  assert.deepEqual(
    rankLeafSuggestions(LEAVES, counts({}), { eventType: 'wedding', plannedTileIds: new Set() }),
    [],
  );
});

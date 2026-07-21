/**
 * `applicable_event_types` NULL semantics — the inconsistency, locked.
 *
 * Migration 20270830256997's header claimed "NULL = universal = fail-open"
 * flat out. True of the vendor + admin paths, FALSE of the suggestion ranker.
 * Rather than silently letting the two drift, both readings live in
 * `taxonomy-event-scope.ts` and are asserted here, so the next person who
 * relies on "fail-open" (owner decision 3 will) finds the exception first.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { leafServesEventType, leafIsSuggestableForEventType } from './taxonomy-event-scope';
import { buildLeafCandidates, type LeafTaxNode } from './leaf-suggestions-core';

const leaf = (canonicalService: string, allowedEventTypes: string[] | null): LeafTaxNode => ({
  canonicalService,
  label: canonicalService,
  tileId: `tile_${canonicalService}`,
  tileLabel: canonicalService,
  allowedEventTypes,
});

test('canonical rule is FAIL-OPEN on NULL / empty', () => {
  assert.equal(leafServesEventType(null, 'birthday'), true);
  assert.equal(leafServesEventType(undefined, 'birthday'), true);
  assert.equal(leafServesEventType([], 'birthday'), true);
  assert.equal(leafServesEventType(['debut'], 'birthday'), false);
  assert.equal(leafServesEventType(['debut'], 'debut'), true);
  // Unknown context can't be filtered.
  assert.equal(leafServesEventType(['debut'], null), true);
});

test('suggestion rule INVERTS on NULL — wedding-only, everything else unchanged', () => {
  assert.equal(leafIsSuggestableForEventType(null, 'wedding'), true);
  assert.equal(leafIsSuggestableForEventType(null, 'birthday'), false);
  assert.equal(leafIsSuggestableForEventType([], 'birthday'), false);
  // A TAGGED leaf behaves identically under both rules — the divergence is
  // strictly the NULL case.
  for (const [allowed, type] of [
    [['debut'], 'debut'],
    [['debut'], 'birthday'],
    [['wedding', 'debut'], 'wedding'],
  ] as const) {
    assert.equal(
      leafIsSuggestableForEventType(allowed, type),
      leafServesEventType(allowed, type),
      `tagged leaves must agree: ${allowed.join('|')} vs ${type}`,
    );
  }
  assert.equal(leafIsSuggestableForEventType(null, null), true);
});

test('the two rules disagree ONLY on untagged leaves + non-wedding events', () => {
  const cases: Array<[string[] | null, string | null]> = [
    [null, 'wedding'],
    [null, 'birthday'],
    [null, null],
    [[], 'corporate'],
    [['wedding'], 'birthday'],
    [['birthday'], 'birthday'],
  ];
  const disagreements = cases.filter(
    ([a, t]) => leafServesEventType(a, t) !== leafIsSuggestableForEventType(a, t),
  );
  assert.deepEqual(
    disagreements.map(([a, t]) => `${a === null ? 'NULL' : `[${a.join(',')}]`}/${t}`),
    ['NULL/birthday', '[]/corporate'],
  );
});

test('the ranker still behaves as documented after the refactor', () => {
  const leaves = [leaf('untagged_leaf', null), leaf('birthday_leaf', ['birthday'])];
  const countFor = () => 5;

  const onBirthday = buildLeafCandidates(leaves, countFor, {
    eventType: 'birthday',
    plannedTileIds: new Set(),
  }).map((c) => c.key);
  assert.deepEqual(onBirthday, ['birthday_leaf'], 'untagged leaf must not be suggested on a birthday');

  const onWedding = buildLeafCandidates(leaves, countFor, {
    eventType: 'wedding',
    plannedTileIds: new Set(),
  }).map((c) => c.key);
  assert.deepEqual(onWedding, ['untagged_leaf'], 'untagged leaf is wedding-only');

  const unknown = buildLeafCandidates(leaves, countFor, {
    eventType: null,
    plannedTileIds: new Set(),
  }).map((c) => c.key);
  assert.deepEqual(unknown, ['untagged_leaf', 'birthday_leaf'], 'unknown event type filters nothing');
});

/**
 * Unit guards for the Taxonomy Studio reorder helpers (Node built-in runner via
 * tsx). Covers the two pure pieces the drag-to-reorder action leans on:
 * validateReorder (the set must be a permutation of the folder's children) and
 * computeReorder (only the moved rows get a write).
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateReorder, computeReorder } from './taxonomy-studio-order';

test('validateReorder accepts a true permutation', () => {
  assert.deepEqual(validateReorder(['a', 'b', 'c'], ['c', 'a', 'b']), { ok: true });
  assert.deepEqual(validateReorder(['a'], ['a']), { ok: true });
});

test('validateReorder rejects an empty order', () => {
  const r = validateReorder(['a', 'b'], []);
  assert.equal(r.ok, false);
});

test('validateReorder rejects a length mismatch (dropped member)', () => {
  const r = validateReorder(['a', 'b', 'c'], ['a', 'b']);
  assert.equal(r.ok, false);
});

test('validateReorder rejects a length mismatch (added member)', () => {
  const r = validateReorder(['a', 'b'], ['a', 'b', 'c']);
  assert.equal(r.ok, false);
});

test('validateReorder rejects a duplicate id', () => {
  const r = validateReorder(['a', 'b'], ['a', 'a']);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.reason, /Duplicate/);
});

test('validateReorder rejects a foreign id (same length, wrong member)', () => {
  const r = validateReorder(['a', 'b', 'c'], ['a', 'b', 'x']);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.reason, /not a child/);
});

test('computeReorder writes only the rows that moved', () => {
  // Current: a=0 b=1 c=2. New order swaps a and c → a=2, c=0; b unchanged.
  const writes = computeReorder(['c', 'b', 'a'], { a: 0, b: 1, c: 2 });
  assert.deepEqual(writes.sort((x, y) => x.id.localeCompare(y.id)), [
    { id: 'a', sort_order: 2 },
    { id: 'c', sort_order: 0 },
  ]);
});

test('computeReorder returns nothing when order is unchanged', () => {
  const writes = computeReorder(['a', 'b', 'c'], { a: 0, b: 1, c: 2 });
  assert.deepEqual(writes, []);
});

test('computeReorder treats a missing current sort as "needs write"', () => {
  // No existing sort for b → any target index differs from undefined → written.
  const writes = computeReorder(['a', 'b'], { a: 0 });
  assert.deepEqual(writes, [{ id: 'b', sort_order: 1 }]);
});

test('computeReorder densifies sparse sort_orders to 0..n-1', () => {
  // Existing sorts are 10/20/30 but positions are already correct → all rewritten
  // to the dense 0/1/2 index (10 !== 0, etc.).
  const writes = computeReorder(['a', 'b', 'c'], { a: 10, b: 20, c: 30 });
  assert.deepEqual(writes, [
    { id: 'a', sort_order: 0 },
    { id: 'b', sort_order: 1 },
    { id: 'c', sort_order: 2 },
  ]);
});

// ── Refinement reorder reuse ────────────────────────────────────────────────────
// reorderRefinementLeaves / reorderRefinementOptions share the SAME pure helpers
// as the tile reorder — the members happen to be leaf_keys / option_keys. These
// guards pin the permutation semantics for the refinement case so a regression in
// the shared helper can't silently accept a dropped/added/foreign option key.

test('validateReorder pins option-permutation semantics (leaf_key / option_key set)', () => {
  const current = ['cuisine_filipino', 'cuisine_chinese', 'cuisine_american'];
  // A true shuffle of the option keys is accepted.
  assert.deepEqual(
    validateReorder(current, ['cuisine_chinese', 'cuisine_american', 'cuisine_filipino']),
    { ok: true },
  );
  // A dropped option key (deleting via reorder) is rejected — reorder never drops.
  assert.equal(validateReorder(current, ['cuisine_filipino', 'cuisine_chinese']).ok, false);
  // A foreign / label-derived key (immutable-key violation via a tampered POST) is rejected.
  const foreign = validateReorder(current, [
    'cuisine_filipino',
    'cuisine_chinese',
    'cuisine_NEW',
  ]);
  assert.equal(foreign.ok, false);
  if (!foreign.ok) assert.match(foreign.reason, /not a child/);
});

test('computeReorder emits minimal option writes for a two-key swap', () => {
  // Swap the first two options in a 3-option leaf → only those two get a write.
  const writes = computeReorder(['b', 'a', 'c'], { a: 0, b: 1, c: 2 });
  assert.deepEqual(writes.sort((x, y) => x.id.localeCompare(y.id)), [
    { id: 'a', sort_order: 1 },
    { id: 'b', sort_order: 0 },
  ]);
});

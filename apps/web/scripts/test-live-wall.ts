/**
 * scripts/test-live-wall.ts — unit suite for the Salamisim Live Photo Wall
 * pure logic (lib/live-wall-logic.ts): tile merge/reconcile, cursor math,
 * lifecycle mode resolution, display-code generation.
 *
 * Run: pnpm exec tsx scripts/test-live-wall.ts   (from apps/web)
 * House pattern: node:assert + tsx, zero deps, no browser, no DB.
 */

import assert from 'node:assert/strict';

import {
  DISPLAY_CODE_ALPHABET,
  DISPLAY_CODE_LENGTH,
  displayCodeFrom,
  latestCursor,
  mergeTiles,
  reconcileTiles,
  resolveWallMode,
  type WallTile,
} from '../lib/live-wall-logic';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    failures.push(name);
    console.error(`  ✗ ${name}\n    ${(err as Error).message}`);
  }
}

const tile = (feedId: string, sortAt: string): WallTile => ({
  feedId,
  url: `https://r2/${feedId}`,
  widthPx: 800,
  heightPx: 600,
  sortAt,
});

console.log('live-wall logic test suite\n');

// ── mergeTiles ──────────────────────────────────────────────────────────────

test('merge: appends fresh tiles in sort order', () => {
  const a = tile('a', '2026-06-11T10:00:00Z');
  const c = tile('c', '2026-06-11T10:02:00Z');
  const b = tile('b', '2026-06-11T10:01:00Z');
  const out = mergeTiles([a, c], [b]);
  assert.deepEqual(out.map((t) => t.feedId), ['a', 'b', 'c']);
});

test('merge: dedupes by feedId — existing object identity wins (stable keys)', () => {
  const a = tile('a', '2026-06-11T10:00:00Z');
  const dupe = tile('a', '2026-06-11T10:00:00Z');
  const out = mergeTiles([a], [dupe, tile('b', '2026-06-11T10:01:00Z')]);
  assert.equal(out.length, 2);
  assert.equal(out[0], a, 'kept the ORIGINAL object, not the dupe');
});

test('merge: no incoming → same array instance (React bail-out)', () => {
  const existing = [tile('a', '2026-06-11T10:00:00Z')];
  assert.equal(mergeTiles(existing, []), existing);
  assert.equal(mergeTiles(existing, [tile('a', '2026-06-11T10:00:00Z')]), existing);
});

// ── reconcileTiles ──────────────────────────────────────────────────────────

test('reconcile: drops retracted tiles (the kill switch lands on the sweep)', () => {
  const a = tile('a', '2026-06-11T10:00:00Z');
  const b = tile('b', '2026-06-11T10:01:00Z');
  const { tiles, removed } = reconcileTiles([a, b], [a]);
  assert.deepEqual(tiles.map((t) => t.feedId), ['a']);
  assert.equal(removed, 1);
});

test('reconcile: adds missed tiles + preserves identity of unchanged ones', () => {
  const a = tile('a', '2026-06-11T10:00:00Z');
  const fullA = tile('a', '2026-06-11T10:00:00Z');
  const fullB = tile('b', '2026-06-11T10:01:00Z');
  const { tiles, added } = reconcileTiles([a], [fullA, fullB]);
  assert.equal(added, 1);
  assert.equal(tiles[0], a, 'unchanged tile keeps its ORIGINAL identity (no re-animate)');
  assert.equal(tiles[1], fullB);
});

test('reconcile: identical set → the SAME array instance back', () => {
  const a = tile('a', '2026-06-11T10:00:00Z');
  const existing = [a];
  const { tiles, removed, added } = reconcileTiles(existing, [tile('a', '2026-06-11T10:00:00Z')]);
  assert.equal(tiles, existing);
  assert.equal(removed + added, 0);
});

// ── latestCursor ────────────────────────────────────────────────────────────

test('cursor: picks the max sortAt; falls back when empty', () => {
  const fb = '1970-01-01T00:00:00Z';
  assert.equal(latestCursor([], fb), fb);
  assert.equal(
    latestCursor([tile('a', '2026-06-11T10:00:00Z'), tile('b', '2026-06-11T11:00:00Z')], fb),
    '2026-06-11T11:00:00Z',
  );
});

// ── resolveWallMode ─────────────────────────────────────────────────────────

test('mode: the couple override always wins', () => {
  assert.equal(resolveWallMode('live', 'inactive'), 'live');
  assert.equal(resolveWallMode('archive', 'live'), 'archive');
});

test('mode: day-of phases map onto the wall vocabulary', () => {
  assert.equal(resolveWallMode(null, 'live'), 'live');
  assert.equal(resolveWallMode(null, 'post'), 'recap');
  assert.equal(resolveWallMode(null, 'pre'), 'pre_event');
  assert.equal(resolveWallMode(undefined, 'inactive'), 'coming_soon');
});

// ── display codes ───────────────────────────────────────────────────────────

test(`code: ${DISPLAY_CODE_LENGTH} chars, alphabet has no ambiguous symbols`, () => {
  for (const bad of ['I', 'L', 'O', 'U', '0', '1']) {
    assert.ok(!DISPLAY_CODE_ALPHABET.includes(bad), `alphabet must exclude ${bad}`);
  }
  const code = displayCodeFrom(Uint8Array.from([0, 27, 54, 81, 108, 135]));
  assert.equal(code.length, DISPLAY_CODE_LENGTH);
  for (const ch of code) assert.ok(DISPLAY_CODE_ALPHABET.includes(ch));
});

test('code: deterministic from injected randomness (testable generator)', () => {
  const bytes = Uint8Array.from([1, 2, 3, 4, 5, 6]);
  assert.equal(displayCodeFrom(bytes), displayCodeFrom(bytes));
});

// ── results ──

console.log(`\n${passed} passed · ${failed} failed${failed ? ` → ${failures.join(', ')}` : ''}`);
if (failed > 0) process.exit(1);

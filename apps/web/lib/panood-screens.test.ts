/**
 * Panood venue-screen data-layer invariants (Node built-in test runner, run via
 * tsx). Guards the pure, deterministic behaviors of lib/panood-screens.ts — the
 * half of the screen-registry layer that doesn't touch Supabase:
 *
 *   1. PAIRING CODE — generateScreenPairingCode() is a 6-char, uppercase,
 *      unambiguous-alphabet (no I/L/O/U) human-typed code, and never collides
 *      across calls (it's the code a TV/stick types beside the QR).
 *   2. PROVISIONING — missingScreenIndexes() computes the correct dense top-up
 *      set (the pure core of provisionPanoodScreensAdmin).
 *   3. PAIR URL — panoodScreenPairUrl() builds the right /wall?code=<code> URL
 *      and tolerates a trailing slash on the app URL.
 *   4. SET SOURCE — setPanoodScreenSourceAdmin() updates current_source and
 *      returns true/false on the right shapes (best-effort, never throws).
 *   5. GRACEFUL-DEGRADE — fetchPanoodScreens() returns [] on a missing table
 *      (42P01) / column (42703) instead of throwing.
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchPanoodScreens,
  generateScreenPairingCode,
  missingScreenIndexes,
  panoodScreenPairUrl,
  setPanoodScreenSourceAdmin,
} from './panood-screens';

// ── 1. Pairing code ──────────────────────────────────────────────────────────

test('generateScreenPairingCode is a 6-char uppercase Crockford code (no I/L/O/U)', () => {
  for (let i = 0; i < 500; i += 1) {
    const c = generateScreenPairingCode();
    assert.equal(c.length, 6, `code "${c}" is not 6 chars`);
    // Unambiguous alphabet: digits + A–Z minus I, L, O, U.
    assert.match(c, /^[0-9A-HJKMNP-TV-Z]+$/, `code "${c}" uses an ambiguous/illegal char`);
    assert.equal(c, c.toUpperCase(), `code "${c}" is not uppercase`);
    assert.ok(!/[ILOU]/.test(c), `code "${c}" contains an ambiguous char (I/L/O/U)`);
  }
});

test('generateScreenPairingCode is unique across calls', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 5000; i += 1) seen.add(generateScreenPairingCode());
  // 5000 draws from a 32^6 (~1.07e9) space — collisions are vanishingly unlikely.
  assert.equal(seen.size, 5000, 'pairing code collision detected');
});

// ── 2. Provisioning (pure missing-index logic) ───────────────────────────────

test('missingScreenIndexes: empty event needs the full dense set 1..count', () => {
  assert.deepEqual(missingScreenIndexes([], 4), [1, 2, 3, 4]);
});

test('missingScreenIndexes: fully provisioned event is a no-op', () => {
  assert.deepEqual(missingScreenIndexes([1, 2, 3], 3), []);
});

test('missingScreenIndexes: partial top-up fills only the gaps', () => {
  assert.deepEqual(missingScreenIndexes([1, 3], 4), [2, 4]);
});

test('missingScreenIndexes: out-of-range existing indexes never block the 1..count top-up', () => {
  assert.deepEqual(missingScreenIndexes([101, 0, 1], 3), [2, 3]);
});

test('missingScreenIndexes: count of 0 yields nothing', () => {
  assert.deepEqual(missingScreenIndexes([], 0), []);
});

// ── 3. Pair URL ──────────────────────────────────────────────────────────────

test('panoodScreenPairUrl builds the /wall?code=<code> URL', () => {
  assert.equal(
    panoodScreenPairUrl('https://app.setnayan.com', 'ABC234'),
    'https://app.setnayan.com/wall?code=ABC234',
  );
});

test('panoodScreenPairUrl tolerates a trailing slash on the app URL', () => {
  assert.equal(
    panoodScreenPairUrl('https://app.setnayan.com/', 'ABC234'),
    'https://app.setnayan.com/wall?code=ABC234',
  );
});

test('panoodScreenPairUrl URL-encodes the code', () => {
  assert.equal(
    panoodScreenPairUrl('https://app.setnayan.com', 'A B&C'),
    'https://app.setnayan.com/wall?code=A%20B%26C',
  );
});

// ── 4. Set source ────────────────────────────────────────────────────────────

// Minimal Supabase update-builder stub: the awaited builder resolves to a
// PostgREST-style { error } payload, and it records the update payload so the
// test can assert the shape written.
function fakeUpdateSupabase(result: { error: unknown }) {
  const calls: { update?: unknown } = {};
  const builder: Record<string, unknown> = {
    update: (payload: unknown) => {
      calls.update = payload;
      return builder;
    },
    eq: () => Promise.resolve(result),
  };
  return {
    supabase: { from: () => builder } as unknown as Parameters<typeof setPanoodScreenSourceAdmin>[0],
    calls,
  };
}

test('setPanoodScreenSourceAdmin writes current_source + updated_at and returns true', async () => {
  const { supabase, calls } = fakeUpdateSupabase({ error: null });
  const ok = await setPanoodScreenSourceAdmin(supabase, 7, 'cam2');
  assert.equal(ok, true);
  const payload = calls.update as Record<string, unknown>;
  assert.equal(payload.current_source, 'cam2');
  assert.equal(typeof payload.updated_at, 'string');
});

test('setPanoodScreenSourceAdmin returns false on a DB error (never throws)', async () => {
  const { supabase } = fakeUpdateSupabase({ error: { code: '08006', message: 'connection failure' } });
  assert.equal(await setPanoodScreenSourceAdmin(supabase, 7, 'photos'), false);
});

test('setPanoodScreenSourceAdmin rejects bad input without touching the DB', async () => {
  const { supabase, calls } = fakeUpdateSupabase({ error: null });
  assert.equal(await setPanoodScreenSourceAdmin(supabase, 0, 'photos'), false);
  assert.equal(await setPanoodScreenSourceAdmin(supabase, 7, ''), false);
  assert.equal(calls.update, undefined, 'no update should be attempted on bad input');
});

// ── 5. Graceful-degrade ──────────────────────────────────────────────────────

// Minimal Supabase query-builder stub that resolves the awaited builder to a
// PostgREST-style { data, error } payload — same fake-builder shape the
// panood-camera-seats reads expect.
function fakeSupabase(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    order: () => Promise.resolve(result),
  };
  return { from: () => builder } as unknown as Parameters<typeof fetchPanoodScreens>[0];
}

test('fetchPanoodScreens returns [] when the table is missing (42P01)', async () => {
  const supabase = fakeSupabase({ data: null, error: { code: '42P01', message: 'undefined_table' } });
  assert.deepEqual(await fetchPanoodScreens(supabase, 'evt-1'), []);
});

test('fetchPanoodScreens returns [] when a column is missing (42703)', async () => {
  const supabase = fakeSupabase({ data: null, error: { code: '42703', message: 'undefined_column' } });
  assert.deepEqual(await fetchPanoodScreens(supabase, 'evt-1'), []);
});

test('fetchPanoodScreens throws on an unexpected error', async () => {
  const supabase = fakeSupabase({ data: null, error: { code: '08006', message: 'connection failure' } });
  await assert.rejects(() => fetchPanoodScreens(supabase, 'evt-1'), /connection failure/);
});

test('fetchPanoodScreens passes rows through on success', async () => {
  const rows = [{ id: 1, screen_index: 1 }];
  const supabase = fakeSupabase({ data: rows, error: null });
  assert.deepEqual(await fetchPanoodScreens(supabase, 'evt-1'), rows);
});

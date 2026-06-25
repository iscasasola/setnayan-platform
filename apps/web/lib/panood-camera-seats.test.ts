/**
 * Panood camera-operator data-layer invariants (Node built-in test runner, run
 * via tsx). Guards the pure, deterministic behaviors of lib/panood-camera-seats.ts
 * — the half of the camera-claim layer that doesn't touch Supabase:
 *
 *   1. TOKEN — generateCameraClaimToken() is URL-safe, has enough entropy to be
 *      unguessable, and never collides across calls (it's the only secret
 *      guarding the login-free /panood/cam/[token] claim route).
 *   2. PROVISIONING — missingCameraIndexes() computes the correct dense
 *      top-up set (the pure core of provisionPanoodCamerasAdmin).
 *   3. CLAIM URL — panoodCameraClaimUrl() builds the right /panood/cam/[token]
 *      path and tolerates a trailing slash on the app URL.
 *   4. GRACEFUL-DEGRADE — fetchPanoodCameras() returns [] on a missing table
 *      (42P01) / column (42703) instead of throwing.
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchPanoodCameras,
  generateCameraClaimToken,
  missingCameraIndexes,
  panoodCameraClaimUrl,
} from './panood-camera-seats';

// ── 1. Token ────────────────────────────────────────────────────────────────

test('generateCameraClaimToken is URL-safe (base64url, no + / = )', () => {
  for (let i = 0; i < 200; i += 1) {
    const t = generateCameraClaimToken();
    assert.match(t, /^[A-Za-z0-9_-]+$/, `token "${t}" is not URL-safe`);
    assert.ok(!t.includes('='), 'token must be unpadded');
  }
});

test('generateCameraClaimToken carries unguessable entropy (≈32 chars from 24 bytes)', () => {
  const t = generateCameraClaimToken();
  // 24 bytes base64url, padding stripped → 32 chars.
  assert.equal(t.length, 32);
});

test('generateCameraClaimToken is unique across calls', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 5000; i += 1) seen.add(generateCameraClaimToken());
  assert.equal(seen.size, 5000, 'token collision detected');
});

// ── 2. Provisioning (pure missing-index logic) ───────────────────────────────

test('missingCameraIndexes: empty event needs the full dense set 1..count', () => {
  assert.deepEqual(missingCameraIndexes([], 4), [1, 2, 3, 4]);
});

test('missingCameraIndexes: fully provisioned event is a no-op', () => {
  assert.deepEqual(missingCameraIndexes([1, 2, 3], 3), []);
});

test('missingCameraIndexes: partial top-up fills only the gaps', () => {
  assert.deepEqual(missingCameraIndexes([1, 3], 4), [2, 4]);
});

test('missingCameraIndexes: out-of-range existing indexes never block the 1..count top-up', () => {
  // 101 (a sampler-style high index) and 0 can't collide with 1..3.
  assert.deepEqual(missingCameraIndexes([101, 0, 1], 3), [2, 3]);
});

test('missingCameraIndexes: count of 0 yields nothing', () => {
  assert.deepEqual(missingCameraIndexes([], 0), []);
});

// ── 3. Claim URL ─────────────────────────────────────────────────────────────

test('panoodCameraClaimUrl builds the /panood/cam/[token] path', () => {
  assert.equal(
    panoodCameraClaimUrl('https://app.setnayan.com', 'abc123'),
    'https://app.setnayan.com/panood/cam/abc123',
  );
});

test('panoodCameraClaimUrl tolerates a trailing slash on the app URL', () => {
  assert.equal(
    panoodCameraClaimUrl('https://app.setnayan.com/', 'abc123'),
    'https://app.setnayan.com/panood/cam/abc123',
  );
});

test('panoodCameraClaimUrl URL-encodes the token', () => {
  assert.equal(
    panoodCameraClaimUrl('https://app.setnayan.com', 'a b/c'),
    'https://app.setnayan.com/panood/cam/a%20b%2Fc',
  );
});

// ── 4. Graceful-degrade ──────────────────────────────────────────────────────

// Minimal Supabase query-builder stub that resolves the awaited builder to a
// PostgREST-style { data, error } payload — same fake-builder shape papic-seats
// reads expect.
function fakeSupabase(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    order: () => Promise.resolve(result),
  };
  return { from: () => builder } as unknown as Parameters<typeof fetchPanoodCameras>[0];
}

test('fetchPanoodCameras returns [] when the table is missing (42P01)', async () => {
  const supabase = fakeSupabase({ data: null, error: { code: '42P01', message: 'undefined_table' } });
  assert.deepEqual(await fetchPanoodCameras(supabase, 'evt-1'), []);
});

test('fetchPanoodCameras returns [] when a column is missing (42703)', async () => {
  const supabase = fakeSupabase({ data: null, error: { code: '42703', message: 'undefined_column' } });
  assert.deepEqual(await fetchPanoodCameras(supabase, 'evt-1'), []);
});

test('fetchPanoodCameras throws on an unexpected error', async () => {
  const supabase = fakeSupabase({ data: null, error: { code: '08006', message: 'connection failure' } });
  await assert.rejects(() => fetchPanoodCameras(supabase, 'evt-1'), /connection failure/);
});

test('fetchPanoodCameras passes rows through on success', async () => {
  const rows = [{ id: 1, camera_index: 1 }];
  const supabase = fakeSupabase({ data: rows, error: null });
  assert.deepEqual(await fetchPanoodCameras(supabase, 'evt-1'), rows);
});

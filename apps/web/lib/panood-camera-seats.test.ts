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
  fetchClaimedCameraForUser,
  fetchPanoodCameras,
  generateCameraClaimToken,
  missingCameraIndexes,
  panoodCameraAnonEnabled,
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
  // 101 (a high index) and 0 can't collide with 1..3.
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

// ── 5. Login-free flag (PR5) ─────────────────────────────────────────────────

test('panoodCameraAnonEnabled is OFF by default (env unset)', () => {
  const prev = process.env.NEXT_PUBLIC_PANOOD_CAM_ANON_ENABLED;
  delete process.env.NEXT_PUBLIC_PANOOD_CAM_ANON_ENABLED;
  assert.equal(panoodCameraAnonEnabled(), false);
  if (prev !== undefined) process.env.NEXT_PUBLIC_PANOOD_CAM_ANON_ENABLED = prev;
});

test('panoodCameraAnonEnabled is ON only for the exact "true" string', () => {
  const prev = process.env.NEXT_PUBLIC_PANOOD_CAM_ANON_ENABLED;
  process.env.NEXT_PUBLIC_PANOOD_CAM_ANON_ENABLED = 'true';
  assert.equal(panoodCameraAnonEnabled(), true);
  process.env.NEXT_PUBLIC_PANOOD_CAM_ANON_ENABLED = '1';
  assert.equal(panoodCameraAnonEnabled(), false, '"1" must not enable the flag');
  process.env.NEXT_PUBLIC_PANOOD_CAM_ANON_ENABLED = 'TRUE';
  assert.equal(panoodCameraAnonEnabled(), false, 'case-sensitive — only "true"');
  if (prev === undefined) delete process.env.NEXT_PUBLIC_PANOOD_CAM_ANON_ENABLED;
  else process.env.NEXT_PUBLIC_PANOOD_CAM_ANON_ENABLED = prev;
});

// ── 6. fetchClaimedCameraForUser — post-claim view scoping (PR5) ──────────────
//
// A maybeSingle()-shaped fake builder: the awaited builder resolves to a
// PostgREST { data, error } payload. The helper must ONLY return a camera that
// is (a) live (not revoked), and (b) bound to THIS user — never leak another
// operator's camera or the secret token.
function fakeAdmin(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve(result),
  };
  return { from: () => builder } as unknown as Parameters<typeof fetchClaimedCameraForUser>[0];
}

test('fetchClaimedCameraForUser returns the camera when it is bound to this user', async () => {
  const admin = fakeAdmin({
    data: {
      camera_index: 2,
      label: 'Stage left',
      event_id: 'evt-1',
      status: 'live',
      claimer_user_id: 'user-1',
      revoked_at: null,
    },
    error: null,
  });
  assert.deepEqual(await fetchClaimedCameraForUser(admin, 'tok', 'user-1'), {
    camera_index: 2,
    label: 'Stage left',
    event_id: 'evt-1',
    status: 'live',
  });
});

test('fetchClaimedCameraForUser returns null when bound to a DIFFERENT user (no leak)', async () => {
  const admin = fakeAdmin({
    data: {
      camera_index: 2,
      label: 'Stage left',
      event_id: 'evt-1',
      status: 'live',
      claimer_user_id: 'someone-else',
      revoked_at: null,
    },
    error: null,
  });
  assert.equal(await fetchClaimedCameraForUser(admin, 'tok', 'user-1'), null);
});

test('fetchClaimedCameraForUser returns null for a revoked camera even if bound to this user', async () => {
  const admin = fakeAdmin({
    data: {
      camera_index: 2,
      label: null,
      event_id: 'evt-1',
      status: 'revoked',
      claimer_user_id: 'user-1',
      revoked_at: '2026-06-26T00:00:00Z',
    },
    error: null,
  });
  assert.equal(await fetchClaimedCameraForUser(admin, 'tok', 'user-1'), null);
});

test('fetchClaimedCameraForUser returns null on a missing row / error / blank input', async () => {
  assert.equal(
    await fetchClaimedCameraForUser(fakeAdmin({ data: null, error: null }), 'tok', 'user-1'),
    null,
  );
  assert.equal(
    await fetchClaimedCameraForUser(
      fakeAdmin({ data: null, error: { code: '42P01' } }),
      'tok',
      'user-1',
    ),
    null,
  );
  // Blank token / user short-circuit before any read.
  assert.equal(await fetchClaimedCameraForUser(fakeAdmin({ data: null, error: null }), '', 'user-1'), null);
  assert.equal(await fetchClaimedCameraForUser(fakeAdmin({ data: null, error: null }), 'tok', ''), null);
});

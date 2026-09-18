/**
 * LAU-40 / DAY-32#4: the guest-session cookie is minted once (redeem, seat
 * claim, QR rotation) and never re-set on an ordinary page read, so an
 * actively-returning guest can still hit the flat 60-day expiry and be
 * logged out mid-event.
 *
 * The fix is a sliding-window refresh applied in middleware.ts
 * (refreshGuestSessionCookie): once a verified cookie has less than half its
 * max age left, re-sign the SAME payload with a fresh 60-day expiry.
 * middleware.ts itself pulls in `next/server`, so — matching this repo's
 * convention (see supabase/middleware-has-a-deadline.test.ts) — these tests
 * exercise the extracted, DB-free logic in guest-session.ts directly:
 * shouldRefreshGuestSession() (the pure decision) and
 * verifyGuestSessionToken() (the signature check that hands it an `exp`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  GUEST_SESSION_COOKIE_MAX_AGE_SECONDS,
  shouldRefreshGuestSession,
  signGuestSession,
  verifyGuestSessionToken,
} from './guest-session';

const PAYLOAD = { guest_id: 'S89G-TESTGUEST', event_id: 'S89E-TESTEVENT', qr_token: 'qr-abc' };
const DEDICATED = 'a'.repeat(64);

async function withEnv(
  patch: Record<string, string | undefined>,
  fn: () => Promise<void>,
): Promise<void> {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(patch)) saved[k] = process.env[k];
  try {
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const NOW_MS = Date.parse('2026-09-18T00:00:00Z');
const DAY_S = 60 * 60 * 24;

test('a freshly minted cookie (60 days left) is NOT refreshed', () => {
  const expiresAtSeconds = NOW_MS / 1000 + GUEST_SESSION_COOKIE_MAX_AGE_SECONDS;
  assert.equal(shouldRefreshGuestSession(expiresAtSeconds, NOW_MS), false);
});

test('a cookie with exactly 30 days left is at the boundary — not yet refreshed', () => {
  const expiresAtSeconds = NOW_MS / 1000 + GUEST_SESSION_COOKIE_MAX_AGE_SECONDS / 2;
  assert.equal(shouldRefreshGuestSession(expiresAtSeconds, NOW_MS), false);
});

test('a cookie with 29 days left — inside the post-event window — IS refreshed', () => {
  const expiresAtSeconds = NOW_MS / 1000 + GUEST_SESSION_COOKIE_MAX_AGE_SECONDS / 2 - DAY_S;
  assert.equal(shouldRefreshGuestSession(expiresAtSeconds, NOW_MS), true);
});

test('an already-expired cookie is also "refresh due" — the caller still gates on a successful verify first', () => {
  const expiresAtSeconds = NOW_MS / 1000 - DAY_S;
  assert.equal(shouldRefreshGuestSession(expiresAtSeconds, NOW_MS), true);
});

test('verifyGuestSessionToken round-trips a real signed cookie and surfaces its exp', async () => {
  await withEnv({ GUEST_SESSION_SECRET: DEDICATED, SUPABASE_SERVICE_ROLE_KEY: undefined }, async () => {
    const jwt = await signGuestSession(PAYLOAD);
    const verified = await verifyGuestSessionToken(jwt);
    assert.ok(verified);
    assert.deepEqual(verified!.payload, PAYLOAD);
    // Minted just now with a 60-day lifetime — exp should be ~60 days out,
    // not the un-refreshed value a stale re-sign would produce.
    const remaining = verified!.expiresAtSeconds - Date.now() / 1000;
    assert.ok(
      Math.abs(remaining - GUEST_SESSION_COOKIE_MAX_AGE_SECONDS) < 10,
      `expected ~${GUEST_SESSION_COOKIE_MAX_AGE_SECONDS}s remaining, got ${remaining}s`,
    );
  });
});

test('verifyGuestSessionToken refuses a forged token — refresh must never extend a fake', async () => {
  await withEnv({ GUEST_SESSION_SECRET: DEDICATED, SUPABASE_SERVICE_ROLE_KEY: undefined }, async () => {
    assert.equal(await verifyGuestSessionToken('not-a-real-jwt'), null);
  });
});

test('verifyGuestSessionToken refuses a token signed under a different secret', async () => {
  let jwt = '';
  await withEnv({ GUEST_SESSION_SECRET: DEDICATED, SUPABASE_SERVICE_ROLE_KEY: undefined }, async () => {
    jwt = await signGuestSession(PAYLOAD);
  });
  await withEnv({ GUEST_SESSION_SECRET: 'b'.repeat(64), SUPABASE_SERVICE_ROLE_KEY: undefined }, async () => {
    assert.equal(await verifyGuestSessionToken(jwt), null);
  });
});

test('a round trip through refresh extends the expiry back out to the full window', async () => {
  await withEnv({ GUEST_SESSION_SECRET: DEDICATED, SUPABASE_SERVICE_ROLE_KEY: undefined }, async () => {
    const original = await signGuestSession(PAYLOAD);
    const verified = await verifyGuestSessionToken(original);
    assert.ok(verified);

    // Simulate what refreshGuestSessionCookie() does once shouldRefreshGuestSession
    // says yes: re-sign the SAME payload.
    const refreshed = await signGuestSession(verified!.payload);
    const reVerified = await verifyGuestSessionToken(refreshed);
    assert.ok(reVerified);
    assert.deepEqual(reVerified!.payload, PAYLOAD);
    const remaining = reVerified!.expiresAtSeconds - Date.now() / 1000;
    assert.ok(
      Math.abs(remaining - GUEST_SESSION_COOKIE_MAX_AGE_SECONDS) < 10,
      'refreshed cookie should be back to a full 60-day window',
    );
  });
});

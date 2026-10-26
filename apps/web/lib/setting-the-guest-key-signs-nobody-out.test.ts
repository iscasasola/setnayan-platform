/**
 * SETTING GUEST_SESSION_SECRET SIGNS NOBODY OUT (2026-10-25).
 *
 * Production has no dedicated GUEST_SESSION_SECRET, so every live guest cookie
 * is sealed with SUPABASE_SERVICE_ROLE_KEY. Setting the dedicated key used to
 * fail every one of them at once. Now: SIGN only with the dedicated key; VERIFY
 * with it first and the service-role key second (the LEGACY verifier); and
 * re-issue a legacy-verified pass under the dedicated key on the same response
 * (`guestPassRefreshFor`, applied by middleware.ts). The rule and when the legacy
 * verifier may be retired: lib/guest-session.ts, "SETTING THE DEDICATED KEY…".
 *
 * Each test was broken on purpose once to prove it can fail (see the PR body).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT, jwtVerify } from 'jose';

import {
  GUEST_SESSION_COOKIE_MAX_AGE_SECONDS,
  guestPassRefreshFor,
  guestSessionVerifyMaterials,
  resolveGuestSessionVerifiers,
  signGuestPassBook,
  signGuestSession,
  signGuestSessionUntil,
  verifyGuestPassBook,
  verifyGuestSessionToken,
} from './guest-session';

const PAYLOAD = { guest_id: 'S89G-TESTGUEST', event_id: 'S89E-TESTEVENT', qr_token: 'qr-abc' };
const DEDICATED = 'd'.repeat(64);
const SERVICE_ROLE = `sb_secret_${'s'.repeat(40)}`;
const STRANGER = 'x'.repeat(64);

async function withEnv(patch: Record<string, string | undefined>, fn: () => Promise<void>): Promise<void> {
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

const TODAY = { GUEST_SESSION_SECRET: undefined, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE };
const KEY_SET = { GUEST_SESSION_SECRET: DEDICATED, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE };

async function verifiesUnder(jwt: string, key: string): Promise<boolean> {
  try {
    await jwtVerify(jwt, new TextEncoder().encode(key));
    return true;
  } catch {
    return false;
  }
}

/** A cookie exactly as production mints it today: no dedicated key, sealed with the service-role key. */
async function legacyCookie(expSeconds?: number): Promise<string> {
  let jwt = '';
  await withEnv(TODAY, async () => {
    jwt = expSeconds ? await signGuestSessionUntil(PAYLOAD, expSeconds) : await signGuestSession(PAYLOAD);
  });
  return jwt;
}

async function quietly<T>(fn: () => Promise<T>): Promise<{ value: T; info: string[]; warn: string[] }> {
  const info: string[] = [];
  const warn: string[] = [];
  const oi = console.info;
  const ow = console.warn;
  console.info = (...a: unknown[]) => void info.push(a.map(String).join(' '));
  console.warn = (...a: unknown[]) => void warn.push(a.map(String).join(' '));
  try {
    return { value: await fn(), info, warn };
  } finally {
    console.info = oi;
    console.warn = ow;
  }
}

test('(a) a cookie sealed with the service-role key still verifies once the dedicated key is set — and is re-sealed with the dedicated key', async () => {
  const exp = Math.floor(Date.now() / 1000) + 50 * 24 * 60 * 60; // 50 days left: NOT due for the sliding refresh
  const old = await legacyCookie(exp);
  await withEnv(KEY_SET, async () => {
    const verified = await verifyGuestSessionToken(old);
    assert.ok(verified, 'the guest was signed out by setting the key');
    assert.deepEqual(verified!.payload, PAYLOAD);
    assert.equal(verified!.legacySeal, true, 'a legacy-sealed pass must say so, or it is never re-sealed');

    const { value: next, info } = await quietly(() => guestPassRefreshFor({ jar: { active: old } }));
    assert.ok(next.active, 'a legacy-sealed pass was not re-issued');
    assert.equal(await verifiesUnder(next.active!.value, DEDICATED), true, 're-issued pass is not sealed with the dedicated key');
    assert.equal(await verifiesUnder(next.active!.value, SERVICE_ROLE), false, 're-issued pass is still sealed with the service-role key');

    const again = await verifyGuestSessionToken(next.active!.value);
    assert.deepEqual(again!.payload, PAYLOAD, 'the re-seal changed who the pass is');
    assert.equal(again!.legacySeal, false);
    assert.equal(again!.expiresAtSeconds, exp, 'a re-seal must keep the pass’s own expiry');

    // Logged by NAME, never by value.
    assert.ok(info.some((l) => l.includes('re-sealed a guest pass') && l.includes('SUPABASE_SERVICE_ROLE_KEY')), info.join('\n'));
    assert.ok(!info.join('\n').includes(SERVICE_ROLE) && !info.join('\n').includes(DEDICATED), 'a seal VALUE reached the log');

    // A re-sealed pass is not re-sealed again on the next visit (no write at all).
    const { value: settled } = await quietly(() => guestPassRefreshFor({ jar: { active: next.active!.value } }));
    assert.equal(settled.active, null);
  });
});

test('(a) the pass book sealed with the service-role key is re-sealed too, its passes unchanged', async () => {
  const exp = Math.floor(Date.now() / 1000) + 40 * 24 * 60 * 60;
  let oldBook = '';
  await withEnv(TODAY, async () => {
    oldBook = await signGuestPassBook([{ ...PAYLOAD, exp, slug: 'cale-ice' }]);
  });
  await withEnv(KEY_SET, async () => {
    assert.equal((await verifyGuestPassBook(oldBook)).length, 1, 'the pass book went empty when the key was set');
    const { value: next } = await quietly(() => guestPassRefreshFor({ jar: { book: oldBook } }));
    assert.ok(next.book && next.book !== 'keep', 'a legacy-sealed book was not re-sealed');
    const book = next.book as { value: string };
    assert.equal(await verifiesUnder(book.value, DEDICATED), true);
    assert.equal(await verifiesUnder(book.value, SERVICE_ROLE), false);
    assert.deepEqual(await verifyGuestPassBook(book.value), [{ ...PAYLOAD, exp, slug: 'cale-ice' }]);
  });
});

test('(b) a cookie sealed with NEITHER key is refused — and never re-issued', async () => {
  const forged = await new SignJWT(PAYLOAD)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(new TextEncoder().encode(STRANGER));
  await withEnv(KEY_SET, async () => {
    assert.equal(await verifyGuestSessionToken(forged), null);
    assert.equal(await verifyGuestSessionToken('not-a-jwt'), null);
    const { value: next } = await quietly(() => guestPassRefreshFor({ jar: { active: forged } }));
    assert.equal(next.active, null, 'a forged pass was re-issued under the real seal');
    assert.equal(next.book, 'keep');
  });
  await withEnv(TODAY, async () => {
    assert.equal(await verifyGuestSessionToken(forged), null);
  });
});

test('(b) an EXPIRED legacy cookie stays expired — the legacy verifier is not a way around exp', async () => {
  const old = await legacyCookie(Math.floor(Date.now() / 1000) - 60);
  await withEnv(KEY_SET, async () => {
    assert.equal(await verifyGuestSessionToken(old), null);
  });
});

test('(c) with no dedicated key nothing changes: one verifier, no re-seal, cookies still sealed with the service-role key', async () => {
  await withEnv(TODAY, async () => {
    const v = resolveGuestSessionVerifiers();
    assert.ok(v.ok);
    assert.deepEqual(
      v.ok ? v.seals.map((s) => s.source) : [],
      ['service_role'],
      'a second verifier appeared without a dedicated key',
    );
    const jwt = await signGuestSession(PAYLOAD);
    assert.equal(await verifiesUnder(jwt, SERVICE_ROLE), true);
    const verified = await verifyGuestSessionToken(jwt);
    assert.equal(verified!.legacySeal, false, 'with no dedicated key there is nothing to migrate to');
    const { value: next, info } = await quietly(() => guestPassRefreshFor({ jar: { active: jwt } }));
    assert.equal(next.active, null, 'a fresh pass was rewritten with no dedicated key set');
    assert.equal(next.book, 'keep');
    assert.equal(info.length, 0);
  });
});

test('(c) the sliding refresh is unchanged: under 30 days left → a fresh 60-day pass', async () => {
  const exp = Math.floor(Date.now() / 1000) + 10 * 24 * 60 * 60;
  await withEnv(TODAY, async () => {
    const jwt = await signGuestSessionUntil(PAYLOAD, exp);
    const { value: next } = await quietly(() => guestPassRefreshFor({ jar: { active: jwt } }));
    assert.ok(next.active);
    assert.equal(next.active!.maxAge, GUEST_SESSION_COOKIE_MAX_AGE_SECONDS);
    const again = await verifyGuestSessionToken(next.active!.value);
    assert.ok(Math.abs(again!.expiresAtSeconds - (Date.now() / 1000 + GUEST_SESSION_COOKIE_MAX_AGE_SECONDS)) < 10);
  });
});

test('fail-closed rules hold for both seals', async () => {
  // A dedicated key present but too short REFUSES — it never quietly signs (or verifies) with the legacy seal.
  const short = resolveGuestSessionVerifiers({ GUEST_SESSION_SECRET: 'short', SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE });
  assert.equal(short.ok, false);
  // A blank, whitespace or too-short service-role key is never a legacy verifier.
  for (const bad of ['', '   ', 'tiny-key']) {
    const v = resolveGuestSessionVerifiers({ GUEST_SESSION_SECRET: DEDICATED, SUPABASE_SERVICE_ROLE_KEY: bad });
    assert.ok(v.ok);
    assert.deepEqual(v.ok ? v.seals.map((s) => s.source) : [], ['dedicated'], `"${bad}" became a verifier`);
  }
  // The same value twice is one seal, not two.
  const same = resolveGuestSessionVerifiers({ GUEST_SESSION_SECRET: DEDICATED, SUPABASE_SERVICE_ROLE_KEY: DEDICATED });
  assert.deepEqual(same.ok ? same.seals.length : 0, 1);
  // Signer first, always.
  assert.deepEqual(guestSessionVerifyMaterials(KEY_SET), [DEDICATED, SERVICE_ROLE]);
  assert.deepEqual(guestSessionVerifyMaterials({}), []);
  // Signing with the key set uses the dedicated key ONLY.
  await withEnv(KEY_SET, async () => {
    const jwt = await signGuestSession(PAYLOAD);
    assert.equal(await verifiesUnder(jwt, DEDICATED), true);
    assert.equal(await verifiesUnder(jwt, SERVICE_ROLE), false);
  });
});

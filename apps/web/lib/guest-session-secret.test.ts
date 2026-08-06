/**
 * The guest-session signing seal — what it accepts, and what it must REFUSE.
 *
 * ── What was claimed, and what is actually true ───────────────────────────────
 * An audit reported: "if both GUEST_SESSION_SECRET and SUPABASE_SERVICE_ROLE_KEY
 * are unset the seal is the empty string, which signs and verifies happily."
 *
 * That is REFUTED, and this file locks the refutation in place (see the
 * `both unset` test). The old `?? ''` tail was immediately followed by
 * `if (!secret) throw`, so the all-unset case already failed closed.
 *
 * Probing the real function instead of reading it turned up three DIFFERENT
 * results, and those are the ones worth guarding:
 *
 *   GUEST_SESSION_SECRET=''      + a valid service-role key  → THREW
 *   GUEST_SESSION_SECRET='   '   + a valid service-role key  → signed, seal = 3 spaces
 *   GUEST_SESSION_SECRET='x'                                 → signed, seal = 1 byte
 *
 * 1. The blank case is a HARD FAILURE WITH THE ANSWER IN HAND. `??` is nullish
 *    coalescing, so a present-but-empty variable is a value: it short-circuits
 *    the fallback and the perfectly good service-role key sitting right behind
 *    it is never reached. This shape is not hypothetical here — `.env.example`
 *    ships the line `GUEST_SESSION_SECRET=` (blank), and this repo already
 *    documents that `vercel env pull` writes `NAME=` with no value
 *    (money-writer-refuses-fallback.test.ts). Copy the template, and every guest
 *    session breaks while the fallback stands unused.
 *
 * 2. The whitespace and 1-byte cases are the REAL fail-open. The old guard was
 *    `if (!secret)` — a PRESENCE check standing in for a STRENGTH check. Three
 *    spaces and the single letter `x` are both truthy, so both were accepted as
 *    HS256 signing keys.
 *
 * ── The compatibility constraint these tests also protect ────────────────────
 * Production signs guest cookies with the service-role fallback today. The seal
 * is the raw bytes of that value, so ANY change to those bytes signs out every
 * guest holding a live cookie — mid-wedding, with no way for them back in but a
 * fresh QR scan. That is why blank/whitespace is judged on a TRIMMED copy while
 * the material handed to the signer stays byte-for-byte the ORIGINAL, and why
 * the fallback is preserved rather than deleted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jwtVerify } from 'jose';

import { signGuestSession, resolveGuestSessionSecret } from './guest-session';

const PAYLOAD = { guest_id: 'S89G-TESTGUEST', event_id: 'S89E-TESTEVENT', qr_token: 'qr-abc' };

/** A realistic dedicated secret: `openssl rand -hex 32` → 64 chars. */
const DEDICATED = 'a'.repeat(64);
/** A realistic service-role key: long, and NOT the dedicated secret. */
const SERVICE_ROLE = `sb_secret_${'b'.repeat(40)}`;

/** Run `fn` with a patched env, always restoring — even on failure. */
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

/** True when `jwt` carries a valid signature under `key`. */
async function verifiesUnder(jwt: string, key: string): Promise<boolean> {
  try {
    await jwtVerify(jwt, new TextEncoder().encode(key));
    return true;
  } catch {
    return false;
  }
}

// ── fail-closed: nothing usable means nothing gets signed ────────────────────

test('both unset → refuses to sign (the audit claim that this signs happily is REFUTED)', async () => {
  await withEnv(
    { GUEST_SESSION_SECRET: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined },
    async () => {
      await assert.rejects(() => signGuestSession(PAYLOAD), /GUEST_SESSION_SECRET/);
    },
  );
});

test('a whitespace-only secret is NEVER used as the seal', async () => {
  await withEnv(
    { GUEST_SESSION_SECRET: '   ', SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE },
    async () => {
      const jwt = await signGuestSession(PAYLOAD);
      assert.equal(
        await verifiesUnder(jwt, '   '),
        false,
        'three spaces were accepted as an HS256 signing key',
      );
      assert.equal(
        await verifiesUnder(jwt, SERVICE_ROLE),
        true,
        'whitespace should read as ABSENT and hand off to the service-role fallback',
      );
    },
  );
});

test('a secret shorter than 32 chars is refused, not signed with', async () => {
  await withEnv({ GUEST_SESSION_SECRET: 'x', SUPABASE_SERVICE_ROLE_KEY: undefined }, async () => {
    await assert.rejects(
      () => signGuestSession(PAYLOAD),
      /too short|shorter/i,
      'a 1-byte seal is trivially forgeable — it must fail closed, not sign',
    );
  });
});

test('a short secret does not silently borrow the service-role key either', async () => {
  // Refusing outright is the point. Quietly falling through to the fallback
  // would hide a misconfigured secret behind a working site, and the operator
  // would never learn the value they set is being ignored.
  await withEnv({ GUEST_SESSION_SECRET: 'short', SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE }, async () => {
    await assert.rejects(() => signGuestSession(PAYLOAD), /too short|shorter/i);
  });
});

// ── the blank-variable trap: `??` short-circuits a fallback that is right there ─

test('a BLANK GUEST_SESSION_SECRET falls through to the service-role key', async () => {
  await withEnv({ GUEST_SESSION_SECRET: '', SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE }, async () => {
    const jwt = await signGuestSession(PAYLOAD);
    assert.equal(
      await verifiesUnder(jwt, SERVICE_ROLE),
      true,
      'a present-but-empty variable must read as ABSENT, not short-circuit the fallback',
    );
  });
});

test('blank secret + no fallback still refuses', async () => {
  await withEnv({ GUEST_SESSION_SECRET: '', SUPABASE_SERVICE_ROLE_KEY: undefined }, async () => {
    await assert.rejects(() => signGuestSession(PAYLOAD), /GUEST_SESSION_SECRET/);
  });
});

// ── compatibility: the bytes prod signs with today must not move ─────────────

test('the service-role fallback is preserved — a cookie minted under it still verifies', async () => {
  await withEnv(
    { GUEST_SESSION_SECRET: undefined, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE },
    async () => {
      const jwt = await signGuestSession(PAYLOAD);
      assert.equal(
        await verifiesUnder(jwt, SERVICE_ROLE),
        true,
        'deleting or altering the fallback signs out every live guest on deploy',
      );
    },
  );
});

test('a usable secret is passed to the signer byte-for-byte, untrimmed', async () => {
  // A value pasted with a stray newline/space is still the value prod is
  // signing with RIGHT NOW. Trimming it would change the seal and sign out
  // every guest holding a cookie — so trimming may inform the JUDGEMENT only,
  // never the material.
  const padded = `  ${DEDICATED}\n`;
  await withEnv({ GUEST_SESSION_SECRET: padded, SUPABASE_SERVICE_ROLE_KEY: undefined }, async () => {
    const resolution = resolveGuestSessionSecret();
    assert.equal(resolution.ok, true);
    assert.equal(resolution.ok && resolution.material, padded);

    const jwt = await signGuestSession(PAYLOAD);
    assert.equal(await verifiesUnder(jwt, padded), true);
    assert.equal(
      await verifiesUnder(jwt, DEDICATED),
      false,
      'the trimmed form must NOT be what gets signed with',
    );
  });
});

test('a dedicated secret wins over the service-role key', async () => {
  await withEnv(
    { GUEST_SESSION_SECRET: DEDICATED, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE },
    async () => {
      const jwt = await signGuestSession(PAYLOAD);
      assert.equal(await verifiesUnder(jwt, DEDICATED), true);
      assert.equal(await verifiesUnder(jwt, SERVICE_ROLE), false);
    },
  );
});

// ── the resolver reports WHICH key it picked, so the warning can be honest ───

test('resolution names its source', async () => {
  await withEnv(
    { GUEST_SESSION_SECRET: DEDICATED, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE },
    async () => {
      const r = resolveGuestSessionSecret();
      assert.equal(r.ok && r.source, 'dedicated');
    },
  );
  await withEnv(
    { GUEST_SESSION_SECRET: undefined, SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE },
    async () => {
      const r = resolveGuestSessionSecret();
      assert.equal(r.ok && r.source, 'service_role');
    },
  );
});

test('resolveGuestSessionSecret reads an injected env, not just process.env', async () => {
  // Injectable env is what lets the admin/health surfaces ask "is this
  // configured?" without mutating the process.
  const r = resolveGuestSessionSecret({ GUEST_SESSION_SECRET: DEDICATED });
  assert.equal(r.ok && r.source, 'dedicated');

  const bad = resolveGuestSessionSecret({});
  assert.equal(bad.ok, false);
});

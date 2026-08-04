/**
 * `createMoneyWriterClient` must REFUSE the dev anon-key fallback.
 *
 * Written because a mutation exposed the gap: neutralising the guard inside
 * `createMoneyWriterClient` (turning it into a plain alias of
 * `createAdminClient`) left the wiring scan in `order-price-authority.test.ts`
 * completely green — it only checks WHICH function each money write calls, never
 * what that function does. So the call sites could all point at a function that
 * had quietly stopped guarding anything.
 *
 * These tests exercise the function itself.
 *
 * ⚠ SCOPE, so nobody reads more into this than it does: the anon fallback in
 * `createAdminClient` is gated on `NODE_ENV === 'development'`, and in
 * production a missing key ALREADY throws there. So this is a
 * developer-experience guarantee — a named error instead of a bare 42501 during
 * `next dev` — not a production security boundary.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createMoneyWriterClient } from './supabase/admin';

/** Run `fn` with a patched env, always restoring — even on failure. */
function withEnv(patch: Record<string, string | undefined>, fn: () => void): void {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(patch)) saved[k] = process.env[k];
  try {
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test('throws when SUPABASE_SERVICE_ROLE_KEY is missing — even in development', () => {
  withEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-that-must-not-be-used',
      NODE_ENV: 'development',
    },
    () => {
      assert.throws(
        () => createMoneyWriterClient(),
        /SUPABASE_SERVICE_ROLE_KEY is required to write orders\/payments/,
        'the money writer accepted a missing service key — the dev fallback is back',
      );
    },
  );
});

test('the error names the variable and where to put it', () => {
  // A guard whose message does not say what to do just moves the confusion.
  withEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NODE_ENV: 'development',
    },
    () => {
      let message = '';
      try {
        createMoneyWriterClient();
      } catch (e) {
        message = (e as Error).message;
      }
      assert.match(message, /SUPABASE_SERVICE_ROLE_KEY/);
      assert.match(message, /\.env\.local/);
      // The non-obvious part: `vercel env pull` returns it EMPTY because it is
      // marked Sensitive, which is why people hit this at all.
      assert.match(message, /vercel env pull/i);
    },
  );
});

test('an EMPTY-STRING key is refused too, not just an absent one', () => {
  // `vercel env pull` writes SUPABASE_SERVICE_ROLE_KEY= with no value, so the
  // variable is present and falsy. A `!== undefined` check would sail past it —
  // which is the exact scenario this guard exists for.
  withEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: '',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-that-must-not-be-used',
      NODE_ENV: 'development',
    },
    () => {
      assert.throws(() => createMoneyWriterClient(), /SUPABASE_SERVICE_ROLE_KEY is required/);
    },
  );
});

test('constructs normally when the service key IS present', () => {
  // The positive control: if this failed, the tests above would pass for the
  // wrong reason (a function that always throws guards nothing useful).
  withEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    },
    () => {
      const client = createMoneyWriterClient();
      assert.ok(client, 'the money writer did not return a client');
      assert.equal(typeof (client as { from?: unknown }).from, 'function');
    },
  );
});

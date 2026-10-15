/**
 * The production app stamps whether it makes booking fees (owner 2026-10-13:
 * refuse the event lock while NEXT_PUBLIC_BOOKING_FEE_ENABLED is off). The SQL
 * half is `the-fee-is-made-at-the-yes.db.test.ts` § I.
 *
 * SABOTAGE (2026-10-13): let a preview stamp → RED; drop the instrumentation
 * call → RED. (2026-10-15): fire-and-forget it again → RED; drop the retry → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { shouldStampBookingFeeMinting, stampBookingFeeMinting } from './booking-fee-minting-stamp';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

test('only PRODUCTION stamps — previews and local dev share the production database', () => {
  assert.equal(shouldStampBookingFeeMinting({ VERCEL_ENV: 'production' }), true);
  for (const env of [{ VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'development' }, {}]) {
    assert.equal(shouldStampBookingFeeMinting(env), false, `${JSON.stringify(env)} would switch off the live lock`);
  }
});

test('the server start AWAITS the stamp, with a ceiling — never fires and forgets it (stability sweep 2026-10-15)', () => {
  const src = stripComments(readFileSync(join(WEB, 'instrumentation.ts'), 'utf8'));
  assert.match(src, /shouldStampBookingFeeMinting\(process\.env\)/);
  assert.match(
    src,
    /await m\.stampBookingFeeMinting\(createAdminClient\(\), m\.STAMP_CEILING_MS\)/,
    'the stamp must be awaited inside register() with its ceiling — a fired-and-forgotten write is frozen with the instance and dies as "fetch failed"',
  );
  assert.doesNotMatch(src, /void \(async \(\) =>/, 'a detached task in register() outlives nothing — it is frozen mid-flight');
});

/** A stand-in for the one chain the stamp makes; `answers` are served in order, one per attempt. */
function fakeAdmin(answers: Array<'hang' | { data?: unknown; error?: { message: string; code: string; details?: string } }>) {
  let calls = 0;
  const chain = (): Record<string, unknown> => {
    const c: Record<string, unknown> = {};
    for (const k of ['from', 'update', 'eq', 'or', 'select']) c[k] = () => c;
    c.abortSignal = (signal: AbortSignal) => {
      const a = answers[calls++] ?? 'hang';
      if (a !== 'hang') return Promise.resolve({ data: a.data ?? null, error: a.error ?? null });
      return new Promise((resolve) =>
        signal.addEventListener('abort', () =>
          resolve({ data: null, error: { message: 'AbortError: This operation was aborted', code: '', details: '' } }),
        ),
      );
    };
    return c;
  };
  return { admin: chain() as unknown as SupabaseClient, calls: () => calls };
}

const quiet = <T>(run: () => Promise<T>): Promise<T> => {
  const err = console.error;
  console.error = () => {};
  return run().finally(() => {
    console.error = err;
  });
};

test('a dropped connection is retried ONCE (the write is idempotent) and then lands', async () => {
  const f = fakeAdmin([{ error: { message: 'TypeError: fetch failed', code: '', details: 'Caused by: SocketError: other side closed (UND_ERR_SOCKET)' } }, { data: [{ id: 1 }] }]);
  assert.equal(await quiet(() => stampBookingFeeMinting(f.admin, 1_000, true)), 'stamped');
  assert.equal(f.calls(), 2);
});

test('a REFUSAL from the database (it has a code) is not retried', async () => {
  const f = fakeAdmin([{ error: { message: 'new row violates check constraint', code: '23514' } }, { data: [{ id: 1 }] }]);
  assert.equal(await quiet(() => stampBookingFeeMinting(f.admin, 1_000, true)), 'unchanged_or_failed');
  assert.equal(f.calls(), 1);
});

test('a stalled database costs a cold start the ceiling, never a hang — and the write is aborted, not abandoned', async () => {
  const f = fakeAdmin(['hang']);
  const t0 = Date.now();
  assert.equal(await quiet(() => stampBookingFeeMinting(f.admin, 120, true)), 'unchanged_or_failed');
  const took = Date.now() - t0;
  assert.ok(took >= 100 && took < 1_000, `waited ${took} ms against a 120 ms ceiling`);
  assert.equal(f.calls(), 1, 'an aborted attempt is not retried past the ceiling');
});

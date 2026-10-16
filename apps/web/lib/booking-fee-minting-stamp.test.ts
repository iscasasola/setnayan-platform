/**
 * The production app stamps whether it makes booking fees (owner 2026-10-13:
 * refuse the event lock while NEXT_PUBLIC_BOOKING_FEE_ENABLED is off). The SQL
 * half is `the-fee-is-made-at-the-yes.db.test.ts` § I.
 *
 * SABOTAGE (2026-10-13): let a preview stamp → RED; drop the instrumentation
 * call → RED. (2026-10-15): fire-and-forget it again → RED; drop the retry → RED.
 * (2026-10-16, stability sweep 2): put it back in register() → RED; let the scheduler run twice in
 * one instance → RED; never retry after a failure → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createMintingStampScheduler, shouldStampBookingFeeMinting, stampBookingFeeMinting, STAMP_ATTEMPTS_PER_INSTANCE, type StampOutcome } from './booking-fee-minting-stamp';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

test('only PRODUCTION stamps — previews and local dev share the production database', () => {
  assert.equal(shouldStampBookingFeeMinting({ VERCEL_ENV: 'production' }), true);
  for (const env of [{ VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'development' }, {}, { VERCEL_ENV: 'production', NEXT_PHASE: 'phase-production-build' }]) {
    assert.equal(shouldStampBookingFeeMinting(env), false, `${JSON.stringify(env)} would switch off the live lock`);
  }
});

test('the stamp is NOT in server start-up, and the root layout schedules it AFTER the response (stability sweep 2, 2026-10-16)', () => {
  // Production, 2026-10-15/16: in register(), fired-and-forgotten → 124 "fetch failed"; awaited with a
  // 1.5 s ceiling → 57 "AbortError" in 12 h, while the database ran the same statement at 0.8 ms mean.
  // Start-up can be frozen before an instance serves anyone; a network call there dies with it.
  const instr = stripComments(readFileSync(join(WEB, 'instrumentation.ts'), 'utf8'));
  assert.doesNotMatch(instr, /booking-fee-minting-stamp|stampBookingFeeMinting/, 'the stamp is back in server start-up');
  const layout = stripComments(readFileSync(join(WEB, 'app/layout.tsx'), 'utf8'));
  assert.match(layout, /export default async function RootLayout\([\s\S]{0,200}?\{\s*scheduleBookingFeeMintingStamp\(\);/, 'the root layout no longer schedules the stamp');
  const server = stripComments(readFileSync(join(WEB, 'lib/booking-fee-minting-stamp.server.ts'), 'utf8'));
  assert.match(server, /import \{ after \} from 'next\/server';/);
  assert.match(server, /createMintingStampScheduler\(\{\s*env: process\.env,\s*after,/, 'the scheduler is not handed Next’s after()');
});

test('the scheduler: once per instance, after the response; a write that did not land is retried by a later request, a bounded number of times', async () => {
  const PROD = { VERCEL_ENV: 'production' };
  const run = (outcomes: StampOutcome[], env: Record<string, string> = PROD) => {
    const queued: Array<() => Promise<unknown>> = [];
    let stamps = 0;
    const schedule = createMintingStampScheduler({
      env,
      after: (task) => void queued.push(task),
      client: () => ({}) as SupabaseClient,
      stamp: async () => outcomes[stamps++] ?? 'failed',
    });
    const flush = async () => {
      while (queued.length) await queued.shift()!();
    };
    return { schedule, flush, queued, stamps: () => stamps };
  };

  const ok = run(['already_right']);
  ok.schedule();
  ok.schedule();
  assert.equal(ok.queued.length, 1, 'two requests on one instance scheduled two stamps');
  assert.equal(ok.stamps(), 0, 'the stamp ran BEFORE the response — it must wait for after()');
  await ok.flush();
  ok.schedule();
  await ok.flush();
  assert.equal(ok.stamps(), 1, 'a stamp that landed ran again on the same instance');

  const flaky = run(['failed', 'stamped']);
  flaky.schedule();
  await flaky.flush();
  flaky.schedule();
  await flaky.flush();
  flaky.schedule();
  await flaky.flush();
  assert.equal(flaky.stamps(), 2, 'a stamp that did not land was not retried by the next request (or was retried after landing)');

  const dead = run([]);
  for (let i = 0; i < 10; i++) {
    dead.schedule();
    await dead.flush();
  }
  assert.equal(dead.stamps(), STAMP_ATTEMPTS_PER_INSTANCE, 'an unreachable database is asked without bound');

  for (const env of [{ VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'production', NEXT_PHASE: 'phase-production-build' }]) {
    const off = run(['stamped'], env);
    off.schedule();
    await off.flush();
    assert.equal(off.stamps(), 0, `${JSON.stringify(env)} stamped`);
  }

  // `after` outside a request throws: nothing is scheduled, and the next request may try.
  let calls = 0;
  const outside = createMintingStampScheduler({
    env: PROD,
    after: () => {
      calls += 1;
      if (calls === 1) throw new Error('`after` was called outside a request scope');
    },
    client: () => ({}) as SupabaseClient,
    stamp: async () => 'stamped',
  });
  outside();
  outside();
  assert.equal(calls, 2, 'a throwing after() left the scheduler stuck');
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
  assert.equal(await quiet(() => stampBookingFeeMinting(f.admin, 1_000, true)), 'failed');
  assert.equal(f.calls(), 1);
});

test('a stalled database costs the stamp its ceiling, never a hang — and the write is aborted, not abandoned', async () => {
  const f = fakeAdmin(['hang']);
  const t0 = Date.now();
  assert.equal(await quiet(() => stampBookingFeeMinting(f.admin, 120, true)), 'failed');
  const took = Date.now() - t0;
  assert.ok(took >= 100 && took < 1_000, `waited ${took} ms against a 120 ms ceiling`);
  assert.equal(f.calls(), 1, 'an aborted attempt is not retried past the ceiling');
});

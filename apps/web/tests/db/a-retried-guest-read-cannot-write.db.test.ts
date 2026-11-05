/**
 * a-retried-guest-read-cannot-write.db.test.ts — AN RPC THE GUEST PAGE SENDS
 * TWICE MUST BE ONE THAT CANNOT WRITE. (`lib/read-limit.ts`, 2026-10-20.)
 *
 * An essential guest-page read that runs out its own limit is sent once more
 * inside the page's budget. A GET can be resent freely; a POST to `/rpc/…`
 * cannot — the function might write, and a write sent twice is two writes. So
 * only functions named in `RETRIED_RPCS` are resent, and this file holds every
 * one of them (every overload) STABLE or IMMUTABLE in the replayed schema:
 * Postgres refuses INSERT/UPDATE/DELETE in the body of a non-volatile function.
 *
 * A name added to the list for a function that is VOLATILE — or that does not
 * exist — fails here, before a guest's view counter or scan is counted twice.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { RETRIED_RPCS } from '../../lib/read-limit';

let replay: ReplayResult;

before(async () => {
  replay = await createReplayedDb();
});

after(async () => {
  await replay?.db?.close?.();
});

test('the list is not empty — and holds the read that lapsed on 2026-10-19', () => {
  assert.ok(RETRIED_RPCS.length > 0, 'an empty list makes every assertion below vacuous');
  assert.ok(RETRIED_RPCS.includes('event_public_stamp'));
});

test('every rpc the guest page may send twice exists, and every overload of it is STABLE or IMMUTABLE', async () => {
  const res = await replay.db.query<{ proname: string; provolatile: string; args: string }>(
    `SELECT p.proname, p.provolatile, pg_get_function_identity_arguments(p.oid) AS args
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`,
    [RETRIED_RPCS as string[]],
  );
  const found = new Set(res.rows.map((r) => r.proname));
  const missing = RETRIED_RPCS.filter((fn) => !found.has(fn));
  assert.deepEqual(missing, [], `named for a retry but not in the schema: ${missing.join(', ')}`);
  const mayWrite = res.rows.filter((r) => r.provolatile !== 's' && r.provolatile !== 'i');
  assert.deepEqual(
    mayWrite.map((r) => `${r.proname}(${r.args}) is ${r.provolatile === 'v' ? 'VOLATILE' : r.provolatile}`),
    [],
    'a function that may write would be sent twice by a guest page under a stall — remove it from RETRIED_RPCS',
  );
});

test('ANCHOR — the check can see a function that writes', async () => {
  // A VOLATILE function the guest path must never resend; if this read finds it
  // stable or missing, the query above is not looking at what it claims to.
  const res = await replay.db.query<{ provolatile: string }>(
    `SELECT p.provolatile FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'rotate_guest_qr_token'`,
  );
  assert.ok(res.rows.length > 0, 'rotate_guest_qr_token not found — the replay is not the schema');
  assert.ok(res.rows.every((r) => r.provolatile === 'v'), 'rotate_guest_qr_token reads as non-volatile');
});

/**
 * Nobody anonymous can mint paid camera credits.
 *
 * 🔴 `papic_grant_camera_points` was SECURITY DEFINER and EXECUTE-able by `anon`
 * in live production (verified 2026-08-06). It checked nothing about the caller
 * or the purchase: not the payment status, not who was asking, and not that the
 * order belonged to the event. `p_event_id` came from the CALLER and was written
 * straight into the grant, so one wedding's order could mint points onto
 * another. Its only guard was idempotency, which prevents a second grant — not
 * an unauthorised first one.
 *
 * The one legitimate caller is the admin activation hook running as
 * service_role, which bypasses grants and so never needed the anon EXECUTE.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function canExecute(role: string, fn: string): Promise<boolean> {
  const r = await db.query<{ ok: boolean }>(
    `SELECT bool_or(has_function_privilege($1, p.oid, 'EXECUTE')) AS ok
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = $2`,
    [role, fn],
  );
  return r.rows[0]?.ok === true;
}

test('anon CANNOT execute the camera-points grant', async () => {
  assert.equal(
    await canExecute('anon', 'papic_grant_camera_points'),
    false,
    'an anonymous visitor must not be able to mint paid camera credits',
  );
});

test('an ordinary signed-in account cannot either', async () => {
  assert.equal(await canExecute('authenticated', 'papic_grant_camera_points'), false);
});

test('the dropped sibling is closed too — it took its own quota ceiling from the caller', async () => {
  assert.equal(await canExecute('anon', 'papic_reserve_camera_capture'), false);
  assert.equal(await canExecute('authenticated', 'papic_reserve_camera_capture'), false);
});

test('the ANONYMOUS GUEST-CAPTURE path still works — this fix must not break Papic', async () => {
  // `papic_record_guest_capture` (both overloads) IS the anonymous guest path
  // in app/api/papic/guest-capture/route.ts. Revoking it would silently stop
  // every guest photo, which is why it is named rather than swept up.
  assert.equal(
    await canExecute('anon', 'papic_record_guest_capture'),
    true,
    'the guest capture entry point must stay anon-callable',
  );
});

test('the two release functions were ALREADY closed — checked, not assumed', async () => {
  // A first draft of this file asserted these were anon-callable because they
  // appear on the same route. They are not: that route reaches them as
  // service_role. Asserting the opposite would have published a false claim
  // about our own surface, and it is pinned here so nobody re-opens them
  // thinking the guest path needs it.
  for (const fn of ['papic_release_camera_points', 'papic_release_event_points']) {
    assert.equal(await canExecute('anon', fn), false, `${fn} must stay closed to anon`);
    assert.equal(await canExecute('authenticated', fn), false, `${fn} must stay closed`);
  }
});

test('the function refuses an order that does not belong to the event', async () => {
  // Defence in depth: even if a future migration re-grants EXECUTE (this repo's
  // documented default-ACL problem), a mismatched order must grant nothing.
  const r = await db.query<{ granted: number }>(
    `SELECT public.papic_grant_camera_points(
       '00000000-0000-0000-0000-000000000001'::uuid,
       '00000000-0000-0000-0000-000000000002'::uuid) AS granted`,
  );
  assert.equal(r.rows[0]?.granted, 0, 'an order not tied to this event must grant zero');
});

test('the guard is in the function body, not only in the grant', async () => {
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname='papic_grant_camera_points'`,
  );
  const def = r.rows[0]?.def ?? '';
  assert.match(def, /FROM public\.orders o/, 'must verify the order exists');
  assert.match(def, /o\.event_id = p_event_id/, 'must verify the order belongs to this event');
});

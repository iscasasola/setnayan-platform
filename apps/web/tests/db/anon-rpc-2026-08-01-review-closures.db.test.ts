/**
 * The five functions the 2026-08-01 anon-RPC review flagged and nobody closed.
 *
 * ── WHAT WAS FLAGGED, AND WHAT EACH ONE TURNED OUT TO BE ───────────────────
 * `tests/db/anon-rpc-surface.baseline.txt` carried five NEEDS_REVIEW lines from
 * the 2026-08-01 sweep. Each was read against the live catalog on 2026-08-06
 * and each caller was located by its actual `.rpc(...)` call site — not by a
 * name grep, because a name grep cannot tell a service-role client from a
 * session one, and that distinction IS the finding here.
 *
 *   refresh_vendor_fraud_scores()      DoS. No arguments, no identity check,
 *                                      REFRESHes a MATERIALIZED VIEW — real
 *                                      write work — and swallows every error,
 *                                      so an anonymous caller holding nothing
 *                                      but the publishable key gets a 200 back
 *                                      every time and can loop. All four
 *                                      callers are admin/service-role.
 *   papic_event_points_remaining(uuid) The thin wrapper the 2026-08-01
 *                                      migration MISSED. That migration closed
 *                                      the reader underneath it
 *                                      (papic_event_pool_status) to anon; every
 *                                      other member of the Papic pool family
 *                                      (papic_reserve_event_points,
 *                                      papic_seat_dedicated_points,
 *                                      papic_event_points_remaining_for_seat)
 *                                      is postgres+service_role only. This one
 *                                      is SECURITY DEFINER, so the anon grant
 *                                      was an open window into the room that
 *                                      had just been locked.
 *   event_host_is_internal(uuid)       Id-as-credential. Loses anon; KEEPS
 *   review_is_booked_through_setnayan  authenticated, because both are read by
 *                                      server code running on the signed-in
 *                                      user's own client.
 *   reveal_vendor_name_on_first_reply  NOT a finding. RETURNS trigger, so
 *                                      Postgres refuses a direct call and
 *                                      PostgREST never exposes it. Nothing
 *                                      revoked; the baseline NOTE was fixed.
 *
 * ── WHY REVOKING DOES NOT BREAK ANYTHING (the half that actually matters) ───
 * A revoke that breaks a guest is worse than the hole it closed, and BOTH of
 * the wrappers here fail SILENTLY: `eventHostIsInternal` returns false on any
 * RPC error, and `papicEventPoolPreCheckExhausted` skips its check on any RPC
 * error. Neither would throw; each would just quietly stop being true. So this
 * file does not only assert denials — it asserts, under a real `SET ROLE`, that
 *
 *   • `authenticated` KEEPS event_host_is_internal + review_is_booked_through_
 *     setnayan (the couple's dashboard entitlement read and the review-submit
 *     provenance read run on the session client, not the admin client), and
 *   • `service_role` still executes all four, and
 *   • the Papic guest-capture chain still resolves end to end:
 *     papic_event_points_remaining_for_seat (SECURITY DEFINER, service-role
 *     only) calls papic_event_points_remaining internally and must still
 *     return the no-fence sentinel for an event with no pool grant.
 *
 * ── WHY THIS TEST IS NOT VACUOUS ───────────────────────────────────────────
 *   1. META asserts each function still EXISTS in the replay, so a rename
 *      cannot turn every denial green.
 *   2. META asserts `current_user` is really `anon` inside the anon block.
 *   3. Every denial is paired with a DIFFERENTIAL control — the same call as
 *      `service_role` must SUCCEED — so a failure is attributable to the grant
 *      and not to a wrong argument type or a missing table.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

/** Closed to anon AND authenticated — every caller is service-role. */
const SERVICE_ROLE_ONLY = [
  'papic_event_points_remaining',
  'refresh_vendor_fraud_scores',
] as const;

/** Closed to anon; `authenticated` is REQUIRED and must survive. */
const KEEPS_AUTHENTICATED = [
  'event_host_is_internal',
  'review_is_booked_through_setnayan',
] as const;

const ALL_CLOSED = [...SERVICE_ROLE_ONLY, ...KEEPS_AUTHENTICATED] as const;

/** A UUID no fixture uses — every read below must be a miss, never a leak. */
const ABSENT_EVENT = '00000000-0000-4000-8000-0000000000ff';
const ABSENT_VENDOR = '00000000-0000-4000-8000-0000000000fe';
const ABSENT_SEAT = '00000000-0000-4000-8000-0000000000fd';

/** The call each function is exercised with, as a single SQL statement. */
const CALL: Readonly<Record<string, string>> = {
  papic_event_points_remaining: `SELECT public.papic_event_points_remaining('${ABSENT_EVENT}'::uuid)`,
  refresh_vendor_fraud_scores: `SELECT public.refresh_vendor_fraud_scores()`,
  event_host_is_internal: `SELECT public.event_host_is_internal('${ABSENT_EVENT}'::uuid)`,
  review_is_booked_through_setnayan: `SELECT public.review_is_booked_through_setnayan('${ABSENT_EVENT}'::uuid, '${ABSENT_VENDOR}'::uuid)`,
};

async function asRole(role: 'anon' | 'authenticated' | 'service_role'): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
  await db.exec(`SET ROLE ${role}`);
}

async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, ['']);
}

/** Run a statement, returning the error message (or null when it succeeded). */
async function tryQuery(sql: string): Promise<string | null> {
  try {
    await db.query(sql);
    return null;
  } catch (e) {
    return (e as Error).message ?? String(e);
  }
}

/** Does `role` hold EXECUTE on the one function named `fn` in `public`? */
async function canExecute(role: string, fn: string): Promise<boolean> {
  const { rows } = await db.query<{ ok: boolean }>(
    `SELECT bool_or(has_function_privilege($1, p.oid, 'EXECUTE')) AS ok
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
      WHERE p.proname = $2`,
    [role, fn],
  );
  return rows[0]?.ok === true;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
});

after(async () => {
  await reset().catch(() => {});
  if (db) await db.close?.();
});

test('META · every function under test still exists (a rename must not green this file)', async () => {
  for (const fn of [...ALL_CLOSED, 'reveal_vendor_name_on_first_reply',
    'papic_event_points_remaining_for_seat', 'stamp_review_provenance']) {
    const { rows } = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
        WHERE p.proname = $1`,
      [fn],
    );
    assert.ok(
      (rows[0]?.n ?? 0) > 0,
      `public.${fn} is gone from the replay — every assertion about it would pass for the wrong reason`,
    );
  }
});

test('the four closures are OFF anon — the publishable key no longer reaches them', async () => {
  const stillOpen: string[] = [];
  for (const fn of ALL_CLOSED) {
    if (await canExecute('anon', fn)) stillOpen.push(fn);
  }
  assert.deepEqual(
    stillOpen,
    [],
    `anon still holds EXECUTE on: ${stillOpen.join(', ')}. A later CREATE OR REPLACE re-applies Supabase's default privileges — re-issue the REVOKE in the SAME migration that replaced the body.`,
  );
});

test('the two service-role-only closures are OFF authenticated too', async () => {
  const stillOpen: string[] = [];
  for (const fn of SERVICE_ROLE_ONLY) {
    if (await canExecute('authenticated', fn)) stillOpen.push(fn);
  }
  assert.deepEqual(
    stillOpen,
    [],
    `authenticated still holds EXECUTE on: ${stillOpen.join(', ')}. Every caller of these uses the service-role client; a signed-in account has no business refreshing a fraud matview or reading another event's Papic pool.`,
  );
});

test('AVAILABILITY · authenticated KEEPS the two the couple surfaces actually call', async () => {
  // The half a revoke gets wrong. Both readers degrade to `false` on any RPC
  // error, so over-revoking here would not throw — it would silently strip an
  // internal/founder host's permanent grant and silently mislabel a review's
  // "Booked through Setnayan" receipt.
  for (const fn of KEEPS_AUTHENTICATED) {
    assert.equal(
      await canExecute('authenticated', fn),
      true,
      `authenticated LOST EXECUTE on ${fn}. lib/entitlements.ts and lib/reviews.ts call it on the signed-in user's own client and swallow the error, so this breaks silently.`,
    );
  }
});

test('service_role keeps EXECUTE on all four — the real callers are unaffected', async () => {
  for (const fn of ALL_CLOSED) {
    assert.equal(
      await canExecute('service_role', fn),
      true,
      `service_role lost EXECUTE on ${fn} — that is the client every real caller uses`,
    );
  }
});

test('BEHAVIOUR · anon is refused at the wire, and service_role is served', async () => {
  await asRole('anon');
  const { rows: who } = await db.query<{ cu: string }>(`SELECT current_user AS cu`);
  assert.equal(who[0]?.cu, 'anon', 'SET ROLE did not take — every denial below would be vacuous');

  const notDenied: string[] = [];
  for (const fn of ALL_CLOSED) {
    const err = await tryQuery(CALL[fn] as string);
    if (err === null || !/permission denied/i.test(err)) notDenied.push(`${fn}: ${err ?? 'SUCCEEDED'}`);
  }
  await reset();

  assert.deepEqual(
    notDenied,
    [],
    `these ran as anon instead of being refused:\n  ${notDenied.join('\n  ')}`,
  );

  // DIFFERENTIAL CONTROL — the same statements must SUCCEED as service_role,
  // which is what makes each denial attributable to the GRANT rather than to a
  // typo'd argument or a missing table.
  await asRole('service_role');
  const brokenForService: string[] = [];
  for (const fn of ALL_CLOSED) {
    const err = await tryQuery(CALL[fn] as string);
    if (err !== null) brokenForService.push(`${fn}: ${err}`);
  }
  await reset();

  assert.deepEqual(
    brokenForService,
    [],
    `the revoke broke the REAL caller — service_role could not run:\n  ${brokenForService.join('\n  ')}`,
  );
});

test('THE GUEST PATH SURVIVES · the Papic seat chain still resolves after the revoke', async () => {
  // papic_event_points_remaining_for_seat is SECURITY DEFINER and calls
  // papic_event_points_remaining internally. If a definer chain were somehow
  // privilege-checked at the caller, this would break the guest camera — and it
  // would break as a 503 on a wedding day, not in CI. Assert it directly.
  await asRole('service_role');
  const { rows } = await db.query<{ v: number }>(
    `SELECT public.papic_event_points_remaining_for_seat($1::uuid, $2::uuid) AS v`,
    [ABSENT_EVENT, ABSENT_SEAT],
  );
  await reset();
  assert.equal(
    Number(rows[0]?.v),
    2147483647,
    'an event with no pool grant must still report the no-fence sentinel — the guest camera reads this before every capture',
  );
});

test('reveal_vendor_name_on_first_reply was never a callable surface — the note was wrong', async () => {
  // The baseline flagged it as NEEDS_REVIEW on the grounds that it "branches on
  // client-supplied NEW.sender_role". That describes the TRIGGER, not a grant:
  // the function RETURNS trigger, so PostgreSQL refuses a direct invocation and
  // PostgREST does not expose it. Two independent proofs, because the whole
  // point is that no revoke is warranted here.
  const { rows } = await db.query<{ istrig: boolean }>(
    `SELECT (p.prorettype = 'pg_catalog.trigger'::regtype) AS istrig
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
      WHERE p.proname = 'reveal_vendor_name_on_first_reply'`,
  );
  assert.equal(rows[0]?.istrig, true, 'it no longer returns trigger — re-read the grant, the note assumed this');

  // Proof 2 — refused even as the OWNER, which no grant change could ever fix.
  const err = await tryQuery(`SELECT public.reveal_vendor_name_on_first_reply()`);
  assert.ok(
    err !== null && /trigger/i.test(err),
    `a direct call should be refused with a trigger-pseudo-type error; got: ${err ?? 'SUCCESS'}`,
  );

  // And it is bound to the trigger that is the only thing that can run it.
  const { rows: trg } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE p.proname = 'reveal_vendor_name_on_first_reply' AND NOT t.tgisinternal`,
  );
  assert.ok((trg[0]?.n ?? 0) > 0, 'no trigger uses it — then it is dead code, not a safe function');
});

test('the four are gone from the anon-rpc baseline, and the two survivors read right', async () => {
  // Belt-and-braces against the failure mode the baseline file was built for:
  // a revoke lands, the line stays, and the file now reads as if somebody
  // reviewed a surface that no longer exists. anon-rpc-surface.db.test.ts
  // enforces this generically; naming these four makes the regression legible.
  const fs = await import('node:fs');
  const path = await import('node:path');
  const text = fs.readFileSync(
    path.join(__dirname, 'anon-rpc-surface.baseline.txt'),
    'utf8',
  );
  const declared = new Set(
    text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => (l.split('|')[0] ?? '').trim()),
  );
  const leftovers = ALL_CLOSED.filter((fn) => declared.has(fn));
  assert.deepEqual(leftovers, [], `stale baseline lines for revoked functions: ${leftovers.join(', ')}`);

  assert.ok(
    declared.has('reveal_vendor_name_on_first_reply'),
    'reveal_vendor_name_on_first_reply is still anon-EXECUTE-able (harmlessly), so it must still carry a line',
  );
});

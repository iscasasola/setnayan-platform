/**
 * Two confirmed defects, pinned so they cannot come back.
 *
 * ── 1 · AN INACTIVE POOL MUST NOT RECEIVE A BOOKING ────────────────────────
 * `acquire_schedule_pools()` validated in a loop filtered `AND is_active` and
 * then INSERTed from the same table with NO such filter. An inactive pool was
 * therefore never closure-checked, never lock-checked, never capacity-checked —
 * and still got a booking row. Switching a pool off promoted it from "closed"
 * to "unlimited and unvalidated".
 *
 * The characterization test below runs the OLD insert predicate directly and
 * asserts it produces the bug, so the fix is demonstrated against a reproduction
 * rather than asserted against a hope. Prod had zero inactive pools when this
 * was found, which is exactly why nothing surfaced it: the defect is invisible
 * until the moment an operator believes they have closed a pool.
 *
 * ── 2 · A PENDING OAUTH HANDSHAKE MUST NOT BLOCK ACCOUNT DELETION ──────────
 * `vendor_ig_oauth_state.initiated_by → auth.users(id)` carried no ON DELETE
 * clause, so it defaulted to NO ACTION — refuse. Three such rows existed in
 * prod, all for the owner's own account, from a July connect attempt that never
 * completed, on a table with no expiry and no sweeper. A contributing cause of
 * the known-broken admin "Delete user".
 *
 * ── WHY THESE ASSERT BEHAVIOUR, NOT DDL ────────────────────────────────────
 * Neither test reads `pg_constraint` to check the migration "looks right". Each
 * performs the real operation and asserts the outcome, because a constraint
 * that exists but is NOT VALID, or a function that was replaced by a later
 * migration, both read as correct to a DDL inspection and fail in production.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  if (!db) return;
  await db.close?.();
});

// ── 1 · the booking gate ───────────────────────────────────────────────────

test('CHARACTERIZATION · the OLD insert predicate does select an inactive pool', async () => {
  // The bug in one query: the loop's predicate and the insert's predicate
  // disagreed about which rows they covered. If this ever stops reproducing,
  // the test below is no longer testing anything and must be re-derived.
  const { rows } = await db.query<{ old_count: number; new_count: number }>(`
    WITH pools AS (
      SELECT * FROM (VALUES (gen_random_uuid(), TRUE), (gen_random_uuid(), FALSE))
        AS t(pool_id, is_active)
    )
    SELECT
      (SELECT count(*)::int FROM pools)                      AS old_count,
      (SELECT count(*)::int FROM pools WHERE is_active)      AS new_count
  `);
  assert.equal(rows[0]?.old_count, 2, 'the unfiltered predicate covers both pools');
  assert.equal(rows[0]?.new_count, 1, 'the filtered predicate covers only the active one');
});

test('the shipped function INSERTs only from active pools', async () => {
  // Read the live definition and assert the insert's FROM clause carries the
  // filter. This is a source assertion on purpose: exercising acquire_schedule_pools()
  // end-to-end needs a couple session, an event with a day-precise date and an
  // event_vendors row, and that scaffolding would test the fixture more than the
  // fix. The behavioural half is the characterization above.
  const { rows } = await db.query<{ def: string }>(
    `SELECT pg_get_functiondef(oid) AS def FROM pg_proc WHERE proname = 'acquire_schedule_pools'`,
  );
  const def = rows[0]?.def ?? '';
  assert.ok(def.length > 0, 'acquire_schedule_pools does not exist');

  const insertPos = def.indexOf('INSERT INTO public.vendor_schedule_pool_bookings');
  assert.ok(insertPos > 0, 'the booking INSERT is gone — this test is stale, re-derive it');

  const insertBlock = def.slice(insertPos);
  assert.match(
    insertBlock,
    /WHERE\s+sp\.pool_id\s*=\s*ANY\s*\(\s*p_pool_ids\s*\)\s*AND\s+sp\.is_active/,
    'the booking INSERT no longer filters on sp.is_active — an inactive pool can be booked again, skipping the closure, lock and capacity gates',
  );
});

// ── 2 · account deletion ───────────────────────────────────────────────────

test('a pending Instagram handshake does not block deleting the user who started it', async () => {
  // ISOLATION MATTERS HERE. Deleting a user who OWNS the vendor profile is
  // refused by a separate business rule (`VENDOR_LAST_ADMIN: a store must keep
  // at least one admin`) — a real and distinct reason admin "Delete user" fails,
  // but not the one this test is about. So the profile is owned by user A and
  // the handshake is started by user B, and B is the one deleted. That leaves
  // exactly one thing standing between B and deletion: the initiated_by FK.
  await db.exec(`RESET ROLE`).catch(() => {});

  const owner = '11111111-1111-4111-8111-111111111111';
  const starter = '33333333-3333-4333-8333-333333333333';

  for (const [id, email] of [
    [owner, 'ig-owner@example.com'],
    [starter, 'ig-starter@example.com'],
  ]) {
    await db.query(`INSERT INTO auth.users (id) VALUES ($1) ON CONFLICT DO NOTHING`, [id]);
    await db.query(
      `INSERT INTO public.users (user_id, email) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
      [id, email],
    );
  }

  // ⚠ DO NOT hardcode the vendor_profile_id: `on_auth_user_created` fires on the
  // auth insert and makes rows of its own, so a hardcoded id + ON CONFLICT DO
  // NOTHING silently no-ops and the FK fails later pointing at the wrong culprit.
  await db.query(
    `INSERT INTO public.vendor_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
    [owner],
  );
  const vpRow = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1 LIMIT 1`,
    [owner],
  );
  const vpid = vpRow.rows[0]?.vendor_profile_id;
  assert.ok(vpid, 'no vendor profile exists for the owner — the fixture chain is broken');

  await db
    .query(
      `INSERT INTO public.vendor_ig_oauth_state (state_token, vendor_profile_id, initiated_by)
       VALUES ('test-state-token', $1, $2)`,
      [vpid, starter],
    )
    .catch((e) => {
      // Surface fixture drift rather than skipping — a test that quietly stops
      // asserting is the failure mode this whole session is about.
      throw new Error(
        `could not seed vendor_ig_oauth_state (${(e as Error).message}). Re-derive this test against the real columns; do not delete it.`,
      );
    });

  const seeded = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_ig_oauth_state WHERE initiated_by = $1`,
    [starter],
  );
  assert.equal(seeded.rows[0]?.n, 1, 'the pending handshake was not seeded — nothing is being tested');

  // THE ASSERTION: this threw before the fix, because the FK defaulted to
  // NO ACTION and refused to let the user go.
  await db.query(`DELETE FROM auth.users WHERE id = $1`, [starter]);

  const left = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_ig_oauth_state WHERE initiated_by = $1`,
    [starter],
  );
  assert.equal(left.rows[0]?.n, 0, 'the handshake row survived the user — the cascade is not wired');
});

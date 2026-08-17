/**
 * Tables closed to `anon` must STAY closed.
 *
 * ── WHY A TEST AND NOT JUST THE MIGRATION ──────────────────────────────────
 * A REVOKE is a point-in-time act. The anon RPC work already learned this the
 * expensive way: several functions closed by an explicit REVOKE were re-opened
 * later by a `CREATE OR REPLACE` in an unrelated migration, which silently
 * re-applied the schema's default privileges, and CI stayed green throughout.
 *
 * The same default privileges are what put `anon` on 306 of 383 public tables
 * in the first place — a table in this schema arrives OPEN unless somebody
 * closes it. So a revoke with nothing re-asserting it is a temporary condition.
 *
 * ── WHAT THIS IS NOT ───────────────────────────────────────────────────────
 * ⚠ It is NOT a claim that these tables were leaking. Row-level security is
 * enabled on all 383 public tables and none of these has a policy that could
 * admit an anonymous reader, so nothing was ever readable through them. This is
 * the SECOND lock: the grant should not be the only thing RLS is standing in
 * front of, because one policy written too broadly, or one forgotten
 * `ENABLE ROW LEVEL SECURITY` on a future table, is then the whole distance
 * between a public key and the data.
 *
 * ⚠ It is also NOT a list of every table that should be closed. It is the set
 * closed in batch 1 (migration 20271145190664). ~194 remain; each later batch
 * appends here.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

/**
 * Batch 1 — every one of these satisfied all five gates: anon held privileges,
 * no policy on it could ever admit anon, it carried no column-level grants, no
 * application code performed `from('<table>')` on it, and its name appeared
 * nowhere in application source.
 *
 * ⚠ `event_service_deliveries` and `pioneer_incentive_logs` are deliberately
 * ABSENT from this list even though the migration revokes them. They exist in
 * production and in NO migration — real schema drift — so the replay this test
 * runs against has never heard of them, and asserting on them here would fail
 * for a reason that has nothing to do with grants. The migration revokes them
 * behind a `to_regclass` guard so production is still closed.
 */
const CLOSED_IN_BATCH_1 = [
  'anon_onboarding_ip_throttle',
  'couple_briefs',
  'cron_job_runs',
  'earned_token_vouchers',
  'guest_qr_rotations',
  'papic_mission_completions',
  'seo_suggestions',
  'supplies_order_line_items',
  'token_grants_log',
  'token_rewards_log',
  'vendor_ad_subscriptions',
  'vendor_bid_submissions',
  'vendor_guest_deliveries',
  'vendor_screen_name_sequences',
  'vendor_token_boosters',
  'vendor_tool_bundles',
];

/** Every verb PostgREST can reach, plus the one RLS does not cover. */
const VERBS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] as const;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  if (!db) return;
  await db.close?.();
});

test('META · the replay has the anon role and these tables, so a pass means something', async () => {
  // Anti-vacuity. `has_table_privilege` on a missing role or relation throws
  // rather than returning false, but a typo'd list would simply be empty and
  // every assertion below would pass by inspecting nothing.
  assert.ok(CLOSED_IN_BATCH_1.length >= 16, 'the batch list has shrunk — did someone trim it to go green?');

  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_class c
       JOIN pg_namespace ns ON ns.oid = c.relnamespace AND ns.nspname = 'public'
      WHERE c.relname = ANY($1)`,
    [CLOSED_IN_BATCH_1],
  );
  assert.equal(
    rows[0]?.n,
    CLOSED_IN_BATCH_1.length,
    'a table in the batch list does not exist in the replayed schema — fix the name, ' +
      'do not delete the line',
  );
});

test('anon holds NOTHING on the tables closed in batch 1', async () => {
  const open: string[] = [];
  for (const table of CLOSED_IN_BATCH_1) {
    for (const verb of VERBS) {
      const { rows } = await db.query<{ ok: boolean }>(
        `SELECT has_table_privilege('anon', $1, $2) AS ok`,
        [`public.${table}`, verb],
      );
      if (rows[0]?.ok) open.push(`${table}:${verb}`);
    }
  }
  assert.deepEqual(
    open,
    [],
    'anon has regained privileges that migration 20271145190664 revoked:\n  ' +
      open.join('\n  ') +
      '\n\nThis is almost never deliberate. The usual cause is a later migration ' +
      "re-creating the table or running a broad GRANT, which re-applies the schema's " +
      'default privileges — the same default that put anon on 306 of 383 tables. ' +
      'Re-issue the REVOKE in the SAME migration that re-created the object.',
  );
});

test('the supplier written-off count stays closed to BOTH principals', async () => {
  // A matview cannot carry RLS, so the grant is the entire control. Both halves
  // matter: anon was closed on 2026-08-11, authenticated on 2026-08-17 once it
  // was established that its "documented reader" had never had a caller.
  for (const role of ['anon', 'authenticated']) {
    const { rows } = await db.query<{ ok: boolean }>(
      `SELECT has_table_privilege($1, 'public.vendor_full_completed_events_stats', 'SELECT') AS ok`,
      [role],
    );
    assert.equal(
      rows[0]?.ok,
      false,
      `${role} can read the unredacted completed-event count. Subtracting the public count ` +
        `from it gives that supplier's written-off jobs. If you are building the vendor's own ` +
        `backend card, scope the reader to the caller instead of restoring a blanket grant.`,
    );
  }
});

test('the PUBLIC supplier figures are untouched — this must not break a shop page', async () => {
  // The other direction. Over-revoking here would empty the track record on
  // every public shop page, which is purpose-built public data.
  for (const view of ['vendor_public_completed_events_stats', 'vendor_completed_events']) {
    const { rows } = await db.query<{ ok: boolean }>(
      `SELECT has_table_privilege('anon', $1, 'SELECT') AS ok`,
      [`public.${view}`],
    );
    assert.equal(rows[0]?.ok, true, `anon lost SELECT on ${view} — the public shop page needs it`);
  }
});

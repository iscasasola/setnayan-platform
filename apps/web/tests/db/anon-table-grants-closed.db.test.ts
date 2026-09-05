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
 * ⚠ It is also NOT a list of every table that should be closed. It is what has
 * been closed SO FAR — batch 1 (20271145190664, 16), batch 2 (20271145286482,
 * 17) and batch 3 (20271147692197, 16): 49 of the 180 that hold an anon grant
 * with no anon-reaching policy, measured in prod 2026-08-17.
 *
 * ⏭ The remaining ~131 are queried through `server.ts` (the caller's own
 * session — ANON when signed out) or the BROWSER client. Batch 3 took everything
 * reachable only by the SERVICE ROLE, so that set is now exhausted too. Each
 * remaining table needs the question no scan can answer for it: does a SIGNED-OUT
 * visitor's path actually reach it, or only a signed-in one? A wrong answer turns
 * an RLS-empty result into a permission ERROR on a live page.
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
 *
 * 🚨 `vendor_ad_subscriptions` AND `vendor_tool_bundles` WERE IN THIS BATCH AND
 * WERE PULLED BACK OUT — the sixth gate, learned here. A `security_invoker`
 * view runs with the CALLER'S privileges on its base tables, so anon reading
 * such a view needs the grant on everything underneath it, even though no
 * application code ever names that table:
 *
 *     vendor_market_stats → vendor_active_ads  → vendor_ad_subscriptions
 *     vendor_active_tools                      → vendor_tool_bundles
 *
 * Revoking the first would have emptied the marketplace listing for every
 * signed-out visitor. CI caught that one. **It did not catch the second** — no
 * test asserts `vendor_active_tools` — so fixing only the reported failure
 * would have shipped the other. Enumerate the dependency graph; do not fix the
 * one instance the failure happened to name.
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
  'vendor_bid_submissions',
  'vendor_guest_deliveries',
  'vendor_screen_name_sequences',
  'vendor_token_boosters',
];

/**
 * Batch 2 — migration 20271145286482. Same six gates, re-derived from the live
 * catalog and `origin/main` rather than reusing batch 1's shortlist, because
 * grants and code both move.
 *
 * 🔑 FOUR OF THESE ARE REACHED ONLY THROUGH `SECURITY DEFINER` FUNCTIONS, which
 * execute as their owner and never consult the caller's table grants — verified
 * by reading `pg_proc.prosecdef` in prod, not inferred:
 * `rate_limit_hits` (check_rate_limit; anon cannot even execute it) ·
 * `seating_editor_locks` (acquire/refresh/release/assert) ·
 * `papic_event_pool_usage` and `papic_seat_day_usage` (the metering family).
 * `lib/ugat/graph.ts` says of the locks table: "LOOKS DEAD AND IS FULLY LIVE …
 * It was nearly deleted on the strength of that grep." The grep is not the
 * access path — and neither is it the grant.
 *
 * ⚠ `rate_limit_hits` has no `CREATE TABLE` in any migration because it is
 * `CREATE UNLOGGED TABLE`. A declaration check that misses that reads as drift;
 * `tests/db/schema-drift.db.test.ts` had already recorded the same false
 * positive. All 17 were confirmed present in the replay directly.
 */
const CLOSED_IN_BATCH_2 = [
  'bespoke_monogram_generations',
  'booking_fee_ledger',
  'concierge_unanswered_questions',
  'demand_radar_rollups',
  'market_funnel_bands',
  'papic_event_pool_usage',
  'papic_seat_day_usage',
  'rate_limit_hits',
  'render_jobs',
  'seating_editor_locks',
  'supplier_vendor_sku_pricing',
  'supplier_vendor_skus',
  'supplies_orders',
  'vendor_2307_filings',
  'vendor_contract_signatures',
  'vendor_member_token_wallets',
  'vendor_release_history',
];

/**
 * Batch 3 — migration 20271147692197. The FIRST batch where "no code queries it"
 * was no longer available: batches 1 and 2 exhausted that set, so all 171
 * remaining candidates are queried by application code.
 *
 * 🔑 SO GATE 4 SHARPENED from "does the app query it?" to "does any ANON-KEY path
 * query it?". `lib/supabase/` ships three factories and only one is
 * grant-independent — `admin.ts` (service role). `server.ts` is the caller's own
 * session, which is ANON when the visitor is signed out, and `client.ts` is the
 * browser. Every file that queries a table below imports the admin client and
 * NEITHER of the other two, so revoking `anon` cannot reach them.
 *
 * 🪤 The INJECTED-CLIENT trap is excluded explicitly: a `lib/` helper taking
 * `supabase: SupabaseClient` as a parameter proves nothing, because the CALLER
 * picks the privilege level. Any such file disqualified its table rather than
 * being guessed at.
 *
 * ⚠ THE SCAN WAS NOT THE VERDICT — three were read by hand because they looked
 * anon-reachable, and all three mentions turned out to be comments or indirection:
 * `promo_free_windows` is named in `lib/sku-catalog.ts` (public pricing) only in
 * prose; `demo_sessions` is named in two `'use client'` homepage overlays only in
 * docblocks, its one write being a server action on the admin client; and
 * `guest_claims` looked guest-facing but `lib/guest-claim-core.ts` is pure logic
 * with zero queries — the writes are `UPDATE public.guest_claims` inside a
 * SECURITY DEFINER function, which ignores caller grants entirely.
 */
const CLOSED_IN_BATCH_3 = [
  'anniversary_email_log',
  'anniversary_headsup_log',
  'demo_sessions',
  'drive_copy_folders',
  'godchild_reminder_log',
  'guest_claims',
  'promo_free_windows',
  'renewal_reminder_log',
  'seo_health_snapshots',
  'seo_metrics',
  'setnayan_ai_guard_log',
  'social_milestones',
  'vendor_image_flags',
  'vendor_image_hashes',
  'vendor_qr_media_flags',
  'vendor_verifications',
];

/**
 * Batch 4 — migration 20271148681647. The THIRD refinement of gate 4, because
 * both earlier shortcuts are exhausted: batches 1–2 took every table with NO
 * query, batch 3 every table queried ONLY by the SERVICE ROLE. The question
 * became: can a SIGNED-OUT visitor's code path reach it at all?
 *
 * All 21 are queried exclusively from inside the login-gated route trees
 * (`app/dashboard/**`, `app/vendor-dashboard/**` and their own actions). A
 * signed-out visitor is redirected out before any of it renders; a signed-in one
 * authenticates as `authenticated`, never `anon`.
 *
 * 🚨 "BEHIND A LOGIN" IS NOT SUFFICIENT ON ITS OWN, and this is the trap that
 * nearly carried the batch: a SERVER ACTION is a POST endpoint and the gating
 * LAYOUT NEVER RUNS FOR IT. Every action file behind these 21 was opened and
 * read; each establishes the caller before touching the table — most via
 * `auth.getUser()`, and `seating/walkthrough` + `guests/souvenirs` via
 * `getCurrentUser()` plus an `event_members` check for couple/coordinator.
 * ⚠ My first VERIFICATION grep omitted `getCurrentUser` and reported those two
 * as unguarded. The original scan was right and the CHECK was too narrow — the
 * instinct "the scan was wrong again" was itself wrong.
 *
 * 🔍 Two were re-read by hand because earlier notes claimed a wider reach:
 * `event_category_build_state` (the couple marketplace does read it every page
 * load — inside the gated tree, exactly two `from()` sites) and `papic_missions`
 * (a guest-facing product, but all eight `from()` sites are under the couple's
 * studio; two are client components, which run with the signed-in user's own
 * session).
 *
 * ⏭ Held back to batch 5: `platform_compliance_facts`,
 * `vendor_recommendation_feedback`, `vendor_review_appeals` — queried from the
 * ADMIN tree, gated by a different guard (`requireAdmin()`), and one of their
 * files was being edited by an open PR. A migration is judged against the state
 * it LANDS in.
 */
const CLOSED_IN_BATCH_4 = [
  'build_requote_nudges',
  'coordinator_feature_recommendations',
  'custom_domains',
  'event_category_build_state',
  'event_manual_vendors',
  'event_schedule_suggestions',
  'event_walkthrough_zones',
  'guest_message_blocks',
  'guest_souvenir_claims',
  'inquiry_outcomes',
  'kwento_assignments',
  'manpower_gigs',
  'papic_missions',
  'patiktok_render_job_clips',
  'patiktok_source_clips',
  'vendor_client_notes',
  'vendor_event_access_grants',
  'vendor_feature_recommendations',
  'vendor_lock_proposals',
  'vendor_portion_rules',
  'vendor_recommendation_optins',
];

/** Every table closed so far. Later batches append their own list above. */
/**
 * Batch 5 (20271148202591) — THE "NO POLICY AT ALL" CATEGORY, CLOSED COMPLETELY.
 *
 * These five are the safest revokes in the whole sweep, and for a reason no earlier
 * batch could claim: each has RLS ENABLED and ZERO policies, so Postgres already
 * denied anon everything. The grant opened nothing. Nothing observable changes.
 *
 * 🔑 AFTER THIS THE CATEGORY IS EMPTY. Every remaining candidate has policies that
 * merely EXCLUDE anon — a different and far more delicate question, because the app
 * reaches many of them through the service role, so a wrong revoke is felt only at
 * runtime and only by a signed-out visitor.
 *
 * ⚠ ORDERING NOTE FOR WHOEVER MERGES THIS: batch 4 (#4524) edits this same file and
 * was open when batch 5 was written. Whichever lands second must merge, not force.
 */
const CLOSED_IN_BATCH_5 = [
  'drive_copy_artifacts',
  'event_software_activations_v2',
  'live_studio_roam_streams',
  'panood_broadcasts',
  'vendor_wallets',
] as const;

/**
 * Batch 6 (20271161191013) — the admin desk's twelve, including the THREE that
 * batch 4's notes explicitly held back (platform_compliance_facts,
 * vendor_recommendation_feedback, vendor_review_appeals — deferred because an
 * open PR was editing one of their files; it merged long ago).
 *
 * Every gate re-run in prod 2026-08-24, not inherited from an earlier batch's
 * shortlist: anon held the grant on all 12 · no policy admits anon · none is a
 * base of the three security_invoker views · no anon-executable SECURITY
 * INVOKER function names them (and that pg_proc scan was PROVED able to match —
 * the trivially-true pattern returned all 90 anon-executable invoker functions).
 * Every query site runs on the admin client or authenticates first; the
 * indirection sweep (table names reaching `.from()` through a CONSTANT, the
 * shape that hides from a `from('name')` grep) found only metadata registries
 * (lib/erasure/coverage.ts, lib/admin/queue-counts.ts), both admin-client.
 *
 * Dry-run against production in a ROLLED-BACK transaction: all 12 moved
 * SELECT true → false. The revoke moves the measured surface.
 */
const CLOSED_IN_BATCH_6 = [
  'chat_message_flags',
  'discount_code_eligible_users',
  'discount_code_redemptions',
  'discount_codes',
  'platform_compliance_facts',
  'platform_expenses',
  'social_evergreen_items',
  'social_posts',
  'social_publish_settings',
  'token_redemptions_log',
  'vendor_recommendation_feedback',
  'vendor_review_appeals',
] as const;

/**
 * Batch 7 (20271162239362) — the dashboards' fifteen, and the first batch where
 * the CONSTANT-INDIRECTION shape had to be swept explicitly: a `from('name')`
 * grep reports event_vendor_3d_plan_unlocks as "queried by nothing", and the
 * truth WAS that it was queried through the exported VENDOR_3D_PLAN_UNLOCK_TABLE
 * constant — every caller passing the ADMIN client. Grep the REF, not just the
 * literal. (2026-09-05: that lib is RETIRED — the 3D Plan is free for couples,
 * so the vendor-unlock discount it recorded no longer exists. The table now
 * genuinely has no reader; it stays because migrations are never deleted, and
 * its grants stay closed for the same reason as every other row here.)
 *
 * Every gate re-run in prod 2026-08-24: anon held the grant on all 15 · no
 * policy admits anon · none is a base of the three security_invoker views · no
 * anon-executable SECURITY INVOKER function names them (scan proved able to
 * match) · every query site runs on the admin client or inside the login-gated
 * trees whose actions establish the caller first (requireHostMembershipOrThrow,
 * auth.getUser, vendor-profile resolution — each hit file read, not pattern-
 * matched: the first grep for auth guards missed the host-gate helper and
 * reported the widgets actions unguarded; the FILE was right and the CHECK was
 * too narrow). The public wall routes state the invariant this batch enforces:
 * "P0 security invariant: no anon read path to wall_feed."
 *
 * Dry-run against production in an explicitly ROLLED-BACK transaction: all 15
 * moved SELECT true → false.
 */
const CLOSED_IN_BATCH_7 = [
  'event_blocked_users',
  'event_meaningful_dates',
  'event_recaps',
  'event_vendor_3d_plan_unlocks',
  'guest_columns',
  'invitation_widgets',
  'photo_messages',
  'reel_music_tracks',
  'vendor_calendar_day_states',
  'vendor_creator_offers',
  'vendor_disputes',
  'vendor_schedule_pool_categories',
  'vendor_schedule_pools',
  'wall_display_sessions',
  'wall_feed',
] as const;

const CLOSED = [
  ...CLOSED_IN_BATCH_1,
  ...CLOSED_IN_BATCH_2,
  ...CLOSED_IN_BATCH_3,
  ...CLOSED_IN_BATCH_4,
  ...CLOSED_IN_BATCH_5,
  ...CLOSED_IN_BATCH_6,
  ...CLOSED_IN_BATCH_7,
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
  // ⚠ MEASURE THE COMBINED LIST, NOT ONE BATCH. A first cut of this line still
  // read `CLOSED_IN_BATCH_1.length` after batch 2 was added, so deleting batch
  // 2's seventeen entries outright would have passed the anti-vacuity check
  // while silently un-guarding all of them. Each batch also has its own floor,
  // so emptying either one is caught rather than absorbed by the other.
  assert.ok(
    CLOSED_IN_BATCH_1.length >= 14,
    `batch 1's list has shrunk to ${CLOSED_IN_BATCH_1.length} — did someone trim it to go green?`,
  );
  assert.ok(
    CLOSED_IN_BATCH_2.length >= 17,
    `batch 2's list has shrunk to ${CLOSED_IN_BATCH_2.length} — did someone trim it to go green?`,
  );
  assert.ok(
    CLOSED_IN_BATCH_3.length >= 16,
    `batch 3's list has shrunk to ${CLOSED_IN_BATCH_3.length} — did someone trim it to go green?`,
  );
  assert.ok(
    CLOSED_IN_BATCH_4.length >= 21,
    `batch 4's list has shrunk to ${CLOSED_IN_BATCH_4.length} — did someone trim it to go green?`,
  );
  assert.ok(
    CLOSED_IN_BATCH_6.length >= 12,
    `batch 6's list has shrunk to ${CLOSED_IN_BATCH_6.length} — did someone trim it to go green?`,
  );
  assert.ok(
    CLOSED_IN_BATCH_7.length >= 15,
    `batch 7's list has shrunk to ${CLOSED_IN_BATCH_7.length} — did someone trim it to go green?`,
  );
  assert.ok(
    CLOSED.length >= 95,
    `the combined closed list has shrunk to ${CLOSED.length} — did someone trim it to go green?`,
  );

  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_class c
       JOIN pg_namespace ns ON ns.oid = c.relnamespace AND ns.nspname = 'public'
      WHERE c.relname = ANY($1)`,
    [CLOSED],
  );
  assert.equal(
    rows[0]?.n,
    CLOSED.length,
    'a table in the batch list does not exist in the replayed schema — fix the name, ' +
      'do not delete the line',
  );
});

test('anon holds NOTHING on any table closed so far (batches 1-7)', async () => {
  const open: string[] = [];
  for (const table of CLOSED) {
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
    'anon has regained privileges that migration 20271145190664, 20271145286482, 20271147692197, 20271148681647, 20271148202591, 20271161191013 or 20271162239362 revoked:\n  ' +
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

/**
 * The other direction of the sixth gate. These two tables LOOK exactly like
 * batch-1 candidates — anon has the grant, no policy admits anon, no column
 * grants, and no application code names them anywhere — and revoking either
 * one breaks a public page, because a `security_invoker` view reads them with
 * the caller's privileges.
 *
 * This test exists so the next batch cannot quietly re-add them by re-running
 * the same five-gate scan that already picked them once.
 */
test('anon KEEPS the grants that a security_invoker view reads on its behalf', async () => {
  const viewBacked: [string, string][] = [
    ['vendor_ad_subscriptions', 'vendor_active_ads → vendor_market_stats (the public marketplace listing)'],
    ['vendor_tool_bundles', 'vendor_active_tools'],
  ];
  for (const [table, chain] of viewBacked) {
    const { rows } = await db.query<{ ok: boolean }>(
      `SELECT has_table_privilege('anon', $1, 'SELECT') AS ok`,
      [`public.${table}`],
    );
    assert.equal(
      rows[0]?.ok,
      true,
      `anon lost SELECT on ${table}. It is read through ${chain}, and a ` +
        `security_invoker view uses the CALLER'S privileges on its base tables — so ` +
        `this revoke empties that view for every signed-out visitor. No application ` +
        `code names this table, which is exactly why a source scan says it is safe ` +
        `to revoke and is wrong.`,
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

/**
 * THE OTHER DIRECTION, AND THE ONE THIS SWEEP CAN ACTUALLY BREAK.
 *
 * Every assertion above asks "did a closed table reopen?". None of them asks the
 * inverse: **did a revoke close something anon legitimately needs?** Until now
 * that was guarded by exactly TWO hard-coded names (`vendor_ad_subscriptions`,
 * `vendor_tool_bundles`), added after batch 2 nearly emptied the public supplier
 * listing — a list, not an invariant.
 *
 * 🔑 THE INVARIANT IS DERIVABLE, so it needs no list: if a table carries a POLICY
 * that can admit `anon`, somebody deliberately wrote a rule for anonymous
 * visitors. Revoking the grant makes that policy UNREACHABLE — the rule survives
 * in the catalog and can never fire again. A policy written for anon and a grant
 * withheld from anon is a contradiction, and it is exactly the shape a wrong
 * batch produces.
 *
 * ⚠ COLUMN-AWARE ON PURPOSE. `has_table_privilege(...,'SELECT')` is FALSE when
 * only SOME columns are granted, and six tables in this schema are deliberately
 * column-scoped (532 column grants). Using the table-level check reported
 * `event_paperwork` and `vendor_profiles` as broken when both are correct —
 * `has_any_column_privilege` is the right question.
 *
 * ⛔ WHAT THIS DELIBERATELY DOES NOT CLAIM. A table with NO anon-reaching policy
 * is NOT protected by this, and that is correct: RLS already denies anon there,
 * so revoking its grant is behaviour-neutral. `guests`, `events`, `papic_photos`,
 * `photo_messages`, `guest_columns` and `event_tables` all have ZERO
 * anon-reaching policies — the guest surface reads them through SECURITY DEFINER
 * functions, which is what `anon-rpc-surface.baseline.txt` documents. A mutation
 * revoking `guests` therefore SHOULD stay green, and does.
 */
const ANON_POLICY_BUT_NO_GRANT_ALLOWED = new Map([
  ['event_category_decisions', 'Pre-existing 2026-08-17: policy admits anon, no grant exists, so the rule is already dead. Not caused by any revoke batch — none of batches 1-4 touches it.'],
  ['papic_event_pool_config', 'Pre-existing 2026-08-17: same shape. Its anon-callable status function was revoked on 2026-08-01 (anon-rpc-surface), so the policy is vestigial.'],
  ['people', 'Pre-existing 2026-08-17: person-graph tables are Phase 2/3 and gated; the anon policy is written ahead of the grant.'],
  ['person_connections', 'Pre-existing 2026-08-17: same family as `people`.'],
  ['person_stewardships', 'Pre-existing 2026-08-17: same family; minors are counsel-gated Phase 3.'],
]);

test('a revoke never orphans a policy that was written FOR anon', async () => {
  const { rows } = await db.query<{ relname: string; readable: boolean }>(`
    WITH anon_pol AS (
      SELECT DISTINCT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
        JOIN pg_policy p ON p.polrelid = c.oid
       WHERE c.relkind IN ('r','p')
         AND (p.polroles = '{0}'::oid[] OR EXISTS (
              SELECT 1 FROM unnest(p.polroles) pr
                JOIN pg_roles r ON r.oid = pr WHERE r.rolname = 'anon'))
    )
    SELECT relname,
           has_any_column_privilege('anon', 'public.' || relname, 'SELECT') AS readable
      FROM anon_pol ORDER BY relname
  `);

  // Anti-vacuity: this schema has ~100 such tables. An empty set would pass.
  assert.ok(rows.length > 60, `only ${rows.length} tables carry an anon-reaching policy — the query is wrong`);

  const orphaned = rows
    .filter((r) => !r.readable)
    .map((r) => r.relname)
    .filter((t) => !ANON_POLICY_BUT_NO_GRANT_ALLOWED.has(t));

  assert.deepEqual(
    orphaned,
    [],
    'These tables have a POLICY written for `anon` and no grant left for `anon` to use it:\n  ' +
      orphaned.join('\n  ') +
      '\n\nSomebody wrote a rule for anonymous visitors and a revoke has made it unreachable — the ' +
      'policy survives in the catalog and can never fire again. This is the break a wrong batch in ' +
      'the anon-grant sweep produces, and it is the one the "did anything reopen?" tests above ' +
      'cannot see.\n\nEither restore the grant, or delete the policy and say so in ' +
      'ANON_POLICY_BUT_NO_GRANT_ALLOWED with a reason.',
  );
});

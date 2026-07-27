/**
 * platform_settings anonymous exposure — end-to-end (test:db, every migration
 * replayed into PGlite).
 *
 * THE HOLE THIS LOCKS: `platform_settings_read_all` (20260513230000:41) was
 * `FOR SELECT TO anon, authenticated USING (true)` — no condition at all — and
 * `anon` held all seven table privileges. RLS filters ROWS and can never hide a
 * COLUMN, so anyone with the publishable anon key could
 * `GET /rest/v1/platform_settings?select=*` and read the single settings row:
 * Setnayan's BIR TIN, business address and email, its BDO + GCash account
 * numbers, the admin search-ranking dial (`firstlook_boost_weight`), and every
 * unreleased feature flag. Unlike the sibling finding on vendor_profiles
 * (PR #3821), that row is POPULATED IN PRODUCTION — this was a live disclosure.
 *
 * Migration 20271014400000 revokes anon entirely (no re-grant: anon needs zero
 * columns of this table) and narrows the policy to `authenticated`.
 *
 * ── WHAT THIS FILE ASSERTS — BEHAVIOUR, NOT BOOKKEEPING ─────────────────────
 * It never inspects `schema_migrations`. Every case runs real SQL under a real
 * `SET ROLE` and asserts the statement is refused or served.
 *
 * Denials  : anon cannot read business_tin / firstlook_boost_weight / any
 *            column / `SELECT *`, cannot filter or ORDER BY a column (the
 *            PostgREST probe vector — Postgres requires SELECT privilege on any
 *            column named in WHERE/ORDER BY), and holds no write bit including
 *            TRUNCATE (which RLS never guards).
 * Availability: `authenticated` still reads every column the checkout, orders
 *            and receipt surfaces need, AND GETS A ROW BACK. This is the half
 *            that matters most — `fetchPlatformSettings` returns a hardcoded
 *            FALLBACK on any error, so a broken grant would not throw, it would
 *            silently blank the BDO/GCash payment details at checkout.
 *
 * ── WHY THIS TEST IS NOT VACUOUS ────────────────────────────────────────────
 * A DB test that talks to Postgres as the table OWNER bypasses both RLS and
 * column grants, so every "denied" assertion passes for the wrong reason. Four
 * independent defences:
 *
 *   1. A META check that `current_user` really is `anon`, that it cannot
 *      BYPASSRLS, and that it does not own the table. It runs FIRST, so an
 *      owner-session regression fails loudly instead of silently greening.
 *   2. A POSITIVE CONTROL: `authenticated` reads the same columns in the same
 *      suite and receives a row. If the role wiring were broken, everything
 *      would fail and the denials would be meaningless.
 *   3. A DIFFERENTIAL CONTROL: every statement asserted to fail as `anon` is
 *      re-run as `service_role` and asserted to SUCCEED — that is what makes a
 *      denial attributable to the GRANT rather than to a typo'd column name.
 *   4. An ANTI-VACUITY canary that the columns named actually exist.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

/**
 * Columns that must NEVER be anon-readable. Not the whole table — these are the
 * ones whose disclosure is the actual finding, named explicitly so the failure
 * message points at a real-world consequence rather than a count.
 */
const SENSITIVE_COLUMNS = [
  // Tax + corporate identity
  'business_tin',
  'business_address',
  'business_email',
  'resend_from_address',
  'bir_payor_name',
  'bir_payor_address',
  'bir_payor_zip',
  'bir_authorized_rep_tin',
  // Internal business configuration / the admin dials
  'firstlook_boost_weight',
  'setnayan_pay_fee_pct',
  'referral_reward_php',
  'radar_min_n_floor',
  'repost_watch_hamming_threshold',
  'firstlook_sla_hours',
  'maya_checkout_endpoint',
  'tiktok_client_key',
  'youtube_oauth_client_id',
  'vendor_validate_email',
  // Unreleased-roadmap flags
  'radar_enabled',
  'spotlight_homepage_enabled',
  'referral_program_enabled',
  'free_tier_booking_cap_enabled',
  'vendor_addon_tiered_pricing_enabled',
  // Ops cron timestamps
  'lead_hold_sweep_last_run_at',
  'fraud_cluster_sweep_last_run_at',
] as const;

/**
 * The exact SELECT list of fetchPlatformSettings() (lib/platform-settings.ts:53)
 * plus fetchVendorValidateContacts() (:126). `authenticated` must keep every
 * one of these or checkout silently degrades to FALLBACK.
 */
const CHECKOUT_COLUMNS = [
  'id',
  'business_name',
  'business_tin',
  'business_address',
  'business_email',
  'bdo_account_name',
  'bdo_account_number',
  'bdo_qr_url',
  'gcash_account_name',
  'gcash_number',
  'gcash_qr_url',
  'default_vat_rate_pct',
  'onboarding_bg_music_r2_key',
  'onboarding_bg_music_enabled',
  'admin_digest_enabled',
  'brand_icon_master_url',
  'brand_favicon_ico_url',
  'brand_apple_touch_url',
  'brand_icon_png_512_url',
  'brand_icon_svg_url',
  'brand_icon_version',
  'repost_watch_hamming_threshold',
  'spotlight_homepage_enabled',
  'referral_program_enabled',
  'updated_at',
  'vendor_validate_email',
  'vendor_validate_phone',
] as const;

/** The payment-instruction fields — the deliberate product decision. */
const PAYMENT_COLUMNS = [
  'business_name',
  'bdo_account_name',
  'bdo_account_number',
  'bdo_qr_url',
  'gcash_account_name',
  'gcash_number',
  'gcash_qr_url',
  'default_vat_rate_pct',
] as const;

async function asAnon(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, ['anon']);
  await db.exec(`SET ROLE anon`);
}

async function asAuthenticated(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, ['authenticated']);
  await db.exec(`SET ROLE authenticated`);
}

async function asService(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, ['service_role']);
  await db.exec(`SET ROLE service_role`);
}

async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, ['']);
}

/** Run a statement, returning the error message (or null when it succeeded). */
async function tryQuery(sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return (e as Error).message ?? String(e);
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();

  // NOTE: the migration is NOT re-executed here. replay-migrations.ts declares
  // Supabase's platform grants via ALTER DEFAULT PRIVILEGES rather than a
  // trailing blanket `GRANT ALL ON ALL TABLES`, so a migration's REVOKE
  // survives the replay exactly as it does in prod. Asserting against the plain
  // replay therefore tests the real shipped path.
  //
  // The settings row is seeded by 20260513230000 itself
  // (`INSERT INTO platform_settings (id) VALUES (1)`), so a successful read
  // returns a row rather than an empty set. Populate the fields the assertions
  // below actually read back, so "authenticated can read it" cannot pass on a
  // table of NULLs.
  await db.exec(`
    UPDATE public.platform_settings
       SET business_tin = '123-456-789-000',
           business_name = 'Setnayan',
           bdo_account_number = '1234567890',
           gcash_number = '09171234567',
           -- constrained to [0, 0.5] by platform_settings_firstlook_boost_weight_chk
           -- (20270319817376:42) — a value outside it fails the seed, not the grant.
           firstlook_boost_weight = 0.25
     WHERE id = 1;
  `);
});

after(async () => {
  if (!db) return;
  await reset();
  await db.close?.();
});

// ── 0. META — the session must genuinely be un-privileged ───────────────────

test('META: the impersonated session is really `anon`, not the owner', async () => {
  await asAnon();
  const r = await db.query<{ cu: string; bypass: boolean; owner: string }>(
    `SELECT current_user AS cu,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass,
            (SELECT pg_get_userbyid(relowner) FROM pg_class
              WHERE oid = 'public.platform_settings'::regclass) AS owner`,
  );
  const row = r.rows[0]!;
  assert.equal(row.cu, 'anon', 'SET ROLE did not take — every denial below would be vacuous');
  assert.equal(row.bypass, false, 'the anon role can BYPASSRLS — the whole suite would be meaningless');
  assert.notEqual(row.owner, 'anon', 'anon owns platform_settings — grants would not apply to it');
  await reset();
});

test('META: ANTI-VACUITY — every column named in this file exists', async () => {
  const all = [...new Set([...SENSITIVE_COLUMNS, ...CHECKOUT_COLUMNS, ...PAYMENT_COLUMNS])];
  const r = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='platform_settings'`,
  );
  const present = new Set(r.rows.map((x) => x.column_name));
  const missing = all.filter((c) => !present.has(c));
  assert.deepEqual(
    missing,
    [],
    `columns named by this test no longer exist — the assertions would pass vacuously: ${missing.join(', ')}`,
  );
});

test('META: RLS is enabled on platform_settings', async () => {
  const r = await db.query<{ rls: boolean }>(
    `SELECT relrowsecurity AS rls FROM pg_class WHERE oid='public.platform_settings'::regclass`,
  );
  assert.equal(r.rows[0]!.rls, true, 'RLS disabled — the policy narrowing would be meaningless');
});

// ── 1. DENIALS — anon must reach nothing ────────────────────────────────────

test('anon CANNOT read business_tin — the headline disclosure', async () => {
  await asAnon();
  const err = await tryQuery(`SELECT business_tin FROM public.platform_settings`);
  assert.ok(err, 'anon read Setnayan’s BIR TIN — the exposure is still open');
  assert.match(String(err), /permission denied/i);
  await reset();
});

test('anon CANNOT read firstlook_boost_weight — the admin ranking dial', async () => {
  await asAnon();
  const err = await tryQuery(`SELECT firstlook_boost_weight FROM public.platform_settings`);
  assert.ok(err, 'anon read the search-ranking dial');
  assert.match(String(err), /permission denied/i);
  await reset();
});

test('anon CANNOT `SELECT *` — the bulk-pull vector', async () => {
  await asAnon();
  const err = await tryQuery(`SELECT * FROM public.platform_settings`);
  assert.ok(err, 'GET /rest/v1/platform_settings?select=* still returns the row');
  assert.match(String(err), /permission denied/i);
  await reset();
});

test('anon CANNOT read ANY of the sensitive/internal columns', async () => {
  await asAnon();
  const leaked: string[] = [];
  for (const col of SENSITIVE_COLUMNS) {
    const err = await tryQuery(`SELECT "${col}" FROM public.platform_settings`);
    if (!err) leaked.push(col);
  }
  await reset();
  assert.deepEqual(leaked, [], `still anon-readable: ${leaked.join(', ')}`);
});

test('anon CANNOT read the payment-instruction columns either — the deliberate call', async () => {
  // These are customer-facing BY DESIGN under apply-then-pay, but they are
  // served to logged-in buyers, not to anonymous bulk readers. See the PR body.
  await asAnon();
  const leaked: string[] = [];
  for (const col of PAYMENT_COLUMNS) {
    const err = await tryQuery(`SELECT "${col}" FROM public.platform_settings`);
    if (!err) leaked.push(col);
  }
  await reset();
  assert.deepEqual(leaked, [], `anon can still bulk-read payment rails: ${leaked.join(', ')}`);
});

test('anon CANNOT filter or ORDER BY a denied column — the PostgREST probe vector', async () => {
  // Postgres requires SELECT privilege on any column named in WHERE/ORDER BY,
  // so `?business_tin=like.1*` was a live confirmation oracle even without
  // projecting the column.
  await asAnon();
  const whereErr = await tryQuery(
    `SELECT 1 FROM public.platform_settings WHERE business_tin LIKE '1%'`,
  );
  const orderErr = await tryQuery(
    `SELECT 1 FROM public.platform_settings ORDER BY firstlook_boost_weight`,
  );
  await reset();
  assert.ok(whereErr, 'anon can still probe business_tin through a WHERE clause');
  assert.ok(orderErr, 'anon can still probe firstlook_boost_weight through ORDER BY');
});

test('anon holds NO table privilege — including TRUNCATE, which RLS never guards', async () => {
  const r = await db.query<{ p: string; held: boolean }>(
    `SELECT p, has_table_privilege('anon','public.platform_settings',p) AS held
       FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) AS p`,
  );
  const held = r.rows.filter((x) => x.held).map((x) => x.p);
  assert.deepEqual(held, [], `anon still holds: ${held.join(', ')}`);
});

test('no RLS policy on the table names `anon` any more', async () => {
  const r = await db.query<{ polname: string }>(
    `SELECT polname FROM pg_policy
      WHERE polrelid='public.platform_settings'::regclass
        AND 'anon' = ANY (SELECT rolname FROM pg_roles WHERE oid = ANY(polroles))`,
  );
  assert.deepEqual(
    r.rows.map((x) => x.polname),
    [],
    'a policy still admits anon — a future GRANT would silently re-open the table',
  );
});

// ── 2. AVAILABILITY — the checkout/receipt path must still work ─────────────

test('POSITIVE CONTROL: authenticated reads business_tin AND GETS THE ROW', async () => {
  await asAuthenticated();
  const r = await db.query<{ business_tin: string | null }>(
    `SELECT business_tin FROM public.platform_settings WHERE id = 1`,
  );
  await reset();
  assert.equal(r.rows.length, 1, 'authenticated got no row — /receipts prints a blank BIR TIN');
  assert.equal(r.rows[0]!.business_tin, '123-456-789-000');
});

test('authenticated reads EVERY column fetchPlatformSettings() selects', async () => {
  // The one that matters most: the helper returns FALLBACK on ANY error, so a
  // missing grant here would not throw — it would silently blank the payment
  // details at checkout and reset the VAT rate to 0.
  await asAuthenticated();
  const err = await tryQuery(
    `SELECT ${CHECKOUT_COLUMNS.map((c) => `"${c}"`).join(',')} FROM public.platform_settings WHERE id = 1`,
  );
  await reset();
  assert.equal(err, null, `checkout would silently fall back to blank payment details: ${err}`);
});

test('authenticated reads the payment rails and they are non-empty', async () => {
  await asAuthenticated();
  const r = await db.query<{ bdo_account_number: string | null; gcash_number: string | null }>(
    `SELECT bdo_account_number, gcash_number FROM public.platform_settings WHERE id = 1`,
  );
  await reset();
  assert.equal(r.rows[0]!.bdo_account_number, '1234567890');
  assert.equal(r.rows[0]!.gcash_number, '09171234567');
});

test('authenticated holds SELECT but NO write bit', async () => {
  const r = await db.query<{ p: string; held: boolean }>(
    `SELECT p, has_table_privilege('authenticated','public.platform_settings',p) AS held
       FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) AS p`,
  );
  const map = new Map(r.rows.map((x) => [x.p, x.held]));
  assert.equal(map.get('SELECT'), true, 'authenticated lost SELECT — checkout and receipts break');
  const writes = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'].filter((p) =>
    map.get(p),
  );
  assert.deepEqual(writes, [], `authenticated still holds write privilege(s): ${writes.join(', ')}`);
});

test('service_role keeps full access — every /admin write and public brand read uses it', async () => {
  const r = await db.query<{ sel: boolean; upd: boolean }>(
    `SELECT has_table_privilege('service_role','public.platform_settings','SELECT') AS sel,
            has_table_privilege('service_role','public.platform_settings','UPDATE') AS upd`,
  );
  assert.equal(r.rows[0]!.sel, true);
  assert.equal(r.rows[0]!.upd, true);
});

// ── 3. DIFFERENTIAL CONTROL ─────────────────────────────────────────────────

test('DIFFERENTIAL: every anon-denied read SUCCEEDS as service_role', async () => {
  // Proves each denial above is attributable to the GRANT, not to a typo'd
  // column name, a missing row, or a constraint.
  await asService();
  const failed: string[] = [];
  for (const col of [...SENSITIVE_COLUMNS, ...PAYMENT_COLUMNS]) {
    const err = await tryQuery(`SELECT "${col}" FROM public.platform_settings`);
    if (err) failed.push(`${col}: ${err}`);
  }
  const starErr = await tryQuery(`SELECT * FROM public.platform_settings`);
  await reset();
  assert.deepEqual(failed, [], `service_role could not read: ${failed.join(' | ')}`);
  assert.equal(starErr, null, 'service_role could not SELECT * — the denials above prove nothing');
});

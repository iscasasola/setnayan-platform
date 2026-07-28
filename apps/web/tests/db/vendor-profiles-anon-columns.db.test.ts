/**
 * vendor_profiles anon column scope — end-to-end (test:db, every migration
 * replayed into PGlite).
 *
 * THE HOLE THIS LOCKS: `vendor_profiles_public_read` (roles={anon,authenticated})
 * admits every VERIFIED vendor's whole row, and until migration
 * 20271014385411 the `anon` role held table-level SELECT on all 93 columns.
 * Postgres RLS is ROW-level, never COLUMN-level — so a stranger holding only
 * the publishable anon key could `GET /rest/v1/vendor_profiles?select=*` and
 * receive a complete BIR Form-2307 tax identity (tin_number, tin_type,
 * registered_business_name, registered_address, registered_zip,
 * bir_service_category), DTI/SEC registration numbers, the business owner's
 * personal name, contact_phone, fraud-enforcement state, and user_id.
 *
 * WHAT THIS FILE ASSERTS IS BEHAVIOUR, NOT BOOKKEEPING. It never checks that
 * the migration is in the ledger — `schema_migrations` can report APPLIED
 * while the object never landed. Every assertion is a real statement run
 * under `SET ROLE anon` that must succeed or must be refused.
 *
 * ── WHY THIS TEST IS NOT VACUOUS ────────────────────────────────────────────
 * A DB test that talks to Postgres as the table OWNER bypasses both RLS and
 * column grants, so every "denied" assertion passes for the wrong reason.
 * Four defences:
 *
 *   1. `META: the impersonated session is really anon` asserts current_user is
 *      literally 'anon', that the role cannot BYPASSRLS, and that it does not
 *      own the table. It runs FIRST, so an owner-session regression fails
 *      loudly instead of silently greening the suite.
 *   2. A POSITIVE CONTROL: the same anon session successfully reads
 *      business_name AND GETS A ROW BACK. Without the row assertion, "SELECT
 *      succeeded" could mean an empty result for the wrong reason.
 *   3. A DIFFERENTIAL CONTROL: every statement asserted to fail as anon is
 *      re-run as service_role and asserted to SUCCEED — which is what makes a
 *      denial attributable to the GRANT rather than to a typo'd column name,
 *      a missing row, or a CHECK constraint.
 *   4. An ANTI-VACUITY check that the canary columns actually exist.
 *
 * ── THE TWO TESTS THAT CATCH THE *OTHER* FAILURE MODE ───────────────────────
 * A revoke-only migration (no column re-GRANT) passes every deny assertion
 * here and still breaks production, invisibly to the exposure baseline:
 *   • public.vendor_market_stats is WITH (security_invoker = true), so an anon
 *     read of the VIEW is checked against anon's column privileges on the BASE
 *     table. A bare revoke turns every logged-out hit into 42501.
 *   • Seven other tables carry a PERMISSIVE anon/PUBLIC SELECT policy whose
 *     USING clause subqueries vendor_profiles. A policy runs as the querying
 *     role, so those anon reads flip from "returns []" to 42501.
 * Both are covered below and are NOT optional.
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
 * The never-anon-readable set. This is a NAMED list on purpose: the BIR
 * columns all landed in a single migration (20260516100000), so the next tax
 * feature will very likely add more the same way. A named list turns that into
 * a failing test rather than a silently re-opened hole.
 */
const SENSITIVE_NEVER_ANON = [
  // BIR Form-2307 identity
  'tin_number',
  'tin_type',
  'registered_business_name',
  'registered_address',
  'registered_zip',
  'bir_service_category',
  // DTI/SEC registration
  'registration_number_raw',
  'registration_number_normalized',
  // personal / contact PII
  'business_owner_name',
  'contact_phone',
  'hq_address',
] as const;

/** Internal-only state: fraud enforcement, demo markers, privilege bypass. */
const INTERNAL_NEVER_ANON = [
  'fraud_suspended_at',
  'fraud_banned_at',
  'fraud_tombstoned',
  'is_demo',
  'demo_batch_id',
  'is_founder',
  'created_by_admin_user_id',
  'tier_expires_at',
  'next_renewal_due_at',
  'absorbs_convenience_fee',
] as const;

/** Exactly the 21 columns migration 20271014385411 re-grants to anon. */
const ANON_READABLE = [
  'vendor_profile_id',
  'public_id',
  'business_name',
  'business_slug',
  'tagline',
  'logo_url',
  'services',
  'location_city',
  'hq_latitude',
  'hq_longitude',
  'contact_email',
  'public_visibility',
  'event_types',
  'compatible_ceremony_types',
  'compatible_venue_settings',
  'created_at',
  'hq_region',
  'tier_state',
  'verification_state',
  'is_published',
  'user_id',
] as const;

async function asAnon(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, ['anon']);
  await db.exec(`SET ROLE anon`);
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

  // NOTE: the migration is NOT re-executed here. replay-migrations.ts
  // deliberately declares Supabase's platform grants via ALTER DEFAULT
  // PRIVILEGES rather than a trailing blanket `GRANT ALL ON ALL TABLES`
  // (see its comment at the end of createReplayedDb), so a migration's REVOKE
  // survives the replay exactly as it does in prod. Asserting against the
  // plain replay therefore tests the real shipped path.

  // Seed one VERIFIED vendor so vendor_profiles_public_read admits a row.
  // Without this, "SELECT business_name succeeded" would pass on an empty
  // result for the wrong reason.
  await db.exec(`
    INSERT INTO public.vendor_profiles (business_name, public_visibility, verification_state, tin_number, last_verified_at)
    VALUES ('Test Vendor', 'verified', 'verified', '123-456-789-000', NOW());
  `);
});

after(async () => {
  if (!db) return;
  await reset();
  await db.close?.();
});

// ── 0. Meta: the session must genuinely be un-privileged ────────────────────

test('META: the impersonated session is really `anon`, not the owner', async () => {
  await asAnon();
  const r = await db.query<{ cu: string; bypass: boolean; owner: string }>(
    `SELECT current_user AS cu,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass,
            (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = 'public.vendor_profiles'::regclass) AS owner`,
  );
  const row = r.rows[0]!;
  assert.equal(row.cu, 'anon', 'SET ROLE did not take — every denial below would be vacuous');
  assert.equal(row.bypass, false, 'the anon role can BYPASSRLS — the whole suite would be meaningless');
  assert.notEqual(row.owner, 'anon', 'anon owns public.vendor_profiles — grants would not apply to it');
  await reset();
});

test('META: ANTI-VACUITY — the canary columns exist on this table', async () => {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema='public' AND table_name='vendor_profiles'
        AND column_name IN ('tin_number','registration_number_raw','business_owner_name','user_id')`,
  );
  assert.equal(
    r.rows[0]!.n,
    4,
    'the sensitive columns are missing — every "anon cannot read them" assertion would pass vacuously',
  );
});

// ── 1. The lock — sensitive columns are refused ─────────────────────────────

test('REFUSES an anon read of tin_number (and service_role still can)', async () => {
  await asAnon();
  const anonErr = await tryQuery(`SELECT tin_number FROM public.vendor_profiles`);
  assert.ok(anonErr, 'anon read tin_number — the BIR tax identity is still exposed');
  assert.match(anonErr, /permission denied/i, `expected a privilege denial, got: ${anonErr}`);

  // DIFFERENTIAL: the identical statement must work as service_role, or the
  // denial above could just mean a typo'd column name.
  await asService();
  const svcErr = await tryQuery(`SELECT tin_number FROM public.vendor_profiles`);
  assert.equal(svcErr, null, `service_role ALSO failed (${svcErr}) — the denial above proves nothing`);
  await reset();
});

test('REFUSES an anon read of every sensitive + internal column', async () => {
  const failures: string[] = [];

  for (const col of [...SENSITIVE_NEVER_ANON, ...INTERNAL_NEVER_ANON]) {
    await asAnon();
    const anonErr = await tryQuery(`SELECT ${col} FROM public.vendor_profiles`);
    if (anonErr === null) {
      failures.push(`${col}: anon SELECT SUCCEEDED (column is still exposed)`);
      continue;
    }
    if (!/permission denied/i.test(anonErr)) {
      failures.push(`${col}: rejected, but not by privileges → ${anonErr}`);
      continue;
    }

    await asService();
    const svcErr = await tryQuery(`SELECT ${col} FROM public.vendor_profiles`);
    if (svcErr !== null) {
      failures.push(`${col}: service_role ALSO failed (${svcErr}) — the denial proves nothing`);
    }
  }

  await reset();
  assert.deepEqual(failures, [], `anon column-scope failures:\n  ${failures.join('\n  ')}`);
});

test('REFUSES an anon SELECT * (the wildcard must not slip through)', async () => {
  await asAnon();
  const err = await tryQuery(`SELECT * FROM public.vendor_profiles`);
  assert.ok(err, 'anon ran SELECT * — every column is still readable');
  assert.match(err, /permission denied/i, `expected a privilege denial, got: ${err}`);
  await reset();
});

test('REFUSES anon filtering/ordering on a denied column (the oracle vector)', async () => {
  // Postgres requires SELECT privilege on any column named in WHERE or ORDER
  // BY, so PostgREST `?tin_number=like.1*` and `?order=...` die too. Without
  // this, a denied column is still a confirmation oracle:
  // registration_number_normalized carries a UNIQUE index, so an anon read
  // would confirm a guessed DTI/SEC registration number.
  await asAnon();

  const whereErr = await tryQuery(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE tin_number LIKE '1%'`,
  );
  assert.ok(whereErr, 'anon filtered on tin_number — PostgREST becomes a TIN oracle');
  assert.match(whereErr, /permission denied/i, `expected a privilege denial, got: ${whereErr}`);

  const orderErr = await tryQuery(
    `SELECT vendor_profile_id FROM public.vendor_profiles ORDER BY registration_number_normalized`,
  );
  assert.ok(orderErr, 'anon ordered by registration_number_normalized — still an oracle');
  assert.match(orderErr, /permission denied/i, `expected a privilege denial, got: ${orderErr}`);

  await reset();
});

// ── 2. Positive control — the public surface still works ────────────────────

test('ALLOWS an anon read of business_name and RETURNS the verified row', async () => {
  await asAnon();
  const res = await db.query<{ business_name: string; public_visibility: string }>(
    `SELECT business_name, business_slug, public_visibility FROM public.vendor_profiles`,
  );
  assert.equal(res.rows.length, 1, 'the verified vendor row is gone — this assertion would be vacuous');
  assert.equal(res.rows[0]!.business_name, 'Test Vendor');
  assert.equal(res.rows[0]!.public_visibility, 'verified');
  await reset();
});

test('ALLOWS an anon read of every intended-public column', async () => {
  await asAnon();
  const failures: string[] = [];
  for (const col of ANON_READABLE) {
    const err = await tryQuery(`SELECT ${col} FROM public.vendor_profiles`);
    if (err !== null) failures.push(`${col}: ${err}`);
  }
  await reset();
  assert.deepEqual(
    failures,
    [],
    `anon LOST a column the public marketplace needs:\n  ${failures.join('\n  ')}`,
  );
});

// ── 3. The two consumers a bare revoke would break, invisibly to CI ─────────

test('ALLOWS an anon SELECT * on public.vendor_market_stats (security_invoker view)', async () => {
  // Guard first: if the view ever stops being security_invoker, this test is
  // no longer covering the risk it was written for.
  const meta = await db.query<{ opts: string[] | null }>(
    `SELECT reloptions AS opts FROM pg_class
      WHERE relname='vendor_market_stats' AND relnamespace='public'::regnamespace`,
  );
  assert.ok(meta.rows[0], 'public.vendor_market_stats is missing');
  assert.ok(
    (meta.rows[0]!.opts ?? []).includes('security_invoker=true'),
    'vendor_market_stats is no longer security_invoker=true — re-read the column-grant rationale before trusting this suite',
  );

  await asAnon();
  const err = await tryQuery(`SELECT * FROM public.vendor_market_stats`);
  assert.equal(
    err,
    null,
    `anon cannot read vendor_market_stats (${err}) — GET /rest/v1/vendor_market_stats 42501s for every logged-out visitor`,
  );
  await reset();
});

test('ALLOWS an anon SELECT on public.vendor_ig_media (its policy subqueries vendor_profiles)', async () => {
  await asAnon();
  const err = await tryQuery(`SELECT * FROM public.vendor_ig_media`);
  assert.equal(
    err,
    null,
    `anon read of vendor_ig_media failed (${err}) — its RLS policy subqueries vendor_profiles.is_published, which the grant must cover. Must return [], not 42501.`,
  );
  await reset();
});

test('ALLOWS anon reads on the six tables whose policies subquery vendor_profiles.user_id', async () => {
  const tables = [
    'vendor_service_attributes',
    'event_vendor_booth_posters',
    'registered_crew_devices',
    'vendor_calendar_blocks',
    'vendor_subscriptions',
    'vendor_token_purchases',
  ];
  await asAnon();
  const failures: string[] = [];
  for (const t of tables) {
    const err = await tryQuery(`SELECT * FROM public.${t}`);
    if (err !== null) failures.push(`${t}: ${err}`);
  }
  await reset();
  assert.deepEqual(
    failures,
    [],
    `an anon read flipped from "returns []" to 42501 — vendor_profiles.user_id must stay in the grant:\n  ${failures.join('\n  ')}`,
  );
});

// ── 4. No write privilege survived the re-grant ─────────────────────────────

test('anon holds NO table-level privilege, including TRUNCATE', async () => {
  const failures: string[] = [];
  for (const p of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_table_privilege('anon','public.vendor_profiles',$1) AS ok`,
      [p],
    );
    if (r.rows[0]!.ok) failures.push(p);
  }
  assert.deepEqual(failures, [], `anon still holds write privilege(s): ${failures.join(', ')}`);

  // SELECT is column-level now, so the TABLE-level bit must be gone too.
  const sel = await db.query<{ ok: boolean }>(
    `SELECT has_table_privilege('anon','public.vendor_profiles','SELECT') AS ok`,
  );
  assert.equal(sel.rows[0]!.ok, false, 'anon still holds TABLE-level SELECT — the revoke did not land');
});

test('the catalog shows no table-level grant to anon or PUBLIC', async () => {
  const r = await db.query<{ grantee: string; privilege_type: string }>(
    `SELECT grantee, privilege_type FROM information_schema.role_table_grants
      WHERE table_schema='public' AND table_name='vendor_profiles'
        AND grantee IN ('anon','PUBLIC')`,
  );
  assert.deepEqual(
    r.rows,
    [],
    `table-level privileges still held by anon/PUBLIC: ${JSON.stringify(r.rows)}`,
  );
});

// ── 5. The deliberate scoping — `authenticated` is UNTOUCHED ────────────────

test('SCOPED OUT (documented hole): `authenticated` can still read tin_number', async () => {
  // This is NOT an endorsement — it is a tripwire. api/profile/export does
  // .select('*') on the session client for the RA 10173 data-subject export,
  // so a column-level grant to `authenticated` would 42501 a compliance
  // obligation. If a follow-up PR closes that hole properly (by enumerating
  // the export first), this assertion SHOULD fail and be deleted — that is the
  // signal the remaining exposure is finally gone.
  const r = await db.query<{ ok: boolean }>(
    `SELECT has_column_privilege('authenticated','public.vendor_profiles','tin_number','SELECT') AS ok`,
  );
  assert.equal(
    r.rows[0]!.ok,
    true,
    'authenticated lost SELECT on tin_number — if this was deliberate, verify api/profile/export still works and delete this test',
  );
});

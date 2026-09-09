/**
 * A SHOP'S TAX IDENTITY IS NOT READABLE BY EVERY SIGNED-IN ACCOUNT.
 * End-to-end (test:db — every migration replayed into PGlite).
 *
 * THE HOLE THIS LOCKS. `vendor_profiles_public_read` admits roles
 * {anon, authenticated} for every VERIFIED shop, and RLS is ROW-level — it can
 * never hide a COLUMN. Migration 20271014385411 closed this for `anon` and said
 * in its own docblock that it was leaving `authenticated` wide open, so until
 * 20271217955839 any couple, and any rival supplier, could
 * `GET /rest/v1/vendor_profiles?select=tin_number,registered_address,
 * business_owner_name,registration_number_raw` with the public anon key and a
 * plain signed-in session, and receive a shop's whole BIR/Form-2307 tax
 * identity, its DTI/SEC registration number and its owner's legal name.
 *
 * WHAT THIS FILE ASSERTS IS BEHAVIOUR, NOT BOOKKEEPING. It never consults
 * `schema_migrations` — that ledger can report APPLIED while the object never
 * landed. Every assertion is a real statement run under `SET ROLE` that must
 * succeed, or must be refused.
 *
 * ── WHY IT IS NOT VACUOUS ───────────────────────────────────────────────────
 *   1. META asserts the impersonated session really is `authenticated`, cannot
 *      BYPASSRLS, and does not own the table. It runs FIRST, so an
 *      owner-session regression fails loudly instead of greening the suite.
 *   2. POSITIVE CONTROL — the same stranger session reads `business_name` off
 *      the same shop AND GETS A ROW. Without the row assertion, "the SELECT
 *      succeeded" could mean an empty result for the wrong reason.
 *   3. DIFFERENTIAL CONTROL — every statement asserted to fail as a stranger is
 *      re-run as service_role and asserted to SUCCEED, which is what makes a
 *      denial attributable to the GRANT rather than to a typo'd column name.
 *   4. ANTI-VACUITY — the canary columns exist and the seeded shop is real.
 *
 * ── THE OTHER FAILURE MODE, WHICH IS THE ONE THAT WOULD HURT ────────────────
 * A revoke-only change passes every deny assertion above and still breaks the
 * product — SILENTLY. `lib/vendor-profile.ts` retries its FULL projection
 * against a LEGACY one on ANY error and back-fills `business_owner_name: null`,
 * so a shop's own dashboard would not crash: it would report the shop's own
 * owner name as MISSING and ask the supplier to type it again. Four
 * registration-number probes swallow their error the same way, and
 * `vendor-dashboard/verify/actions.ts` turns that into a hard block on
 * submitting verification at all.
 *
 * So the tests that matter most here are the ones asserting the shop CAN still
 * read its own identity, through `public.vendor_profiles_self`, and that the
 * shop can still WRITE its own row. Those are not optional.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

/**
 * The eleven columns 20271217955839 takes off `authenticated`.
 *
 * A NAMED list on purpose. The BIR columns all landed in one migration
 * (20260516100000) and the DTI/SEC ones in another (20270925937630), so the
 * next identity feature will very likely add more the same way. A named list
 * turns that into a failing test rather than a quietly re-opened hole.
 */
const DENIED_TO_AUTHENTICATED = [
  // BIR / Form-2307 tax identity
  'tin_number',
  'tin_type',
  'registered_business_name',
  'registered_address',
  'registered_zip',
  'bir_service_category',
  // DTI / SEC government registration (anti-farm gate 20270925937630)
  'registration_number_raw',
  'registration_number_normalized',
  'registration_number_submitted_at',
  'registration_number_needs_review',
  // the owner as a private person
  'business_owner_name',
] as const;

/**
 * Columns a signed-in stranger MUST keep. Not decoration: this is the half
 * that keeps the marketplace working, and a missed GRANT does not blank one
 * field — PostgREST refuses the WHOLE query that names it.
 */
const STILL_READABLE_BY_STRANGERS = [
  'vendor_profile_id',
  'business_name',
  'business_slug',
  'tagline',
  'logo_url',
  'services',
  'location_city',
  'contact_email',
  'contact_phone',
  'hq_address',
  'verification_state',
  'public_visibility',
  'tier_state',
  'user_id',
] as const;

type World = {
  shopOwner: string;
  teammate: string;
  stranger: string;
  vendorProfileId: string;
};
let W: World;

const TIN = '123-456-789-000';
const OWNER_NAME = 'Juana Dela Cruz';
const REG_NO = 'DTI-0001-2026';

async function mkUser(email: string, accountType: 'vendor' | 'customer'): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type',$2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}

async function asAuthenticated(uid: string | null): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, ['authenticated']);
  await setAuthUid(db, uid);
  await db.exec(`SET ROLE authenticated`);
}

async function asAnon(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, ['anon']);
  await setAuthUid(db, null);
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
  await setAuthUid(db, null);
}

/** Run a statement; return the error message, or null when it succeeded. */
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

  // A vendor signup AUTO-CREATES its starter vendor_profiles row (the trigger
  // from 20260513120000, so the dashboard never opens to a missing record) and
  // user_id is UNIQUE on that table. Inserting a second row for the same user
  // is a 23505 — so this promotes the real row rather than fabricating one,
  // which is also the shape production is actually in.
  const shopOwner = await mkUser(`owner-${Date.now()}@example.test`, 'vendor');
  const teammate = await mkUser(`teammate-${Date.now()}@example.test`, 'customer');
  const stranger = await mkUser(`stranger-${Date.now()}@example.test`, 'customer');

  // A VERIFIED, publicly visible shop — the exact shape
  // vendor_profiles_public_read admits — carrying a full identity.
  const v = await db.query<{ vendor_profile_id: string }>(
    `UPDATE public.vendor_profiles
        SET business_name = 'Saysay Live Band',
            public_visibility = 'verified',
            verification_state = 'verified',
            tin_number = $2,
            business_owner_name = $3,
            registration_number_raw = $4,
            registered_address = '123 Katipunan Ave, Quezon City',
            last_verified_at = NOW()
      WHERE user_id = $1
      RETURNING vendor_profile_id`,
    [shopOwner, TIN, OWNER_NAME, REG_NO],
  );
  if (v.rows.length !== 1) {
    throw new Error(
      `expected exactly one auto-created vendor_profiles row for the seeded vendor account, got ${v.rows.length}`,
    );
  }
  const vendorProfileId = v.rows[0]!.vendor_profile_id;

  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
     VALUES ($1, $2, 'viewer')`,
    [vendorProfileId, teammate],
  );

  W = { shopOwner, teammate, stranger, vendorProfileId };
});

after(async () => {
  if (!db) return;
  await reset();
  await db.close?.();
});

/* ── 0. META — the session must genuinely be un-privileged ──────────────── */

test('META: the impersonated session is really `authenticated`, not the owner', async () => {
  await asAuthenticated(W.stranger);
  const r = await db.query<{ cu: string; bypass: boolean; owner: string; uid: string | null }>(
    `SELECT current_user AS cu,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass,
            (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = 'public.vendor_profiles'::regclass) AS owner,
            auth.uid()::text AS uid`,
  );
  const row = r.rows[0]!;
  assert.equal(row.cu, 'authenticated', 'SET ROLE did not take — every denial below would be vacuous');
  assert.equal(row.bypass, false, 'the authenticated role can BYPASSRLS — the whole suite would be meaningless');
  assert.notEqual(row.owner, 'authenticated', 'authenticated owns vendor_profiles — grants would not apply');
  assert.equal(row.uid, W.stranger, 'auth.uid() did not follow the impersonation — the self view could not be tested');
  await reset();
});

test('META: ANTI-VACUITY — every denied column exists, and the shop is real', async () => {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema='public' AND table_name='vendor_profiles'
        AND column_name = ANY($1::text[])`,
    [[...DENIED_TO_AUTHENTICATED]],
  );
  assert.equal(
    r.rows[0]!.n,
    DENIED_TO_AUTHENTICATED.length,
    'a denied column does not exist — every "cannot read it" assertion below would pass vacuously',
  );

  await asService();
  const v = await db.query<{ tin: string; nm: string }>(
    `SELECT tin_number AS tin, business_owner_name AS nm FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [W.vendorProfileId],
  );
  assert.equal(v.rows[0]?.tin, TIN, 'the seeded shop has no TIN — the deny assertions would prove nothing');
  assert.equal(v.rows[0]?.nm, OWNER_NAME);
  await reset();
});

/* ── 1. THE HOLE IS CLOSED ──────────────────────────────────────────────── */

test('a signed-in STRANGER cannot read the shop’s tax identity', async () => {
  for (const col of DENIED_TO_AUTHENTICATED) {
    await asAuthenticated(W.stranger);
    const err = await tryQuery(`SELECT ${col} FROM public.vendor_profiles`);
    await reset();
    assert.ok(
      err && /permission denied/i.test(err),
      `a signed-in stranger could SELECT vendor_profiles.${col} — got ${err === null ? 'SUCCESS' : err}`,
    );

    // DIFFERENTIAL CONTROL — the identical statement must succeed as
    // service_role, or the denial above is attributable to a typo, not a grant.
    await asService();
    const svc = await tryQuery(`SELECT ${col} FROM public.vendor_profiles`);
    await reset();
    assert.equal(svc, null, `service_role cannot read ${col} either — the deny test above proves nothing`);
  }
});

test('a signed-in stranger cannot smuggle a denied column through a WHERE, ORDER BY or aggregate', async () => {
  // Column privileges are checked on every column the QUERY references, not
  // only the select list. A guard that tests the select list alone would miss
  // `?tin_number=eq.123-456-789-000`, which is a membership oracle.
  const shapes = [
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE tin_number = '${TIN}'`,
    `SELECT vendor_profile_id FROM public.vendor_profiles ORDER BY business_owner_name`,
    `SELECT count(registration_number_raw) FROM public.vendor_profiles`,
    `SELECT business_owner_name FROM public.vendor_profiles WHERE public_visibility = 'verified'`,
  ];
  for (const sql of shapes) {
    await asAuthenticated(W.stranger);
    const err = await tryQuery(sql);
    await reset();
    assert.ok(err && /permission denied/i.test(err), `a denied column leaked through: ${sql} — got ${err ?? 'SUCCESS'}`);
  }
});

test('POSITIVE CONTROL: a signed-in stranger still reads the shop’s public columns, and gets a row', async () => {
  await asAuthenticated(W.stranger);
  const err = await tryQuery(
    `SELECT ${STILL_READABLE_BY_STRANGERS.join(', ')} FROM public.vendor_profiles`,
  );
  assert.equal(
    err,
    null,
    `the marketplace read broke — a column was missed by the re-GRANT, and PostgREST refuses the WHOLE query: ${err}`,
  );
  const rows = await db.query<{ business_name: string }>(
    `SELECT business_name FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [W.vendorProfileId],
  );
  assert.equal(
    rows.rows.length,
    1,
    'the stranger got zero rows — the SELECT "succeeding" would then prove nothing about column grants',
  );
  await reset();
});

test('EVERY non-denied column is still readable by `authenticated` — one at a time', async () => {
  // The bill, column by column, so a future ADD COLUMN that forgets its GRANT
  // is named rather than merely making some page 42501 in production.
  await asService();
  const cols = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='vendor_profiles'
        AND NOT (column_name = ANY($1::text[]))
      ORDER BY column_name`,
    [[...DENIED_TO_AUTHENTICATED]],
  );
  await reset();
  assert.ok(cols.rows.length > 50, `only ${cols.rows.length} non-denied columns — this is not vendor_profiles`);

  const ungranted: string[] = [];
  await asAuthenticated(W.stranger);
  for (const { column_name } of cols.rows) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_column_privilege('authenticated','public.vendor_profiles', $1, 'SELECT') AS ok`,
      [column_name],
    );
    if (!r.rows[0]!.ok) ungranted.push(column_name);
  }
  await reset();
  assert.deepEqual(ungranted, [], `authenticated lost SELECT on ${ungranted.length} column(s) it must keep`);
});

/* ── 2. THE SHOP CAN STILL READ ITS OWN — the half that breaks silently ── */

test('the SHOP reads its own tax identity through vendor_profiles_self', async () => {
  await asAuthenticated(W.shopOwner);
  const r = await db.query<{
    tin_number: string | null;
    business_owner_name: string | null;
    registration_number_raw: string | null;
    registered_address: string | null;
  }>(
    `SELECT tin_number, business_owner_name, registration_number_raw, registered_address
       FROM public.vendor_profiles_self`,
  );
  await reset();
  assert.equal(r.rows.length, 1, 'the shop reads ZERO rows of its own profile — its dashboard is blank');
  assert.equal(r.rows[0]!.tin_number, TIN);
  assert.equal(
    r.rows[0]!.business_owner_name,
    OWNER_NAME,
    'the shop cannot read its own owner name — the profile checklist would ask the supplier to type it again',
  );
  assert.equal(
    r.rows[0]!.registration_number_raw,
    REG_NO,
    'the shop cannot read its own registration number — verification submission is blocked forever',
  );
  assert.equal(r.rows[0]!.registered_address, '123 Katipunan Ave, Quezon City');
});

test('a TEAM MEMBER reads it too — the view mirrors vendor_profiles_member_read, it does not narrow it', async () => {
  await asAuthenticated(W.teammate);
  const r = await db.query<{ tin_number: string | null }>(
    `SELECT tin_number FROM public.vendor_profiles_self`,
  );
  await reset();
  assert.equal(r.rows.length, 1, 'a viewer-role teammate lost the shop profile they can read today');
  assert.equal(r.rows[0]!.tin_number, TIN);
});

test('the shop can still SELECT its own row by BOTH keys the app filters on', async () => {
  // lib/vendor-profile.ts filters by user_id (owner path) AND by
  // vendor_profile_id (active-shop / team-member path). A view that dropped
  // either column would break one of the two silently.
  for (const [uid, sql, params] of [
    [W.shopOwner, `SELECT business_owner_name FROM public.vendor_profiles_self WHERE user_id = $1`, [W.shopOwner]],
    [
      W.teammate,
      `SELECT business_owner_name FROM public.vendor_profiles_self WHERE vendor_profile_id = $1`,
      [W.vendorProfileId],
    ],
  ] as const) {
    await asAuthenticated(uid);
    const r = await db.query<{ business_owner_name: string }>(sql, [...params]);
    await reset();
    assert.equal(r.rows.length, 1, `the app's own filter shape returned nothing: ${sql}`);
    assert.equal(r.rows[0]!.business_owner_name, OWNER_NAME);
  }
});

test('WRITES SURVIVE: the shop can still update its own row', async () => {
  // The likeliest way to get this migration wrong is REVOKE ALL instead of
  // REVOKE SELECT — it reads as "tighter" and silently breaks every shop
  // editing itself.
  await asAuthenticated(W.shopOwner);
  const err = await tryQuery(
    `UPDATE public.vendor_profiles SET business_owner_name = $1 WHERE user_id = $2`,
    ['Juana R. Dela Cruz', W.shopOwner],
  );
  await reset();
  assert.equal(err, null, `the shop can no longer edit its own profile: ${err}`);

  await asService();
  const check = await db.query<{ nm: string }>(
    `SELECT business_owner_name AS nm FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [W.vendorProfileId],
  );
  await reset();
  assert.equal(check.rows[0]!.nm, 'Juana R. Dela Cruz', 'the UPDATE reported success and changed nothing');

  // put it back for the tests below
  await asService();
  await db.query(`UPDATE public.vendor_profiles SET business_owner_name = $1 WHERE vendor_profile_id = $2`, [
    OWNER_NAME,
    W.vendorProfileId,
  ]);
  await reset();
});

/* ── 3. THE SELF VIEW IS A FENCE, NOT A DOOR ────────────────────────────── */

test('a STRANGER reads ZERO rows from vendor_profiles_self — the definer view is scoped, not open', async () => {
  await asAuthenticated(W.stranger);
  const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.vendor_profiles_self`);
  await reset();
  assert.equal(
    r.rows[0]!.n,
    0,
    'a signed-in stranger reads rows through the definer view — it bypasses RLS, so its WHERE is the ENTIRE fence',
  );
});

test('anon cannot touch vendor_profiles_self at all', async () => {
  await asAnon();
  const err = await tryQuery(`SELECT tin_number FROM public.vendor_profiles_self`);
  await reset();
  assert.ok(
    err && /permission denied/i.test(err),
    `anon reached the self view — a logged-out caller would read every UNCLAIMED shop's identity: ${err ?? 'SUCCESS'}`,
  );
});

test('vendor_profiles_self is READ-ONLY — a definer view that is auto-updatable writes past RLS', async () => {
  for (const sql of [
    `UPDATE public.vendor_profiles_self SET business_owner_name = 'forged'`,
    `DELETE FROM public.vendor_profiles_self`,
    `INSERT INTO public.vendor_profiles_self (business_name) VALUES ('forged')`,
  ]) {
    await asAuthenticated(W.shopOwner);
    const err = await tryQuery(sql);
    await reset();
    assert.ok(
      err && /permission denied/i.test(err),
      `the self view accepted a write and would apply it as its OWNER, past vendor_profiles_owner: ${sql} — got ${err ?? 'SUCCESS'}`,
    );
  }
});

/* ── 4. anon IS UNTOUCHED ───────────────────────────────────────────────── */

test('anon’s column surface is unchanged — 21 columns, none of the eleven', async () => {
  const n = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema='public' AND table_name='vendor_profiles'
        AND has_column_privilege('anon','public.vendor_profiles', column_name, 'SELECT')`,
  );
  assert.equal(
    n.rows[0]!.n,
    21,
    'anon’s surface moved — 20271217955839 must not name anon in any statement',
  );

  await asAnon();
  const err = await tryQuery(`SELECT tin_number FROM public.vendor_profiles`);
  await reset();
  assert.ok(err && /permission denied/i.test(err), 'anon regained tin_number');
});

test('public.vendor_market_stats still serves anon — it is security_invoker and reads this table', async () => {
  // The revoke above is on `authenticated`, so this should be untouched; it is
  // asserted because a future editor "simplifying" the migration into a
  // REVOKE FROM PUBLIC would break every logged-out marketplace hit at once.
  await asAnon();
  const err = await tryQuery(`SELECT * FROM public.vendor_market_stats LIMIT 1`);
  await reset();
  assert.equal(err, null, `anon lost public.vendor_market_stats: ${err}`);
});

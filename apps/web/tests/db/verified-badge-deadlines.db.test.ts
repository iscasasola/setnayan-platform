/**
 * THE VERIFIED BADGE HAS A DEADLINE; THE SHOP DOES NOT — migration 20271221359289.
 *
 * Owner rulings 2026-09-11 (Q4 + Q5). The badge reads `next_renewal_due_at`;
 * listing and booking read `verification_state` alone. Three things have to be
 * true in the database for that to hold, and each is proven here against the
 * replayed migrations:
 *
 *   1. A SHOP CANNOT MOVE ITS OWN DEADLINE. Before this migration the column
 *      was writable by its vendor (FOR ALL own-row policy + table UPDATE grant +
 *      not named by the entitlement guard). Harmless while nothing read it; a
 *      badge that never expires once something does.
 *   2. Q4's BACKFILL picks exactly the right shops — verified, no approved
 *      papers, not already vouched — by condition, gives them a vouch row and
 *      the 12 March 2027 deadline, and touches NEITHER listing column.
 *      The replay applies it to an empty table, which proves nothing, so the
 *      block is re-run here from the migration's own text against fixtures.
 *   3. A VOUCH CAN NOW BE GRANTED. The grant used to write `verified` without
 *      `last_verified_at`, which `vendor_profiles_verified_requires_stamp`
 *      refuses on every UPDATE — the old shape is shown refused, the new one
 *      accepted.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, MIGRATIONS_DIR, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const DEADLINE_ISO = '2027-03-12T15:59:59.000Z';

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setAuthRole(null).catch(() => {});
}
/** Run a statement as the vendor; return the error message, or null if allowed. */
async function asVendorTry(uid: string, sql: string, params: unknown[]): Promise<string | null> {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
  try {
    await db.query(sql, params);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  } finally {
    await reset();
  }
}

async function makeVendor(email: string, name: string): Promise<{ uid: string; vid: string }> {
  await reset();
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
    [email],
  );
  const uid = u.rows[0]!.id;
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
     RETURNING vendor_profile_id`,
    [uid, name],
  );
  return { uid, vid: vp.rows[0]!.vendor_profile_id };
}

/** Service-role verification, the shape /admin/verify writes: all three in one UPDATE. */
async function verifyAsAdmin(vid: string, due: string | null): Promise<void> {
  await reset();
  await db.query(
    `UPDATE public.vendor_profiles
        SET verification_state = 'verified', public_visibility = 'verified',
            last_verified_at = now(), next_renewal_due_at = $2
      WHERE vendor_profile_id = $1`,
    [vid, due],
  );
}

type Row = { state: string; vis: string; due: string | null };
async function rowOf(vid: string): Promise<Row> {
  await reset();
  const r = await db.query<{ state: string; vis: string; due: Date | null }>(
    `SELECT verification_state::text AS state, public_visibility::text AS vis, next_renewal_due_at AS due
       FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vid],
  );
  const row = r.rows[0]!;
  return { state: row.state, vis: row.vis, due: row.due ? new Date(row.due).toISOString() : null };
}

const MIGRATION_FILE = readdirSync(MIGRATIONS_DIR).find((n) => n.endsWith('_verified_badge_deadlines.sql'));
function backfillSql(): string {
  assert.ok(MIGRATION_FILE, 'the badge-deadline migration is missing');
  const text = readFileSync(path.join(MIGRATIONS_DIR, MIGRATION_FILE!), 'utf8');
  const a = text.indexOf('-- BACKFILL:BEGIN');
  const b = text.indexOf('-- BACKFILL:END');
  assert.ok(a >= 0 && b > a, 'the BACKFILL markers are gone — this test would re-run nothing');
  return text.slice(a, b);
}

const V = {
  noDate: { uid: '', vid: '' },
  guard: { uid: '', vid: '' },
  early: { uid: '', vid: '' },
  approved: { uid: '', vid: '' },
  unverified: { uid: '', vid: '' },
  vouched: { uid: '', vid: '' },
};

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  V.guard = await makeVendor('badge-guard@test.test', 'Guard Studio');
  await verifyAsAdmin(V.guard.vid, '2027-01-01T00:00:00Z');
  V.early = await makeVendor('badge-early@test.test', 'Early Shop');
  await verifyAsAdmin(V.early.vid, '2027-08-08T02:16:42Z'); // SetnaProd's shape: approval + 1 year
  V.approved = await makeVendor('badge-approved@test.test', 'Papered Shop');
  await verifyAsAdmin(V.approved.vid, '2026-12-31T15:59:59Z');
  V.unverified = await makeVendor('badge-unverified@test.test', 'Unverified Shop');
  V.vouched = await makeVendor('badge-vouched@test.test', 'Already Vouched');
  await verifyAsAdmin(V.vouched.vid, '2026-12-01T00:00:00Z');
  V.noDate = await makeVendor('badge-nodate@test.test', 'No Date Shop');
  await verifyAsAdmin(V.noDate.vid, null); // Saysay's shape: verified, no deadline at all

  await reset();
  await db.query(
    `INSERT INTO public.vendor_verification_applications
       (vendor_profile_id, application_type, status, doc_uploads, docs_complete)
     VALUES ($1, 'initial', 'approved', '{}'::jsonb, TRUE)`,
    [V.approved.vid],
  );
  // A DRAFT application is not papers — the early shop in production has one.
  await db.query(
    `INSERT INTO public.vendor_verification_applications
       (vendor_profile_id, application_type, status, doc_uploads)
     VALUES ($1, 'initial', 'draft', '{}'::jsonb)`,
    [V.early.vid],
  );
  await db.query(
    `INSERT INTO public.vendor_verification_bypasses (vendor_profile_id, expires_at, reason)
     VALUES ($1, '2026-12-01T00:00:00Z', 'Vouched by an admin before this ran.')`,
    [V.vouched.vid],
  );
});

after(async () => {
  await reset();
  await db?.close?.();
});

/* ── 1 · THE DEADLINE IS A TRUST COLUMN ───────────────────────────────────── */

test('META: the guard names next_renewal_due_at on INSERT and UPDATE, and kept what it had', async () => {
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
      WHERE p.proname = 'guard_vendor_profiles_entitlement'`,
  );
  const def = r.rows[0]!.def;
  assert.ok(def.includes('NEW.next_renewal_due_at IS NOT NULL'), 'INSERT branch does not refuse a born deadline');
  assert.ok(
    def.includes('NEW.next_renewal_due_at IS DISTINCT FROM OLD.next_renewal_due_at'),
    'UPDATE branch does not refuse a moved deadline',
  );
  for (const kept of ['tier_source', 'last_verified_at', 'verification_state', 'public_visibility', 'pending_tier_sku_code']) {
    assert.ok(def.includes(kept), `the re-emitted guard lost ${kept}`);
  }
});

test('META: the column is still UPDATE-granted — the refusal below is the TRIGGER, not the ACL', async () => {
  const r = await db.query<{ ok: boolean }>(
    `SELECT has_column_privilege('authenticated','public.vendor_profiles','next_renewal_due_at','UPDATE') AS ok`,
  );
  assert.equal(r.rows[0]!.ok, true, 'the grant moved — the behavioural tests no longer probe the guard');
});

test('BEHAVIOURAL: a vendor cannot push their own badge deadline later', async () => {
  const msg = await asVendorTry(
    V.guard.uid,
    `UPDATE public.vendor_profiles SET next_renewal_due_at = '2099-01-01' WHERE vendor_profile_id = $1`,
    [V.guard.vid],
  );
  assert.ok(msg, 'a vendor extended their own Verified badge to 2099');
  assert.match(msg!, /self-grant blocked/i, `expected the entitlement guard, got: ${msg}`);
  assert.equal((await rowOf(V.guard.vid)).due, '2027-01-01T00:00:00.000Z');
});

test('BEHAVIOURAL: a vendor cannot clear it either — a NULL deadline is a badge that never lapses', async () => {
  const msg = await asVendorTry(
    V.guard.uid,
    `UPDATE public.vendor_profiles SET next_renewal_due_at = NULL WHERE vendor_profile_id = $1`,
    [V.guard.vid],
  );
  assert.ok(msg, 'a vendor cleared their own badge deadline');
  assert.match(msg!, /self-grant blocked/i);
});

test('BEHAVIOURAL: an ordinary vendor edit still goes through — the guard is not a wall', async () => {
  const msg = await asVendorTry(
    V.guard.uid,
    `UPDATE public.vendor_profiles SET tagline = 'Still editing my own shop' WHERE vendor_profile_id = $1`,
    [V.guard.vid],
  );
  assert.equal(msg, null, `a plain tagline edit was refused: ${msg}`);
});

test('BEHAVIOURAL: a self-created profile cannot be born holding a deadline', async () => {
  await reset();
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('badge-born@test.test', jsonb_build_object('account_type','customer')) RETURNING id`,
  );
  const born = u.rows[0]!.id;
  const msg = await asVendorTry(
    born,
    `INSERT INTO public.vendor_profiles (user_id, business_name, next_renewal_due_at)
     VALUES ($1, 'Born Dated Studio', '2099-01-01')`,
    [born],
  );
  assert.ok(msg, 'a profile was created already holding a badge deadline');
  assert.match(msg!, /self-grant blocked/i);
});

test('BEHAVIOURAL: the admin (service role) still writes it', async () => {
  await reset();
  await db.query(
    `UPDATE public.vendor_profiles SET next_renewal_due_at = '2027-02-02T00:00:00Z' WHERE vendor_profile_id = $1`,
    [V.guard.vid],
  );
  assert.equal((await rowOf(V.guard.vid)).due, '2027-02-02T00:00:00.000Z');
});

/* ── 2 · Q4 — THE BACKFILL, RE-RUN FROM THE MIGRATION'S OWN TEXT ──────────── */

test('Q4 · the backfill gives the right shops the vouch and the 12 March 2027 deadline — and no one else', async () => {
  await reset();
  await db.exec(backfillSql());

  const early = await rowOf(V.early.vid);
  assert.equal(early.due, DEADLINE_ISO, 'a verified shop with only a DRAFT application was not given the deadline');
  const noDate = await rowOf(V.noDate.vid);
  assert.equal(noDate.due, DEADLINE_ISO, 'a verified shop with NO deadline at all was skipped');

  assert.equal((await rowOf(V.approved.vid)).due, '2026-12-31T15:59:59.000Z', 'a papered shop had its permit date overwritten');
  assert.equal((await rowOf(V.vouched.vid)).due, '2026-12-01T00:00:00.000Z', 'an existing vouch was overwritten');
  assert.equal((await rowOf(V.unverified.vid)).due, null, 'an unverified shop was given a badge deadline');

  const rows = await db.query<{ vendor_profile_id: string; expires_at: Date; granted_by: string | null; reason: string }>(
    `SELECT vendor_profile_id, expires_at, granted_by, reason FROM public.vendor_verification_bypasses
      WHERE vendor_profile_id = ANY($1::uuid[])`,
    [[V.early.vid, V.noDate.vid, V.approved.vid, V.unverified.vid]],
  );
  assert.deepEqual(
    rows.rows.map((r) => r.vendor_profile_id).sort(),
    [V.early.vid, V.noDate.vid].sort(),
    'the vouch rows went to the wrong shops',
  );
  for (const r of rows.rows) {
    assert.equal(new Date(r.expires_at).toISOString(), DEADLINE_ISO);
    assert.match(r.reason, /2026-09-11 \(Q4\)/, 'the vouch does not say why it exists');
  }

  const audit = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.admin_audit_log
      WHERE action = 'vendor_verification_bypass_grant' AND target_id = ANY($1::text[])`,
    [[V.early.vid, V.noDate.vid]],
  );
  assert.equal(audit.rows[0]!.n, 2, 'the backfill left no audit trail');
});

test('⛔ Q4/Q5 · the backfill leaves every shop exactly as findable and bookable as it was', async () => {
  for (const v of [V.early, V.noDate, V.approved, V.vouched]) {
    const r = await rowOf(v.vid);
    assert.equal(r.state, 'verified', 'the backfill changed a verification state');
    assert.equal(r.vis, 'verified', 'the backfill changed a listing');
  }
  const u = await rowOf(V.unverified.vid);
  assert.equal(u.state, 'unverified');
  assert.equal(u.vis, 'hidden');
});

test('Q4 · the backfill is a no-op on a second run', async () => {
  await reset();
  const before = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.vendor_verification_bypasses`);
  await db.exec(backfillSql());
  const after2 = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.vendor_verification_bypasses`);
  assert.equal(after2.rows[0]!.n, before.rows[0]!.n, 'a second run vouched again');
});

/* ── 3 · A VOUCH CAN BE GRANTED ───────────────────────────────────────────── */

test('🔴 the OLD vouch shape (state only) is refused by the stamp CHECK — the bug this fixes', async () => {
  const fresh = await makeVendor('badge-vouch-old@test.test', 'Never Verified');
  await reset();
  let err: string | null = null;
  try {
    await db.query(
      `UPDATE public.vendor_profiles SET verification_state = 'verified', public_visibility = 'verified'
        WHERE vendor_profile_id = $1`,
      [fresh.vid],
    );
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
  assert.ok(err, 'the stamp CHECK no longer refuses verified-without-a-date — this test proves nothing');
  assert.match(err!, /vendor_profiles_verified_requires_stamp/);
});

test('the NEW vouch shape (state + stamp + deadline in one update) is accepted', async () => {
  const fresh = await makeVendor('badge-vouch-new@test.test', 'Vouched Now');
  await reset();
  await db.query(
    `UPDATE public.vendor_profiles
        SET verification_state = 'verified', public_visibility = 'verified',
            last_verified_at = now(), next_renewal_due_at = now() + interval '182 days'
      WHERE vendor_profile_id = $1`,
    [fresh.vid],
  );
  const r = await rowOf(fresh.vid);
  assert.equal(r.state, 'verified');
  assert.ok(r.due, 'the vouch deadline did not land');
});

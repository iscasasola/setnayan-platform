/**
 * A SHOP CANNOT AWARD ITSELF THE MARK THAT SAYS SETNAYAN CHECKED IT.
 *
 * ── WHAT WAS POSSIBLE ──────────────────────────────────────────────────────
 * Measured in this replay before migration 20271134103060, as an ordinary
 * vendor session (`authenticated`, own profile row):
 *
 *   UPDATE vendor_profiles SET experience_verified_at = now(),
 *          experience_verified_by = <self>            → ACCEPTED
 *
 * `app/v/[slug]/page.tsx:901` derives the public badge from that column, and
 * its tooltip tells couples the years-in-business figure was checked against
 * the vendor's government business registration. It also hides the
 * Confirm-against-DTI control on /admin/verify, so our own reviewer is told the
 * check is already done.
 *
 * And the quieter half, which the sweep did not find and a planning pass did:
 *
 *   (admin stamps the shop)
 *   UPDATE vendor_profiles SET in_business_since_year = 1975  → ACCEPTED,
 *   and the stamp SURVIVED — the badge then attested to a number the admin had
 *   never seen. The app clears it (vendor-dashboard/actions.ts:637) but that is
 *   an app courtesy; a direct PATCH skipped it.
 *
 * ── THE SHAPE ──────────────────────────────────────────────────────────────
 * `vendor_profiles_owner` is PERMISSIVE FOR ALL on `user_id = auth.uid()`: it
 * constrains WHOSE row it is and never what is in it. Fourth instance today —
 * see chat-sender-not-forgeable, broadcast-sender-not-forgeable and
 * users-privilege-escalation.
 *
 * The guard here already fired BEFORE INSERT OR UPDATE, so unlike the users
 * case the VERBS were covered. What was wrong was the LIST: it blocked ten
 * columns, called two of them "Trust columns" in its own comment, and never
 * gained the three that shipped later. A deny-list is a bill you keep paying.
 *
 * ── WHY NOT A GRANT REVOKE (as the two sender fixes used) ─────────────────
 * The vendor's own session legitimately NAMES these columns — the year-change
 * auto-unverify writes NULL through the caller's RLS client. Postgres checks
 * column privileges against the columns NAMED in a statement, not the values,
 * so a revoke would break every year edit while looking like a clean security
 * win. The trigger can tell the two apart; the grant cannot.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const TRUST_COLUMNS = ['experience_verified_at', 'experience_verified_by', 'last_verified_at'] as const;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asVendor(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setAuthRole(null).catch(() => {});
}
async function rollbackAndReset(): Promise<void> {
  await db.exec(`ROLLBACK`).catch(() => {});
  await reset();
}

/** Run a statement as the vendor; return the error message, or null if allowed. */
async function asVendorTry(uid: string, sql: string, params: unknown[]): Promise<string | null> {
  await asVendor(uid);
  try {
    await db.query(sql, params);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  } finally {
    await reset();
  }
}

type Row = { at: string | null; by: string | null; year: number | null; last: string | null };
async function rowOf(vid: string): Promise<Row> {
  await reset();
  const r = await db.query<Row>(
    `SELECT experience_verified_at::text AS at, experience_verified_by::text AS by,
            in_business_since_year AS year, last_verified_at::text AS last
       FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vid],
  );
  return r.rows[0]!;
}

/** The admin/service-role path: /admin/verify stamps through createAdminClient(). */
async function adminStamp(vid: string, uid: string): Promise<void> {
  await reset();
  await db.query(
    `UPDATE public.vendor_profiles
        SET experience_verified_at = now(), experience_verified_by = $2
      WHERE vendor_profile_id = $1`,
    [vid, uid],
  );
}

const F = { uid: '', vid: '' };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('exp-vendor@test.test', jsonb_build_object('account_type','vendor')) RETURNING id`,
  );
  F.uid = u.rows[0]!.id;

  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name)
     VALUES ($1, 'Experience Test Studio')
     ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
     RETURNING vendor_profile_id`,
    [F.uid],
  );
  F.vid = vp.rows[0]!.vendor_profile_id;
  // A starting year, set server-side so the fixture does not depend on the very
  // path under test.
  await db.query(
    `UPDATE public.vendor_profiles SET in_business_since_year = 2000 WHERE vendor_profile_id = $1`,
    [F.vid],
  );
});

after(async () => {
  await reset();
  await db?.close?.();
});

/* ── 0 · ANTI-VACUITY ─────────────────────────────────────────────────────── */

test('META: the guard now names all three trust columns — the exact probe that found the hole', async () => {
  // This regex IS the check that located the defect: the guard blocked ten
  // columns and none of these three. Turning it into the regression tripwire
  // means a future column added to the table and forgotten here fails loudly
  // the moment somebody re-runs the same question.
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
      WHERE p.proname = 'guard_vendor_profiles_entitlement'`,
  );
  assert.equal(r.rows.length, 1, 'guard_vendor_profiles_entitlement is missing');
  const def = r.rows[0]!.def;
  const absent = TRUST_COLUMNS.filter((c) => !def.includes(c));
  assert.deepEqual(absent, [], `the guard does not mention ${absent.join(', ')}`);
  // And it must still guard what it guarded before — a CREATE OR REPLACE from a
  // stale copy would silently drop these.
  for (const kept of ['verification_state', 'public_visibility', 'tier_state', 'ai_addon_level']) {
    assert.ok(def.includes(kept), `the guard stopped mentioning ${kept} — replaced from a stale body?`);
  }
});

test('META: the guard fires BEFORE both INSERT and UPDATE', async () => {
  const r = await db.query<{ before: boolean; ins: boolean; upd: boolean }>(
    `SELECT (t.tgtype & 2) = 2 AS before, (t.tgtype & 4) > 0 AS ins, (t.tgtype & 16) > 0 AS upd
       FROM pg_trigger t
      WHERE t.tgrelid = 'public.vendor_profiles'::regclass AND NOT t.tgisinternal
        AND t.tgfoid = 'public.guard_vendor_profiles_entitlement'::regproc`,
  );
  assert.equal(r.rows.length, 1, 'the entitlement guard trigger is missing');
  assert.deepEqual(r.rows[0], { before: true, ins: true, upd: true });
});

test('META: vendor_profiles_owner is still FOR ALL — the reason a policy cannot save us', async () => {
  const r = await db.query<{ cmd: string; permissive: boolean }>(
    `SELECT polcmd::text AS cmd, polpermissive AS permissive FROM pg_policy
      WHERE polrelid = 'public.vendor_profiles'::regclass AND polname = 'vendor_profiles_owner'`,
  );
  assert.equal(r.rows.length, 1, 'vendor_profiles_owner is missing');
  assert.equal(r.rows[0]!.cmd, '*', 'vendor_profiles_owner is no longer FOR ALL');
});

test('META: the probing role is authenticated, is not the owner, and has no BYPASSRLS', async () => {
  await db.exec(`SET ROLE authenticated`);
  const r = await db.query<{ me: string; owner: string; bypass: boolean }>(
    `SELECT current_user AS me, pg_get_userbyid(c.relowner) AS owner,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass
       FROM pg_class c WHERE c.oid = 'public.vendor_profiles'::regclass`,
  );
  await reset();
  assert.equal(r.rows[0]!.me, 'authenticated');
  assert.notEqual(r.rows[0]!.owner, 'authenticated', 'the probing role OWNS the table — it bypasses RLS');
  assert.equal(r.rows[0]!.bypass, false);
});

test('META: the columns are still writable in the ACL — this fix is the TRIGGER, not a revoke', async () => {
  // Deliberate. The vendor's own year-change path NAMES these columns to write
  // NULL, and Postgres checks column privileges against the columns named in
  // the statement. A revoke would break that path. If somebody later revokes
  // anyway, this test tells them the trigger tests below are no longer probing
  // what they claim to probe.
  for (const c of ['experience_verified_at', 'experience_verified_by']) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_column_privilege('authenticated','public.vendor_profiles',$1,'UPDATE') AS ok`,
      [c],
    );
    assert.equal(r.rows[0]!.ok, true, `${c} lost its UPDATE grant — the year-change unverify now fails`);
  }
});

/* ── 1 · BEHAVIOURAL ──────────────────────────────────────────────────────── */

test('BEHAVIOURAL: a vendor cannot stamp their own shop as Setnayan-checked', async () => {
  const msg = await asVendorTry(
    F.uid,
    `UPDATE public.vendor_profiles
        SET experience_verified_at = now(), experience_verified_by = $2
      WHERE vendor_profile_id = $1`,
    [F.vid, F.uid],
  );
  assert.ok(msg, 'a vendor stamped their own shop as experience-verified');
  assert.match(msg, /self-grant blocked/i, `expected the entitlement guard to refuse, got: ${msg}`);
  const row = await rowOf(F.vid);
  assert.equal(row.at, null, 'the stamp landed anyway');
});

test('BEHAVIOURAL: a vendor cannot set last_verified_at, not even to clear it', async () => {
  // Written only by /admin/verify. Unlike the experience stamp there is no
  // legitimate vendor-side clear, so this one is refused in both directions.
  const set = await asVendorTry(
    F.uid,
    `UPDATE public.vendor_profiles SET last_verified_at = now() WHERE vendor_profile_id = $1`,
    [F.vid],
  );
  assert.ok(set, 'a vendor set last_verified_at');
  assert.match(set, /self-grant blocked/i);
});

test('BEHAVIOURAL: a self-created profile cannot arrive pre-stamped', async () => {
  // A CUSTOMER signup on purpose: a vendor-type signup auto-provisions a
  // profile, and deleting that row to make room trips a different guard
  // ("VENDOR_LAST_ADMIN: a store must keep at least one admin"). A customer has
  // no profile yet, so this exercises the INSERT branch directly — which is
  // also the real shape of the open-shop flow.
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('exp-born@test.test', jsonb_build_object('account_type','customer')) RETURNING id`,
  );
  const born = u.rows[0]!.id;
  const msg = await asVendorTry(
    born,
    `INSERT INTO public.vendor_profiles (user_id, business_name, experience_verified_at)
     VALUES ($1, 'Born Verified Studio', now())`,
    [born],
  );
  assert.ok(msg, 'a profile was created already carrying the experience stamp');
  assert.match(msg, /self-grant blocked/i, `expected the INSERT branch to refuse, got: ${msg}`);
});

test('BEHAVIOURAL: the vendor CAN still clear the stamp — the year-change unverify lane', async () => {
  // The app writes exactly this (vendor-dashboard/actions.ts:637). If this
  // breaks, every vendor year edit 500s and the "fix" is worse than the bug.
  await adminStamp(F.vid, F.uid);
  assert.ok((await rowOf(F.vid)).at != null, 'fixture: the admin stamp did not land');

  const msg = await asVendorTry(
    F.uid,
    `UPDATE public.vendor_profiles
        SET in_business_since_year = 1990, experience_verified_at = NULL, experience_verified_by = NULL
      WHERE vendor_profile_id = $1`,
    [F.vid],
  );
  assert.equal(msg, null, `the legitimate year-change unverify was refused: ${msg}`);
  const row = await rowOf(F.vid);
  assert.equal(row.at, null, 'the stamp was not cleared');
  assert.equal(row.year, 1990, 'the year did not change');
});

test('BEHAVIOURAL: changing the year CLEARS the stamp even when the vendor never names it', async () => {
  // The second hole. The app clears it as a courtesy; a direct PATCH skipped
  // that and the badge went on attesting to a number nobody checked.
  await adminStamp(F.vid, F.uid);
  assert.ok((await rowOf(F.vid)).at != null, 'fixture: the admin stamp did not land');

  const msg = await asVendorTry(
    F.uid,
    `UPDATE public.vendor_profiles SET in_business_since_year = 1975 WHERE vendor_profile_id = $1`,
    [F.vid],
  );
  assert.equal(msg, null, `the year edit was refused: ${msg}`);
  const row = await rowOf(F.vid);
  assert.equal(row.year, 1975, 'the year did not change');
  assert.equal(
    row.at,
    null,
    'the experience stamp SURVIVED a year change. The badge now claims Setnayan checked a ' +
      'number the admin never saw.',
  );
  assert.equal(row.by, null, 'experience_verified_by survived a year change');
});

test('BEHAVIOURAL: an ordinary profile edit is untouched', async () => {
  const msg = await asVendorTry(
    F.uid,
    `UPDATE public.vendor_profiles SET business_name = 'Renamed Studio' WHERE vendor_profile_id = $1`,
    [F.vid],
  );
  assert.equal(msg, null, `an ordinary vendor edit was refused: ${msg}`);
});

test('BEHAVIOURAL: the admin/service-role path still stamps', async () => {
  // The guard exempts anything that is not an end-user session. If this broke,
  // /admin/verify could no longer confirm anybody.
  await adminStamp(F.vid, F.uid);
  const row = await rowOf(F.vid);
  assert.ok(row.at != null, 'the service-role stamp no longer lands — /admin/verify is broken');
  assert.equal(row.by, F.uid, 'experience_verified_by was not recorded');
});

/* ── 2 · NEUTRALISATION ───────────────────────────────────────────────────── */

test('NEUTRALISATION: restoring the pre-fix guard body lets the self-stamp through again', async () => {
  // Proves these tests bite on the guard's column list specifically, and not on
  // some other control that happens to be refusing.
  await db.exec(`BEGIN`);
  try {
    await db.exec(`
      CREATE OR REPLACE FUNCTION public.guard_vendor_profiles_entitlement()
      RETURNS trigger LANGUAGE plpgsql AS $fn$
      BEGIN
        IF current_user IN ('authenticated','anon') AND NOT public.is_admin() THEN
          IF TG_OP = 'UPDATE' AND NEW.verification_state IS DISTINCT FROM OLD.verification_state THEN
            RAISE EXCEPTION 'self-grant blocked' USING ERRCODE = 'insufficient_privilege';
          END IF;
        END IF;
        RETURN NEW;
      END $fn$;`);
    await db.query(
      `UPDATE public.vendor_profiles SET experience_verified_at = NULL, experience_verified_by = NULL
        WHERE vendor_profile_id = $1`,
      [F.vid],
    );
    const msg = await asVendorTry(
      F.uid,
      `UPDATE public.vendor_profiles
          SET experience_verified_at = now(), experience_verified_by = $2
        WHERE vendor_profile_id = $1`,
      [F.vid, F.uid],
    );
    assert.equal(msg, null, `with the old guard restored the self-stamp was still refused: ${msg}`);
    const row = await rowOf(F.vid);
    assert.ok(
      row.at != null,
      'the forged stamp did not land even with the pre-fix guard restored — this suite is no ' +
        'longer reproducing the defect it claims to prevent',
    );
  } finally {
    await rollbackAndReset();
  }
});

test('NEUTRALISATION: without the auto-clear, a year change preserves the stamp', async () => {
  // The other half, isolated: strip ONLY the year-change clear and show the
  // stamp surviving. If this did not change the outcome, the clear would be
  // decorative and the behavioural test above would be proving nothing.
  await db.exec(`BEGIN`);
  try {
    await db.exec(`
      CREATE OR REPLACE FUNCTION public.guard_vendor_profiles_entitlement()
      RETURNS trigger LANGUAGE plpgsql AS $fn$
      BEGIN
        IF current_user IN ('authenticated','anon') AND NOT public.is_admin() THEN
          IF TG_OP = 'UPDATE'
             AND (NEW.experience_verified_at IS DISTINCT FROM OLD.experience_verified_at
                  AND NEW.experience_verified_at IS NOT NULL) THEN
            RAISE EXCEPTION 'self-grant blocked' USING ERRCODE = 'insufficient_privilege';
          END IF;
        END IF;
        RETURN NEW;
      END $fn$;`);
    await adminStamp(F.vid, F.uid);
    const msg = await asVendorTry(
      F.uid,
      `UPDATE public.vendor_profiles SET in_business_since_year = 1960 WHERE vendor_profile_id = $1`,
      [F.vid],
    );
    assert.equal(msg, null, `the year edit was refused: ${msg}`);
    const row = await rowOf(F.vid);
    assert.ok(
      row.at != null,
      'the stamp cleared even without the auto-clear branch — something ELSE is clearing it, so ' +
        'the branch in the migration is not what the behavioural test is measuring',
    );
  } finally {
    await rollbackAndReset();
  }
});

/**
 * A VENDOR CANNOT MINT THEIR OWN VERIFICATION ROW.
 * End-to-end (test:db, every migration replayed into PGlite).
 *
 * ── THE HOLE THIS LOCKS ────────────────────────────────────────────────────
 * `public.vendor_verifications` shipped with a table-level INSERT grant to
 * `authenticated` (Supabase's pg_default_acl — no migration ever granted it)
 * and a single INSERT policy whose WITH CHECK constrained exactly ONE column:
 *
 *     EXISTS (SELECT 1 FROM vendor_profiles vp
 *             WHERE vp.vendor_profile_id = vendor_verifications.vendor_profile_id
 *               AND vp.user_id = auth.uid())
 *
 * It authenticates the SHOP and says nothing about the other 28 columns. So a
 * signed-in vendor could POST through PostgREST with the public anon key and
 * choose `status`, `approved_at`, `approved_by_admin_user_id`, `sanctions_clear`
 * … and both identity `*_r2_key` columns.
 *
 * That is not merely a fake badge. `sweepVerifications`
 * (lib/vendor-identity-retention.ts, fired from admin/layout.tsx `after()`)
 * selects rows where `approved_at`/`rejected_at` is set, derives the 90-day
 * retention clock FROM THOSE SAME COLUMNS, and then deletes the R2 object named
 * by `government_id_r2_key` — on the ADMIN client, so RLS protects nothing on
 * the target. `parseStoredAsset` accepts all five buckets in `R2_BUCKETS`, and
 * `setnayan-media` keys are published in our own page source inside presigned
 * URLs. So: forge one row with a 120-day-old `approved_at` and a victim's media
 * key, and the next admin page load permanently deletes somebody else's object.
 *
 * Migration 20271218766967 revokes INSERT/UPDATE/DELETE at TABLE level from
 * `authenticated` + `anon` and drops the orphaned self-insert policy. There are
 * ZERO writers of this table in the repo, so nothing legitimate is broken; the
 * live vendor intake writes `vendor_verification_applications` instead.
 *
 * ── ⚠ WHAT THIS SUITE PROVES, AND WHAT IT DOES NOT ─────────────────────────
 * It DOES prove enforcement, not just the catalogue: every denial below runs
 * after `SET ROLE authenticated`, and the META test asserts that role is not the
 * table owner and holds neither SUPERUSER nor BYPASSRLS — the two ways this repo
 * has previously shipped db tests that passed vacuously.
 *
 * It does NOT prove anything about PRODUCTION's live ACL. The replay builds the
 * database from the migration files, so it proves the migration produces the
 * intended state — not that the state was reached on the live database. ⛔ AND
 * THE USUAL PRODUCTION `BEGIN…ROLLBACK` DRY-RUN WAS NOT PERFORMED: the session
 * that wrote this had no production access. See the PR body.
 *
 * Four defences, all mandatory — do not delete one to make an edit easier:
 *   1. META — the session is really `authenticated`, not an owner, not superuser.
 *   2. POSITIVE CONTROL — the same session still SELECTs its own row, so a
 *      denial below is attributable to the revoke and not to broken wiring.
 *   3. DIFFERENTIAL CONTROL — every refused statement succeeds as `service_role`.
 *   4. NEUTRALISATION PROOF — re-grant + recreate the policy inside a
 *      transaction, re-run the exact attack, assert it SUCCEEDS, roll back. If
 *      the fix ever became a no-op this goes red, so the suite cannot decay into
 *      "passes because nothing is being tested".
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

/** The victim object — the shape a shop logo key really has in page source. */
const VICTIM_MEDIA_REF =
  'r2://setnayan-media/vendors/8f14e45f-ceea-467a-9f2a-1c2d3e4f5a6b/logo/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-logo.png';

let replay: ReplayResult;
let db: PGlite;

let attackerUid: string;
let attackerVpid: string;

async function asAttacker(): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, attackerUid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec('SET ROLE authenticated');
}

async function asServer(): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await db.exec('SET ROLE service_role');
}

async function asOwner(): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
}

/** The forged row, exactly as the exploit writes it. */
const FORGERY = `
  INSERT INTO public.vendor_verifications
    (vendor_profile_id, status, approved_at, government_id_r2_key)
  VALUES ($1, 'approved', NOW() - INTERVAL '120 days', $2)
  RETURNING verification_id`;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  await asOwner();
  // 'customer', not 'vendor': the signup trigger auto-creates a vendor_profile
  // for a 'vendor' account, and vendor_profiles.user_id is UNIQUE — so the
  // explicit insert below would collide. Same shape as `newShop` in the
  // sibling db tests.
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('vv-attacker@revoke.test', jsonb_build_object('account_type','customer'::text))
     RETURNING id`,
  );
  attackerUid = u.rows[0]!.id;

  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Forger Studio', 'Manila', ARRAY['photography']::text[], 'unverified', NOW())
     RETURNING vendor_profile_id`,
    [attackerUid],
  );
  attackerVpid = v.rows[0]!.vendor_profile_id;
});

after(async () => {
  if (!db) return;
  await db.exec('RESET ROLE').catch(() => {});
  // Close the PGlite handle, not the replay result — `ReplayResult` has no
  // `close`. Same teardown as orders-payments-insert-revoke.db.test.ts.
  await db.close?.();
});

/* ── 0 · META — without this the whole file can pass vacuously ─────────────── */

test('META: the session is really `authenticated` — not an owner, not BYPASSRLS', async () => {
  await asAttacker();
  const r = await db.query<{
    cu: string;
    superuser: boolean;
    bypassrls: boolean;
    owns: boolean;
  }>(`
    SELECT current_user AS cu,
           (SELECT rolsuper    FROM pg_roles WHERE rolname = current_user) AS superuser,
           (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypassrls,
           (SELECT pg_get_userbyid(c.relowner) = current_user
              FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = 'vendor_verifications') AS owns
  `);
  const row = r.rows[0]!;
  assert.equal(row.cu, 'authenticated', 'SET ROLE did not take — every denial below is vacuous');
  assert.equal(row.superuser, false, 'a superuser skips privilege checks entirely');
  assert.equal(row.bypassrls, false, 'BYPASSRLS would skip the policy layer');
  assert.equal(row.owns, false, 'a table owner skips RLS — the denials would prove nothing');
});

test('META: RLS is enabled — with no INSERT policy this is the second lock', async () => {
  await asOwner();
  const r = await db.query<{ on: boolean }>(`
    SELECT c.relrowsecurity AS on
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'vendor_verifications'`);
  assert.equal(r.rows[0]!.on, true);
});

/* ── 1 · The catalogue agrees ──────────────────────────────────────────────── */

test('THE CATALOGUE: no write verb survives at TABLE level for either session role', async () => {
  await asOwner();
  const r = await db.query<{ grantee: string; privilege_type: string }>(`
    SELECT grantee, privilege_type
      FROM information_schema.role_table_grants
     WHERE table_schema = 'public' AND table_name = 'vendor_verifications'
       AND grantee IN ('authenticated','anon')
       AND privilege_type IN ('INSERT','UPDATE','DELETE')`);
  assert.deepEqual(
    r.rows,
    [],
    `A write grant is back on vendor_verifications: ${JSON.stringify(r.rows)}. ` +
      'The forgery lane is open again.',
  );
});

test('THE CATALOGUE: no COLUMN write grant survives either', async () => {
  // 🔑 A table-level REVOKE is what drops column grants; revoking column by
  // column leaves the NEXT column granted. And `has_table_privilege` answers
  // FALSE while a column grant stands, so the table check above cannot see this.
  // (No DELETE here: DELETE has no column form — column privileges are only
  // SELECT / INSERT / UPDATE / REFERENCES.)
  await asOwner();
  const r = await db.query<{ grantee: string; column_name: string; privilege_type: string }>(`
    SELECT grantee, column_name, privilege_type
      FROM information_schema.column_privileges
     WHERE table_schema = 'public' AND table_name = 'vendor_verifications'
       AND grantee IN ('authenticated','anon')
       AND privilege_type IN ('INSERT','UPDATE')`);
  assert.deepEqual(
    r.rows,
    [],
    `A column-level write grant survives: ${JSON.stringify(r.rows)}`,
  );
});

test('THE CATALOGUE: the orphaned INSERT policy is gone, the READ policy stayed', async () => {
  await asOwner();
  const r = await db.query<{ policyname: string; cmd: string }>(`
    SELECT policyname, cmd FROM pg_policies
     WHERE schemaname='public' AND tablename='vendor_verifications'
     ORDER BY policyname`);
  const names = r.rows.map((x) => x.policyname);
  assert.ok(
    !names.includes('vendor_verifications_self_insert'),
    'The self-insert policy is back. With pg_default_acl re-granting INSERT on any ' +
      'table rebuild, that policy is the only thing left refusing the write.',
  );
  assert.ok(
    names.includes('vendor_verifications_self_read'),
    'The READ policy was lost — a wider narrowing than the finding supports.',
  );
});

/* ── 2 · POSITIVE CONTROL — the wiring works and nothing was over-revoked ──── */

test('POSITIVE CONTROL: the vendor can still SELECT their own row', async () => {
  await asServer();
  await db.query(
    `INSERT INTO public.vendor_verifications (vendor_profile_id, status)
     VALUES ($1, 'pending')`,
    [attackerVpid],
  );

  await asAttacker();
  const r = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.vendor_verifications WHERE vendor_profile_id = $1`,
    [attackerVpid],
  );
  assert.equal(
    r.rows[0]!.n,
    1,
    'SELECT was taken too. The revoke overreached — and a denial-only suite would ' +
      'never notice, because everything would simply fail.',
  );
});

/* ── 3 · THE ATTACK — refused ──────────────────────────────────────────────── */

test('THE ATTACK: a vendor cannot insert an approved row naming a victim’s object', async () => {
  await asAttacker();
  await assert.rejects(
    () => db.query(FORGERY, [attackerVpid, VICTIM_MEDIA_REF]),
    /permission denied|new row violates row-level security/i,
    'THE VULNERABILITY IS BACK: a signed-in vendor can mint an approved verification ' +
      'row whose government_id_r2_key names another shop’s live media object, and the ' +
      'retention sweep will delete it.',
  );
});

test('THE ATTACK: the row really is absent — a rejection is not proof on its own', async () => {
  // 🔑 A refused write and a written-then-invisible row look identical from the
  // caller's seat under RLS. Count as the owner, who sees everything.
  await asOwner();
  const r = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.vendor_verifications
      WHERE government_id_r2_key = $1`,
    [VICTIM_MEDIA_REF],
  );
  assert.equal(r.rows[0]!.n, 0, 'The forged row exists — the rejection above was for another reason');
});

test('UPDATE and DELETE are refused too — they no longer rely on a missing policy', async () => {
  await asAttacker();
  await assert.rejects(
    () =>
      db.query(
        `UPDATE public.vendor_verifications SET status='approved', approved_at=NOW()
          WHERE vendor_profile_id=$1`,
        [attackerVpid],
      ),
    /permission denied/i,
    'UPDATE was refused only by the absent policy before; it should now fail on the grant.',
  );
  await assert.rejects(
    () => db.query(`DELETE FROM public.vendor_verifications WHERE vendor_profile_id=$1`, [attackerVpid]),
    /permission denied/i,
  );
});

/* ── 4 · DIFFERENTIAL CONTROL — the server can still do all of it ──────────── */

test('DIFFERENTIAL: service_role still writes the table', async () => {
  await asServer();
  const ins = await db.query<{ verification_id: string }>(FORGERY, [
    attackerVpid,
    'r2://setnayan-vendor-verification/vendors/v1/id.jpg',
  ]);
  const id = ins.rows[0]!.verification_id;
  assert.ok(id, 'The server lost its own write — the revoke went too wide');

  await db.query(`UPDATE public.vendor_verifications SET status='rejected' WHERE verification_id=$1`, [id]);
  await db.query(`DELETE FROM public.vendor_verifications WHERE verification_id=$1`, [id]);
});

/* ── 5 · NEUTRALISATION PROOF — the suite cannot decay into vacuity ────────── */

test('NEUTRALISATION: restoring BOTH the grant and the policy re-opens the attack', async () => {
  // If this ever fails, the denials above are passing for some reason other
  // than the fix, and the whole file is decoration.
  await asOwner();
  await db.exec('BEGIN');
  try {
    await db.exec(`GRANT INSERT ON public.vendor_verifications TO authenticated`);
    await db.exec(`
      CREATE POLICY vendor_verifications_self_insert
        ON public.vendor_verifications FOR INSERT TO authenticated
        WITH CHECK (EXISTS (
          SELECT 1 FROM public.vendor_profiles vp
           WHERE vp.vendor_profile_id = vendor_verifications.vendor_profile_id
             AND vp.user_id = auth.uid()))`);

    await asAttacker();
    const r = await db.query<{ verification_id: string }>(FORGERY, [attackerVpid, VICTIM_MEDIA_REF]);
    assert.ok(
      r.rows[0]?.verification_id,
      'Even with the grant and policy restored the attack failed — something else is ' +
        'refusing it, so the assertions above do not attribute to this migration.',
    );
  } finally {
    await asOwner();
    await db.exec('ROLLBACK');
  }

  // And the rollback really undid it.
  const after = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.vendor_verifications WHERE government_id_r2_key = $1`,
    [VICTIM_MEDIA_REF],
  );
  assert.equal(after.rows[0]!.n, 0);
});

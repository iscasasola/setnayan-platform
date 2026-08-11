/**
 * NOBODY PROMOTES THEMSELVES TO ADMIN.
 *
 * ── WHAT WAS POSSIBLE ──────────────────────────────────────────────────────
 * Measured in this exact replay before migration 20271132891176, as an ordinary
 * `authenticated` customer session holding nothing but their own signup:
 *
 *   UPDATE public.users SET account_type='admin'      → silently reverted ✅
 *   DELETE FROM public.users WHERE user_id = <self>   → 1 row deleted
 *   INSERT INTO public.users (…, account_type)
 *     VALUES (<self>, …, 'admin', is_internal=true)   → ACCEPTED
 *   SELECT public.is_admin()                          → TRUE
 *
 * `is_admin()` is trusted by ~298 RLS policies and by the /admin gate in
 * middleware.ts, so that was the whole platform: vendor government IDs, guest
 * face-enrolment records, payments, everything.
 *
 * ── THE SHAPE ──────────────────────────────────────────────────────────────
 * `guard_users_privilege_columns` was correct and fired `BEFORE UPDATE` only.
 * Every escalation it was written to stop was imagined as an EDIT — and a row
 * can also be REPLACED. A guard is only as wide as the verbs it fires on, and
 * DELETE+INSERT is a rename for UPDATE that no correctness in the function body
 * can catch.
 *
 * `user_owns_row` is PERMISSIVE FOR ALL with `user_id = auth.uid()`, which
 * covers DELETE and INSERT. Deleting your own row and inserting your own row
 * both satisfy it perfectly: the policy is about WHOSE row and never had an
 * opinion about what is IN it — the same shape as the two sender-forgery fixes
 * shipped the same day (20271132839561 · 20271132843141).
 *
 * ── 🪤 A HARNESS DIVERGENCE THIS SUITE HAD TO WORK AROUND ─────────────────
 * Production `auth.role()` is `coalesce(nullif(claim,''), claims->>'role')` and
 * returns NULL on a direct connection. The replay shim (replay-migrations.ts)
 * is `COALESCE(NULLIF(claim,''), 'anon')` — it can NEVER return NULL. So the
 * guard's `v_role IS NULL` branch, which is how a migration / superuser / the
 * SECURITY DEFINER signup trigger identify themselves in production, is DEAD
 * CODE in every db test in this repo.
 *
 * The first cut of the fix relied on it and silently stripped the § 10a owner
 * flag at signup — under test only. The migration now also derives privilege
 * from `current_user`, which is true in both environments, and the tests below
 * assert the owner and vendor signup outcomes so a repeat is caught by what a
 * person would notice rather than by reading the shim.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const OWNER_EMAIL = 'iscasasolaii@gmail.com';

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asUser(uid: string): Promise<void> {
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

/** Create an auth.users row — i.e. sign up. The SECURITY DEFINER trigger
 *  `handle_new_auth_user` provisions public.users off the back of it. */
async function signup(email: string, accountType: 'customer' | 'vendor' = 'customer') {
  await reset();
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}

type Shape = { n: number; account_type: string | null; is_internal: boolean | null; is_team_member: boolean | null };
async function shapeOf(uid: string): Promise<Shape> {
  await reset();
  const r = await db.query<Shape>(
    `SELECT count(*)::int AS n, max(account_type::text) AS account_type,
            bool_or(is_internal) AS is_internal, bool_or(is_team_member) AS is_team_member
       FROM public.users WHERE user_id = $1`,
    [uid],
  );
  return r.rows[0]!;
}

async function isAdmin(uid: string): Promise<boolean> {
  await asUser(uid);
  const r = await db.query<{ ok: boolean }>(`SELECT public.is_admin() AS ok`);
  await reset();
  return r.rows[0]!.ok;
}

/** Run a statement as `uid`; return the error message, or null if allowed. */
async function attempt(uid: string, sql: string, params: unknown[]): Promise<string | null> {
  await asUser(uid);
  try {
    await db.query(sql, params);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  } finally {
    await reset();
  }
}

const F = { attacker: '' };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  F.attacker = await signup('escalation-probe@test.test');
});

after(async () => {
  await reset();
  await db?.close?.();
});

/* ── 0 · ANTI-VACUITY ─────────────────────────────────────────────────────── */

test('META: is_admin() still keys off users.account_type = admin', async () => {
  // The entire premise. If is_admin() moved to another column or table, this
  // suite is guarding the wrong thing and should be re-argued, not inherited.
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
      WHERE p.proname = 'is_admin'`,
  );
  assert.equal(r.rows.length, 1, 'public.is_admin() is missing');
  assert.match(r.rows[0]!.def, /public\.users/, 'is_admin() no longer reads public.users');
  assert.match(r.rows[0]!.def, /account_type\s*=\s*'admin'/, "is_admin() no longer keys off account_type='admin'");
});

test('META: the guard trigger exists and fires on BOTH insert and update', async () => {
  // The whole fix. `tgtype` bit 2 = BEFORE, bit 4 = INSERT, bit 16 = UPDATE.
  const r = await db.query<{ is_before: boolean; on_insert: boolean; on_update: boolean }>(
    `SELECT (t.tgtype & 2) = 2 AS is_before, (t.tgtype & 4) > 0 AS on_insert,
            (t.tgtype & 16) > 0 AS on_update
       FROM pg_trigger t
      WHERE t.tgrelid = 'public.users'::regclass AND NOT t.tgisinternal
        AND t.tgname = 'guard_users_privilege_columns_trg'`,
  );
  assert.equal(r.rows.length, 1, 'guard_users_privilege_columns_trg is missing');
  assert.deepEqual(
    r.rows[0],
    { is_before: true, on_insert: true, on_update: true },
    'the guard no longer covers BEFORE INSERT OR UPDATE. INSERT is the half that closes ' +
      'DELETE-then-INSERT; UPDATE is the half that was already there.',
  );
});

test('META: user_owns_row is still FOR ALL — the reason a policy could not save us', async () => {
  // If this ever becomes per-verb, the story changes and somebody should read
  // this file rather than assume it still applies.
  const r = await db.query<{ polname: string; cmd: string; permissive: boolean }>(
    `SELECT polname, polcmd::text AS cmd, polpermissive AS permissive
       FROM pg_policy WHERE polrelid = 'public.users'::regclass AND polname = 'user_owns_row'`,
  );
  assert.equal(r.rows.length, 1, 'user_owns_row is missing');
  assert.equal(r.rows[0]!.cmd, '*', 'user_owns_row is no longer FOR ALL');
  assert.equal(r.rows[0]!.permissive, true, 'user_owns_row is no longer PERMISSIVE');
});

test('META: the probing role is authenticated, is not the owner, and has no BYPASSRLS', async () => {
  await db.exec(`SET ROLE authenticated`);
  const r = await db.query<{ me: string; owner: string; bypass: boolean }>(
    `SELECT current_user AS me, pg_get_userbyid(c.relowner) AS owner,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass
       FROM pg_class c WHERE c.oid = 'public.users'::regclass`,
  );
  await reset();
  assert.equal(r.rows[0]!.me, 'authenticated', 'SET ROLE did not take');
  assert.notEqual(r.rows[0]!.owner, 'authenticated', 'the probing role OWNS public.users — it bypasses RLS');
  assert.equal(r.rows[0]!.bypass, false, 'the probing role has BYPASSRLS');
});

test('META: authenticated keeps SELECT and UPDATE — a narrowing, not a demolition', async () => {
  // Profile editing is legitimate and must survive; the guard neutralises the
  // privileged columns on UPDATE rather than refusing the whole statement.
  for (const p of ['SELECT', 'UPDATE']) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_table_privilege('authenticated', 'public.users', $1) AS ok`,
      [p],
    );
    assert.equal(r.rows[0]!.ok, true, `authenticated lost ${p} on public.users — profile editing breaks`);
  }
  const svc = await db.query<{ i: boolean; d: boolean }>(
    `SELECT has_table_privilege('service_role','public.users','INSERT') AS i,
            has_table_privilege('service_role','public.users','DELETE') AS d`,
  );
  assert.deepEqual(svc.rows[0], { i: true, d: true }, 'service_role lost INSERT/DELETE on public.users');
});

test('META: 🪤 auth.role() can never be NULL in this replay — so do not rely on it', async () => {
  // Documented as an executable fact because the first cut of the fix DID rely
  // on it and stripped the owner's § 10a flag under test. Production returns
  // NULL here; the shim returns 'anon'. If the shim is ever corrected, this
  // test fails and whoever fixed it gets to delete this warning.
  await reset();
  const r = await db.query<{ role: string | null }>(`SELECT auth.role() AS role`);
  assert.notEqual(
    r.rows[0]!.role,
    null,
    'auth.role() now returns NULL when unset, matching production. The replay shim has been ' +
      'corrected — remove this test and the current_user fallback comment in migration ' +
      '20271132891176 may be revisited.',
  );
});

/* ── 1 · THE CLOSURE ──────────────────────────────────────────────────────── */

test('authenticated and anon hold NO INSERT and NO DELETE on public.users', async () => {
  const open: string[] = [];
  for (const role of ['anon', 'authenticated']) {
    for (const p of ['INSERT', 'DELETE']) {
      const r = await db.query<{ ok: boolean }>(
        `SELECT has_table_privilege($1, 'public.users', $2) AS ok`,
        [role, p],
      );
      if (r.rows[0]!.ok) open.push(`${role}.${p}`);
    }
  }
  assert.deepEqual(
    open,
    [],
    `${open.join(', ')} is still held. Nothing in apps/web creates or deletes a user row from a ` +
      'browser session — the only INSERT and DELETE are in scripts/stress-test-lock-unlock.ts, ' +
      'both service-role.',
  );
});

/* ── 2 · BEHAVIOURAL — the whole chain, walked for real ───────────────────── */

test('BEHAVIOURAL: the UPDATE route is still neutralised (the half that already worked)', async () => {
  const msg = await attempt(
    F.attacker,
    `UPDATE public.users SET account_type='admin', is_internal=true, is_team_member=true
      WHERE user_id=$1`,
    [F.attacker],
  );
  assert.equal(msg, null, 'the UPDATE was refused outright; it is supposed to succeed and be neutralised');
  const s = await shapeOf(F.attacker);
  assert.deepEqual(
    { at: s.account_type, ii: s.is_internal, tm: s.is_team_member },
    { at: 'customer', ii: false, tm: false },
    'the UPDATE branch of the guard stopped neutralising privilege columns',
  );
  assert.equal(await isAdmin(F.attacker), false, 'is_admin() went true via UPDATE');
});

test('BEHAVIOURAL: the escalation chain — DELETE own row, re-INSERT as admin — is refused', async () => {
  const del = await attempt(F.attacker, `DELETE FROM public.users WHERE user_id=$1`, [F.attacker]);
  assert.ok(del, 'an ordinary session deleted its own users row');
  assert.match(del, /permission denied/i, `expected a permission failure on DELETE, got: ${del}`);

  const ins = await attempt(
    F.attacker,
    `INSERT INTO public.users (user_id,email,account_type,is_internal,is_team_member)
     VALUES ($1,'escalation-probe@test.test','admin',true,true)`,
    [F.attacker],
  );
  assert.ok(ins, 'an ordinary session inserted a users row');
  assert.match(ins, /permission denied/i, `expected a permission failure on INSERT, got: ${ins}`);

  const s = await shapeOf(F.attacker);
  assert.equal(s.n, 1, 'the account row survived the attempt');
  assert.equal(s.account_type, 'customer', 'the account is still an ordinary customer');
  assert.equal(await isAdmin(F.attacker), false, 'is_admin() is true for an ordinary account');
});

test('BEHAVIOURAL: signing up still provisions an ordinary account', async () => {
  const uid = await signup('fresh-signup@test.test');
  const s = await shapeOf(uid);
  assert.deepEqual(
    { n: s.n, at: s.account_type, ii: s.is_internal, tm: s.is_team_member },
    { n: 1, at: 'customer', ii: false, tm: false },
    'signup no longer provisions a public.users row correctly — the guard is refusing or ' +
      'rewriting the SECURITY DEFINER trigger that creates it',
  );
});

test('BEHAVIOURAL: the § 10a owner signup KEEPS its internal flag', async () => {
  // A fix that quietly downgrades the owner's own account would look exactly
  // like success everywhere else in this file. handle_new_auth_user hardcodes
  // is_internal = TRUE for this address.
  const uid = await signup(OWNER_EMAIL);
  const s = await shapeOf(uid);
  assert.equal(s.n, 1, 'the owner signup did not provision a row');
  assert.equal(
    s.is_internal,
    true,
    'the § 10a owner flag was stripped at signup. The guard is treating the SECURITY DEFINER ' +
      'signup trigger as an ordinary caller — check the privileged test, and note that ' +
      'auth.role() is NEVER null in this replay even though it is in production.',
  );
});

test('BEHAVIOURAL: a vendor signup still lands as a vendor', async () => {
  const uid = await signup('fresh-vendor@test.test', 'vendor');
  const s = await shapeOf(uid);
  assert.equal(s.account_type, 'vendor', 'vendor signup was downgraded by the INSERT branch');
});

/* ── 3 · NEUTRALISATION — each half proven load-bearing ───────────────────── */

test('NEUTRALISATION: re-granting INSERT+DELETE re-opens the chain — but the TRIGGER refuses the promotion', async () => {
  // Half two removed. The row can be destroyed and rebuilt again, so the ACL is
  // demonstrably what refuses it above. And with the ACL out of the way, half
  // one is exposed on its own: the rebuilt row comes back as an ordinary
  // customer, and is_admin() stays false.
  await db.exec(`BEGIN`);
  try {
    await db.exec(`GRANT INSERT, DELETE ON public.users TO authenticated`);
    const del = await attempt(F.attacker, `DELETE FROM public.users WHERE user_id=$1`, [F.attacker]);
    assert.equal(del, null, `the re-grant did not restore DELETE — the refusal is not the ACL's doing: ${del}`);

    const ins = await attempt(
      F.attacker,
      `INSERT INTO public.users (user_id,email,account_type,is_internal,is_team_member)
       VALUES ($1,'escalation-probe@test.test','admin',true,true)`,
      [F.attacker],
    );
    assert.equal(ins, null, `the re-grant did not restore INSERT: ${ins}`);

    const s = await shapeOf(F.attacker);
    assert.deepEqual(
      { at: s.account_type, ii: s.is_internal, tm: s.is_team_member },
      { at: 'customer', ii: false, tm: false },
      'with the grants restored the forged admin row SURVIVED — the BEFORE INSERT branch is not ' +
        'firing, so the REVOKE is carrying the whole fix alone',
    );
    assert.equal(await isAdmin(F.attacker), false, 'is_admin() went true with grants restored');
  } finally {
    await rollbackAndReset();
  }
});

test('NEUTRALISATION: with BOTH halves removed the original escalation succeeds again', async () => {
  // The full reproduction, so nobody has to take the docblock's word for what
  // this migration prevents.
  await db.exec(`BEGIN`);
  try {
    await db.exec(`GRANT INSERT, DELETE ON public.users TO authenticated`);
    await db.exec(`DROP TRIGGER guard_users_privilege_columns_trg ON public.users`);
    await db.exec(`CREATE TRIGGER guard_users_privilege_columns_trg
                     BEFORE UPDATE ON public.users FOR EACH ROW
                     EXECUTE FUNCTION public.guard_users_privilege_columns()`);

    assert.equal(await attempt(F.attacker, `DELETE FROM public.users WHERE user_id=$1`, [F.attacker]), null);
    assert.equal(
      await attempt(
        F.attacker,
        `INSERT INTO public.users (user_id,email,account_type,is_internal,is_team_member)
         VALUES ($1,'escalation-probe@test.test','admin',true,true)`,
        [F.attacker],
      ),
      null,
      'the re-INSERT was refused even with both halves removed',
    );
    assert.equal(
      await isAdmin(F.attacker),
      true,
      'restoring the pre-fix state did NOT restore the escalation — this suite is no longer ' +
        'reproducing the defect it claims to prevent, and its green means nothing',
    );
  } finally {
    await rollbackAndReset();
  }
});

test('NEUTRALISATION: an admin session is still allowed to set these columns', async () => {
  // The guard must not lock out the people it exists to protect. A real admin
  // creating or flagging an internal account has to keep working, or the fix
  // has broken the § 10a / team-pool surfaces instead of protecting them.
  await db.exec(`BEGIN`);
  try {
    await db.query(`UPDATE public.users SET account_type='admin' WHERE user_id=$1`, [F.attacker]);
    assert.equal(await isAdmin(F.attacker), true, 'the seeded admin is not seen as an admin');

    await db.exec(`GRANT INSERT ON public.users TO authenticated`);
    const target = await signup('admin-created@test.test');
    await db.query(`DELETE FROM public.users WHERE user_id=$1`, [target]);
    const ins = await attempt(
      F.attacker,
      `INSERT INTO public.users (user_id,email,account_type,is_internal,is_team_member)
       VALUES ($1,'admin-created@test.test','admin',true,true)`,
      [target],
    );
    assert.equal(ins, null, `an admin session could not insert a users row: ${ins}`);
    const s = await shapeOf(target);
    assert.deepEqual(
      { at: s.account_type, ii: s.is_internal, tm: s.is_team_member },
      { at: 'admin', ii: true, tm: true },
      'an ADMIN session had its privileged columns neutralised — the guard is now stopping the ' +
        'people it is supposed to let through',
    );
  } finally {
    await rollbackAndReset();
  }
});

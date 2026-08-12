/**
 * A VERIFICATION APPLICATION CANNOT BE BORN APPROVED, AND THE APPLICANT CANNOT
 * WRITE THE DECISION ON THEIR OWN APPLICATION.
 *
 * Seventh instance of the shape, and the SECOND time the specific fault is "the
 * rule is enforced on one verb and not the other". `users-privilege-escalation`
 * was a trigger attached BEFORE UPDATE only; here the rule lives in RLS and the
 * same half is missing:
 *
 *   ..._owner_update_draft (FOR UPDATE)
 *     WITH CHECK (owns the vendor AND status IN ('draft','pending_review'))
 *   ..._owner_insert       (FOR INSERT)
 *     WITH CHECK (owns the vendor)          ← nothing about status
 *
 * Measured in this replay before migration 20271135231726:
 *   vendor INSERTs status='approved'                          → ACCEPTED
 *   vendor INSERTs decision='approved', admin_user_id=<admin>  → ACCEPTED
 *   vendor UPDATEs the decision on their own application       → ACCEPTED
 *
 * ── HONEST SEVERITY ────────────────────────────────────────────────────────
 * This does NOT make anybody verified. The badge couples see comes from
 * `vendor_profiles.verification_state`, a different column on a different table,
 * already blocked for end-user sessions by guard_vendor_profiles_entitlement.
 * What a forged row does is (a) never enter the review queue — /admin/verify
 * filters `.in('status', tabFilter.statuses)`, so an 'approved' row sits under
 * the Approved tab and no reviewer opens it — and (b) carry a decision record
 * naming an admin who never made it. Audit integrity, not privilege escalation,
 * on the table whose whole purpose is recording who checked whom.
 *
 * ── WHY status IS STILL GRANTED AND THE DECISION COLUMNS ARE NOT ──────────
 * The vendor legitimately writes `status` twice — 'draft' at create,
 * 'pending_review' at submit — so revoking it would break the flow, and the
 * POLICY is the right control there. The decision columns have no legitimate
 * end-user write at all, so the GRANT is the right control for those. Two
 * controls, chosen per column by what the app actually needs to name.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const TABLE = 'public.vendor_verification_applications';
const DECISION_COLUMNS = [
  'admin_user_id', 'decision', 'decision_reason', 'decided_at', 'notes',
  'contact_email_confirmed_at', 'contact_email_confirmed_by',
  'contact_phone_confirmed_at', 'contact_phone_confirmed_by',
] as const;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asVendor(): Promise<void> {
  await setAuthUid(db, F.uid);
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
async function vendorTry(sql: string, params: unknown[] = []): Promise<string | null> {
  await asVendor();
  try {
    await db.query(sql, params);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  } finally {
    await reset();
  }
}
type Row = { status: string; decision: string | null; admin_user_id: string | null };
async function appRows(): Promise<Row[]> {
  await reset();
  const r = await db.query<Row>(
    `SELECT status, decision, admin_user_id::text AS admin_user_id
       FROM ${TABLE} WHERE vendor_profile_id = $1 ORDER BY created_at`,
    [F.vid],
  );
  return r.rows;
}
async function colPriv(role: string, col: string, priv: 'INSERT' | 'UPDATE'): Promise<boolean> {
  const r = await db.query<{ ok: boolean }>(
    `SELECT has_column_privilege($1,$2,$3,$4) AS ok`,
    [role, TABLE, col, priv],
  );
  return r.rows[0]!.ok;
}

const F = { uid: '', adminUid: '', vid: '' };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const mk = async (email: string, t: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data)
         VALUES ($1, jsonb_build_object('account_type',$2::text)) RETURNING id`,
        [email, t],
      )
    ).rows[0]!.id;
  F.uid = await mk('verif-vendor@test.test', 'vendor');
  F.adminUid = await mk('verif-admin@test.test', 'customer');
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name)
     VALUES ($1, 'Verification Test Studio')
     ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
     RETURNING vendor_profile_id`,
    [F.uid],
  );
  F.vid = vp.rows[0]!.vendor_profile_id;
});

after(async () => {
  await reset();
  await db?.close?.();
});

/* ── 0 · ANTI-VACUITY ─────────────────────────────────────────────────────── */

test('META: the INSERT policy now constrains status, matching its UPDATE sibling', async () => {
  const r = await db.query<{ polname: string; wc: string }>(
    `SELECT polname, coalesce(pg_get_expr(polwithcheck, polrelid),'') AS wc
       FROM pg_policy WHERE polrelid = $1::regclass AND polcmd = 'a'`,
    [TABLE],
  );
  assert.equal(r.rows.length, 1, `expected exactly one INSERT policy, found ${r.rows.length}`);
  assert.match(
    r.rows[0]!.wc,
    /status\s*=\s*'draft'/,
    "the INSERT policy does not pin status to 'draft'. The UPDATE sibling constrains the state " +
      'machine and the INSERT one must too, or a row can be created in any state it likes.',
  );
  assert.match(r.rows[0]!.wc, /vendor_profiles/, 'the INSERT policy stopped checking ownership');
});

test('META: the UPDATE policy still constrains status — the half that always worked', async () => {
  const r = await db.query<{ wc: string }>(
    `SELECT coalesce(pg_get_expr(polwithcheck, polrelid),'') AS wc FROM pg_policy
      WHERE polrelid = $1::regclass AND polname = 'vendor_verification_applications_owner_update_draft'`,
    [TABLE],
  );
  assert.equal(r.rows.length, 1, 'the owner_update_draft policy is missing');
  assert.match(r.rows[0]!.wc, /'draft'/, 'the UPDATE policy stopped constraining status');
  assert.match(r.rows[0]!.wc, /'pending_review'/, 'the UPDATE policy no longer admits the submit step');
});

test('META: status is deliberately STILL granted — the policy, not the grant, controls it', async () => {
  // The vendor names this column twice in the legitimate flow. If somebody
  // revokes it later, the create and submit steps break and the tests below
  // stop probing the policy they claim to probe.
  for (const p of ['INSERT', 'UPDATE'] as const) {
    assert.equal(
      await colPriv('authenticated', 'status', p),
      true,
      `status lost its ${p} grant — creating or submitting an application now fails`,
    );
  }
});

test('META: the probing role is authenticated, is not the owner, and has no BYPASSRLS', async () => {
  await db.exec(`SET ROLE authenticated`);
  const r = await db.query<{ me: string; owner: string; bypass: boolean }>(
    `SELECT current_user AS me, pg_get_userbyid(c.relowner) AS owner,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass
       FROM pg_class c WHERE c.oid = $1::regclass`,
    [TABLE],
  );
  await reset();
  assert.equal(r.rows[0]!.me, 'authenticated');
  assert.notEqual(r.rows[0]!.owner, 'authenticated');
  assert.equal(r.rows[0]!.bypass, false);
});

test('META: service_role keeps every decision column — /admin/verify must still rule', async () => {
  const denied: string[] = [];
  for (const c of DECISION_COLUMNS) {
    for (const p of ['INSERT', 'UPDATE'] as const) {
      if (!(await colPriv('service_role', c, p))) denied.push(`${c}.${p}`);
    }
  }
  assert.deepEqual(denied, [], `service_role lost ${denied.join(', ')}`);
});

/* ── 1 · THE CLOSURE ──────────────────────────────────────────────────────── */

test('authenticated and anon hold no INSERT or UPDATE on any decision column', async () => {
  const open: string[] = [];
  for (const role of ['anon', 'authenticated']) {
    for (const c of DECISION_COLUMNS) {
      for (const p of ['INSERT', 'UPDATE'] as const) {
        if (await colPriv(role, c, p)) open.push(`${role}.${c}.${p}`);
      }
    }
  }
  assert.deepEqual(open, [], `${open.join(', ')} is writable by the applicant`);
});

/* ── 2 · BEHAVIOURAL ──────────────────────────────────────────────────────── */

test('BEHAVIOURAL: an application cannot be born approved', async () => {
  const msg = await vendorTry(
    `INSERT INTO ${TABLE} (vendor_profile_id, application_type, fee_php_centavos, status, doc_uploads)
     VALUES ($1,'initial',0,'approved','{}'::jsonb)`,
    [F.vid],
  );
  assert.ok(msg, 'a vendor created an application already approved');
  assert.match(msg, /row-level security/i, `expected the INSERT policy to refuse, got: ${msg}`);
});

test('BEHAVIOURAL: nor born pending_review — only draft', async () => {
  const msg = await vendorTry(
    `INSERT INTO ${TABLE} (vendor_profile_id, application_type, fee_php_centavos, status, doc_uploads)
     VALUES ($1,'initial',0,'pending_review','{}'::jsonb)`,
    [F.vid],
  );
  assert.ok(msg, 'an application was created straight into the review queue, skipping draft');
  assert.match(msg, /row-level security/i);
});

test('BEHAVIOURAL: a vendor cannot write a decision record naming an admin', async () => {
  const msg = await vendorTry(
    `INSERT INTO ${TABLE} (vendor_profile_id, application_type, fee_php_centavos, status, doc_uploads,
                           decision, decided_at, admin_user_id, decision_reason)
     VALUES ($1,'initial',0,'draft','{}'::jsonb,'approved',now(),$2,'Looks great')`,
    [F.vid, F.adminUid],
  );
  assert.ok(msg, 'a vendor wrote a decision record naming an admin');
  assert.match(msg, /permission denied/i, `expected a column-privilege failure, got: ${msg}`);
});

test('BEHAVIOURAL: the legitimate create → submit flow still works', async () => {
  assert.equal(
    await vendorTry(
      `INSERT INTO ${TABLE} (vendor_profile_id, application_type, fee_php_centavos, status, doc_uploads)
       VALUES ($1,'initial',0,'draft','{}'::jsonb)`,
      [F.vid],
    ),
    null,
    'a vendor can no longer create a draft application',
  );
  assert.equal(
    await vendorTry(
      `UPDATE ${TABLE} SET status='pending_review', submitted_at=now(),
              sla_due_at=now()+interval '3 days', updated_at=now()
        WHERE vendor_profile_id=$1 AND status='draft'`,
      [F.vid],
    ),
    null,
    'a vendor can no longer submit their application',
  );
  const rows = await appRows();
  assert.equal(rows.length, 1, `expected exactly the one legitimate row, got ${rows.length}`);
  assert.equal(rows[0]!.status, 'pending_review', 'the submit did not take');
  assert.equal(rows[0]!.decision, null, 'a decision appeared without an admin');
});

test('BEHAVIOURAL: a vendor cannot decide their own submitted application', async () => {
  const msg = await vendorTry(
    `UPDATE ${TABLE} SET decision='approved', decided_at=now(), admin_user_id=$2
      WHERE vendor_profile_id=$1`,
    [F.vid, F.adminUid],
  );
  assert.ok(msg, 'a vendor decided their own application');
  assert.match(msg, /permission denied/i);
  assert.equal((await appRows())[0]!.decision, null, 'the decision landed anyway');
});

test('BEHAVIOURAL: the admin (service-role) still decides', async () => {
  await reset();
  await db.query(
    `UPDATE ${TABLE} SET status='approved', decision='approved', decided_at=now(), admin_user_id=$2
      WHERE vendor_profile_id=$1`,
    [F.vid, F.adminUid],
  );
  const row = (await appRows())[0]!;
  assert.equal(row.status, 'approved', '/admin/verify can no longer approve');
  assert.equal(row.admin_user_id, F.adminUid, 'the deciding admin was not recorded');
});

test('BEHAVIOURAL: a forged application still would not make anybody verified', async () => {
  // The honest-severity claim, asserted rather than argued: the badge lives on a
  // different table and a different guard. If this ever stops being true, the
  // severity of this whole finding changes and somebody should find out here.
  await reset();
  const r = await db.query<{ vs: string }>(
    `SELECT verification_state::text AS vs FROM public.vendor_profiles WHERE vendor_profile_id=$1`,
    [F.vid],
  );
  assert.notEqual(
    r.rows[0]!.vs,
    'verified',
    'an approved application row alone flipped vendor_profiles.verification_state — this finding ' +
      'is a privilege escalation after all, not just an audit-integrity defect',
  );
});

/* ── 3 · NEUTRALISATION ───────────────────────────────────────────────────── */

test('NEUTRALISATION: restoring the unconstrained INSERT policy lets a born-approved row through', async () => {
  await db.exec(`BEGIN`);
  try {
    await db.exec(`DROP POLICY vendor_verification_applications_owner_insert ON ${TABLE}`);
    await db.exec(`
      CREATE POLICY vendor_verification_applications_owner_insert ON ${TABLE}
        FOR INSERT TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM public.vendor_profiles vp
                             WHERE vp.vendor_profile_id = vendor_verification_applications.vendor_profile_id
                               AND vp.user_id = auth.uid()))`);
    const msg = await vendorTry(
      `INSERT INTO ${TABLE} (vendor_profile_id, application_type, fee_php_centavos, status, doc_uploads)
       VALUES ($1,'initial',0,'approved','{}'::jsonb)`,
      [F.vid],
    );
    assert.equal(
      msg,
      null,
      `restoring the old policy did not restore the defect — this suite is not reproducing what it claims: ${msg}`,
    );
  } finally {
    await rollbackAndReset();
  }
});

test('NEUTRALISATION: re-granting the decision columns lets the forged record through', async () => {
  await db.exec(`BEGIN`);
  try {
    await db.exec(`GRANT INSERT (decision, decided_at, admin_user_id) ON ${TABLE} TO authenticated`);
    const msg = await vendorTry(
      `INSERT INTO ${TABLE} (vendor_profile_id, application_type, fee_php_centavos, status, doc_uploads,
                             decision, decided_at, admin_user_id)
       VALUES ($1,'initial',0,'draft','{}'::jsonb,'approved',now(),$2)`,
      [F.vid, F.adminUid],
    );
    assert.equal(
      msg,
      null,
      `the re-grant did not restore the forged decision — the refusal is not attributable to the ACL: ${msg}`,
    );
  } finally {
    await rollbackAndReset();
  }
});

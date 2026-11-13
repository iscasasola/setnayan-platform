/**
 * ADMIN AREAS × LEVELS + THE OWNER APPROVES HIS OWN REQUEST (migrations replayed).
 * DECISION_LOG 2026-11-13, both rows. Migration
 * 20271344663185_admin_team_areas_levels_and_owner_self_approval.sql.
 *
 * What the database itself must hold, whatever the app does:
 *
 *   1. The owner cannot decide his own request before 24 hours have passed —
 *      on the DATABASE clock, so a client cannot back-date the start.
 *   2. Once the wait has passed, the owner (and only the owner) may.
 *   3. A staff admin can never decide their own request, wait or no wait.
 *   4. An audit row records its area and its actor; an unknown area is refused.
 *   5. admin_scopes only takes the 16 known areas and two levels, has RLS on,
 *      and a browser session cannot write it.
 *
 * The "after 24 hours" cases cannot wait a real day, so they back-date the row
 * with the guard trigger switched off for that one statement — the same thing
 * the clock would do — and switch it straight back on before the decision.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let ownerId: string;
let staffId: string;
let otherId: string;

const OWNER_EMAIL = 'iscasasolaii@gmail.com';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  ownerId = await makeUser(OWNER_EMAIL);
  staffId = await makeUser('staff-admin@test.com');
  otherId = await makeUser('someone@test.com');
  // The signup trigger marks the owner's address internal (§ 10a); make sure.
  await db.query(`UPDATE public.users SET is_internal = TRUE WHERE user_id = $1`, [ownerId]);
  await db.query(`UPDATE public.users SET is_team_member = TRUE WHERE user_id = $1`, [staffId]);
});

after(async () => {
  await replay?.db?.close?.();
});

async function makeUser(email: string): Promise<string> {
  const a = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const id = a.rows[0]!.id;
  await db.query(`INSERT INTO public.users (user_id, email) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, email]);
  return id;
}

async function newRequest(initiatedBy: string): Promise<string> {
  const r = await db.query<{ approval_id: string }>(
    `INSERT INTO public.admin_approval_requests (action_type, target_user_id, rationale, initiated_by)
     VALUES ('grant_team_member', $1, 'add them', $2) RETURNING approval_id`,
    [otherId, initiatedBy],
  );
  return r.rows[0]!.approval_id;
}

/** "Type the word": the app sends any time; the trigger stamps the real one. */
async function typeTheWord(approvalId: string, claimedTime = '2000-01-01T00:00:00Z') {
  await db.query(
    `UPDATE public.admin_approval_requests
        SET self_confirmed_at = $2::timestamptz, run_after = $2::timestamptz
      WHERE approval_id = $1`,
    [approvalId, claimedTime],
  );
}

/** Let 25 hours pass for this row (trigger off for one statement only). */
async function letTheDayPass(approvalId: string) {
  await db.query(`ALTER TABLE public.admin_approval_requests DISABLE TRIGGER admin_approval_requests_owner_self_approval`);
  try {
    await db.query(
      `UPDATE public.admin_approval_requests
          SET created_at = NOW() - INTERVAL '26 hours',
              self_confirmed_at = NOW() - INTERVAL '25 hours',
              run_after = NOW() - INTERVAL '1 hour'
        WHERE approval_id = $1`,
      [approvalId],
    );
  } finally {
    await db.query(`ALTER TABLE public.admin_approval_requests ENABLE TRIGGER admin_approval_requests_owner_self_approval`);
  }
}

async function selfDecide(approvalId: string, by: string) {
  return db.query(
    `UPDATE public.admin_approval_requests
        SET status = 'approved', decided_by = $2, decided_at = NOW()
      WHERE approval_id = $1`,
    [approvalId, by],
  );
}

test('ANCHOR — the owner is the owner and the staff admin is not', async () => {
  const r = await db.query<{ o: boolean; s: boolean }>(
    `SELECT public.is_platform_owner($1) AS o, public.is_platform_owner($2) AS s`,
    [ownerId, staffId],
  );
  assert.equal(r.rows[0]!.o, true, 'the owner fixture must read as the owner, or every test below proves nothing');
  assert.equal(r.rows[0]!.s, false);
});

test('typing the word: the DATABASE stamps the time — a back-dated start is overwritten', async () => {
  const id = await newRequest(ownerId);
  await typeTheWord(id, '2000-01-01T00:00:00Z');
  const r = await db.query<{ late: boolean; wait_ok: boolean }>(
    `SELECT self_confirmed_at > NOW() - INTERVAL '1 minute' AS late,
            run_after >= self_confirmed_at + INTERVAL '24 hours' AS wait_ok
       FROM public.admin_approval_requests WHERE approval_id = $1`,
    [id],
  );
  assert.equal(r.rows[0]!.late, true, 'self_confirmed_at kept the client’s year-2000 value — the wait could be skipped');
  assert.equal(r.rows[0]!.wait_ok, true);
});

test('the owner CANNOT approve his own request before 24 hours', async () => {
  const id = await newRequest(ownerId);
  await typeTheWord(id);
  await assert.rejects(() => selfDecide(id, ownerId), /24-hour wait has not passed|admin_approval_four_eyes/);
  const s = await db.query<{ status: string }>(`SELECT status FROM public.admin_approval_requests WHERE approval_id=$1`, [id]);
  assert.equal(s.rows[0]!.status, 'pending');
});

test('the owner cannot approve his own request without typing the word at all', async () => {
  const id = await newRequest(ownerId);
  await assert.rejects(() => selfDecide(id, ownerId), /24-hour wait has not passed|admin_approval_four_eyes/);
});

test('the wait cannot be moved once it has started', async () => {
  const id = await newRequest(ownerId);
  await typeTheWord(id);
  await assert.rejects(
    () =>
      db.query(
        `UPDATE public.admin_approval_requests SET run_after = NOW() - INTERVAL '1 hour' WHERE approval_id = $1`,
        [id],
      ),
    /cannot be moved/,
  );
});

test('after 24 hours the owner may approve his own request', async () => {
  const id = await newRequest(ownerId);
  await typeTheWord(id);
  await letTheDayPass(id);
  await selfDecide(id, ownerId);
  const s = await db.query<{ status: string; decided_by: string }>(
    `SELECT status, decided_by FROM public.admin_approval_requests WHERE approval_id=$1`,
    [id],
  );
  assert.equal(s.rows[0]!.status, 'approved');
  assert.equal(s.rows[0]!.decided_by, ownerId);
});

test('a staff admin can NEVER type the word on their own request', async () => {
  const id = await newRequest(staffId);
  await assert.rejects(() => typeTheWord(id), /only the owner/);
});

test('a staff admin can never decide their own request, even with the day back-dated', async () => {
  const id = await newRequest(staffId);
  await letTheDayPass(id); // forces self_confirmed_at/run_after past, trigger off
  await assert.rejects(() => selfDecide(id, staffId), /different admin must decide|admin_approval_four_eyes/);
});

test('a different admin still decides as before (four eyes unchanged)', async () => {
  const id = await newRequest(staffId);
  await db.query(
    `UPDATE public.admin_approval_requests SET status='approved', decided_by=$2, decided_at=NOW() WHERE approval_id=$1`,
    [id, ownerId],
  );
  const s = await db.query<{ status: string }>(`SELECT status FROM public.admin_approval_requests WHERE approval_id=$1`, [id]);
  assert.equal(s.rows[0]!.status, 'approved');
});

test('Cancel: the requester may withdraw their own request; nobody else may', async () => {
  const id = await newRequest(staffId);
  await assert.rejects(
    () =>
      db.query(
        `UPDATE public.admin_approval_requests SET status='withdrawn', decided_by=$2, decided_at=NOW() WHERE approval_id=$1`,
        [id, ownerId],
      ),
    /admin_approval_withdrawn_by_requester/,
  );
  await db.query(
    `UPDATE public.admin_approval_requests SET status='withdrawn', decided_by=$2, decided_at=NOW() WHERE approval_id=$1`,
    [id, staffId],
  );
  const s = await db.query<{ status: string }>(`SELECT status FROM public.admin_approval_requests WHERE approval_id=$1`, [id]);
  assert.equal(s.rows[0]!.status, 'withdrawn');
});

test('grant_admin_escalated is in the action vocabulary', async () => {
  await db.query(
    `INSERT INTO public.admin_approval_requests (action_type, target_user_id, payload, rationale, initiated_by)
     VALUES ('grant_admin_escalated', $1, '{"scopes":{"escalated":["payments"]}}', 'trusted', $2)`,
    [otherId, staffId],
  );
});

test('an audit row records its AREA and its ACTOR; an unknown area is refused', async () => {
  const r = await db.query<{ area: string; actor_user_id: string }>(
    `INSERT INTO public.admin_audit_log (action, area, target_table, actor_user_id, reason)
     VALUES ('approval_approved:approve_large_refund', 'refunds', 'admin_approval_requests', $1, 'checked')
     RETURNING area, actor_user_id`,
    [staffId],
  );
  assert.equal(r.rows[0]!.area, 'refunds');
  assert.equal(r.rows[0]!.actor_user_id, staffId);
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.admin_audit_log (action, area, actor_user_id) VALUES ('x', 'not_an_area', $1)`,
        [staffId],
      ),
    /admin_audit_log_area_known/,
  );
});

test('admin_scopes: RLS on, 16 areas × 2 levels, and the browser cannot write it', async () => {
  const rls = await db.query<{ on: boolean }>(
    `SELECT relrowsecurity AS on FROM pg_class WHERE oid = 'public.admin_scopes'::regclass`,
  );
  assert.equal(rls.rows[0]!.on, true);
  const n = await db.query<{ n: number }>(`SELECT array_length(public.admin_areas(), 1) AS n`);
  assert.equal(n.rows[0]!.n, 16);

  await db.query(`INSERT INTO public.admin_scopes (user_id, area, level) VALUES ($1, 'help', 'basic')`, [staffId]);
  await assert.rejects(
    () => db.query(`INSERT INTO public.admin_scopes (user_id, area, level) VALUES ($1, 'nope', 'basic')`, [staffId]),
    /check/i,
  );
  await assert.rejects(
    () => db.query(`INSERT INTO public.admin_scopes (user_id, area, level) VALUES ($1, 'help', 'super')`, [staffId]),
    /check/i,
  );

  const grants = await db.query<{ ins: boolean; upd: boolean; del: boolean }>(
    `SELECT has_table_privilege('authenticated', 'public.admin_scopes', 'INSERT') AS ins,
            has_table_privilege('authenticated', 'public.admin_scopes', 'UPDATE') AS upd,
            has_table_privilege('authenticated', 'public.admin_scopes', 'DELETE') AS del`,
  );
  assert.deepEqual(grants.rows[0], { ins: false, upd: false, del: false });
});

test('work_escalations: one open escalation per item, RLS on', async () => {
  const rls = await db.query<{ on: boolean }>(
    `SELECT relrowsecurity AS on FROM pg_class WHERE oid = 'public.work_escalations'::regclass`,
  );
  assert.equal(rls.rows[0]!.on, true);
  await db.query(
    `INSERT INTO public.work_escalations (area, item_kind, item_id, note, escalated_by)
     VALUES ('disputes', 'dispute', 'D-1', 'the venue admits it', $1)`,
    [staffId],
  );
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.work_escalations (area, item_kind, item_id, note, escalated_by)
         VALUES ('disputes', 'dispute', 'D-1', 'again please', $1)`,
        [staffId],
      ),
    /work_escalations_one_open_per_item|duplicate/,
  );
});

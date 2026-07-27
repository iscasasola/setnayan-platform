/**
 * REGRESSION GUARD — the open self-join on public.event_members, and the
 * privilege escalation it used to unlock.
 *
 * THE HOLE THIS PINS SHUT (closed 2026-07-27, migration 20271014300000)
 * --------------------------------------------------------------------
 * `member_can_self_join` was FOR INSERT TO authenticated WITH CHECK:
 *
 *   ((user_id = auth.uid()) AND (member_type = 'guest')
 *     AND (guest_id IS NULL) AND (vendor_id IS NULL))
 *   OR (event_id IN (SELECT current_couple_event_ids()))
 *   OR is_admin()
 *
 * The first disjunct never constrained `event_id`, so ANY authenticated account
 * could insert itself as a guest of ANY event — no token, no invite, no
 * approval. And `current_event_ids()` has no member_type filter, so that one
 * forged row promoted the attacker into every `event_id IN current_event_ids()`
 * predicate in the schema: measured in production, 47 policies across 29 tables,
 * including partner birth dates and budget (events), guest postal addresses
 * (households), harassment reports together with the reporter's identity
 * (user_reports), and the consent record that authorises checkout
 * (coordinator_access_consents — writable AND deletable).
 *
 * WHAT THIS SUITE ASSERTS
 * -----------------------
 *   0. META — the session really is an unprivileged `authenticated` role, not
 *      the table owner, no BYPASSRLS. (Otherwise RLS tests pass vacuously.)
 *   1. A stranger's self-join is REFUSED.
 *   2. The legitimate paths still work: the couple can add members to their own
 *      event, and the service role (every server action) is unaffected.
 *   3. Without a membership, the downstream reads the hole used to unlock are
 *      all denied.
 *   4. NEUTRALISATION — re-create the dropped policy and the attack works
 *      again, proving this suite measures the policy and not the harness.
 *
 * Derived from the T3 RA 10173 privilege audit, which documented the hole by
 * asserting the attack SUCCEEDED. Same scenarios, inverted.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', 'customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}
/** Impersonate a plain logged-in user: uid claim + role claim + SET ROLE. */
async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}
/** Run a statement as the attacker and report whether RLS refused it. */
async function deniedAs(uid: string, sql: string, params: unknown[] = []): Promise<boolean> {
  await asUser(uid);
  let denied = false;
  try {
    await db.query(sql, params);
  } catch {
    denied = true;
  }
  await reset();
  return denied;
}

const F = { couple: '', victimGuest: '', attacker: '', eventId: '', clipId: '' };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  F.couple = await createUser('selfjoin-couple@audit.test');
  F.victimGuest = await createUser('selfjoin-victim@audit.test');
  F.attacker = await createUser('selfjoin-attacker@audit.test');

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events
       (display_name, event_type, partner_a_birth_date, partner_b_birth_date,
        estimated_budget_centavos, venue_latitude, venue_longitude, special_message)
     VALUES ('Private Wedding', 'birthday', DATE '1994-03-11', DATE '1993-08-02',
             85000000, 14.5995, 120.9842, 'See you at the church.')
     RETURNING event_id`,
  );
  F.eventId = ev.rows[0]!.event_id;

  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [F.eventId, F.couple],
  );
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'guest')`,
    [F.eventId, F.victimGuest],
  );
  await db.query(
    `INSERT INTO public.households (event_id, name, address)
     VALUES ($1, 'The Reyes Family',
             '{"line1": "18 Kalayaan Ave", "city": "Quezon City"}'::jsonb)`,
    [F.eventId],
  );
  await db.query(
    `INSERT INTO public.user_reports
       (reporter_user_id, event_id, target_type, target_id, reason, details)
     VALUES ($1::uuid, $2::uuid, 'user', $3::uuid, 'hate_harassment',
             'He followed me to the parking lot after the reception.')`,
    [F.victimGuest, F.eventId, F.attacker],
  );
  const clip = await db.query<{ clip_id: string }>(
    `INSERT INTO public.patiktok_source_clips
       (event_id, template_slug, r2_bucket, r2_object_key, mime_type, performer_label)
     VALUES ($1, 'classic', 'papic', 'events/real/victim-clip.mp4', 'video/mp4', 'Ana R.')
     RETURNING clip_id`,
    [F.eventId],
  );
  F.clipId = clip.rows[0]!.clip_id;
});

after(async () => {
  await reset();
  await db?.close?.();
});

// ── 0. META — the suite is not vacuous ───────────────────────────────────────

test('META: the attacking session is a genuine unprivileged authenticated role', async () => {
  await asUser(F.attacker);
  const r = await db.query<{ who: string; is_owner: boolean; bypass: boolean; uid: string | null }>(
    `SELECT current_user AS who,
            pg_catalog.pg_get_userbyid(c.relowner) = current_user AS is_owner,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass,
            auth.uid()::text AS uid
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'event_members'`,
  );
  await reset();
  const row = r.rows[0]!;
  assert.equal(row.who, 'authenticated');
  assert.equal(row.is_owner, false, 'table owners skip RLS — this must not be the owner');
  assert.equal(row.bypass, false, 'BYPASSRLS would make every assertion below vacuous');
  assert.equal(row.uid, F.attacker);
});

test('META: the self-join policy is GONE and RLS is on', async () => {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_policies
      WHERE schemaname='public' AND tablename='event_members'
        AND policyname='member_can_self_join'`,
  );
  assert.equal(r.rows[0]!.n, 0, 'member_can_self_join must not exist');
  const rls = await db.query<{ rls: boolean }>(
    `SELECT c.relrowsecurity AS rls FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='event_members'`,
  );
  assert.equal(rls.rows[0]!.rls, true);
});

// ── 1. THE ATTACK IS REFUSED ─────────────────────────────────────────────────

test('a stranger CANNOT insert themselves as a guest of an arbitrary event', async () => {
  const denied = await deniedAs(
    F.attacker,
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'guest')`,
    [F.eventId, F.attacker],
  );
  assert.equal(denied, true, 'the unconstrained self-join branch is gone');
});

test('…nor by dressing the row up differently (role, hidden_at, joined_via)', async () => {
  // The dropped disjunct only required member_type='guest' with null guest_id /
  // vendor_id, so a would-be attacker has no other shape to try — but pin the
  // obvious variations so a future "convenience" policy cannot quietly re-open
  // one of them.
  for (const [label, sql] of [
    [
      'explicit role',
      `INSERT INTO public.event_members (event_id, user_id, member_type, role) VALUES ($1, $2, 'guest', 'guest')`,
    ],
    [
      'pre-hidden row',
      `INSERT INTO public.event_members (event_id, user_id, member_type, hidden_at) VALUES ($1, $2, 'guest', now())`,
    ],
    [
      'claiming a couple seat',
      `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    ],
  ] as const) {
    const denied = await deniedAs(F.attacker, sql, [F.eventId, F.attacker]);
    assert.equal(denied, true, `${label}: must be refused`);
  }
});

// ── 2. THE LEGITIMATE PATHS STILL WORK ───────────────────────────────────────

test('the COUPLE can still add a member to their OWN event', async () => {
  const newcomer = await createUser('selfjoin-invitee@audit.test');
  await asUser(F.couple);
  const r = await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'guest')`,
    [F.eventId, newcomer],
  );
  await reset();
  assert.equal(r.affectedRows, 1, 'couple_can_add_member preserves the second disjunct');
});

test('the couple CANNOT add a member to an event they do not own', async () => {
  const other = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Someone else', 'birthday')
     RETURNING event_id`,
  );
  const denied = await deniedAs(
    F.couple,
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'guest')`,
    [other.rows[0]!.event_id, F.couple],
  );
  assert.equal(denied, true, 'couple_can_add_member is scoped to current_couple_event_ids()');
});

test('a member can still READ their own membership row', async () => {
  await asUser(F.victimGuest);
  const r = await db.query(`SELECT event_id FROM public.event_members WHERE user_id = $1`, [
    F.victimGuest,
  ]);
  await reset();
  assert.equal(r.rows.length, 1, 'member_reads_membership is untouched by this migration');
});

// ── 3. THE DOWNSTREAM ESCALATION IS DENIED ───────────────────────────────────

test('the stranger reads NOTHING the self-join used to unlock', async () => {
  await asUser(F.attacker);
  const ev = await db.query(`SELECT event_id FROM public.events WHERE event_id = $1`, [F.eventId]);
  const hh = await db.query(`SELECT name FROM public.households WHERE event_id = $1`, [F.eventId]);
  const ur = await db.query(`SELECT reporter_user_id FROM public.user_reports WHERE event_id = $1`, [
    F.eventId,
  ]);
  await reset();
  assert.equal(ev.rows.length, 0, 'partner birth dates / budget / venue coords');
  assert.equal(hh.rows.length, 0, 'guest names + postal addresses');
  assert.equal(
    ur.rows.length,
    0,
    'a harassment report must never be readable by the person it names',
  );
});

test('the stranger cannot tamper with another guest’s media or the consent record', async () => {
  await asUser(F.attacker);
  const clip = await db.query(
    `UPDATE public.patiktok_source_clips SET r2_object_key = 'events/attacker/swapped.mp4'
      WHERE clip_id = $1`,
    [F.clipId],
  );
  const del = await db.query(`DELETE FROM public.coordinator_access_consents WHERE event_id = $1`, [
    F.eventId,
  ]);
  await reset();
  // RLS filters the row out rather than raising: zero rows affected is the deny.
  assert.equal(clip.affectedRows, 0, "another guest's clip must not be repointable");
  assert.equal(del.affectedRows, 0, 'the RA 10173 consent artefact must not be erasable');
});

// ── 4. NEUTRALISATION — the suite measures the policy, not the harness ───────

test('NEUTRALISATION: restoring the old policy makes the attack work again', async () => {
  await reset(); // migration owner — the only role that may CREATE POLICY
  await db.exec(`
    CREATE POLICY member_can_self_join ON public.event_members
      FOR INSERT TO authenticated
      WITH CHECK (
        ((user_id = auth.uid()) AND (member_type = 'guest')
          AND (guest_id IS NULL) AND (vendor_id IS NULL))
        OR (event_id IN (SELECT public.current_couple_event_ids()))
        OR public.is_admin())`);

  const intruder = await createUser('selfjoin-neutralisation@audit.test');
  await asUser(intruder);
  const r = await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'guest')`,
    [F.eventId, intruder],
  );
  await reset();
  await db.exec(`DROP POLICY member_can_self_join ON public.event_members`);

  assert.equal(
    r.affectedRows,
    1,
    'with the old policy back the self-join succeeds — so the refusals above ' +
      'are caused by dropping it, not by some unrelated harness failure',
  );
});

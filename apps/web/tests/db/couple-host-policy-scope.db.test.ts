/**
 * NAMING INVARIANT — a policy that says `couple`/`host` must be scoped to the
 * couple, not to any event member.
 *
 * `current_event_ids()` returns an event for ANY member_type:
 *
 *   SELECT event_id FROM public.event_members WHERE user_id = auth.uid();
 *
 * 49 policies over 29 tables are written against it. Most are correct — they are
 * named `*_member_*` and mean it. But ten were named `*_couple_*` / `*_host_*`
 * and still resolved through the member-wide function, so an ordinary invited
 * guest got exactly what the couple got. Two mattered a great deal:
 *
 *   · user_reports_couple_read — harassment reports INCLUDING
 *     `reporter_user_id`. A guest reported for harassment could read the report
 *     naming them and identify their reporter.
 *   · coordinator_access_consents (SELECT **and** a FOR ALL write policy) — the
 *     RA 10173 consent record `lib/coordinator-money-scope.ts` reads to
 *     authorise CHECKOUT. Any member could read it and grant themselves scopes.
 *
 * Migration 20271015300000 corrected all ten. T1 is the durable part: it fails
 * if a NEW policy is named couple/host and wired to the member-wide function, so
 * the class cannot come back. T5 is its counterweight — it proves the narrowing
 * did not spill onto the `*_member_*` policies, which MUST keep admitting
 * guests.
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
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}
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
async function countAs(uid: string, sql: string, params: unknown[] = []): Promise<number> {
  await asUser(uid);
  const r = await db.query(sql, params);
  await reset();
  return r.rows.length;
}

const F = { couple: '', guest: '', eventId: '' };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  F.couple = await createUser('scope-couple@audit.test');
  F.guest = await createUser('scope-guest@audit.test');

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Scope Test', 'birthday')
     RETURNING event_id`,
  );
  F.eventId = ev.rows[0]!.event_id;

  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [F.eventId, F.couple],
  );
  // A LEGITIMATELY invited guest — not an intruder. The whole point is that a
  // real guest still must not see couple-scoped rows.
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'guest')`,
    [F.eventId, F.guest],
  );

  await db.query(
    `INSERT INTO public.user_reports
       (reporter_user_id, event_id, target_type, target_id, reason, details)
     VALUES ($1::uuid,$2::uuid,'user',$3::uuid,'hate_harassment','Followed me to the car park.')`,
    [F.couple, F.eventId, F.guest],
  );
  await db.query(
    `INSERT INTO public.event_checklist_items (event_id, template_key, title, status)
     VALUES ($1,'book_venue','Book the venue','pending')`,
    [F.eventId],
  );
});

after(async () => {
  await reset();
  await db?.close?.();
});

// ── T1 · the invariant that stops this recurring ─────────────────────────────

/**
 * Policies that still say couple/host while using the member-wide function.
 *
 * These are NOT approved — they are UNRESOLVED. Each is reached by a non-admin
 * client path whose caller role could not be established with confidence from a
 * call-site read, so narrowing them on a guess risks breaking a live flow.
 * Deciding them needs a product ruling (e.g. may a guest see the couple's vendor
 * appointments?), which is why they are pinned here rather than changed.
 *
 * THIS LIST MAY ONLY SHRINK. Removing an entry means either narrowing the policy
 * or renaming it `*_member_*` so the name stops lying.
 */
const KNOWN_BROAD: Record<string, string> = {
  'booking_handovers.booking_handovers_couple_read':
    'read on the couple dashboard AND two vendor-dashboard surfaces; caller role unverified.',
  'event_access_requests.event_access_requests_host_answer':
    'UPDATE — also invoked from the vendor floor-command surface; needs a ruling on who may answer.',
  'event_access_requests.event_access_requests_host_read':
    'paired with the answer policy above; decide both together.',
  'event_appointments.event_appointments_couple_read':
    'nine non-admin sites incl. lib/upcoming-items + lib/preparation, which may run for any member.',
  'event_song_picks.event_song_picks_host_select':
    'lib/songs.ts is shared by couple and guest song surfaces; narrowing may break the guest picker.',
  'event_song_picks.event_song_picks_host_write':
    'paired with the select policy above; decide both together.',
};
const KNOWN_BROAD_CEILING = 6;

test('T1 · no NEW policy named couple/host is wired to the member-wide current_event_ids()', async () => {
  const r = await db.query<{ tablename: string; policyname: string }>(
    `SELECT tablename, policyname
       FROM pg_policies
      WHERE schemaname='public'
        AND 'authenticated' = ANY(roles)
        AND (COALESCE(qual,'')||COALESCE(with_check,'')) LIKE '%current_event_ids()%'
        AND (policyname LIKE '%couple%' OR policyname LIKE '%host%')
      ORDER BY tablename, policyname`,
  );
  const offenders = r.rows
    .map((x) => `${x.tablename}.${x.policyname}`)
    .filter((k) => !(k in KNOWN_BROAD));
  assert.deepEqual(
    offenders,
    [],
    'These policies SAY couple/host but resolve through current_event_ids(), which\n' +
      'returns events for ANY member_type — so an ordinary guest gets couple-level\n' +
      'access. Use current_couple_event_ids(). If a policy genuinely means "any\n' +
      'member", rename it *_member_* so the name stops lying.',
  );
});

test('T1b · the unresolved list may only shrink, and every entry carries a reason', async () => {
  const n = Object.keys(KNOWN_BROAD).length;
  assert.ok(n <= KNOWN_BROAD_CEILING, `KNOWN_BROAD has ${n} entries, ceiling ${KNOWN_BROAD_CEILING}.`);
  for (const [k, why] of Object.entries(KNOWN_BROAD)) {
    assert.ok(why.length > 25, `KNOWN_BROAD['${k}'] needs a real reason, not a placeholder.`);
  }
  // An entry that is no longer reported has been fixed — delete it and lower the
  // ceiling, so the number keeps meaning something.
  const r = await db.query<{ tablename: string; policyname: string }>(
    `SELECT tablename, policyname FROM pg_policies
      WHERE schemaname='public' AND 'authenticated' = ANY(roles)
        AND (COALESCE(qual,'')||COALESCE(with_check,'')) LIKE '%current_event_ids()%'
        AND (policyname LIKE '%couple%' OR policyname LIKE '%host%')`,
  );
  const reported = new Set(r.rows.map((x) => `${x.tablename}.${x.policyname}`));
  const stale = Object.keys(KNOWN_BROAD).filter((k) => !reported.has(k));
  assert.deepEqual(
    stale,
    [],
    `No longer reported — narrowed or renamed. Delete and lower KNOWN_BROAD_CEILING to ${
      Object.keys(KNOWN_BROAD).length - stale.length
    }:\n` + stale.map((s) => `  ${s}`).join('\n'),
  );
});

// ── T2–T4 · the two that mattered, proven behaviourally ─────────────────────

test('T2 · a GUEST cannot read harassment reports on their event', async () => {
  const n = await countAs(
    F.guest,
    `SELECT reporter_user_id FROM public.user_reports WHERE event_id = $1`,
    [F.eventId],
  );
  assert.equal(n, 0, 'a report must never be readable by an ordinary member — including its reporter');
});

test('T3 · the COUPLE can still read reports on their own event', async () => {
  const n = await countAs(
    F.couple,
    `SELECT reporter_user_id FROM public.user_reports WHERE event_id = $1`,
    [F.eventId],
  );
  assert.equal(n, 1, 'narrowing must not lock the couple out of their own moderation data');
});

test('T4 · a GUEST cannot read or write the coordinator checkout-consent record', async () => {
  await asUser(F.guest);
  const read = await db.query(
    `SELECT id FROM public.coordinator_access_consents WHERE event_id = $1`,
    [F.eventId],
  );
  // RLS filters rather than raising on a write whose row it cannot see.
  const write = await db.query(
    `UPDATE public.coordinator_access_consents
        SET scopes = '{"checkout": true}'::jsonb WHERE event_id = $1`,
    [F.eventId],
  );
  await reset();
  assert.equal(read.rows.length, 0, 'the consent record is couple-scoped');
  assert.equal(write.affectedRows, 0, 'a guest must not be able to grant money scopes');
});

// ── T5 · the counterweight — member policies still admit guests ─────────────

test('T5 · a guest STILL reads the member-scoped surfaces (no over-narrowing)', async () => {
  const checklist = await countAs(
    F.guest,
    `SELECT item_id FROM public.event_checklist_items WHERE event_id = $1`,
    [F.eventId],
  );
  const event = await countAs(F.guest, `SELECT event_id FROM public.events WHERE event_id = $1`, [
    F.eventId,
  ]);
  assert.equal(checklist, 1, 'event_member_can_read_checklist is a *_member_* policy — unchanged');
  assert.equal(event, 1, 'event_member_can_read is a *_member_* policy — unchanged');
});

// ── T6 · neutralisation — the suite measures the policies, not the harness ──

test('T6 · NEUTRALISATION: restoring the member-wide policy lets the guest read again', async () => {
  await reset();
  await db.exec(`DROP POLICY user_reports_couple_read ON public.user_reports`);
  await db.exec(`
    CREATE POLICY user_reports_couple_read ON public.user_reports
      FOR SELECT TO authenticated
      USING (event_id IN (SELECT public.current_event_ids()))`);

  const n = await countAs(
    F.guest,
    `SELECT reporter_user_id FROM public.user_reports WHERE event_id = $1`,
    [F.eventId],
  );

  await reset();
  await db.exec(`DROP POLICY user_reports_couple_read ON public.user_reports`);
  await db.exec(`
    CREATE POLICY user_reports_couple_read ON public.user_reports
      FOR SELECT TO authenticated
      USING (event_id IN (SELECT public.current_couple_event_ids()))`);

  assert.equal(
    n,
    1,
    'with the member-wide predicate back the guest CAN read the report — so T2 is ' +
      'caused by the narrowing, not by an unrelated harness failure',
  );
});

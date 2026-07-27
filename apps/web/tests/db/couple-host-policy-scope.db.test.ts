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

const F = { couple: '', guest: '', coordinator: '', eventId: '' };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  F.couple = await createUser('scope-couple@audit.test');
  F.guest = await createUser('scope-guest@audit.test');
  F.coordinator = await createUser('scope-coordinator@audit.test');

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
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'coordinator')`,
    [F.eventId, F.coordinator],
  );
  const song = await db.query<{ song_id: string }>(
    `INSERT INTO public.songs (title, artist, source)
     VALUES ('First Dance', 'The Test Band', 'seed') RETURNING song_id`,
  );
  await db.query(
    `INSERT INTO public.event_song_picks (event_id, song_id, source)
     VALUES ($1, $2, 'editor')`,
    [F.eventId, song.rows[0]!.song_id],
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
 * EMPTY, and it must stay that way.
 *
 * It briefly held six entries (2026-07-27) while their safe shape was unclear.
 * The owner then ruled that a guest may see neither the couple's vendor
 * appointments nor their song picks, and reading each table's FULL policy set
 * showed the rest answered itself — every one already had a separate
 * vendor/requester policy, so the couple/host policy never had to carry those
 * roles. Migration 20271016300000 closed all six.
 *
 * THIS LIST MAY ONLY SHRINK. Adding an entry means admitting a policy whose name
 * lies about its scope; fix the policy, or rename it `*_member_*`.
 */
const KNOWN_BROAD: Record<string, string> = {};
const KNOWN_BROAD_CEILING = 0;

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


// ── T7 · the owner's 2026-07-27 rulings, proven behaviourally ───────────────
//
//   "May a guest see the couple's vendor appointments?"  → no
//   "May a guest see or change the couple's song picks?" → no
//
// The COORDINATOR is the counterweight: they are an invited planning role, not a
// guest, and `current_couple_or_coordinator_event_ids()` is what keeps them in
// while the ruling puts guests out. A narrowing that also locked out the
// coordinator would be an over-correction, so it is asserted, not assumed.

test('T7 · a GUEST cannot see the couple song picks; the COORDINATOR still can', async () => {
  const guest = await countAs(
    F.guest,
    `SELECT song_id FROM public.event_song_picks WHERE event_id = $1`,
    [F.eventId],
  );
  const coordinator = await countAs(
    F.coordinator,
    `SELECT song_id FROM public.event_song_picks WHERE event_id = $1`,
    [F.eventId],
  );
  const couple = await countAs(
    F.couple,
    `SELECT song_id FROM public.event_song_picks WHERE event_id = $1`,
    [F.eventId],
  );
  assert.equal(guest, 0, "owner ruling: a guest may not see the couple's song picks");
  assert.equal(coordinator, 1, 'the invited coordinator is not a guest — they keep the playlist');
  assert.equal(couple, 1, 'the couple obviously keeps their own picks');
});

test('T7b · a GUEST cannot WRITE the couple song picks', async () => {
  await asUser(F.guest);
  const del = await db.query(`DELETE FROM public.event_song_picks WHERE event_id = $1`, [
    F.eventId,
  ]);
  await reset();
  assert.equal(del.affectedRows, 0, 'owner ruling: a guest may not change the song picks');
});

test('T7c · no couple/host policy anywhere is still member-wide', async () => {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_policies
      WHERE schemaname='public' AND 'authenticated' = ANY(roles)
        AND (COALESCE(qual,'')||COALESCE(with_check,'')) LIKE '%current_event_ids()%'
        AND (policyname LIKE '%couple%' OR policyname LIKE '%host%')`,
  );
  assert.equal(r.rows[0]!.n, 0, 'the sixteen are all closed — KNOWN_BROAD is empty for real');
});

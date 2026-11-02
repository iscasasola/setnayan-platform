/**
 * ✉ GUESTS REPLY BY CHAPTER — asserted against the DATABASE (migration 20271301452824; owner 2026-11-01, corpus
 * SCHEDULE_CHAPTERS_BUILD_PLAN §3 "RSVP depends on chapters", §9 #7).
 *
 *   1 · the fence: RLS on, anon reads nothing, no browser role writes a guest's reply; the couple reads their own;
 *   2 · only a CHAPTER is replied to (a moment is refused) and only by a guest of the same event;
 *   3 · a chapter going ON the invitation keeps every earlier reply as rows: the FIRST takes the guest's whole answer;
 *       a LATER one has no row (asked as new — "added = a notice + one Yes / Can't make it");
 *   4 · taking a chapter OFF deletes no reply.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let eventId = '';
let otherEvent = '';
let couple = '';
let yesGuest = '';
let noGuest = '';
let pendingGuest = '';
let ceremony = '';
let reception = '';
let moment = '';

async function asRole(role: 'postgres' | 'anon' | 'couple'): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  if (role === 'postgres') return;
  if (role === 'couple') await setAuthUid(db, couple);
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role === 'couple' ? 'authenticated' : 'anon']);
  await db.exec(`SET ROLE ${role === 'couple' ? 'authenticated' : 'anon'}`);
}

async function rows(): Promise<{ guest_id: string; block_id: string; attending: boolean }[]> {
  await asRole('postgres');
  return (
    await db.query<{ guest_id: string; block_id: string; attending: boolean }>(
      `SELECT guest_id, block_id, attending FROM public.guest_chapter_replies WHERE event_id = $1 ORDER BY guest_id, block_id`,
      [eventId],
    )
  ).rows;
}

async function guest(ev: string, name: string, status: string): Promise<string> {
  return (
    await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, rsvp_status)
       VALUES ($1, $2, 'Test', 'both', 'friends', $3::public.rsvp_status) RETURNING guest_id`,
      [ev, name, status],
    )
  ).rows[0]!.guest_id;
}

async function block(label: string, parent: string | null, onInvitation: boolean): Promise<string> {
  return (
    await db.query<{ block_id: string }>(
      `INSERT INTO public.event_schedule_blocks (event_id, label, block_type, start_at, parent_block_id, on_invitation, is_public)
       VALUES ($1, $2, 'custom', '2099-12-18T15:00:00Z', $3, $4, false) RETURNING block_id`,
      [eventId, label, parent, onInvitation],
    )
  ).rows[0]!.block_id;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  couple = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('couple@chapters.test', jsonb_build_object('account_type','customer')) RETURNING id`,
    )
  ).rows[0]!.id;
  const ev = async (name: string) =>
    (
      await db.query<{ event_id: string }>(
        `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
         VALUES ($1,'wedding','catholic','banquet_hall', DATE '2099-12-18', 'day') RETURNING event_id`,
        [name],
      )
    ).rows[0]!.event_id;
  eventId = await ev('Sample Wedding');
  otherEvent = await ev('Someone Else');
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [eventId, couple]);
  yesGuest = await guest(eventId, 'Yes', 'attending');
  noGuest = await guest(eventId, 'No', 'declined');
  pendingGuest = await guest(eventId, 'Pending', 'pending');
  ceremony = await block('Ceremony', null, false);
  reception = await block('Reception', null, false);
  moment = await block('Procession', ceremony, false);
});

after(async () => {
  await replay?.db.close();
});

test('1 · the fence: RLS on, anon reads nothing, the browser writes nothing', async () => {
  await asRole('postgres');
  const rls = await db.query<{ relrowsecurity: boolean }>(`SELECT relrowsecurity FROM pg_class WHERE oid = 'public.guest_chapter_replies'::regclass`);
  assert.equal(rls.rows[0]!.relrowsecurity, true);
  await asRole('anon');
  await assert.rejects(db.query(`SELECT 1 FROM public.guest_chapter_replies`), 'anon holds no grant');
  await asRole('couple');
  await assert.rejects(
    db.query(`INSERT INTO public.guest_chapter_replies (guest_id, block_id, event_id, attending) VALUES ($1,$2,$3,true)`, [yesGuest, ceremony, eventId]),
    'a browser role never writes a guest’s reply',
  );
  await asRole('postgres');
});

test('2 · only a chapter is replied to, only by a guest of the same event', async () => {
  await asRole('postgres');
  await assert.rejects(
    db.query(`INSERT INTO public.guest_chapter_replies (guest_id, block_id, event_id, attending) VALUES ($1,$2,$3,true)`, [pendingGuest, moment, eventId]),
    /Only a chapter/,
  );
  const stranger = await guest(otherEvent, 'Stranger', 'pending');
  await assert.rejects(
    db.query(`INSERT INTO public.guest_chapter_replies (guest_id, block_id, event_id, attending) VALUES ($1,$2,$3,true)`, [stranger, ceremony, otherEvent]),
    /not on this event/,
  );
});

test('3 · the FIRST chapter on the invitation takes the whole answer; a LATER one is asked as new', async () => {
  await asRole('couple');
  await db.query(`UPDATE public.event_schedule_blocks SET on_invitation = true WHERE block_id = $1`, [ceremony]);
  let r = await rows();
  assert.deepEqual(
    r.map((x) => [x.guest_id === yesGuest ? 'yes' : x.guest_id === noGuest ? 'no' : 'pending', x.block_id === ceremony, x.attending]).sort(),
    [['no', true, false], ['yes', true, true]].sort(),
    'the replied guests’ answers stand for the first chapter; a pending guest gets no row',
  );
  await asRole('couple');
  await db.query(`UPDATE public.event_schedule_blocks SET on_invitation = true WHERE block_id = $1`, [reception]);
  r = await rows();
  assert.ok(!r.some((x) => x.block_id === reception), 'a chapter added after the replies has no answer yet — it is asked');
  // The couple reads their own event's replies.
  await asRole('couple');
  const seen = await db.query(`SELECT 1 FROM public.guest_chapter_replies WHERE event_id = $1`, [eventId]);
  assert.equal(seen.rows.length, 2);
});

test('4 · taking a chapter off the invitation keeps every reply', async () => {
  await asRole('couple');
  await db.query(`UPDATE public.event_schedule_blocks SET on_invitation = false WHERE block_id = $1`, [ceremony]);
  const r = await rows();
  assert.equal(r.filter((x) => x.block_id === ceremony).length, 2, 'replies are kept');
});

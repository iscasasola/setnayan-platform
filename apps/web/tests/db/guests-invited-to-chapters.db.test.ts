/**
 * ✉ PER-GUEST "INVITED TO" CHAPTERS — asserted against the DATABASE (migration 20271302948959; owner 2026-11-02,
 * DECISION_LOG "PER-GUEST "INVITED TO" CHAPTERS": *"Invited to yes"*).
 *
 *   1 · the fence: RLS on, anon reads nothing; the couple writes and reads their own event's rows, another event's
 *       couple sees none;
 *   2 · only a CHAPTER is left off (a moment is refused), and only for a guest of the same event;
 *   3 · existing guests keep all: no row = invited (nothing was backfilled);
 *   4 · taking a guest off a chapter DROPS their answer to it, so the per-chapter count stops counting them;
 *   5 · an answer to a chapter they are not invited to is never stored — not their own reply, not the
 *       "keep every earlier reply" trigger when a chapter joins the invitation;
 *   6 · put back on, they have no answer for it — asked as new.
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
let otherCouple = '';
let ana = '';
let ben = '';
let ceremony = '';
let afterParty = '';
let moment = '';

async function asRole(role: 'postgres' | 'anon' | 'couple' | 'other'): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  if (role === 'postgres') return;
  if (role === 'couple') await setAuthUid(db, couple);
  if (role === 'other') await setAuthUid(db, otherCouple);
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role === 'anon' ? 'anon' : 'authenticated']);
  await db.exec(`SET ROLE ${role === 'anon' ? 'anon' : 'authenticated'}`);
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

async function replies(guestId: string): Promise<{ block_id: string; attending: boolean }[]> {
  await asRole('postgres');
  return (
    await db.query<{ block_id: string; attending: boolean }>(
      `SELECT block_id, attending FROM public.guest_chapter_replies WHERE guest_id = $1 ORDER BY block_id`,
      [guestId],
    )
  ).rows;
}

async function yesCount(blockId: string): Promise<number> {
  await asRole('postgres');
  return Number(
    (
      await db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM public.guest_chapter_replies WHERE block_id = $1 AND attending`, [blockId])
    ).rows[0]!.n,
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const user = async (email: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
  couple = await user('couple@invited-to.test');
  otherCouple = await user('other@invited-to.test');
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
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [otherEvent, otherCouple]);
  ana = await guest(eventId, 'Ana', 'attending');
  ben = await guest(eventId, 'Ben', 'attending');
  // The Ceremony goes on the invitation AFTER Ana and Ben replied: it takes their whole answer (20271301452824). The
  // After party joins later, so each answers it on its own (as the guest's reply would write it).
  ceremony = await block('Ceremony', null, true);
  afterParty = await block('After party', null, true);
  for (const g of [ana, ben]) {
    await db.query(`INSERT INTO public.guest_chapter_replies (guest_id, block_id, event_id, attending) VALUES ($1,$2,$3,true)`, [g, afterParty, eventId]);
  }
  moment = await block('Procession', ceremony, false);
});

after(async () => {
  await replay?.db.close();
});

test('1 · the fence: RLS on, anon reads nothing, the couple writes their own, another couple sees none', async () => {
  await asRole('postgres');
  const rls = await db.query<{ relrowsecurity: boolean }>(`SELECT relrowsecurity FROM pg_class WHERE oid = 'public.guest_chapter_not_invited'::regclass`);
  assert.equal(rls.rows[0]!.relrowsecurity, true);
  await asRole('anon');
  await assert.rejects(db.query(`SELECT 1 FROM public.guest_chapter_not_invited`), 'anon holds no grant');
  await asRole('other');
  await assert.rejects(
    db.query(`INSERT INTO public.guest_chapter_not_invited (guest_id, block_id, event_id) VALUES ($1,$2,$3)`, [ben, afterParty, eventId]),
    'another event’s couple cannot leave our guest off our chapter',
  );
  await asRole('postgres');
});

test('2 · only a chapter is left off, only for a guest of the same event', async () => {
  await asRole('postgres');
  await assert.rejects(
    db.query(`INSERT INTO public.guest_chapter_not_invited (guest_id, block_id, event_id) VALUES ($1,$2,$3)`, [ana, moment, eventId]),
    /never to a moment/,
  );
  const stranger = await guest(otherEvent, 'Stranger', 'pending');
  await assert.rejects(
    db.query(`INSERT INTO public.guest_chapter_not_invited (guest_id, block_id, event_id) VALUES ($1,$2,$3)`, [stranger, ceremony, otherEvent]),
    /not on this event/,
  );
});

test('3 · existing guests keep all: no row anywhere, both answers stand for both chapters', async () => {
  await asRole('postgres');
  const n = await db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM public.guest_chapter_not_invited WHERE event_id = $1`, [eventId]);
  assert.equal(n.rows[0]!.n, '0');
  assert.equal((await replies(ana)).length, 2);
  assert.equal(await yesCount(ceremony), 2);
});

test('4 · "after party only": taking Ben off the Ceremony drops his answer to it — the count follows', async () => {
  await asRole('couple');
  // event_id is replaced by the trigger — a writer's value is never trusted.
  await db.query(`INSERT INTO public.guest_chapter_not_invited (guest_id, block_id, event_id) VALUES ($1,$2,$3)`, [ben, ceremony, otherEvent]);
  await asRole('couple');
  const mine = await db.query<{ event_id: string }>(`SELECT event_id FROM public.guest_chapter_not_invited WHERE guest_id = $1`, [ben]);
  assert.deepEqual(mine.rows.map((r) => r.event_id), [eventId], 'the couple reads it, on THEIR event');
  await asRole('other');
  const theirs = await db.query(`SELECT 1 FROM public.guest_chapter_not_invited`);
  assert.equal(theirs.rows.length, 0, 'another couple reads none of it');
  assert.deepEqual((await replies(ben)).map((r) => r.block_id), [afterParty]);
  assert.equal(await yesCount(ceremony), 1, 'the Ceremony still counted Ben');
  assert.equal(await yesCount(afterParty), 2, 'the After party lost a guest who is still invited to it');
});

test('5 · an answer to a chapter he is not invited to is never stored', async () => {
  await asRole('postgres');
  await db.query(
    `INSERT INTO public.guest_chapter_replies (guest_id, block_id, event_id, attending) VALUES ($1,$2,$3,true)
     ON CONFLICT (guest_id, block_id) DO UPDATE SET attending = EXCLUDED.attending`,
    [ben, ceremony, eventId],
  );
  assert.deepEqual((await replies(ben)).map((r) => r.block_id), [afterParty], 'his reply wrote a Ceremony answer');
  // A chapter joining the invitation keeps earlier replies — but never for a guest left off it.
  const brunch = await block('Brunch', null, false);
  await db.query(`INSERT INTO public.guest_chapter_not_invited (guest_id, block_id, event_id) VALUES ($1,$2,$3)`, [ana, brunch, eventId]);
  await db.query(`UPDATE public.event_schedule_blocks SET on_invitation = true WHERE block_id = $1`, [brunch]);
  assert.ok(!(await replies(ana)).some((r) => r.block_id === brunch), 'the join trigger wrote Ana an answer to a chapter she is off');
});

test('6 · put back on the Ceremony, Ben has no answer for it — he is asked as new', async () => {
  await asRole('couple');
  await db.query(`DELETE FROM public.guest_chapter_not_invited WHERE guest_id = $1 AND block_id = $2`, [ben, ceremony]);
  assert.ok(!(await replies(ben)).some((r) => r.block_id === ceremony));
  await asRole('postgres');
  await db.query(`INSERT INTO public.guest_chapter_replies (guest_id, block_id, event_id, attending) VALUES ($1,$2,$3,true)`, [ben, ceremony, eventId]);
  assert.equal(await yesCount(ceremony), 2, 'once invited again, his answer is stored and counted');
});

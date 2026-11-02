/**
 * 📸 MEMORIES BY CHAPTER — asserted against the DATABASE (migration 20271301555513; owner 2026-11-01, DECISION_LOG
 * "A CHAPTER'S PHOTOS: WHO + WHEN; ADD TO OTHER CHAPTERS" · "SCHEDULE PLAN §9: EIGHT OPEN ITEMS RULED" (3)).
 *
 * The guards the build was asked for, each at the layer that ENFORCES it — the server reads the Memories page calls
 * (`papic_memories_photo_chapters` · `papic_memories_chapters`, keyed on auth.uid()), never a screen:
 *   1 · a person OUTSIDE a chapter cannot read its photos through the server read — and a face tag on the photo does
 *       not change that ("a face tag never overrides People in this chapter");
 *   2 · the dropdown's read lists ONLY the chapters the caller may see;
 *   3 · Who: People in this chapter · Only people tagged · Everybody (= the whole guest list), own photos always;
 *   4 · When: "after the event" shows nothing — not even to the hosts — until the event is done; then the hosts see
 *       every chapter (ruled 1 Nov);
 *   5 · Add to Chapter: hosts and a chapter's people add a photo they can see to another chapter they are in — nobody
 *       else, and a shot's own chapter is never taken away.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

async function asUser(uid: string): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}
async function asAnon(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'anon', false)`);
  await db.exec(`SET ROLE anon`);
}
async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}

const F = {
  eventId: '',
  couple: '',
  // users who are guests of the event
  inUser: '',
  inGuest: '',
  outUser: '',
  outGuest: '',
  taggedUser: '',
  taggedGuest: '',
  stranger: '',
};

// A meeting long before the (future) event day — wall clocks, Manila +08:00.
const START_WALL = '2099-06-10T14:00:00Z';
const END_WALL = '2099-06-10T16:00:00Z';
const DURING_REAL = '2099-06-10T07:00:00Z';

async function chapter(label: string, extra: Record<string, unknown> = {}): Promise<string> {
  await asOwner();
  const cols = ['event_id', 'label', 'start_at', 'end_at', ...Object.keys(extra)];
  const vals = [F.eventId, label, START_WALL, END_WALL, ...Object.values(extra)];
  return (
    await db.query<{ block_id: string }>(
      `INSERT INTO public.event_schedule_blocks (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING block_id`,
      vals,
    )
  ).rows[0]!.block_id;
}

async function named(blockId: string, guestId: string): Promise<void> {
  await asOwner();
  await db.query(`INSERT INTO public.event_schedule_tasks (block_id, guest_id, what) VALUES ($1,$2,'Here')`, [blockId, guestId]);
}

/** A guest's shot, captured INTO the chapter (the capture route's write: the service role, the trigger checking). */
async function shotInto(blockId: string, guestId: string): Promise<string> {
  await asOwner();
  const cap = (
    await db.query<{ capture_id: string }>(
      `INSERT INTO public.papic_guest_captures (event_id, guest_id, r2_object_key, captured_at) VALUES ($1,$2,'r2://m',$3) RETURNING capture_id`,
      [F.eventId, guestId, DURING_REAL],
    )
  ).rows[0]!.capture_id;
  await db.query(`INSERT INTO public.papic_chapter_captures (block_id, guest_capture_id) VALUES ($1,$2)`, [blockId, cap]);
  return cap;
}

async function faceTag(captureId: string, guestId: string): Promise<void> {
  await asOwner();
  await db.query(
    `INSERT INTO public.photo_tags (event_id, source_table, source_id, guest_id, source) VALUES ($1,'papic_guest_captures',$2,$3,'manual_pick')`,
    [F.eventId, captureId, guestId],
  );
}

type Row = { guest_capture_id: string | null; block_id: string | null; how: string | null; withheld: boolean };
/** What the Memories read hands this person: the (capture, chapter) pairs they see, and the withheld captures. */
async function memoriesOf(uid: string): Promise<Row[]> {
  await asUser(uid);
  return (await db.query<Row>(`SELECT * FROM public.papic_memories_photo_chapters($1)`, [F.eventId])).rows;
}
const sees = (rows: Row[], cap: string, block: string) => rows.some((r) => r.guest_capture_id === cap && r.block_id === block && !r.withheld);

type ChapterRow = { block_id: string; listed: boolean; may_add: boolean; is_in: boolean; photos: number };
async function dropdownOf(uid: string): Promise<string[]> {
  await asUser(uid);
  const rows = (await db.query<ChapterRow>(`SELECT * FROM public.papic_memories_chapters($1)`, [F.eventId])).rows;
  return rows.filter((r) => r.listed).map((r) => r.block_id);
}

async function setChapter(uid: string, blockId: string, cap: string, on: boolean): Promise<string | null> {
  await asUser(uid);
  return (
    await db.query<{ r: string | null }>(`SELECT public.papic_memories_set_chapter($1,$2,$3,NULL,$4) AS r`, [F.eventId, blockId, cap, on])
  ).rows[0]!.r;
}

async function linkHow(blockId: string, cap: string): Promise<string | null> {
  await asOwner();
  return (
    (await db.query<{ how: string }>(`SELECT how FROM public.papic_chapter_captures WHERE block_id = $1 AND guest_capture_id = $2`, [blockId, cap]))
      .rows[0]?.how ?? null
  );
}

async function finishTheEvent(done: boolean): Promise<void> {
  await asOwner();
  await db.query(`UPDATE public.events SET cleared_at = $2 WHERE event_id = $1`, [F.eventId, done ? '2099-12-20T00:00:00Z' : null]);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asOwner();
  const mkUser = async (email: string): Promise<string> =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
  F.eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ('Sample Wedding','wedding','catholic','banquet_hall', DATE '2099-12-18', 'day') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  const mkGuest = async (first: string, uid: string): Promise<string> => {
    const g = (
      await db.query<{ guest_id: string }>(
        `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category) VALUES ($1,$2,'Sample','both','friends') RETURNING guest_id`,
        [F.eventId, first],
      )
    ).rows[0]!.guest_id;
    await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type, guest_id) VALUES ($1,$2,'guest',$3)`, [F.eventId, uid, g]);
    return g;
  };
  F.couple = await mkUser('couple@memories-chapter.test');
  F.inUser = await mkUser('in@memories-chapter.test');
  F.outUser = await mkUser('out@memories-chapter.test');
  F.taggedUser = await mkUser('tagged@memories-chapter.test');
  F.stranger = await mkUser('stranger@memories-chapter.test');
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [F.eventId, F.couple]);
  F.inGuest = await mkGuest('Named', F.inUser);
  F.outGuest = await mkGuest('Outside', F.outUser);
  F.taggedGuest = await mkGuest('Tagged', F.taggedUser);
});

after(async () => {
  await replay?.db.close();
});

/* ── 1 + 2 · People in this chapter — the guards ────────────────────────────────────────────────────────────── */

let tasting = '';
let tastingShot = '';

test('🔒 a person OUTSIDE a chapter cannot read its photos through the server read — not even when face-tagged', async () => {
  tasting = await chapter('Tasting', { photo_who: 'chapter', photo_when: 'right_away' });
  await named(tasting, F.inGuest);
  tastingShot = await shotInto(tasting, F.inGuest);
  // The outsider is tagged IN the photo — and it still grants nothing under "People in this chapter".
  await faceTag(tastingShot, F.outGuest);

  assert.ok(sees(await memoriesOf(F.inUser), tastingShot, tasting), 'a person in the chapter reads its photo');
  const out = await memoriesOf(F.outUser);
  assert.equal(
    out.some((r) => r.guest_capture_id === tastingShot),
    false,
    'a guest outside the chapter got its photo from the server read — a face tag overrode "People in this chapter"',
  );
  assert.equal((await memoriesOf(F.stranger)).length, 0, 'a stranger reads nothing');
  await asAnon();
  await assert.rejects(() => db.query(`SELECT * FROM public.papic_memories_photo_chapters($1)`, [F.eventId]), /permission denied/i);
});

test('🔒 the dropdown lists ONLY the chapters the caller may see', async () => {
  assert.ok((await dropdownOf(F.inUser)).includes(tasting), 'a person in the chapter sees it listed');
  assert.equal((await dropdownOf(F.outUser)).includes(tasting), false, 'an outsider was offered a chapter they may not see');
  assert.deepEqual(await dropdownOf(F.stranger), [], 'a stranger is offered no chapter');
  // The outsider's own capture lands nowhere near it — they have nothing in it.
});

/* ── 3 · the other Who rules, and own photos ───────────────────────────────────────────────────────────────── */

test('Everybody = the whole guest list; a stranger is still nobody', async () => {
  const despedida = await chapter('Despedida', { photo_who: 'everybody' });
  const shot = await shotInto(despedida, F.inGuest);
  assert.ok(sees(await memoriesOf(F.outUser), shot, despedida), 'any guest of the event');
  assert.ok((await dropdownOf(F.outUser)).includes(despedida));
  assert.equal((await memoriesOf(F.stranger)).length, 0);
});

test('Only people tagged: each sees only the photos they are in', async () => {
  const parents = await chapter('Bride and parents', { photo_who: 'tagged' });
  await named(parents, F.inGuest);
  const withTagged = await shotInto(parents, F.inGuest);
  const without = await shotInto(parents, F.inGuest);
  await faceTag(withTagged, F.taggedGuest);
  const t = await memoriesOf(F.taggedUser);
  assert.ok(sees(t, withTagged, parents), 'the photo they are in');
  assert.equal(sees(t, without, parents), false, 'not the photo they are not in');
  const o = await memoriesOf(F.outUser);
  assert.equal(o.some((r) => r.guest_capture_id === withTagged || r.guest_capture_id === without), false, 'an untagged guest sees none');
  // The shooter still sees their own.
  const mine = await memoriesOf(F.inUser);
  assert.ok(sees(mine, without, parents), 'people always see their own photos');
});

/* ── 4 · When ─────────────────────────────────────────────────────────────────────────────────────────────── */

test('"after the event" shows nothing to anyone — hosts included — until it is done; then the hosts see every chapter', async () => {
  const prep = await chapter('Preparation · Groom', { photo_who: 'chapter', photo_when: 'after_event' });
  const members = await chapter('Barkada only', { photo_who: 'chapter', photo_when: 'right_away' });
  await named(prep, F.inGuest);
  await named(members, F.inGuest);
  const prepShot = await shotInto(prep, F.inGuest);
  const memberShot = await shotInto(members, F.inGuest);

  await finishTheEvent(false);
  const host = await memoriesOf(F.couple);
  assert.equal(sees(host, prepShot, prep), false, 'the bride and groom do not see it before the event is done');
  assert.ok(host.some((r) => r.guest_capture_id === prepShot && r.withheld), 'the couple is told it is withheld, so the grid drops it');
  assert.equal((await dropdownOf(F.couple)).includes(prep), false, 'nor is it listed for them');
  assert.equal(sees(host, memberShot, members), false, 'a host on no task of a People-in-this-chapter chapter sees only their own until done');
  assert.ok(sees(await memoriesOf(F.inUser), prepShot, prep), 'the shooter still sees their own');

  await finishTheEvent(true);
  const after = await memoriesOf(F.couple);
  assert.ok(sees(after, prepShot, prep) && sees(after, memberShot, members), 'once done, the hosts see every chapter');
  assert.equal(after.some((r) => r.withheld), false);
  assert.equal(sees(await memoriesOf(F.outUser), prepShot, prep), false, 'done does not open a chapter to someone outside it');
  await finishTheEvent(false);
});

/* ── 5 · Add to Chapter ───────────────────────────────────────────────────────────────────────────────────── */

test('Add to Chapter: a chapter’s person adds a photo to another chapter they are in — never one they are not in', async () => {
  const dinner = await chapter('Dinner', { photo_who: 'chapter' });
  const vip = await chapter('VIP room', { photo_who: 'chapter' });
  await named(dinner, F.inGuest);

  assert.equal(await setChapter(F.inUser, dinner, tastingShot, true), null, 'in both: added');
  assert.equal(await linkHow(dinner, tastingShot), 'added');
  assert.equal(await setChapter(F.inUser, vip, tastingShot, true), 'not_yours_to_add', 'not in the target');
  assert.equal(await linkHow(vip, tastingShot), null);
  assert.equal(await setChapter(F.outUser, dinner, tastingShot, true), 'not_yours_to_add', 'an outsider cannot add');
  assert.equal(await setChapter(F.stranger, dinner, tastingShot, true), 'not_yours_to_add');

  // The outsider IS in a chapter now — but still cannot move a photo they may not see.
  await named(vip, F.outGuest);
  assert.equal(await setChapter(F.outUser, vip, tastingShot, true), 'cannot_see_photo', 'a photo they cannot see');
  assert.equal(await linkHow(vip, tastingShot), null);

  // Before the event is done the couple is judged like anyone (they are on no task of Tasting): they cannot move it.
  assert.equal(await setChapter(F.couple, vip, tastingShot, true), 'cannot_see_photo', 'a host who cannot see it yet');
  // Once done they see every chapter — and add to any chapter; a shot's own chapter is never taken away; an added one is.
  await finishTheEvent(true);
  assert.equal(await setChapter(F.couple, vip, tastingShot, false), null, 'removing a link that is not there is a no-op');
  assert.equal(await setChapter(F.couple, tasting, tastingShot, false), 'shot_here');
  assert.equal(await linkHow(tasting, tastingShot), 'captured');
  assert.equal(await setChapter(F.inUser, dinner, tastingShot, false), null);
  assert.equal(await linkHow(dinner, tastingShot), null, 'the added link is gone');
  await finishTheEvent(false);

  // Nobody writes a link straight through the table — only through the rule.
  await asUser(F.couple);
  await assert.rejects(
    () => db.query(`INSERT INTO public.papic_chapter_captures (block_id, guest_capture_id, how) VALUES ($1,$2,'added')`, [vip, tastingShot]),
    /permission denied/i,
  );
});

test('a host adds an Unsorted photo to a chapter, and the people of that chapter then see it', async () => {
  await asOwner();
  const loose = (
    await db.query<{ capture_id: string }>(
      `INSERT INTO public.papic_guest_captures (event_id, guest_id, r2_object_key, captured_at) VALUES ($1,$2,'r2://u',$3) RETURNING capture_id`,
      [F.eventId, F.outGuest, DURING_REAL],
    )
  ).rows[0]!.capture_id;
  assert.equal((await memoriesOf(F.inUser)).some((r) => r.guest_capture_id === loose), false, 'unsorted: not in any chapter read');
  assert.equal(await setChapter(F.outUser, tasting, loose, true), 'not_yours_to_add', 'a guest outside Tasting cannot put it there');
  assert.equal(await setChapter(F.couple, tasting, loose, true), null);
  assert.ok(sees(await memoriesOf(F.inUser), loose, tasting), 'Tasting’s people see it now');
});

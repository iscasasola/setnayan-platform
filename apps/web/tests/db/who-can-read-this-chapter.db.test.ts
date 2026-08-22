/**
 * tests/db/who-can-read-this-chapter.db.test.ts — "only me / the people of this
 * celebration / everyone" is three values of ONE column, and the middle one can
 * never reach the public.
 *
 * Owner, 2026-08-20: *"they also get to choose whether it is only me, private
 * (all in that event only), public."*
 *
 * 🔑 WHY THE AUDIENCE LIVES IN `status` AND NOT IN A NEW COLUMN. Ten shipped
 * read paths ask `status = 'published'`. As a third status, an event-only
 * chapter is refused by every one of them WITHOUT being edited — and by every
 * read path written in future. As a separate `audience` column, all ten would
 * have kept serving event-only chapters to the internet until each was found
 * and changed, and the eleventh would leak forever. **The safe direction is the
 * one where forgetting means hiding**, and that is what these tests pin.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

let author = '';
let stranger = '';
let ownEvent = '';

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function asAnon(): Promise<void> {
  await setAuthUid(db, null);
  await setAuthRole('anon');
  await db.exec(`SET ROLE anon`);
}
async function asTheServer(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}

async function newUser(email: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return u.rows[0]!.id;
}

/** Insert as the SERVER (so the tie trigger is satisfied), returning the id. */
async function seedChapter(
  title: string,
  status: string,
  eventId: string | null,
  uid = author,
): Promise<string> {
  const r = await db.query<{ chapter_id: string }>(
    `INSERT INTO public.creator_chapters
       (user_id, title, kind, body, status, event_id, published_at)
     VALUES ($1, $2, 'wedding', 'the story', $3, $4, NOW())
     RETURNING chapter_id`,
    [uid, title, status, eventId],
  );
  return r.rows[0]!.chapter_id;
}

/** How many of these chapters can `role` SELECT right now? */
async function visibleTitles(): Promise<string[]> {
  const r = await db.query<{ title: string }>(
    `SELECT title FROM public.creator_chapters ORDER BY title`,
  );
  return r.rows.map((x) => x.title);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  author = await newUser('author@audience.test');
  stranger = await newUser('stranger@audience.test');
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision, region)
     VALUES ('Their day', 'birthday', '2026-05-05'::date, 'day', 'NCR') RETURNING event_id`,
  );
  ownEvent = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [ownEvent, author],
  );
  // The author has a public page — so "published" really is public for them and
  // the test is not passing for the wrong reason.
  await db.query(
    `UPDATE public.users SET slug = 'the-author', public_profile_enabled = TRUE WHERE user_id = $1`,
    [author],
  );
  await seedChapter('only me', 'draft', null);
  await seedChapter('shared with the day', 'event', ownEvent);
  await seedChapter('everyone', 'published', ownEvent);
});
after(async () => {
  await db.close();
});

/* ── the shape ──────────────────────────────────────────────────────────── */

test('the column takes exactly three values', async () => {
  await asTheServer();
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid = 'public.creator_chapters'::regclass
        AND conname = 'creator_chapters_status_check'`,
  );
  assert.equal(r.rows.length, 1);
  for (const v of ['draft', 'event', 'published']) {
    assert.match(r.rows[0]!.def, new RegExp(`'${v}'`), `${v} is not an allowed audience`);
  }
});

/* ── 🔴 the middle answer is NOT public ─────────────────────────────────── */

test('🔴 a stranger to the internet cannot read an event-only chapter', async () => {
  await asAnon();
  const titles = await visibleTitles();
  await asTheServer();
  assert.ok(
    !titles.includes('shared with the day'),
    'Anon can read a chapter shared with one celebration. "The people of this ' +
      'celebration" would then mean "the internet", under a word that promises ' +
      'the opposite.',
  );
  assert.ok(!titles.includes('only me'));
  // ⚠ THE LIST IS ACTUALLY EMPTY, AND THAT IS NOT WHAT IS BEING PINNED HERE.
  // The public-read policy's EXISTS subquery reads `users`, whose own RLS
  // refuses anon — so it errs CLOSED and anon sees nothing at all through
  // PostgREST. The real public render path uses the service role and filters in
  // app code. The assertion above is therefore written as "the event-only one
  // is not in the list", so it keeps its teeth if that policy is ever widened.
});

test('🔴 another signed-in account cannot read an event-only chapter either', async () => {
  await asUser(stranger);
  const titles = await visibleTitles();
  await asTheServer();
  assert.ok(!titles.includes('shared with the day'), 'a stranger read somebody’s private-to-the-day story');
  assert.ok(!titles.includes('only me'));
});

test('the author still sees all three of their own', async () => {
  await asUser(author);
  const titles = await visibleTitles();
  await asTheServer();
  assert.deepEqual(titles, ['everyone', 'only me', 'shared with the day']);
});

test('the PUBLIC read path — status = published — returns only the public one', async () => {
  // The exact predicate lib/creator-public.ts and nine other places use.
  await asTheServer();
  const r = await db.query<{ title: string }>(
    `SELECT title FROM public.creator_chapters WHERE status = 'published' ORDER BY title`,
  );
  assert.deepEqual(
    r.rows.map((x) => x.title),
    ['everyone'],
    'An event-only chapter answers to `status = published`, so every public ' +
      'read in the product would serve it.',
  );
});

/* ── the rules that keep the middle answer honest ───────────────────────── */

test('🔴 "shared with the celebration" without a celebration FAILS CLOSED to only-me', async () => {
  // ⚖ The DIRECTION is what matters. The composer refuses this first, with a
  // sentence a person can act on. For a direct write the database does not
  // raise — the floor trigger drops it to "only me", which is the safe half of
  // the two possible wrong answers: nobody else can read it. The CHECK is still
  // there underneath, and can only be reached if the trigger is removed.
  await asTheServer();
  const id = await seedChapter('nowhere to share', 'event', null);
  const r = await db.query<{ status: string }>(
    `SELECT status FROM public.creator_chapters WHERE chapter_id = $1`,
    [id],
  );
  assert.equal(
    r.rows[0]!.status,
    'draft',
    'A chapter claiming to be shared with a celebration it does not name stayed ' +
      'shared. There is nobody that audience describes.',
  );
  const c = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_constraint
      WHERE conrelid = 'public.creator_chapters'::regclass
        AND conname = 'creator_chapters_event_audience_needs_event'`,
  );
  assert.equal(c.rows[0]!.n, 1, 'the constraint underneath the trigger is gone');
});

test('detaching the celebration drops the chapter back to only-me', async () => {
  // 🪤 WITHOUT THE TRIGGER THE CONSTRAINT ABOVE REFUSES A LEGITIMATE EDIT —
  // somebody unlinking the celebration would be told their own save is invalid,
  // with nothing on screen able to explain it.
  await asTheServer();
  const id = await seedChapter('unlink me', 'event', ownEvent);
  await db.query(`UPDATE public.creator_chapters SET event_id = NULL WHERE chapter_id = $1`, [id]);
  const r = await db.query<{ status: string; event_id: string | null }>(
    `SELECT status, event_id FROM public.creator_chapters WHERE chapter_id = $1`,
    [id],
  );
  assert.equal(r.rows[0]!.event_id, null);
  assert.equal(r.rows[0]!.status, 'draft');
});

test('a chapter anybody else can read needs writing — both shared answers', async () => {
  await asTheServer();
  for (const status of ['event', 'published']) {
    let err: string | null = null;
    try {
      await db.query(
        `INSERT INTO public.creator_chapters (user_id, title, kind, body, status, event_id)
         VALUES ($1, $2, 'wedding', '   ', $3, $4)`,
        [author, `empty ${status}`, status, ownEvent],
      );
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
    assert.match(
      String(err),
      /creator_chapters_shared_needs_body/,
      `an empty chapter can be shared as "${status}"`,
    );
  }
  // …and a draft is deliberately unconstrained: that is where an unfinished
  // story lives.
  await db.query(
    `INSERT INTO public.creator_chapters (user_id, title, kind, body, status)
     VALUES ($1, 'empty draft', 'wedding', '', 'draft')`,
    [author],
  );
});

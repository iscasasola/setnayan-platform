/**
 * tests/db/chapter-cannot-hang-off-a-strangers-day.db.test.ts
 *
 * A chapter may only be attached to a celebration that is really yours, and the
 * host's "this belongs on my day" is never the author's to write.
 *
 * ── WHAT SHIPPED, AND WHY IT WAS WRONG (measured in PRODUCTION 2026-08-20,
 *    inside a rolled-back transaction) ───────────────────────────────────────
 * As the `authenticated` role carrying one account's own JWT, the live database
 * ACCEPTED an INSERT that named somebody else's wedding in `event_id` AND
 * stamped `host_included_at` in the same statement. Both stuck. That put:
 *   · that wedding's booked suppliers on a stranger's public chapter page, and
 *   · the stranger's chapter where Setnayan speaks about that wedding.
 *
 * 🔑 THE GUARD THAT WAS SUPPOSED TO STOP IT COULD NOT FIRE. 20271143154220
 * revoked UPDATE/INSERT on the single column — but `authenticated` holds
 * TABLE-level INSERT/UPDATE here, and a column-level REVOKE cannot subtract
 * from a table-level grant. A unit test pinned the revoke by reading the
 * migration TEXT, so it stayed green over a control that did not exist.
 * **A guard can match a string instead of the act — so every test below is a
 * real write, executed under a real `SET ROLE authenticated`.**
 *
 * 🪤 AND THE FIRST FIX WAS INERT FOR A DIFFERENT REASON: inside a
 * `SECURITY DEFINER` body `current_user` is the function's OWNER, so
 * "is this a browser caller?" was false for everybody. The trigger is INVOKER;
 * only the two lookups it needs are DEFINER.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

/** The author: hosts their OWN celebration, and nothing else. */
let author = '';
let ownEvent = '';
/** Somebody else's celebration. The author has no tie to it whatsoever. */
let strangerEvent = '';
/** A supplier account whose shop was booked on the stranger's celebration. */
let supplier = '';

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
/** Back to the replay's superuser — this is what our own server actions are. */
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

async function newEvent(label: string, hostUid: string): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events
       (display_name, event_type, event_date, event_date_precision, region)
     VALUES ($1, 'birthday', '2026-05-05'::date, 'day', 'NCR')
     RETURNING event_id`,
    [`Event ${label}`],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple')`,
    [eventId, hostUid],
  );
  return eventId;
}

/** Insert a chapter AS `uid`; returns the error message, or null on success. */
async function attemptChapter(
  uid: string,
  cols: { event_id: string | null; host_included_at: string | null; title?: string },
): Promise<string | null> {
  await asUser(uid);
  try {
    await db.query(
      `INSERT INTO public.creator_chapters
         (user_id, title, kind, body, status, event_id, host_included_at)
       VALUES ($1, $2, 'wedding', 'the story', 'published', $3, $4)`,
      [uid, cols.title ?? 'a chapter', cols.event_id, cols.host_included_at],
    );
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  } finally {
    await asTheServer();
  }
}

async function chapterRow(title: string): Promise<{
  event_id: string | null;
  host_included_at: string | null;
} | null> {
  const r = await db.query<{ event_id: string | null; host_included_at: string | null }>(
    `SELECT event_id, host_included_at FROM public.creator_chapters WHERE title = $1`,
    [title],
  );
  return r.rows[0] ?? null;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  author = await newUser('author@chapter.test');
  const stranger = await newUser('stranger@chapter.test');
  ownEvent = await newEvent('theirs', author);
  strangerEvent = await newEvent('somebody-elses', stranger);

  supplier = await newUser('supplier@chapter.test');
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Booked Co', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [supplier],
  );
  await db.query(
    `INSERT INTO public.event_vendors (event_id, vendor_name, category, linked_vendor_profile_id)
     VALUES ($1, 'Booked Co', 'catering', $2)`,
    [strangerEvent, v.rows[0]!.vendor_profile_id],
  );
});
after(async () => {
  await db.close();
});

/* ── the shape of the fix ───────────────────────────────────────────────── */

test('the trigger fires on EVERY insert and update, not only when event_id is named', async () => {
  await asTheServer();
  const r = await db.query<{ tgtype: number }>(
    `SELECT tgtype FROM pg_trigger
      WHERE tgrelid = 'public.creator_chapters'::regclass
        AND tgname = 'set_chapter_host_inclusion_trg'`,
  );
  assert.equal(r.rows.length, 1, 'the inclusion trigger is gone');
  // An UPDATE-OF trigger carries a column list; this one must not.
  const cols = await db.query<{ n: number }>(
    `SELECT coalesce(array_length(tgattr::int2[], 1), 0) AS n FROM pg_trigger
      WHERE tgrelid = 'public.creator_chapters'::regclass
        AND tgname = 'set_chapter_host_inclusion_trg'`,
  );
  assert.equal(
    Number(cols.rows[0]!.n),
    0,
    'The trigger is scoped to named columns again. An UPDATE naming only ' +
      'host_included_at would then never reach it — which is how the forged ' +
      'stamp got through the first time.',
  );
});

test('the browser test survives the SECURITY DEFINER boundary', async () => {
  // 🪤 THE TRAP THIS PINS. Inside a `SECURITY DEFINER` body `current_user` is
  // the function's OWNER, never the caller — so a gate written as
  // `current_user IN ('authenticated','anon')` is false for everybody and does
  // nothing at all. Measured against production, twice: the forged INSERT still
  // went through. `current_setting('role')` is what actually reports the
  // caller through the boundary.
  await asTheServer();
  const r = await db.query<{ prosecdef: boolean; src: string }>(
    `SELECT prosecdef, prosrc AS src FROM pg_proc WHERE proname = 'set_chapter_host_inclusion'`,
  );
  assert.equal(r.rows.length, 1);
  assert.equal(
    r.rows[0]!.prosecdef,
    true,
    'The trigger must see memberships and bookings whoever is writing — under ' +
      'invoker rights RLS can hide a supplier’s own booking row and refuse them ' +
      'their own day.',
  );
  assert.match(
    r.rows[0]!.src,
    /current_setting\('role', true\)/,
    'The caller test is not reading current_setting(role). If it went back to ' +
      'current_user, this whole gate is inert and nothing else here would say so.',
  );
  // Strip `--` comments first: the body explains the trap in prose, and a raw
  // match would read the WARNING about current_user as a use of it. (The same
  // reason the doors guard strips comments — a note naming the defect it just
  // fixed must not fail the guard that fixed it.)
  const codeOnly = r.rows[0]!.src.replace(/^\s*--.*$/gm, '');
  assert.doesNotMatch(
    codeOnly,
    /current_user IN/,
    'current_user inside a definer body is the OWNER — that comparison can only ' +
      'ever be false.',
  );
});

/* ── forgery ────────────────────────────────────────────────────────────── */

test('🔴 an author CANNOT attach their chapter to a celebration that is not theirs', async () => {
  const err = await attemptChapter(author, {
    event_id: strangerEvent,
    host_included_at: null,
    title: 'forged attach',
  });
  assert.match(
    String(err),
    /chapter_event_not_yours/,
    'A stranger can hang their public page off somebody else’s wedding — and ' +
      'that page renders the wedding’s booked suppliers.',
  );
  assert.equal(await chapterRow('forged attach'), null, 'the row was written anyway');
});

test('🔴 an author CANNOT stamp themselves onto a stranger’s day', async () => {
  const err = await attemptChapter(author, {
    event_id: strangerEvent,
    host_included_at: new Date().toISOString(),
    title: 'forged attach + stamp',
  });
  assert.match(String(err), /chapter_event_not_yours/);
});

test('🔴 a forged host_included_at is DROPPED, even on a celebration they do host', async () => {
  const err = await attemptChapter(author, {
    event_id: null,
    host_included_at: new Date().toISOString(),
    title: 'forged stamp, no celebration',
  });
  assert.equal(err, null, 'a chapter about no celebration is perfectly legal');
  const row = await chapterRow('forged stamp, no celebration');
  assert.equal(
    row?.host_included_at,
    null,
    'The author wrote a value that records the HOST’s decision.',
  );
});

test('🔴 an author cannot stamp inclusion by UPDATE either', async () => {
  // The path the old `UPDATE OF event_id` trigger never even saw.
  await asTheServer();
  await db.query(
    `INSERT INTO public.creator_chapters (user_id, title, kind, body, status, event_id)
     VALUES ($1, 'update-stamp', 'wedding', 'x', 'published', NULL)`,
    [author],
  );
  await asUser(author);
  await db.query(
    `UPDATE public.creator_chapters SET host_included_at = NOW() WHERE title = 'update-stamp'`,
  );
  await asTheServer();
  assert.equal((await chapterRow('update-stamp'))?.host_included_at, null);
});

test('🔴 an author cannot RE-POINT an existing chapter at a stranger’s celebration', async () => {
  await asTheServer();
  await db.query(
    `INSERT INTO public.creator_chapters (user_id, title, kind, body, status, event_id)
     VALUES ($1, 're-point', 'wedding', 'x', 'published', $2)`,
    [author, ownEvent],
  );
  await asUser(author);
  let err: string | null = null;
  try {
    await db.query(
      `UPDATE public.creator_chapters SET event_id = $1 WHERE title = 're-point'`,
      [strangerEvent],
    );
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
  await asTheServer();
  assert.match(String(err), /chapter_event_not_yours/);
  assert.equal((await chapterRow('re-point'))?.event_id, ownEvent);
});

/* ── the legitimate paths, which must all still work ────────────────────── */

test('an author attaching their OWN celebration is accepted and auto-included', async () => {
  const err = await attemptChapter(author, {
    event_id: ownEvent,
    host_included_at: null,
    title: 'their own day',
  });
  assert.equal(err, null);
  const row = await chapterRow('their own day');
  assert.equal(row?.event_id, ownEvent);
  assert.ok(row?.host_included_at, 'a couple must never have to approve themselves');
});

test('a BOOKED SUPPLIER may attach the day they worked — and is NOT auto-included', async () => {
  // The 2026-08-15 ruling: attaching is the author's act, appearing on the
  // couple's day is the host's.
  const err = await attemptChapter(supplier, {
    event_id: strangerEvent,
    host_included_at: null,
    title: 'the supplier’s side',
  });
  assert.equal(err, null, 'a supplier who worked the day may tell their side');
  const row = await chapterRow('the supplier’s side');
  assert.equal(row?.event_id, strangerEvent);
  assert.equal(
    row?.host_included_at,
    null,
    'A supplier’s piece must wait for the host to add it to their day.',
  );
});

test('the HOST can take a chapter off their day, and an ordinary edit does not put it back', async () => {
  // 🪤 THE REGRESSION THIS EXISTS FOR. Widening the trigger to every update
  // re-ran "the author is the host ⇒ included" on ordinary edits, so the next
  // title change silently undid the host's removal.
  await asTheServer();
  await db.query(
    `UPDATE public.creator_chapters SET host_included_at = NULL WHERE title = 'their own day'`,
  );
  assert.equal((await chapterRow('their own day'))?.host_included_at, null);

  await asUser(author);
  await db.query(
    `UPDATE public.creator_chapters SET title = 'their own day' , body = 'edited'
      WHERE title = 'their own day'`,
  );
  await asTheServer();
  assert.equal(
    (await chapterRow('their own day'))?.host_included_at,
    null,
    'An edit put the chapter back on a day the host had removed it from.',
  );

  await db.query(
    `UPDATE public.creator_chapters SET host_included_at = NOW() WHERE title = 'their own day'`,
  );
  assert.ok(
    (await chapterRow('their own day'))?.host_included_at,
    'the host can no longer put their own chapter back on their day',
  );
});

test('detaching the celebration clears the inclusion with it', async () => {
  await asUser(author);
  await db.query(
    `UPDATE public.creator_chapters SET event_id = NULL WHERE title = 'their own day'`,
  );
  await asTheServer();
  const row = await chapterRow('their own day');
  assert.equal(row?.event_id, null);
  assert.equal(row?.host_included_at, null);
});

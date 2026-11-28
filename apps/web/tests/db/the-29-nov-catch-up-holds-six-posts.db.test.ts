/**
 * 📣 THE 29 NOV FACEBOOK CATCH-UP HOLDS SIX POSTS (owner, 29 Nov 2026; migration 20271367965867).
 *
 * Prod, measured read-only at 02:55 Manila on 29 Nov: #8528's library import (20271366752632) keeps only
 * `WHERE v.scheduled_for > now()`, so it never inserted the two 28 Nov posts (lib-3ef2ffc3… "Introduce Setnayan ·
 * Plan it, free" and lib-60ee51dd… "Comment Bait"). The catch-up now inserts them itself, then places the day.
 *
 * This test rebuilds that prod state on the replayed schema with now() FIXED at 02:55 Manila (a public.now()
 * shadowing pg_catalog.now() through search_path, for the two migration runs only), then proves:
 *   1 · the two re-inserted rows carry #8528's copy byte-for-byte (compared with an unfiltered v2 run);
 *   2 · after the catch-up, 29 Nov holds exactly 6 live posts on distinct whole hours 10:00–20:00, ≥ 1 h apart,
 *       both re-inserted rows among them, the Facebook-held 14:00 post untouched; the two badge posts are pulled;
 *   3 · a second run changes nothing (every social_posts row identical), and a re-inserted row that was pulled or
 *       published by then stays as it is and is not inserted again.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const MIG = join(__dirname, '..', '..', '..', '..', 'supabase', 'migrations');
const v2Sql = readFileSync(join(MIG, '20271366752632_social_library_v2.sql'), 'utf8');
const catchUpSql = readFileSync(join(MIG, '20271367965867_facebook_catch_up_29_nov.sql'), 'utf8');
const V2_PAST_FILTER = '\nWHERE v.scheduled_for > now();';

const PLAN_IT = 'lib-3ef2ffc3a7977c677cad609d';
const COMMENT_BAIT = 'lib-60ee51dd8318fa11af6a2e24';
const LIVE_IT = 'lib-11d11152b1d14c6ea5d25301';
const FIVE_WORDS = 'lib-a89200ad9943ad2444ffe9d5';
const BADGE_SHOP = '485d28a2-c614-434f-993a-e3ae89b41853';
const FIRST_POST_REF = 'dfeb3c42-5d8d-4694-974e-4ddae83a68a4';
const BRIDAL_CAR_REF = 'journal:bridal-car-and-motorcade-wedding';

/** Run `sql` with now() reading `at` (a fixed instant), then restore the real clock. */
async function atInstant(at: string, sql: string): Promise<void> {
  await db.exec(`
    CREATE OR REPLACE FUNCTION public.now() RETURNS timestamptz LANGUAGE sql STABLE AS $f$ SELECT '${at}'::timestamptz $f$;
    SET search_path = public, pg_catalog;
  `);
  try {
    await db.exec(sql);
  } finally {
    await db.exec(`RESET search_path; DROP FUNCTION IF EXISTS public.now();`);
  }
}

const COPY_COLS = 'source_ref, title, body, media_url, media_urls, link_url, slot, first_comment';
async function copyOf(refs: string[]) {
  return (
    await db.query<Record<string, unknown>>(
      `SELECT ${COPY_COLS} FROM public.social_posts WHERE source_type = 'library' AND source_ref = ANY($1::text[]) ORDER BY source_ref`,
      [`{${refs.join(',')}}`],
    )
  ).rows;
}

async function snapshot(): Promise<string> {
  const r = await db.query<{ j: string }>(
    `SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.post_id)::text, '[]') AS j FROM public.social_posts p`,
  );
  return r.rows[0]!.j;
}

async function day(): Promise<Array<{ source_ref: string; title: string; hhmm: string; status: string }>> {
  return (
    await db.query<{ source_ref: string; title: string; hhmm: string; status: string }>(
      `SELECT source_ref, title, to_char(scheduled_for AT TIME ZONE 'Asia/Manila', 'HH24:MI') AS hhmm, status
         FROM public.social_posts
        WHERE status IN ('scheduled', 'scheduled_on_fb', 'publishing', 'published')
          AND scheduled_for >= '2026-11-29 00:00:00+08' AND scheduled_for < '2026-11-30 00:00:00+08'
        ORDER BY scheduled_for`,
    )
  ).rows;
}

let v2Copy: Record<string, unknown>[];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null);

  // #8528's copy for the two rows, from an unfiltered v2 run (the reference for the byte-for-byte check).
  await db.exec(`DELETE FROM public.social_posts`);
  await db.exec(v2Sql.replace(V2_PAST_FILTER, ';'));
  v2Copy = await copyOf([PLAN_IT, COMMENT_BAIT]);
  await db.exec(`DELETE FROM public.social_posts`);

  // Prod as measured at 02:55 Manila, 29 Nov: v2 ran with the past filter after both 28 Nov slots had passed.
  await atInstant('2026-11-29 02:55:00+08', v2Sql);
  await db.query(
    `INSERT INTO public.social_posts (source_type, source_ref, title, body, status)
     VALUES ('announcement', $1, 'First public post', 'Hello from Setnayan.', 'scheduled')`,
    [FIRST_POST_REF],
  );
  await db.query(
    `INSERT INTO public.social_posts (source_type, source_ref, title, body, slot, scheduled_for, status, facebook_post_id)
     VALUES ('announcement', $1, 'Articles · The bridal car and motorcade, planned right', 'x', 'afternoon',
             '2026-11-29 14:00:00+08', 'scheduled_on_fb', '111_222')`,
    [BRIDAL_CAR_REF],
  );
  for (const badge of ['service_cards_3', 'booked_loop_1']) {
    await db.query(
      `INSERT INTO public.social_posts (source_type, source_ref, title, body, status)
       VALUES ('supplier_badge', $1, 'Badge', 'x', 'failed')`,
      [`${BADGE_SHOP}:${badge}`],
    );
  }
});

after(async () => {
  await db?.close();
});

test('replay applies every migration', () => {
  assert.equal(replay.applied, replay.total);
});

test('0 · the prod state: the two 28 Nov library rows are missing before the catch-up', async () => {
  assert.equal(v2Copy.length, 2, 'the unfiltered v2 run lost a reference row');
  assert.deepEqual(await copyOf([PLAN_IT, COMMENT_BAIT]), []);
  assert.equal((await copyOf([LIVE_IT, FIVE_WORDS])).length, 2);
});

test('1–2 · the catch-up re-inserts both rows with #8528\'s copy and places exactly 6 posts on 29 Nov', async () => {
  await atInstant('2026-11-29 02:55:00+08', catchUpSql);

  assert.deepEqual(await copyOf([PLAN_IT, COMMENT_BAIT]), v2Copy, 'the re-inserted copy differs from #8528');

  const rows = await day();
  assert.deepEqual(
    rows.map((r) => [r.hhmm, r.source_ref, r.status]),
    [
      ['10:00', FIRST_POST_REF, 'scheduled'],
      ['12:00', PLAN_IT, 'scheduled'],
      ['14:00', BRIDAL_CAR_REF, 'scheduled_on_fb'],
      ['16:00', LIVE_IT, 'scheduled'],
      ['18:00', COMMENT_BAIT, 'scheduled'],
      ['20:00', FIVE_WORDS, 'scheduled'],
    ],
  );
  const hours = rows.map((r) => Number(r.hhmm.slice(0, 2)));
  assert.ok(rows.every((r) => r.hhmm.endsWith(':00')), 'a post is off the whole hour');
  assert.equal(new Set(hours).size, 6);
  for (let i = 1; i < hours.length; i++) assert.ok(hours[i]! - hours[i - 1]! >= 1, 'two posts under 1 h apart');

  const badges = await db.query<{ status: string }>(
    `SELECT status FROM public.social_posts WHERE source_type = 'supplier_badge' AND source_ref LIKE $1`,
    [`${BADGE_SHOP}:%`],
  );
  assert.deepEqual(badges.rows.map((r) => r.status), ['pulled', 'pulled']);
});

test('3 · a second run changes nothing; a pulled or published re-inserted row stays as it is', async () => {
  const once = await snapshot();
  await atInstant('2026-11-29 03:30:00+08', catchUpSql);
  assert.equal(await snapshot(), once, 'a second run changed a row');

  await db.query(`UPDATE public.social_posts SET status = 'pulled' WHERE source_type = 'library' AND source_ref = $1`, [PLAN_IT]);
  await db.query(
    `UPDATE public.social_posts SET status = 'published', facebook_post_id = '333_444' WHERE source_type = 'library' AND source_ref = $1`,
    [COMMENT_BAIT],
  );
  const handled = await snapshot();
  await atInstant('2026-11-29 04:00:00+08', catchUpSql);
  assert.equal(await snapshot(), handled, 'a run after a pull or a publish changed a row');
  const n = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.social_posts WHERE source_type = 'library' AND source_ref IN ($1, $2)`,
    [PLAN_IT, COMMENT_BAIT],
  );
  assert.equal(n.rows[0]!.n, 2, 'a pulled or published row was inserted again');
});

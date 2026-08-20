/**
 * A CHAPTER'S STORY IS WRITING — DB verification (executed, not prose).
 *
 * Owner 2026-08-12: "their storytelling doesn't need to be a video anymore. it
 * will be their editorial and they can also paste a video they can upload to
 * the editorial."
 *
 * Before this change a chapter could only be published with an `embed_url`, and
 * the only accepted providers were YouTube / Instagram / TikTok. So the ability
 * to tell your own story on Setnayan was gated on already having an audience
 * somewhere else. Measured in prod on 2026-08-12: creator_chapters = 0 rows,
 * users with public_profile_enabled = 0 of 9.
 *
 * What this suite locks (all against the REAL replayed schema, migration
 * 20271140092009):
 *
 *   1. THE POINT — a published chapter with a story and NO video is ACCEPTED.
 *      If only this test existed it would still be the one that matters.
 *   2. THE BACKSTOP — a published chapter with no story is REFUSED by the
 *      database, not merely by the server action. The app layer is never the
 *      control: PostgREST serves this table to the browser client.
 *   3. A DRAFT is deliberately unconstrained — that is where unfinished work
 *      lives, and constraining it would break "save and come back later".
 *   4. THE RENAME landed — `body` exists, and the travel-shaped
 *      `substrate.itinerary` key it replaced is carried across, not abandoned.
 *   5. THE SECOND WALL — the public-read predicate returns a video-less
 *      published chapter. This is the regression that would otherwise have
 *      shipped: fixing only the publish button, while three read paths still
 *      tested `embed_url`, would have published stories into nowhere with a
 *      success message on screen.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

/*
 * ⚠ THE CONSTRAINT WAS RENAMED ON 2026-08-20 — `creator_chapters_published_needs_body`
 * → `creator_chapters_shared_needs_body`. The RULE did not change, it WIDENED: a
 * chapter can now also be shared with the people of one celebration ('event'),
 * and that is just as much a thing somebody else opens, so the old name had
 * become a lie about its own scope. See migration 20271150237136.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const STORY = 'We got married in Batanes.\n\nIt rained the whole morning, and then it did not.';

let author: string;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  // Timezone-independent, per the 2026-08-09 lesson: a suite that only passes
  // on a +08 laptop is not a passing suite.
  await db.exec(`SET TIME ZONE 'UTC'`);

  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('storyteller@test.local', jsonb_build_object('account_type','customer'))
     RETURNING id`,
  );
  author = r.rows[0]!.id;
  await db.query(
    `UPDATE public.users SET public_profile_enabled = TRUE, slug = 'ana-and-marco' WHERE user_id = $1`,
    [author],
  );
});

after(async () => {
  await db?.close();
});

// ── 1 · THE POINT ───────────────────────────────────────────────────────────

test('a published chapter with a STORY and NO VIDEO is accepted', async () => {
  const r = await db.query<{ public_id: string; embed_url: string | null }>(
    `INSERT INTO public.creator_chapters (user_id, title, kind, body, status, published_at)
     VALUES ($1, 'Our Batanes wedding', 'wedding', $2, 'published', now())
     RETURNING public_id, embed_url`,
    [author, STORY],
  );
  assert.equal(r.rows.length, 1, 'the whole session exists so that this insert succeeds');
  assert.equal(r.rows[0]!.embed_url, null, 'no video, and that is fine');
  assert.match(r.rows[0]!.public_id, /^S89C-/);
});

// ── 2 · THE BACKSTOP ────────────────────────────────────────────────────────

test('a published chapter with NO story is refused by the DATABASE', async () => {
  await assert.rejects(
    async () =>
      db.query(
        `INSERT INTO public.creator_chapters (user_id, title, kind, status, published_at)
         VALUES ($1, 'Empty', 'travel', 'published', now())`,
        [author],
      ),
    /creator_chapters_shared_needs_body/,
    'the app action validates first with a readable sentence; this is the control',
  );
  await db.exec('ROLLBACK').catch(() => {});
});

test('a video CANNOT substitute for the story on a published chapter', async () => {
  // The inverse of the old rule. An embed alone is no longer publishable,
  // because the chapter would render as a bare iframe with nothing said.
  await assert.rejects(
    async () =>
      db.query(
        `INSERT INTO public.creator_chapters (user_id, title, kind, embed_url, embed_provider, status, published_at)
         VALUES ($1, 'Video only', 'travel',
                 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'youtube', 'published', now())`,
        [author],
      ),
    /creator_chapters_shared_needs_body/,
  );
  await db.exec('ROLLBACK').catch(() => {});
});

test('whitespace is not a story', async () => {
  await assert.rejects(
    async () =>
      db.query(
        `INSERT INTO public.creator_chapters (user_id, title, kind, body, status, published_at)
         VALUES ($1, 'Blank', 'travel', '   ', 'published', now())`,
        [author],
      ),
    /creator_chapters_shared_needs_body/,
  );
  await db.exec('ROLLBACK').catch(() => {});
});

// ── 3 · DRAFTS STAY FREE ────────────────────────────────────────────────────

test('a DRAFT needs nothing — unfinished work must be savable', async () => {
  const r = await db.query<{ status: string }>(
    `INSERT INTO public.creator_chapters (user_id, title, kind)
     VALUES ($1, 'Started, not finished', 'lifestyle')
     RETURNING status`,
    [author],
  );
  assert.equal(r.rows[0]!.status, 'draft');
});

// ── 4 · THE RENAME ──────────────────────────────────────────────────────────

test('`body` exists as a first-class column, not a jsonb key', async () => {
  const r = await db.query<{ data_type: string }>(
    `SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='creator_chapters' AND column_name='body'`,
  );
  assert.equal(r.rows.length, 1, 'migration 20271140092009 must have applied');
  assert.equal(r.rows[0]!.data_type, 'text');
});

test('the backfill carries substrate.itinerary into body and retires the key', async () => {
  // Replays start from an empty table, so exercise the migration's own two
  // statements against a row shaped like the ones they were written for.
  const ins = await db.query<{ chapter_id: string }>(
    `INSERT INTO public.creator_chapters (user_id, title, kind, substrate)
     VALUES ($1, 'Legacy row', 'travel', jsonb_build_object('itinerary','Day one: Basco.','papic_gallery_id','evt_1'))
     RETURNING chapter_id`,
    [author],
  );
  const id = ins.rows[0]!.chapter_id;

  await db.query(
    `UPDATE public.creator_chapters
        SET body = btrim(substrate->>'itinerary')
      WHERE chapter_id = $1
        AND (body IS NULL OR btrim(body) = '')
        AND btrim(coalesce(substrate->>'itinerary','')) <> ''`,
    [id],
  );
  await db.query(
    `UPDATE public.creator_chapters SET substrate = substrate - 'itinerary' WHERE chapter_id = $1`,
    [id],
  );

  const r = await db.query<{ body: string; has_itinerary: boolean; gallery: string | null }>(
    `SELECT body, substrate ? 'itinerary' AS has_itinerary, substrate->>'papic_gallery_id' AS gallery
       FROM public.creator_chapters WHERE chapter_id = $1`,
    [id],
  );
  assert.equal(r.rows[0]!.body, 'Day one: Basco.', 'the writing survives the rename');
  assert.equal(r.rows[0]!.has_itinerary, false, 'no second home for the same value');
  assert.equal(r.rows[0]!.gallery, 'evt_1', 'the rest of the substrate bag is untouched');
});

// ── 5 · THE SECOND WALL ─────────────────────────────────────────────────────

test('the public-read predicate RETURNS a video-less published chapter', async () => {
  // The exact shape lib/creator-public.fetchPublishedChapters reads. Its app
  // filter used to be `!!embed_url`, which silently dropped exactly this row
  // from its own author's profile timeline.
  const r = await db.query<{ title: string; body: string | null; embed_url: string | null }>(
    `SELECT c.title, c.body, c.embed_url
       FROM public.creator_chapters c
       JOIN public.users u ON u.user_id = c.user_id AND u.public_profile_enabled = TRUE
      WHERE c.user_id = $1 AND c.status = 'published'
      ORDER BY c.published_at DESC`,
    [author],
  );
  assert.ok(r.rows.length >= 1, 'the published story must be readable');
  const story = r.rows.find((x) => x.title === 'Our Batanes wedding');
  assert.ok(story, 'the video-less chapter is present');
  assert.equal(story!.embed_url, null);
  assert.ok((story!.body ?? '').length > 0);
});

/**
 * EVENT HUB MUSIC — who may read and write `hub_music_tracks`, asserted against
 * the REPLAYED schema (migration 20271266495922_hub_music_tracks.sql).
 *
 * The list an admin uploads at /admin/hub-music and a couple picks from in
 * Look › Music (owner 2026-10-08). Pattern H: signed-in people read the
 * PUBLISHED rows, an admin writes, anon holds nothing.
 *
 * ── WHAT IS PINNED (each through a real `authenticated` / `anon` session) ──
 *   1. a couple reads only the published rows;
 *   2. a couple cannot read who uploaded a track (`created_by` is not granted);
 *   3. a non-admin cannot add, change, publish or remove a track;
 *   4. an admin can do all four, and reads unpublished rows too;
 *   5. anon reads nothing at all;
 *   6. a track cannot be published without a mood, and a mood is one of the
 *      nine; a file lives under `hub-music/` and belongs to one track only;
 *   7. the admin who added a track can be deleted — the track stays.
 *
 * 🛡 Sabotaged, each red then restored to green (the migration edited in place
 * in the working tree, then restored from a copy):
 *   • `USING (is_published = TRUE)` → `USING (TRUE)`           → 1 red;
 *   • `created_by` added to the SELECT grant                    → 2 red;
 *   • the admin policy's `WITH CHECK (public.is_admin())` → `WITH CHECK (TRUE)`
 *     and `USING (public.is_admin())` → `USING (TRUE)`          → 3 red;
 *   • the `published_has_a_mood` CHECK removed                  → 6 red;
 *   • `ON DELETE SET NULL` removed from `created_by`            → 7 red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

let COUPLE = '';
let ADMIN = '';
let UPLOADER = '';
let LIVE = '';
let DRAFT = '';

let n = 0;
async function newUser(): Promise<string> {
  n += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data, email_confirmed_at)
     VALUES ($1, jsonb_build_object('account_type','customer'::text), now()) RETURNING id`,
    [`acct${n}@hub-music.test`],
  );
  return u.rows[0]!.id;
}

async function as<T>(uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(uid ? 'SET ROLE authenticated' : 'SET ROLE anon');
  await setAuthUid(db, uid);
  try {
    return await fn();
  } finally {
    await db.exec('RESET ROLE');
    await setAuthUid(db, null);
  }
}

/** Resolves to the SQLSTATE a statement failed with, or 'ok'. */
async function outcome(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return 'ok';
  } catch (e) {
    return (e as { code?: string }).code ?? String((e as Error).message);
  }
}

const READ = `SELECT track_id, public_id, title, mood, r2_key, duration_seconds, file_bytes, is_published, sort_order
                FROM public.hub_music_tracks ORDER BY title`;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  COUPLE = await newUser();
  ADMIN = await newUser();
  UPLOADER = await newUser();
  await db.query(`UPDATE public.users SET account_type = 'admin' WHERE user_id = ANY($1::uuid[])`, [
    `{${ADMIN},${UPLOADER}}`,
  ]);

  const live = await db.query<{ track_id: string }>(
    `INSERT INTO public.hub_music_tracks (title, mood, r2_key, duration_seconds, file_bytes, is_published, created_by)
     VALUES ('Classic Romantic', 'classic_romantic', 'hub-music/a-classic.m4a', 175, 3000000, TRUE, $1)
     RETURNING track_id`,
    [UPLOADER],
  );
  LIVE = live.rows[0]!.track_id;
  const draft = await db.query<{ track_id: string }>(
    `INSERT INTO public.hub_music_tracks (title, mood, r2_key, duration_seconds, file_bytes, created_by)
     VALUES ('Velvet Court', NULL, 'hub-music/b-velvet.m4a', 147, 2600000, $1)
     RETURNING track_id`,
    [UPLOADER],
  );
  DRAFT = draft.rows[0]!.track_id;
});

after(async () => {
  await replay?.db.close();
});

test('the fixture is what it claims: one published track, one not, and a real admin', async () => {
  const rows = await db.query<{ is_published: boolean }>(
    `SELECT is_published FROM public.hub_music_tracks ORDER BY title`,
  );
  assert.deepEqual(rows.rows.map((r) => r.is_published), [true, false]);
  const a = await as(ADMIN, () => db.query<{ ok: boolean }>(`SELECT public.is_admin() AS ok`));
  assert.equal(a.rows[0]!.ok, true);
  const c = await as(COUPLE, () => db.query<{ ok: boolean }>(`SELECT public.is_admin() AS ok`));
  assert.equal(c.rows[0]!.ok, false);
});

test('1 · a couple reads only the published tracks', async () => {
  const r = await as(COUPLE, () => db.query<{ track_id: string; title: string }>(READ));
  assert.deepEqual(r.rows.map((x) => x.track_id), [LIVE]);
  assert.equal(r.rows[0]!.title, 'Classic Romantic');
});

test('2 · a couple cannot read who uploaded a track', async () => {
  assert.equal(
    await outcome(() => as(COUPLE, () => db.query(`SELECT created_by FROM public.hub_music_tracks`))),
    '42501',
  );
  const held = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.column_privileges
      WHERE table_schema = 'public' AND table_name = 'hub_music_tracks'
        AND grantee = 'authenticated' AND privilege_type = 'SELECT'`,
  );
  const cols = held.rows.map((r) => r.column_name);
  assert.ok(cols.includes('title') && cols.includes('r2_key'), `the picker's columns are readable: ${cols.join(',')}`);
  assert.ok(!cols.includes('created_by'), 'created_by is not in the SELECT grant');
});

test('3 · a non-admin cannot add, change, publish or remove a track', async () => {
  assert.equal(
    await outcome(() =>
      as(COUPLE, () =>
        db.query(
          `INSERT INTO public.hub_music_tracks (title, mood, r2_key, file_bytes, is_published)
           VALUES ('Mine', 'harana', 'hub-music/c-mine.m4a', 10, TRUE)`,
        ),
      ),
    ),
    '42501',
    'an insert is refused by row-level security',
  );
  // An UPDATE / DELETE the policy hides simply touches no row — count them.
  const upd = await as(COUPLE, () =>
    db.query(`UPDATE public.hub_music_tracks SET title = 'Hijacked', is_published = FALSE WHERE track_id = $1`, [LIVE]),
  );
  assert.equal(upd.affectedRows ?? 0, 0, 'a couple changes no row');
  const del = await as(COUPLE, () => db.query(`DELETE FROM public.hub_music_tracks WHERE track_id = $1`, [LIVE]));
  assert.equal(del.affectedRows ?? 0, 0, 'a couple removes no row');
  const still = await db.query<{ title: string; is_published: boolean }>(
    `SELECT title, is_published FROM public.hub_music_tracks WHERE track_id = $1`,
    [LIVE],
  );
  assert.deepEqual(still.rows, [{ title: 'Classic Romantic', is_published: true }]);
});

test('4 · an admin reads every track and can add, change, publish and remove one', async () => {
  const seen = await as(ADMIN, () => db.query<{ track_id: string }>(READ));
  assert.deepEqual(seen.rows.map((r) => r.track_id).sort(), [LIVE, DRAFT].sort());

  await as(ADMIN, () =>
    db.query(
      `INSERT INTO public.hub_music_tracks (title, mood, r2_key, file_bytes)
       VALUES ('Harana - Moonlit', 'harana', 'hub-music/d-harana.m4a', 3200000)`,
    ),
  );
  const pub = await as(ADMIN, () =>
    db.query(`UPDATE public.hub_music_tracks SET is_published = TRUE WHERE r2_key = 'hub-music/d-harana.m4a'`),
  );
  assert.equal(pub.affectedRows, 1);
  const couple = await as(COUPLE, () => db.query<{ title: string }>(READ));
  assert.deepEqual(couple.rows.map((r) => r.title), ['Classic Romantic', 'Harana - Moonlit']);
  const del = await as(ADMIN, () =>
    db.query(`DELETE FROM public.hub_music_tracks WHERE r2_key = 'hub-music/d-harana.m4a'`),
  );
  assert.equal(del.affectedRows, 1);
});

test('5 · anon reads nothing', async () => {
  assert.equal(await outcome(() => as(null, () => db.query(`SELECT title FROM public.hub_music_tracks`))), '42501');
});

test('6 · the table refuses a track that could not be listed or played', async () => {
  const insert = (cols: string, vals: string) =>
    outcome(() => db.query(`INSERT INTO public.hub_music_tracks (${cols}) VALUES (${vals})`));

  assert.equal(
    await insert('title, mood, r2_key, file_bytes, is_published', `'No mood', NULL, 'hub-music/e.m4a', 10, TRUE`),
    '23514',
    'published with no mood',
  );
  assert.equal(
    await outcome(() => db.query(`UPDATE public.hub_music_tracks SET is_published = TRUE WHERE track_id = $1`, [DRAFT])),
    '23514',
    'publishing a track that has no mood yet',
  );
  assert.equal(
    await insert('title, mood, r2_key, file_bytes', `'Odd', 'velvet_court', 'hub-music/f.m4a', 10`),
    '23514',
    'a mood that is not one of the nine',
  );
  assert.equal(
    await insert('title, mood, r2_key, file_bytes', `'Elsewhere', 'harana', 'events/x/site-music/g.m4a', 10`),
    '23514',
    'a file outside hub-music/',
  );
  assert.equal(
    await insert('title, mood, r2_key, file_bytes', `'Twin', 'harana', 'hub-music/a-classic.m4a', 10`),
    '23505',
    'a file that is already another track',
  );
  assert.equal(await insert('title, mood, r2_key, file_bytes', `'  ', 'harana', 'hub-music/h.m4a', 10`), '23514', 'a blank title');
  assert.equal(await insert('title, mood, r2_key, file_bytes', `'Empty', 'harana', 'hub-music/i.m4a', 0`), '23514', 'an empty file');
});

test('7 · the admin who added a track can be deleted, and the track stays', async () => {
  await db.query(`DELETE FROM auth.users WHERE id = $1`, [UPLOADER]);
  const r = await db.query<{ track_id: string; created_by: string | null; public_id: string }>(
    `SELECT track_id, created_by, public_id FROM public.hub_music_tracks ORDER BY title`,
  );
  assert.deepEqual(r.rows.map((x) => x.track_id).sort(), [LIVE, DRAFT].sort());
  assert.ok(r.rows.every((x) => x.created_by === null));
  assert.ok(r.rows.every((x) => /^S89M-[0-9A-HJKMNP-TV-Z]{10}$/.test(x.public_id)), 'each track has a public id');
});

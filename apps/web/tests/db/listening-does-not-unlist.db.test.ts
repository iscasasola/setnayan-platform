/**
 * listening-does-not-unlist.db.test.ts
 *
 * 🚨 THE DEFECT THIS PINS WAS LIVE AND DEGRADING DAILY. Caching a song's
 * 30-second preview — which happens when a couple simply scrolls the list —
 * removed that song from the couple's "most popular wedding songs" browse list.
 * 93 of 391 songs were already gone; the original Top 100 batch was 62%
 * destroyed, most-popular first, because those hydrate first.
 *
 * 🔑 THE SHAPE: a BEFORE trigger sees `NEW` carrying the EXISTING value for
 * every column the UPDATE did not name, so an unconditional
 * `NEW.is_curated_pick := FALSE` rewrote a field the statement never mentioned.
 * A guard meant to refuse a PROMOTION was silently performing a DEMOTION on
 * every unrelated write.
 *
 * ⛔ NOT A ROLE CHECK, and the test proves the fix without one. The function is
 * SECURITY DEFINER, so `current_user` inside it is the OWNER — the repo's usual
 * `current_user NOT IN ('authenticated','anon')` idiom is true for everybody
 * here and would disable the guard outright. And `auth.role()` is NULL in prod
 * but 'anon' in this replay, so a role-based fix could not be honestly tested.
 * The guard instead pins both fields to OLD on UPDATE — role-independent, so
 * this test means the same thing here as in production.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb } from './replay-migrations';

let db: Awaited<ReturnType<typeof createReplayedDb>>['db'];

before(async () => {
  ({ db } = await createReplayedDb());
});
after(async () => {
  await db?.close();
});

/** A seeded, curated song, written past the guard exactly as the seed does. */
async function seedCuratedSong(title: string): Promise<number> {
  await db.query(`ALTER TABLE public.songs DISABLE TRIGGER songs_nonadmin_guard_trg`);
  const { rows } = await db.query<{ song_id: number }>(
    `INSERT INTO public.songs (title, artist, source, is_curated_pick)
     VALUES ($1, 'Test Artist', 'seed', TRUE)
     RETURNING song_id`,
    [title],
  );
  await db.query(`ALTER TABLE public.songs ENABLE TRIGGER songs_nonadmin_guard_trg`);
  return rows[0]!.song_id;
}

test('caching a preview does not remove the song from the curated list', async () => {
  const id = await seedCuratedSong('Ikaw');

  // Exactly what lib/songs.ts cacheSongItunes writes: three media columns and
  // nothing else. It never names is_curated_pick or source.
  await db.query(
    `UPDATE public.songs
        SET apple_track_id = 111, preview_url = 'https://x/p.m4a', artwork_url = 'https://x/a.jpg'
      WHERE song_id = $1`,
    [id],
  );

  const { rows } = await db.query<{ is_curated_pick: boolean; source: string }>(
    `SELECT is_curated_pick, source FROM public.songs WHERE song_id = $1`,
    [id],
  );
  assert.equal(
    rows[0]!.is_curated_pick,
    true,
    'Caching the preview un-curated the song. This is the live defect: a couple ' +
      'scrolling the list is what deleted songs from it, top-first.',
  );
  assert.equal(
    rows[0]!.source,
    'seed',
    'Caching the preview rewrote the song’s origin from "seed" to "vendor". ' +
      'That is what disarmed the existing repair query, which keys on source.',
  );
});

test('a non-admin still cannot promote a song into the curated list', async () => {
  // The guard's real job, unchanged. Insert as a non-admin…
  const { rows: ins } = await db.query<{ song_id: number; is_curated_pick: boolean; source: string }>(
    `INSERT INTO public.songs (title, artist, source, is_curated_pick)
     VALUES ('Self Promoted', 'Nobody', 'seed', TRUE)
     RETURNING song_id, is_curated_pick, source`,
  );
  assert.equal(ins[0]!.is_curated_pick, false, 'a non-admin promoted their own song on insert');
  assert.equal(ins[0]!.source, 'vendor', 'a non-admin claimed the song was part of our seed list');

  // …and on update.
  await db.query(`UPDATE public.songs SET is_curated_pick = TRUE WHERE song_id = $1`, [
    ins[0]!.song_id,
  ]);
  const { rows } = await db.query<{ is_curated_pick: boolean }>(
    `SELECT is_curated_pick FROM public.songs WHERE song_id = $1`,
    [ins[0]!.song_id],
  );
  assert.equal(
    rows[0]!.is_curated_pick,
    false,
    'a non-admin promoted their own song by updating it — the guard’s actual job',
  );
});

test('a non-admin cannot demote somebody else’s curated song either', async () => {
  /*
    Strictly stronger than the old guard, and worth pinning: the previous body
    forced is_curated_pick to FALSE, so a non-admin write was a DEMOTION tool.
    Pinning to OLD closes both directions at once.
  */
  const id = await seedCuratedSong('Perfect');
  await db.query(`UPDATE public.songs SET is_curated_pick = FALSE WHERE song_id = $1`, [id]);
  const { rows } = await db.query<{ is_curated_pick: boolean }>(
    `SELECT is_curated_pick FROM public.songs WHERE song_id = $1`,
    [id],
  );
  assert.equal(rows[0]!.is_curated_pick, true, 'a non-admin demoted a curated song');
});

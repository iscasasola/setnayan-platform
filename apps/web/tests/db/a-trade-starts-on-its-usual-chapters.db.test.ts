/**
 * 📖 A TRADE STARTS ON ITS USUAL CHAPTERS — the database half (migration 20271307273159; owner 2026-11-04).
 *
 *   1 · `service_categories.default_chapters` exists, and the backfill gives catering Cocktail + Reception (the owner's
 *       own example) and a photographer every default chapter;
 *   2 · only the four default chapter keys may be stored;
 *   3 · the app's reader groups it by the coarse category a booking is stored under (the one-per-event join).
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { tradeChaptersFrom, type TradeChaptersRow } from '../../lib/trade-chapters';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await replay?.db.close();
});

async function chaptersOf(id: string): Promise<string[] | null> {
  const r = await db.query<{ d: string[] }>(`SELECT default_chapters AS d FROM public.service_categories WHERE id = $1`, [id]);
  return r.rows[0]?.d ?? null;
}

test('1 · the backfill: catering = Cocktail + Reception; a photographer is on every default chapter', async () => {
  assert.deepEqual(await chaptersOf('catering'), ['cocktail_reception']);
  assert.deepEqual(await chaptersOf('photo_video'), ['prep', 'ceremony', 'cocktail_reception', 'after_party']);
  assert.deepEqual(await chaptersOf('hmua'), ['prep']);
});

test('2 · only the four default chapter keys may be stored', async () => {
  await assert.rejects(
    db.query(`UPDATE public.service_categories SET default_chapters = ARRAY['dinner'] WHERE id = 'catering'`),
    /service_categories_default_chapters_check/,
  );
  await db.query(`UPDATE public.service_categories SET default_chapters = '{}' WHERE id = 'dj'`);
  assert.deepEqual(await chaptersOf('dj'), []);
});

test('3 · the reader groups it by the coarse category a booking is stored under', async () => {
  const r = await db.query<TradeChaptersRow>(
    `SELECT coarse_category::text AS coarse_category, default_chapters FROM public.service_categories WHERE tier = 2 AND status = 'active'`,
  );
  const byCat = tradeChaptersFrom(r.rows);
  assert.deepEqual(byCat.get('catering'), ['cocktail_reception'], 'catering (and its stations, food trucks…) lost its usual chapter');
  assert.deepEqual(byCat.get('makeup_artist'), ['prep']);
});

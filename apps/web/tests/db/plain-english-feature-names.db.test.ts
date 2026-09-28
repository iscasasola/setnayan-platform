/**
 * THE DATABASE'S DISPLAY COPY SAYS THE PLAIN-ENGLISH NAMES — AND ONLY THE COPY
 * CHANGED.
 *
 * Owner, 2026-09-29: Pakanta → "Music Maker" · Samahan → "Group" · Alaala →
 * "Memories" · Alaga → "Loved ones". Papic and Patiktok keep their names.
 * Migration `20271251630856_plain_english_feature_names.sql` rewrites the
 * catalogue/taxonomy/nav labels a person reads; this proves three things about
 * it against the real replayed schema:
 *
 *  1. the rows a customer is charged under and browses by now read the new name;
 *  2. NO identifier moved — the SKU code and the taxonomy key are untouched, and
 *     a glued spelling (`/pakanta`, `pakanta_song_r2_key`) inside copy survives;
 *  3. re-running it is a no-op.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

const MIGRATIONS = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'supabase', 'migrations');
const FILE = readdirSync(MIGRATIONS).find((f) => f.endsWith('_plain_english_feature_names.sql'));

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

test('the migration exists (anchor — a missing file would make every check vacuous)', () => {
  assert.ok(FILE, 'plain_english_feature_names migration not found');
});

test('the Pakanta SKU keeps its code and is titled "Music Maker"', async () => {
  const r = await db.query<{ service_code: string; title: string }>(
    `SELECT service_code, title FROM public.platform_retail_catalog_v2 WHERE service_code = 'PAKANTA'`,
  );
  assert.equal(r.rows.length, 1, 'the PAKANTA SKU row must still exist under its code');
  assert.equal(r.rows[0]!.title, 'Music Maker');
});

test('the taxonomy leaf keeps its key and reads "Music Maker"', async () => {
  const r = await db.query<{ display_name_en: string }>(
    `SELECT display_name_en FROM public.canonical_service_schemas WHERE canonical_service = 'setnayan_pakanta'`,
  );
  assert.equal(r.rows.length, 1, 'setnayan_pakanta must still exist under its key');
  assert.match(r.rows[0]!.display_name_en, /Music Maker/);
  assert.doesNotMatch(r.rows[0]!.display_name_en, /Pakanta/);
});

test('no catalogue display column says a retired name', async () => {
  const cols: Array<[string, string]> = [
    ['platform_retail_catalog_v2', 'title'],
    ['platform_retail_catalog_v2', 'description'],
    ['platform_package_catalog', 'title'],
    ['platform_package_catalog', 'description'],
    ['service_catalog', 'display_name'],
    ['service_catalog', 'description'],
    ['vendor_billing_catalog', 'title'],
    ['vendor_billing_catalog', 'description'],
    ['canonical_service_schemas', 'display_name_en'],
    ['homepage_background_videos', 'label'],
  ];
  for (const [t, c] of cols) {
    const r = await db.query<{ v: string }>(
      `SELECT ${c} AS v FROM public.${t} WHERE ${c} ~ '(^|[^A-Za-z0-9_/.-])(Pakanta|Samahan|Alaala|Ala[- ][Aa]la|Alaga)([^A-Za-z0-9_/-]|$)'`,
    );
    assert.deepEqual(r.rows.map((x) => x.v), [], `${t}.${c} still shows a retired name`);
  }
});

test('glued identifiers inside copy survive, and a re-run is a no-op', async () => {
  const sql = readFileSync(resolve(MIGRATIONS, FILE!), 'utf8');
  const glued = 'See /pakanta and pakanta_song_r2_key; the Pakanta song.';
  await db.query(
    `UPDATE public.platform_retail_catalog_v2 SET description = $1 WHERE service_code = 'PAKANTA'`,
    [glued],
  );
  await db.exec(sql);
  const d = await db.query<{ description: string }>(
    `SELECT description FROM public.platform_retail_catalog_v2 WHERE service_code = 'PAKANTA'`,
  );
  assert.equal(
    d.rows[0]!.description,
    'See /pakanta and pakanta_song_r2_key; the Music Maker song.',
    'only the free-standing word may change — a route or column name inside copy must survive',
  );
  const before2 = await db.query(`SELECT service_code, title, description FROM public.platform_retail_catalog_v2 ORDER BY service_code`);
  await db.exec(sql);
  const after2 = await db.query(`SELECT service_code, title, description FROM public.platform_retail_catalog_v2 ORDER BY service_code`);
  assert.deepEqual(after2.rows, before2.rows, 're-running the migration must change nothing');
});

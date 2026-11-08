/**
 * A screen name minted from the fallbacks is re-minted once the real city and services arrive — executed on the
 * full replayed schema (migration 20271319689851_screen_name_remints_from_real_data.sql).
 *
 * The owner's own new shop, live 2026-11-07: /v/rondomusical read "Philippines Wedding Vendor #14" (logo tile "PW")
 * for a Quezon City music shop. /open-shop inserts `vendor_profiles` with only its user_id and writes the city and
 * services in a second statement, so the AFTER INSERT generator took both fallbacks and its persistence rule kept
 * them forever. And with services ['band_dj', 'band_live_music'] the label read services[1] only — a coarse key with
 * no label — so even the real data would have read "Wedding Vendor".
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb } from './replay-migrations';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = join(
  HERE,
  '..', '..', '..', '..',
  'supabase/migrations/20271319689851_screen_name_remints_from_real_data.sql',
);

let db: PGlite;
let bandLabel: string;
let floralsLabel: string;

type Name = {
  screen_name: string | null;
  screen_name_taxonomy: string | null;
  screen_name_id: number | null;
  screen_name_slug: string | null;
};

let n = 0;
async function newUser(): Promise<string> {
  n += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`remint-${n}@screen.test`],
  );
  return u.rows[0]!.id;
}

/** /open-shop's own shape: the row is born with nothing but its owner. */
async function openShopEmpty(): Promise<string> {
  const uid = await newUser();
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id) VALUES ($1) RETURNING vendor_profile_id`,
    [uid],
  );
  return v.rows[0]!.vendor_profile_id;
}

/** …then the wizard's second statement writes the basics. */
async function writeBasics(id: string, city: string | null, services: string[]) {
  await db.query(
    `UPDATE public.vendor_profiles
        SET business_name = 'Rondo Test', location_city = $2, services = $3::text[]
      WHERE vendor_profile_id = $1`,
    [id, city, services],
  );
}

async function nameOf(id: string): Promise<Name> {
  const r = await db.query<Name>(
    `SELECT screen_name, screen_name_taxonomy, screen_name_id, screen_name_slug
       FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [id],
  );
  return r.rows[0]!;
}

async function duplicateSlugGroups(): Promise<number> {
  const r = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM (
       SELECT lower(screen_name_slug) FROM public.vendor_profiles
        WHERE screen_name_slug IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1) d`,
  );
  return r.rows[0]!.n;
}

/** The migration's own repair block, run as written (not a copy of it). */
function repairBlock(): string {
  const sql = readFileSync(MIGRATION, 'utf8');
  const blocks = sql.match(/DO \$\$[\s\S]*?END\$\$;/g) ?? [];
  const repair = blocks.find((b) => b.includes('remint_fallback_screen_name(v_id)'));
  assert.ok(repair, 'the migration carries its repair block');
  return repair;
}

before(async () => {
  const replay = await createReplayedDb();
  db = replay.db;
  assert.equal(replay.applied, replay.total, 'every migration replayed');
  const labels = await db.query<{ canonical_service: string; display_name_en: string }>(
    `SELECT canonical_service, display_name_en FROM public.canonical_service_schemas
      WHERE canonical_service IN ('band_live_music', 'florals', 'band_dj', 'florist')`,
  );
  const byKey = new Map(labels.rows.map((r) => [r.canonical_service, r.display_name_en]));
  // Preconditions — the shape of the owner's shop: a coarse key with no label leads, its leaf has one.
  assert.equal(byKey.has('band_dj'), false, 'band_dj (coarse) has no label — the services[1] half of the bug');
  assert.equal(byKey.has('florist'), false, 'florist (coarse) has no label');
  bandLabel = byKey.get('band_live_music')!;
  floralsLabel = byKey.get('florals')!;
  assert.ok(bandLabel, 'band_live_music has a label');
  assert.ok(floralsLabel, 'florals has a label');
});

after(async () => {
  await db?.close();
});

test('the owner\'s shop: opened empty, then given Quezon City + a music service → named from those', async () => {
  const id = await openShopEmpty();
  const born = await nameOf(id);
  assert.match(born.screen_name ?? '', /^Philippines Wedding Vendor #\d+$/, 'born on both fallbacks (the bug\'s precondition)');

  await writeBasics(id, 'Quezon City', ['band_dj', 'band_live_music']);
  const now = await nameOf(id);
  assert.equal(now.screen_name_taxonomy, `Quezon City ${bandLabel}`);
  assert.match(now.screen_name ?? '', new RegExp(`^Quezon City ${bandLabel.replace(/[/]/g, '\\/')} #\\d+$`));
  assert.doesNotMatch(now.screen_name ?? '', /Philippines|Wedding Vendor/);
  assert.match(now.screen_name_slug ?? '', /^quezon-city-band-live-music-\d+$/);
});

test('a city with no labelled service yet fills the city; the labelled service, arriving later, fills the label', async () => {
  const id = await openShopEmpty();
  await writeBasics(id, 'Pasig', ['band_dj']);
  assert.equal((await nameOf(id)).screen_name_taxonomy, 'Pasig Wedding Vendor');
  await db.query(
    `UPDATE public.vendor_profiles SET services = ARRAY['band_dj','band_live_music'] WHERE vendor_profile_id = $1`,
    [id],
  );
  assert.equal((await nameOf(id)).screen_name_taxonomy, `Pasig ${bandLabel}`);
});

test('a fresh shop with city + services at insert takes the FIRST TICKED service that has a label', async () => {
  const uid = await newUser();
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services)
     VALUES ($1, 'Bloom Test', 'Makati', ARRAY['florist','florals']) RETURNING vendor_profile_id`,
    [uid],
  );
  assert.equal((await nameOf(v.rows[0]!.vendor_profile_id)).screen_name_taxonomy, `Makati ${floralsLabel}`);
});

test('a REVEALED shop is untouched — its name is its public face already', async () => {
  const id = await openShopEmpty();
  await db.query(`UPDATE public.vendor_profiles SET name_revealed_at = now() WHERE vendor_profile_id = $1`, [id]);
  const before = await nameOf(id);
  await writeBasics(id, 'Quezon City', ['band_dj', 'band_live_music']);
  assert.deepEqual(await nameOf(id), before, 'revealed → never renumbered');
  // …and the repair door says no too.
  const r = await db.query<{ ok: boolean }>(`SELECT public.remint_fallback_screen_name($1) AS ok`, [id]);
  assert.equal(r.rows[0]!.ok, false);
  assert.deepEqual(await nameOf(id), before);
});

test('a name built from REAL data is untouched when the city or services change (the persistence rule)', async () => {
  const uid = await newUser();
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services)
     VALUES ($1, 'Real Test', 'Taguig', ARRAY['band_live_music']) RETURNING vendor_profile_id`,
    [uid],
  );
  const id = v.rows[0]!.vendor_profile_id;
  const before = await nameOf(id);
  assert.equal(before.screen_name_taxonomy, `Taguig ${bandLabel}`);
  await writeBasics(id, 'Cebu City', ['florals', 'band_live_music']);
  assert.deepEqual(await nameOf(id), before, 'real-data name kept');
});

test('the repair re-mints a row already stuck on the fallback, and a second run touches nothing', async () => {
  // Reproduce prod's stuck state: the basics written while the re-mint trigger did not exist.
  const stuck = await openShopEmpty();
  const realAlready = await openShopEmpty();
  await db.query(`ALTER TABLE public.vendor_profiles DISABLE TRIGGER vendor_profiles_remint_fallback_screen_name`);
  await writeBasics(stuck, 'Quezon City', ['band_dj', 'band_live_music']);
  // A fallback name with nothing to fill it from — the repair must leave it.
  await writeBasics(realAlready, null, ['band_dj']);
  await db.query(`ALTER TABLE public.vendor_profiles ENABLE TRIGGER vendor_profiles_remint_fallback_screen_name`);
  assert.match((await nameOf(stuck)).screen_name ?? '', /^Philippines Wedding Vendor #/, 'stuck, as in prod');
  const noData = await nameOf(realAlready);

  await db.exec(repairBlock());
  const fixed = await nameOf(stuck);
  assert.equal(fixed.screen_name_taxonomy, `Quezon City ${bandLabel}`, 'the repair re-minted it from its real data');
  assert.deepEqual(await nameOf(realAlready), noData, 'no real data yet → left on the fallback');

  const before = await db.query(`SELECT vendor_profile_id, screen_name_slug FROM public.vendor_profiles ORDER BY 1`);
  await db.exec(repairBlock());
  const after2 = await db.query(`SELECT vendor_profile_id, screen_name_slug FROM public.vendor_profiles ORDER BY 1`);
  assert.deepEqual(after2.rows, before.rows, 're-runnable: the second run changes nothing');
});

test('slugs stay unique when several shops re-mint into the same (city, label) namespace', async () => {
  const ids = [await openShopEmpty(), await openShopEmpty(), await openShopEmpty()];
  for (const id of ids) await writeBasics(id, 'Quezon City', ['band_dj', 'band_live_music']);
  const slugs = await Promise.all(ids.map(async (id) => (await nameOf(id)).screen_name_slug));
  assert.equal(new Set(slugs).size, slugs.length, `distinct: ${slugs.join(' · ')}`);
  assert.equal(await duplicateSlugGroups(), 0, 'no duplicate LOWER(screen_name_slug) anywhere');
});

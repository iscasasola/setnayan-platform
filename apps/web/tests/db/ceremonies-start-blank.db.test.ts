/**
 * Owner ruling 16 Nov 2026 (16) — CEREMONIES START BLANK (`{}`), matching nobody until the supplier picks (walk W1-B8).
 * Migration 20271350210033. Sabotage: drop the SET DEFAULT, or the backfill → red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

const here = dirname(fileURLToPath(import.meta.url));
const FILE = '20271350210033_ceremonies_start_blank_until_the_supplier_picks.sql';
const SQL = readFileSync(join(here, '..', '..', '..', '..', 'supabase', 'migrations', FILE), 'utf8');

let replay: ReplayResult;
let db: PGlite;

async function shop(slug: string, ceremonies?: string[]): Promise<string> {
  const u = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
      [`${slug}@example.test`],
    )
  ).rows[0]!.id;
  const cols = ceremonies ? ', compatible_ceremony_types' : '';
  const vals = ceremonies ? ', $4::text[]' : '';
  const params: unknown[] = [u, slug, 'Manila', ...(ceremonies ? [ceremonies] : [])];
  return (
    await db.query<{ v: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name, business_slug, location_city${cols})
       VALUES ($1, $2, $2, $3${vals}) RETURNING vendor_profile_id AS v`,
      params,
    )
  ).rows[0]!.v;
}
const ceremoniesOf = async (vp: string) =>
  (await db.query<{ c: string[] | null }>(`SELECT compatible_ceremony_types AS c FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [vp])).rows[0]!.c;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

test('a new shop is born with NO ceremony ticked — the empty array, never Catholic · Civil · Christian', async () => {
  const vp = await shop('blank-at-birth');
  assert.deepEqual(await ceremoniesOf(vp), []);
});

test('the empty array matches NO ceremony filter (Find reads `is.null OR @> {X}`)', async () => {
  const vp = await shop('matches-nobody');
  const hit = await db.query(
    `SELECT 1 FROM public.vendor_profiles WHERE vendor_profile_id = $1
        AND (compatible_ceremony_types IS NULL OR compatible_ceremony_types @> ARRAY['catholic']::text[])`,
    [vp],
  );
  assert.equal(hit.rows.length, 0, 'a shop that picked nothing is shown for a Catholic wedding');
});

test('the backfill: the exact old seed goes blank; a real pick and the legacy NULL are untouched; a re-run moves nothing', async () => {
  const seeded = await shop('old-seed', ['catholic', 'civil', 'christian']);
  const picked = await shop('picked-inc', ['inc', 'catholic']);
  const open = await shop('legacy-open');
  await db.query(`UPDATE public.vendor_profiles SET compatible_ceremony_types = NULL WHERE vendor_profile_id = $1`, [open]);
  await db.exec(SQL);
  assert.deepEqual(await ceremoniesOf(seeded), []);
  assert.deepEqual(await ceremoniesOf(picked), ['inc', 'catholic']);
  assert.equal(await ceremoniesOf(open), null);
  await db.exec(SQL);
  assert.deepEqual(await ceremoniesOf(picked), ['inc', 'catholic'], 'the second run changed a real pick');
});

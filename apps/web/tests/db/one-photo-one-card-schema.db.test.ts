/**
 * ONE PHOTO, ONE SERVICE CARD — the schema half, against a replayed schema (…_service_card_checks_v2.sql +
 * …_notification_type_photo_report_resolved.sql).
 *
 * ⚖ Owner 2026-10-26 (DECISION_LOG "CARD CHECKS — NO PRICE BAND; ONE PHOTO, ONE SERVICE CARD"): *"once a photo is
 * used. it technically cannot be used on another service card."* A cover/showcase hash names the card it is on
 * (`vendor_image_hashes.vendor_service_id`, nullable, SET NULL so a deleted card frees its photos); a showcase
 * photo can be hashed; "It's mine — report it" is a note on the repost-watch row.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
const VP = '33333333-3333-4333-8333-333333333333';
const VP2 = '44444444-4444-4444-8444-444444444444';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  for (const [id, name] of [[VP, 'Tita Nena Catering'], [VP2, 'Mesa Luna Catering']]) {
    await db.query(`INSERT INTO public.vendor_profiles (vendor_profile_id, business_name) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, name]);
  }
});
after(async () => {
  await db?.close();
});

async function card(): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, is_active) VALUES ($1, 'catering', false) RETURNING vendor_service_id AS id`,
    [VP],
  );
  return r.rows[0]!.id;
}

test('a cover and a showcase hash can name their card; a portfolio hash names none', async () => {
  const c = await card();
  await db.query(
    `INSERT INTO public.vendor_image_hashes (vendor_profile_id, surface, r2_ref, phash, is_demo, vendor_service_id)
     VALUES ($1, 'service_primary', 'r2://media/x/cover.webp', '1', false, $2),
            ($1, 'service_showcase', 'r2://media/x/show-1.webp', '2', false, $2),
            ($1, 'portfolio', 'r2://media/x/port-1.webp', '3', false, NULL)`,
    [VP, c],
  );
  const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.vendor_image_hashes WHERE vendor_service_id = $1`, [c]);
  assert.equal(r.rows[0]!.n, 2);
});

test('deleting the card frees its photos (SET NULL), it never deletes the hash', async () => {
  const c = await card();
  await db.query(
    `INSERT INTO public.vendor_image_hashes (vendor_profile_id, surface, r2_ref, phash, is_demo, vendor_service_id)
     VALUES ($1, 'service_primary', 'r2://media/x/cover-del.webp', '4', false, $2)`,
    [VP, c],
  );
  await db.query(`DELETE FROM public.vendor_services WHERE vendor_service_id = $1`, [c]);
  const r = await db.query<{ s: string | null }>(`SELECT vendor_service_id AS s FROM public.vendor_image_hashes WHERE r2_ref = 'r2://media/x/cover-del.webp'`);
  assert.equal(r.rows.length, 1, 'the hash went with the card');
  assert.equal(r.rows[0]!.s, null);
});

test('the lookup by card is indexed', async () => {
  const r = await db.query(`SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'vendor_image_hashes_service_idx'`);
  assert.equal(r.rows.length, 1);
});

test('a repost-watch row carries the supplier’s report, at most 200 characters', async () => {
  await db.query(
    `INSERT INTO public.vendor_image_flags (flagged_vendor_id, flagged_r2_ref, flagged_surface, source_vendor_id, source_r2_ref, source_surface, hamming_distance, supplier_reported_at, supplier_report_note)
     VALUES ($1, 'r2://media/x/new.webp', 'service_showcase', $2, 'r2://media/y/old.webp', 'service_primary', 3, NOW(), 'says it''s theirs')`,
    [VP, VP2],
  );
  let err: string | null = null;
  try {
    await db.query(
      `UPDATE public.vendor_image_flags SET supplier_report_note = repeat('x', 201) WHERE flagged_r2_ref = 'r2://media/x/new.webp'`,
    );
  } catch (e) {
    err = (e as Error).message;
  }
  assert.match(err ?? '', /supplier_report_note_check/);
});

test('no price anything: the tolerance column the first cut added does not exist', async () => {
  const r = await db.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'platform_settings' AND column_name = 'card_price_band_tolerance'`);
  assert.equal(r.rows.length, 0);
});

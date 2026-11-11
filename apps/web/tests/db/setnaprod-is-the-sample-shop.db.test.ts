/**
 * SETNAPROD IS FILLED AS THE PUBLIC SAMPLE SHOP — and nothing else is touched.
 * Migration 20271336670427_setnaprod_sample_shop (owner 2026-11-10, DECISION_LOG 🏪).
 *
 * The replay has already applied the migration once, against a database where SetnaProd never existed — so the
 * no-op-on-a-fresh-replay property is proven before any test runs. Each test then seeds rows and re-executes the
 * migration file verbatim.
 *
 *   1. SetnaProd (slug + public id) becomes a demo shop with words, page photos, three LIVE cards (cover, photos,
 *      what's included), inspiration looks and three sample reviews that carry no event and no couple.
 *   2. A second shop — with a draft card and no photos — is untouched, field by field.
 *   3. A re-run changes nothing (same counts, the owner's own later edits kept).
 *   4. A shop with the slug but NOT the public id is never touched (the scope is both, together).
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, MIGRATIONS_DIR, type ReplayResult } from './replay-migrations';

const MIGRATION = readFileSync(path.join(MIGRATIONS_DIR, '20271336670427_setnaprod_sample_shop.sql'), 'utf8');
const CARDS = { booth: 'S89S-59BZ88PX4R', roving: 'S89S-2KHH8T6JT5', bar: 'S89S-HMPNEQ1K3D' } as const;

let replay: ReplayResult;
let db: PGlite;
const F = { owner: '', shop: '', otherOwner: '', otherShop: '', otherCard: '' };

let seq = 0;
async function newUser(): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`setnaprod-${++seq}-${Date.now()}@test.local`],
  );
  return u.rows[0]!.id;
}

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM (${sql}) x`, params);
  return r.rows[0]!.n;
}

async function draftCard(shop: string, publicId: string | null, category: string, price: number): Promise<string> {
  const r = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, title, starting_price_php, is_active${publicId ? ', public_id' : ''})
     VALUES ($1, $2, $3, $4, false${publicId ? ', $5' : ''}) RETURNING vendor_service_id`,
    publicId ? [shop, category, `${category} card`, price, publicId] : [shop, category, `${category} card`, price],
  );
  return r.rows[0]!.vendor_service_id;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  F.owner = await newUser();
  F.otherOwner = await newUser();

  F.shop = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name, business_slug, public_id)
       VALUES ($1, 'SetnaProd', 'setnaprod', 'S89B-RJ7TT7BWWQ') RETURNING vendor_profile_id`,
      [F.owner],
    )
  ).rows[0]!.vendor_profile_id;
  await draftCard(F.shop, CARDS.booth, 'photo_booth', 14999);
  await draftCard(F.shop, CARDS.roving, 'photoman', 9999);
  await draftCard(F.shop, CARDS.bar, 'mobile_bar', 110000);

  F.otherShop = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Someone Else Booths')
       RETURNING vendor_profile_id`,
      [F.otherOwner],
    )
  ).rows[0]!.vendor_profile_id;
  F.otherCard = await draftCard(F.otherShop, null, 'photo_booth', 12000);
});

after(async () => {
  await db?.close();
});

async function otherShopSnapshot() {
  const p = await db.query(
    `SELECT is_demo, tagline, microsite_about, location_city, portfolio_r2_keys FROM public.vendor_profiles
      WHERE vendor_profile_id = $1`,
    [F.otherShop],
  );
  const c = await db.query(
    `SELECT is_active, primary_photo_r2_key, showcase_photo_r2_keys FROM public.vendor_services WHERE vendor_service_id = $1`,
    [F.otherCard],
  );
  const kids = {
    inclusions: await count(`SELECT 1 FROM public.vendor_service_inclusions WHERE vendor_profile_id = $1`, [F.otherShop]),
    looks: await count(`SELECT 1 FROM public.moodboard_library_assets WHERE vendor_profile_id = $1`, [F.otherShop]),
    reviews: await count(`SELECT 1 FROM public.vendor_reviews WHERE vendor_profile_id = $1`, [F.otherShop]),
  };
  return JSON.stringify({ p: p.rows, c: c.rows, kids });
}

test('SetnaProd becomes the sample shop: demo, words, photos, live cards, looks, sample reviews', async () => {
  const otherBefore = await otherShopSnapshot();
  await db.exec(MIGRATION);

  const shop = (
    await db.query<{ is_demo: boolean; tagline: string; microsite_about: string; portfolio_r2_keys: string[] }>(
      `SELECT is_demo, tagline, microsite_about, portfolio_r2_keys FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
      [F.shop],
    )
  ).rows[0]!;
  assert.equal(shop.is_demo, true, 'the sample is marked with the ONE existing flag');
  assert.match(shop.tagline, /sample shop/);
  assert.match(shop.microsite_about, /cannot be booked/);
  assert.equal(shop.portfolio_r2_keys.length, 8);
  for (const k of shop.portfolio_r2_keys) assert.match(k, /^\/onboarding\/refinements\/[a-z_]+\/[a-z0-9_-]+\.webp$/, k);

  const cards = (
    await db.query<{ public_id: string; is_active: boolean; primary_photo_r2_key: string; showcase_photo_r2_keys: string[]; n: number }>(
      `SELECT s.public_id, s.is_active, s.primary_photo_r2_key, s.showcase_photo_r2_keys,
              (SELECT count(*)::int FROM public.vendor_service_inclusions i WHERE i.vendor_service_id = s.vendor_service_id) AS n
         FROM public.vendor_services s WHERE s.vendor_profile_id = $1 ORDER BY s.public_id`,
      [F.shop],
    )
  ).rows;
  assert.equal(cards.length, 3);
  for (const c of cards) {
    assert.equal(c.is_active, true, `${c.public_id} goes live`);
    assert.match(c.primary_photo_r2_key, /^\/onboarding\/refinements\//);
    assert.ok(c.showcase_photo_r2_keys.length >= 3 && c.showcase_photo_r2_keys.length <= 5);
    assert.equal(c.n, 4, `${c.public_id} lists what is included`);
  }

  const looks = await count(
    `SELECT 1 FROM public.moodboard_library_assets
      WHERE vendor_profile_id = $1 AND asset_type = 'supplier_gallery' AND approved_at IS NOT NULL AND rights_warranted_at IS NOT NULL`,
    [F.shop],
  );
  assert.ok(looks >= 1, 'at least one inspiration look (only for parts that exist in the replay)');

  const reviews = (
    await db.query<{ event_id: string | null; couple_user_id: string | null; booked_through_setnayan: boolean; service_id: string | null }>(
      `SELECT event_id, couple_user_id, booked_through_setnayan, service_id FROM public.vendor_reviews WHERE vendor_profile_id = $1`,
      [F.shop],
    )
  ).rows;
  assert.equal(reviews.length, 3);
  for (const r of reviews) {
    assert.equal(r.event_id, null, 'a sample review names no event');
    assert.equal(r.couple_user_id, null, 'a sample review names no couple');
    assert.equal(r.booked_through_setnayan, false, 'never a receipt-backed (trusted) review');
    assert.ok(r.service_id, 'each sample review is for one of the cards');
  }

  assert.equal(await otherShopSnapshot(), otherBefore, 'the other shop is untouched, field by field');
});

test('a re-run changes nothing — and keeps what the owner edited since', async () => {
  await db.query(`UPDATE public.vendor_profiles SET tagline = 'Owner wrote this' WHERE vendor_profile_id = $1`, [F.shop]);
  const before = {
    inc: await count(`SELECT 1 FROM public.vendor_service_inclusions WHERE vendor_profile_id = $1`, [F.shop]),
    looks: await count(`SELECT 1 FROM public.moodboard_library_assets WHERE vendor_profile_id = $1`, [F.shop]),
    reviews: await count(`SELECT 1 FROM public.vendor_reviews WHERE vendor_profile_id = $1`, [F.shop]),
  };
  await db.exec(MIGRATION);
  const after = {
    inc: await count(`SELECT 1 FROM public.vendor_service_inclusions WHERE vendor_profile_id = $1`, [F.shop]),
    looks: await count(`SELECT 1 FROM public.moodboard_library_assets WHERE vendor_profile_id = $1`, [F.shop]),
    reviews: await count(`SELECT 1 FROM public.vendor_reviews WHERE vendor_profile_id = $1`, [F.shop]),
  };
  assert.deepEqual(after, before);
  const t = await db.query<{ tagline: string }>(`SELECT tagline FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [F.shop]);
  assert.equal(t.rows[0]!.tagline, 'Owner wrote this');
});

test('the scope is the slug AND the public id together — a shop with only the slug is never touched', async () => {
  // Move the real one out of the way, then let a different shop hold the slug with another public id.
  const impostorOwner = await newUser();
  await db.exec('SET session_replication_role = replica');
  await db.query(`UPDATE public.vendor_profiles SET business_slug = 'setnaprod-moved' WHERE vendor_profile_id = $1`, [F.shop]);
  const impostor = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name, business_slug) VALUES ($1, 'Not SetnaProd', 'setnaprod')
       RETURNING vendor_profile_id`,
      [impostorOwner],
    )
  ).rows[0]!.vendor_profile_id;
  await db.exec('SET session_replication_role = DEFAULT');

  await db.exec(MIGRATION);
  const r = await db.query<{ is_demo: boolean; tagline: string | null }>(
    `SELECT is_demo, tagline FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [impostor],
  );
  assert.equal(r.rows[0]!.is_demo, false);
  assert.equal(r.rows[0]!.tagline, null);
  assert.equal(await count(`SELECT 1 FROM public.vendor_reviews WHERE vendor_profile_id = $1`, [impostor]), 0);
});

/**
 * 🧩 A PHOTO NAMES A PART — proven against Postgres (PLAN `admin_inspiration_groups_2026-10-25` step ②, guard 3;
 * owner-approved 2026-10-26).
 *
 * Migration `…_inspiration_parts_are_the_photo_keys.sql` drops the board's 29-literal CHECK for an FK into
 * `inspiration_parts(slot_key)`, and moves the supplier gallery's slot IN-list into the trigger
 * `moodboard_library_assets_subtype_is_a_part` (the column is polymorphic, so an FK cannot hold it). The four
 * properties that change hands, each with a real row:
 *
 *   1. an unknown key is refused on BOTH photo tables, as the CHECK refused it;
 *   2. a part an admin adds is accepted on both AT ONCE — no migration, no CHECK widen (the point of the step);
 *   3. the other library types keep their own vocabulary (`figure_attire` 'bride_royal' is not a part, and is fine);
 *   4. a part holding a board photo cannot be deleted — by the FK now, on top of step ①'s trigger.
 *
 * (The seed == consts, tier-2 homes and delete-with-photo halves of guard 3 are step ①'s
 * `inspiration-parts-seed-equals-the-consts.db.test.ts`.)
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

let seq = 0;
const uniq = () => `photo-part-${(seq += 1)}`;

async function refused(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  assert.fail('the database accepted a row it must refuse');
}

async function newCouple(): Promise<{ userId: string; eventId: string }> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@example.test`],
  );
  const userId = u.rows[0]!.id;
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1,'celebration') RETURNING event_id`,
    [uniq()],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [eventId, userId]);
  return { userId, eventId };
}

async function newShop(): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
    [`${uniq()}@shop.test`],
  );
  const userId = u.rows[0]!.id;
  const existing = await db.query<{ vendor_profile_id: string }>(`SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`, [userId]);
  if (existing.rows[0]) return existing.rows[0].vendor_profile_id;
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1,'Arko Florals') RETURNING vendor_profile_id`,
    [userId],
  );
  return v.rows[0]!.vendor_profile_id;
}

function boardPhoto(eventId: string, userId: string, slot: string) {
  return db.query(
    `INSERT INTO public.event_inspiration_assets
       (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url,
        sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
     VALUES ($1,$2,$3,1,'file_upload','https://cdn/own.webp',
             '#111111','#222222','#333333','#444444','#555555','#666666')`,
    [eventId, userId, slot],
  );
}

function libraryPhoto(type: string, subtype: string, shop: string | null) {
  return db.query(
    `INSERT INTO public.moodboard_library_assets
       (asset_type, asset_subtype, label, storage_path, source,
        vendor_profile_id, approved_at, rights_warranted_at, rights_warranty_version)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), 'v1')`,
    [type, subtype, uniq(), `moodboard-library/${uniq()}.webp`, shop ? 'stylist_upload' : 'internet_placeholder', shop],
  );
}

test('⭐ an unknown key is refused on the couple’s board AND in a supplier’s gallery', async () => {
  const { userId, eventId } = await newCouple();
  const shop = await newShop();
  for (const stranger of ['arch', 'bouquets', 'Venue', '']) {
    assert.match(await refused(() => boardPhoto(eventId, userId, stranger)), /event_inspiration_assets_slot_key_is_a_part/, `the board accepted '${stranger}'`);
    assert.match(await refused(() => libraryPhoto('supplier_gallery', stranger, shop)), /names inspiration part .*which does not exist/, `the gallery accepted '${stranger}'`);
  }
  /* …and an UPDATE cannot walk a gallery row onto a non-part either. */
  await libraryPhoto('supplier_gallery', 'cake', shop);
  assert.match(
    await refused(() => db.query(`UPDATE public.moodboard_library_assets SET asset_subtype = 'cakes' WHERE asset_type = 'supplier_gallery' AND asset_subtype = 'cake'`)),
    /which does not exist/,
  );
});

test('⭐ a part an admin adds takes photos on both tables at once — no migration', async () => {
  const { userId, eventId } = await newCouple();
  const shop = await newShop();
  assert.match(await refused(() => boardPhoto(eventId, userId, 'flower_arch')), /slot_key_is_a_part/, 'the fixture part already exists');
  await db.query(`INSERT INTO public.inspiration_parts (slot_key, label_en, home_category_id, sort_order) VALUES ('flower_arch', 'Flower arch', 'florist', 300)`);
  await boardPhoto(eventId, userId, 'flower_arch');
  await libraryPhoto('supplier_gallery', 'flower_arch', shop);
  const n = await db.query<{ board: number; gallery: number }>(
    `SELECT (SELECT count(*)::int FROM public.event_inspiration_assets WHERE slot_key = 'flower_arch') AS board,
            (SELECT count(*)::int FROM public.moodboard_library_assets WHERE asset_type = 'supplier_gallery' AND asset_subtype = 'flower_arch') AS gallery`,
  );
  assert.deepEqual(n.rows[0], { board: 1, gallery: 1 });
});

test('the other library types keep their own vocabulary — the trigger reads supplier_gallery rows only', async () => {
  await libraryPhoto('figure_attire', 'bride_royal', null);
  await libraryPhoto('venue_scene', 'photo_wall', null);
});

test('⭐ a part holding a board photo cannot be deleted — hiding is the way out', async () => {
  const { userId, eventId } = await newCouple();
  await boardPhoto(eventId, userId, 'groomsmen');
  assert.match(await refused(() => db.query(`DELETE FROM public.inspiration_parts WHERE slot_key = 'groomsmen'`)), /hide it instead|slot_key_is_a_part/);
  /* Step ①'s trigger answers first; with it gone, the FK alone still refuses. */
  await db.exec(`ALTER TABLE public.inspiration_parts DISABLE TRIGGER inspiration_parts_refuse_delete_with_photos`);
  try {
    assert.match(await refused(() => db.query(`DELETE FROM public.inspiration_parts WHERE slot_key = 'groomsmen'`)), /event_inspiration_assets_slot_key_is_a_part/);
  } finally {
    await db.exec(`ALTER TABLE public.inspiration_parts ENABLE TRIGGER inspiration_parts_refuse_delete_with_photos`);
  }
});

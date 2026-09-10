/**
 * THE GALLERY CHAIN KEEPS ITS CREDIT — proven against Postgres, not prose.
 *
 * MB10's promise is that a supplier's photo carries their shop from the library
 * to the couple's board to the vendor list. Three states would break it
 * silently, and all three are refused by the schema rather than by a code path
 * somebody has to remember:
 *
 *   1. a `gallery_pick` board row with NO `library_asset_id` — a credited photo
 *      that lost its credit, which renders as an ordinary uncredited tile with
 *      nothing going wrong anywhere;
 *   2. a `supplier_gallery` asset with no shop, or filed under a slot that does
 *      not exist — uncreditable, or invisible to the picker forever;
 *   3. a `supplier_gallery` asset that becomes PUBLICLY READABLE with no rights
 *      warranty. A public bucket without one is fine right up until it is a
 *      lawsuit, and the CHECK is keyed on `approved_at` — the same predicate
 *      the public-read policy uses — so a draft may exist un-warranted and can
 *      never be published that way.
 *
 * 🔑 DDL THAT PARSES IS NOT DDL THAT BEHAVES. `ugat-schema-claims` already
 * proves these constraints EXIST, which is exactly why it cannot notice one
 * whose predicate lets the bad row through. Every assertion here inserts a real
 * row and reads what Postgres did.
 *
 * ⚠ AND THE CASCADE IS TESTED IN BOTH DIRECTIONS, because it is the half that
 * was got wrong first: SET NULL on `library_asset_id` would turn a pick into a
 * `gallery_pick` with a null id, fail the biconditional, and thereby BLOCK the
 * delete — and since users → vendor_profiles already cascades, block an account
 * deletion too (an RA 10173 erasure hazard). Retiring is the soft path and must
 * leave the tile alone; hard-deleting removes the storage object, so the tile
 * has to go with it.
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
const uniq = () => `mb10-${(seq += 1)}`;

async function newCouple(): Promise<{ userId: string; eventId: string }> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@example.test`],
  );
  const userId = u.rows[0]!.id;
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ($1,'celebration') RETURNING event_id`,
    [uniq()],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1,$2,'couple')`,
    [eventId, userId],
  );
  return { userId, eventId };
}

async function newShop(): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
    [`${uniq()}@shop.test`],
  );
  const userId = u.rows[0]!.id;
  // The vendor signup trigger may already have made the profile.
  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [userId],
  );
  if (existing.rows[0]) {
    await db.query(
      `UPDATE public.vendor_profiles SET business_name = 'Bloom & Vine' WHERE user_id = $1`,
      [userId],
    );
    return existing.rows[0].vendor_profile_id;
  }
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name)
     VALUES ($1,'Bloom & Vine') RETURNING vendor_profile_id`,
    [userId],
  );
  return v.rows[0]!.vendor_profile_id;
}

/** A gallery asset. `approve` publishes it; `warrant` supplies the warranty. */
async function newGalleryAsset(opts: {
  vendorProfileId: string | null;
  slot?: string;
  approve?: boolean;
  warrant?: boolean;
}): Promise<string> {
  const r = await db.query<{ asset_id: string }>(
    `INSERT INTO public.moodboard_library_assets
       (asset_type, asset_subtype, label, storage_path, source,
        vendor_profile_id, approved_at, rights_warranted_at, rights_warranty_version)
     VALUES ('supplier_gallery', $1, $2, $3, 'stylist_upload', $4,
             CASE WHEN $5 THEN NOW() ELSE NULL END,
             CASE WHEN $6 THEN NOW() ELSE NULL END,
             CASE WHEN $6 THEN 'v1' ELSE NULL END)
     RETURNING asset_id`,
    [
      opts.slot ?? 'flowers',
      uniq(),
      `moodboard-library/${uniq()}.webp`,
      opts.vendorProfileId,
      opts.approve ?? true,
      opts.warrant ?? true,
    ],
  );
  return r.rows[0]!.asset_id;
}

async function refused(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  assert.fail('the database accepted a row it must refuse');
}

/* ── 1 · A PICK CANNOT LOSE ITS PROVENANCE ────────────────────────────── */

test('⭐ a gallery_pick with NO library_asset_id is REFUSED', async () => {
  const { userId, eventId } = await newCouple();
  const msg = await refused(() =>
    db.query(
      `INSERT INTO public.event_inspiration_assets
         (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url,
          sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
       VALUES ($1,$2,'flowers',1,'gallery_pick','https://cdn/x.webp',
               '#111111','#222222','#333333','#444444','#555555','#666666')`,
      [eventId, userId],
    ),
  );
  assert.match(msg, /gallery_pick_has_provenance/);
});

test('⭐ and the reverse: a library_asset_id on a row claiming to be an UPLOAD is REFUSED', async () => {
  // The biconditional runs both ways so the mode and the provenance can never
  // disagree — one direction alone would let the pair drift.
  const { userId, eventId } = await newCouple();
  const assetId = await newGalleryAsset({ vendorProfileId: await newShop() });
  const msg = await refused(() =>
    db.query(
      `INSERT INTO public.event_inspiration_assets
         (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url,
          library_asset_id,
          sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
       VALUES ($1,$2,'flowers',1,'file_upload','https://cdn/x.webp',$3,
               '#111111','#222222','#333333','#444444','#555555','#666666')`,
      [eventId, userId, assetId],
    ),
  );
  assert.match(msg, /gallery_pick_has_provenance/);
});

test('a proper pick is ACCEPTED, and the couple’s own upload still is too', async () => {
  const { userId, eventId } = await newCouple();
  const assetId = await newGalleryAsset({ vendorProfileId: await newShop() });
  await db.query(
    `INSERT INTO public.event_inspiration_assets
       (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url,
        library_asset_id,
        sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
     VALUES ($1,$2,'flowers',1,'gallery_pick','https://cdn/x.webp',$3,
             '#111111','#222222','#333333','#444444','#555555','#666666')`,
    [eventId, userId, assetId],
  );
  await db.query(
    `INSERT INTO public.event_inspiration_assets
       (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url,
        sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
     VALUES ($1,$2,'flowers',2,'file_upload','https://cdn/own.webp',
             '#111111','#222222','#333333','#444444','#555555','#666666')`,
    [eventId, userId],
  );
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_inspiration_assets
      WHERE event_id = $1 AND removed_at IS NULL`,
    [eventId],
  );
  assert.equal(r.rows[0]!.n, 2);
});

/* ── 2 · A GALLERY ASSET IS CREDITABLE AND FINDABLE, OR IT DOES NOT EXIST ── */

test('⭐ a supplier_gallery asset with NO shop is REFUSED', async () => {
  const msg = await refused(() => newGalleryAsset({ vendorProfileId: null }));
  assert.match(msg, /supplier_gallery_shape/);
});

test('⭐ a supplier_gallery asset filed under a NON-SLOT is REFUSED', async () => {
  // The failure this prevents is the quiet one: a photo tagged 'bouquets'
  // instead of 'flowers' is invisible to every picker forever, and nothing
  // anywhere goes red.
  const shop = await newShop();
  const msg = await refused(() =>
    newGalleryAsset({ vendorProfileId: shop, slot: 'bouquets' }),
  );
  assert.match(msg, /supplier_gallery_shape/);
});

test('every one of the 18 real inspiration slots is accepted by the gallery CHECK', async () => {
  // The three gates (MOODBOARD_SLOT_KEYS · the board's slot CHECK · this one)
  // must agree. A slot missing from THIS one fails silently: the couple's own
  // upload works and the supplier gallery for that slot is empty forever.
  const shop = await newShop();
  const slots = [
    'venue', 'tunnel', 'stage', 'table', 'ceiling', 'overall',
    'backdrop', 'flowers', 'cocktail', 'reception_venue', 'cake',
    'palette',
    'groom', 'bride', 'principal_sponsor', 'entourage', 'parents', 'guests',
  ];
  for (const slot of slots) {
    await newGalleryAsset({ vendorProfileId: shop, slot });
  }
  const board = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_constraint
      WHERE conname = 'event_inspiration_assets_slot_key_check_v3'`,
  );
  assert.equal(board.rows[0]!.n, 1, 'the board-side slot CHECK must still be the v3 one');
});

/* ── 3 · NO PUBLIC PHOTO WITHOUT A RIGHTS WARRANTY ───────────────────── */

test('⭐ an APPROVED gallery asset with no rights warranty is REFUSED', async () => {
  const shop = await newShop();
  const msg = await refused(() =>
    newGalleryAsset({ vendorProfileId: shop, approve: true, warrant: false }),
  );
  assert.match(msg, /supplier_gallery_shape/);
});

test('an UN-approved draft may sit un-warranted — and cannot then be approved', async () => {
  const shop = await newShop();
  const draft = await newGalleryAsset({
    vendorProfileId: shop,
    approve: false,
    warrant: false,
  });
  const msg = await refused(() =>
    db.query(`UPDATE public.moodboard_library_assets SET approved_at = NOW() WHERE asset_id = $1`, [
      draft,
    ]),
  );
  assert.match(
    msg,
    /supplier_gallery_shape/,
    'the CHECK is keyed on approved_at, so publishing is where it must bite',
  );
  // Warranting first, then approving, works — the order the upload flow uses.
  await db.query(
    `UPDATE public.moodboard_library_assets
        SET rights_warranted_at = NOW(), rights_warranty_version = 'v1'
      WHERE asset_id = $1`,
    [draft],
  );
  await db.query(
    `UPDATE public.moodboard_library_assets SET approved_at = NOW() WHERE asset_id = $1`,
    [draft],
  );
  const r = await db.query<{ ok: boolean }>(
    `SELECT approved_at IS NOT NULL AS ok FROM public.moodboard_library_assets WHERE asset_id = $1`,
    [draft],
  );
  assert.equal(r.rows[0]!.ok, true);
});

test('half a warranty is refused — a timestamp cannot say what was agreed to', async () => {
  const shop = await newShop();
  const asset = await newGalleryAsset({ vendorProfileId: shop });
  const msg = await refused(() =>
    db.query(
      `UPDATE public.moodboard_library_assets SET rights_warranty_version = NULL WHERE asset_id = $1`,
      [asset],
    ),
  );
  assert.match(msg, /rights_warranty_paired/);
});

test('the warranty columns leave every OTHER asset type alone', async () => {
  // venue_scene / figure_attire / florals are Setnayan's own imagery and
  // predate all of this. The OR's first branch must not touch them.
  await db.query(
    `INSERT INTO public.moodboard_library_assets
       (asset_type, asset_subtype, label, storage_path, source, approved_at)
     VALUES ('venue_scene','church',$1,$2,'recraft_generated',NOW())`,
    [uniq(), `moodboard-library/${uniq()}.webp`],
  );
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.moodboard_library_assets
      WHERE asset_type = 'venue_scene' AND rights_warranted_at IS NULL
        AND approved_at IS NOT NULL`,
  );
  assert.ok(r.rows[0]!.n > 0, 'approved Setnayan imagery must not need a warranty');
});

/* ── 4 · THE TWO DELETE PATHS BEHAVE DIFFERENTLY, ON PURPOSE ─────────── */

test('⭐ RETIRING a photo leaves the couple’s tile — and its credit — alone', async () => {
  const { userId, eventId } = await newCouple();
  const shop = await newShop();
  const assetId = await newGalleryAsset({ vendorProfileId: shop });
  await db.query(
    `INSERT INTO public.event_inspiration_assets
       (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url,
        library_asset_id,
        sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
     VALUES ($1,$2,'cake',1,'gallery_pick','https://cdn/cake.webp',$3,
             '#111111','#222222','#333333','#444444','#555555','#666666')`,
    [eventId, userId, assetId],
  );
  await db.query(
    `UPDATE public.moodboard_library_assets SET retired_at = NOW() WHERE asset_id = $1`,
    [assetId],
  );
  const r = await db.query<{ library_asset_id: string | null }>(
    `SELECT library_asset_id FROM public.event_inspiration_assets
      WHERE event_id = $1 AND slot_key = 'cake' AND removed_at IS NULL`,
    [eventId],
  );
  assert.equal(r.rows[0]!.library_asset_id, assetId, 'retiring must not touch the FK');
});

test('⭐ HARD-deleting a photo takes the tile with it — the storage object goes too', async () => {
  const { userId, eventId } = await newCouple();
  const shop = await newShop();
  const assetId = await newGalleryAsset({ vendorProfileId: shop });
  await db.query(
    `INSERT INTO public.event_inspiration_assets
       (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url,
        library_asset_id,
        sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
     VALUES ($1,$2,'cake',1,'gallery_pick','https://cdn/cake.webp',$3,
             '#111111','#222222','#333333','#444444','#555555','#666666')`,
    [eventId, userId, assetId],
  );
  // `deleteAsset` / `deleteStylistAsset` remove the row AND the bucket object,
  // so a tile left behind would be a broken image square.
  await db.query(`DELETE FROM public.moodboard_library_assets WHERE asset_id = $1`, [assetId]);
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_inspiration_assets WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(r.rows[0]!.n, 0, 'the pick must cascade, not survive as a null-id gallery_pick');
});

test('⭐ deleting a SHOP is never blocked by somebody else’s mood board', async () => {
  // THE ERASURE HAZARD THE FIRST DRAFT OF THIS MIGRATION CREATED. Both new FKs
  // were written ON DELETE SET NULL, which would have turned a pick into a
  // `gallery_pick` with a null id (failing the biconditional) and a gallery
  // asset into one with no shop (failing the shape CHECK) — so the cascade
  // UPDATE fails and takes the whole DELETE with it. `users` →
  // `vendor_profiles` is itself ON DELETE CASCADE, so under SET NULL an
  // account deletion could be refused because of a photo on a stranger's
  // mood board.
  //
  // 🪤 MEASURED, NOT ASSUMED: a bare `DELETE FROM auth.users` is refused for an
  // entirely UNRELATED reason — the `VENDOR_LAST_ADMIN` trigger ("a store must
  // keep at least one admin") fires first, and it is deliberately NOT exempted
  // for erasure. The real erasure route goes through
  // `public.erase_vendor_seats(user_id)`, the one door that sets the local
  // exemption, so that is the route this test drives. A test that had deleted
  // the vendor_profiles row directly would have proven the FK and missed the
  // path a real erasure takes.
  const { userId, eventId } = await newCouple();
  const shopUser = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
    [`${uniq()}@shop.test`],
  );
  const shopUserId = shopUser.rows[0]!.id;
  const v = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [shopUserId],
  );
  const vendorProfileId =
    v.rows[0]?.vendor_profile_id ??
    (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name)
         VALUES ($1,'Gone Florals') RETURNING vendor_profile_id`,
        [shopUserId],
      )
    ).rows[0]!.vendor_profile_id;
  const assetId = await newGalleryAsset({ vendorProfileId });
  await db.query(
    `INSERT INTO public.event_inspiration_assets
       (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url,
        library_asset_id,
        sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
     VALUES ($1,$2,'flowers',3,'gallery_pick','https://cdn/f.webp',$3,
             '#111111','#222222','#333333','#444444','#555555','#666666')`,
    [eventId, userId, assetId],
  );

  await db.query(`SELECT public.erase_vendor_seats($1)`, [shopUserId]);
  await db.query(`DELETE FROM auth.users WHERE id = $1`, [shopUserId]);

  const asset = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.moodboard_library_assets WHERE asset_id = $1`,
    [assetId],
  );
  assert.equal(asset.rows[0]!.n, 0, 'the shop’s gallery goes with the shop');
  const tile = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_inspiration_assets WHERE library_asset_id = $1`,
    [assetId],
  );
  assert.equal(tile.rows[0]!.n, 0, 'and the picks of it go with the gallery');
});

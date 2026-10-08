/**
 * 👗 THE FOUR ATTIRE BOARDS HAVE A SLOT — proven against Postgres (owner
 * 2026-10-08: *"Inspiration can go more. Bridal Gown, Groom's Suit, Groomsmen,
 * Bridesmaid, Flowergirl, Ring Bearer"*; asked whether the database change for
 * the four may go ahead: *"go"*).
 *
 * Migration `…_attire_boards_four_more_slots.sql` widens the two slot gates —
 * the board's (`event_inspiration_assets_slot_key_check_v3`) and the supplier
 * gallery's (`moodboard_library_assets_supplier_gallery_shape`) — by exactly
 * `bridesmaids` · `groomsmen` · `flower_girl` · `ring_bearer`.
 *
 * 🔑 EVERY ASSERTION INSERTS A REAL ROW. A CHECK that parses is not a CHECK
 * that behaves: the failure this file exists for is the quiet one — a couple's
 * bridesmaids photo refused by the database after the screen let them pick it,
 * or a tailor's flower-girl photo refused so that board's "Search ideas ›" is
 * empty for ever.
 *
 * 🛡 Sabotaged once each (2026-10-08, builder A1), the migration edited and
 * restored each time: `'ring_bearer'` out of the board's CHECK alone → the file's
 * own closing DO block refuses to finish, so the replay stops and all six are
 * red; the same with the DO list edited too → "accepts a couple's own photo";
 * `'flower_girl'` out of the gallery's list → "accepts a supplier's photo" (and
 * `the-gallery-chain-keeps-its-credit`'s "every one of the 24"); `'usherettes'`
 * added to the board's list → "STILL refused"; `'venue'` dropped from the
 * board's list → "every slot the app knows"; the file's body absent (the
 * allocator's stub) → the two "accepts" and "exactly the app's vocabulary"; an
 * `UPDATE … SET slot_key = 'bridesmaids' WHERE slot_key = 'entourage'` added to
 * the file → "applied a second time", alone.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { MIGRATIONS_DIR, createReplayedDb, type ReplayResult } from './replay-migrations';
import { MOODBOARD_SLOT_KEYS } from '../../lib/moodboard-slots';

const FOUR = ['bridesmaids', 'groomsmen', 'flower_girl', 'ring_bearer'] as const;

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
const uniq = () => `attire4-${(seq += 1)}`;

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
  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [userId],
  );
  if (existing.rows[0]) return existing.rows[0].vendor_profile_id;
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name)
     VALUES ($1,'Terno & Thread') RETURNING vendor_profile_id`,
    [userId],
  );
  return v.rows[0]!.vendor_profile_id;
}

/** The couple's own photo in one slot, position 1. */
function upload(eventId: string, userId: string, slot: string) {
  return db.query(
    `INSERT INTO public.event_inspiration_assets
       (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url,
        sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
     VALUES ($1,$2,$3,1,'file_upload','https://cdn/own.webp',
             '#111111','#222222','#333333','#444444','#555555','#666666')`,
    [eventId, userId, slot],
  );
}

/** A supplier's approved, warranted gallery photo on one shelf. */
function galleryPhoto(shop: string, slot: string) {
  return db.query<{ asset_id: string }>(
    `INSERT INTO public.moodboard_library_assets
       (asset_type, asset_subtype, label, storage_path, source,
        vendor_profile_id, approved_at, rights_warranted_at, rights_warranty_version)
     VALUES ('supplier_gallery', $1, $2, $3, 'stylist_upload', $4, NOW(), NOW(), 'v1')
     RETURNING asset_id`,
    [slot, uniq(), `moodboard-library/${uniq()}.webp`, shop],
  );
}

async function refused(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  assert.fail('the database accepted a row it must refuse');
}

test('⭐ each of the four boards accepts a couple’s own photo', async () => {
  const { userId, eventId } = await newCouple();
  for (const slot of FOUR) await upload(eventId, userId, slot);
  const r = await db.query<{ slot_key: string }>(
    `SELECT slot_key FROM public.event_inspiration_assets
      WHERE event_id = $1 AND removed_at IS NULL ORDER BY slot_key`,
    [eventId],
  );
  assert.deepEqual(r.rows.map((x) => x.slot_key), [...FOUR].sort());
});

test('⭐ each of the four shelves accepts a supplier’s photo — and a pick of it lands on its board, credited', async () => {
  const shop = await newShop();
  const { userId, eventId } = await newCouple();
  for (const slot of FOUR) {
    const asset = (await galleryPhoto(shop, slot)).rows[0]!.asset_id;
    await db.query(
      `INSERT INTO public.event_inspiration_assets
         (event_id, added_by_user_id, slot_key, slot_position, source_kind, image_url, library_asset_id,
          sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
       VALUES ($1,$2,$3,1,'gallery_pick','https://cdn/pick.webp',$4,
               '#111111','#222222','#333333','#444444','#555555','#666666')`,
      [eventId, userId, slot, asset],
    );
  }
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_inspiration_assets
      WHERE event_id = $1 AND source_kind = 'gallery_pick' AND library_asset_id IS NOT NULL`,
    [eventId],
  );
  assert.equal(r.rows[0]!.n, FOUR.length);
});

test('⭐ a key that is not a board is STILL refused, by both gates', async () => {
  const { userId, eventId } = await newCouple();
  const shop = await newShop();
  for (const stranger of ['usherettes', 'flowergirl', 'bridesmaid', 'ring-bearer', '']) {
    assert.match(await refused(() => upload(eventId, userId, stranger)), /slot_key_check_v3/, `the board accepted '${stranger}'`);
    assert.match(await refused(() => galleryPhoto(shop, stranger)), /supplier_gallery_shape/, `the gallery accepted '${stranger}'`);
  }
});

test('every slot the app knows is accepted by both gates — nothing was dropped in the re-listing', async () => {
  const { userId, eventId } = await newCouple();
  const shop = await newShop();
  for (const slot of MOODBOARD_SLOT_KEYS) {
    await upload(eventId, userId, slot);
    await galleryPhoto(shop, slot);
  }
});

test('the two gates list exactly the app’s vocabulary, under the names the map and the tests know', async () => {
  const listed = async (name: string) => {
    const r = await db.query<{ def: string }>(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = $1`, [name]);
    assert.equal(r.rows.length, 1, `${name} is not there exactly once`);
    return [...r.rows[0]!.def.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]!).filter((v) => v !== 'supplier_gallery');
  };
  const app = [...MOODBOARD_SLOT_KEYS].sort();
  assert.deepEqual((await listed('event_inspiration_assets_slot_key_check_v3')).sort(), app, 'the board’s gate and the app disagree');
  assert.deepEqual((await listed('moodboard_library_assets_supplier_gallery_shape')).sort(), app, 'the gallery’s gate and the app disagree');
  for (const k of FOUR) assert.ok(app.includes(k), `${k} is not in MOODBOARD_SLOT_KEYS`);
});

test('applied a second time, over stored photos on every board, it changes no row and still holds', async () => {
  const { userId, eventId } = await newCouple();
  const shop = await newShop();
  for (const slot of MOODBOARD_SLOT_KEYS) {
    await upload(eventId, userId, slot);
    await galleryPhoto(shop, slot);
  }
  /* Every stored row, whole — so a rewrite of any column of any row shows. */
  const rows = async () =>
    (
      await db.query<{ j: string }>(
        `SELECT (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.inspiration_id) FROM public.event_inspiration_assets a)::text
             || (SELECT jsonb_agg(to_jsonb(l) ORDER BY l.asset_id) FROM public.moodboard_library_assets l)::text AS j`,
      )
    ).rows[0]!.j;
  const before = await rows();
  assert.ok(before.includes('"entourage"') && before.includes('"ring_bearer"'), 'the fixture rows are not there to be compared');

  const file = readdirSync(MIGRATIONS_DIR).find((f) => f.endsWith('_attire_boards_four_more_slots.sql'));
  assert.ok(file, 'the migration file is not there');
  await db.exec(readFileSync(join(MIGRATIONS_DIR, file!), 'utf8'));

  assert.equal(await rows(), before, 'a stored row changed when the migration was applied again');
  /* …and the gates still hold after the second application. */
  const again = await newCouple();
  await upload(again.eventId, again.userId, 'flower_girl');
  assert.match(await refused(() => upload(again.eventId, again.userId, 'usherettes')), /slot_key_check_v3/);
  assert.match(await refused(() => galleryPhoto(shop, 'usherettes')), /supplier_gallery_shape/);
});

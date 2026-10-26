/**
 * 🧩 THE INSPIRATION PARTS ON THE TAXONOMY — proven against Postgres (PLAN
 * `admin_inspiration_groups_2026-10-25` step ①, owner-approved 2026-10-26).
 *
 * Migration `…_inspiration_parts_on_the_taxonomy.sql` adds `inspiration_parts` +
 * `inspiration_part_categories` and seeds them from the consts. Four properties:
 *
 *   1. THE SEED EQUALS THE CONSTS, read here straight off `MOODBOARD_SLOT_KEYS`
 *      and `MOODBOARD_SLOT_TRADES` — NOT through `lib/inspiration-parts-seed.ts`,
 *      which wrote the seed, so a fault in that derivation cannot vouch for itself:
 *      the same keys, home = the trades' FIRST tile, also = the rest IN ORDER;
 *   2. every part has a tier-2 home (so at least one category), and the DB refuses
 *      a part with none, or one on a tier-1 group;
 *   3. a part holding a photo — on a couple's board or in a supplier's gallery —
 *      cannot be deleted (hide it instead); a part with none can;
 *   4. the key is permanent; a signed-in account reads, anon reaches nothing, and nobody but the service role writes.
 *
 * 🔑 EVERY REFUSAL INSERTS OR DELETES A REAL ROW. A trigger that compiles is not a
 * trigger that fires.
 *
 * 🛡 Sabotaged once each (2026-10-26, builder; the migration restored after): the seed's `cake` home set to
 * `dessert` → "the seed equals the consts" red; the tier-2 trigger made to wave everything through → "a part with
 * no home, or a home that is not a tier-2 category, is refused" red (and, as collateral, the RLS test counted the
 * tier-1 part that got in).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { MIGRATIONS_DIR, createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { MOODBOARD_SLOT_KEYS } from '../../lib/moodboard-slots';
import { MOODBOARD_SLOT_TRADES } from '../../lib/moodboard-gallery';
import { libraryPartLabel } from '../../lib/moodboard-gallery-upload';
import { LEGACY_PALETTE_BOARDS, libraryPhotoParts } from '../../lib/inspiration-slots';

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
const uniq = () => `insp-parts-${(seq += 1)}`;

type PartRow = { slot_key: string; label_en: string; kind: string; home_category_id: string | null; hidden: boolean; sort_order: number };

async function parts(): Promise<PartRow[]> {
  return (
    await db.query<PartRow>(
      `SELECT slot_key, label_en, kind, home_category_id, hidden, sort_order FROM public.inspiration_parts ORDER BY sort_order, slot_key`,
    )
  ).rows;
}
async function alsoOf(slot: string): Promise<string[]> {
  return (
    await db.query<{ category_id: string }>(
      `SELECT category_id FROM public.inspiration_part_categories WHERE slot_key = $1 ORDER BY sort_order, category_id`,
      [slot],
    )
  ).rows.map((r) => r.category_id);
}

async function refused(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  assert.fail('the database accepted what it must refuse');
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
    `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1,'Bloom & Vine') RETURNING vendor_profile_id`,
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

function galleryPhoto(shop: string, slot: string) {
  return db.query(
    `INSERT INTO public.moodboard_library_assets
       (asset_type, asset_subtype, label, storage_path, source,
        vendor_profile_id, approved_at, rights_warranted_at, rights_warranty_version)
     VALUES ('supplier_gallery', $1, $2, $3, 'stylist_upload', $4, NOW(), NOW(), 'v1')`,
    [slot, uniq(), `moodboard-library/${uniq()}.webp`, shop],
  );
}

/* ══ 1 · the seed equals the consts ═════════════════════════════════════════ */

test('⭐ the seed equals the consts: the same keys, home = the first trade, also = the rest in order', async () => {
  const rows = await parts();
  assert.deepEqual(rows.map((r) => r.slot_key).sort(), [...MOODBOARD_SLOT_KEYS].sort(), 'the table and MOODBOARD_SLOT_KEYS hold different keys');
  for (const key of MOODBOARD_SLOT_KEYS) {
    const row = rows.find((r) => r.slot_key === key)!;
    const [first, ...rest] = MOODBOARD_SLOT_TRADES[key];
    assert.equal(row.home_category_id, first ?? null, `${key}: home is not the first trade`);
    assert.deepEqual(await alsoOf(key), [...rest], `${key}: "also from" is not the remaining trades in their order`);
    assert.equal(row.kind, first ? 'part' : 'system', `${key}: kind`);
    assert.equal(row.label_en, libraryPartLabel(key) ?? 'Palette', `${key}: the name is not the one a supplier reads today`);
    assert.equal(row.hidden, !first || LEGACY_PALETTE_BOARDS.includes(key), `${key}: hidden`);
  }
});

test('the order is the couple’s Palette parts and Attire boards first, as libraryPhotoParts() draws them', async () => {
  const order = (await parts()).map((r) => r.slot_key);
  const lib = [...new Set(libraryPhotoParts().map((p) => p.key))];
  assert.deepEqual(order.slice(0, lib.length), lib);
  assert.equal(order.at(-1), 'palette', 'the system part is not last');
});

/* ══ 2 · every part has a tier-2 home ═══════════════════════════════════════ */

test('⭐ every part has a home on a tier-2 category, so at least one category; every also-category is tier 2 too', async () => {
  const bad = await db.query<{ slot_key: string }>(
    `SELECT p.slot_key FROM public.inspiration_parts p
       LEFT JOIN public.service_categories sc ON sc.id = p.home_category_id
      WHERE p.kind = 'part' AND (sc.id IS NULL OR sc.tier <> 2)`,
  );
  assert.deepEqual(bad.rows, [], 'a part has no tier-2 home');
  const badAlso = await db.query<{ slot_key: string }>(
    `SELECT l.slot_key FROM public.inspiration_part_categories l
       JOIN public.service_categories sc ON sc.id = l.category_id WHERE sc.tier <> 2`,
  );
  assert.deepEqual(badAlso.rows, []);
  const homeless = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.inspiration_parts WHERE kind = 'part'`);
  assert.equal(homeless.rows[0]!.n, MOODBOARD_SLOT_KEYS.length - 1, 'the fixture does not hold every part');
});

test('⭐ a part with no home, or a home that is not a tier-2 category, is refused', async () => {
  assert.match(
    await refused(() => db.query(`INSERT INTO public.inspiration_parts (slot_key, label_en) VALUES ('no_home_here', 'No home')`)),
    /inspiration_parts_part_has_a_home/,
  );
  const group = (await db.query<{ id: string }>(`SELECT id FROM public.service_categories WHERE tier = 1 LIMIT 1`)).rows[0]!.id;
  assert.match(
    await refused(() =>
      db.query(`INSERT INTO public.inspiration_parts (slot_key, label_en, home_category_id) VALUES ('on_a_group', 'On a group', $1)`, [group]),
    ),
    /not a tier-2 category/,
  );
  assert.match(
    await refused(() => db.query(`INSERT INTO public.inspiration_part_categories (slot_key, category_id) VALUES ('cake', $1)`, [group])),
    /not a tier-2 category/,
  );
  assert.match(
    await refused(() => db.query(`UPDATE public.inspiration_parts SET home_category_id = $1 WHERE slot_key = 'cake'`, [group])),
    /not a tier-2 category/,
  );
});

/* ══ 3 · a part with photos is hidden, never deleted ════════════════════════ */

test('⭐ a part holding a couple’s photo cannot be deleted — hiding it works', async () => {
  const { userId, eventId } = await newCouple();
  await boardPhoto(eventId, userId, 'tunnel');
  assert.match(await refused(() => db.query(`DELETE FROM public.inspiration_parts WHERE slot_key = 'tunnel'`)), /hide it instead/);
  await db.query(`UPDATE public.inspiration_parts SET hidden = TRUE WHERE slot_key = 'tunnel'`);
  assert.equal((await parts()).find((r) => r.slot_key === 'tunnel')?.hidden, true);
  await db.query(`UPDATE public.inspiration_parts SET hidden = FALSE WHERE slot_key = 'tunnel'`);
});

test('⭐ a part holding a supplier’s gallery photo cannot be deleted either', async () => {
  const shop = await newShop();
  await galleryPhoto(shop, 'cocktail');
  assert.match(await refused(() => db.query(`DELETE FROM public.inspiration_parts WHERE slot_key = 'cocktail'`)), /hide it instead/);
});

test('a part with no photo deletes, and its also-rows go with it', async () => {
  await db.query(`INSERT INTO public.inspiration_parts (slot_key, label_en, home_category_id) VALUES ('arch_test', 'Arch', 'florist')`);
  await db.query(`INSERT INTO public.inspiration_part_categories (slot_key, category_id) VALUES ('arch_test', 'stylist_decorator')`);
  await db.query(`DELETE FROM public.inspiration_parts WHERE slot_key = 'arch_test'`);
  assert.deepEqual(await alsoOf('arch_test'), []);
});

/* ══ 4 · the key is permanent; only an admin writes ═════════════════════════ */

test('the key is permanent — a rename is a label change', async () => {
  assert.match(await refused(() => db.query(`UPDATE public.inspiration_parts SET slot_key = 'cakes' WHERE slot_key = 'cake'`)), /key is permanent/);
  await db.query(`UPDATE public.inspiration_parts SET label_en = 'Cakes' WHERE slot_key = 'cake'`);
  await db.query(`UPDATE public.inspiration_parts SET label_en = 'Cake' WHERE slot_key = 'cake'`);
});

test('a signed-in account reads every part; anon reaches nothing; nobody signed in writes', async () => {
  const { userId } = await newCouple();
  try {
    await db.exec('SET ROLE anon');
    assert.match(await refused(() => db.query(`SELECT count(*) FROM public.inspiration_parts`)), /permission denied/, 'anon reads the parts');
    assert.match(await refused(() => db.query(`SELECT count(*) FROM public.inspiration_part_categories`)), /permission denied/);
    await db.exec('RESET ROLE');
    await setAuthUid(db, userId);
    await db.exec('SET ROLE authenticated');
    const n = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.inspiration_parts`)).rows[0]!.n;
    assert.equal(n, MOODBOARD_SLOT_KEYS.length, 'a signed-in account does not read every part');
    assert.match(
      await refused(() => db.query(`INSERT INTO public.inspiration_parts (slot_key, label_en, home_category_id) VALUES ('sneak', 'Sneak', 'florist')`)),
      /permission denied/,
    );
    assert.match(await refused(() => db.query(`UPDATE public.inspiration_parts SET label_en = 'Hacked' WHERE slot_key = 'cake'`)), /permission denied/);
    assert.match(await refused(() => db.query(`DELETE FROM public.inspiration_part_categories WHERE slot_key = 'cake'`)), /permission denied/);
  } finally {
    await db.exec('RESET ROLE');
    await setAuthUid(db, null);
  }
});

test('applied a second time, it changes no row and still holds', async () => {
  const snap = async () =>
    (
      await db.query<{ j: string }>(
        `SELECT (SELECT jsonb_agg(to_jsonb(p) - 'updated_at' - 'created_at' ORDER BY p.slot_key) FROM public.inspiration_parts p)::text
             || (SELECT jsonb_agg(to_jsonb(l) - 'created_at' ORDER BY l.slot_key, l.category_id) FROM public.inspiration_part_categories l)::text AS j`,
      )
    ).rows[0]!.j;
  await db.query(`UPDATE public.inspiration_parts SET label_en = 'Cake (admin)' WHERE slot_key = 'cake'`);
  const before = await snap();
  const file = readdirSync(MIGRATIONS_DIR).find((f) => f.endsWith('_inspiration_parts_on_the_taxonomy.sql'));
  assert.ok(file, 'the migration file is not there');
  await db.exec(readFileSync(join(MIGRATIONS_DIR, file!), 'utf8'));
  assert.equal(await snap(), before, 're-applying the seed overwrote an admin’s edit or changed a row');
  await db.query(`UPDATE public.inspiration_parts SET label_en = 'Cake' WHERE slot_key = 'cake'`);
});

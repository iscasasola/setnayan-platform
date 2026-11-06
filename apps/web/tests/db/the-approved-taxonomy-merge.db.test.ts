/**
 * THE APPROVED TAXONOMY MERGE (2026-11-06) — run against a real replayed schema.
 *
 * Replays every migration EXCEPT the data migration, seeds an event shaped like
 * cale-ice (the ten couple suppliers measured on production, by category and
 * category_key) plus shops holding absorbed trades, THEN runs the migration's
 * SQL — twice — and reads back where everything landed.
 *
 * 🔑 WHAT THIS PROVES THAT THE MECHANISM TESTS CANNOT: that the MAP, applied
 * through both merge functions, moves a running event's suppliers onto the
 * surviving categories and draws them there (homeTileForRow with the forward),
 * that a shop that held an absorbed trade is findable by the absorbed name
 * (facet value), and that a second run changes nothing.
 *
 * The "what moves" summary the migration leaves in a session setting is printed
 * so the PR body can quote it.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import {
  createReplayedDb,
  MIGRATIONS_DIR,
  versionOf,
  type ReplayResult,
} from './replay-migrations';
import { FIXTURE_COVER, FIXTURE_INCLUSION } from './live-card-fixture';
import { homeTileForRow } from '../../lib/shortlist-taxonomy';
import { tileForwardMapFromRows } from '../../lib/tile-merge-forward';

const FILE = '20271320461004_apply_the_approved_taxonomy_merge_2026_11_06.sql';
const MAP = path.resolve(MIGRATIONS_DIR, '../data/taxonomy-merge-2026-11-06.json');
const V2 = path.resolve(MIGRATIONS_DIR, '../data/taxonomy-v2-2026-11-06.json');

type V2Service = { key: string; label: string; event_types: string[]; status: string };
type V2 = {
  groups: { label: string; categories: { label: string; tile: string; services: V2Service[] }[] }[];
  live_key_map: Record<string, { service: string; as: string; status: string }>;
};

type MapEntry = {
  from_slug: string;
  into_slug: string;
  from_category: string;
  into_category: string;
  setnayan_product: boolean;
};

let replay: ReplayResult;
let db: PGlite;
let sql: string;
let map: MapEntry[];
let v2: V2;
let eventId: string;
const shop: Record<string, string> = {};

// cale-ice, measured on production 2026-11-06 (category, category_key) → the
// category it must be drawn under after the merge.
const CALE_ICE: [string, string, string][] = [
  ['reception_decor', 'stylist_decorator', 'stylist_decorator'],
  ['misc', 'shoes_footwear', 'jewelleries_accessories'],
  ['band_dj', 'dj', 'live_band'],
  ['guest_booth', 'perfume_bar', 'massage_chair'],
  ['misc', 'food_cart', 'food_cart'],
  ['misc', 'mens_attire', 'grooms_attire'],
  ['misc', 'food_truck', 'food_cart'],
  ['misc', 'coffee_espresso', 'mobile_bar'],
  ['misc', 'womens_attire', 'brides_attire'],
  ['misc', 'womens_attire', 'brides_attire'],
];

before(async () => {
  const only = new Set(
    fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql') && f !== FILE)
      .map(versionOf),
  );
  replay = await createReplayedDb({ only });
  db = replay.db;
  sql = fs.readFileSync(path.join(MIGRATIONS_DIR, FILE), 'utf8');
  map = JSON.parse(fs.readFileSync(MAP, 'utf8')) as MapEntry[];
  v2 = JSON.parse(fs.readFileSync(V2, 'utf8')) as V2;
});
after(async () => {
  await db?.close();
});

async function one<T>(q: string, params: unknown[] = []): Promise<T> {
  return (await db.query<T>(q, params)).rows[0]!;
}
async function count(q: string, params: unknown[] = []): Promise<number> {
  return Number((await one<{ n: number }>(q, params))?.n ?? 0);
}
async function summary(): Promise<Record<string, unknown>> {
  const r = await one<{ s: string | null }>(
    `SELECT current_setting('setnayan.taxonomy_v2_2026_11_06', true) AS s`,
  );
  return JSON.parse(r.s ?? '{}');
}
async function newShop(name: string, services: string[]): Promise<string> {
  return (
    await one<{ vendor_profile_id: string }>(
      `INSERT INTO vendor_profiles (business_name, services) VALUES ($1, $2::text[])
       RETURNING vendor_profile_id`,
      [name, services],
    )
  ).vendor_profile_id;
}

test('the replay is made production-shaped (tiles + trades admins added outside migrations)', async () => {
  // Production holds a few categories and trades created through Admin ›
  // Categories, not by a migration, so the replay lacks them. Seed exactly
  // those, from the map itself, so the fixture is the shape the migration
  // will meet in prod — and print them so the gap is visible, not silent.
  const tiles = [...new Set(map.flatMap((r) => [r.from_category, r.into_category]).concat(CALE_ICE.flatMap(([, k, i]) => [k, i])))];
  const haveTiles = new Set(
    (await db.query<{ id: string }>(`SELECT id FROM service_categories WHERE tier=2`)).rows.map((r) => r.id),
  );
  const addedTiles = tiles.filter((t) => !haveTiles.has(t));
  const anyFolder = (await one<{ id: string }>(`SELECT id FROM service_categories WHERE tier=1 ORDER BY sort_order LIMIT 1`)).id;
  for (const t of addedTiles) {
    await db.query(
      `INSERT INTO service_categories (id, parent_id, tier, kind, label_en, slug, sort_order)
       VALUES ($1, $2, 2, 'leaf', $1, replace($1,'_','-'), 999)`,
      [t, anyFolder],
    );
  }
  const haveTrades = new Set(
    (await db.query<{ k: string }>(`SELECT canonical_service AS k FROM canonical_service_taxonomy`)).rows.map((r) => r.k),
  );
  const addedTrades: string[] = [];
  for (const r of map) {
    for (const [slug, tile] of [[r.from_slug, r.from_category], [r.into_slug, r.into_category]] as const) {
      if (haveTrades.has(slug)) continue;
      haveTrades.add(slug);
      addedTrades.push(slug);
      await db.query(
        `INSERT INTO canonical_service_taxonomy (canonical_service, folder_id, tile_id, phase, is_setnayan)
         SELECT $1, parent_id, id, 'planning', $3 FROM service_categories WHERE id=$2`,
        [slug, tile, r.setnayan_product],
      );
    }
  }
  console.log('REPLAY GAP seeded — tiles:', addedTiles.join(', ') || '(none)', '· trades:', addedTrades.join(', ') || '(none)');
  const slugs = [...new Set(map.flatMap((r) => [r.from_slug, r.into_slug]))];
  assert.equal(
    await count(`SELECT count(*)::int AS n FROM canonical_service_taxonomy WHERE canonical_service = ANY($1::text[])`, [slugs]),
    slugs.length,
  );
});

test('seed: a cale-ice-shaped event and shops holding absorbed trades', async () => {
  eventId = (
    await one<{ event_id: string }>(
      `INSERT INTO events (display_name, event_type) VALUES ('cale-ice fixture', 'birthday') RETURNING event_id`,
    )
  ).event_id;
  for (const [category, key] of CALE_ICE) {
    await db.query(
      `INSERT INTO event_vendors (event_id, category, vendor_name, category_key) VALUES ($1,$2,$3,$4)`,
      [eventId, category, `cale-ice ${key}`, key],
    );
  }

  // A hotel ballroom (coverage) → Reception venue, venue_type "Hotel ballroom".
  shop.hotel = await newShop('Hotel shop', ['hotel_ballroom']);
  await db.query(`INSERT INTO vendor_coverages (vendor_profile_id, canonical_service) VALUES ($1,'hotel_ballroom')`, [shop.hotel]);
  // A Muslim counsellor and a pre-Cana seminar — the self-row ORDER case.
  shop.muslim = await newShop('Muslim counsel', ['muslim_pre_wedding_counseling']);
  shop.precana = await newShop('Pre-Cana', ['pre_cana_seminar']);
  // A shoe rental (service card) → Custom-made shoes, is_rental = true.
  shop.shoes = await newShop('Shoe rental', ['shoe_rental']);
  await db.query(`WITH s AS (
     INSERT INTO vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text, primary_photo_r2_key)
     VALUES ($1,'shoe_rental',1000,'Free shine', '${FIXTURE_COVER}') RETURNING vendor_service_id, vendor_profile_id
   ), i AS (
     INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label)
     SELECT vendor_service_id, vendor_profile_id, '${FIXTURE_INCLUSION}' FROM s
   ) SELECT 1 FROM s LIMIT 0`, [shop.shoes]);
  // A day-of coordinator WITH its own attribute row — the fold-in case.
  shop.dayof = await newShop('Day-of', ['day_of_coordinator']);
  await db.query(
    `INSERT INTO canonical_service_schemas (canonical_service, display_name_en)
     VALUES ('day_of_coordinator','Day-of coordinator') ON CONFLICT DO NOTHING`,
  );
  await db.query(
    `INSERT INTO vendor_service_attributes (vendor_profile_id, canonical_service, attribute_payload)
     VALUES ($1,'day_of_coordinator','{"team_size_hint":["4"]}'::jsonb)`,
    [shop.dayof],
  );
  // A Setnayan product with a supplier coverage row — must be left alone.
  shop.pabati = await newShop('Pabati shop', ['pabati']);
  await db.query(`INSERT INTO vendor_coverages (vendor_profile_id, canonical_service) VALUES ($1,'pabati')`, [shop.pabati]);
});

test('first run: the map is applied', async () => {
  await db.exec(sql);
  const s = await summary();
  console.log('WHAT MOVES (first run):', JSON.stringify(s, null, 2));
  const merges = Object.entries(v2.live_key_map).filter(([k, e]) => k !== e.service).length;
  assert.equal(s.trades_merged, merges, 'every live key v2 folds into another service merged');
  assert.equal(merges, 216, 'the approved map’s 217, minus Tea ceremony master (corrected to its own service)');
  assert.ok((s.tiles_merged as number) > 0);
  assert.deepEqual(s.facets_refused, [], 'no facet key collided with a field of another shape');
});

test('cale-ice’s ten suppliers sit on — and are drawn under — the surviving categories', async () => {
  const rows = (
    await db.query<{ category: string; category_key: string }>(
      `SELECT category, category_key FROM event_vendors WHERE event_id=$1 ORDER BY vendor_name`,
      [eventId],
    )
  ).rows;
  const tiles = (
    await db.query<{ id: string; merged_into_category_id: string | null }>(
      `SELECT id, merged_into_category_id FROM service_categories WHERE tier=2`,
    )
  ).rows;
  const forwards = tileForwardMapFromRows(tiles);
  const want = [...CALE_ICE].map(([, , into]) => into).sort();
  assert.deepEqual(rows.map((r) => r.category_key).sort(), want, 'category_key moved to the survivor');
  assert.deepEqual(
    rows.map((r) => homeTileForRow(r, undefined, forwards)).sort(),
    want,
    'and the Suppliers page draws each row there (none falls to Everything else)',
  );
});

test('every disappearing category is a tombstone forwarding to a survivor; no trade sits on one', async () => {
  const survivors = new Set(map.map((r) => r.into_category));
  const live = (
    await db.query<{ id: string }>(
      `SELECT DISTINCT tile_id AS id FROM canonical_service_taxonomy
        WHERE merged_into IS NULL AND canonical_service = ANY($1::text[])`,
      [map.map((r) => r.into_slug)],
    )
  ).rows.map((r) => r.id);
  for (const id of live) assert.ok(survivors.has(id), `survivor trade sits on non-survivor tile ${id}`);
  assert.equal(
    await count(
      `SELECT count(*)::int AS n FROM canonical_service_taxonomy c
         JOIN service_categories sc ON sc.id = c.tile_id
        WHERE sc.merged_into_category_id IS NOT NULL`,
    ),
    0,
    'no trade (live or tombstone) may sit on a merged category',
  );
  const e = await one<{ status: string; marketplace_hidden: boolean; merged_into_category_id: string | null }>(
    `SELECT status, marketplace_hidden, merged_into_category_id FROM service_categories WHERE id='everything_else'`,
  );
  assert.equal(e.status, 'retired');
  assert.equal(e.merged_into_category_id, null, 'Everything else is retired WITHOUT a forward');
});

test('absorbed trades are tombstones; Setnayan products are untouched', async () => {
  const merged = await count(
    `SELECT count(*)::int AS n FROM canonical_service_taxonomy WHERE merged_into IS NOT NULL`,
  );
  assert.equal(merged, Object.entries(v2.live_key_map).filter(([k, e]) => k !== e.service).length);
  const p = await one<{ merged_into: string | null }>(
    `SELECT merged_into FROM canonical_service_taxonomy WHERE canonical_service='pabati'`,
  );
  assert.equal(p.merged_into, null, 'pabati is a Setnayan product — never merged');
  assert.equal(
    await count(`SELECT count(*)::int AS n FROM vendor_coverages WHERE vendor_profile_id=$1 AND canonical_service='pabati'`, [shop.pabati]),
    1,
  );
  assert.equal(
    await count(
      `SELECT count(*)::int AS n FROM inspiration_part_services ips
         JOIN canonical_service_taxonomy c ON c.canonical_service = ips.canonical_service
        WHERE c.merged_into IS NOT NULL`,
    ),
    0,
    'no inspiration part still credits an absorbed trade',
  );
});

test('v2 exactly: 39 live picker categories, 84 services on them, every live key resolves', async () => {
  const cats = v2.groups.flatMap((g) => g.categories);
  assert.equal(cats.length, 39);
  for (const c of cats) {
    const row = await one<{ label_en: string; merged_into_category_id: string | null; status: string } | undefined>(
      `SELECT label_en, merged_into_category_id, status FROM service_categories WHERE id=$1 AND tier=2`,
      [c.tile],
    );
    assert.ok(row, `category ${c.tile} must exist`);
    assert.equal(row!.merged_into_category_id, null, `${c.tile} is a live category`);
    assert.equal(row!.label_en, c.label, `${c.tile} carries its v2 label`);
  }
  const svcs = cats.flatMap((c) => c.services.map((s) => ({ ...s, tile: c.tile })));
  assert.equal(svcs.length, 84);
  for (const s of svcs) {
    const row = await one<{ tile_id: string; merged_into: string | null; types: string[] | null; name: string | null } | undefined>(
      `SELECT c.tile_id, c.merged_into, c.applicable_event_types AS types, s.display_name_en AS name
         FROM canonical_service_taxonomy c LEFT JOIN canonical_service_schemas s USING (canonical_service)
        WHERE c.canonical_service=$1`,
      [s.key],
    );
    assert.ok(row, `service ${s.key} must exist`);
    assert.equal(row!.merged_into, null, `${s.key} is live`);
    assert.equal(row!.tile_id, s.tile, `${s.key} sits on ${s.tile}`);
    assert.equal(row!.name, s.label, `${s.key} carries its v2 name`);
    assert.deepEqual([...(row!.types ?? [])].sort(), [...s.event_types].sort(), `${s.key} event types = v2`);
  }
  assert.equal(svcs.filter((s) => s.status === 'NEW').length, 16);
  // every live key lands where v2 says: itself, or a tombstone forwarding to its service
  for (const [k, e] of Object.entries(v2.live_key_map)) {
    const r = await one<{ merged_into: string | null }>(
      `SELECT merged_into FROM canonical_service_taxonomy WHERE canonical_service=$1`, [k],
    );
    assert.equal(r.merged_into ?? k, e.service, `${k} → ${e.service}`);
  }
});

test('Tea ceremony master is its own service under Hosts & talent, wedding only', async () => {
  const r = await one<{ tile_id: string; merged_into: string | null; types: string[] }>(
    `SELECT tile_id, merged_into, applicable_event_types AS types FROM canonical_service_taxonomy WHERE canonical_service='tea_ceremony_master'`,
  );
  assert.equal(r.merged_into, null);
  assert.equal(r.tile_id, 'host_mc');
  assert.deepEqual(r.types, ['wedding']);
  const h = await one<{ csa: Record<string, unknown> }>(
    `SELECT category_specific_attributes AS csa FROM canonical_service_schemas WHERE canonical_service='host_emcee'`,
  );
  assert.ok(!('specialty' in h.csa) || !JSON.stringify(h.csa).includes('tea ceremony'),
    'the tea ceremony is no longer a Host / emcee specialty');
});

test('the two new categories sit in their groups; specialty values carry their event scope', async () => {
  const staff = await one<{ parent_id: string }>(`SELECT parent_id FROM service_categories WHERE id='event_staffing'`);
  const ref = await one<{ parent_id: string }>(`SELECT parent_id FROM service_categories WHERE id='referee_official'`);
  assert.equal(staff.parent_id, ref.parent_id, 'Staff, security & registration sits with Logistics & safety');
  const pray = await one<{ parent_id: string }>(`SELECT parent_id FROM service_categories WHERE id='prayers'`);
  const fh = await one<{ parent_id: string }>(`SELECT parent_id FROM service_categories WHERE id='funeral_home'`);
  assert.equal(pray.parent_id, fh.parent_id, 'Prayers & novena sits with Funeral homes & farewell');
  const def = await one<{ d: { type: string; options: string[]; option_event_types: Record<string, string[]> } }>(
    `SELECT category_specific_attributes->'venue_type' AS d FROM canonical_service_schemas WHERE canonical_service='reception_venue'`,
  );
  assert.equal(def.d.type, 'multi_select');
  assert.ok(def.d.options.includes('Resort / destination'), 'the v2 relabel');
  assert.ok(Array.isArray(def.d.option_event_types['Hotel ballroom']), 'each value carries its event scope');
});

test('a shop that held an absorbed trade is findable by the absorbed name', async () => {
  const attr = async (vid: string, svc: string) =>
    (
      await db.query<{ attribute_payload: Record<string, unknown> }>(
        `SELECT attribute_payload FROM vendor_service_attributes WHERE vendor_profile_id=$1 AND canonical_service=$2`,
        [vid, svc],
      )
    ).rows[0]?.attribute_payload;

  assert.deepEqual((await attr(shop.hotel, 'reception_venue'))?.venue_type, ['Hotel ballroom']);
  assert.equal(
    await count(`SELECT count(*)::int AS n FROM vendor_coverages WHERE vendor_profile_id=$1 AND canonical_service='reception_venue'`, [shop.hotel]),
    1,
    'its coverage moved to the survivor',
  );
  assert.deepEqual((await attr(shop.muslim, 'pre_cana_seminar'))?.faith, ['Muslim'], 'tagged Muslim ONLY');
  assert.deepEqual((await attr(shop.precana, 'pre_cana_seminar'))?.faith, ['Catholic']);
  assert.equal((await attr(shop.shoes, 'custom_made_shoes'))?.is_rental, true);
  const dayof = await attr(shop.dayof, 'wedding_coordination');
  assert.deepEqual(dayof?.coverage, ['Day-of']);
  assert.deepEqual(dayof?.team_size_hint, ['4'], 'the absorbed trade’s own attribute row was folded in, not dropped');

  const facet = await one<{ ff: string[]; def: { type: string; options: string[] } }>(
    `SELECT filter_facets AS ff, category_specific_attributes->'venue_type' AS def
       FROM canonical_service_schemas WHERE canonical_service='reception_venue'`,
  );
  assert.equal(facet.ff[0], 'venue_type', 'the new facet is prepended (the couple UI keeps the first 6)');
  assert.equal(facet.def.type, 'multi_select');
  assert.ok(facet.def.options.includes('Hotel ballroom'));
});

test('inspiration parts keep their owner rulings through the fold', async () => {
  const services = async (slot: string) =>
    (
      await db.query<{ s: string }>(
        `SELECT canonical_service AS s FROM inspiration_part_services WHERE slot_key=$1 ORDER BY 1`,
        [slot],
      )
    ).rows.map((r) => r.s);
  const tileOf = async (svc: string) =>
    (await one<{ t: string }>(`SELECT tile_id AS t FROM canonical_service_taxonomy WHERE canonical_service=$1`, [svc])).t;
  // Owner 2026-10-08: the four party boards are the women's half and the men's half (step 11).
  for (const [slot, half] of [
    ['bridesmaids', 'brides_attire'],
    ['flower_girl', 'brides_attire'],
    ['groomsmen', 'grooms_attire'],
    ['ring_bearer', 'grooms_attire'],
  ] as const) {
    const svcs = await services(slot);
    assert.ok(svcs.length > 0, `${slot} lost every service`);
    for (const s of svcs) assert.equal(await tileOf(s), half, `${slot} reaches ${s}, which is not its half`);
  }
  // Entourage and Guests dress both halves and keep both.
  for (const slot of ['entourage', 'guests']) {
    const tiles = new Set(await Promise.all((await services(slot)).map(tileOf)));
    assert.ok(tiles.has('brides_attire') && tiles.has('grooms_attire'), `${slot} lost a half`);
  }
  // MB26: a backdrop is a stylist's work. The LED wall ROW folded into Lights, sound & effects, but
  // the part admits the kept LED-wall SERVICE, never a plain lights-and-sound shop.
  const backdrop = await services('backdrop');
  assert.ok(backdrop.includes('led_video_wall') && backdrop.includes('stylist_decorator'), backdrop.join(','));
  assert.ok(!backdrop.includes('lights_sound'), 'backdrop now admits every lights-and-sound shop');
});

test('second run: nothing changes', async () => {
  const snap = async () =>
    one<{ h: string }>(
      `SELECT md5(
         (SELECT string_agg(canonical_service||':'||coalesce(tile_id,'')||':'||coalesce(merged_into,''), ',' ORDER BY canonical_service) FROM canonical_service_taxonomy)
         || (SELECT string_agg(id||':'||coalesce(label_en,'')||':'||coalesce(merged_into_category_id,'')||':'||status, ',' ORDER BY id) FROM service_categories)
         || (SELECT string_agg(canonical_service||':'||display_name_en||':'||filter_facets::text||':'||category_specific_attributes::text, ',' ORDER BY canonical_service) FROM canonical_service_schemas)
         || (SELECT coalesce(string_agg(vendor_profile_id::text||':'||canonical_service||':'||attribute_payload::text, ',' ORDER BY vendor_profile_id, canonical_service), '') FROM vendor_service_attributes)
         || (SELECT string_agg(coalesce(category_key,''), ',' ORDER BY vendor_id) FROM event_vendors)
       ) AS h`,
    );
  const before1 = (await snap()).h;
  await db.exec(sql);
  const s = await summary();
  assert.equal(s.trades_merged, 0);
  assert.equal(s.tiles_merged, 0);
  assert.equal(s.shops_tagged, 0);
  assert.equal(s.facets_written, 0);
  assert.equal((await snap()).h, before1, 'a second run must change nothing');
});

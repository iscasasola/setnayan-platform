/**
 * GUARD — "Ceremony essentials" (owner 2026-11-07, migration
 * 20271321431508_ceremony_essentials_category.sql) is a real, findable category:
 * an active tier-2 row in Look, right after Jewelleries & accessories, scoped to
 * the wedding and the anniversary (a vow renewal), filed under a coarse
 * category, with its eight services under it — the complete set FIRST — each
 * named, and each INHERITING the category's scope so the owner's later edits in
 * Admin › Categories reach them.
 *
 * Also pins that the bride's `wedding_veil` was left where it was: the unity
 * veil is a different thing, and the near-match must not be moved.
 *
 * And, in the same migration: PABATI IS NOT A SERVICE (owner 2026-11-07). It was
 * retired into Papic on 2026-08-21, but its row stayed a visible supplier
 * service — and with no `setnayan_` prefix it passed the /open-shop first-party
 * filter. It is now `marketplace_hidden` (row KEPT: a shop's services[] still
 * holds the key). Asserted against the picker's own SQL filter and against the
 * buckets /explore reads (`deriveBuckets`).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { taxonomyFromDb } from './taxonomy-from-db';
import { deriveBuckets } from '../../lib/vendor-counts';
import type { WeddingTile } from '../../lib/taxonomy';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

const SERVICES_IN_ORDER = [
  ['ceremony_essentials_set', 'Complete ceremony set'],
  ['arrhae_arras', 'Arrhae (arras)'],
  ['unity_cord', 'Unity cord'],
  ['unity_veil', 'Unity veil'],
  ['ceremony_candles', 'Ceremony candles'],
  ['wedding_bible', 'Wedding Bible'],
  ['ring_coin_bearer_pillow', 'Ring & coin bearer pillows'],
  ['wedding_rosary', 'Wedding rosary'],
] as const;

test('the category is an active, visible tier-2 row in Look, beside Jewelleries & accessories', async () => {
  const r = await db.query<{
    label_en: string; slug: string; tier: number; status: string; hidden: boolean;
    parent_id: string; sort_order: number; coarse: string | null; jewel_sort: number;
  }>(
    `SELECT c.label_en, c.slug, c.tier, c.status, c.marketplace_hidden AS hidden, c.parent_id,
            c.sort_order, c.coarse_category::text AS coarse,
            (SELECT sort_order FROM public.service_categories WHERE id = 'jewelleries_accessories') AS jewel_sort
       FROM public.service_categories c WHERE c.id = 'ceremony_essentials'`,
  );
  assert.equal(r.rows.length, 1, 'ceremony_essentials is missing');
  const row = r.rows[0]!;
  assert.equal(row.label_en, 'Ceremony essentials');
  assert.equal(row.slug, 'ceremony-essentials');
  assert.equal(row.tier, 2);
  assert.equal(row.status, 'active');
  assert.equal(row.hidden, false, 'a hidden category is unfindable');
  assert.equal(row.parent_id, 'look');
  assert.equal(row.sort_order, row.jewel_sort + 1, 'it sorts right after Jewelleries & accessories');
  assert.ok(row.coarse, 'no coarse category — its shops would be filed as misc');
});

test('scoped to the wedding and the anniversary (vow renewal) only', async () => {
  const r = await db.query<{ t: string[] | null }>(
    `SELECT applicable_event_types AS t FROM public.service_categories WHERE id = 'ceremony_essentials'`,
  );
  assert.deepEqual([...(r.rows[0]?.t ?? [])].sort(), ['anniversary', 'wedding']);
});

test('its eight services exist, named, the set first, and INHERIT the category scope', async () => {
  const r = await db.query<{
    k: string; name: string | null; t: string[] | null; hidden: boolean;
    faith: string | null; is_ph: boolean; is_tradition: boolean; is_rental: boolean; folder_id: string;
  }>(
    `SELECT c.canonical_service AS k, s.display_name_en AS name, c.applicable_event_types AS t,
            c.marketplace_hidden AS hidden, c.faith, c.is_ph, c.is_tradition, c.is_rental, c.folder_id
       FROM public.canonical_service_taxonomy c
       LEFT JOIN public.canonical_service_schemas s USING (canonical_service)
      WHERE c.tile_id = 'ceremony_essentials'
      ORDER BY c.sort_order, c.canonical_service`,
  );
  assert.deepEqual(
    r.rows.map((x) => [x.k, x.name]),
    SERVICES_IN_ORDER.map(([k, n]) => [k, n]),
  );
  for (const x of r.rows) {
    assert.equal(x.t, null, `${x.k} overrides the category scope — owner edits would stop reaching it`);
    assert.equal(x.hidden, false, `${x.k} is hidden`);
    assert.equal(x.folder_id, 'look');
    assert.equal(x.faith, null, `${x.k}: faith is an exclusive filter; tagging one faith hides it from the others`);
    assert.equal(x.is_ph, true);
    assert.equal(x.is_tradition, true);
    assert.equal(x.is_rental, false);
  }
});

test("the bride's wedding_veil stays in Jewelleries & accessories", async () => {
  const r = await db.query<{ tile_id: string }>(
    `SELECT tile_id FROM public.canonical_service_taxonomy WHERE canonical_service = 'wedding_veil'`,
  );
  assert.equal(r.rows[0]?.tile_id, 'jewelleries_accessories');
});

/** The leaves /open-shop offers — the same filters as `getCoverageTaxonomy()`
 *  (open-shop-service-tree.db.test.ts OFFERABLE_SQL). */
const OFFERABLE_SQL = `
  SELECT c.canonical_service
    FROM canonical_service_taxonomy c
    JOIN service_categories b ON b.id = c.tile_id AND b.tier = 2
    JOIN service_categories p ON p.id = b.parent_id AND p.tier = 1
   WHERE coalesce(c.marketplace_hidden,false) = false
     AND coalesce(b.status,'') <> 'retired' AND coalesce(b.marketplace_hidden,false) = false
     AND coalesce(p.status,'') <> 'retired' AND coalesce(p.marketplace_hidden,false) = false
`;

test('the sign-up picker offers all eight ceremony services and never pabati', async () => {
  const offered = new Set((await db.query<{ canonical_service: string }>(OFFERABLE_SQL)).rows.map((r) => r.canonical_service));
  for (const [k] of SERVICES_IN_ORDER) assert.ok(offered.has(k), `${k} is not offered at sign-up`);
  assert.equal(offered.has('pabati'), false, 'pabati is still offered to a new supplier as a trade');
});

test('Explore buckets: the category carries its eight services; pabati is in none', async () => {
  const buckets = deriveBuckets(await taxonomyFromDb(db));
  const tile = buckets.byTile.get('ceremony_essentials' as WeddingTile) ?? [];
  assert.deepEqual([...tile].sort(), SERVICES_IN_ORDER.map(([k]) => k).sort());
  for (const [t, keys] of buckets.byTile) {
    assert.equal(keys.includes('pabati'), false, `pabati still sits under ${t}`);
  }
});

test('pabati is hidden, and its row is KEPT (a shop still holds the key)', async () => {
  const r = await db.query<{ hidden: boolean; merged_into: string | null }>(
    `SELECT marketplace_hidden AS hidden, merged_into FROM public.canonical_service_taxonomy WHERE canonical_service = 'pabati'`,
  );
  assert.equal(r.rows.length, 1, 'the pabati row was deleted — a shop holding the key could no longer resolve it');
  assert.equal(r.rows[0]!.hidden, true);
  assert.equal(r.rows[0]!.merged_into, null, 'hidden, not merged: Pabati has no trade to forward to');
});

test('the photoman sits under Photo booth with its siblings\' flags, inherits the scope, and is offered', async () => {
  const r = await db.query<{
    tile_id: string; folder_id: string; name: string | null; t: string[] | null; phase: string;
    faith: string | null; is_ph: boolean; is_setnayan: boolean; is_rental: boolean; is_tradition: boolean; hidden: boolean;
    sib_phase: string;
  }>(
    `SELECT c.tile_id, c.folder_id, s.display_name_en AS name, c.applicable_event_types AS t, c.phase,
            c.faith, c.is_ph, c.is_setnayan, c.is_rental, c.is_tradition, c.marketplace_hidden AS hidden,
            (SELECT phase FROM public.canonical_service_taxonomy WHERE canonical_service = 'polaroid_booth') AS sib_phase
       FROM public.canonical_service_taxonomy c
       LEFT JOIN public.canonical_service_schemas s USING (canonical_service)
      WHERE c.canonical_service = 'photoman'`,
  );
  assert.equal(r.rows.length, 1, 'photoman is missing');
  const x = r.rows[0]!;
  assert.equal(x.tile_id, 'photo_booth');
  assert.equal(x.folder_id, 'booths');
  assert.equal(x.name, 'Photoman (instant prints)');
  assert.equal(x.t, null, 'photoman overrides the category scope — it must inherit, as its siblings do');
  assert.equal(x.phase, x.sib_phase);
  assert.equal(x.faith, null);
  assert.deepEqual([x.is_ph, x.is_setnayan, x.is_rental, x.is_tradition, x.hidden], [false, false, false, false, false]);
  const offered = new Set((await db.query<{ canonical_service: string }>(OFFERABLE_SQL)).rows.map((q) => q.canonical_service));
  assert.ok(offered.has('photoman'), 'photoman is not offered at sign-up');
  const buckets = deriveBuckets(await taxonomyFromDb(db));
  assert.ok((buckets.byTile.get('photo_booth' as WeddingTile) ?? []).includes('photoman'), 'photoman is not in the Explore bucket');
});

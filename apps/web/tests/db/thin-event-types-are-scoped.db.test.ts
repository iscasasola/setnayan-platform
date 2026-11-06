/**
 * THE THIN EVENT TYPES CAN FIND A SUPPLIER — and a wedding's list did not move.
 *
 * Migration under test: 20271259024543 — appends birthday / hangout / date /
 * wake / simple_event to the CATEGORIES (tier-2 tiles) that sensibly serve them.
 * Owner 2026-10-02: "yes scope it." (audit: simple_event 0, hangout 4, date 6,
 * wake 10.) Services inherit their tile's list, so only tiles are scoped.
 *
 * Questions, in the order they can hurt somebody:
 *   1. does each thin type reach at least its floor of categories?
 *   2. does a wedding still reach every category it reached on 2026-10-02?
 *   3. does the wedding reach NOTHING new (only thin types were appended)?
 *   4. did the services keep inheriting (no list copied onto a service)?
 *
 * Run: cd apps/web && npx tsx --test tests/db/thin-event-types-are-scoped.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

const V2 = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', '..', 'supabase', 'data', 'taxonomy-v2-2026-11-06.json'), 'utf8'),
) as { groups: { categories: { tile: string; services: { key: string; event_types: string[] }[] }[] }[] };
const V2_CATEGORIES = V2.groups.flatMap((g) => g.categories);
const V2_SERVICES = V2_CATEGORIES.flatMap((c) => c.services);

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

/** Every tier-2 category that reached a wedding on 2026-10-02 (65). */
const WEDDING_CATEGORIES_2026_10_02 = [
  'reception',
  'ceremony_venue',
  'officiants',
  'counseling_seminars',
  'accommodation',
  'coordinator',
  'date_specialist',
  'travel_honeymoon',
  'wedding_paperwork',
  'cake',
  'catering',
  'stations',
  'crew_meals',
  'stylist_decorator',
  'florist',
  'lights_sound',
  'dance_floor',
  'outdoor',
  'fireworks',
  'led_wall',
  'digital_services',
  'live_band',
  'choir',
  'orchestra',
  'wedding_singer',
  'dj',
  'choreographer',
  'performers',
  'host_mc',
  'av_production',
  'photo_video',
  'editorial',
  'livestream',
  'brides_attire',
  'grooms_attire',
  'womens_attire',
  'mens_attire',
  'filipiniana_barongs',
  'hmua',
  'grooming',
  'wellness_fitness',
  'jewelleries_accessories',
  'mobile_bar',
  'coffee_espresso',
  'mocktail',
  'food_truck',
  'dessert',
  'massage_chair',
  'food_cart',
  'photo_booth',
  'perfume_bar',
  'arcade_games',
  'henna_tattoo',
  'mini_nail_bar',
  'tarot_astrology_palmistry',
  'caricature_calligraphy_painting',
  'engraving_embroidery',
  'printing',
  'souvenir_giveaways',
  'bridal_car',
  'guest_shuttle',
  'escort',
  'event_medic',
  'everything_else',
  'event_insurance',
];

/** The same visibility rule Find a supplier applies: active, shown, in scope. */
async function reaching(type: string, includeHidden = false): Promise<string[]> {
  const r = await db.query<{ id: string }>(
    `SELECT id FROM public.service_categories
      WHERE tier = 2 AND status = 'active' AND ($2::boolean OR marketplace_hidden IS FALSE)
        AND (applicable_event_types IS NULL OR cardinality(applicable_event_types) = 0
             OR $1 = ANY (applicable_event_types))
      ORDER BY id`,
    [type, includeHidden],
  );
  return r.rows.map((x) => x.id);
}

/*
 * ⚖ TAXONOMY V2 (owner-approved 2026-11-06): `simple_event` (Get-together) is v2's one `no_marketplace_event_types`
 * entry, and no v2 service is scoped to it — so step 10b of `20271320461004` takes it off every category, and its
 * floor of 5 (2026-10-02 "yes scope it") is superseded. It is asserted below as the v2 rule instead: no category is
 * SCOPED to it (an unscoped category, open to every type, still shows — that is not a placement).
 */
const V2_NO_MARKETPLACE = (JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', '..', 'supabase', 'data', 'taxonomy-v2-2026-11-06.json'), 'utf8'),
) as { no_marketplace_event_types: string[] }).no_marketplace_event_types;

test('v2: an event type with no marketplace is scoped onto no category', async () => {
  assert.deepEqual(V2_NO_MARKETPLACE, ['simple_event'], 'premise: v2 names exactly one no-marketplace type');
  const r = await db.query<{ id: string }>(
    `SELECT id FROM public.service_categories
      WHERE tier = 2 AND status = 'active' AND applicable_event_types && $1::text[]
        AND id = ANY ($2::text[]) -- the marketplace = v2's picker categories (Setnayan's own rows are not suppliers)
      ORDER BY id`,
    [V2_NO_MARKETPLACE, V2_CATEGORIES.map((c) => c.tile)],
  );
  assert.deepEqual(r.rows.map((x) => x.id), [], 'a category is still scoped to a no-marketplace event type');
});

const FLOORS: Record<string, number> = {
  birthday: 8,
  wake: 5,
  hangout: 3,
  date: 3,
};

for (const [type, floor] of Object.entries(FLOORS)) {
  test(`${type} reaches at least ${floor} categories`, async () => {
    const ids = await reaching(type);
    assert.ok(ids.length >= floor, `${type} reaches only ${ids.length} (${ids.join(', ')}); need ${floor}`);
  });
}

test('a few named placements the owner asked for are really there', async () => {
  const has = async (type: string, id: string) => (await reaching(type)).includes(id);
  assert.ok(await has('wake', 'funeral_home'), 'a wake finds funeral services');
  assert.ok(await has('wake', 'catering'));
  assert.ok(await has('wake', 'chairs_tents'));
  // ⚖ v2: a Get-together has no marketplace (see the no-marketplace test) — these two 2026-10-02 placements are superseded.
  assert.ok(!(await has('simple_event', 'catering')), 'v2: a Get-together is offered Catering');
  assert.ok(!(await has('simple_event', 'chairs_tents')), 'v2: a Get-together is offered Chairs');
  assert.ok(await has('hangout', 'restaurant_reservation'));
  assert.ok(await has('date', 'florist'));
  assert.ok(await has('birthday', 'cake'));
  // …and a thin type is not handed the other side's trade.
  assert.ok(!(await has('date', 'funeral_home')), 'a date must not be offered funeral services');
  assert.ok(!(await has('hangout', 'funeral_home')));
  assert.ok(!(await has('birthday', 'funeral_home')));
});

test('a wedding still reaches every category it reached, and nothing new', async () => {
  // hidden tiles included: the pinned list is the whole 65, hidden four too.
  const now = await reaching('wedding', true);
  const missing = WEDDING_CATEGORIES_2026_10_02.filter((id) => !now.includes(id));
  // ⚖ TAXONOMY V2 (2026-11-06, `20271320461004`): a category v2 FOLDED is retired (so `reaching` skips it) and forwards to
  // the row that took its services. Such a category is not lost: the wedding must still reach where it forwards. Any
  // other missing category is still a loss.
  const forward = new Map(
    (await db.query<{ id: string; to: string | null; status: string }>(
      `SELECT id, merged_into_category_id AS to, status FROM public.service_categories WHERE id = ANY ($1::text[])`,
      [missing],
    )).rows.map((r) => [r.id, r.status === 'retired' ? r.to : null] as const),
  );
  const lost = missing.filter((id) => {
    const to = forward.get(id);
    return !to || !now.includes(to);
  });
  assert.deepEqual(lost, [], 'a wedding lost categories');

  // Nothing new: a category outside that list that reaches a wedding would
  // mean a thin-type append leaked a wedding in. (Later, deliberate additions
  // to the wedding belong in the list above — that is the point of pinning it.)
  // ⚖ V2 is the one deliberate addition: a category reaches a wedding when v2 scopes one of its services to a wedding
  // (step 7 widens the category to cover them) — the two NEW categories, and e.g. Chairs and Restaurant reservation.
  const v2NewForWedding = V2_CATEGORIES.filter((c) => c.services.some((sv) => sv.event_types.includes('wedding'))).map((c) => c.tile);
  const extra = now.filter((id) => !WEDDING_CATEGORIES_2026_10_02.includes(id) && !v2NewForWedding.includes(id));
  assert.deepEqual(extra, [], 'a wedding gained categories this migration should not have given it');
});

// ⚖ TAXONOMY V2 (owner-approved 2026-11-06): v2 hand-sets every picker service's event list, so "no service under these
// tiles carries a list" is obsolete by that decision. What still must hold: the only lists here are v2's own, value for
// value — no CATEGORY list was copied onto a service, and no service that v2 does not name gained one.
test('services keep inheriting — no category list was copied onto a service', async () => {
  const r = await db.query<{ k: string; e: string[] }>(
    `SELECT canonical_service AS k, applicable_event_types AS e FROM public.canonical_service_taxonomy
      WHERE applicable_event_types IS NOT NULL
        AND merged_into IS NULL -- a folded key is a tombstone: it is never shown, so its old list reaches nobody
        AND tile_id IN ('reception','catering','cake','dj','florist','photo_video','dessert')
      ORDER BY 1`,
  );
  const v2 = new Map(V2_SERVICES.map((sv) => [sv.key, sv.event_types] as const));
  const notV2 = r.rows.filter((x) => !v2.has(x.k) || JSON.stringify(x.e) !== JSON.stringify(v2.get(x.k)));
  assert.deepEqual(
    notV2.map((x) => x.k),
    [],
    'a service under a scoped tile carries a list that is not v2\'s own, and would override the tile',
  );
});

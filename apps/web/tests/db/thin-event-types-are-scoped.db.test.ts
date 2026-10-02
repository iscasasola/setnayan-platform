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

import { createReplayedDb, type ReplayResult } from './replay-migrations';

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

const FLOORS: Record<string, number> = {
  birthday: 8,
  wake: 5,
  simple_event: 5,
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
  assert.ok(await has('simple_event', 'catering'));
  assert.ok(await has('simple_event', 'chairs_tents'));
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
  assert.deepEqual(missing, [], 'a wedding lost categories');

  // Nothing new: a category outside that list that reaches a wedding would
  // mean a thin-type append leaked a wedding in. (Later, deliberate additions
  // to the wedding belong in the list above — that is the point of pinning it.)
  const extra = now.filter((id) => !WEDDING_CATEGORIES_2026_10_02.includes(id));
  assert.deepEqual(extra, [], 'a wedding gained categories this migration should not have given it');
});

test('services keep inheriting — no category list was copied onto a service', async () => {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.canonical_service_taxonomy
      WHERE applicable_event_types IS NOT NULL
        AND tile_id IN ('reception','catering','cake','dj','florist','photo_video','dessert')`,
  );
  assert.equal(r.rows[0]!.n, 0, 'a service under a scoped tile carries its own list and would override the tile');
});

/**
 * 🇵🇭 THE SHIPPED TREE IS THE OWNER-APPROVED PHILIPPINE TAXONOMY (T1, owner 16 Nov 2026: "make the taxonomy go live
 * now"; spec corpus TAXONOMY_PH_FULL_2026-11-07.md, "the ONE spec for build T1"; migrations 20271349668764 part 1 and
 * 20271350082350 part 2).
 *
 *   1 · Every category the spec names is a VISIBLE category of its group, by the spec's own words.
 *   2 · The spec's category MERGES landed: each merged category is hidden, forwards (`merged_into_category_id`) to the
 *       one that took it in, holds no service and no couple's supplier, and that destination keeps every event the
 *       merged one served. The code's mirror (`MERGED_TILES`) is the same list — never a second one.
 *   3 · Nothing the spec hides (⛔) is still offered.
 *
 * The spec tables below are copied from the spec, not from the code — that is the point of the test. "Shoes" is the
 * one category the spec names that the replay cannot hold: it was added on /admin/categories in production only
 * (measured 16 Nov), so it is checked when present and named, never invented here.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb } from './replay-migrations';
import { MERGED_TILES } from '../../lib/taxonomy';

let db: PGlite;
before(async () => {
  db = (await createReplayedDb()).db;
});
after(async () => {
  await db?.close();
});

/** Group id → the spec's category names for it (TAXONOMY_PH_FULL_2026-11-07.md, tables 1–10 and 11–16). */
const SPEC_CATEGORIES: Record<string, readonly string[]> = {
  venue: ['Reception Venues', 'Ceremony Venues', 'Hotels & Resorts'],
  feast: ['Catering', 'Cakes & Desserts', 'Live Stations', 'Crew Meals'],
  planning: ['Coordinators & Planners', 'Date & Feng Shui', 'Documents', 'Travel & Honeymoon'],
  documentary: ['Photo & Video'],
  look: [
    'Gowns & Couturiers', 'Barong & Suits', 'Entourage & Sponsors', 'Hair & Make-up (HMUA)', 'Jewellers & Accessories',
    'Ceremony Essentials', 'Shoes', 'Bridal Spa',
  ],
  design: ['Stylist / Decorator', 'Florist', 'Lights & Sounds', 'LED Wall', 'Rentals & Special Effects'],
  program: [
    'Host', 'Live Band & Singers', 'Choir & Strings', 'DJ', 'Cultural Performers', 'Dance Instructors & Choreographers',
    "Kids' Party Entertainers", 'Speakers & AV',
  ],
  booths: ['Photobooths', 'Mobile Bar', 'Coffee Cart', 'Food Carts', 'Make & Take', 'Live Art', 'Games', 'Pampering'],
  prints: ['Invitations & Signage', 'Trophies & Medals'],
  gifts_giveaways: ['Gifts, Giveaways & Souvenirs'],
  transport: ['Bridal Car', 'Van / Coaster Rental', 'Escort'],
  logistics_safety: ['Medic, Staff & Security'],
};
const PROD_ONLY = new Set(['Shoes']);

/** The spec's merges ("NOT in this part — T1 part 2" in iscasasola/setnayan-platform#7887), source → destination. */
const SPEC_MERGES: Record<string, string> = {
  mens_attire: 'womens_attire', // Men's → Entourage & Sponsors
  wedding_singer: 'live_band', // → Live Band & Singers
  mocktail: 'mobile_bar',
  dessert: 'food_cart', // Dessert + Food Truck → Food Carts
  food_truck: 'food_cart',
  mini_nail_bar: 'massage_chair', // Nail bar / Perfume / Henna → Pampering
  perfume_bar: 'massage_chair',
  henna_tattoo: 'massage_chair',
  outdoor: 'chairs_tents', // Outdoor / Fireworks / Dance floor → Rentals & Special Effects
  fireworks: 'chairs_tents',
  dance_floor: 'chairs_tents',
  transfers_rentals: 'guest_shuttle', // Transfers → Van / Coaster
  av_production: 'speaker_talent', // AV → Speakers & AV
};

test('1 · every category the spec names is a visible category of its group, by the spec’s name', async () => {
  const rows = (
    await db.query<{ parent_id: string; label_en: string }>(
      `SELECT parent_id, label_en FROM public.service_categories
        WHERE tier = 2 AND status = 'active' AND NOT COALESCE(marketplace_hidden, FALSE)`,
    )
  ).rows;
  const missing: string[] = [];
  for (const [group, names] of Object.entries(SPEC_CATEGORIES)) {
    for (const name of names) {
      if (rows.some((r) => r.parent_id === group && r.label_en === name)) continue;
      if (PROD_ONLY.has(name)) continue;
      missing.push(`${group} › ${name}`);
    }
  }
  assert.deepEqual(missing, [], 'a category the approved spec names is not live under its group');
});

test('2 · every merge landed whole — hidden, forwarded, emptied, and its events kept by the destination', async () => {
  assert.deepEqual({ ...MERGED_TILES }, SPEC_MERGES, 'MERGED_TILES (lib/taxonomy.ts) is not the spec’s list of merges');
  for (const [src, dest] of Object.entries(SPEC_MERGES)) {
    const c = (
      await db.query<{ hidden: boolean; fwd: string | null; types: string[] | null }>(
        `SELECT marketplace_hidden AS hidden, merged_into_category_id AS fwd, applicable_event_types AS types
           FROM public.service_categories WHERE id = $1`,
        [src],
      )
    ).rows[0];
    assert.ok(c, `${src}: the merged category was deleted — it must stay as a hidden forward`);
    assert.equal(c.hidden, true, `${src}: still visible after its merge`);
    assert.equal(c.fwd, dest, `${src}: does not forward to ${dest}`);
    const held = await db.query<{ n: number }>(
      `SELECT ((SELECT count(*) FROM public.canonical_service_taxonomy WHERE tile_id = $1)
             + (SELECT count(*) FROM public.event_vendors WHERE category_key = $1)
             + (SELECT count(*) FROM public.inspiration_parts WHERE home_category_id = $1)
             + (SELECT count(*) FROM public.onboarding_refinements WHERE tile_id = $1))::int AS n`,
      [src],
    );
    assert.equal(held.rows[0]!.n, 0, `${src}: still holds services, suppliers, parts or cards`);
    const d = (
      await db.query<{ hidden: boolean; types: string[] | null }>(
        `SELECT marketplace_hidden AS hidden, applicable_event_types AS types FROM public.service_categories WHERE id = $1`,
        [dest],
      )
    ).rows[0]!;
    assert.equal(d.hidden, false, `${dest}: the destination of ${src} is hidden`);
    if (d.types !== null) {
      assert.ok(c.types !== null, `${src} served every event; ${dest} no longer does`);
      for (const t of c.types!) assert.ok(d.types.includes(t), `${dest} lost the "${t}" events ${src} served`);
    }
  }
});

test('3 · nothing the spec hides (⛔) is still offered', async () => {
  const hidden = ['boudoir_shoot', 'garter', 'chuppah_rental', 'tarot_astrology', 'palmistry_reader'];
  const live = (
    await db.query<{ k: string }>(
      `SELECT canonical_service AS k FROM public.canonical_service_taxonomy
        WHERE canonical_service = ANY($1::text[]) AND NOT COALESCE(marketplace_hidden, FALSE) AND merged_into IS NULL`,
      [hidden],
    )
  ).rows.map((r) => r.k);
  assert.deepEqual(live, [], 'a service the approved spec hides is still offered');
  const tarot = await db.query<{ hidden: boolean }>(`SELECT marketplace_hidden AS hidden FROM public.service_categories WHERE id = 'tarot_astrology_palmistry'`);
  assert.equal(tarot.rows[0]?.hidden, true, 'the emptied Tarot category is still visible');
});

/**
 * Unit suite for the per-type persona packs (0053 Phase 3 follow-up).
 *
 * Invariants:
 *  - a type's `essentials` LEAD the plan, beating the wedding-shaped taxonomy
 *    sort order (a birthday no longer opens with Reception · Ceremony);
 *  - the resolved persona's `extras` differentiate the plan within the effort
 *    budget;
 *  - only categories present in `tiles` (applicable + active for the type) ever
 *    surface — non-applicable pack ids are silently dropped;
 *  - a packKey with no pack falls back to `deriveGenericPlan` byte-for-byte;
 *  - picks are unique taxonomy ids and labels align 1:1.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERSONA_PACKS, derivePackPlan } from './persona-packs';
import { deriveGenericPlan } from './generic-plan';
import type { OnboardingPickChip } from '@/lib/onboarding-refinements';

const PERSONA_KEYS = [
  'keepsake',
  'big_celebration',
  'best_of_both',
  'intimate_romance',
  'modern_statement',
  'rooted_tradition',
] as const;

const ENABLED_TYPES = [
  'birthday',
  'debut',
  'gender_reveal',
  'christening',
  'corporate',
  'tournament',
  'travel',
  'celebration',
] as const;

/** A representative tile set in the real WEDDING-shaped taxonomy sort order. */
const t = (cat: string, label: string): OnboardingPickChip => ({ cat, label, folder: '' });
const TILES: OnboardingPickChip[] = [
  t('reception', 'Reception'),
  t('ceremony_venue', 'Ceremony'),
  t('coordinator', 'Coordinator / Planner'),
  t('cake', 'Cake'),
  t('catering', 'Catering'),
  t('stylist_decorator', 'Stylist / Decorator'),
  t('florist', 'Florist'),
  t('lights_sound', 'Lights & Sound'),
  t('dance_floor', 'Dance Floor'),
  t('fireworks', 'Fireworks'),
  t('led_wall', 'LED Wall'),
  t('digital_services', 'Digital Services'),
  t('live_band', 'Live Band'),
  t('choir', 'Choir'),
  t('dj', 'DJ'),
  t('choreographer', 'Choreographer'),
  t('performers', 'Performers'),
  t('host_mc', 'Host / MC'),
  t('photo_video', 'Photo & Video'),
  t('editorial', 'Editorial'),
  t('livestream', 'Livestream'),
  t('filipiniana_barongs', 'Filipiniana & Barongs'),
  t('hmua', 'HMUA'),
  t('mobile_bar', 'Mobile Bar'),
  t('coffee_espresso', 'Coffee / Espresso'),
  t('food_truck', 'Food Truck'),
  t('dessert', 'Dessert'),
  t('food_cart', 'Food Cart'),
  t('photo_booth', 'Photo Booth'),
  t('souvenir_giveaways', 'Souvenir / Giveaways'),
  t('guest_shuttle', 'Guest Shuttle'),
  t('trophies_awards', 'Trophies & Awards'),
];

test('a type leads with its essentials, NOT the wedding-shaped taxonomy order', () => {
  const plan = derivePackPlan('birthday', null, TILES, 'simple'); // simple → essentials only
  assert.deepEqual(plan.picks, ['cake', 'catering', 'host_mc', 'photo_booth']);
  // The wedding-shaped lead (reception/ceremony) is gone for a birthday.
  assert.ok(!plan.picks.includes('reception'));
  assert.ok(!plan.picks.includes('ceremony_venue'));
});

test('the resolved persona differentiates the plan (same type, same effort)', () => {
  const grand = derivePackPlan('birthday', 'big_celebration', TILES, 'balanced');
  const keepsake = derivePackPlan('birthday', 'keepsake', TILES, 'balanced');
  // 4 essentials + 2 persona extras each (balanced = 6).
  assert.deepEqual(grand.picks, ['cake', 'catering', 'host_mc', 'photo_booth', 'dj', 'live_band']);
  assert.deepEqual(keepsake.picks, [
    'cake',
    'catering',
    'host_mc',
    'photo_booth',
    'photo_video',
    'editorial',
  ]);
  assert.notDeepEqual(grand.picks, keepsake.picks);
});

test('effort scales the plan size: simple=4, balanced=6, allout=9', () => {
  assert.equal(derivePackPlan('birthday', 'big_celebration', TILES, 'simple').picks.length, 4);
  assert.equal(derivePackPlan('birthday', 'big_celebration', TILES, 'balanced').picks.length, 6);
  assert.equal(derivePackPlan('birthday', 'big_celebration', TILES, 'allout').picks.length, 9);
});

test('allout pulls in the full persona extras list before taxonomy fill', () => {
  const plan = derivePackPlan('birthday', 'big_celebration', TILES, 'allout');
  // essentials(4) + big_celebration extras(dj,live_band,dance_floor,mobile_bar,lights_sound = 5) = 9.
  for (const id of ['dj', 'live_band', 'dance_floor', 'mobile_bar', 'lights_sound']) {
    assert.ok(plan.picks.includes(id), `expected ${id} in allout plan`);
  }
});

test('categories not present in tiles are dropped (never surfaced)', () => {
  const noFireworks = TILES.filter((c) => c.cat !== 'fireworks');
  const plan = derivePackPlan('gender_reveal', 'modern_statement', noFireworks, 'allout');
  assert.ok(!plan.picks.includes('fireworks'));
  // Still produces a full plan from the remaining applicable categories.
  assert.ok(plan.picks.length > 0);
});

test('a missing essential is skipped without crashing or leaving a hole', () => {
  const noCake = TILES.filter((c) => c.cat !== 'cake');
  const plan = derivePackPlan('birthday', null, noCake, 'simple');
  assert.ok(!plan.picks.includes('cake'));
  assert.equal(plan.picks.length, 4); // backfilled from taxonomy order
});

test('no pack for the key → falls back to deriveGenericPlan exactly', () => {
  for (const key of ['generic', 'anniversary', '', undefined, null]) {
    assert.deepEqual(
      derivePackPlan(key as string | null | undefined, 'keepsake', TILES, 'balanced'),
      deriveGenericPlan(TILES, 'balanced'),
    );
  }
});

test('an unknown persona key uses essentials + taxonomy fill (no extras)', () => {
  const plan = derivePackPlan('birthday', 'not_a_persona', TILES, 'simple');
  assert.deepEqual(plan.picks, ['cake', 'catering', 'host_mc', 'photo_booth']);
});

test('picks are unique and labels align 1:1 in order', () => {
  const plan = derivePackPlan('celebration', 'best_of_both', TILES, 'allout');
  assert.equal(new Set(plan.picks).size, plan.picks.length); // no dupes
  assert.equal(plan.picks.length, plan.labels.length);
  const byId = new Map(TILES.map((c) => [c.cat, c.label]));
  plan.picks.forEach((id, i) => assert.equal(plan.labels[i], byId.get(id)));
});

test('empty taxonomy → empty plan (no crash)', () => {
  assert.deepEqual(derivePackPlan('birthday', 'keepsake', [], 'balanced'), { picks: [], labels: [] });
});

test('every pack is structurally complete (6 personas, non-empty essentials)', () => {
  for (const [key, pack] of Object.entries(PERSONA_PACKS)) {
    assert.ok(ENABLED_TYPES.includes(key as (typeof ENABLED_TYPES)[number]), `unexpected pack key ${key}`);
    assert.ok(pack.essentials.length > 0, `${key} has no essentials`);
    for (const p of PERSONA_KEYS) {
      assert.ok(Array.isArray(pack.byPersona[p]), `${key} missing persona ${p}`);
    }
  }
  // Every enabled non-wedding type has a pack.
  for (const type of ENABLED_TYPES) {
    assert.ok(PERSONA_PACKS[type], `missing pack for ${type}`);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPLIER_PAGE_MIN_CARDS,
  SUPPLIER_PAGE_MIN_SHOPS,
  cardsForPage,
  cityKeyFor,
  eventKeyFromSlug,
  eventSlug,
  isIndexable,
  pagePath,
  priceSummaries,
  qualifyingPages,
  tileFromSlug,
  type LandingCard,
} from './supplier-landing';

let n = 0;
function card(p: Partial<LandingCard>): LandingCard {
  n += 1;
  return {
    serviceId: `svc-${n}`,
    shopId: 'shop-a',
    tile: 'coordinator',
    eventTypes: ['debut'],
    cityKey: 'quezon-city',
    pricingBasis: 'fixed',
    pricePhp: 50_000,
    ...p,
  };
}

// ── the gate ─────────────────────────────────────────────────────────────

test('the gate needs the minimum cards AND the minimum shops', () => {
  assert.equal(SUPPLIER_PAGE_MIN_CARDS, 3);
  assert.equal(SUPPLIER_PAGE_MIN_SHOPS, 2);
  // SABOTAGE: drop the shop half of the gate → this goes RED.
  const oneShop = [card({}), card({}), card({})];
  assert.equal(isIndexable(oneShop), false, "three cards from ONE shop is that shop's page, not a comparison");
  const twoShopsTwoCards = [card({}), card({ shopId: 'shop-b' })];
  assert.equal(isIndexable(twoShopsTwoCards), false);
  assert.equal(isIndexable([card({}), card({}), card({ shopId: 'shop-b' })]), true);
});

test('an empty page is never indexable', () => {
  assert.equal(isIndexable([]), false);
});

// ── filtering ────────────────────────────────────────────────────────────

test('a page takes only its own event, tile and city — nationwide ignores city', () => {
  const cards = [
    card({}),
    card({ eventTypes: ['wedding'] }),
    card({ tile: 'cake' }),
    card({ cityKey: 'manila' }),
    card({ cityKey: null }),
  ];
  assert.equal(cardsForPage(cards, { event: 'debut', tile: 'coordinator', city: 'quezon-city' }).length, 1);
  assert.equal(cardsForPage(cards, { event: 'debut', tile: 'coordinator', city: null }).length, 3);
});

test('qualifying pages: city AND nationwide pages, only where the tile serves the event', () => {
  const cards = [
    card({ shopId: 'a' }),
    card({ shopId: 'b' }),
    card({ shopId: 'c', cityKey: 'manila' }),
    // A funeral-home card a shop tagged "debut" must not mint a debut page.
    card({ shopId: 'a', tile: 'funeral_home' }),
    card({ shopId: 'b', tile: 'funeral_home' }),
    card({ shopId: 'c', tile: 'funeral_home' }),
  ];
  const pages = qualifyingPages(cards, (tile) => tile !== 'funeral_home');
  const keys = pages.map((p) => `${p.event}/${p.tile}/${p.city ?? '*'}`).sort();
  // QC has 2 cards (a, b) → below the card floor. Nationwide has 3 from 3 shops.
  assert.deepEqual(keys, ['debut/coordinator/*']);
});

// ── prices ───────────────────────────────────────────────────────────────

test('each pricing basis is summarised on its own — never one mixed range', () => {
  const cards = [
    card({ pricePhp: 40_000 }),
    card({ pricePhp: 90_000 }),
    card({ pricePhp: 60_000 }),
    card({ pricingBasis: 'per_pax', pricePhp: 650 }),
  ];
  const s = priceSummaries(cards);
  assert.equal(s.length, 2);
  assert.deepEqual(s[0], { basis: 'fixed', low: 40_000, high: 90_000, median: 60_000, count: 3 });
  assert.equal(s[1]!.basis, 'per_pax');
  // SABOTAGE: merge the bases → the fixed low becomes 650 → RED.
  assert.notEqual(s[0]!.low, 650);
});

test('a hidden or zero price contributes no figure', () => {
  const s = priceSummaries([card({ pricePhp: null }), card({ pricePhp: 0 }), card({ pricePhp: 75_000 })]);
  assert.deepEqual(s, [{ basis: 'fixed', low: 75_000, high: 75_000, median: 75_000, count: 1 }]);
  assert.deepEqual(priceSummaries([card({ pricePhp: null })]), []);
});

test('an even count takes the midpoint as the median', () => {
  const s = priceSummaries([card({ pricePhp: 10_000 }), card({ pricePhp: 20_000 })]);
  assert.equal(s[0]!.median, 15_000);
});

// ── cities + slugs ───────────────────────────────────────────────────────

test('a shop city resolves to the canonical key, and an unknown one to null', () => {
  assert.equal(cityKeyFor('Quezon City'), 'quezon-city');
  assert.equal(cityKeyFor('quezon city, Metro Manila'), 'quezon-city');
  assert.equal(cityKeyFor('Cebu'), 'cebu');
  assert.equal(cityKeyFor('Taguig'), 'taguig');
  // Never a guess: an unknown place counts toward nationwide only.
  assert.equal(cityKeyFor('Atlantis'), null);
  assert.equal(cityKeyFor(null), null);
  assert.equal(cityKeyFor(''), null);
});

test('slugs round-trip, and anything unknown is null (→ 404), never a fallback', () => {
  assert.equal(eventSlug('gender_reveal'), 'gender-reveal');
  assert.equal(eventKeyFromSlug('gender-reveal', ['wedding', 'gender_reveal']), 'gender_reveal');
  assert.equal(eventKeyFromSlug('nope', ['wedding']), null);
  assert.equal(tileFromSlug('funeral-homes', { funeral_home: 'funeral-homes' }), 'funeral_home');
  assert.equal(tileFromSlug('nope', { funeral_home: 'funeral-homes' }), null);
  assert.equal(
    pagePath({ event: 'gender_reveal', tile: 'funeral_home', city: 'quezon-city' }, { funeral_home: 'funeral-homes' }),
    '/suppliers/gender-reveal/funeral-homes/quezon-city',
  );
  assert.equal(pagePath({ event: 'debut', tile: 'cake', city: null }, { cake: 'cake' }), '/suppliers/debut/cake');
});

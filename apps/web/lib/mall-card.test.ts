/**
 * 🃏 CARD 14, THE MALL CARD — its two new facts, and that it is drawn by the ONE face on Find and Discover.
 *
 * Owner, 20 Nov 2026 (DECISION_LOG "CARD 14 v4 APPROVED"): *"card 14 approved"*, then *"straight line, about X km"* and
 * *"Do it"*. The guest-count price: *"Adapt the price to the estimated pax … if it is greater"*.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  aboutKmLine,
  guestCountTotal,
  mallPrice,
  nearestKm,
  perGuestPriceOf,
  pinOf,
  SET_YOUR_VENUE_LINE,
} from '@/lib/mall-card';

const WEB = join(import.meta.dirname, '..');
const src = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

test('per-guest: the total shows only ABOVE the minimum (the drawing: ₱850 × 120 = ₱102,000)', () => {
  const per = { pricePhp: 850, minPax: 50 };
  assert.equal(guestCountTotal(per, 120), 102_000);
  assert.equal(guestCountTotal(per, 50), null, 'at the minimum the card keeps its per-guest price');
  assert.equal(guestCountTotal(per, 30), null);
  assert.equal(guestCountTotal(per, null), null, 'no guest count → no total, never a guess');
  assert.equal(guestCountTotal(per, 0), null);
  assert.equal(guestCountTotal(per, 12.5), null);
  assert.equal(guestCountTotal(null, 120), null, 'a flat price never changes');
  assert.equal(guestCountTotal({ pricePhp: 850, minPax: null }, 120), 102_000, 'no minimum → any real count');
});

test('the price band says what the drawing says', () => {
  const big = mallPrice({ perGuest: { pricePhp: 850, minPax: 50 }, guests: 120, price: 'from ₱42,500', priceNote: null });
  assert.equal(big?.big, '₱102,000');
  assert.equal(big?.you, 'for your 120 guests');
  assert.equal(big?.note, '₱850 / guest');

  const under = mallPrice({ perGuest: { pricePhp: 650, minPax: 150 }, guests: 120, price: 'from ₱97,500', priceNote: null });
  assert.deepEqual(under, { big: '₱650 / guest', you: null, note: 'min 150 guests' });

  const flat = mallPrice({ perGuest: null, guests: 120, price: 'from ₱45,999', priceNote: null });
  assert.deepEqual(flat, { big: 'from ₱45,999', you: null, note: null }, 'flat prices never change');

  assert.equal(mallPrice({ perGuest: null, guests: 120, price: null, priceNote: null }), null, 'no price → no band, never ₱0');
});

test('perGuestPriceOf reads only the card’s own per-guest columns, and never through a hidden price', () => {
  assert.deepEqual(perGuestPriceOf({ pricing_basis: 'per_pax', per_pax_price_php: 850, min_pax: 50 }, false), { pricePhp: 850, minPax: 50 });
  assert.equal(perGuestPriceOf({ pricing_basis: 'per_pax', per_pax_price_php: 850, min_pax: 50 }, true), null);
  assert.equal(perGuestPriceOf({ pricing_basis: 'fixed', per_pax_price_php: 850 }, false), null);
  assert.equal(perGuestPriceOf({ pricing_basis: 'per_pax', per_pax_price_php: 0 }, false), null);
  assert.equal(perGuestPriceOf({ pricing_basis: 'per_pax', per_pax_price_php: 300, category: 'crew_meals' }, false), null);
});

test('distance: straight line from the NEAREST place; never "0 km"; nothing when a side is missing', () => {
  const venue = { lat: 14.5995, lng: 120.9842 }; // Manila
  const qc = { lat: 14.676, lng: 121.0437 }; // Quezon City, ~10 km
  const cebu = { lat: 10.3157, lng: 123.8854 };
  const km = nearestKm(venue, [cebu, qc, null]);
  assert.ok(km != null && km > 8 && km < 13, `nearest should be QC, got ${km}`);
  assert.equal(nearestKm(null, [qc]), null);
  assert.equal(nearestKm(venue, [null, undefined]), null);
  assert.match(aboutKmLine(km)!, /^about \d+ km from your venue$/);
  assert.equal(aboutKmLine(0), 'under 1 km from your venue');
  assert.equal(aboutKmLine(0.4), 'under 1 km from your venue');
  assert.equal(aboutKmLine(null), null);
  assert.doesNotMatch(aboutKmLine(0)!, /\b0 km/);
  assert.equal(pinOf(null, 121), null);
  assert.deepEqual(pinOf('14.5', '121'), { lat: 14.5, lng: 121 });
  assert.equal(SET_YOUR_VENUE_LINE, 'Set your venue to see distance');
});

test('the one haversine: mall-card reuses lib/geo, it does not carry its own', () => {
  const s = src('lib/mall-card.ts');
  assert.match(s, /import \{ haversineKm \} from '@\/lib\/geo'/);
  assert.doesNotMatch(s, /Math\.asin|Math\.atan2/, 'a second haversine crept in');
  assert.doesNotMatch(s, /maps\.googleapis|mapbox|distancematrix|routing/i, 'no paid map / routing service');
});

test('card 14 is drawn by the one face on Find (bench + to compare) and on Discover', () => {
  const face = src('app/_components/service-face.tsx');
  assert.match(face, /export function MallFaceBody\(/);
  assert.match(face, /layout === 'mall'[\s\S]{0,600}<MallFaceBody/, 'ServiceFace layout="mall" no longer draws the mall body');
  assert.match(face, /Verified shop/, 'the Verified pill left the photo');

  const find = src('app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx');
  assert.match(find, /look\.face \? \(\s*<MallFaceBody/, 'the Find bench card stopped wearing the mall face');
  const more = find.slice(find.indexOf('function InlineMoreCard('), find.indexOf('\nfunction ', find.indexOf('function InlineMoreCard(') + 10));
  assert.match(more, /layout="mall"/, 'the "to compare" card stopped wearing the mall face');
  assert.match(find, /\.slcat \.fold\.flat \.rail\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/, 'Find is not two across');
  assert.match(find, /@container \(min-width:900px\)\{\.slcat \.fold\.flat \.rail\{grid-template-columns:repeat\(4,/, 'Find desktop is not four across');

  const faces = src('lib/marketplace-service-card-faces.ts');
  assert.match(faces, /mall: \{/, 'Discover faces no longer carry the mall card');
  const view = src('app/_components/service-card-view.tsx');
  assert.match(view, /layout: 'mall' as const/);
  const explore = src('app/(shell)/explore/_lib/marketplace-view.tsx');
  assert.match(explore, /grid grid-cols-2[^"]*lg:grid-cols-4[^"]*" data-search-results="" data-mall-grid=""/, 'explore is not 2 / 4 across');
});

test('the buttons: main verb, then seats, then More on a phone', () => {
  const actions = src('app/dashboard/[eventId]/vendors/_components/bench-vendor-actions.tsx');
  assert.match(actions, /const seatMore = drawn\.length >= 4;/);
  assert.match(actions, /label="More"/);
  assert.match(actions, /className="vmore-rest"/);
});

test('Save sits on the Discover photo (the shipped SaveVendorButton), never in Find', () => {
  const explore = src('app/(shell)/explore/_lib/marketplace-view.tsx');
  assert.match(explore, /save: c\.bookable \? \(\s*<SaveVendorButton[\s\S]{0,400}onPhoto=\{MALL_SAVE_ON_PHOTO\}/);
  assert.match(explore, /initiallySaved=\{savedOnEvent\?\.has\(c\.vendorProfileId\) === true\}/);
  assert.match(src('lib/mall-card.ts'), /h-11 w-11/, 'the Save press is not 44 px');
  const face = src('app/_components/service-face.tsx');
  assert.match(face, /data-mall-cover-action=""/);
  const find = src('app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx');
  assert.doesNotMatch(find, /SaveVendorButton|coverAction/, 'Save leaked into Find');
});


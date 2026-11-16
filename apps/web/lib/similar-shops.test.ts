/**
 * 🔒 THE SIMILAR-SHOPS RULE, EXECUTED (owner 2026-11-14, DECISION_LOG "A SHOP PAGE ENDS WITH ITS PARTNERS, THEN
 * SIMILAR SHOPS NEARBY — APPROVED AS DRAWN"; prototype `shop_page_end_2026-11-14_fable.html` § "How the row picks
 * shops"). Each test names the line of the drawing it holds.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SIMILAR_SHOPS_MAX,
  kindInSentence,
  kmBetween,
  pickSimilarShops,
  similarShopsHeading,
  similarShopsSeeAllHref,
  type SimilarCandidate,
} from './similar-shops';

// Quezon City, San Juan, Cebu City — real pins, so "nearest" is measured, not asserted.
const QC = { latitude: 14.676, longitude: 121.0437 };
const SAN_JUAN = { latitude: 14.6019, longitude: 121.0355 };
const CEBU = { latitude: 10.3157, longitude: 123.8854 };

const shop = (id: string, over: Partial<SimilarCandidate> = {}): SimilarCandidate => ({
  vendorProfileId: id,
  city: 'Quezon City',
  latitude: QC.latitude,
  longitude: QC.longitude,
  verified: false,
  name: id,
  ...over,
});
const self = { vendorProfileId: 'self', city: 'Quezon City', ...QC };
const ids = (r: { shops: SimilarCandidate[] }) => r.shops.map((s) => s.vendorProfileId);

test('"Four at most"', () => {
  assert.equal(SIMILAR_SHOPS_MAX, 4);
  const many = Array.from({ length: 9 }, (_, i) => shop(`s${i}`));
  assert.equal(pickSimilarShops(many, self, []).shops.length, 4);
});

test('"It never repeats this shop or any shop already listed under Trusted by"', () => {
  const r = pickSimilarShops([shop('self'), shop('partner'), shop('a'), shop('a')], self, ['partner']);
  assert.deepEqual(ids(r), ['a'], 'this shop, a Trusted-by shop and a duplicate row are all left out');
});

test('"Same area" first — a nearby shop outranks a verified one elsewhere', () => {
  const r = pickSimilarShops(
    [shop('cebu-verified', { city: 'Cebu City', ...CEBU, verified: true }), shop('qc')],
    self,
    [],
  );
  assert.deepEqual(ids(r), ['qc', 'cebu-verified']);
});

test('"Verified shops first, then the nearest" — inside the area', () => {
  const r = pickSimilarShops(
    [
      shop('near-unverified', { ...QC }),
      shop('far-verified', { latitude: 14.7, longitude: 121.1, verified: true }),
      shop('mid-unverified', { latitude: 14.69, longitude: 121.06 }),
      shop('no-pin', { latitude: null, longitude: null }),
    ],
    self,
    [],
  );
  assert.deepEqual(ids(r), ['far-verified', 'near-unverified', 'mid-unverified', 'no-pin'], 'a shop with no pin sorts last');
});

test('the area is the city, case and spaces aside — no radius is invented', () => {
  const r = pickSimilarShops([shop('a', { city: '  quezon city ' })], self, []);
  assert.equal(r.near, true);
});

test('"Too few nearby: it widens … and the heading drops the area" — near only when EVERY card is in it', () => {
  const two = pickSimilarShops([shop('a'), shop('b'), shop('sj', { city: 'San Juan', ...SAN_JUAN })], self, []);
  assert.deepEqual(ids(two), ['a', 'b', 'sj'], 'nearby ones first, then the wider pool fills the row');
  assert.equal(two.near, false, 'a San Juan card must not sit under "near Quezon City"');
  assert.equal(similarShopsHeading('Lights & Sound', 'Quezon City', two.near), 'More lights & sound');

  const full = pickSimilarShops([shop('a'), shop('b'), shop('c'), shop('d'), shop('sj', { city: 'San Juan', ...SAN_JUAN })], self, []);
  assert.equal(full.near, true, 'four nearby fill the row; the wider one is not needed');
  assert.equal(similarShopsHeading('Lights & Sound', 'Quezon City', full.near), 'More lights & sound near Quezon City');
});

test('a shop with no city never claims an area', () => {
  const r = pickSimilarShops([shop('a', { city: null })], { ...self, city: null }, []);
  assert.equal(r.near, false);
  assert.equal(similarShopsHeading('Florist', null, true), 'More florist');
});

test('"None at all: the section is not drawn" — the pick is empty', () => {
  assert.deepEqual(pickSimilarShops([], self, []), { shops: [], near: false });
  assert.deepEqual(pickSimilarShops([shop('self')], self, []), { shops: [], near: false });
});

test('the kind of work reads inside a sentence; an acronym stays one', () => {
  assert.equal(kindInSentence('Lights & Sound'), 'lights & sound');
  assert.equal(kindInSentence('Bridal HMUA'), 'bridal HMUA');
  assert.equal(kindInSentence('DJ'), 'DJ');
});

test('"See all ›" opens Discover\'s supplier view filtered to this kind of work', () => {
  assert.equal(similarShopsSeeAllHref('lights_sound'), '/?category=lights_sound');
});

test('distance is measured from the two pins; a missing pin is unknown, never 0', () => {
  const km = kmBetween(QC, SAN_JUAN)!;
  assert.ok(km > 7 && km < 10, `QC → San Juan is ~8 km, got ${km}`);
  assert.equal(kmBetween(QC, { latitude: null, longitude: null }), null);
});

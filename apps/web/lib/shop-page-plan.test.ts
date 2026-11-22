import test from 'node:test';
import assert from 'node:assert/strict';

import { ownWebAddress, pinnedQuote, shopHasWhere, shopReach, shopReachLine } from '@/lib/shop-page-plan';
import { TIER_CAPS } from '@/lib/vendor-tier-caps';
import { micrositeCan } from '@/lib/vendor-microsite';

/** Supplier website by plan (owner-approved 2026-10-30) — the card column's plan pieces, read off the shipped caps. */

test('reach is the shop’s own, never the plan’s (owner 2026-11-19, "unlock the range")', () => {
  // A verified shop with no ring of its own serves nationwide — on any plan; there is no plan input at all.
  assert.deepEqual(shopReach({ verified: true, declaredOuterKm: null }), { kind: 'nationwide' });
  assert.equal(shopReachLine({ kind: 'nationwide' }, 'Tagaytay'), 'Tagaytay · serves nationwide');
  // Its own ring is believed whole — 200 km is not clamped to any plan.
  assert.deepEqual(shopReach({ verified: true, declaredOuterKm: 200 }), { kind: 'ring', km: 200 });
  assert.deepEqual(shopReach({ verified: true, declaredOuterKm: 15 }), { kind: 'ring', km: 15 });
});

test('an unverified shop reaches 0 km and the line says why (owner 2026-10-29 · 2026-11-19)', () => {
  const r = shopReach({ verified: false, declaredOuterKm: 50 });
  assert.equal(r.kind, 'until_verified');
  assert.equal(shopReachLine(r, 'Tagaytay'), 'Tagaytay · distance search opens once verified');
});

test('verified with no ring says the city only — never "0 km"', () => {
  // A verified shop always reaches some distance, so "no ring" is a shop that declared 0.
  const r = shopReach({ verified: true, declaredOuterKm: 0 });
  assert.equal(r.kind, 'city_only');
  assert.equal(shopReachLine(r, ' Tagaytay '), 'Tagaytay');
  assert.equal(shopReachLine(r, null), null);
  assert.equal(shopReachLine({ kind: 'ring', km: 20 }, 'Tagaytay'), 'Serves up to 20 km around Tagaytay');
});

test('the own web address shows for a verified domain only — on EVERY plan since 2026-11-19 ("shop page also is 1 for all")', () => {
  assert.equal(ownWebAddress({ planAllows: true, domain: 'SampaguitaTable.com', verifiedAt: '2026-10-01' }), 'sampaguitatable.com');
  assert.equal(ownWebAddress({ planAllows: true, domain: 'https://shop.example.ph/', verifiedAt: '2026-10-01' }), 'shop.example.ph');
  assert.equal(ownWebAddress({ planAllows: true, domain: 'sampaguitatable.com', verifiedAt: null }), null);
  assert.equal(ownWebAddress({ planAllows: false, domain: 'sampaguitatable.com', verifiedAt: '2026-10-01' }), null);
  assert.equal(ownWebAddress({ planAllows: true, domain: 'not a domain', verifiedAt: '2026-10-01' }), null);
  // The same shop page on every plan (owner 2026-11-19, the best one): the own address and the Pro page parts for all.
  for (const t of ['free', 'verified', 'solo', 'pro', 'enterprise'] as const) {
    assert.equal(TIER_CAPS[t].customWebsiteName, true, `${t} · own web address`);
    assert.equal(TIER_CAPS[t].premiumPage, true, `${t} · Pro page parts`);
    assert.equal(TIER_CAPS[t].website, 'custom', `${t} · page`);
  }
});

test('the pinned quote keeps whole words and never invents text', () => {
  assert.equal(pinnedQuote('  Plated   service ran on time. '), 'Plated service ran on time.');
  assert.equal(pinnedQuote(''), null);
  assert.equal(pinnedQuote(null), null);
  const long = pinnedQuote('word '.repeat(80), 60)!;
  assert.ok(long.endsWith('…') && long.length <= 61, long);
  assert.ok(!/\s…$/.test(long));
});

test('a shop with no pin, no address and no city has no "Where" (re-walk 2026-11-14: the tab led to an empty heading)', () => {
  const none = { latitude: null, longitude: null, address: null, city: null };
  assert.equal(shopHasWhere(none), false);
  assert.equal(shopHasWhere({ ...none, address: '   ', city: '' }), false, 'blank words are not a place');
  assert.equal(shopHasWhere({ ...none, latitude: 14.1, longitude: null }), false, 'half a pin is no pin');
  assert.equal(shopHasWhere({ ...none, latitude: 14.1, longitude: 120.9 }), true, 'a pin draws the map');
  assert.equal(shopHasWhere({ ...none, address: '12 Rizal St' }), true, 'an address gets the search');
  assert.equal(shopHasWhere({ ...none, city: 'Tagaytay' }), true, 'a city gets the reach line and the search');
});

test('ONE SHOP PAGE FOR EVERY PLAN — personalising, the Pro parts and the Films layer (owner ruled 2026-11-19)', () => {
  // "shop page also is 1 for all already" + §C item 5, "Films layer opens to every plan".
  for (const t of ['free', 'verified', 'solo', 'pro', 'enterprise', null] as const) {
    assert.deepEqual(micrositeCan(t), { canPersonalize: true, canPremium: true, isEnterprise: true }, String(t));
  }
});

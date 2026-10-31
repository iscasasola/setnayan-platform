import test from 'node:test';
import assert from 'node:assert/strict';

import { ownWebAddress, pinnedQuote, shopReach, shopReachLine } from '@/lib/shop-page-plan';
import { TIER_CAPS } from '@/lib/vendor-tier-caps';

/** Supplier website by plan (owner-approved 2026-10-30) — the card column's plan pieces, read off the shipped caps. */

test('reach follows the plan caps — never a second copy of them', () => {
  for (const tier of ['verified', 'solo', 'pro', 'enterprise'] as const) {
    const r = shopReach({ verified: true, tier, declaredOuterKm: null });
    assert.deepEqual(r, { kind: 'ring', km: TIER_CAPS[tier].serviceRadiusKm }, tier);
  }
  // The approved table's numbers, as the caps say them today (20 · 30 · 50 · 100).
  assert.deepEqual(
    (['verified', 'solo', 'pro', 'enterprise'] as const).map((t) => TIER_CAPS[t].serviceRadiusKm),
    [20, 30, 50, 100],
  );
});

test('a narrower declared ring wins; a wider one is clamped to the plan', () => {
  assert.deepEqual(shopReach({ verified: true, tier: 'pro', declaredOuterKm: 15 }), { kind: 'ring', km: 15 });
  assert.deepEqual(shopReach({ verified: true, tier: 'verified', declaredOuterKm: 80 }), { kind: 'ring', km: 20 });
});

test('an unverified shop reaches 0 km and the line says why (owner 2026-10-29)', () => {
  const r = shopReach({ verified: false, tier: 'pro', declaredOuterKm: 50 });
  assert.equal(r.kind, 'until_verified');
  assert.equal(shopReachLine(r, 'Tagaytay'), 'Tagaytay · distance search opens once verified');
});

test('verified with no ring says the city only — never "0 km"', () => {
  const r = shopReach({ verified: true, tier: 'free', declaredOuterKm: null });
  assert.equal(r.kind, 'city_only');
  assert.equal(shopReachLine(r, ' Tagaytay '), 'Tagaytay');
  assert.equal(shopReachLine(r, null), null);
  assert.equal(shopReachLine({ kind: 'ring', km: 20 }, 'Tagaytay'), 'Serves up to 20 km around Tagaytay');
});

test('the own web address shows on Pro+ for a verified domain only', () => {
  assert.equal(ownWebAddress({ planAllows: true, domain: 'SampaguitaTable.com', verifiedAt: '2026-10-01' }), 'sampaguitatable.com');
  assert.equal(ownWebAddress({ planAllows: true, domain: 'https://shop.example.ph/', verifiedAt: '2026-10-01' }), 'shop.example.ph');
  assert.equal(ownWebAddress({ planAllows: true, domain: 'sampaguitatable.com', verifiedAt: null }), null);
  assert.equal(ownWebAddress({ planAllows: false, domain: 'sampaguitatable.com', verifiedAt: '2026-10-01' }), null);
  assert.equal(ownWebAddress({ planAllows: true, domain: 'not a domain', verifiedAt: '2026-10-01' }), null);
  assert.equal(TIER_CAPS.pro.customWebsiteName && TIER_CAPS.enterprise.customWebsiteName, true);
  assert.equal(TIER_CAPS.solo.customWebsiteName || TIER_CAPS.verified.customWebsiteName || TIER_CAPS.free.customWebsiteName, false);
});

test('the pinned quote keeps whole words and never invents text', () => {
  assert.equal(pinnedQuote('  Plated   service ran on time. '), 'Plated service ran on time.');
  assert.equal(pinnedQuote(''), null);
  assert.equal(pinnedQuote(null), null);
  const long = pinnedQuote('word '.repeat(80), 60)!;
  assert.ok(long.endsWith('…') && long.length <= 61, long);
  assert.ok(!/\s…$/.test(long));
});

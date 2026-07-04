/**
 * Effective-caps overlay for the Custom tier. Verifies the pure overlay raises
 * only the composed numeric axes on `custom`, and is a no-op for every other
 * tier. Run with `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vendorEffectiveCaps } from './vendor-effective-caps';
import { tierCaps } from './vendor-tier-caps';
import type { CustomComposition } from './vendor-custom-pricing';

const COMP: CustomComposition = {
  branches: 5,
  reachKm: 300,
  nationwide: false,
  seats: 15,
  slotsPerCategory: 12,
  photos: 800,
  tokensPerCycle: 100,
  domain: true,
};

test('non-custom tiers: overlay is a no-op (returns base caps)', () => {
  for (const t of ['free', 'verified', 'solo', 'pro', 'enterprise'] as const) {
    assert.deepEqual(vendorEffectiveCaps(t, COMP), tierCaps(t));
  }
});

test('custom with no plan: returns the Enterprise-clone base caps', () => {
  assert.deepEqual(vendorEffectiveCaps('custom', null), tierCaps('custom'));
});

test('custom overlay raises seats / reach / slots / photos', () => {
  const caps = vendorEffectiveCaps('custom', COMP);
  assert.equal(caps.agentAccounts, 15); // max(10, 15)
  assert.equal(caps.serviceRadiusKm, 300); // composed km
  assert.equal(caps.slotsPerDay, 12);
  assert.equal(caps.portfolioPhotos, 800);
});

test('custom nationwide → Infinity reach', () => {
  const caps = vendorEffectiveCaps('custom', { ...COMP, nationwide: true });
  assert.equal(caps.serviceRadiusKm, Infinity);
});

test('custom overlay never lowers a base axis below the Enterprise clone', () => {
  const caps = vendorEffectiveCaps('custom', {
    ...COMP,
    seats: 2,
    reachKm: 10,
    slotsPerCategory: 1,
    photos: 50,
  });
  const base = tierCaps('custom');
  assert.equal(caps.agentAccounts, base.agentAccounts); // 10, not 2
  assert.equal(caps.serviceRadiusKm, base.serviceRadiusKm); // 100, not 10
  assert.equal(caps.slotsPerDay, base.slotsPerDay); // 8, not 1
  assert.equal(caps.portfolioPhotos, base.portfolioPhotos); // 300, not 50
});

test('custom overlay leaves feature/boolean axes identical to the clone', () => {
  const caps = vendorEffectiveCaps('custom', COMP);
  const base = tierCaps('custom');
  assert.equal(caps.marketIntel, base.marketIntel);
  assert.equal(caps.nameMode, base.nameMode);
  assert.equal(caps.customWebsiteName, base.customWebsiteName);
  assert.equal(caps.parentCategories, base.parentCategories);
});

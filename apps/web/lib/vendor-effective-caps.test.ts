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

// ── "2500 for no limit" (owner 2026-08-29) ───────────────────────────────────

test('the no-limit axis removes the customers-per-date ceiling', () => {
  const caps = vendorEffectiveCaps('custom', { ...COMP, pipelineUnlimited: true });
  assert.equal(caps.whitelistPerDate, Infinity);
});

test('WITHOUT it, a Custom shop keeps the Enterprise ceiling of 10', () => {
  // The control. Without this the test above passes whether or not the axis is
  // read — `whitelistPerDate` would be 10 either way if the overlay were wrong
  // in the other direction.
  assert.equal(vendorEffectiveCaps('custom', COMP).whitelistPerDate, 10);
  assert.equal(vendorEffectiveCaps('custom', null).whitelistPerDate, 10);
});

test('a composition predating the axis reads as NOT granted, not as undefined', () => {
  // `pipelineUnlimited` is optional, so an older stored composition simply has
  // no key. It must fail CLOSED — the overlay tests `=== true`, never truthiness.
  const legacy = { ...COMP } as CustomComposition;
  assert.equal('pipelineUnlimited' in legacy, false, 'the fixture must really lack the key');
  assert.equal(vendorEffectiveCaps('custom', legacy).whitelistPerDate, 10);
});

test('the axis lifts the booked-out waitlist TOO — one axis, both ceilings', () => {
  // ⚠ INVERTED HOURS AFTER IT WAS WRITTEN, BY THE OWNER. It read "the axis NEVER
  // lifts the booked-out waitlist — a different list", which was the correct and
  // deliberate scope: he had been asked about the 10 customers chased per date
  // and had answered about the 10, so the waitlist was named to him as a
  // separate list rather than assumed into the same purchase. He then ruled:
  // **"yes wait list add them"**. Inverted rather than deleted — it is still
  // what proves the scope is what he said, now in the other direction.
  const caps = vendorEffectiveCaps('custom', { ...COMP, pipelineUnlimited: true });
  assert.equal(caps.waitlistAcceptances, Infinity);
});

test('WITHOUT the axis the waitlist ceiling is untouched', () => {
  // The control: the test above must pass because of the AXIS, not because the
  // overlay returns Infinity for everybody.
  assert.equal(vendorEffectiveCaps('custom', COMP).waitlistAcceptances, 5);
  assert.equal(vendorEffectiveCaps('custom', null).waitlistAcceptances, 5);
});

test('a NON-custom tier cannot get it, even if the flag is somehow stored', () => {
  // Only the custom tier reads a composition at all; this pins that a stray
  // flag on a Pro shop's row can never widen anything.
  for (const t of ['free', 'verified', 'solo', 'pro', 'enterprise'] as const) {
    assert.equal(
      vendorEffectiveCaps(t, { ...COMP, pipelineUnlimited: true }).whitelistPerDate,
      tierCaps(t).whitelistPerDate,
    );
    assert.equal(
      vendorEffectiveCaps(t, { ...COMP, pipelineUnlimited: true }).waitlistAcceptances,
      tierCaps(t).waitlistAcceptances,
    );
  }
});

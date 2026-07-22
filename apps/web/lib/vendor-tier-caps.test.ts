/**
 * Vendor tier CALLS capability (Node built-in test runner via tsx —
 * `pnpm test:unit`).
 *
 * Locks the 2026-07-13 owner decision ("a service for the paid"): in-thread
 * voice/video calling is unlocked for any PAID plan (Solo+), NOT for Free or
 * the legacy Verified tier. The gate that reads this (resolveThreadCallsEnabled)
 * is flag-dark, but the capability matrix itself must always be correct.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canUseCalls,
  canSeeMarketIntel,
  isTrueNameTier,
  TIER_CAPS,
  VENDOR_TIERS,
  type VendorTier,
} from './vendor-tier-caps';

const PAID_TIERS: VendorTier[] = ['solo', 'pro', 'enterprise', 'custom'];
const UNPAID_TIERS: VendorTier[] = ['free', 'verified'];

test('calls: paid tiers (Solo+) can use calls', () => {
  for (const tier of PAID_TIERS) {
    assert.equal(canUseCalls(tier), true, `${tier} should allow calls`);
    assert.equal(TIER_CAPS[tier].calls, true, `${tier}.calls cap should be true`);
  }
});

test('calls: Free and legacy Verified cannot use calls', () => {
  for (const tier of UNPAID_TIERS) {
    assert.equal(canUseCalls(tier), false, `${tier} should NOT allow calls`);
    assert.equal(TIER_CAPS[tier].calls, false, `${tier}.calls cap should be false`);
  }
});

test('calls: unknown / null / undefined tier defaults to no calls (free)', () => {
  assert.equal(canUseCalls(null), false);
  assert.equal(canUseCalls(undefined), false);
  assert.equal(canUseCalls('gibberish'), false);
});

test('calls: every tier in the matrix declares the calls cap (completeness)', () => {
  for (const tier of VENDOR_TIERS) {
    assert.equal(
      typeof TIER_CAPS[tier].calls,
      'boolean',
      `${tier} must declare a boolean calls cap`,
    );
  }
});

// ── Subscription-ladder contents (Vendor_Subscription_Ladder_2026-07-22 §1/§4) ──
// Locks the tier CONTENTS — categories, agent seats, reach/radius, market intel —
// against the owner-locked ladder so a future edit can't silently drift the caps
// away from what's marketed. Prices are NOT asserted here (they live in the live
// vendor_billing_catalog; TIER_PRICE_PHP is only a fallback).

test('ladder · Free: 1 category, local reach, no market intel, no agent seats', () => {
  const c = TIER_CAPS.free;
  assert.equal(c.parentCategories, 1, 'Free lists under exactly 1 category');
  assert.equal(c.serviceRadiusKm, 0, 'Free reach is local (0 km — no expanded reach)');
  assert.equal(c.marketIntel, false, 'Free has no Market Intel');
  assert.equal(canSeeMarketIntel('free'), false);
  assert.equal(c.agentAccounts, 0, 'Free has no agent seats');
});

test('ladder · Solo: expanded reach + analytics, still no Market Intel', () => {
  const c = TIER_CAPS.solo;
  assert.ok(c.serviceRadiusKm > 0, 'Solo unlocks reach beyond local');
  assert.equal(c.performanceTrends, true, 'Solo gets business-performance analytics');
  assert.equal(c.marketIntel, false, 'Solo does NOT get Market Intel (Pro+ only)');
  assert.equal(canSeeMarketIntel('solo'), false);
});

test('ladder · Pro: Market Intel + up to 3 seats + expanded reach', () => {
  const c = TIER_CAPS.pro;
  assert.equal(c.marketIntel, true, 'Pro gets Market Intel (Demand Radar + Price-Position)');
  assert.equal(canSeeMarketIntel('pro'), true);
  assert.equal(c.agentAccounts, 3, 'Pro = up to 3 agent seats');
  assert.ok(
    c.serviceRadiusKm > TIER_CAPS.solo.serviceRadiusKm,
    'Pro reach is wider than Solo',
  );
});

test('ladder · Enterprise: up to 10 seats + 100 km reach + unlimited categories', () => {
  const c = TIER_CAPS.enterprise;
  assert.equal(c.agentAccounts, 10, 'Enterprise = up to 10 team seats');
  assert.equal(c.serviceRadiusKm, 100, 'Enterprise = 100 km reach');
  assert.equal(c.parentCategories, Infinity, 'Enterprise = unlimited categories');
  assert.equal(c.marketIntel, true, 'Enterprise keeps Market Intel');
});

test('ladder · Custom: unlimited, runs as Enterprise-or-better on every axis', () => {
  const c = TIER_CAPS.custom;
  const e = TIER_CAPS.enterprise;
  assert.equal(c.parentCategories, Infinity, 'Custom = unlimited categories');
  assert.equal(c.servicesPerLeaf, Infinity, 'Custom = unlimited service listings');
  assert.ok(c.agentAccounts >= e.agentAccounts, 'Custom seats >= Enterprise');
  assert.ok(c.serviceRadiusKm >= e.serviceRadiusKm, 'Custom reach >= Enterprise');
  assert.equal(c.marketIntel, true, 'Custom keeps Market Intel');
});

test('ladder · reach is monotonic Free ≤ Solo ≤ Pro ≤ Enterprise', () => {
  const { free, solo, pro, enterprise } = TIER_CAPS;
  assert.ok(free.serviceRadiusKm <= solo.serviceRadiusKm);
  assert.ok(solo.serviceRadiusKm <= pro.serviceRadiusKm);
  assert.ok(pro.serviceRadiusKm <= enterprise.serviceRadiusKm);
});

test('ladder · agent seats are monotonic Free ≤ Solo ≤ Pro ≤ Enterprise', () => {
  const { free, solo, pro, enterprise } = TIER_CAPS;
  assert.ok(free.agentAccounts <= solo.agentAccounts);
  assert.ok(solo.agentAccounts <= pro.agentAccounts);
  assert.ok(pro.agentAccounts <= enterprise.agentAccounts);
});

test('ladder · Market Intel unlocks at Pro and never below', () => {
  assert.equal(canSeeMarketIntel('free'), false);
  assert.equal(canSeeMarketIntel('verified'), false);
  assert.equal(canSeeMarketIntel('solo'), false);
  assert.equal(canSeeMarketIntel('pro'), true);
  assert.equal(canSeeMarketIntel('enterprise'), true);
  assert.equal(canSeeMarketIntel('custom'), true);
});

// ── "Open it up" — name is NEVER gated (Vendor_Subscription_Ladder_2026-07-22 §3) ──
// The name paywall is retired: the legacy Verified tier NO LONGER anonymizes
// (was nameMode 'screen'). Every couple-facing/paid tier shows the real business
// name day-1. `free` keeps nameMode 'hidden' as the conservative default for a
// truly-unverified vendor — the actual reveal for a verified free-plan vendor
// comes from `is_verified` (verification_state='verified') at the resolver, not
// from the tier (see lib/vendors.test.ts), so unverified vendors are never
// over-exposed even where a surface's query isn't verification-gated.

test('name paywall removed: legacy Verified tier reveals the real name day-1', () => {
  assert.equal(
    TIER_CAPS.verified.nameMode,
    'true',
    "Verified must no longer anonymize (was 'screen' — the name paywall)",
  );
  assert.equal(isTrueNameTier('verified'), true);
});

test('every PAID tier reveals the real name day-1 (Solo/Pro/Enterprise/Custom)', () => {
  for (const tier of ['solo', 'pro', 'enterprise', 'custom'] as const) {
    assert.equal(TIER_CAPS[tier].nameMode, 'true', `${tier} shows the real name day-1`);
    assert.equal(isTrueNameTier(tier), true);
  }
});

test('free tier stays hidden by tier (conservative default; reveal comes from verification)', () => {
  assert.equal(TIER_CAPS.free.nameMode, 'hidden');
  assert.equal(isTrueNameTier('free'), false);
});

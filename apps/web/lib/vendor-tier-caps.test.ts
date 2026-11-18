/**
 * Vendor tier capability matrix (Node built-in test runner via tsx — `pnpm test:unit`).
 *
 * 📐 THE PLAN ALLOWANCES — owner 2026-11-04, DECISION_LOG "SUPPLIER PLAN ALLOWANCES", verbatim: *"pro reach 100,
 * ultra nationwide · main categories solo 2 pro 8, ultra unlimited · service cards free 1, solo 3, pro 10, ultra
 * unlimited · team seats 0,1,5,20 · waitlist 0,0,1,5 · website applies to solo as well"*; corrected the same day:
 * *"team seats ultra 15 only"*; and "BRANCHES PER PLAN": *"branches 0,0,3,10"*. Free·Verified / Supplier Plus / Pro / Ultra.
 * SUPERSEDED FOR ULTRA the same day by "ULTRA = ₱5,990 PER 4 WEEKS / ₱59,900 PER YEAR, WITH TRIMMED ALLOWANCES":
 * categories 15 · service cards 25 · seats 10 · branches 6 · waitlist 3 (reach stays nationwide). 
 *
 * The stale `calls` capability is GONE (same ruling) — in-app calls were retired 2026-10-28, so no plan buys them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canBuyExtraBranches,
  canBuyExtraCategories,
  canBuyExtraServiceCards,
  canBuyExtraWaitlist,
  canBuyExtraBookingsPerDate,
  holdsBoughtExtras,
  canSeeMarketIntel,
  canUseEditorialFeatures,
  isTierAtLeast,
  isTrueNameTier,
  reachLadderWords,
  TIER_CAPS,
  VENDOR_TIERS,
  type VendorTier,
} from './vendor-tier-caps';
import { vendorHoldsActivePaidSub } from './vendor-favorite-gate';

const LADDER = ['free', 'verified', 'solo', 'pro', 'enterprise'] as const;
const NUMERIC = ['serviceRadiusKm', 'parentCategories', 'serviceCardsTotal', 'agentAccounts', 'waitlistAcceptances', 'branchesIncluded'] as const;

test('allowances · the owner\'s 2026-11-18 numbers, Free / Verified / Plus / Pro / Max', () => {
  const row = (k: (typeof NUMERIC)[number]) => LADDER.map((t) => TIER_CAPS[t][k]);
  // Owner 2026-11-18, DECISION_LOG "SUPPLIER PLANS REBUILT" (+ ruling 39). `enterprise` is the plan now called Max.
  assert.deepEqual(row('serviceRadiusKm'), [5, 10, 50, 100, Infinity], 'reach: 5 / 10 / 50 / 100 km / nationwide');
  // Ultra raised 2026-11-14 ("SIMPLER SUPPLIER PLANS"): all 16 main categories · 30 cards each · 10 bookings a day.
  assert.deepEqual(row('parentCategories'), [1, 1, 2, 8, 12], 'main categories: 1 / 1 / 2 / 8 / all 12');
  assert.deepEqual(row('serviceCardsTotal'), [1, 3, 10, 20, 80], 'service cards in total: 1 / 3 / 10 / 20 / 80');
  assert.deepEqual(row('agentAccounts'), [0, 0, 1, 5, 11], 'seats beyond the owner: 0 / 0 / 1 / 5 / 11 (1 / 1 / 2 / 6 / 12 with the owner)');
  assert.deepEqual(row('waitlistAcceptances'), [10, 10, 10, 10, 10], 'waitlist: no plan limit — the setting\'s own ceiling on every plan');
  assert.deepEqual(row('branchesIncluded'), [0, 0, 0, 2, 5], 'branches besides the main shop: 0 / 0 / 0 / 2 / 5');
  assert.deepEqual(LADDER.map((t) => TIER_CAPS[t].customWebsiteName), [false, false, true, true, true], 'own web address: Supplier Plus, Pro, Ultra');
  assert.deepEqual(LADDER.map((t) => TIER_CAPS[t].premiumPage), [false, false, false, true, true], 'the Pro page parts stay Pro+');
});

test('allowances · every numeric allowance is monotonic up the ladder (no rung gives less than the one below)', () => {
  for (const k of NUMERIC) {
    for (let i = 1; i < LADDER.length; i++) {
      assert.ok(TIER_CAPS[LADDER[i]!][k] >= TIER_CAPS[LADDER[i - 1]!][k], `${k}: ${LADDER[i]} < ${LADDER[i - 1]}`);
    }
  }
});

test('branches · only Ultra may buy more', () => {
  for (const t of VENDOR_TIERS) assert.equal(canBuyExtraBranches(t), t === 'enterprise', t);
  assert.equal(canBuyExtraBranches(null), false);
  // The four Ultra "+1" add-ons of 2026-11-06 are folded into Ultra's limits (2026-11-14 "SIMPLER SUPPLIER PLANS"):
  // no plan buys them any more — and an Ultra shop that bought one still holds it until it runs out.
  for (const can of [canBuyExtraCategories, canBuyExtraServiceCards, canBuyExtraWaitlist, canBuyExtraBookingsPerDate]) {
    for (const t of VENDOR_TIERS) assert.equal(can(t), false, `${can.name} ${t}`);
    assert.equal(can(null), false);
  }
  for (const t of VENDOR_TIERS) assert.equal(holdsBoughtExtras(t), t === 'enterprise', `holdsBoughtExtras ${t}`);
});

test('calls · the stale capability is gone from every plan', () => {
  for (const t of VENDOR_TIERS) assert.ok(!('calls' in TIER_CAPS[t]), `${t} still carries a calls cap`);
});

test('reach ladder words say "nationwide", never "Infinity"', () => {
  assert.doesNotMatch(reachLadderWords(), /Infinity/);
  assert.match(reachLadderWords(), /Ultra nationwide$/);
});

// ── Subscription-ladder contents (Vendor_Subscription_Ladder_2026-07-22 §1/§4) ──
// Locks the tier CONTENTS — categories, agent seats, reach/radius, market intel —
// against the owner-locked ladder so a future edit can't silently drift the caps
// away from what's marketed. Prices are NOT asserted here (they live in the live
// vendor_billing_catalog; TIER_PRICE_PHP is only a fallback).

test('ladder · Free: 1 category, local reach, no market intel, no agent seats', () => {
  const c = TIER_CAPS.free;
  assert.equal(c.parentCategories, 1, 'Free lists under exactly 1 category');
  assert.equal(c.serviceRadiusKm, 5, 'Free reach is 5 km from the shop (owner 2026-11-18)');
  assert.equal(c.marketIntel, false, 'Free has no Market Intel');
  assert.equal(canSeeMarketIntel('free'), false);
  assert.equal(c.agentAccounts, 0, 'Free has no agent seats');
});

test('ladder · Supplier Plus: expanded reach + analytics, still no Market Intel', () => {
  const c = TIER_CAPS.solo;
  assert.ok(c.serviceRadiusKm > 0, 'Supplier Plus unlocks reach beyond local');
  assert.equal(c.performanceTrends, true, 'Supplier Plus gets business-performance analytics');
  assert.equal(c.marketIntel, false, 'Supplier Plus does NOT get Market Intel (Pro+ only)');
  assert.equal(canSeeMarketIntel('solo'), false);
});

test('ladder · Pro: Market Intel + up to 5 seats + expanded reach', () => {
  const c = TIER_CAPS.pro;
  assert.equal(c.marketIntel, true, 'Pro gets Market Intel (Demand Radar + Price-Position)');
  assert.equal(canSeeMarketIntel('pro'), true);
  assert.equal(c.agentAccounts, 5, 'Pro = up to 5 agent seats (owner 2026-11-04; was 3)');
  assert.ok(
    c.serviceRadiusKm > TIER_CAPS.solo.serviceRadiusKm,
    'Pro reach is wider than Supplier Plus',
  );
});

test('ladder · Max (enterprise): 12 seats + nationwide reach + all 12 categories', () => {
  const c = TIER_CAPS.enterprise;
  assert.equal(c.agentAccounts, 11, 'Max = 12 seats with the owner (owner 2026-11-18)');
  assert.equal(c.serviceRadiusKm, Infinity, 'Ultra = nationwide (owner 2026-11-04; was 100 km)');
  assert.equal(c.parentCategories, 12, 'Max = all 12 main categories (owner 2026-11-18)');
  assert.equal(c.marketIntel, true, 'Enterprise keeps Market Intel');
});

test('ladder · reach is monotonic Free ≤ Supplier Plus ≤ Pro ≤ Enterprise', () => {
  const { free, solo, pro, enterprise } = TIER_CAPS;
  assert.ok(free.serviceRadiusKm <= solo.serviceRadiusKm);
  assert.ok(solo.serviceRadiusKm <= pro.serviceRadiusKm);
  assert.ok(pro.serviceRadiusKm <= enterprise.serviceRadiusKm);
});

test('ladder · agent seats are monotonic Free ≤ Supplier Plus ≤ Pro ≤ Enterprise', () => {
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
  // A stray 'custom' (the retired plan) reads as Free — never as a paid plan.
  assert.equal(canSeeMarketIntel('custom'), false);
});

// ── "Open it up" — name is NEVER gated (Vendor_Subscription_Ladder_2026-07-22 §3) ──
// The name paywall is retired: the legacy Verified tier NO LONGER anonymizes
// (was nameMode 'screen'). Every couple-facing/paid tier shows the real business
// name day-1. `free` carries nameMode 'verified' (2026-10-23; was 'hidden') — never revealed by tier alone for a
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

test('every PAID tier reveals the real name day-1 (Supplier Plus/Pro/Ultra)', () => {
  for (const tier of ['solo', 'pro', 'enterprise'] as const) {
    assert.equal(TIER_CAPS[tier].nameMode, 'true', `${tier} shows the real name day-1`);
    assert.equal(isTrueNameTier(tier), true);
  }
});

test('free tier: real name ONCE VERIFIED — the tier alone never reveals (reveal comes from verification)', () => {
  // Owner 2026-10-23: Free shows its real name once verified. That is `nameMode: 'verified'`, and the reveal itself
  // is `is_verified` at resolveVendorDisplayName — so an UNVERIFIED Free shop is still never over-exposed.
  assert.equal(TIER_CAPS.free.nameMode, 'verified');
  assert.equal(isTrueNameTier('free'), false);
});

// ── Locked monetization matrix reconciliation ────────────────────────────────
// Vendor_Monetization_Model_LOCKED_2026-07-25 § 1, GROW block. These pin the
// growth capabilities to the owner-locked grid so a future edit to TIER_CAPS
// that quietly moves one of them fails CI instead of shipping.

test('locked matrix · GROW row — market intel is Pro+ for every tier', () => {
  const WANT: Record<VendorTier, boolean> = {
    free: false,
    verified: false,
    solo: false,
    pro: true,
    enterprise: true,
  };
  for (const tier of VENDOR_TIERS) {
    assert.equal(
      TIER_CAPS[tier].marketIntel,
      WANT[tier],
      `${tier} marketIntel must match the locked § 1 GROW row`,
    );
    assert.equal(canSeeMarketIntel(tier), WANT[tier]);
    // Rank-derived cross-check: Pro-and-up == marketIntel, no exceptions.
    assert.equal(canSeeMarketIntel(tier), isTierAtLeast(tier, 'pro'));
  }
});

test('locked matrix · GROW row — vendor favorites unlock at Supplier Plus and up', () => {
  // The favorites gate is the authority; assert it agrees with the ladder so
  // "favorites" can never drift to a different tier than the matrix says.
  for (const tier of VENDOR_TIERS) {
    assert.equal(
      vendorHoldsActivePaidSub({ tier_state: tier, tier_expires_at: null }),
      isTierAtLeast(tier, 'solo'),
      `${tier} favoritability must equal Supplier-Plus-and-up`,
    );
  }
  assert.equal(
    vendorHoldsActivePaidSub({ tier_state: 'verified', tier_expires_at: null }),
    false,
    'the legacy Verified tier is FREE — never favoritable',
  );
});

test('locked matrix · GROW row — editorial FEATURES are Pro+', () => {
  const WANT: Record<VendorTier, boolean> = {
    free: false,
    verified: false,
    solo: false,
    pro: true,
    enterprise: true,
  };
  for (const tier of VENDOR_TIERS) {
    assert.equal(TIER_CAPS[tier].editorialFeatures, WANT[tier], `${tier} editorialFeatures`);
    assert.equal(canUseEditorialFeatures(tier), WANT[tier]);
  }
  assert.equal(canUseEditorialFeatures(null), false, 'unknown tier ⇒ no featuring');
});

test('editorial CREDIT stays free at every tier (Simplicity Canon rule 2)', () => {
  // Guard against the obvious mis-implementation of "Editorial features → Pro+":
  // gating editorialTagged would resurrect the retired credit paywall and break
  // the owner-ratified 2026-07-16 rule "You never pay to be named in a story."
  for (const tier of VENDOR_TIERS) {
    assert.equal(
      TIER_CAPS[tier].editorialTagged,
      true,
      `${tier} must keep FREE editorial credit — editorialFeatures is the paid axis`,
    );
  }
});

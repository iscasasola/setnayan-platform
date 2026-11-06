/**
 * Vendor tier capability matrix (Node built-in test runner via tsx — `pnpm test:unit`).
 *
 * 📐 THE PLAN ALLOWANCES — owner 2026-11-04, DECISION_LOG "SUPPLIER PLAN ALLOWANCES", verbatim: *"pro reach 100,
 * ultra nationwide · main categories solo 2 pro 8, ultra unlimited · service cards free 1, solo 3, pro 10, ultra
 * unlimited · team seats 0,1,5,20 · waitlist 0,0,1,5 · website applies to solo as well"*; corrected the same day:
 * *"team seats ultra 15 only"*; and "BRANCHES PER PLAN": *"branches 0,0,3,10"*. Free·Verified / Solo / Pro / Ultra.
 * SUPERSEDED FOR ULTRA the same day by "ULTRA = ₱5,990 PER 4 WEEKS / ₱59,900 PER YEAR, WITH TRIMMED ALLOWANCES":
 * categories 15 · service cards 25 · seats 10 · branches 6 · waitlist 3 (reach stays nationwide). Custom in lockstep.
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
const NUMERIC = ['serviceRadiusKm', 'parentCategories', 'servicesPerLeaf', 'agentAccounts', 'waitlistAcceptances', 'branchesIncluded'] as const;

test('allowances · the owner\'s 2026-11-04 numbers, Free·Verified / Solo / Pro / Ultra', () => {
  const row = (k: (typeof NUMERIC)[number]) => LADDER.map((t) => TIER_CAPS[t][k]);
  assert.deepEqual(row('serviceRadiusKm'), [0, 20, 30, 100, Infinity], 'reach: 0·20 / 30 / 100 / nationwide');
  assert.deepEqual(row('parentCategories'), [1, 1, 2, 8, 15], 'main categories: 1 / 2 / 8 / 15 (Ultra trimmed)');
  assert.deepEqual(row('servicesPerLeaf'), [1, 1, 3, 10, 25], 'service cards per category: 1 / 3 / 10 / 25 (Ultra trimmed)');
  assert.deepEqual(row('agentAccounts'), [0, 0, 1, 5, 10], 'team seats: 0 / 1 / 5 / 10 (Ultra trimmed; was 15)');
  assert.deepEqual(row('waitlistAcceptances'), [0, 0, 0, 1, 3], 'waitlist per date: 0 / 0 / 1 / 3 (Ultra trimmed; was 5)');
  assert.deepEqual(row('branchesIncluded'), [0, 0, 0, 3, 6], 'branches: 0 / 0 / 3 / 6 (Ultra trimmed; was 10)');
  assert.deepEqual(LADDER.map((t) => TIER_CAPS[t].customWebsiteName), [false, false, true, true, true], 'own web address: Solo, Pro, Ultra');
  assert.deepEqual(LADDER.map((t) => TIER_CAPS[t].premiumPage), [false, false, false, true, true], 'the Pro page parts stay Pro+');
});

test('allowances · every numeric allowance is monotonic up the ladder (no rung gives less than the one below)', () => {
  for (const k of NUMERIC) {
    for (let i = 1; i < LADDER.length; i++) {
      assert.ok(TIER_CAPS[LADDER[i]!][k] >= TIER_CAPS[LADDER[i - 1]!][k], `${k}: ${LADDER[i]} < ${LADDER[i - 1]}`);
    }
  }
});

test('allowances · Custom stays in lockstep with Ultra on every numeric allowance', () => {
  for (const k of NUMERIC) assert.equal(TIER_CAPS.custom[k], TIER_CAPS.enterprise[k], k);
  assert.equal(TIER_CAPS.custom.customWebsiteName, TIER_CAPS.enterprise.customWebsiteName);
  assert.equal(TIER_CAPS.custom.premiumPage, TIER_CAPS.enterprise.premiumPage);
});

test('branches · only Ultra (and Custom) may buy more', () => {
  for (const t of VENDOR_TIERS) assert.equal(canBuyExtraBranches(t), t === 'enterprise' || t === 'custom', t);
  assert.equal(canBuyExtraBranches(null), false);
  // The four Ultra add-ons of 2026-11-06 ("ULTRA ADD-ON PRICES") share the same gate.
  for (const can of [canBuyExtraCategories, canBuyExtraServiceCards, canBuyExtraWaitlist, canBuyExtraBookingsPerDate]) {
    for (const t of VENDOR_TIERS) assert.equal(can(t), t === 'enterprise' || t === 'custom', `${can.name} ${t}`);
    assert.equal(can(null), false);
  }
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

test('ladder · Pro: Market Intel + up to 5 seats + expanded reach', () => {
  const c = TIER_CAPS.pro;
  assert.equal(c.marketIntel, true, 'Pro gets Market Intel (Demand Radar + Price-Position)');
  assert.equal(canSeeMarketIntel('pro'), true);
  assert.equal(c.agentAccounts, 5, 'Pro = up to 5 agent seats (owner 2026-11-04; was 3)');
  assert.ok(
    c.serviceRadiusKm > TIER_CAPS.solo.serviceRadiusKm,
    'Pro reach is wider than Solo',
  );
});

test('ladder · Ultra: up to 10 seats + nationwide reach + 15 categories', () => {
  const c = TIER_CAPS.enterprise;
  assert.equal(c.agentAccounts, 10, 'Ultra = up to 10 team seats (owner 2026-11-04 "WITH TRIMMED ALLOWANCES"; 15 earlier that day)');
  assert.equal(c.serviceRadiusKm, Infinity, 'Ultra = nationwide (owner 2026-11-04; was 100 km)');
  assert.equal(c.parentCategories, 15, 'Ultra = 15 categories (trimmed 2026-11-04; was unlimited)');
  assert.equal(c.marketIntel, true, 'Enterprise keeps Market Intel');
});

test('ladder · Custom: runs as Enterprise-or-better on every axis', () => {
  const c = TIER_CAPS.custom;
  const e = TIER_CAPS.enterprise;
  assert.ok(c.parentCategories >= e.parentCategories, 'Custom categories >= Enterprise');
  assert.ok(c.servicesPerLeaf >= e.servicesPerLeaf, 'Custom service listings >= Enterprise');
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

test('every PAID tier reveals the real name day-1 (Solo/Pro/Enterprise/Custom)', () => {
  for (const tier of ['solo', 'pro', 'enterprise', 'custom'] as const) {
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
    custom: true,
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

test('locked matrix · GROW row — vendor favorites unlock at Solo+', () => {
  // The favorites gate is the authority; assert it agrees with the ladder so
  // "favorites" can never drift to a different tier than the matrix says.
  for (const tier of VENDOR_TIERS) {
    assert.equal(
      vendorHoldsActivePaidSub({ tier_state: tier, tier_expires_at: null }),
      isTierAtLeast(tier, 'solo'),
      `${tier} favoritability must equal Solo-and-up`,
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
    custom: true,
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

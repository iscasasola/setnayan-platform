import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  SEO_SITEMAP_PRIORITY,
  SITEMAP_BASE_COLS,
  SITEMAP_TIER_COLS,
  effectiveSeoTier,
  firstVendorSitemapQuery,
  legacySeoPlan,
  nextVendorSitemapQuery,
  vendorSeoPlan,
  vendorSeoPlanForVendor,
  type VendorSeoPlan,
} from './vendor-seo-tier';
import { isVendorSeoTierGateEnabled } from './vendor-seo-tier-flag';
import {
  VENDOR_TIERS,
  SEO_LEVEL_RANK,
  isSeoLevelAtLeast,
  vendorSeoLevel,
  type VendorTier,
} from './vendor-tier-caps';

/**
 * SEO/GEO/AEO tier ladder — Vendor_Monetization_Model_LOCKED_2026-07-25 § 8.
 *
 * The load-bearing assertion is the FIRST block: with the gate dark, every tier
 * (including a bogus/absent one) resolves to the legacy all-enrichments plan at
 * the flat 0.8 sitemap priority. That is what makes this PR a no-op in prod.
 */

// ── flag OFF ⇒ byte-identical to today, for EVERY tier ───────────────────────

test('gate OFF: every tier gets the legacy plan (all enrichments · 0.8)', () => {
  for (const tier of VENDOR_TIERS) {
    const plan = vendorSeoPlan(tier, false);
    assert.equal(plan.indexable, true, `${tier} indexable`);
    assert.equal(plan.entityGraph, true, `${tier} keeps knowsAbout while dark`);
    assert.equal(plan.offerGraph, true, `${tier} keeps the offer graph while dark`);
    assert.equal(plan.sitemapPriority, 0.8, `${tier} keeps today's flat priority`);
    assert.deepEqual(plan, legacySeoPlan(vendorSeoLevel(tier)));
  }
});

test('gate OFF: unknown / null / empty tier also gets the legacy plan', () => {
  for (const raw of [null, undefined, '', 'bogus', 'ENTERPRISE']) {
    const plan = vendorSeoPlan(raw, false);
    assert.equal(plan.entityGraph, true);
    assert.equal(plan.offerGraph, true);
    assert.equal(plan.sitemapPriority, 0.8);
  }
});

test('gate OFF renders the exact <priority> string the sitemap emits today', () => {
  // The route interpolates the number straight into XML — pin the rendering so
  // a future numeric change (0.8 → 0.80) can't silently rewrite every URL.
  assert.equal(String(vendorSeoPlan('free', false).sitemapPriority), '0.8');
});

// ── the flag module itself ───────────────────────────────────────────────────

test('activation flag defaults OFF and only the literal "true" enables it', () => {
  const original = process.env.NEXT_PUBLIC_VENDOR_SEO_TIER_GATE;
  try {
    delete process.env.NEXT_PUBLIC_VENDOR_SEO_TIER_GATE;
    assert.equal(isVendorSeoTierGateEnabled(), false, 'unset ⇒ OFF');
    for (const v of ['', '1', 'yes', 'TRUE', 'True', 'false']) {
      process.env.NEXT_PUBLIC_VENDOR_SEO_TIER_GATE = v;
      assert.equal(isVendorSeoTierGateEnabled(), false, `"${v}" must not enable`);
    }
    process.env.NEXT_PUBLIC_VENDOR_SEO_TIER_GATE = 'true';
    assert.equal(isVendorSeoTierGateEnabled(), true);
  } finally {
    if (original === undefined) delete process.env.NEXT_PUBLIC_VENDOR_SEO_TIER_GATE;
    else process.env.NEXT_PUBLIC_VENDOR_SEO_TIER_GATE = original;
  }
});

// ── flag ON ⇒ the locked § 8 ladder, tier by tier ────────────────────────────

const EXPECTED: Record<VendorTier, Omit<VendorSeoPlan, 'sitemapPriority'>> = {
  free: { level: 'basic', indexable: true, entityGraph: false, offerGraph: false },
  verified: { level: 'basic', indexable: true, entityGraph: false, offerGraph: false },
  solo: { level: 'enhanced', indexable: true, entityGraph: true, offerGraph: false },
  pro: { level: 'aeo', indexable: true, entityGraph: true, offerGraph: true },
  enterprise: { level: 'priority', indexable: true, entityGraph: true, offerGraph: true },
  custom: { level: 'priority', indexable: true, entityGraph: true, offerGraph: true },
};

test('gate ON: every tier matches the locked § 8 matrix', () => {
  for (const tier of VENDOR_TIERS) {
    const plan = vendorSeoPlan(tier, true);
    const want = EXPECTED[tier];
    assert.equal(plan.level, want.level, `${tier} level`);
    assert.equal(plan.indexable, want.indexable, `${tier} indexable`);
    assert.equal(plan.entityGraph, want.entityGraph, `${tier} entityGraph`);
    assert.equal(plan.offerGraph, want.offerGraph, `${tier} offerGraph`);
    assert.equal(
      plan.sitemapPriority,
      SEO_SITEMAP_PRIORITY[want.level],
      `${tier} sitemapPriority`,
    );
  }
});

test('gate ON: basic indexability is FREE for all — no tier is ever de-indexed', () => {
  for (const tier of [...VENDOR_TIERS, null, undefined, 'bogus']) {
    assert.equal(
      vendorSeoPlan(tier as string | null | undefined, true).indexable,
      true,
      `${String(tier)} must stay indexable — we never de-index to sell a tier`,
    );
  }
});

test('gate ON: unknown tier degrades to the FREE (basic) plan, never to a paid one', () => {
  for (const raw of [null, undefined, '', 'bogus', 'PRO']) {
    const plan = vendorSeoPlan(raw, true);
    assert.equal(plan.level, 'basic');
    assert.equal(plan.entityGraph, false);
    assert.equal(plan.offerGraph, false);
  }
});

test('gate ON: enhanced SEO+GEO unlocks at Solo and never below', () => {
  assert.equal(vendorSeoPlan('free', true).entityGraph, false);
  assert.equal(vendorSeoPlan('verified', true).entityGraph, false);
  assert.equal(vendorSeoPlan('solo', true).entityGraph, true);
  assert.equal(vendorSeoPlan('pro', true).entityGraph, true);
  assert.equal(vendorSeoPlan('enterprise', true).entityGraph, true);
  assert.equal(vendorSeoPlan('custom', true).entityGraph, true);
});

test('gate ON: AEO offer graph unlocks at Pro and never below', () => {
  assert.equal(vendorSeoPlan('free', true).offerGraph, false);
  assert.equal(vendorSeoPlan('verified', true).offerGraph, false);
  assert.equal(vendorSeoPlan('solo', true).offerGraph, false);
  assert.equal(vendorSeoPlan('pro', true).offerGraph, true);
  assert.equal(vendorSeoPlan('enterprise', true).offerGraph, true);
  assert.equal(vendorSeoPlan('custom', true).offerGraph, true);
});

// ── ladder shape ─────────────────────────────────────────────────────────────

test('ladder · SEO level is monotonic Free ≤ Verified ≤ Solo ≤ Pro ≤ Enterprise ≤ Custom', () => {
  const order: VendorTier[] = ['free', 'verified', 'solo', 'pro', 'enterprise', 'custom'];
  for (let i = 1; i < order.length; i += 1) {
    const lo = SEO_LEVEL_RANK[vendorSeoLevel(order[i - 1])];
    const hi = SEO_LEVEL_RANK[vendorSeoLevel(order[i])];
    assert.ok(hi >= lo, `${order[i]} must not rank below ${order[i - 1]}`);
  }
});

test('ladder · sitemap priority is monotonic in the SEO level', () => {
  const levels = ['basic', 'enhanced', 'aeo', 'priority'] as const;
  levels.forEach((level, i) => {
    if (i === 0) return;
    const prev = levels[i - 1] as (typeof levels)[number];
    assert.ok(
      SEO_SITEMAP_PRIORITY[level] > SEO_SITEMAP_PRIORITY[prev],
      `${level} must outrank ${prev}`,
    );
  });
  // Sitemap <priority> is only valid in [0.0, 1.0].
  for (const l of levels) {
    assert.ok(SEO_SITEMAP_PRIORITY[l] > 0 && SEO_SITEMAP_PRIORITY[l] <= 1);
  }
});

test('isSeoLevelAtLeast reads the matrix, not a hardcoded tier set', () => {
  assert.equal(isSeoLevelAtLeast('solo', 'enhanced'), true);
  assert.equal(isSeoLevelAtLeast('verified', 'enhanced'), false);
  assert.equal(isSeoLevelAtLeast('pro', 'aeo'), true);
  assert.equal(isSeoLevelAtLeast('solo', 'aeo'), false);
  // 'custom' runs as Enterprise-or-better — it must inherit automatically.
  assert.equal(isSeoLevelAtLeast('custom', 'priority'), true);
  assert.equal(isSeoLevelAtLeast(null, 'enhanced'), false);
});

// ── LAPSE: a paid tier that has expired is NOT a paid tier ───────────────────
// Tier lapse is login-driven (`sweep_vendor_tier_expiry` fires from the vendor
// dashboard layout). A public /v/[slug] render and a crawler hitting the
// sitemap are the two paths where nobody is logged in, so the row still says
// 'pro' long after the money stopped. Reading tier_state alone hands a lapsed
// vendor the paid SEO entitlement forever.

const NOW = Date.parse('2026-07-26T00:00:00.000Z');
const EXPIRED = '2026-07-01T00:00:00.000Z';
const ACTIVE = '2026-08-30T00:00:00.000Z';
const PAID_TIERS: VendorTier[] = ['solo', 'pro', 'enterprise', 'custom'];

test('gate ON: a LAPSED paid tier collapses to the free plan at both render sites', () => {
  for (const tier of PAID_TIERS) {
    const plan = vendorSeoPlanForVendor(
      { tier_state: tier, tier_expires_at: EXPIRED },
      true,
      NOW,
    );
    assert.equal(plan.level, 'basic', `${tier} lapsed ⇒ basic`);
    assert.equal(plan.entityGraph, false, `${tier} lapsed must lose knowsAbout`);
    assert.equal(plan.offerGraph, false, `${tier} lapsed must lose the offer graph`);
    assert.equal(
      plan.sitemapPriority,
      SEO_SITEMAP_PRIORITY.basic,
      `${tier} lapsed must drop to the free sitemap priority`,
    );
  }
});

test('gate ON: an UNEXPIRED paid tier keeps everything it paid for', () => {
  for (const tier of PAID_TIERS) {
    const plan = vendorSeoPlanForVendor(
      { tier_state: tier, tier_expires_at: ACTIVE },
      true,
      NOW,
    );
    assert.deepEqual(plan, vendorSeoPlan(tier, true), `${tier} active`);
  }
});

test('gate ON: a NULL expiry never lapses (admin-granted / comp tier)', () => {
  for (const tier of PAID_TIERS) {
    const plan = vendorSeoPlanForVendor(
      { tier_state: tier, tier_expires_at: null },
      true,
      NOW,
    );
    assert.deepEqual(plan, vendorSeoPlan(tier, true), `${tier} comp`);
  }
});

test('gate ON: expiry exactly at `now` counts as LAPSED (strict >, no free minute)', () => {
  const plan = vendorSeoPlanForVendor(
    { tier_state: 'pro', tier_expires_at: new Date(NOW).toISOString() },
    true,
    NOW,
  );
  assert.equal(plan.offerGraph, false);
});

test('effectiveSeoTier: free tiers pass through untouched — they cannot lapse', () => {
  for (const tier of ['free', 'verified'] as const) {
    assert.equal(effectiveSeoTier({ tier_state: tier, tier_expires_at: EXPIRED }, NOW), tier);
    assert.equal(effectiveSeoTier({ tier_state: tier, tier_expires_at: null }, NOW), tier);
  }
  assert.equal(effectiveSeoTier({ tier_state: null }, NOW), null);
});

test('gate OFF: the row entry point is an EXACT passthrough — lapse included', () => {
  // Flag-dark byte-identity must survive the lapse logic: with the gate off,
  // vendorSeoPlanForVendor(row) must equal vendorSeoPlan(tier) field for field
  // — including the echoed `level` — for every tier × every expiry state.
  for (const tier of VENDOR_TIERS) {
    for (const expiry of [EXPIRED, ACTIVE, null]) {
      assert.deepEqual(
        vendorSeoPlanForVendor({ tier_state: tier, tier_expires_at: expiry }, false, NOW),
        vendorSeoPlan(tier, false),
        `${tier} / ${String(expiry)}`,
      );
    }
  }
  assert.equal(
    vendorSeoPlanForVendor({ tier_state: 'pro', tier_expires_at: EXPIRED }, false, NOW)
      .sitemapPriority,
    0.8,
  );
});

// ── UNKNOWN tier ≠ free tier ─────────────────────────────────────────────────
// The one fallback in this feature that must degrade toward the VENDOR: if our
// own deploy skew means we could not read tier_state, we must not strip a
// currently-paying vendor of an entitlement they bought.

test('gate ON: an UNREAD tier column yields the legacy plan, not the free plan', () => {
  const plan = vendorSeoPlanForVendor({}, true, NOW);
  assert.deepEqual(plan, legacySeoPlan('basic'));
  assert.equal(plan.entityGraph, true, 'unknown tier must not lose knowsAbout');
  assert.equal(plan.offerGraph, true, 'unknown tier must not lose the offer graph');
  assert.equal(plan.sitemapPriority, 0.8, 'unknown tier keeps the flat priority');
  // Explicitly-undefined key is the same case as an absent key.
  assert.deepEqual(
    vendorSeoPlanForVendor({ tier_state: undefined, tier_expires_at: undefined }, true, NOW),
    plan,
  );
});

test('gate ON: an explicit free/null tier IS free — "unknown" is not a bypass', () => {
  for (const tier of [null, 'free', 'verified', 'bogus']) {
    const plan = vendorSeoPlanForVendor({ tier_state: tier }, true, NOW);
    assert.equal(plan.entityGraph, false, `${String(tier)} must stay basic`);
    assert.equal(plan.offerGraph, false, `${String(tier)} must stay basic`);
  }
});

// ── sitemap fallback ladder: a tier skew must not drop the privacy filters ───

test('sitemap · first query reads tier columns ONLY while the gate is on', () => {
  assert.deepEqual(firstVendorSitemapQuery(false), {
    cols: SITEMAP_BASE_COLS,
    visibilityFilters: true,
    tierColumns: false,
  });
  assert.deepEqual(firstVendorSitemapQuery(true), {
    cols: SITEMAP_TIER_COLS,
    visibilityFilters: true,
    tierColumns: true,
  });
  assert.equal(SITEMAP_BASE_COLS, 'business_slug, updated_at', 'flag-OFF select is today’s');
});

test('sitemap · a tier_state / tier_expires_at skew KEEPS the visibility filters', () => {
  for (const col of ['tier_state', 'tier_expires_at']) {
    const first = firstVendorSitemapQuery(true);
    const next = nextVendorSitemapQuery(
      first,
      `column vendor_profiles.${col} does not exist`,
    );
    assert.ok(next, `${col} skew must be recoverable`);
    assert.equal(next.cols, SITEMAP_BASE_COLS, `${col} skew drops the tier columns`);
    assert.equal(next.tierColumns, false);
    assert.equal(
      next.visibilityFilters,
      true,
      `${col} skew must NOT republish demo + unverified vendors to crawlers`,
    );
    // …and there is nothing left to retry after that.
    assert.equal(
      nextVendorSitemapQuery(next, `column vendor_profiles.${col} does not exist`),
      null,
    );
  }
});

test('sitemap · an is_demo / verification_state skew drops the filters (pre-existing)', () => {
  for (const col of ['is_demo', 'verification_state']) {
    const next = nextVendorSitemapQuery(
      firstVendorSitemapQuery(true),
      `column vendor_profiles.${col} does not exist`,
    );
    assert.ok(next);
    assert.equal(next.visibilityFilters, false);
    assert.equal(next.cols, SITEMAP_BASE_COLS);
    assert.equal(nextVendorSitemapQuery(next, `column ${col} does not exist`), null);
  }
});

test('sitemap · a message naming BOTH skews takes the visibility fallback', () => {
  const next = nextVendorSitemapQuery(
    firstVendorSitemapQuery(true),
    'columns is_demo, tier_state do not exist',
  );
  assert.ok(next);
  assert.equal(next.visibilityFilters, false);
  assert.equal(next.tierColumns, false);
});

test('sitemap · a non-skew error is NOT papered over, and no error stops the ladder', () => {
  const first = firstVendorSitemapQuery(true);
  assert.equal(nextVendorSitemapQuery(first, 'connection reset by peer'), null);
  assert.equal(nextVendorSitemapQuery(first, ''), null);
  assert.equal(nextVendorSitemapQuery(first, null), null);
  assert.equal(nextVendorSitemapQuery(first, undefined), null);
});

test('sitemap · the fallback ladder terminates in at most 3 queries', () => {
  let q = firstVendorSitemapQuery(true);
  let steps = 0;
  const everything = 'columns tier_state, tier_expires_at, is_demo, verification_state do not exist';
  for (;;) {
    const next = nextVendorSitemapQuery(q, everything);
    if (!next) break;
    q = next;
    steps += 1;
    assert.ok(steps <= 3, 'planner must strictly narrow');
  }
  assert.ok(steps >= 1);
});

// ── source-scan guard: the render sites must route through the plan ──────────
// Same pattern as vendor-favorite-gate.test.ts — a new SEO enrichment added
// straight into the JSON-LD (bypassing the plan) fails CI here rather than
// silently shipping a paid enrichment to every free vendor.

test('the /v/[slug] JSON-LD gates both paid enrichments through vendorSeoPlan', () => {
  const src = readFileSync(
    path.join(process.cwd(), 'app', 'v', '[slug]', 'page.tsx'),
    'utf8',
  );
  assert.ok(
    src.includes("from '@/lib/vendor-seo-tier'"),
    'vendor public page must import the SEO tier plan',
  );
  assert.ok(
    src.includes('seoPlan.entityGraph'),
    'knowsAbout (GEO · Solo+) must be gated on seoPlan.entityGraph',
  );
  assert.ok(
    src.includes('seoPlan.offerGraph'),
    'the offer graph (AEO · Pro+) must be gated on seoPlan.offerGraph',
  );
  // Lapse-awareness: the page must go through the ROW entry point and must
  // actually read the expiry column, or a lapsed Pro keeps the paid SEO.
  assert.ok(
    src.includes('vendorSeoPlanForVendor('),
    'the public page must use the lapse-aware row entry point',
  );
  assert.ok(
    src.includes('tier_expires_at: vendor.tier_expires_at'),
    'the expiry must be threaded into the plan, not just the tier',
  );
  assert.ok(
    /tier_state,tier_expires_at/.test(src),
    'tier_expires_at must be in the vendor select or it is always undefined',
  );
});

test('the vendors sitemap derives <priority> from the plan and keeps its filters', () => {
  const src = readFileSync(
    path.join(process.cwd(), 'app', 'sitemap-vendors.xml', 'route.ts'),
    'utf8',
  );
  assert.ok(
    src.includes('vendorSeoPlanForVendor('),
    'sitemap must call the lapse-aware row entry point',
  );
  assert.ok(
    !src.includes('<priority>0.8</priority>'),
    'the flat 0.8 literal must be replaced by the plan-derived value',
  );
  // The fallback ladder must be the tested planner, not an inline regex — an
  // inline `/(is_demo|verification_state|tier_state)/` is exactly the bug that
  // republished demo + unverified vendors to crawlers on a tier skew.
  assert.ok(
    src.includes('firstVendorSitemapQuery(') && src.includes('nextVendorSitemapQuery('),
    'the sitemap fallback ladder must go through the pure planner',
  );
  assert.ok(
    src.includes('query.visibilityFilters'),
    'the verification_state / is_demo filters must be applied per the planner',
  );
  assert.ok(
    !/tier_state\|/.test(src) && !/\|tier_state/.test(src),
    'tier_state must not share a skew regex with the visibility columns',
  );
});

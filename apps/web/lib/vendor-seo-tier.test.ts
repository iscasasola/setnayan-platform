import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  SEO_SITEMAP_PRIORITY,
  legacySeoPlan,
  vendorSeoPlan,
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
});

test('the vendors sitemap derives <priority> from vendorSeoPlan, not a literal', () => {
  const src = readFileSync(
    path.join(process.cwd(), 'app', 'sitemap-vendors.xml', 'route.ts'),
    'utf8',
  );
  assert.ok(src.includes('vendorSeoPlan('), 'sitemap must call vendorSeoPlan');
  assert.ok(
    !src.includes('<priority>0.8</priority>'),
    'the flat 0.8 literal must be replaced by the plan-derived value',
  );
});

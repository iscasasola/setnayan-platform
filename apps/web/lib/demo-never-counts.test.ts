/**
 * 🧪 DEMO NUMBERS NEVER COUNT IN REAL TOTALS.
 *
 * Owner, DECISION_LOG 2026-11-06 "DEMO SHOPS + DEMO EVENTS": demo shops (`vendor_profiles.is_demo`) and demo events
 * (`events.is_sample`) now show publicly beside real ones, and *"demo numbers never count in real totals."* Showing is
 * not counting: the moment the public gate stopped hiding demo shops (`lib/live-shops.ts` LIVE_SHOP_GATE lost its
 * `is_demo: false` half), every figure that leaned on that gate — or never checked `is_demo` at all because demo shops
 * were invisible anyway — would start counting the seeded catalogue (20 shops, thousands of cards, seeded reviews).
 *
 * So each total below pins its exclusion BY FILE AND BY THE FUNCTION THAT HOLDS IT — never a file-level word match,
 * which cannot say which reader still filters (a sabotage that drops one of two sites in a file must go red). Every
 * count is printed. Removing a filter fails here; so does moving it into a different function.
 *
 * ⚠ NOT COVERED HERE — totals computed IN SQL (`recompute_market_price_bands`, `recompute_market_funnel_bands`,
 * `refresh_demand_radar_rollups`, `admin_market_analytics`): those are database functions and are held by the DB
 * replay, not by a source scan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { LIVE_SHOP_GATE, REAL_SHOP_GATE } from '@/lib/live-shops';

const ROOT = process.cwd();

/** The body of one top-level declaration: from its line to the next top-level declaration (column 0). */
function bodyOf(src: string, symbol: string): string | null {
  const lines = src.split('\n');
  const decl = new RegExp(
    `^(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?(?:function\\*?\\s+|const\\s+|let\\s+)${symbol}\\b`,
  );
  const top = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?\s+|const\s+|let\s+|type\s+|interface\s+|class\s+)\w/;
  const start = lines.findIndex((l) => decl.test(l));
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (top.test(lines[i]!)) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

const IS_DEMO_FALSE = /\.eq\('is_demo', false\)/g;
const IS_DEMO_NOT_TRUE = /\.or\('is_demo\.is\.null,is_demo\.eq\.false'\)/g;
const IS_SAMPLE_FALSE = /\.eq\('is_sample', false\)/g;
const REAL_GATE = /\.match\(REAL_SHOP_GATE\)/g;

type Pin = { file: string; symbol: string; pattern: RegExp; count: number; what: string };

const PINS: ReadonlyArray<Pin> = [
  // ── the plan's § 6(a) list: these already excluded demo shops and stay unchanged ──
  { file: 'lib/vendor-counts.ts', symbol: 'loadVerifiedVendorMarketplaceCount', pattern: IS_DEMO_NOT_TRUE, count: 1, what: 'the "N verified suppliers" marketing count' },
  { file: 'lib/vendor-counts.ts', symbol: 'fetchVendorCountsByService', pattern: IS_DEMO_FALSE, count: 1, what: 'per-category supplier counts' },
  { file: 'lib/ugat/data.ts', symbol: 'applyVerifiedVendorPredicate', pattern: IS_DEMO_NOT_TRUE, count: 1, what: 'the Ugat map supply counts' },
  { file: 'app/admin/categories/_components/load-map.ts', symbol: 'loadMapData', pattern: IS_DEMO_FALSE, count: 1, what: 'admin category map counts' },
  { file: 'lib/ghost-listing-detector.ts', symbol: 'scanForGhostListings', pattern: IS_DEMO_FALSE, count: 1, what: 'ghost-listing sweep' },
  { file: 'lib/social/flush.ts', symbol: 'sweepVendorFeatures', pattern: IS_DEMO_FALSE, count: 1, what: 'social feature picks' },
  // Lane S (2026-11-10): the milestone sweep moved to lib/social/milestones.ts and its numbers are counted IN SQL by
  // social_milestone_real_counts() (no demo shop, no sample event, no internal account) — the exclusions themselves are
  // held by the DB replay (tests/db/social-milestones-count-real-data-only.db.test.ts); this pins that the sweep reads it.
  { file: 'lib/social/milestones.ts', symbol: 'sweepMilestones', pattern: /\.rpc\('social_milestone_real_counts'\)/g, count: 1, what: 'social milestone posts — real counts only' },
  { file: 'lib/social/lane-s.ts', symbol: 'isBadgeShopPostable', pattern: /row\.is_demo !== false/g, count: 1, what: 'social badge posts never feature a demo shop' },
  { file: 'lib/vendor-image-repost-watch.ts', symbol: 'hashAndScanVendorImages', pattern: IS_DEMO_FALSE, count: 1, what: 'repost watch — the shared demo pools collide by design' },
  { file: 'lib/vendor-image-repost-watch.ts', symbol: 'rematchAllVendorImages', pattern: IS_DEMO_FALSE, count: 1, what: 'repost watch rematch' },
  { file: 'lib/vendor-image-repost-watch.ts', symbol: 'rescanAllVendorImages', pattern: IS_DEMO_FALSE, count: 1, what: 'repost watch rescan' },
  { file: 'lib/vendor-qr-media-guard.ts', symbol: 'scanAllVendorMediaForQr', pattern: IS_DEMO_FALSE, count: 1, what: 'QR media sweep' },
  { file: 'lib/vendor-seo-tier.ts', symbol: 'firstVendorSitemapQuery', pattern: /visibilityFilters: true/g, count: 1, what: 'the vendor sitemap applies its is_demo filter' },
  // ── added 2026-11-06: totals that would have started counting demo shops/events ──
  { file: 'lib/admin/growth-stats.ts', symbol: 'entityBase', pattern: IS_DEMO_FALSE, count: 2, what: 'admin growth curves — shops and cards' },
  { file: 'lib/admin/growth-stats.ts', symbol: 'entityBase', pattern: IS_SAMPLE_FALSE, count: 1, what: 'admin growth curves — events' },
  { file: 'lib/admin/growth-stats.ts', symbol: 'fetchBreakdowns', pattern: IS_SAMPLE_FALSE, count: 1, what: 'admin events by type and region' },
  { file: 'lib/admin/growth-stats.ts', symbol: 'fetchGrowthStats', pattern: REAL_GATE, count: 1, what: 'admin "vendors published"' },
  { file: 'lib/admin/growth-stats.ts', symbol: 'fetchGrowthStats', pattern: IS_DEMO_FALSE, count: 1, what: 'admin "services active"' },
  { file: 'app/admin/page.tsx', symbol: 'AdminOverview', pattern: IS_SAMPLE_FALSE, count: 1, what: 'admin overview — events' },
  { file: 'app/admin/page.tsx', symbol: 'AdminOverview', pattern: IS_DEMO_FALSE, count: 1, what: 'admin overview — shops' },
  { file: 'lib/spotlight-awards.ts', symbol: 'fetchVerifiedVendorPool', pattern: IS_DEMO_FALSE, count: 1, what: 'monthly Top Pick / Most Booked / Rising pool' },
  { file: 'lib/religion-readiness.ts', symbol: 'fetchReligionReadiness', pattern: IS_DEMO_FALSE, count: 1, what: 'per-rite supplier readiness' },
  { file: 'app/admin/app-performance/_surfaces/funnels-surface.tsx', symbol: 'FunnelsSurface', pattern: IS_DEMO_FALSE, count: 1, what: 'supplier onboarding funnel' },
];

test('every real total keeps its demo exclusion — per file, per function', () => {
  const report: string[] = [];
  const failures: string[] = [];
  for (const p of PINS) {
    const src = stripComments(readFileSync(join(ROOT, p.file), 'utf8'));
    const body = bodyOf(src, p.symbol);
    if (body === null) {
      failures.push(`${p.file}: ${p.symbol} is gone — move its pin with it (${p.what})`);
      continue;
    }
    const n = (body.match(p.pattern) ?? []).length;
    report.push(`${p.file} · ${p.symbol}: ${n}/${p.count}  ${p.what}`);
    if (n < p.count) failures.push(`${p.file} · ${p.symbol}: ${n} of ${p.count} demo exclusion(s) left — ${p.what}`);
  }
  console.log(report.join('\n'));
  assert.deepEqual(failures, [], `a real total now counts demo shops or demo events:\n${failures.join('\n')}`);
});

test('a count reads REAL_SHOP_GATE, which is the listing gate plus "not a demo shop"', () => {
  assert.deepEqual(REAL_SHOP_GATE, { ...LIVE_SHOP_GATE, is_demo: false });
  assert.equal('is_demo' in LIVE_SHOP_GATE, false, 'the public listing gate hides demo shops again (owner 2026-11-06: they show)');
});

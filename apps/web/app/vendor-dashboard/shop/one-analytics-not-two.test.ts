/**
 * 🔒 ONE ANALYTICS, NOT TWO (Build 6 · Lane I — owner 10 Nov: *"No dupes. we want graphs that will help them. tapping
 * shows a recommendation from us on what they need to do."*; approved prototype `build6_makers_analytics_2026-11-10`,
 * its dedupe table: *"The carousel is gone; its five pictures live on as tiles."*).
 *
 * Until this lane, the Shop tab drew a five-card carousel (#7399) whose every card was a SECOND copy of a fact ONE
 * Analytics (Shop › Analytics, #7439) already drew as a tile. Two analytics that disagree about one fact each pass their
 * own tests — so this guard holds the shape, not the numbers:
 *
 *   1 · The Shop tab draws ONE door into Shop › Analytics, and nothing else analytic: no carousel, no shipped analytics
 *       card face (the five carousel faces), no analytics read in the Shop page.
 *   2 · The door states no number about the shop (it can never disagree with the page it opens) and lands on the ONE
 *       Analytics — the Shop segment `insights`.
 *   3 · ONE Analytics draws its graphs once: `AnalyticsGrowing` is mounted by the Analytics page and by nothing else.
 *
 * Source-reading, comments stripped (`stripComments`), so a docblock that MENTIONS a symbol never satisfies a pin.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { SHOP_SEGMENT_HREF } from './_components/shop-sections';
import { ONE_ANALYTICS_HREF } from './_components/shop-analytics-door';

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const PAGE = read('app/vendor-dashboard/shop/page.tsx');
const DOOR = read('app/vendor-dashboard/shop/_components/shop-analytics-door.tsx');

/** The five faces the carousel drew — each a copy of a tile ONE Analytics owns. */
const CAROUSEL_FACES = ['CapacityCard', 'ConversionDealsCard', 'PricePositionCard', 'RoiAttributionCard', 'FunnelBenchmarkCard'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('1 · the Shop tab draws ONE door, no second analytics', () => {
  assert.ok(!existsSync(join(WEB, 'app/vendor-dashboard/shop/_components/shop-analytics-carousel.tsx')), 'the five-card carousel is back');
  assert.match(PAGE, /async function ShopAnalyticsSection\b[\s\S]*?<ShopAnalyticsDoor\b/, 'the Shop tab’s Analytics section is not the one door');
  assert.doesNotMatch(PAGE, /loadShopAnalytics|SnapCarousel|buildGrowthRecs/, 'the Shop page reads or draws analytics of its own again');
  for (const file of walk(join(WEB, 'app/vendor-dashboard/shop'))) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const face of CAROUSEL_FACES) {
      assert.doesNotMatch(src, new RegExp(`<${face}\\b`), `${relative(WEB, file)} draws ${face} — a second copy of a fact ONE Analytics owns`);
    }
  }
});

test('2 · the door states no number and lands on ONE Analytics', () => {
  assert.equal(ONE_ANALYTICS_HREF, SHOP_SEGMENT_HREF.insights, 'the door does not open Shop › Analytics');
  assert.match(DOOR, /href=\{ONE_ANALYTICS_HREF\}/);
  assert.doesNotMatch(DOOR, /formatCount|formatPhp|\bphp\(|toLocaleString/, 'the door draws a figure — it could disagree with the page it opens');
  assert.match(DOOR, /data-tour="shop-analytics"/, 'the Shop tour’s Analytics stop lost its anchor');
});

test('3 · AnalyticsGrowing is mounted once — by the Analytics page', () => {
  const mounts = walk(join(WEB, 'app'))
    .filter((f) => !f.includes(`${join('app', 'dev')}`))
    .filter((f) => /<AnalyticsGrowing\b/.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => relative(WEB, f));
  assert.deepEqual(mounts, ['app/vendor-dashboard/performance/page.tsx'], `ONE Analytics is drawn in more than one place: ${mounts.join(', ')}`);
});

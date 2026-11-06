/**
 * the-price-meter-is-shown.test.ts — the Price-Position meter that the home
 * page sells and the Pro teaser promises is actually on the page.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 * The card was taken off /vendor-dashboard/subscription in the 2026-07-02
 * declutter ("component files retained; only the render dropped") and nothing
 * mounted it again. For eleven weeks the home page's vendor benefits kept
 * listing "Price-position meter" and the Pro teaser here kept promising
 * "Demand Radar & Price-Position", while the unlocked section rendered only
 * the radar. S26's both-ends guard named it `component-no-mount`; S34 mounted it.
 *
 * Pins, each against the mistake it would catch:
 *   1. the meter (since 6 Nov 2026: §6's <PriceRail>, drawn from the one growth
 *      view) is read and drawn only on the canMarket side (not above it, where
 *      every free shop would see a Pro feature);
 *   2. the fetcher's failure lands on 'unreadable', never on the 'no_data'
 *      copy — a failed read must not say the market is empty;
 *   3. every read in fetchVendorPricePosition checks its error;
 *   4. no "Soon" pill on a meter that is live.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const PAGE = 'app/vendor-dashboard/performance/page.tsx';
const CARD = 'app/vendor-dashboard/performance/_components/price-position-card.tsx';
const LIB = 'lib/price-position.ts';
const TREE = 'app/vendor-dashboard/performance/_components/analytics-growing.tsx';
const RAIL = 'app/vendor-dashboard/performance/_components/price-rail.tsx';

test('the page mounts the meter once, inside the Pro market-intel branch', () => {
  /* 📈 "Analytics, growing" (owner-approved 6 Nov 2026) draws the meter as §6's price rail (`<PriceRail>`) and its
     "Where your price sits" row, from the ONE view the page builds. The gate moved with it, and is pinned in three places:
     the read itself only runs for `canMarket`, the view is told `showMarket: canMarket`, and the tree draws the rail only
     under `view.price.show`. The teaser stays the page's own `canMarket ? null : (…)` arm — the other side of one gate. */
  const src = read(PAGE);
  assert.match(
    src,
    /canMarket\s*\?\s*safeRead<[^>]*>\(\s*fetchVendorPricePosition\(profile\)/,
    'the price read must run only for canMarket (Pro-and-up)',
  );
  assert.match(src, /\bprice:\s*pricePosition\b/, 'the price read is never handed to the view');
  assert.match(src, /\bshowMarket:\s*canMarket\b/, 'the view lost the canMarket gate');
  const teaserAt = src.indexOf('feature="Demand Radar & Price-Position"');
  assert.ok(teaserAt > 0, 'the Pro teaser moved — re-anchor this test');
  const otherArm = src.lastIndexOf('{canMarket ? null : (', teaserAt);
  assert.ok(otherArm > 0 && teaserAt - otherArm < 400, 'the teaser must be the canMarket gate’s free arm');

  const tree = read(TREE);
  const rails = tree.match(/<PriceRail\b/g) ?? [];
  assert.equal(rails.length, 1, `expected one <PriceRail> mount, found ${rails.length}`);
  const gateAt = tree.lastIndexOf('view.price.show ?', tree.indexOf('<PriceRail'));
  assert.ok(gateAt > 0 && tree.indexOf('<PriceRail') - gateAt < 300, 'the rail must render inside the view.price.show arm');
});

test("a failed read becomes 'unreadable', and the card says so", () => {
  const page = read(PAGE);
  assert.match(
    page,
    /safeRead<[^>]*>\(\s*fetchVendorPricePosition\(profile\),\s*\{\s*status:\s*'unreadable'\s*\}/,
    "the fetch must fall back to { status: 'unreadable' }, not to null or 'no_data'",
  );
  const card = read(CARD);
  assert.match(card, /result\.status === 'unreadable'/);
  assert.match(card, /couldn&apos;t load your price position/);
  // …and the screen that is mounted says so too: the view marks it unread, the rail and the row draw "Couldn’t load".
  const tree = read(TREE);
  assert.match(tree, /unread=\{view\.price\.unread\}/);
  assert.match(tree, /view\.price\.unread \? 'Couldn’t load the market just now\.'/);
  assert.match(read(RAIL), /unread/);
});

test('every read in fetchVendorPricePosition checks its error', () => {
  const src = read(LIB);
  const reads = src.match(/\.from\('[a-z_]+'\)/g) ?? [];
  const checks = src.match(/if \((vpErr|bandErr|svcErr|pkgErr)\) throw/g) ?? [];
  assert.ok(reads.length >= 4, `expected >= 4 reads, found ${reads.length}`);
  assert.equal(checks.length, reads.length, `${reads.length} reads but ${checks.length} error checks`);
});

test('no "Soon" pill on a live meter', () => {
  assert.ok(!/>\s*Soon\s*</.test(read(CARD)), 'the meter is live — drop the Soon pill');
});

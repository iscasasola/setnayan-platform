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
 *   1. the page mounts <PricePositionCard> exactly once, INSIDE the canMarket
 *      branch (not above it, where every free shop would see a Pro feature);
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

test('the page mounts the meter once, inside the Pro market-intel branch', () => {
  const src = read(PAGE);
  const mounts = src.match(/<PricePositionCard\b/g) ?? [];
  assert.equal(mounts.length, 1, `expected one <PricePositionCard> mount, found ${mounts.length}`);

  // The Pro branch is `{canMarket ? ( … ) : ( <VendorTierTeaser feature="Demand Radar & Price-Position" … )}`.
  // The mount must sit between the ternary's opening and its teaser arm.
  const teaserAt = src.indexOf('feature="Demand Radar & Price-Position"');
  assert.ok(teaserAt > 0, 'the Pro teaser moved — re-anchor this test');
  const branchOpen = src.lastIndexOf('{canMarket ? (', teaserAt);
  assert.ok(branchOpen > 0, 'the canMarket branch moved — re-anchor this test');
  const mountAt = src.indexOf('<PricePositionCard');
  assert.ok(
    mountAt > branchOpen && mountAt < teaserAt,
    'the meter must render inside the canMarket (Pro) arm, before the teaser',
  );
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

/**
 * 🏅 THE SHOP'S BADGES ARE ON SHOP › HOW IT IS GOING — owner, verbatim, 2026-10-29: *"Their badges will be on the
 * supplier shop performance page"*.
 *
 * Properties:
 *   1 · the words are the shipped badges' own: every badge worn today (`shopBadges`) and the next step with how far
 *       (`nextToEarnLine`); a refused read is "—" + "Couldn’t load", never "none" and never "0 to go";
 *   2 · 🎠 since 11 Nov 2026 (owner: *"Analytics should be the carousel"* · *"The badge row stays directly under the
 *       carousel"*) the badges ARE the Shop tab's one badge row, directly under the Analytics carousel — built on the
 *       shipped tracker (`badgeTracker` + its rewards), each badge rising to its progress. Analytics draws no second
 *       copy (the old "Your badges" block would have shown the same badges twice on one scroll);
 *   3 · the tracker facts are read ONCE on the Shop tab; the Analytics section reads them only for the reputation card's
 *       ring, never to draw badges;
 *   4 · Today's earned line stays (it announces a NEW badge once; no ruling moves it).
 *   5 · 📣🗺 ONE HOME (owner 2026-11-06, DECISION_LOG "ONE HOME FOR EVERY PROMOTE TOOL"): the ONE badge tracker is the
 *       Shop tab's badge row; Shop › Page keeps the badge pills only — no tracker, no second drawing of it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { badgeShelf, badgeTracker, type ShopBadgeFacts } from '@/lib/shop-badges';

const WEB = join(import.meta.dirname, '..', '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const facts = (over: Partial<ShopBadgeFacts> = {}): ShopBadgeFacts => ({
  verified: true,
  completedEvents: 46,
  trusted: { trusted_avg_rating: 4.8, trusted_review_count: 12 },
  inBusinessSinceYear: 2019,
  awards: [],
  nowYear: 2026,
  ...over,
});

test('1 · every badge worn today, and the next step with how far', () => {
  const s = badgeShelf(facts());
  assert.equal(s.measured, true);
  assert.deepEqual(s.pills.map((p) => p.key), ['verified', 'milestone:10', 'rating', 'years']);
  assert.equal(s.next, 'Next to earn: 50 events · Silver · 4 to go');
  assert.equal(badgeShelf(facts({ completedEvents: 10_000 })).next, 'Every milestone earned');
});

test('1 · ⛔ a refused read is said — never "none", never "0 to go"', () => {
  const refused = badgeShelf(null);
  assert.equal(refused.measured, false);
  assert.equal(refused.next, '—');
  assert.deepEqual(refused.pills, []);
  const uncounted = badgeShelf(facts({ completedEvents: null }));
  assert.equal(uncounted.next, 'Next to earn: —');
  assert.ok(!uncounted.pills.some((p) => p.kind === 'milestone'), 'an uncounted milestone is claimed');
  const row = src('app/vendor-dashboard/shop/_components/shop-badge-row.tsx');
  assert.match(row, /\{tiles === null \? \(/, 'the unread state is not drawn first');
  assert.match(row, /Couldn&rsquo;t load your badges just now\./);
});

test('2 · the badges are the Shop tab’s one row, directly under the carousel — Analytics draws no second copy', () => {
  const shop = src('app/vendor-dashboard/shop/page.tsx');
  const render = shop.slice(shop.indexOf('<OneAnalyticsSection'));
  assert.match(render, /^<OneAnalyticsSection \{\.\.\.data\.analytics\} \/>\s*<\/Suspense>\s*(?:\{\s*\}\s*)*<ShopBadgeRow tiles=\{data\.badges\} \/>/, 'the badge row is not directly under the carousel');
  // Built on the shipped tracker, never beside it.
  assert.match(shop, /const rows = facts \? \(rewards \? badgeRowsWithRewards\(badgeTracker\(facts\), rewards\) : badgeTracker\(facts\)\) : null;/);
  for (const f of ['analytics-carousel.tsx', 'analytics-growing.tsx', 'one-analytics-section.tsx', 'graph-tile.tsx']) {
    const a = src(`app/vendor-dashboard/performance/_components/${f}`);
    assert.doesNotMatch(a, /<YourBadges\b|<ShopBadgePill\b|<ShopBadgeRow\b|badgeTracker\(|badgeShelf\(/, `${f} draws the badges a second time`);
  }
});

test('3 · the tracker facts are read once on the Shop tab; Analytics reads them for the ring only', () => {
  const shop = src('app/vendor-dashboard/shop/page.tsx');
  assert.equal([...shop.matchAll(/readShopTrackerFacts\(/g)].length, 1, 'the Shop tab reads the tracker facts more than once');
  const section = src('app/vendor-dashboard/performance/_components/one-analytics-section.tsx');
  assert.equal([...section.matchAll(/readShopTrackerFacts\(/g)].length, 1, 'the Analytics section reads the tracker facts more than once');
  assert.match(section, /const ladder = badgeFacts && badgeFacts\.completedEvents !== null \? milestoneLadder\(badgeFacts\.completedEvents\) : null;/);
});

test('4 · Today’s earned line stays', () => {
  assert.match(src('app/vendor-dashboard/page.tsx'), /BadgeEarnedLine/, 'Today’s “You earned …” line was removed without a ruling');
});

test('5 · 📣🗺 the ONE tracker is the Shop tab’s badge row; Shop › Page keeps the pills only', () => {
  const view = src('app/vendor-dashboard/shop/_components/shop-badge-row.tsx');
  // The tracker's row: each badge in its progress ring, rising to Now · the bar · the next goal · its reward.
  for (const a of ['<ProgressRing', '<RiseScreen', 'nextGoalLine(', 'nowLine(']) {
    assert.ok(view.includes(a), `the badge row lost the tracker’s ${a}`);
  }
  // The rows are the shipped composer's, on the facts the page already read — a refused read draws no rows.
  const rows = badgeTracker({ ...facts(), unreviewed: 2 });
  assert.deepEqual(rows.map((r) => r.kind), ['verified', 'milestone', 'rating', 'years']);
  assert.equal(rows.find((r) => r.kind === 'milestone')?.stateWord, '4 to go');

  // Shop › Page: the pills, and nothing of the tracker.
  const parts = src('app/vendor-dashboard/website/_components/page-parts.tsx');
  const fold = parts.slice(parts.indexOf('anchor="badges"'), parts.indexOf('</Fold>', parts.indexOf('anchor="badges"')));
  assert.ok(fold.length > 0, 'the Awards and badges fold is gone');
  assert.match(fold, /<ShopBadgePill key=\{b\.key\} badge=\{b\}/, 'Page lost the badge pills');
  assert.doesNotMatch(fold, /BadgeTracker|progressbar|data-badge-row|r\.door|Save to print/, 'Page still draws the tracker');
  assert.doesNotMatch(parts, /from '\.\/badge-tracker'/);
  const data = src('app/vendor-dashboard/website/page-data.ts');
  assert.doesNotMatch(data, /badgeTracker\(|readShopTrackerFacts\(|nextToEarnLine\(/, 'Page still composes the tracker');
  assert.match(data, /pills: shopBadges\(badgeFacts\)/);
  // No go-elsewhere link between the two homes.
  assert.doesNotMatch(fold + view, /Edit in |↗/);
});

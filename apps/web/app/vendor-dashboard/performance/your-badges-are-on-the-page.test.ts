/**
 * 🏅 THE SHOP'S BADGES ARE ON SHOP › HOW IT IS GOING — owner, verbatim, 2026-10-29: *"Their badges will be on the
 * supplier shop performance page"*.
 *
 * Properties:
 *   1 · the words are the shipped badges' own: every badge worn today (`shopBadges`) and the next step with how far
 *       (`nextToEarnLine`); a refused read is "—" + "Couldn’t load", never "none" and never "0 to go";
 *   2 · drawn by THE one pill (`ShopBadgePill`) — no second badge drawing;
 *   3 · read in the page's own batch — started once, awaited inside Batch A (no extra round trip), and shown on the
 *       tier upsell too (a badge is not a paid feature);
 *   4 · Today's earned line stays (it announces a NEW badge once; no ruling moves it).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { badgeShelf, type ShopBadgeFacts } from '@/lib/shop-badges';

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
  const view = src('app/vendor-dashboard/performance/_components/your-badges.tsx');
  assert.match(view, /!shelf\.measured \? \(/, 'the unread state is not drawn first');
  assert.match(view, /Couldn’t load your badges just now\./);
});

test('2 · drawn by THE one pill — no second drawing', () => {
  const view = src('app/vendor-dashboard/performance/_components/your-badges.tsx');
  assert.match(view, /import \{ ShopBadgePill \} from '@\/app\/_components\/shop-badge-pill';/);
  assert.match(view, /<ShopBadgePill key=\{b\.key\} badge=\{b\}/);
  assert.doesNotMatch(view, /<svg|rounded-full border/, 'a second badge drawing');
});

test('3 · read once, inside the page’s own batch, and shown on the upsell too', () => {
  const page = src('app/vendor-dashboard/performance/page.tsx');
  assert.equal([...page.matchAll(/readShopBadgeFacts\(/g)].length, 1, 'the badges are read more than once');
  assert.match(page, /const badgeFactsRead: Promise<ShopBadgeFacts \| null> = safeRead\(\s*readShopBadgeFacts\(createAdminClient\(\), profile\.vendor_profile_id\),\s*null,/);
  const batchStart = page.indexOf('marketRegionRow,\n    pricePosition,\n    badgeFacts,\n  ] = await Promise.all([');
  assert.ok(batchStart > 0, 'the badges are not part of Batch A');
  const batch = page.slice(batchStart, page.indexOf(']);', batchStart));
  assert.match(batch, /\n\s*badgeFactsRead,\s*$/, 'Batch A does not await the badges');
  assert.match(page, /const shelf = badgeShelf\(badgeFacts\);/);
  assert.match(page, /<YourBadges shelf=\{shelf\} \/>/);
  // The upsell (free / verified tiers when the gate is on) shows them too.
  const gated = page.slice(page.indexOf('if (gateOn && !canSeePerformanceTrends(tier))'), batchStart);
  assert.match(gated, /<YourBadges shelf=\{gatedShelf\} \/>/);
});

test('4 · Today’s earned line stays', () => {
  assert.match(src('app/vendor-dashboard/page.tsx'), /BadgeEarnedLine/, 'Today’s “You earned …” line was removed without a ruling');
});

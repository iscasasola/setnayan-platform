/**
 * ⭐ THE SHOP'S ONE RATING (L6 · S2, walk 27 Nov 2026) — Analytics said 4.2 ★ (the Bayesian ranking average), Your page
 * said 4.7 ★ (the raw average), the public page drew none. One source now: the trusted aggregate couples are shown,
 * said by one rule (`lib/shop-rating.ts`).
 *   1 · the words: refused ≠ none ≠ rated.
 *   2 · every supplier surface that prints the shop's rating reads it through `shopRatingOf` — and no longer prints the
 *       Bayesian or the raw average as "your rating".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { shopRatingCountWords, shopRatingFigure, shopRatingOf, shopRatingWords } from './shop-rating';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · refused is "Couldn’t load", no trusted review is "No reviews yet", a rating is its figure and count', () => {
  assert.deepEqual(shopRatingOf(null), { state: 'unread' });
  assert.deepEqual(shopRatingOf(undefined), { state: 'unread' });
  assert.deepEqual(shopRatingOf({ trusted_avg_rating: 0, trusted_review_count: 0 }), { state: 'none' });
  assert.deepEqual(shopRatingOf({ trusted_avg_rating: 4.7, trusted_review_count: 0 }), { state: 'none' }, 'an average with no review is no rating');
  assert.deepEqual(shopRatingOf({ trusted_avg_rating: '4.70', trusted_review_count: '12' }), { state: 'rated', average: 4.7, count: 12 });
  assert.equal(shopRatingWords(shopRatingOf(null)), 'Couldn’t load');
  assert.equal(shopRatingWords(shopRatingOf({ trusted_avg_rating: null, trusted_review_count: null })), 'No reviews yet');
  assert.equal(shopRatingWords(shopRatingOf({ trusted_avg_rating: 4.66, trusted_review_count: 12 })), '4.7 ★ · 12 reviews');
  assert.equal(shopRatingWords(shopRatingOf({ trusted_avg_rating: 5, trusted_review_count: 1 })), '5.0 ★ · 1 review');
  assert.equal(shopRatingFigure({ state: 'none' }), null);
  assert.equal(shopRatingCountWords({ state: 'unread' }), null);
});

test('2 · Shop, Analytics and Your page read the one rating — never the Bayesian or the raw average', () => {
  const analytics = read('app/vendor-dashboard/performance/_components/one-analytics-section.tsx');
  assert.match(analytics, /fetchTrustedReviewStatsRead\(supabase, profile\.vendor_profile_id\)/, 'Analytics no longer reads the trusted aggregate');
  assert.match(analytics, /const shopRating = shopRatingOf\(trustedRating\)/);
  assert.match(analytics, /rating: ratingLine\(shopRating\)/);
  assert.doesNotMatch(analytics, /ratingAvg:\s*statsRow\?\.review_avg_bayesian/, 'Analytics prints the Bayesian ranking average as the rating again');

  const doing = read('lib/business-doing.ts');
  assert.doesNotMatch(doing, /review_avg_bayesian/, 'the rating line reads the Bayesian average again');
  assert.match(doing, /shopRatingWords\(rating\)/);

  const page = read('app/vendor-dashboard/website/page-data.ts');
  assert.match(page, /const shopRating = shopRatingOf\(badgeFacts\.trusted\)/, 'Your page no longer reads the trusted aggregate');
  assert.doesNotMatch(page, /avg_rating_overall/, 'Your page prints the raw average again');

  const shop = read('app/vendor-dashboard/shop/page.tsx');
  assert.match(shop, /const shopRating = shopRatingOf\(facts\?\.trusted \?\? null\)/);
  assert.match(shop, /rating: shopRatingFigure\(shopRating\)/);

  const growth = read('app/vendor-dashboard/performance/_components/growth-view.ts');
  assert.doesNotMatch(growth, /cov\.avgRating/, 'the reputation card prints its own average again');
});

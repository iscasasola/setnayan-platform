/** FINAL CHECK A1-127: Share shares, copies, or says why it could not — never a silent press, never a false "Copied". */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '../../../../lib/strip-comments';

const src = stripComments(readFileSync(join(process.cwd(), 'app/v/[slug]/_components/share-button.tsx'), 'utf8'));

test('a failed copy tells the person, with the way to try again', () => {
  assert.doesNotMatch(src, /catch \{\s*\}/, 'a swallowed failure is back');
  assert.match(src, /toast\.error\(SHARE_FAILED_MESSAGE\)/);
  assert.match(src, /Press Share to try again/);
});

test('no clipboard is a failure, not a false "Copied"', () => {
  assert.match(src, /if \(!nav\?\.clipboard\?\.writeText \|\| !url\) throw/);
});

test('closing the share sheet is not reported as a failure', () => {
  assert.match(src, /e\.name === 'AbortError'\) return;/);
});

test('🔒 a refused rating read is said on the shop page, never "none yet" (A1-129)', () => {
  const page = stripComments(readFileSync(join(process.cwd(), 'app/v/[slug]/page.tsx'), 'utf8'));
  assert.match(page, /fetchTrustedReviewStatsRead\(admin, vendor\.vendor_profile_id\)/);
  assert.match(page, /const starsNote = trustedFailed\s*\?\s*'Couldn’t load the rating just now\. Reload to try again\.'/);
  const reviews = stripComments(readFileSync(join(process.cwd(), 'lib/reviews.ts'), 'utf8'));
  assert.match(reviews, /if \(error\) \{[\s\S]{0,140}return null;/);
});

test('🔒 "Show more reviews" stops when the public list runs out (A1-130)', () => {
  const page = stripComments(readFileSync(join(process.cwd(), 'app/v/[slug]/page.tsx'), 'utf8'));
  assert.match(page, /const hasMore = (?:!reviewsReadFailed && )?reviews\.length >= limit && reviewStats\.total_count > reviews\.length;/);
});

test('🔒 an unverified shop hands its cards no reviews (A1-131)', () => {
  const page = stripComments(readFileSync(join(process.cwd(), 'app/v/[slug]/page.tsx'), 'utf8'));
  assert.match(page, /reviewsByService: isVerifiedShop \? reviewsByService : new Map<string, CardReviews>\(\),/);
});

test('🔒 only a verified Trusted partner wears the check badge (A1-139)', () => {
  const tile = stripComments(readFileSync(join(process.cwd(), 'app/v/[slug]/_components/trusted-by-carousel.tsx'), 'utf8'));
  assert.match(tile, /\{tile\.verified \? \([\s\S]{0,300}<BadgeCheck/);
  const page = stripComments(readFileSync(join(process.cwd(), 'app/v/[slug]/page.tsx'), 'utf8'));
  assert.match(page, /verified: v\.isVerified,/);
});

test('🔒 the 3D booth has a way back and treats an expired plan as Free (A1-126, A1-136)', () => {
  const booth = stripComments(readFileSync(join(process.cwd(), 'app/v/[slug]/booth/page.tsx'), 'utf8'));
  assert.match(booth, /<BoothShowcaseLoader[^>]*\/>[\s\S]{0,300}<Link href=\{shopHref\}/, 'the booth has no way back to the shop');
  assert.match(booth, /boothTierCanBrand\(effectiveSeoTier\(\{ tier_state: vendor\.tier_state, tier_expires_at: vendor\.tier_expires_at \}\)\)/);
});

test('🔒 the guest review page and the story page follow the shop page’s public rules (A1-132, A1-133, A1-134, A1-135)', () => {
  const gr = stripComments(readFileSync(join(process.cwd(), 'app/v/[slug]/guest-review/page.tsx'), 'utf8'));
  assert.match(gr, /shopPageGate\(shopRow as ShopPageGateRow,[\s\S]{0,120}\.open !== 'public'\) \{\s*notFound\(\);/, 'a hidden shop is named on the guest review page');
  assert.doesNotMatch(gr, /\|\| 'the'\}’s/, 'a missing name reads "the’s wedding" again');
  assert.match(gr, /const BOOKED: readonly string\[\] = BOOKED_EVENT_VENDOR_STATUSES;/);
  const act = stripComments(readFileSync(join(process.cwd(), 'app/v/[slug]/guest-review/actions.ts'), 'utf8'));
  assert.doesNotMatch(act, /\|\| 'you';/, '"Thank you, you" is back');
  const story = stripComments(readFileSync(join(process.cwd(), 'lib/ultra-story-pages.server.ts'), 'utf8'));
  assert.match(story, /\.from\('vendor_reviews_public'\)\s*\.select\('rating_overall, body, voided_by_fraud'\)/);
});

test('🔒 review words fit every event type and every booking (A1-137, A1-140)', () => {
  const vm = stripComments(readFileSync(join(process.cwd(), 'app/v/[slug]/_components/venue-matched-events.tsx'), 'utf8'));
  assert.doesNotMatch(vm, /Recent weddings|Weddings at your venue/);
  const page = stripComments(readFileSync(join(process.cwd(), 'app/v/[slug]/page.tsx'), 'utf8'));
  assert.doesNotMatch(page, />\s*Verified wedding\s*</);
  assert.doesNotMatch(page, /From verified couples who&rsquo;ve booked/);
  assert.doesNotMatch(page, /`₱\$\{[^`]*toLocaleString\('en-PH'/, 'a peso is formatted outside lib/php.ts again');
  const med = stripComments(readFileSync(join(process.cwd(), 'lib/verified-median.ts'), 'utf8'));
  assert.doesNotMatch(med, /`₱\$\{/);
});

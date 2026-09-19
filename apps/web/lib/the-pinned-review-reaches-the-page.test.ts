import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { pinReviewFirst } from '@/lib/reviews';

/**
 * S43 · 4 — pinning a review older than the newest 5 changed nothing on the
 * public shop page: the page only reordered the loaded window, and its own
 * comment said an older pin "simply isn't surfaced". Now it is fetched.
 */

type R = { review_id: string; body: string };
const r = (id: string): R => ({ review_id: id, body: id });
const window5 = ['a', 'b', 'c', 'd', 'e'].map(r);

test('a pin inside the window moves to the top, nothing added', () => {
  const out = pinReviewFirst(window5, 'c', null);
  assert.deepEqual(out.map((x) => x.review_id), ['c', 'a', 'b', 'd', 'e']);
});

test('a pin OLDER than the window is shown first — the case that used to vanish', () => {
  const out = pinReviewFirst(window5, 'z', r('z'));
  assert.deepEqual(out.map((x) => x.review_id), ['z', 'a', 'b', 'c', 'd', 'e']);
});

test('the pinned review is never shown twice', () => {
  const out = pinReviewFirst(window5, 'c', r('c'));
  assert.equal(out.filter((x) => x.review_id === 'c').length, 1);
});

test('no pin, or a stale / foreign pin that fetched nothing, leaves the list as it was', () => {
  assert.deepEqual(pinReviewFirst(window5, null, null), window5);
  assert.deepEqual(pinReviewFirst(window5, 'z', null), window5);
  // A fetched row that is not the pinned one is not promoted.
  assert.deepEqual(pinReviewFirst(window5, 'z', r('y')), window5);
});

test('the shop page fetches the pin when it is outside the window, scoped to this vendor', () => {
  const page = stripComments(readFileSync(join(process.cwd(), 'app/v/[slug]/page.tsx'), 'utf8'));
  assert.ok(page.length > 50_000, 'read the real page (an empty read is a green lie)');
  const fetches = [...page.matchAll(/fetchReviewForVendorWithCouple\(\s*admin,\s*vendor\.vendor_profile_id,\s*pinnedReviewId,?\s*\)/g)].length;
  assert.equal(fetches, 1, `the out-of-window pin fetch is missing (found ${fetches})`);
  assert.match(page, /const orderedReviews = pinReviewFirst\(reviews, pinnedReviewId, pinnedOutsideWindow\);/);
  assert.match(page, /const pinnedReviewId = premiumLayout \? microsite\.pinnedReviewId : null;/, 'the pin must stay a Pro perk');
  assert.match(page, /reviews=\{orderedReviews\}/, 'the review list stopped rendering the ordered set');
});

test('the single-review read is scoped to the vendor, so a foreign id cannot be pinned onto a shop', () => {
  const lib = stripComments(readFileSync(join(process.cwd(), 'lib/reviews.ts'), 'utf8'));
  const start = lib.indexOf('export async function fetchReviewForVendorWithCouple');
  assert.ok(start > 0);
  const body = lib.slice(start, lib.indexOf('\n}\n', start));
  assert.match(body, /\.eq\('vendor_profile_id', vendorProfileId\)/);
  assert.match(body, /\.eq\('review_id', reviewId\)/);
  assert.match(body, /if \(error\) throw/, 'a refused read must not look like "no such review"');
});

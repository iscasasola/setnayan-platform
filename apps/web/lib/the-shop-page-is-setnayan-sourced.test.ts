/**
 * the-shop-page-is-setnayan-sourced.test.ts — 💳 a couple who found the shop on Setnayan is Setnayan-sourced; a couple
 * who came through the supplier's own QR / link is the supplier's own (owner 2026-11-13, DECISION_LOG "THE SUPPLIER'S
 * PERSONAL QR IS FREE; THEIR SHOP PAGE IS CHARGED"; walk F-W1-58 — an in-app quote → ask → agree booking read "This
 * client did not come from Setnayan" and opened no fee).
 *
 * SABOTAGE (each run once and reverted before commit): drop 'shop_page' from SOURCED_INQUIRY_SOURCES → RED; make the
 * untagged arrival `null` again → RED; build the Today QR / Promote "My page" / door sticker / printed code with
 * `myPageUrl` again → RED. The SQL half (`booking_fee_is_sourced_surface`) is held equal to the TS set by the DB tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bookingFeeAttribution, SOURCED_INQUIRY_SOURCES } from '@/lib/booking-fee-gate';
import { isInquirySource } from '@/lib/inquiry-source';
import { arrivalInquirySourceOf, OWN_LINK_SRC, ownDatesUrl, ownPageUrl, ownReviewsUrl, myPageUrl, PROMOTE_QR_MODES } from '@/lib/supplier-qr-codes';
import { printQrUrl } from '@/lib/supplier-prints-shop';
import { reviewDoorTarget } from '@/lib/shop-review-door';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('a shop-page arrival is sourced; the supplier’s own link is not', () => {
  assert.ok(isInquirySource('shop_page'));
  assert.equal(bookingFeeAttribution('shop_page'), 'sourced');
  assert.ok(SOURCED_INQUIRY_SOURCES.has('shop_page'));
  assert.equal(bookingFeeAttribution('website'), 'import', 'the supplier’s own link stays their own client');
  assert.equal(bookingFeeAttribution(null), 'import');
});

test('the shop page stamps shop_page when untagged, website on ?src=own', () => {
  assert.match(code('app/v/[slug]/page.tsx'), /const arrivalInquirySource = arrivalInquirySourceOf\(search\.src\);/);
  assert.equal(arrivalInquirySourceOf(OWN_LINK_SRC), 'website');
  assert.equal(arrivalInquirySourceOf(undefined), 'shop_page', 'an untagged arrival must be shop_page, never null');
  assert.equal(arrivalInquirySourceOf('explore'), 'explore');
  assert.equal(arrivalInquirySourceOf('anything-else'), 'shop_page');
  assert.equal(OWN_LINK_SRC, 'own');
  assert.equal(ownPageUrl('https://www.setnayan.com', 'titanena'), `${myPageUrl('https://www.setnayan.com', 'titanena')}?src=own`);
});

test('RW-19 · every Promote code the supplier hands out is tagged as theirs (the shortlist code is the invite, never the shop)', () => {
  const O = 'https://www.setnayan.com';
  const want: Record<string, string> = {
    dates: `${O}/v/titanena/dates?src=own`,
    page: `${O}/v/titanena?src=own`,
    reviews: `${O}/v/titanena/review?src=own`,
  };
  assert.deepEqual([...PROMOTE_QR_MODES].sort(), ['dates', 'page', 'reviews', 'shortlist']);
  for (const mode of PROMOTE_QR_MODES) {
    const url = printQrUrl(mode, O, 'titanena');
    if (mode === 'shortlist') assert.match(url, /\/vendor-invite\/titanena/, 'the shortlist code adds the couple through the invite');
    else assert.equal(url, want[mode], `the ${mode} code`);
  }
  assert.equal(ownDatesUrl(O, 'titanena'), want.dates);
  assert.equal(ownReviewsUrl(O, 'titanena'), want.reviews);
  assert.match(code('lib/check-a-date-qr.ts'), /const url = ownDatesUrl\(origin, slug\);/, 'Promote’s Check a date code');
  assert.match(code('app/api/vendor/door-sticker/route.ts'), /code === 'dates' \? ownDatesUrl\(siteOrigin\(\), slug\)/);
  assert.match(code('app/vendor-dashboard/shop/promote/_components/promote-body.tsx'), /const reviewsUrl = printQrUrl\('reviews', origin, slug!\);/);
});

test('RW-19 · an own arrival keeps its tag on the way to the shop: dates → shop, the ask on dates, the review door', () => {
  const dates = code('app/v/[slug]/dates/page.tsx');
  assert.match(dates, /const shopHref = withShopArrival\(`\/v\/\$\{encodeURIComponent\(slug\)\}`, arrival\);/);
  assert.match(dates, /inquirySource=\{arrivalInquirySourceOf\(search\.src\)\}/, 'the ask on Check a date is stamped by the same rule');
  assert.match(code('app/v/[slug]/dates/_components/check-a-date-calendar.tsx'), /checkDateAskLine\(day\) \},\s*inquirySource,/);
  assert.equal(reviewDoorTarget({ kind: 'read', slug: 'titanena', reason: 'no_booking' } as never, 'own'), '/v/titanena?src=own#reviews');
  assert.equal(reviewDoorTarget({ kind: 'moved', slug: 'titanena' } as never, 'own'), '/v/titanena/review?src=own');
  assert.equal(reviewDoorTarget({ kind: 'sign_in', next: '/v/titanena/review' } as never, 'own'), `/login?next=${encodeURIComponent('/v/titanena/review?src=own')}`);
  assert.equal(reviewDoorTarget({ kind: 'read', slug: 'titanena', reason: 'no_booking' } as never, 'evil'), '/v/titanena#reviews', 'only the own tag is carried');
  assert.match(code('app/v/[slug]/review/route.ts'), /reviewDoorTarget\(door, request\.nextUrl\.searchParams\.get\('src'\)\)/);
});

test('every code or link the SUPPLIER hands out is tagged as theirs', () => {
  assert.match(code('app/vendor-dashboard/page.tsx'), /const qrUrl = details\.slug \? ownPageUrl\(/);
  assert.match(code('app/vendor-dashboard/shop/page.tsx'), /const shareUrl = data\.slug \? ownPageUrl\(/);
  assert.match(code('app/vendor-dashboard/shop/promote/_components/promote-body.tsx'), /const pageUrl = ownPageUrl\(/);
  assert.match(code('app/api/vendor/door-sticker/route.ts'), /ownPageUrl\(siteOrigin\(\), slug\)/);
  assert.match(code('lib/supplier-prints-shop.ts'), /if \(mode === 'page'\) return ownPageUrl\(origin, slug\);/);
  assert.match(code('lib/supplier-prints-shop.ts'), /if \(mode === 'reviews'\) return ownReviewsUrl\(origin, slug\);/);
  assert.match(code('lib/supplier-prints-shop.ts'), /return ownDatesUrl\(origin, slug\);/);
});

test('the migration adds shop_page to the CHECK and to the sourced surfaces', () => {
  const sql = readFileSync(join(WEB, '..', '..', 'supabase/migrations/20271345227050_shop_page_inquiry_is_setnayan_sourced.sql'), 'utf8');
  assert.match(sql, /'explore', 'search',\s*'shop_page'\s*\)\);/);
  assert.match(sql, /'favorites', 'auto_build', 'editorial', 'influencer',\s*'shop_page'/);
});

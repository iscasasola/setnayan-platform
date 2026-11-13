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
import { OWN_LINK_SRC, ownPageUrl, myPageUrl } from '@/lib/supplier-qr-codes';
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
  const page = code('app/v/[slug]/page.tsx');
  const at = page.indexOf('const arrivalInquirySource =');
  const expr = page.slice(at, page.indexOf(';', at));
  assert.match(expr, /search\.src === OWN_LINK_SRC\s*\?\s*'website'/);
  assert.match(expr, /:\s*'shop_page'$/, 'an untagged arrival must be shop_page, never null');
  assert.equal(OWN_LINK_SRC, 'own');
  assert.equal(ownPageUrl('https://www.setnayan.com', 'titanena'), `${myPageUrl('https://www.setnayan.com', 'titanena')}?src=own`);
});

test('every code or link the SUPPLIER hands out is tagged as theirs', () => {
  assert.match(code('app/vendor-dashboard/page.tsx'), /const qrUrl = details\.slug \? ownPageUrl\(/);
  assert.match(code('app/vendor-dashboard/shop/page.tsx'), /const shareUrl = data\.slug \? ownPageUrl\(/);
  assert.match(code('app/vendor-dashboard/shop/promote/_components/promote-body.tsx'), /const pageUrl = ownPageUrl\(/);
  assert.match(code('app/api/vendor/door-sticker/route.ts'), /ownPageUrl\(siteOrigin\(\), slug\)/);
  assert.match(code('lib/supplier-prints-shop.ts'), /if \(mode === 'page'\) return ownPageUrl\(origin, slug\);/);
});

test('the migration adds shop_page to the CHECK and to the sourced surfaces', () => {
  const sql = readFileSync(join(WEB, '..', '..', 'supabase/migrations/20271345227050_shop_page_inquiry_is_setnayan_sourced.sql'), 'utf8');
  assert.match(sql, /'explore', 'search',\s*'shop_page'\s*\)\);/);
  assert.match(sql, /'favorites', 'auto_build', 'editorial', 'influencer',\s*'shop_page'/);
});

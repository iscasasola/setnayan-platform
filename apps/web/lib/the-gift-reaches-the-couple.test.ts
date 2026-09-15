/**
 * the-gift-reaches-the-couple.test.ts — the WIRING of the Setnayan gift (C1).
 *
 * The arithmetic is proved in lib/setnayan-gift.test.ts and, against the real
 * catalog, in tests/db/the-gift-reaches-the-couple.db.test.ts. What neither can
 * see is whether the three production doors are still CONNECTED to it — and a
 * disconnected door fails silently:
 *   • the approval hook stops calling the grant → the supplier pays for photos
 *     the couple never receives, and nothing throws;
 *   • the quote stops asking → the gift is billed but never named at the moment
 *     of decision, which is the whole point of it;
 *   • the couple's quote line starts quoting pesos → "₱1,000 of credits" instead
 *     of "1,429 free photos", the one thing the owner said never to do.
 * Source is read with comments stripped (lib/strip-comments.ts), so a docblock
 * that merely MENTIONS a call cannot satisfy these.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { giftQuoteCopy } from './setnayan-gift';

const WEB = join(import.meta.dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the vendor_booking_fee__ approval hook lands the gift after settling the charge', () => {
  const src = code('lib/sku-activation.ts');
  // The hook body that settles the booking-fee charge …
  const settle = src.indexOf("settleBookingFeeCharge(ctx.admin, chargeId, 'manual', ctx.orderId)");
  assert.ok(settle > 0, 'the booking-fee hook still settles the charge');
  // … must, in the same hook, call the gift grant (before the next hook opens).
  const nextHook = src.indexOf('match: (serviceKey)', settle);
  assert.ok(nextHook > settle, 'there is a hook after the booking-fee hook');
  const body = src.slice(settle, nextHook);
  assert.match(body, /await grantSetnayanGiftForBookingFee\(ctx, chargeId\)/);
  // … and that function really asks the database to grant, with this order.
  assert.match(
    src,
    /rpc\('booking_fee_grant_setnayan_gift', \{\s*p_charge_id: chargeId,\s*p_order_id: ctx\.orderId,/,
  );
});

test('the supplier’s bill is fee + gift, and names the photos', () => {
  const src = code('lib/booking-fee-lock.server.ts');
  assert.match(src, /select\('event_id, vendor_profile_id, gift_credits, gift_centavos'\)/);
  assert.match(src, /const amountPhp = \(feeCentavos \+ giftCentavos\) \/ 100;/);
  assert.match(src, /setnayanGiftBillClause\(feeCentavos, giftCredits, giftCentavos\)/);
});

test('the quote asks for the gift and tells the couple PHOTOS, never pesos', () => {
  const src = code('app/proposals/[publicId]/page.tsx');
  assert.match(src, /await quoteSetnayanGift\(createAdminClient\(\), \{/);
  assert.match(src, /amountCentavos: proposal\.total_centavos/);

  // ⚠ REPINNED 2026-09-15, TO MEANING RATHER THAN TO SHAPE.
  //
  // This used to match the page's two inline template literals character for
  // character. Those strings have MOVED into `giftQuoteCopy` — one copy now
  // serves this page and both quote composers — so the old patterns could only
  // ever fail, and "make the guard pass" would have meant re-typing a third
  // copy of the sentence: the exact drift the move removed.
  //
  // What must stay true is unchanged, and is now checked two ways instead of
  // one: the page renders the SHARED copy for the right audience, and the
  // couple's words are EXECUTED and inspected rather than grepped — which a
  // literal match never did.
  assert.match(src, /giftQuoteCopy\(gift, isVendorSide \? 'supplier' : 'couple'/,
    'the page must render the shared copy, for the audience actually looking');
  assert.ok(
    !/Includes (a|your) Setnayan gift/.test(src),
    'a re-typed gift sentence is back on the page — there must be exactly one copy',
  );

  const couple = giftQuoteCopy({ credits: 1_429, chargeCentavos: 100_000 }, 'couple', {
    businessName: 'Studio Vera',
  });
  assert.ok(couple, 'the couple is told the photo count');
  assert.match(couple.headline, /1,429 free Papic photos/);
  for (const line of [couple.headline, couple.detail]) {
    assert.doesNotMatch(line, /₱|formatCentavos|chargeCentavos|peso/i, `no pesos to the couple: ${line}`);
  }
});

test('the quote’s count comes from the shared derivation, not a local formula', () => {
  const src = code('lib/setnayan-gift.server.ts');
  assert.match(src, /rpc\('setnayan_gift_quote_applies'/);
  assert.match(src, /if \(error \|\| applies !== 'applies'\) return null;/);
  assert.match(src, /bookingFeePhp\(args\.amountCentavos \/ 100, schedule\)/);
  assert.match(src, /setnayanGiftForFee\(feeCentavos, ladder\)/);
  // No rung price typed into the quote path.
  assert.doesNotMatch(src, /15_?000|\b70\b|0\.7\b/);
});

/**
 * ⚖ OWNER 2026-11-17, verbatim: *"Returning to home in 5 seconds. tap to return
 * to Gifts."* — the sent screen is full screen, counts down to Home, and a tap
 * anywhere goes back to where they came from.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SENT_SCREEN_SECONDS, returnPlace, sentScreenWords } from './pay-sent-screen';
import { payBackLink, payHomeHref, SHOP_GIFTS_HREF } from './pay-back-link';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

test('five seconds, said as the owner said it', () => {
  assert.equal(SENT_SCREEN_SECONDS, 5);
  assert.equal(sentScreenWords(5, 'Back to Gifts').countdown, 'Returning to home in 5 seconds');
  assert.equal(sentScreenWords(1, 'Back to Gifts').countdown, 'Returning to home in 1 second');
  assert.equal(sentScreenWords(-2, 'x').countdown, 'Returning to home in 0 seconds');
  assert.equal(sentScreenWords(5, 'Back to Gifts').tap, 'Tap to return to Gifts');
  assert.equal(returnPlace(''), 'where you were');
});

const SHOP_GIFT = {
  orderId: 'o1',
  isBookingFee: false,
  eventId: null,
  vendorProfileId: 'v1',
  ownerUserId: 'u1',
  viewerUserId: 'u1',
  isShopGift: true,
};

test('a shop’s gift order returns to Gifts; home is the shop', () => {
  assert.deepEqual(payBackLink(SHOP_GIFT), { label: 'Back to Gifts', href: SHOP_GIFTS_HREF });
  assert.equal(payHomeHref(SHOP_GIFT), '/vendor-dashboard');
  // A shop's other bills keep their old way back.
  assert.equal(payBackLink({ ...SHOP_GIFT, isShopGift: false }).href, '/vendor-dashboard');
});

test('a couple’s order goes home to the couple dashboard', () => {
  const couple = { ...SHOP_GIFT, vendorProfileId: null, isShopGift: false, eventId: 'e1' };
  assert.equal(payHomeHref(couple), '/dashboard');
});

test('the sent screen is full screen, a real link, and counts down to Home', () => {
  const src = read('app/pay/[reference]/_components/sent-screen.tsx');
  assert.match(src, /className="fixed inset-0 /, 'the sent screen is not full screen');
  assert.match(src, /<a\s+href=\{backHref\}/, 'the tap-anywhere target is not a real link');
  assert.match(src, /router\.replace\(homeHref\)/, 'the countdown does not go Home');
  assert.match(src, /\{words\.countdown\}/, 'the countdown is not visible');
  const page = read('app/pay/[reference]/page.tsx');
  assert.match(page, /const justSent = search\.sent === '1' && !needsBetterProof;/);
  assert.match(page, /<SentScreen\s+homeHref=\{payable\.home\}/);
});

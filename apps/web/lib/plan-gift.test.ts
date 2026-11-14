/**
 * A PLAN SETNAYAN GAVE — Today's line and door, the Plan page's words, and the photos row
 * (prototype `supplier_personal_invite_2026-10-23.html` frames B6 · C1 · C2 · C3).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  giftDoorWords,
  giftEndedLine,
  giftPlanLine,
  giftShopLine,
  planGiftOf,
  portfolioPlanRowLine,
} from './plan-gift';
import { portfolioPhotoCap, portfolioOverCapMessage, PORTFOLIO_FREE_BASE, PORTFOLIO_OVER_BASE_MESSAGE } from './vendor-tier-caps';

const END = '2027-01-31T15:59:59.000Z'; // 31 Jan 2027, 23:59:59 Manila
const NOW_EARLY = Date.parse('2026-11-01T00:00:00Z');
const NOW_LAST_WEEK = Date.parse('2027-01-25T00:00:00Z');

test('only an admin comp on a paid plan with an end ahead is a gift', () => {
  const row = { tier_state: 'pro', tier_source: 'admin_comp', tier_expires_at: END };
  assert.deepEqual(planGiftOf(row, NOW_EARLY), { plan: 'Pro', untilDay: '2027-01-31', daysLeft: 92 });
  assert.equal(planGiftOf({ ...row, tier_source: 'self_serve' }, NOW_EARLY), null, 'a plan they paid for is not a gift');
  assert.equal(planGiftOf({ ...row, tier_state: 'free' }, NOW_EARLY), null);
  assert.equal(planGiftOf({ ...row, tier_expires_at: null }, NOW_EARLY), null, 'an open-ended comp has no end to say');
  assert.equal(planGiftOf(row, Date.parse('2027-02-02T00:00:00Z')), null, 'an ended gift is not running');
  assert.equal(planGiftOf({ ...row, tier_state: 'enterprise' }, NOW_EARLY)?.plan, 'Ultra');
});

test('Today: the Shop line names the gift, and counts down in its last week with a door', () => {
  const g = planGiftOf({ tier_state: 'pro', tier_source: 'admin_comp', tier_expires_at: END }, NOW_EARLY)!;
  assert.equal(giftShopLine(g), 'Pro · free until 31 Jan 2027 · from Setnayan');
  assert.equal(giftDoorWords(g), null, 'the door shows months early');
  const soon = planGiftOf({ tier_state: 'pro', tier_source: 'admin_comp', tier_expires_at: END }, NOW_LAST_WEEK)!;
  assert.equal(giftShopLine(soon), 'Pro · 7 days left on the gift');
  assert.deepEqual(giftDoorWords(soon), { title: 'Your free Pro ends 31 Jan', body: 'Keep Pro, or do nothing — Free from 1 Feb' });
});

test('Your plan: the gift in place of a price, and the end once it is over', () => {
  const g = planGiftOf({ tier_state: 'pro', tier_source: 'admin_comp', tier_expires_at: END }, NOW_EARLY)!;
  assert.equal(giftPlanLine(g), 'free until 31 Jan 2027 · a gift from Setnayan');
  assert.equal(giftEndedLine('Pro', '2027-01-31'), 'your Pro gift ended 31 Jan 2027');
});

test('the 100 photos are the shop’s, not the plan’s — the cap holds after the plan is Free', () => {
  assert.equal(portfolioPhotoCap('free', null), PORTFOLIO_FREE_BASE);
  assert.equal(portfolioPhotoCap('pro', 100), 100);
  assert.equal(portfolioPhotoCap('free', 100), 100, 'the gift ended and took the photos with it');
  assert.equal(portfolioPhotoCap('free', 10), PORTFOLIO_FREE_BASE, 'an allowance never lowers the base');
  assert.equal(portfolioOverCapMessage(PORTFOLIO_FREE_BASE), PORTFOLIO_OVER_BASE_MESSAGE);
  assert.equal(portfolioOverCapMessage(100), 'Your first 100 portfolio photos are free. More photos with Papic credits is coming soon.');
});

test('the photos row: C1 while the gift runs, C3 after, and the plain row for everyone else', () => {
  assert.equal(
    portfolioPlanRowLine({ held: 14, cap: 100, gifted: true, giftUntilDay: '2027-01-31', giftEnded: false }),
    '14 of 100 free · your gift, it stays after 31 Jan',
  );
  assert.equal(portfolioPlanRowLine({ held: 14, cap: 50, gifted: false, giftUntilDay: '2027-01-31', giftEnded: false }), '14 of 50 free');
  assert.equal(
    portfolioPlanRowLine({ held: 62, cap: 100, gifted: true, giftUntilDay: null, giftEnded: true }),
    '62 kept · 100 free (your gift) · more with Papic credits soon',
  );
  assert.equal(
    portfolioPlanRowLine({ held: 62, cap: 50, gifted: false, giftUntilDay: null, giftEnded: true }),
    '62 kept · 50 free · more with Papic credits soon',
  );
  assert.equal(portfolioPlanRowLine({ held: 80, cap: 50, gifted: false, giftUntilDay: null, giftEnded: false }), '80 kept · 50 free · more with Papic credits soon');
});

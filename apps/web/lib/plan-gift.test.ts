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

test('the photos row: no count on any plan, a gift or not (owner 2026-11-23 — storage is the only limit)', () => {
  assert.equal(portfolioPlanRowLine(14), '14 photos · no limit — your storage is the only one');
  assert.equal(portfolioPlanRowLine(1), '1 photo · no limit — your storage is the only one');
  assert.equal(portfolioPlanRowLine(0), '0 photos · no limit — your storage is the only one');
  assert.doesNotMatch(portfolioPlanRowLine(80), /free|Papic credits|kept/);
});

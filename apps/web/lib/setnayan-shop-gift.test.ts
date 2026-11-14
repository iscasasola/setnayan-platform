/**
 * 🎁 Setnayan gifts to a shop — the words the approved drawing (QSMD9BaefarMRNQAnMFiND) puts on the moment and on
 * Today. The rules of who may press what are the database's (tests/db/a-setnayan-gift-is-claimed-once.db.test.ts).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  claimedWords,
  planGiftEndedLine,
  planGiftEndingWords,
  planGiftNoticeStage,
  shopGiftMomentWords,
  shortPlanWord,
  type RunningPlanGift,
  type ShopGiftView,
} from './setnayan-shop-gift';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-14T04:00:00Z');

const plan = (over: Partial<ShopGiftView>): ShopGiftView => ({
  giftId: 'g',
  type: 'plan',
  planTier: 'enterprise',
  planDays: 28,
  currentTier: null,
  choices: [],
  claimed: false,
  ...over,
});

test('the short plan word drops "Supplier"', () => {
  assert.equal(shortPlanWord('enterprise'), 'Ultra');
  assert.equal(shortPlanWord('solo'), 'Plus');
  assert.equal(shortPlanWord('verified'), 'Free');
});

test('gift stock: Add to my gifts (frame 4)', () => {
  const w = shopGiftMomentWords({ ...plan({}), type: 'stock', stockLine: '3 × Papic 1000', choices: ['stock'] });
  assert.equal(w.title, 'Setnayan sent you gifts');
  assert.equal(w.what, '3 × Papic 1000 to give your couples');
  assert.deepEqual(w.buttons.map((b) => b.label), ['Add to my gifts']);
});

test('no plan: one button, Start it (frame 5)', () => {
  const w = shopGiftMomentWords(plan({ choices: ['start'] }));
  assert.equal(w.title, 'Setnayan sent you Supplier Ultra');
  assert.equal(w.what, 'Supplier Ultra on your own shop, for 28 days');
  assert.deepEqual(w.buttons.map((b) => b.label), ['Start it']);
});

test('a lower plan: Upgrade now leads, Start it when my plan ends second', () => {
  const w = shopGiftMomentWords(plan({ currentTier: 'pro', choices: ['now', 'after'] }));
  assert.deepEqual(
    w.buttons.map((b) => [b.label, b.main]),
    [
      ['Upgrade now', true],
      ['Start it when my plan ends', false],
    ],
  );
  assert.equal(w.lines[0], 'Try everything Ultra opens, on top of your Pro');
  assert.equal(w.lines[1], 'You’re on Supplier Pro now. Upgrade today, or have it start when Supplier Pro ends.');
});

test('the same plan: 28 more days of Supplier Ultra', () => {
  const w = shopGiftMomentWords(plan({ currentTier: 'enterprise', choices: ['extend'] }));
  assert.equal(w.title, '28 more days of Supplier Ultra');
  assert.deepEqual(w.buttons.map((b) => b.choice), ['extend']);
});

test('nothing to press yet: no button, says why', () => {
  const w = shopGiftMomentWords(plan({ currentTier: 'pro', choices: [] }));
  assert.equal(w.buttons.length, 0);
  assert.match(w.lines[0]!, /opens when the gift you are on now ends/);
});

const running = (over: Partial<RunningPlanGift> = {}): RunningPlanGift => ({
  giftId: 'g',
  tier: 'enterprise',
  startsAt: new Date(NOW - 7 * DAY).toISOString(),
  endsAt: new Date(NOW + 21 * DAY).toISOString(),
  returnTier: 'pro',
  extend: false,
  ...over,
});

test('no countdown: nothing before the last week, the 7-day stage in it, the 1-day stage on the last day', () => {
  assert.equal(planGiftNoticeStage(running(), NOW), null, '21 days left — no notice');
  const at = (daysLeft: number) => running({ endsAt: new Date(NOW + daysLeft * DAY).toISOString() });
  assert.equal(planGiftNoticeStage(at(7), NOW), 7);
  assert.equal(planGiftNoticeStage(at(2), NOW), 7);
  assert.equal(planGiftNoticeStage(at(1), NOW), 1);
  assert.equal(planGiftNoticeStage(at(0.1), NOW), 1);
  assert.equal(planGiftNoticeStage(at(-0.1), NOW), null, 'over');
  assert.equal(planGiftNoticeStage({ ...at(5), startsAt: new Date(NOW + DAY).toISOString() }, NOW), null, 'held, not started');
});

test('the ends-soon words: the end date in words, one Stay button, the catalogue price or none', () => {
  // 2026-11-21T04:00Z is Saturday 21 November in Manila.
  const g = running({ endsAt: '2026-11-21T04:00:00Z' });
  const w = planGiftEndingWords(g, 10000);
  assert.equal(w.title, 'Your Supplier Ultra gift ends Saturday 21 November');
  assert.equal(w.stay, 'Stay on Supplier Ultra');
  assert.equal(
    w.body,
    'Stay on Supplier Ultra for ₱10,000 every 28 days, or do nothing and your shop goes back to Supplier Pro that day, with nothing lost.',
  );
  assert.doesNotMatch(planGiftEndingWords(g, null).body, /₱/, 'no price read → no price, never a typed one');
  assert.match(planGiftEndingWords({ ...g, returnTier: null }, null).body, /goes back to Free that day/);
  assert.match(planGiftEndingWords({ ...g, extend: true }, null).body, /your Supplier Ultra ends then, as it would have/);
});

test('the day it ends: one plain line', () => {
  assert.equal(planGiftEndedLine({ tier: 'enterprise', returnTier: 'pro' }), 'Your Supplier Ultra gift has ended. Your shop is back on Supplier Pro.');
  assert.equal(planGiftEndedLine({ tier: 'pro', returnTier: null }), 'Your Supplier Pro gift has ended. Your shop is back on Free.');
});

test('what a press says', () => {
  assert.equal(claimedWords('stock', null), 'Added to your gifts.');
  assert.equal(claimedWords('now', 'enterprise'), 'You’re on Supplier Ultra now.');
  assert.equal(claimedWords('after', 'pro'), 'Supplier Pro starts when your plan ends.');
  assert.equal(claimedWords('extend', 'enterprise'), '28 days added to your Supplier Ultra.');
});

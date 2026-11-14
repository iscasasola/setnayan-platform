/**
 * 🎁 Setnayan gifts to a shop — the words the approved drawing (QSMD9BaefarMRNQAnMFiND) puts on the moment and on
 * Today. The rules of who may press what are the database's (tests/db/a-setnayan-gift-is-claimed-once.db.test.ts).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  claimedWords,
  giftEndsSoonNotice,
  runningGiftLine,
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

test('during the gift: "Ultra · gift · 21 of 28 days left"', () => {
  assert.equal(runningGiftLine(running(), NOW), 'Ultra · gift · 21 of 28 days left');
  assert.equal(giftEndsSoonNotice(running(), NOW, 4990), null, 'no notice before the last 7 days');
});

test('the last week: ends in N days, Stay at the catalogue price, Go back to the old plan', () => {
  const g = running({ startsAt: new Date(NOW - 23 * DAY).toISOString(), endsAt: new Date(NOW + 5 * DAY).toISOString() });
  const n = giftEndsSoonNotice(g, NOW, 4990);
  assert.ok(n);
  assert.equal(n.title, 'Your Ultra gift ends in 5 days');
  assert.equal(n.stay, 'Stay on Ultra · ₱4,990');
  assert.equal(n.goBack, 'Go back to Pro');
  assert.match(n.body, /Nothing is lost either way/);
  // No price read → the button names no price, never a typed one.
  assert.equal(giftEndsSoonNotice(g, NOW, null)?.stay, 'Stay on Ultra');
  // No plan before the gift → back to Free; days added to its own plan → nothing to go back to.
  assert.equal(giftEndsSoonNotice({ ...g, returnTier: null }, NOW, null)?.goBack, 'Go back to Free');
  assert.equal(giftEndsSoonNotice({ ...g, extend: true }, NOW, null)?.goBack, null);
  // One day left reads "1 day".
  assert.equal(giftEndsSoonNotice({ ...g, endsAt: new Date(NOW + 3_600_000).toISOString() }, NOW, null)?.title, 'Your Ultra gift ends in 1 day');
});

test('once over, nothing is drawn', () => {
  const g = running({ endsAt: new Date(NOW - 1).toISOString() });
  assert.equal(runningGiftLine(g, NOW), null);
  assert.equal(giftEndsSoonNotice(g, NOW, 4990), null);
});

test('what a press says', () => {
  assert.equal(claimedWords('stock', null), 'Added to your gifts.');
  assert.equal(claimedWords('now', 'enterprise'), 'You’re on Supplier Ultra now.');
  assert.equal(claimedWords('after', 'pro'), 'Supplier Pro starts when your plan ends.');
  assert.equal(claimedWords('extend', 'enterprise'), '28 days added to your Supplier Ultra.');
});

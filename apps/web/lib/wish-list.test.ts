/**
 * THE WISH LIST'S ARITHMETIC — `lib/wish-list.ts`.
 *
 * ⚖ Owner 2026-10-08: "it will accumulate all the gift and mark them one by
 * one" · "when amount is reached." · "per item". And from the design: a record
 * the couple removed never counts; a wish with no price never marks itself.
 *
 * Each test is one way those rulings could be quietly broken:
 *   · a removed (disputed) record still filling a meter;
 *   · a wish with no price marking itself got on the first peso;
 *   · a sum un-marking a wish the COUPLE marked by hand;
 *   · a gift toward one wish counted on another;
 *   · a purpose's projection being mistaken for the table's canonical list.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-08):
 *   • `counts()` ignoring `removed_at`            → "a removed record never counts" red;
 *   • `reachedPrice` returning true for no price  → "a wish with no price never reaches" red;
 *   • `gotAfterGifts` dropping the 'host' guard   → "the couple's own mark is never touched" red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ANY_GIFT,
  GIFT_RECORD_SELECT,
  GIFT_SUM_FIELDS,
  WISH_GUEST_FIELDS,
  WISH_ITEM_SELECT,
  countSent,
  gotAfterGifts,
  leftToReach,
  meterPercent,
  reachedPrice,
  sentByWish,
  sumSent,
  wishesInOrder,
  type GiftSumRow,
} from './wish-list';

const gift = (amount: number, wish: string | null = 'w1', removed: string | null = null): GiftSumRow => ({
  wish_item_id: wish,
  amount_php: amount,
  removed_at: removed,
});

test('gifts accumulate: the sum is every counted record', () => {
  assert.equal(sumSent([gift(2000), gift(2000)]), 4000);
  assert.equal(countSent([gift(2000), gift(2000)]), 2);
  assert.equal(sumSent([]), 0);
});

test('a removed record never counts', () => {
  const records = [gift(2000), gift(2500, 'w1', '2026-10-08T03:00:00Z')];
  assert.equal(sumSent(records), 2000);
  assert.equal(countSent(records), 1);
  assert.deepEqual(sentByWish(records).get('w1'), { sentPhp: 2000, gifts: 1 });
});

test('an amount that is not a real positive figure adds nothing', () => {
  const junk = [gift(Number.NaN), gift(-500), gift(0), gift(Number.POSITIVE_INFINITY)];
  assert.equal(sumSent(junk), 0);
  assert.equal(countSent(junk), 0);
});

test('per item: each wish keeps its own sum, and a gift toward no wish is "Any gift"', () => {
  const by = sentByWish([gift(2000, 'air'), gift(2000, 'air'), gift(3000, 'lug'), gift(5000, null)]);
  assert.deepEqual(by.get('air'), { sentPhp: 4000, gifts: 2 });
  assert.deepEqual(by.get('lug'), { sentPhp: 3000, gifts: 1 });
  assert.deepEqual(by.get(ANY_GIFT), { sentPhp: 5000, gifts: 1 });
  assert.equal(by.get('rice'), undefined, 'a wish nobody sent toward has no entry — the caller prints its price alone');
});

test('"when amount is reached" — exactly at, and beyond, the price', () => {
  assert.equal(reachedPrice(4500, 4000), false);
  assert.equal(reachedPrice(4500, 4500), true);
  assert.equal(reachedPrice(4500, 5200), true, 'money beyond the price stays on that wish');
});

test('a wish with no price never reaches', () => {
  assert.equal(reachedPrice(null, 1_000_000), false);
  assert.equal(reachedPrice(undefined, 1), false);
  assert.equal(reachedPrice(0, 1), false);
  assert.equal(leftToReach(null, 500), null);
  assert.equal(meterPercent(null, 500), null);
});

test('what is left, and the meter, for a priced wish', () => {
  assert.equal(leftToReach(4500, 4000), 500);
  assert.equal(leftToReach(4500, 5200), 0);
  assert.equal(meterPercent(4500, 0), 0);
  assert.equal(meterPercent(8900, 3000), 34);
  assert.equal(meterPercent(4500, 5200), 100, 'the meter never overflows its track');
});

test('got marks itself when the gifts reach the price, and un-marks when a record is taken back', () => {
  assert.deepEqual(gotAfterGifts({ price_php: 2500, got_by: null }, 2500), { got_by: 'auto' });
  assert.deepEqual(gotAfterGifts({ price_php: 2500, got_by: 'auto' }, 2000), { got_by: null });
  assert.equal(gotAfterGifts({ price_php: 2500, got_by: 'auto' }, 2500), null, 'already marked — nothing to write');
  assert.equal(gotAfterGifts({ price_php: 2500, got_by: null }, 2000), null, 'still open — nothing to write');
});

test("the couple's own mark is never touched by a sum", () => {
  assert.equal(gotAfterGifts({ price_php: 2500, got_by: 'host' }, 0), null);
  assert.equal(gotAfterGifts({ price_php: 2500, got_by: 'host' }, 9000), null);
});

test('a wish with no price never marks itself', () => {
  assert.equal(gotAfterGifts({ price_php: null, got_by: null }, 50_000), null);
});

test('got wishes sink to the end; open wishes keep the couple’s order', () => {
  const w = (id: string, sort: number, got: string | null) => ({
    id,
    sort_order: sort,
    got_at: got,
    created_at: `2026-10-08T00:00:0${sort}Z`,
  });
  const ordered = wishesInOrder([w('linen', 0, '2026-10-08T05:00:00Z'), w('air', 1, null), w('rice', 2, null)]);
  assert.deepEqual(
    ordered.map((x) => x.id),
    ['air', 'rice', 'linen'],
  );
});

test('the canonical lists name every column; the purpose projections name no person', () => {
  for (const col of ['wish_item_id', 'public_id', 'event_id', 'name', 'price_php', 'photo_r2_key', 'link_url', 'note', 'sort_order', 'got_at', 'got_by']) {
    assert.ok(WISH_ITEM_SELECT.split(', ').includes(col), `WISH_ITEM_SELECT is missing ${col}`);
  }
  for (const col of ['gift_record_id', 'wish_item_id', 'amount_php', 'screenshot_r2_key', 'message', 'giver_name', 'giver_guest_id', 'method_kind', 'removed_at']) {
    assert.ok(GIFT_RECORD_SELECT.split(', ').includes(col), `GIFT_RECORD_SELECT is missing ${col}`);
  }
  // The sum is what a GUEST page may be built from: an amount per wish, never a name, a word or a screenshot.
  assert.deepEqual(GIFT_SUM_FIELDS.split(', '), ['wish_item_id', 'amount_php', 'removed_at']);
  for (const priv of ['giver_name', 'giver_guest_id', 'message', 'screenshot_r2_key', 'created_by_user_id']) {
    assert.ok(!GIFT_SUM_FIELDS.includes(priv), `the sum must not read ${priv}`);
    assert.ok(!WISH_GUEST_FIELDS.includes(priv), `the guest's wish must not read ${priv}`);
  }
});

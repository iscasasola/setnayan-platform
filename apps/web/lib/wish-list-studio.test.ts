/**
 * STUDIO › E-GIFTS › WISH LIST — the words and the one-setting rule
 * (`lib/wish-list-studio.ts`; owner 2026-10-08, design
 * `EGIFTS_WISH_LIST_2026-10-08_fable.md` § 2, prototype frames 03 · 05 · 06 · 09).
 *
 * Each test is one way the drawing could be quietly broken:
 *   · a row's line losing "sent" or its gift count;
 *   · a got wish counted as an open one in "4 wishes · 1 got";
 *   · the list shown to guests with no way to give on (it must be KEPT, not shown);
 *   · a removed record still listed under its wish, or still in the total;
 *   · a gift toward no wish filed under a wish.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-08):
 *   • `wishListShownToGuests` ignoring the ways to give   → "the one-setting rule" red;
 *   • `wishListShownToGuests` ignoring Accept gifts? No   → "the one-setting rule" red;
 *   • `studioWishListFrom` keeping removed records        → "a removed record…" red;
 *   • `wishListCount` counting got wishes as open         → "the count…" red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { GiftRecordRow, WishItemRow } from './wish-list';
import {
  aWayToGiveIsOn,
  cleanWishPrice,
  giftWhenLine,
  giftsSentLine,
  studioWishListFrom,
  studioWishesInOrder,
  wishGotLine,
  wishListCount,
  wishListSeenLine,
  wishListShownToGuests,
  wishRowLine,
  wishRowLineParts,
  wishRowMeter,
  wishSheetPill,
  GIFTS_SENT_NONE,
  GIFT_ANY,
  giftRowLine,
  giftTotals,
  giftsSentLeadParts,
  settleDrawn,
  wishesWithGifts,
  type StudioWish,
  type StudioWishGift,
} from './wish-list-studio';

const wish = (over: Partial<StudioWish>): StudioWish => ({
  id: 'w',
  name: 'Air fryer',
  pricePhp: 4500,
  photoRef: null,
  photoUrl: null,
  linkUrl: null,
  note: null,
  gotBy: null,
  sentPhp: 0,
  gifts: [],
  ...over,
});
const g = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `g${i}`, giverName: 'Tita Nene', methodKind: 'gcash', at: '2026-10-06T07:12:00.000Z', message: null, amountPhp: 2000, hasShot: true, shotUrl: null, wishId: 'w', removed: false }));

test('a row’s line: sent of price and the gift count — the prototype’s own lines', () => {
  assert.equal(wishRowLine(wish({ sentPhp: 4000, gifts: g(2) })), '₱4,000 sent of ₱4,500 · 2 gifts');
  assert.equal(wishRowLine(wish({ pricePhp: 8900, sentPhp: 3000, gifts: g(1) })), '₱3,000 sent of ₱8,900 · 1 gift');
  assert.equal(wishRowLine(wish({ pricePhp: 3200 })), '₱3,200', 'nothing sent yet: the price alone');
  assert.equal(wishRowLine(wish({ pricePhp: null })), 'Any amount');
  assert.equal(wishRowLine(wish({ pricePhp: null, sentPhp: 1500, gifts: g(1) })), '₱1,500 sent · 1 gift', 'no price: no "of"');
  assert.equal(wishRowLine(wish({ pricePhp: 6000, linkUrl: 'https://shop.example/coffee/' })), '₱6,000 · shop.example/coffee');
});

test('a got wish’s line, and who marked it', () => {
  assert.equal(wishRowLine(wish({ pricePhp: 2500, sentPhp: 2500, gifts: g(1), gotBy: 'auto' })), '₱2,500 sent of ₱2,500');
  assert.equal(wishRowLine(wish({ pricePhp: 2500, sentPhp: 0, gotBy: 'host' })), '₱0 sent of ₱2,500 · marked by you');
});

test('the line splits so the sent figure can be counted, and joins back to the same words', () => {
  for (const w of [wish({ sentPhp: 4000, gifts: g(2) }), wish({ pricePhp: 3200 }), wish({ pricePhp: null }), wish({ sentPhp: 2500, pricePhp: 2500, gifts: g(1), gotBy: 'auto' })]) {
    const p = wishRowLineParts(w);
    assert.equal(`${p.sentPhp != null ? `₱${p.sentPhp.toLocaleString('en-PH')}` : ''}${p.rest}`, wishRowLine(w));
  }
  assert.equal(wishRowLineParts(wish({ pricePhp: 3200 })).sentPhp, null, 'a price is not a sent figure');
});

test('the count beside the eyebrow: open wishes, then the got ones', () => {
  const five = [wish({ id: '1' }), wish({ id: '2' }), wish({ id: '3' }), wish({ id: '4' }), wish({ id: '5', gotBy: 'auto' })];
  assert.equal(wishListCount(five), '4 wishes · 1 got');
  assert.equal(wishListCount([wish({})]), '1 wish');
  assert.equal(wishListCount([]), null, 'an empty list prints no count');
});

test('got wishes sink to the end; open wishes keep the couple’s order', () => {
  const order = studioWishesInOrder([wish({ id: 'linen', gotBy: 'auto' }), wish({ id: 'air' }), wish({ id: 'rice' })]);
  assert.deepEqual(order.map((w) => w.id), ['air', 'rice', 'linen']);
});

test('the meter: none before a gift, gold while filling, full and green when got', () => {
  assert.equal(wishRowMeter(wish({ pricePhp: 3200 })), null);
  assert.deepEqual(wishRowMeter(wish({ sentPhp: 4000, gifts: g(2) })), { percent: 89, got: false });
  assert.deepEqual(wishRowMeter(wish({ pricePhp: 2500, sentPhp: 2500, gifts: g(1), gotBy: 'auto' })), { percent: 100, got: true });
  assert.equal(wishRowMeter(wish({ pricePhp: null, sentPhp: 900, gifts: g(1) })), null, 'no price, no meter');
});

test('the sheet’s pill and the honest line under Got it', () => {
  assert.equal(wishSheetPill(wish({ sentPhp: 4000, gifts: g(2) })), '₱4,000 of ₱4,500');
  assert.equal(wishSheetPill(wish({})), null);
  assert.equal(wishGotLine(wish({})), 'Marks itself when the gifts sent reach ₱4,500');
  assert.equal(wishGotLine(wish({ pricePhp: 2500, gotBy: 'auto' })), 'Reached ₱2,500 — marked for you. Flip it off if it isn’t in your account yet.');
  assert.equal(wishGotLine(wish({ gotBy: 'host' })), 'Marked by you');
  assert.equal(wishGotLine(wish({ pricePhp: null })), 'No price — flip it yourself when it arrives');
});

test('"Gifts sent to you": what guests SAY they sent, or None yet', () => {
  assert.equal(giftsSentLine(14500, 5), '₱14,500 said sent · 5 gifts');
  // A count a person reads carries its commas, like the money beside it.
  assert.equal(giftsSentLine(1500000, 1200), '₱1,500,000 said sent · 1,200 gifts');
  assert.equal(giftsSentLine(2000, 1), '₱2,000 said sent · 1 gift');
  assert.equal(giftsSentLine(0, 0), 'None yet');
});

test('a gift’s way and time, in Manila’s clock', () => {
  assert.equal(giftWhenLine({ methodKind: 'gcash', at: '2026-10-06T07:12:00.000Z' }), 'GCash · Tue 3:12 pm');
  assert.equal(giftWhenLine({ methodKind: 'bank', at: '2026-10-05T01:40:00.000Z' }), 'Bank transfer · Mon 9:40 am');
  assert.equal(giftWhenLine({ methodKind: null, at: '2026-10-05T01:40:00.000Z' }), 'Mon 9:40 am');
});

test('the one-setting rule: the list is shown only with gifts accepted AND a way to give on', () => {
  const on = [{ is_enabled: true }];
  const off = [{ is_enabled: false }];
  assert.equal(wishListShownToGuests({ giftsOn: null, methods: on, wishCount: 4 }), true, 'never answered = on');
  assert.equal(wishListShownToGuests({ giftsOn: true, methods: on, wishCount: 4 }), true);
  assert.equal(wishListShownToGuests({ giftsOn: true, methods: off, wishCount: 4 }), false, 'no way to give: kept, not shown');
  assert.equal(wishListShownToGuests({ giftsOn: true, methods: [], wishCount: 4 }), false);
  assert.equal(wishListShownToGuests({ giftsOn: false, methods: on, wishCount: 4 }), false, 'Accept gifts? No hides it all');
  assert.equal(wishListShownToGuests({ giftsOn: true, methods: on, wishCount: 0 }), false, 'nothing to show');

  assert.equal(aWayToGiveIsOn(on), true);
  assert.equal(aWayToGiveIsOn(off), false);
  assert.equal(wishListSeenLine(4, on), 'Wish list · 4 wishes');
  assert.equal(wishListSeenLine(4, off), null, '"What guests see" must not promise a list guests do not get');
  assert.equal(wishListSeenLine(0, on), null);
});

test('a typed price: whole pesos, empty = any amount, anything else refused', () => {
  assert.equal(cleanWishPrice('4500'), 4500);
  assert.equal(cleanWishPrice('₱4,500'), 4500);
  assert.equal(cleanWishPrice(''), null);
  assert.equal(cleanWishPrice('  '), null);
  assert.equal(cleanWishPrice('0'), undefined);
  assert.equal(cleanWishPrice('45.50'), undefined);
  assert.equal(cleanWishPrice('about 4k'), undefined);
});

/* ── the rows → the view ─────────────────────────────────────────────────── */

const row = (id: string, price: number | null, got: 'auto' | 'host' | null = null): WishItemRow => ({
  wish_item_id: id,
  public_id: `S89H-${id}`,
  event_id: 'e',
  name: id,
  price_php: price,
  photo_r2_key: null,
  link_url: null,
  note: null,
  sort_order: 0,
  got_at: got ? '2026-10-03T00:00:00Z' : null,
  got_by: got,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
});
const rec = (id: string, toward: string | null, amount: number, removed: string | null = null): GiftRecordRow => ({
  gift_record_id: id,
  public_id: `S89Y-${id}`,
  event_id: 'e',
  wish_item_id: toward,
  amount_php: amount,
  screenshot_r2_key: id === 'r2' ? null : 'r2://setnayan-thread-files/gift-shots/e/x.jpg',
  message: 'Congrats',
  giver_name: 'Tita Nene',
  giver_guest_id: null,
  method_kind: 'gcash',
  created_at: '2026-10-06T07:12:00.000Z',
  removed_at: removed,
});

test('the view: each wish with what was sent toward it; a gift toward no wish counts in the total only', () => {
  const view = studioWishListFrom([row('air', 4500), row('rice', 3200)], [rec('r1', 'air', 2000), rec('r2', 'air', 2000), rec('r3', null, 5000)], () => null);
  assert.equal(view.read, true);
  if (!view.read) return;
  const air = view.wishes.find((w) => w.id === 'air')!;
  assert.equal(air.sentPhp, 4000);
  assert.deepEqual(air.gifts.map((x) => [x.id, x.hasShot]), [['r1', true], ['r2', false]]);
  assert.equal(view.wishes.find((w) => w.id === 'rice')!.sentPhp, 0);
  assert.equal(view.totalSentPhp, 9000);
  assert.equal(view.totalGifts, 3);
});

test('a removed record is in no sum, no list and no total', () => {
  const view = studioWishListFrom([row('air', 4500)], [rec('r1', 'air', 2000), rec('r9', 'air', 2500, '2026-10-07T00:00:00Z')], () => null);
  assert.equal(view.read, true);
  if (!view.read) return;
  assert.equal(view.wishes[0]!.sentPhp, 2000);
  assert.deepEqual(view.wishes[0]!.gifts.map((x) => x.id), ['r1']);
  assert.equal(view.totalSentPhp, 2000);
  assert.equal(view.totalGifts, 1);
});

test('the photo is resolved by the caller’s resolver — a ref it refuses draws no picture', () => {
  const withPhoto = { ...row('air', 4500), photo_r2_key: 'r2://setnayan-media/events/e/wish-list/a.jpg' };
  const shown = studioWishListFrom([withPhoto], [], (ref) => (ref ? 'https://media.example/a.jpg' : null));
  const refused = studioWishListFrom([withPhoto], [], () => null);
  assert.equal(shown.read && shown.wishes[0]!.photoUrl, 'https://media.example/a.jpg');
  assert.equal(refused.read && refused.wishes[0]!.photoUrl, null);
  assert.equal(refused.read && refused.wishes[0]!.photoRef, withPhoto.photo_r2_key, 'the stored ref is still handed back for the field');
});

/* ── wish list 5/5 — Gifts sent to you ───────────────────────────────────── */

const flat = (id: string, wishId: string | null, amountPhp: number, over: Partial<StudioWishGift> = {}): StudioWishGift => ({
  id,
  giverName: 'Tita Nene',
  methodKind: 'gcash',
  at: '2026-10-06T07:12:00.000Z',
  message: null,
  amountPhp,
  hasShot: false,
  shotUrl: null,
  wishId,
  removed: false,
  ...over,
});

test('the view also hands over EVERY record — its wish, its screenshot’s address, and whether it was set aside', () => {
  const view = studioWishListFrom(
    [row('air', 4500)],
    [rec('r1', 'air', 2000), rec('r2', 'air', 2000), rec('r3', null, 5000), rec('r4', 'air', 700, '2026-10-07T00:00:00.000Z'), rec('r5', 'a-wish-that-is-gone', 300)],
    () => null,
    (ref) => (ref ? `signed:${ref}` : null),
  );
  assert.equal(view.read, true);
  if (!view.read) return;
  assert.deepEqual(
    view.gifts.map((x) => [x.id, x.wishId, x.removed, x.hasShot, x.shotUrl]),
    [
      ['r1', 'air', false, true, 'signed:r2://setnayan-thread-files/gift-shots/e/x.jpg'],
      ['r2', 'air', false, false, null],
      ['r3', null, false, true, 'signed:r2://setnayan-thread-files/gift-shots/e/x.jpg'],
      ['r4', 'air', true, true, 'signed:r2://setnayan-thread-files/gift-shots/e/x.jpg'],
      // A record whose wish this read does not hold counts toward no wish: "Any gift".
      ['r5', null, false, true, 'signed:r2://setnayan-thread-files/gift-shots/e/x.jpg'],
    ],
  );
  // A removed record is on the flat list (it can be put back) and in NO wish's list or sum.
  const air = view.wishes.find((w) => w.id === 'air')!;
  assert.deepEqual(air.gifts.map((x) => x.id), ['r1', 'r2']);
  assert.equal(air.sentPhp, 4000);
  // With no signer handed in (a unit test, a lab) no address is invented.
  const bare = studioWishListFrom([row('air', 4500)], [rec('r1', 'air', 2000)], () => null);
  assert.equal(bare.read && bare.gifts[0]!.shotUrl, null);
});

test('"Gifts sent to you": the sentence over the list, and each row’s line', () => {
  assert.deepEqual(giftsSentLeadParts(14500, 5), {
    before: 'What guests say they sent — ',
    sent: '₱14,500',
    after: ' in 5 gifts. Check your GCash or bank before you count one.',
  });
  assert.equal(giftsSentLeadParts(2000, 1).after, ' in 1 gift. Check your GCash or bank before you count one.');
  assert.deepEqual(giftsSentLeadParts(0, 0), { before: GIFTS_SENT_NONE, sent: null, after: '' });

  const wishes = [{ id: 'air', name: 'Air fryer' }];
  assert.equal(giftRowLine(flat('g1', 'air', 2000), wishes), 'Air fryer · GCash · Tue 3:12 pm');
  assert.equal(giftRowLine(flat('g2', null, 5000), wishes), `${GIFT_ANY} · GCash · Tue 3:12 pm`);
  assert.equal(giftRowLine(flat('g3', 'gone', 5000, { methodKind: null }), wishes), `${GIFT_ANY} · Tue 3:12 pm`, 'a wish that is gone reads as no wish');
});

test('the totals and each wish are drawn from the records — a removed one counts nowhere', () => {
  const gifts = [flat('g1', 'air', 2000), flat('g2', 'air', 2000), flat('g3', null, 5000), flat('g4', 'air', 900, { removed: true })];
  assert.deepEqual(giftTotals(gifts), { sentPhp: 9000, counted: 3 });
  assert.deepEqual(giftTotals([]), { sentPhp: 0, counted: 0 });

  const drawn = wishesWithGifts([wish({ id: 'air', sentPhp: 123, gifts: [] }), wish({ id: 'rice', pricePhp: 3200, sentPhp: 9 })], gifts);
  assert.equal(drawn[0]!.sentPhp, 4000);
  assert.deepEqual(drawn[0]!.gifts.map((x) => x.id), ['g1', 'g2']);
  assert.equal(drawn[1]!.sentPhp, 0);
  assert.deepEqual(drawn[1]!.gifts, []);
  // A sum alone never re-marks a wish: gotBy is exactly what it was.
  const reopened = wishesWithGifts([wish({ id: 'air', gotBy: null })], [flat('g1', 'air', 9999)]);
  assert.equal(reopened[0]!.gotBy, null, 'a wish the couple opened again must not mark itself on every draw');
});

test('🔒 "when amount is reached": a changed record settles the wishes it touched — and only those', () => {
  const air = wish({ id: 'air', pricePhp: 4500 });
  const rice = wish({ id: 'rice', pricePhp: 3200 });
  const fund = wish({ id: 'fund', pricePhp: null });
  const mine = wish({ id: 'coffee', pricePhp: 6000, gotBy: 'host' });

  // A correction reaches the price → marked for them.
  let out = settleDrawn([air, rice], [flat('g1', 'air', 2500), flat('g2', 'air', 2000)], ['air', null]);
  assert.equal(out.find((w) => w.id === 'air')!.gotBy, 'auto');
  assert.equal(out.find((w) => w.id === 'rice')!.gotBy, null);

  // …and falls back below → an automatic mark opens again.
  out = settleDrawn([{ ...air, gotBy: 'auto' }], [flat('g1', 'air', 2000), flat('g2', 'air', 2000)], ['air']);
  assert.equal(out[0]!.gotBy, null);

  // A move settles BOTH the wish it left and the wish it joined.
  out = settleDrawn([{ ...air, gotBy: 'auto' }, rice], [flat('g1', 'rice', 4500)], ['air', 'rice']);
  assert.equal(out.find((w) => w.id === 'air')!.gotBy, null);
  assert.equal(out.find((w) => w.id === 'rice')!.gotBy, 'auto');

  // A removed record no longer counts.
  out = settleDrawn([{ ...air, gotBy: 'auto' }], [flat('g1', 'air', 4500, { removed: true })], ['air']);
  assert.equal(out[0]!.gotBy, null);

  // The couple's own mark is never touched; a wish with no price never marks itself.
  out = settleDrawn([mine, fund], [flat('g1', 'coffee', 1), flat('g2', 'fund', 999999)], ['coffee', 'fund']);
  assert.equal(out.find((w) => w.id === 'coffee')!.gotBy, 'host');
  assert.equal(out.find((w) => w.id === 'fund')!.gotBy, null);

  // 🔒 A wish the record did NOT touch is not judged — one the couple opened again stays open.
  out = settleDrawn([air, rice], [flat('g1', 'air', 9000), flat('g2', 'rice', 100)], ['rice']);
  assert.equal(out.find((w) => w.id === 'air')!.gotBy, null, 'an untouched wish was re-marked by somebody else’s change');
  assert.equal(out.find((w) => w.id === 'air')!.sentPhp, 9000, '…though its sum is still drawn');
});

/**
 * THE WISH LIST AS A GUEST READS IT — `lib/wish-list-guest.ts` (owner 2026-10-08,
 * "ok wish list" · "per item"; design `EGIFTS_WISH_LIST_2026-10-08_fable.md` § 2
 * "Guest"; prototype frames 12–17 · 21–23).
 *
 * Each test is one way the drawing — or the privacy line under it — could be
 * quietly broken:
 *   · another guest's name, words or screenshot reaching the guest's view;
 *   · a removed record still filling a meter a guest can see;
 *   · the row's uuid shipped to a browser instead of its public id;
 *   · a got wish left among the open ones, or counted as open;
 *   · a wish with no price promising an amount "to reach";
 *   · the list wearing a look of its own instead of the E-Gifts look picked.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-08):
 *   • `guestWishListFrom` keeping the couple's order (got not sunk)   → "open wishes first" red;
 *   • `id: w.wish_item_id`                                            → "the public id" red;
 *   • `sendSheetLine` ignoring a missing price                        → "the send sheet's line" red;
 *   • `wishListShape` returning 'rows' for Centred                    → "the look" red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { GiftSumRow } from './wish-list';
import {
  GUEST_WISH_GOT,
  guestWishCount,
  guestWishLine,
  guestWishListFrom,
  guestWishMeter,
  openWishCount,
  sendSheetLine,
  sendSheetTitle,
  wishDoorLine,
  wishListShape,
  type GuestWish,
  type GuestWishRow,
} from './wish-list-guest';

const row = (n: number, name: string, price: number | null, got = false, note: string | null = null): GuestWishRow => ({
  wish_item_id: `uuid-${n}`,
  public_id: `S89H-000000000${n}`,
  name,
  price_php: price,
  photo_r2_key: null,
  note,
  sort_order: n,
  got_at: got ? '2026-10-03T00:00:00Z' : null,
});
const sum = (wish: number | null, amount: number, removed = false): GiftSumRow => ({
  wish_item_id: wish == null ? null : `uuid-${wish}`,
  amount_php: amount,
  removed_at: removed ? '2026-10-07T00:00:00Z' : null,
});
const wish = (over: Partial<GuestWish>): GuestWish => ({ id: 'S89H-1', name: 'Air fryer', pricePhp: 4500, photoUrl: null, note: null, got: false, sentPhp: 0, minePhp: 0, ...over });

const ROWS = [row(1, 'Bed linen', 2500, true), row(2, 'Air fryer', 4500, false, 'the 6 L one, black'), row(3, 'Rice cooker', 3200)];
const SUMS = [sum(2, 2000), sum(2, 2000), sum(1, 2500), sum(null, 5000), sum(3, 9000, true)];

test('open wishes first, in the couple’s order — got wishes at the end', () => {
  const view = guestWishListFrom(ROWS, SUMS, () => null);
  assert.ok(view.read);
  assert.deepEqual(view.wishes.map((w) => w.name), ['Air fryer', 'Rice cooker', 'Bed linen']);
  assert.deepEqual(view.wishes.map((w) => w.got), [false, false, true]);
});

test('a guest is handed the public id, never the row’s uuid', () => {
  const view = guestWishListFrom(ROWS, SUMS, () => null);
  assert.ok(view.read);
  for (const w of view.wishes) {
    assert.match(w.id, /^S89H-/);
    assert.ok(!JSON.stringify(w).includes('uuid-'), 'a row uuid reached the guest’s view');
  }
});

test('one sum per wish: removed records and gifts toward no wish are not in it', () => {
  const view = guestWishListFrom(ROWS, SUMS, () => null);
  assert.ok(view.read);
  const by = Object.fromEntries(view.wishes.map((w) => [w.name, w.sentPhp]));
  assert.deepEqual(by, { 'Air fryer': 4000, 'Rice cooker': 0, 'Bed linen': 2500 });
});

test('🔒 the guest’s view has no field for another guest’s name, amount, words or screenshot', () => {
  const view = guestWishListFrom(ROWS, SUMS, () => null);
  assert.ok(view.read);
  assert.deepEqual(Object.keys(view.wishes[0]!).sort(), ['got', 'id', 'minePhp', 'name', 'note', 'photoUrl', 'pricePhp', 'sentPhp']);
});

test('the photo is the caller’s resolver’s — a ref it refuses draws none', () => {
  const withPhoto = [{ ...row(1, 'Air fryer', 4500), photo_r2_key: 'r2://setnayan-media/events/e/wish-list/a.jpg' }];
  const shown = guestWishListFrom(withPhoto, [], (ref) => (ref ? 'https://media.example/a.jpg' : null));
  const refused = guestWishListFrom(withPhoto, [], () => null);
  assert.equal(shown.read && shown.wishes[0]!.photoUrl, 'https://media.example/a.jpg');
  assert.equal(refused.read && refused.wishes[0]!.photoUrl, null);
  assert.ok(!JSON.stringify(refused).includes('r2://'), 'a stored ref reached the guest’s view');
});

test('the reader\u2019s own gifts are marked on their wish — theirs alone, and never over "Got it"', () => {
  const view = guestWishListFrom(ROWS, SUMS, () => null, [sum(2, 500), sum(2, 700, true), sum(1, 2500)]);
  assert.ok(view.read);
  const air = view.wishes.find((w) => w.name === 'Air fryer')!;
  assert.equal(air.minePhp, 500, 'a record the couple removed is not "sent" by the reader either');
  assert.equal(guestWishLine(air), 'You sent ₱500 ✓ · ₱4,000 of ₱4,500');
  assert.equal(guestWishLine({ ...air, pricePhp: null }), 'You sent ₱500 ✓');
  const linen = view.wishes.find((w) => w.name === 'Bed linen')!;
  assert.equal(linen.minePhp, 2500);
  assert.equal(guestWishLine(linen), GUEST_WISH_GOT, 'a got wish says so first');
  // With no reader, nobody's gift is "yours".
  const anon = guestWishListFrom(ROWS, SUMS, () => null);
  assert.ok(anon.read && anon.wishes.every((w) => w.minePhp === 0));
});

test('the count beside the eyebrow, and the open count behind the door', () => {
  const five = [wish({}), wish({}), wish({}), wish({}), wish({ got: true })];
  assert.equal(guestWishCount(five), '4 wishes · 1 got');
  assert.equal(guestWishCount([wish({})]), '1 wish');
  assert.equal(guestWishCount([]), null);
  assert.equal(openWishCount(five), 4);
});

test('a wish’s line — the prototype’s own', () => {
  assert.equal(guestWishLine(wish({ sentPhp: 4000 })), '₱4,000 of ₱4,500 sent');
  assert.equal(guestWishLine(wish({ pricePhp: 3200 })), '₱3,200');
  assert.equal(guestWishLine(wish({ pricePhp: 3200, note: 'the grey one' })), '₱3,200 · the grey one');
  assert.equal(guestWishLine(wish({ pricePhp: null })), 'Any amount');
  assert.equal(guestWishLine(wish({ pricePhp: null, sentPhp: 3000 })), 'Any amount · ₱3,000 sent so far');
  assert.equal(guestWishLine(wish({ got: true, sentPhp: 2500, pricePhp: 2500 })), GUEST_WISH_GOT);
  assert.equal(GUEST_WISH_GOT, 'Got it ✓ · thank you');
});

test('the meter: none before a gift, filling after one, full when got, none with no price', () => {
  assert.equal(guestWishMeter(wish({})), null);
  assert.deepEqual(guestWishMeter(wish({ sentPhp: 4000 })), { percent: 89, got: false });
  assert.deepEqual(guestWishMeter(wish({ got: true, sentPhp: 0 })), { percent: 100, got: true });
  assert.equal(guestWishMeter(wish({ pricePhp: null, sentPhp: 3000 })), null);
});

test('the send sheet’s title and line', () => {
  assert.equal(sendSheetTitle(wish({})), 'Send for the Air fryer');
  assert.equal(sendSheetTitle(wish({ pricePhp: null })), 'Send a gift toward the Air fryer');
  assert.deepEqual(sendSheetLine(wish({ sentPhp: 4000 }), 'Maria & Jose’s'), {
    lead: '₱500 more',
    rest: ' reaches ₱4,500 · any amount helps — it goes straight to Maria & Jose’s own account.',
  });
  assert.deepEqual(sendSheetLine(wish({ pricePhp: null, sentPhp: 3000 }), 'the couple’s'), {
    lead: '',
    rest: 'Any amount is welcome — it goes straight to the couple’s own account.',
  });
  // Already at (or past) its price but not yet marked: nothing is "left to reach".
  assert.equal(sendSheetLine(wish({ sentPhp: 5200 }), 'the couple’s').lead, '');
});

test('the door’s line: only while a wish is open', () => {
  assert.equal(wishDoorLine(4), 'Wish list · 4 things they’d love');
  assert.equal(wishDoorLine(1), 'Wish list · 1 thing they’d love');
  assert.equal(wishDoorLine(0), null);
  assert.equal(wishDoorLine(Number.NaN), null);
});

test('the look: the list wears the E-Gifts look already picked — no picker of its own', () => {
  assert.equal(wishListShape(null), 'rows');
  assert.equal(wishListShape('gifts.side-rule'), 'side');
  assert.equal(wishListShape('gifts.centred'), 'tiles');
  assert.equal(wishListShape('gifts.ruled'), 'ruled');
  assert.equal(wishListShape('gifts.unknown'), 'rows');
});

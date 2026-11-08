/**
 * the-card-gift-is-one-dropdown.test.ts — the service card's Gift row is ONE dropdown, and the card is one page of
 * fields.
 *
 * Owner, 7 Nov 2026 (DECISION_LOG "THE FOUR MAKERS ARE APPROVED — BUILD THEM AS FIXES TO THE SHIPPED SCREENS, NEVER
 * NEW ONES"; makers prototype `makers_match_2026-11-07` § 3): "on service card and bundles where are the gifts?" — the
 * shipped "Setnayan gift" switch (buried under More settings) becomes one Gift dropdown on the card: No gift (default)
 * · Setnayan gift · the shop's own gift packs, a pack the stock cannot cover listed with "buy first". And: "One page
 * of the door's fields, not nineteen folds — Name · Specialties · Price · What's included · Extras · Photos".
 *
 * What this holds, each a way it has (or would have) silently gone wrong:
 *   1 · the dropdown's rules (lib/gift-pick.ts) — the order, the stock notes, a saved gift never stranded;
 *   2 · one value → two columns, and a non-giftable code is refused (the DB says so too);
 *   3 · the maker draws the shared GiftPickRow and posts all three gift fields — and the old switch is gone;
 *   4 · the save reads the pack only when the row was drawn (`gift_pack_present`), so a screen without the row can
 *       never clear a card's pack;
 *   5 · the first page's order and that none of its fields sit inside More settings;
 *   6 · the couple's line for a pack carries no count (the card face's rule);
 *   7 · 🚧 `SHOP_PACK_GIFTS_DELIVER` (controller, 7 Nov): while a picked pack would reach no quote and no couple-facing
 *       card, the dropdown lists NO pack, the ⓘ says nothing about own gifts and the save refuses a pack — and with
 *       the switch on, the packs are listed again. Tests 1 and 6 ask for the delivering menu explicitly.
 *
 * Sabotage, 2026-11-07: (a) `giftMenu` put Setnayan gift first → test 1 red; (b) the maker's `gift_pack_present`
 * hidden input removed → test 3 red. Both restored green.
 * Sabotage, 2026-11-07 (gate): the pack loop ignoring `deliver` (`for (const p of packs ?? [])`) → test 7 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import {
  GIFT_NONE,
  GIFT_SETNAYAN,
  coupleCardPackLine,
  giftColumns,
  SHOP_PACK_GIFTS_DELIVER,
  giftMenu,
  giftPickOf,
  giftTip,
} from '@/lib/gift-pick';
import type { ShopGiftPack } from '@/lib/shop-gifts';

const WEB = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const MAKER = 'app/vendor-dashboard/services/_components/canvas-maker.tsx';
const ACTIONS = 'app/vendor-dashboard/services/actions.ts';

const PACKS: ShopGiftPack[] = [
  { code: 'PAPIC_GUEST', title: 'Papic · 100 credits', kind: 'papic', credits: 100, srpCentavos: 1, giftPriceCentavos: null },
  { code: 'EVENT_PLUS', title: 'Event Plus', kind: 'event_plus', credits: 1, srpCentavos: 1, giftPriceCentavos: null },
];

test('1 · the dropdown: No gift · Setnayan gift · the shop’s packs, a short pack listed with "buy first"', () => {
  const menu = giftMenu(PACKS, { papic: 100, event_plus: 0, event_pro: 0 }, GIFT_NONE, true);
  assert.deepEqual(menu.map((o) => o.key), [GIFT_NONE, GIFT_SETNAYAN, 'PAPIC_GUEST', 'EVENT_PLUS']);
  assert.equal(menu[0]!.label, 'No gift');
  assert.equal(menu[1]!.label, 'Setnayan gift');
  assert.equal(menu[2]!.disabledNote, undefined, 'a pack the stock covers must be pickable');
  assert.equal(menu[3]!.disabledNote, 'Not enough in your stock · buy first');
  // Unreadable stock is said as unreadable, never as empty.
  for (const o of giftMenu(PACKS, null, GIFT_NONE, true).slice(2)) assert.equal(o.disabledNote, 'Couldn’t read your gift stock right now');
  // A saved card's own pack stays pickable whatever the stock says — opening it never strands its gift.
  assert.equal(giftMenu(PACKS, { papic: 0, event_plus: 0, event_pro: 0 }, 'EVENT_PLUS', true)[3]!.disabledNote, undefined);
  // Unread catalogue: only the two answers that need no catalogue.
  assert.deepEqual(giftMenu(null, null).map((o) => o.key), [GIFT_NONE, GIFT_SETNAYAN]);
});

test('2 · one value, two columns — and a code that cannot be gifted is refused', () => {
  assert.deepEqual(giftColumns(''), { includes_setnayan_gift: false, gift_pack_code: null });
  assert.deepEqual(giftColumns('setnayan'), { includes_setnayan_gift: true, gift_pack_code: null });
  assert.deepEqual(giftColumns('EVENT_PLUS'), { includes_setnayan_gift: false, gift_pack_code: 'EVENT_PLUS' });
  assert.equal(giftColumns('LIVE_STUDIO'), null);
  assert.equal(giftPickOf({ includes_setnayan_gift: true, gift_pack_code: null }), 'setnayan');
  assert.equal(giftPickOf({ includes_setnayan_gift: false, gift_pack_code: 'PAPIC_GUEST' }), 'PAPIC_GUEST');
  assert.equal(giftPickOf({ includes_setnayan_gift: false, gift_pack_code: 'NOT_A_GIFT' }), '');
  const sql = readFileSync(join(WEB, '..', '..', 'supabase/migrations/20271320258754_a_card_carries_a_shop_gift.sql'), 'utf8');
  assert.match(sql, /vendor_services_one_gift_ck/, 'the database no longer refuses two gifts on one card');
});

test('3 · the maker draws the shared Gift row, posts all three fields, and the old switch is gone', () => {
  const src = read(MAKER);
  assert.match(src, /import \{ GiftPickRow \} from '@\/app\/_components\/gift-pick'/);
  assert.match(src, /<GiftPickRow host="card" value=\{giftPick\} onPick=\{setGiftPick\}/);
  assert.match(src, /name="includes_setnayan_gift" value=\{giftPick === GIFT_SETNAYAN \? 'on' : 'off'\}/);
  assert.match(src, /name="gift_pack_present" value="1"/);
  assert.match(src, /name="gift_pack_code" value=/);
  assert.ok(!src.includes('data="m-gift"'), 'the old "Setnayan gift" fold is back under More settings');
  assert.ok(!src.includes('aria-label="Give the Setnayan gift"'), 'the old Setnayan-gift switch is back');
});

test('4 · the save touches the pack only when the row was drawn', () => {
  const src = read(ACTIONS);
  const at = src.indexOf("formData.get('gift_pack_present') === '1'");
  assert.ok(at > 0, 'commitVendorService no longer asks whether the Gift row was drawn');
  assert.ok(src.indexOf('giftColumns(', at) > at, 'the pack is no longer checked through giftColumns');
});

test('5 · one page of fields, in the prototype’s order, none of them inside More settings', () => {
  const src = read(MAKER);
  // The JSX attribute (` data-maker-row="…"`), never the save's `[data-maker-row="included"]` selector.
  const order = ['name', 'price', 'included', 'extras', 'gift', 'photos'].map((k) => src.search(new RegExp(`(?<!\\[)data-maker-row="${k}"`)));
  order.forEach((at, i) => assert.ok(at > 0, `the ${['name', 'price', 'included', 'extras', 'gift', 'photos'][i]} field is gone`));
  for (let i = 1; i < order.length; i++) assert.ok(order[i]! > order[i - 1]!, 'the first page is out of the prototype’s order');
  const more = src.indexOf('data-maker-more-wrap=');
  assert.ok(more > order[order.length - 1]!, 'a first-page field sits inside More settings');
  // The folds the first page took over are not drawn twice.
  for (const gone of ['data="m-price"', 'data="m-addons"', 'data="m-details"', 'data="photos"', 'data="price"', 'data="included"']) {
    assert.ok(!src.includes(gone), `${gone} is drawn again — a field must have one place`);
  }
  // The thumb row: Cancel grey, Create / Save card the one terracotta main.
  assert.match(src, /<ActionButton tone="neutral" icon=\{X\} label="Cancel" href=\{cancelTo\} \/>/);
  assert.match(src, /isEdit \? 'Save card' : 'Create'/);
});

test('6 · the couple’s line for a pack names the kind, never a count', () => {
  assert.equal(coupleCardPackLine('EVENT_PLUS', 'Saysay Studio'), 'Gift from Saysay Studio 🎁 · Event Plus');
  assert.ok(!/\d/.test(coupleCardPackLine('PAPIC_GUEST_500', 'Saysay') ?? ''), 'a count reached the card');
  assert.equal(coupleCardPackLine(null, 'Saysay'), null);
});

test('7 · 🚧 shop packs are not offered while they reach nobody — and are offered once the switch is on', () => {
  const free = { papic: 1000, event_plus: 5, event_pro: 5 };
  const keys = (deliver: boolean) => giftMenu(PACKS, free, GIFT_NONE, deliver).map((o) => o.key);
  // The default follows the switch: hidden while false, listed while true.
  const def = giftMenu(PACKS, free).map((o) => o.key);
  if (SHOP_PACK_GIFTS_DELIVER) {
    assert.deepEqual(def, [GIFT_NONE, GIFT_SETNAYAN, 'PAPIC_GUEST', 'EVENT_PLUS']);
  } else {
    assert.deepEqual(def, [GIFT_NONE, GIFT_SETNAYAN], 'a pack is offered that would reach no quote and no couple');
    assert.equal(giftTip('card').length, 1, 'the ⓘ promises own gifts that are not offered');
  }
  assert.deepEqual(keys(false), [GIFT_NONE, GIFT_SETNAYAN]);
  assert.deepEqual(keys(true), [GIFT_NONE, GIFT_SETNAYAN, 'PAPIC_GUEST', 'EVENT_PLUS']);
  assert.ok(giftTip('card', true).length > 1);
  // The save refuses a pack while the switch is off (a crafted post cannot save a gift that reaches nobody).
  assert.match(read(ACTIONS), /if \(code && !SHOP_PACK_GIFTS_DELIVER\) return back\(/);
  // Today's value is the ruling-in-waiting: off.
  assert.equal(SHOP_PACK_GIFTS_DELIVER, false, 'flip only with the delivery built and the owner ruling recorded');
});

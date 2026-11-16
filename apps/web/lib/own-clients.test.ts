/**
 * 🎁 Own clients v4 — the pure rules (lib/own-clients.ts), each against the ruling it carries (DECISION_LOG 16 Nov).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ShopGiftPack } from './shop-gifts';
import {
  OWN_GIFT_BUY_KEY,
  OWN_GIFT_MAX_LINES,
  REWARD_DOES_NOT_COUNT,
  anyPackPickable,
  boughtFreeByKind,
  clientInviteTokenOf,
  clientInviteUrl,
  defaultOwnGift,
  fitsStock,
  importIsOwnClient,
  isEmailOrPhone,
  needByKind,
  ownGiftDataOf,
  ownGiftLinesOf,
  ownGiftMenu,
  ownGiftWords,
  packsLeft,
  roomForLine,
  shopIsVerified,
  usedWhenJoinsLine,
} from './own-clients';

// Catalogue-shaped samples: the module never types these — they arrive read.
const packs: ShopGiftPack[] = [
  { code: 'PAPIC_GUEST', title: 'Papic 150', kind: 'papic', credits: 150, srpCentavos: 9900, giftPriceCentavos: null },
  { code: 'PAPIC_GUEST_1000', title: 'Papic 1000', kind: 'papic', credits: 1000, srpCentavos: 49900, giftPriceCentavos: null },
  { code: 'EVENT_PLUS', title: 'Event Plus', kind: 'event_plus', credits: 1, srpCentavos: 99900, giftPriceCentavos: null },
];
const stock = (papic: number, event_plus = 0, event_pro = 0, event_ultra = 0) => ({ papic, event_plus, event_pro, event_ultra });

test('a badge reward never counts toward the gift, per kind (v4 answer 3)', () => {
  assert.deepEqual(boughtFreeByKind(stock(1200, 2), stock(300, 1)), stock(900, 1));
  assert.deepEqual(boughtFreeByKind(stock(100), stock(300)), stock(0));
  assert.equal(boughtFreeByKind(null, null), null, 'an unread stock is null, never 0');
});

test('the ▾ lists your stock only — every kind — greys a badge reward, and offers Buy more', () => {
  const m = ownGiftMenu(packs, stock(1050, 2), stock(150), true);
  assert.deepEqual(m.map((o) => o.key), ['PAPIC_GUEST', 'PAPIC_GUEST_1000', 'EVENT_PLUS', '__reward_papic', OWN_GIFT_BUY_KEY]);
  assert.equal(m[0]!.hint, '7 left');
  assert.equal(m[1]!.hint, '1 left');
  assert.equal(m[2]!.hint, '2 left', 'Event Plus counts its own units, never Papic credits');
  assert.equal(m[3]!.disabledNote, REWARD_DOES_NOT_COUNT);
  // A pack its kind's stock cannot cover is not listed at all: stock only.
  assert.deepEqual(ownGiftMenu(packs, stock(300), stock(0), false).map((o) => o.key), ['PAPIC_GUEST']);
});

test('two lines never promise the same unit twice; kinds never pool', () => {
  const free = stock(300, 1);
  assert.deepEqual(roomForLine(free, packs, ['PAPIC_GUEST', 'EVENT_PLUS'], 1), stock(150, 1));
  assert.ok(fitsStock(needByKind(['PAPIC_GUEST', 'PAPIC_GUEST', 'EVENT_PLUS'], packs), free));
  assert.ok(!fitsStock(needByKind(['EVENT_PLUS', 'EVENT_PLUS'], packs), free));
  assert.ok(!fitsStock(needByKind(['PAPIC_GUEST'], packs), null), 'an unread stock never fits');
});

test('with no stock nothing is pickable, so the step lists what to buy', () => {
  assert.equal(anyPackPickable(packs, stock(0)), false);
  assert.equal(anyPackPickable(packs, null), false);
  assert.equal(defaultOwnGift(packs, stock(0)), null);
  assert.equal(defaultOwnGift(packs, stock(150)), 'PAPIC_GUEST');
  assert.equal(defaultOwnGift(packs, stock(0, 1)), 'EVENT_PLUS');
  assert.equal(packsLeft(149, packs[0]!), 0);
});

test('lines are read from the catalogue by code, at least one, any kind', () => {
  assert.equal(ownGiftLinesOf([], packs), null, 'every own client carries at least one gift');
  assert.equal(ownGiftLinesOf(['NOT_A_CODE'], packs), null);
  assert.deepEqual(ownGiftLinesOf(['PAPIC_GUEST', 'EVENT_PLUS'], packs), [
    { service_code: 'PAPIC_GUEST', title: 'Papic 150', kind: 'papic', credits: 150 },
    { service_code: 'EVENT_PLUS', title: 'Event Plus', kind: 'event_plus', credits: 1 },
  ]);
  assert.equal(ownGiftLinesOf(Array(OWN_GIFT_MAX_LINES + 1).fill('PAPIC_GUEST'), packs), null);
});

test('ONE limit on gifts per client: the code and the migration say the same number', () => {
  const sql = readFileSync(join(process.cwd(), '../../supabase/migrations/20271349849472_own_clients_carry_a_gift.sql'), 'utf8');
  assert.match(sql, new RegExp(`jsonb_array_length\\(gift_lines\\) BETWEEN 1 AND ${OWN_GIFT_MAX_LINES}\\b`), 'the invites CHECK');
  assert.match(sql, new RegExp(`jsonb_array_length\\(p_lines\\) > ${OWN_GIFT_MAX_LINES}\\b`), 'the door\'s refusal');
});

test('🪪 ONE verified test, the one the server uses', () => {
  assert.equal(shopIsVerified('verified'), true);
  assert.equal(shopIsVerified('unverified'), false);
  assert.equal(shopIsVerified(null), false);
  for (const f of ['app/vendor-dashboard/invite/page.tsx', 'app/vendor-dashboard/shop/promote/_components/promote-body.tsx']) {
    const src = readFileSync(join(process.cwd(), f), 'utf8');
    assert.match(src, /fetchShopVerified\(/, `${f} asks the shared verified test`);
    assert.doesNotMatch(src, /verified=\{await isMarketplaceVendorBookable|isMarketplaceVendorBookable\([^)]*\)\.catch\(\(\) => false\),/, `${f} must not promise from "bookable"`);
  }
  const claim = readFileSync(join(process.cwd(), 'app/vendor-invite/[slug]/actions.ts'), 'utf8');
  assert.match(claim, /importIsOwnClient\(gave\.facts, shopIsVerified\(/);
});

test('🔗 a failed own-link read is never charged (controller audit, 16 Nov)', () => {
  const src = readFileSync(join(process.cwd(), 'app/v/[slug]/inquiry-actions.ts'), 'utf8');
  assert.match(src, /const ownedSource = arrival === 'not_own' \? 'shop_page' : declaredSource;/);
  assert.doesNotMatch(src, /ownLinkArrivalIsOwnClient\([^)]*\)\.catch\(\(\) => false\)/);
});

test('the words the drawing uses', () => {
  assert.equal(usedWhenJoinsLine(1), '1 from your stock is used when the couple joins');
  assert.equal(usedWhenJoinsLine(2), '2 from your stock are used when the couple joins');
  assert.equal(ownGiftWords([{ title: 'Papic 150' }, { title: 'Papic 150' }, { title: 'Papic 1000' }]), '2 × Papic 150 and Papic 1000');
});

test('the invite link and its token', () => {
  assert.equal(clientInviteUrl('https://www.setnayan.com/', 'liwanag', 'abcdefghijklmnop'), 'https://www.setnayan.com/liwanag/invite?ci=abcdefghijklmnop');
  assert.equal(clientInviteTokenOf('short'), null);
  assert.equal(clientInviteTokenOf('a'.repeat(24)), 'a'.repeat(24));
  assert.equal(clientInviteTokenOf("x'; drop table"), null);
});

test('email or phone', () => {
  assert.ok(isEmailOrPhone('ana.reyes@email.com'));
  assert.ok(isEmailOrPhone('+63 917 123 4567'));
  assert.ok(!isEmailOrPhone('ana'));
  assert.ok(!isEmailOrPhone('12345'));
});

test('the gift step reads the same stock read as Your gifts', () => {
  const d = ownGiftDataOf({
    stock: { papic: { balance: 1500, held: 300 }, event_plus: { balance: 0, held: 0 }, event_pro: { balance: 0, held: 0 }, event_ultra: { balance: 0, held: 0 } },
    packs,
    paysGiftPrice: true,
    canBuy: true,
    openRails: [{ id: 'gcash', label: 'GCash' }],
    rewards: { left: { papic: 150, event_plus: 0, event_pro: 0, event_ultra: 0 } },
  });
  assert.equal(d.free?.papic, 1050);
  assert.equal(d.rewardLeft.papic, 150);
  assert.equal(ownGiftDataOf({ stock: null, packs, paysGiftPrice: false, canBuy: true, openRails: [] }).free, null);
});

test('no price is typed in the own-client modules', () => {
  for (const f of ['lib/own-clients.ts', 'app/vendor-dashboard/invite/_components/own-client-gift.tsx', 'app/vendor-dashboard/invite/own-client-actions.ts']) {
    const src = readFileSync(join(process.cwd(), f), 'utf8');
    assert.doesNotMatch(src, /₱\s?\d/, `${f} types a peso figure`);
  }
});

test('the own link is own only with its gift — the inquiry door asks before it stamps website', () => {
  const src = readFileSync(join(process.cwd(), 'app/v/[slug]/inquiry-actions.ts'), 'utf8');
  assert.match(src, /declaredSource === 'website'[\s\S]{0,120}ownLinkArrival\(/);
  assert.match(src, /'not_own' \? 'shop_page'/, 'without the gift the ask is a visit to the shop on Setnayan (the fee)');
});

test('an import is an own client only as the 2026-11-16 ruling says (new account · or first import on the event)', () => {
  assert.equal(importIsOwnClient({ accountNew: true, eventNew: false, firstImport: false }, true), true, '(1) the import made the account');
  assert.equal(importIsOwnClient({ accountNew: false, eventNew: true, firstImport: true }, true), true, '(2) first import on a new event');
  assert.equal(importIsOwnClient({ accountNew: false, eventNew: false, firstImport: true }, true), true, '(2, amended 9fe95ebe) first import on an event already on Setnayan');
  assert.equal(importIsOwnClient({ accountNew: false, eventNew: true, firstImport: false }, true), false, '(3) a second supplier pays');
  assert.equal(importIsOwnClient({ accountNew: null, eventNew: null, firstImport: false }, true), false, 'unknown is never free');
});

test('🪪 an unverified shop keeps the QR, but its import is never free, and its screens say why', () => {
  assert.equal(importIsOwnClient({ accountNew: true, eventNew: true, firstImport: true }, false), false, 'unverified: the flat fee, always');
  const block = readFileSync(join(process.cwd(), 'app/vendor-dashboard/invite/_components/own-client-gift.tsx'), 'utf8');
  assert.match(block, /GET_VERIFIED_LINE/);
  assert.doesNotMatch(block, /OwnClientsLocked/, 'nothing is locked — the ruling was reversed the same day');
  const action = readFileSync(join(process.cwd(), 'app/vendor-dashboard/invite/own-client-actions.ts'), 'utf8');
  assert.doesNotMatch(action, /OWN_CLIENTS_LOCKED/, 'an unverified shop may still add clients');
});

test('owner "7. Yes" / "8. Yes" (#7889): the three re-worded lines, and the own link tells a verified shop first', () => {
  const lib = readFileSync(join(process.cwd(), 'lib/own-clients.ts'), 'utf8');
  assert.match(lib, /OWN_CLIENT_PROMISE = 'Your clients can book you free\.'/);
  assert.match(lib, /ADD_CLIENT_LEAD = 'Clients new to Setnayan book you free for a year\. Each one comes with a Setnayan gift from you\.'/);
  assert.match(lib, /CONFIRM_BOOKING_FEE = 'None if they are new to Setnayan, or you are the first supplier on their event'/);
  assert.match(lib, /OWN_LINK_ADD_GIFT = 'Add a gift to your link so your clients book free\.'/);
  const block = readFileSync(join(process.cwd(), 'app/vendor-dashboard/invite/_components/own-client-gift.tsx'), 'utf8');
  assert.match(block, /v=\{CONFIRM_BOOKING_FEE\}/);
  assert.doesNotMatch(block, /None — your client/);
  // Every own code's sheet carries the notice: My page · Check a date · Reviews.
  const codes = readFileSync(join(process.cwd(), 'app/vendor-dashboard/invite/_components/qr-codes.tsx'), 'utf8');
  assert.equal((codes.match(/\{ownLinkNotice\}/g) ?? []).length, 3);
  const promote = readFileSync(join(process.cwd(), 'app/vendor-dashboard/shop/promote/_components/promote-body.tsx'), 'utf8');
  assert.match(promote, /ownLinkNotice=\{ownVerified === true && ownLinkRead === null \? <OwnLinkAddGiftNotice \/> : null\}/);
});

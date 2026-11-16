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
  REWARD_DOES_NOT_COUNT,
  anyPackPickable,
  boughtFreePapic,
  clientInviteTokenOf,
  clientInviteUrl,
  creditsFor,
  defaultOwnGift,
  importIsOwnClient,
  isEmailOrPhone,
  ownGiftDataOf,
  ownGiftLinesOf,
  ownGiftMenu,
  ownGiftWords,
  packsLeft,
  usedWhenJoinsLine,
} from './own-clients';

// Catalogue-shaped samples: the module never types these — they arrive read.
const packs: ShopGiftPack[] = [
  { code: 'PAPIC_GUEST', title: 'Papic 150', kind: 'papic', credits: 150, srpCentavos: 9900, giftPriceCentavos: null },
  { code: 'PAPIC_GUEST_1000', title: 'Papic 1000', kind: 'papic', credits: 1000, srpCentavos: 49900, giftPriceCentavos: null },
  { code: 'COUPLE_WEBSITE_PLUS', title: 'Event Plus', kind: 'event_plus', credits: 1, srpCentavos: 99900, giftPriceCentavos: null },
];

test('a badge reward never counts toward the gift (v4 answer 3)', () => {
  assert.equal(boughtFreePapic({ papic: 1200, event_plus: 0, event_pro: 0 }, { papic: 300, event_plus: 0, event_pro: 0 }), 900);
  assert.equal(boughtFreePapic({ papic: 100, event_plus: 0, event_pro: 0 }, { papic: 300, event_plus: 0, event_pro: 0 }), 0);
  assert.equal(boughtFreePapic(null, null), null, 'an unread stock is null, never 0');
});

test('the ▾ lists your stock only, greys a badge reward, and offers Buy more', () => {
  const m = ownGiftMenu(packs, 1050, 150, true);
  assert.deepEqual(m.map((o) => o.key), ['PAPIC_GUEST', 'PAPIC_GUEST_1000', '__reward', OWN_GIFT_BUY_KEY]);
  assert.equal(m[0]!.hint, '7 left');
  assert.equal(m[1]!.hint, '1 left');
  assert.equal(m[2]!.disabledNote, REWARD_DOES_NOT_COUNT);
  assert.ok(!m.some((o) => o.key === 'COUPLE_WEBSITE_PLUS'), 'Event Plus is not an own-client gift (no door gives it without a quote)');
  // A pack the stock cannot cover is not listed at all: stock only.
  assert.deepEqual(ownGiftMenu(packs, 300, 0, false).map((o) => o.key), ['PAPIC_GUEST']);
});

test('with no stock nothing is pickable, so the step lists what to buy', () => {
  assert.equal(anyPackPickable(packs, 0), false);
  assert.equal(anyPackPickable(packs, null), false);
  assert.equal(defaultOwnGift(packs, 0), null);
  assert.equal(defaultOwnGift(packs, 150), 'PAPIC_GUEST');
  assert.equal(packsLeft(149, packs[0]!), 0);
});

test('lines are read from the catalogue by code, at least one, Papic only', () => {
  assert.equal(ownGiftLinesOf([], packs), null, 'every own client carries at least one gift');
  assert.equal(ownGiftLinesOf(['COUPLE_WEBSITE_PLUS'], packs), null);
  assert.equal(ownGiftLinesOf(['NOT_A_CODE'], packs), null);
  assert.deepEqual(ownGiftLinesOf(['PAPIC_GUEST'], packs), [{ service_code: 'PAPIC_GUEST', title: 'Papic 150', kind: 'papic', credits: 150 }]);
  assert.equal(creditsFor(['PAPIC_GUEST', 'PAPIC_GUEST_1000'], packs), 1150);
  assert.equal(ownGiftLinesOf(Array(6).fill('PAPIC_GUEST'), packs), null);
});

test('the words the drawing uses', () => {
  assert.equal(usedWhenJoinsLine(1), '1 from your stock is used when the couple joins');
  assert.equal(usedWhenJoinsLine(2), '2 from your stock are used when the couple joins');
  assert.equal(ownGiftWords([{ title: 'Papic 150' }, { title: 'Papic 150' }, { title: 'Papic 1000' }]), '2 × Papic 150 and Papic 1000');
});

test('the invite link and its token', () => {
  assert.equal(clientInviteUrl('https://www.setnayan.com/', 'liwanag', 'abcdefghijklmnop'), 'https://www.setnayan.com/vendor-invite/liwanag?ci=abcdefghijklmnop');
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
    stock: { papic: { balance: 1500, held: 300 }, event_plus: { balance: 0, held: 0 }, event_pro: { balance: 0, held: 0 } },
    packs,
    paysGiftPrice: true,
    canBuy: true,
    openRails: [{ id: 'gcash', label: 'GCash' }],
    rewards: { left: { papic: 150, event_plus: 0, event_pro: 0 } },
  });
  assert.equal(d.credits, 1050);
  assert.equal(d.rewardLeft, 150);
  assert.equal(ownGiftDataOf({ stock: null, packs, paysGiftPrice: false, canBuy: true, openRails: [] }).credits, null);
});

test('no price is typed in the own-client modules', () => {
  for (const f of ['lib/own-clients.ts', 'app/vendor-dashboard/invite/_components/own-client-gift.tsx', 'app/vendor-dashboard/invite/own-client-actions.ts']) {
    const src = readFileSync(join(process.cwd(), f), 'utf8');
    assert.doesNotMatch(src, /₱\s?\d/, `${f} types a peso figure`);
  }
});

test('the own link is own only with its gift — the inquiry door asks before it stamps website', () => {
  const src = readFileSync(join(process.cwd(), 'app/v/[slug]/inquiry-actions.ts'), 'utf8');
  assert.match(src, /declaredSource === 'website'[\s\S]{0,120}ownLinkArrivalIsOwnClient/);
  assert.match(src, /\? 'shop_page'/, 'without the gift the ask is a visit to the shop on Setnayan (the fee)');
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

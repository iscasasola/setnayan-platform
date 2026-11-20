/**
 * GIFT FOR SERVICES — the picker's rules (`lib/agree-gifts.ts`), one test per owner claim (DECISION_LOG 2026-11-15,
 * "GIFT FOR SERVICES DESIGN — DECISIONS"). The database's half — the same rules re-judged by `booking_gift_pick`, the
 * bill, the stock holds and the deliveries — is `tests/db/a-gift-is-picked-when-the-supplier-agrees.db.test.ts`.
 *
 * Every price here is a FIXTURE handed in as the catalogue would hand it; the picker types none (claim 7 reads the
 * source to prove it).
 *
 * Sabotage, measured (2026-11-15): dropping the `aloneSmallest` exception turns test 2 red · `fromStock = used < have`
 * → `false` turns test 3 red · dropping the `kind !== 'papic'` count turns test 4 red · returning `true` from
 * `offersBetterPapicMix` for a plan turns test 5 red · dropping the photo-gift retirement in `quoteSetnayanGift` turns
 * test 6 red.
 *
 * ⚖ 20–21 Nov (DECISION_LOG): nothing is bought on the booking-fee bill; every booking carries AT LEAST ONE gift; a gift
 * the shop has none of is bought in the "Your gifts" store first; a SENT store payment covers one pick. Tests 3, 5b, 8
 * and 9 hold those (sabotage, measured 2026-11-21: `canRemove: count > 0` turns 8 red · dropping the `sent` pass in
 * `judgeAgreeGifts` turns 3 red · dropping the `startsWith('/vendor-dashboard/')` check turns 9 red).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  AGREE_GIFT_MAX_LINES,
  agreeGiftItems,
  agreeGiftLimitCentavos,
  agreeGiftOptions,
  agreeGiftStart,
  bestPapicMix,
  giftStoreHref,
  judgeAgreeGifts,
  offersBetterPapicMix,
  type AgreeGiftBasis,
} from './agree-gifts';
import type { FreeByKind, ShopGiftPack } from './shop-gifts';

const P150: ShopGiftPack = { code: 'PAPIC_GUEST_150', title: 'Papic 150', kind: 'papic', credits: 150, srpCentavos: 9_900 };
const P1K: ShopGiftPack = { code: 'PAPIC_GUEST_1K', title: 'Papic 1000', kind: 'papic', credits: 1_000, srpCentavos: 49_900 };
const P3K: ShopGiftPack = { code: 'PAPIC_GUEST', title: 'Papic 3000', kind: 'papic', credits: 3_000, srpCentavos: 99_900 };
const PLUS: ShopGiftPack = { code: 'EVENT_PLUS', title: 'Event Plus', kind: 'event_plus', credits: 1, srpCentavos: 299_000 };
const PRO: ShopGiftPack = { code: 'COUPLE_WEBSITE_PRO', title: 'Event Pro', kind: 'event_pro', credits: 1, srpCentavos: 569_000 };
const ULTRA: ShopGiftPack = { code: 'EVENT_ULTRA', title: 'Event Ultra', kind: 'event_ultra', credits: 1, srpCentavos: 999_000 };
const PACKS = [P150, P1K, P3K, PLUS, PRO, ULTRA];

const NONE_FREE: FreeByKind = { papic: 0, event_plus: 0, event_pro: 0, event_ultra: 0, packs: {} };

/** A shop with plenty of everything — for the tests about the limit and the plans, not about stock. */
const STOCKED: FreeByKind = {
  papic: 99,
  event_plus: 9,
  event_pro: 9,
  event_ultra: 9,
  packs: { [P150.code]: 40, [P1K.code]: 40, [P3K.code]: 40 },
};

function basis(feeCentavos: number, over: Partial<AgreeGiftBasis> = {}): AgreeGiftBasis {
  return { packs: PACKS, feeCentavos, limitPct: 40, free: NONE_FREE, eventHas: 'none', ...over };
}

test('1 · the limit is the gift limit % of THIS booking’s fee, floored — the admin setting, never typed', () => {
  assert.equal(agreeGiftLimitCentavos(120_350, 40), 48_140);
  assert.equal(agreeGiftLimitCentavos(120_351, 40), 48_140, 'floored, never a centavo over');
  assert.equal(agreeGiftLimitCentavos(120_350, 25), 30_087, 'the admin’s own percent');
  assert.equal(agreeGiftLimitCentavos(0, 40), 0);
});

test('2 · all picks together are capped at the limit, at the LIST price — the smallest Papic pack alone always fits', () => {
  const b = basis(100_000, { free: STOCKED }); // limit ₱400 — under one Papic 1000
  assert.equal(judgeAgreeGifts([P1K.code], b).state, 'over_limit');
  assert.equal(judgeAgreeGifts([P150.code], basis(10_000, { free: STOCKED })).state, 'ok', 'Papic 150 alone fits even above the limit');
  assert.equal(judgeAgreeGifts([P150.code, P150.code], basis(10_000, { free: STOCKED })).state, 'over_limit', 'two are not "alone"');
  const v = judgeAgreeGifts([P150.code, P150.code], b);
  assert.equal(v.state, 'ok');
  assert.equal(v.valueCentavos, 2 * P150.srpCentavos);
  // Ultra counts at its list price: it fits only a booking whose limit covers it.
  assert.equal(judgeAgreeGifts([ULTRA.code], basis(2_497_500, { free: STOCKED })).state, 'ok');
  assert.equal(judgeAgreeGifts([ULTRA.code], basis(2_497_400, { free: STOCKED })).state, 'over_limit');
});

test('3 · stock first, then a SENT store payment, else buy it first — never on the bill', () => {
  const free: FreeByKind = { ...NONE_FREE, event_pro: 1, packs: { [P1K.code]: 1 } };
  const b = basis(5_000_000, { free, sent: { [P1K.code]: 1 } });
  const v = judgeAgreeGifts([P1K.code, P1K.code, PRO.code], b);
  assert.equal(v.state, 'ok');
  assert.deepEqual(v.lines.map((l) => [l.pack.code, l.source]), [[P1K.code, 'stock'], [P1K.code, 'sent'], [PRO.code, 'stock']]);
  assert.equal(v.valueCentavos, 2 * P1K.srpCentavos + PRO.srpCentavos, 'the limit counts every line');
  const third = judgeAgreeGifts([P1K.code, P1K.code, P1K.code], b);
  assert.equal(third.state, 'needs_stock', 'one sent line covers ONE pick');
  assert.deepEqual(third.missing, [P1K.code]);
  const opts = agreeGiftOptions([P1K.code, P1K.code], b);
  const row = opts.find((o) => o.pack.code === P1K.code)!;
  assert.equal(row.inStock, 1, '"In your stock" is the pack’s own count');
  assert.equal(row.sent, 1, '"Bought · waiting for approval" is counted apart');
  assert.equal(row.buyMore, true, 'both used: "0 left · Buy more ›"');
  assert.equal(row.fits, true, 'one more would fit if bought — the row offers the store');
  assert.equal(row.canAdd, false, 'but it cannot be added until it is bought');
  // An unreadable stock is never free: the pick is bought in the store first.
  assert.equal(judgeAgreeGifts([P1K.code], basis(5_000_000, { free: null })).state, 'needs_stock');
});

test('4 · a plan + Papic may be combined; one plan only; never a plan the event holds (Ultra upgrades Plus/Pro)', () => {
  const big = basis(5_000_000, { free: STOCKED });
  assert.equal(judgeAgreeGifts([PRO.code, P1K.code, P150.code], big).state, 'ok', 'plan + Papic combine');
  assert.equal(judgeAgreeGifts([PLUS.code, PRO.code], big).state, 'one_plan', 'Plus + Pro never make Ultra');
  assert.equal(judgeAgreeGifts([PLUS.code], basis(5_000_000, { free: STOCKED, eventHas: 'pro' })).state, 'already_has');
  assert.equal(judgeAgreeGifts([ULTRA.code], basis(5_000_000, { free: STOCKED, eventHas: 'pro' })).state, 'ok', 'Ultra gives full Ultra');
  assert.equal(judgeAgreeGifts([ULTRA.code], basis(5_000_000, { eventHas: 'ultra' })).state, 'already_has');
  const opts = agreeGiftOptions([PRO.code], big);
  assert.equal(opts.find((o) => o.pack.code === ULTRA.code)?.canAdd, false);
  assert.equal(opts.find((o) => o.pack.code === ULTRA.code)?.why, 'One plan per gift');
  assert.equal(judgeAgreeGifts(Array(AGREE_GIFT_MAX_LINES + 1).fill(P150.code), basis(99_000_000)).state, 'too_many');
  assert.equal(judgeAgreeGifts(['NOT_ON_SALE'], big).state, 'unknown_pack');
});

test('5 · "Most credits for your limit": the best Papic mix, shown only when the gift is all Papic and a better mix exists', () => {
  const b = basis(375_000, { free: STOCKED }); // limit ₱1,500
  const best = bestPapicMix(b);
  const credits = (codes: string[]) => codes.reduce((s, c) => s + (PACKS.find((p) => p.code === c)?.credits ?? 0), 0);
  const value = (codes: string[]) => codes.reduce((s, c) => s + (PACKS.find((p) => p.code === c)?.srpCentavos ?? 0), 0);
  assert.ok(value(best) <= agreeGiftLimitCentavos(b.feeCentavos, b.limitPct), 'the mix fits the limit');
  assert.equal(credits(best), 4_000, '1 × 3000 + 1 × 1000 (₱1,498) is the most credits ₱1,500 buys here');
  assert.equal(judgeAgreeGifts(best, b).state, 'ok', 'the door would take it');
  assert.equal(offersBetterPapicMix([], b), true, 'nothing picked: a mix is better');
  assert.equal(offersBetterPapicMix([P150.code], b), true);
  assert.equal(offersBetterPapicMix(best, b), false, 'already the best: not shown');
  assert.equal(offersBetterPapicMix([PLUS.code], basis(5_000_000, { free: STOCKED })), false, 'not all Papic: not shown');
  assert.deepEqual(bestPapicMix(basis(10_000)), [P150.code], 'below the smallest pack: the always-allowed pack');
  assert.equal(offersBetterPapicMix([P150.code], basis(375_000)), false, 'never a mix that would send them off to buy');
});

test('5b · at least one gift, no exceptions (20 Nov): starts on the smallest pack and never goes to none', () => {
  const b = basis(0); // a no-fee booking still carries one
  assert.deepEqual(agreeGiftStart(b), [P150.code], 'pre-filled with the smallest Papic pack');
  assert.equal(judgeAgreeGifts([], b).state, 'none', 'zero is never ok');
  assert.equal(judgeAgreeGifts([P150.code], b).state, 'needs_stock', 'with nothing in stock it is bought first');
  assert.equal(judgeAgreeGifts([P150.code], basis(0, { free: STOCKED })).state, 'ok', 'from stock on a no-fee booking');
  assert.deepEqual(agreeGiftStart(basis(5_000_000, { free: STOCKED }), P1K.code), [P1K.code], 'back from the store: the gift bought');
  assert.deepEqual(agreeGiftStart(b, 'NOT_ON_SALE'), [P150.code], 'an unknown return falls back to the smallest pack');
});

test('8 · the last gift cannot be taken off', () => {
  const b = basis(5_000_000, { free: STOCKED });
  assert.equal(agreeGiftOptions([P150.code], b).find((o) => o.pack.code === P150.code)?.canRemove, false);
  assert.equal(agreeGiftOptions([P150.code, P1K.code], b).find((o) => o.pack.code === P150.code)?.canRemove, true);
  assert.equal(agreeGiftOptions([P150.code], b).find((o) => o.pack.code === P1K.code)?.canRemove, false, 'none of it to take off');
});

test('9 · "0 left · Buy more ›" opens the store with the gift chosen and a same-site way back', () => {
  assert.equal(
    giftStoreHref(P1K.code, '/vendor-dashboard/clients/E1?agree_gift=PAPIC_GUEST_1K'),
    '/vendor-dashboard/shop/promote?gift=PAPIC_GUEST_1K&back=%2Fvendor-dashboard%2Fclients%2FE1%3Fagree_gift%3DPAPIC_GUEST_1K#gifts',
  );
  assert.equal(giftStoreHref(P1K.code, 'https://evil.example/x'), '/vendor-dashboard/shop/promote?gift=PAPIC_GUEST_1K#gifts', 'never off-site');
  assert.equal(giftStoreHref(null, '//evil.example'), '/vendor-dashboard/shop/promote#gifts');
});

test('6 · the old photo gift is retired: no quote, card or forecast promises it', async () => {
  const src = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');
  const lib = await import('./setnayan-gift');
  assert.equal(lib.SETNAYAN_PHOTO_GIFT_RETIRED, true);
  assert.match(src('lib/setnayan-gift.server.ts'), /if \(SETNAYAN_PHOTO_GIFT_RETIRED\) return null;/, 'quoteSetnayanGift still promises photos');
  assert.match(src('lib/papic-on-a-quote.server.ts'), /if \(SETNAYAN_PHOTO_GIFT_RETIRED\) return \{ kind: 'silent' \};/, 'the composer still promises photos');
  assert.match(src('app/_components/setnayan-gift-line.tsx'), /if \(SETNAYAN_PHOTO_GIFT_RETIRED\) return null;/, 'the card line is still drawn');
  const { giftMenu, GIFT_SETNAYAN } = await import('./gift-pick');
  assert.equal(giftMenu([], null).some((o) => o.key === GIFT_SETNAYAN), false, 'a card is still offered the photo gift');
  assert.equal(giftMenu([], null, GIFT_SETNAYAN).some((o) => o.key === GIFT_SETNAYAN), true, 'a saved card keeps its value');
});

test('7 · the Agree step posts the picks with the yes, and nothing in the picker types a price', () => {
  const src = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');
  const panel = src('app/vendor-dashboard/clients/[eventId]/_components/booking-ask-panel.tsx');
  assert.match(panel, /<form action=\{agreeLock\}[\s\S]{0,400}<AgreeGiftPicker basis=\{giftBasis\} \/>/, 'the picker is not inside the Agree form');
  const picker = src('app/vendor-dashboard/clients/[eventId]/_components/agree-gift-picker.tsx');
  assert.match(picker, /type="hidden" name="gift" value=\{c\}/, 'a pick does not post');
  const action = src('app/vendor-dashboard/clients/[eventId]/actions.ts');
  const agree = action.slice(action.indexOf('export async function vendorAgreeToLock'));
  const dry = agree.indexOf('dryRun: true');
  const yes = agree.indexOf("rpc('vendor_agree_to_lock'");
  const mint = agree.indexOf('mintBookingFeeForBooking(');
  const record = agree.indexOf('recordAgreeGifts(createAdminClient(), { eventVendorId, codes: giftCodes })');
  assert.ok(dry > 0 && dry < yes, 'the gift must be judged BEFORE the yes, so a refusal books nothing');
  assert.ok(mint > yes && record > mint, 'the gift is written after the yes and the fee (it is sized on the fee)');
  for (const file of ['lib/agree-gifts.ts', 'app/vendor-dashboard/clients/[eventId]/_components/agree-gift-picker.tsx']) {
    const code = src(file).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    assert.doesNotMatch(code, /₱\s?\d/, `${file} types a peso figure`);
  }
  assert.equal(agreeGiftItems(judgeAgreeGifts([P1K.code, P1K.code, PRO.code], basis(5_000_000, { free: STOCKED })).lines), '2 × Papic 1000 · Event Pro');
});

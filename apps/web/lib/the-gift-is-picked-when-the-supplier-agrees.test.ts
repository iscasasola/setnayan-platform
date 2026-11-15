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
 * test 6 red · dropping the `stockOnly` check turns test 5b red.
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
  bestPapicMix,
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
  const b = basis(100_000); // limit ₱400 — under one Papic 1000
  assert.equal(judgeAgreeGifts([P1K.code], b).state, 'over_limit');
  assert.equal(judgeAgreeGifts([P150.code], basis(10_000)).state, 'ok', 'Papic 150 alone fits even above the limit');
  assert.equal(judgeAgreeGifts([P150.code, P150.code], basis(10_000)).state, 'over_limit', 'two are not "alone"');
  const v = judgeAgreeGifts([P150.code, P150.code], b);
  assert.equal(v.state, 'ok');
  assert.equal(v.valueCentavos, 2 * P150.srpCentavos);
  // Ultra counts at its list price: it fits only a booking whose limit covers it.
  assert.equal(judgeAgreeGifts([ULTRA.code], basis(2_497_500)).state, 'ok');
  assert.equal(judgeAgreeGifts([ULTRA.code], basis(2_497_400)).state, 'over_limit');
});

test('3 · stock first: what the shop holds costs nothing more but still counts toward the limit', () => {
  const free: FreeByKind = { ...NONE_FREE, event_pro: 1, packs: { [P1K.code]: 1 } };
  const b = basis(5_000_000, { free });
  const v = judgeAgreeGifts([P1K.code, P1K.code, PRO.code], b);
  assert.equal(v.state, 'ok');
  assert.deepEqual(v.lines.map((l) => [l.pack.code, l.fromStock]), [[P1K.code, true], [P1K.code, false], [PRO.code, true]]);
  assert.equal(v.valueCentavos, 2 * P1K.srpCentavos + PRO.srpCentavos, 'the limit counts the stock lines');
  assert.equal(v.boughtCentavos, P1K.srpCentavos, 'the bill adds only what was not in stock');
  const opts = agreeGiftOptions([], b);
  assert.equal(opts.find((o) => o.pack.code === P1K.code)?.inStock, 1, '"In your stock" is the pack’s own count');
  // An unreadable stock prices everything as bought — never as free.
  assert.equal(judgeAgreeGifts([P1K.code], basis(5_000_000, { free: null })).boughtCentavos, P1K.srpCentavos);
});

test('4 · a plan + Papic may be combined; one plan only; never a plan the event holds (Ultra upgrades Plus/Pro)', () => {
  const big = basis(5_000_000);
  assert.equal(judgeAgreeGifts([PRO.code, P1K.code, P150.code], big).state, 'ok', 'plan + Papic combine');
  assert.equal(judgeAgreeGifts([PLUS.code, PRO.code], big).state, 'one_plan', 'Plus + Pro never make Ultra');
  assert.equal(judgeAgreeGifts([PLUS.code], basis(5_000_000, { eventHas: 'pro' })).state, 'already_has');
  assert.equal(judgeAgreeGifts([ULTRA.code], basis(5_000_000, { eventHas: 'pro' })).state, 'ok', 'Ultra gives full Ultra');
  assert.equal(judgeAgreeGifts([ULTRA.code], basis(5_000_000, { eventHas: 'ultra' })).state, 'already_has');
  const opts = agreeGiftOptions([PRO.code], big);
  assert.equal(opts.find((o) => o.pack.code === ULTRA.code)?.canAdd, false);
  assert.equal(opts.find((o) => o.pack.code === ULTRA.code)?.why, 'One plan per gift');
  assert.equal(judgeAgreeGifts(Array(AGREE_GIFT_MAX_LINES + 1).fill(P150.code), basis(99_000_000)).state, 'too_many');
  assert.equal(judgeAgreeGifts(['NOT_ON_SALE'], big).state, 'unknown_pack');
});

test('5 · "Most credits for your limit": the best Papic mix, shown only when the gift is all Papic and a better mix exists', () => {
  const b = basis(375_000); // limit ₱1,500
  const best = bestPapicMix(b);
  const credits = (codes: string[]) => codes.reduce((s, c) => s + (PACKS.find((p) => p.code === c)?.credits ?? 0), 0);
  const value = (codes: string[]) => codes.reduce((s, c) => s + (PACKS.find((p) => p.code === c)?.srpCentavos ?? 0), 0);
  assert.ok(value(best) <= agreeGiftLimitCentavos(b.feeCentavos, b.limitPct), 'the mix fits the limit');
  assert.equal(credits(best), 4_000, '1 × 3000 + 1 × 1000 (₱1,498) is the most credits ₱1,500 buys here');
  assert.equal(judgeAgreeGifts(best, b).state, 'ok', 'the door would take it');
  assert.equal(offersBetterPapicMix([], b), true, 'nothing picked: a mix is better');
  assert.equal(offersBetterPapicMix([P150.code], b), true);
  assert.equal(offersBetterPapicMix(best, b), false, 'already the best: not shown');
  assert.equal(offersBetterPapicMix([PLUS.code], basis(5_000_000)), false, 'not all Papic: not shown');
  assert.deepEqual(bestPapicMix(basis(10_000)), [P150.code], 'below the smallest pack: the always-allowed pack');
});

test('5b · no bill (owner 2026-11-16): only gifts from stock — nothing bought, no "Most credits" mix to buy', () => {
  const free: FreeByKind = { ...NONE_FREE, packs: { [P150.code]: 2 } };
  const b = basis(5_000_000, { free, stockOnly: true });
  const v = judgeAgreeGifts([P150.code, P150.code], b);
  assert.equal(v.state, 'ok', 'stock gifts go on a booking with no bill');
  assert.equal(v.boughtCentavos, 0);
  assert.equal(judgeAgreeGifts([P150.code, P150.code, P150.code], b).state, 'stock_only', 'a third is not in stock');
  assert.equal(judgeAgreeGifts([PRO.code], b).state, 'stock_only', 'a plan not held cannot be bought here');
  const opts = agreeGiftOptions([P150.code, P150.code], b);
  assert.equal(opts.find((o) => o.pack.code === P150.code)?.why, 'Not in your stock — this booking has no bill to buy on');
  assert.equal(offersBetterPapicMix([], b), false, 'no mix to buy where nothing can be bought');
  assert.equal(judgeAgreeGifts([PRO.code], basis(5_000_000)).state, 'ok', 'a billed booking still buys');
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
  const mint = agree.indexOf('mintBookingFeeForBooking(');
  const record = agree.indexOf('recordAgreeGifts(');
  assert.ok(mint > 0 && record > mint, 'the gift must be recorded AFTER the fee is minted (it is sized on the bill)');
  for (const file of ['lib/agree-gifts.ts', 'app/vendor-dashboard/clients/[eventId]/_components/agree-gift-picker.tsx']) {
    const code = src(file).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    assert.doesNotMatch(code, /₱\s?\d/, `${file} types a peso figure`);
  }
  assert.equal(agreeGiftItems(judgeAgreeGifts([P1K.code, P1K.code, PRO.code], basis(5_000_000)).lines), '2 × Papic 1000 · Event Pro');
});

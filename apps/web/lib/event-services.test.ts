/**
 * 🛒 EVENT SERVICES — the pure half, executed (owner 2026-11-23; drawing v4 "The saving, checked" table).
 *
 * The figures below are TEST INPUTS — the drawing's own worked example (Hub 2,790 · AI 2,790 · Live Watch 3,990 · photos
 * 99 / 499 / 999 · Plus 2,990 · Pro 5,490 · Ultra 9,990) — so the arithmetic the page does is the arithmetic the owner
 * checked. The page never holds a figure: every one is read (`readEventServices`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EMPTY_PICK,
  PACK_HOLDS,
  applySwitch,
  cartFor,
  cheapestPhotosPhp,
  packHoldsLine,
  packSavingPhp,
  parsePick,
  shownPacks,
  switchOffer,
  type EventServicesFacts,
  type PackFact,
  type PhotoFact,
  type SingleFact,
} from './event-services';
import { AI_PLAN_SKUS, PLAN_PRICE_CODES } from './event-plans';
import { SKU_OWNERSHIP_ALIASES } from './entitlements';
import { EVENT_HUB_SKU } from './hub-parts';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

const SIZES: PhotoFact[] = [
  { code: 'PAPIC_GUEST_150', points: 150, php: 99 },
  { code: 'PAPIC_GUEST_1K', points: 1000, php: 499 },
  { code: 'PAPIC_GUEST', points: 3000, php: 999 },
];
const single = (key: SingleFact['key'], php: number | null, state: SingleFact['state'] = 'buy'): SingleFact => ({
  key,
  code: key === 'hub' ? 'EVENT_HUB' : key === 'ai' ? 'SETNAYAN_AI' : 'LIVE_STUDIO',
  php,
  state,
});
const SINGLES = [single('hub', 2790), single('ai', 2790), single('live', 3990)];
const pack = (key: PackFact['key'], php: number | null, credits: number, over: Partial<PackFact> = {}): PackFact => ({
  key,
  code: PLAN_PRICE_CODES[key],
  name: key === 'plus' ? 'Event Plus' : key === 'pro' ? 'Event Pro' : 'Event Ultra',
  credits,
  addsCredits: credits,
  php,
  upgrade: false,
  state: 'buy',
  savePhp: null,
  fits: null,
  info: [],
  ...over,
});
const facts = (over: Partial<EventServicesFacts> = {}): EventServicesFacts => ({
  eyebrow: 'Ana & Miguel · Sat 12 Dec 2026',
  plan: 'free',
  planName: 'Free',
  photosLeft: 150,
  packs: [pack('plus', 2990, 1000), pack('pro', 5490, 3000), pack('ultra', 9990, 6000)],
  singles: SINGLES,
  photos: SIZES,
  ...over,
});

test('the saving, checked — exactly the drawing’s table (299 · 1,089 · 1,578)', () => {
  assert.equal(packSavingPhp(pack('plus', 2990, 1000), SINGLES, SIZES), 299);
  assert.equal(packSavingPhp(pack('pro', 5490, 3000), SINGLES, SIZES), 1089);
  assert.equal(packSavingPhp(pack('ultra', 9990, 6000), SINGLES, SIZES), 1578, '6,000 photos = two 3,000 packs');
  assert.equal(cheapestPhotosPhp(6000, SIZES), 1998);
});

test('a saving is never said on a guess, against a difference, or at zero or less', () => {
  assert.equal(packSavingPhp(pack('pro', 5490, 3000), [single('hub', 2790), single('ai', null)], SIZES), null, 'a part unread');
  assert.equal(packSavingPhp(pack('pro', 5490, 3000), SINGLES, null), null, 'photo sizes unread');
  assert.equal(packSavingPhp(pack('pro', 5490, 3000, { upgrade: true }), SINGLES, SIZES), null, 'an upgrade pays the difference');
  // Live Watch still at its old row price: Ultra's parts cost less than Ultra → no "Save".
  assert.equal(packSavingPhp(pack('ultra', 9990, 6000), [single('hub', 2790), single('ai', 2790), single('live', 1990)], SIZES), null);
  assert.equal(cheapestPhotosPhp(1050, SIZES), 693, '1,050 is only seven 150s');
  assert.equal(cheapestPhotosPhp(70, SIZES), null, 'no mix makes 70');
});

test('a pack and add-ons: ONE cart — the drawing’s “Event Pro + Live Watch + 1,000 photos”, After this: 4,150', () => {
  const f = facts();
  const cart = cartFor(f, { pack: 'pro', singles: ['hub', 'ai', 'live'], photos: 'PAPIC_GUEST_1K' });
  assert.equal(cart.label, 'Event Pro + Live Watch + 1,000 photos', 'Hub and AI are in the pack — never billed twice');
  assert.deepEqual(cart.lines.map((l) => l.code), ['COUPLE_WEBSITE_PRO', 'LIVE_STUDIO', 'PAPIC_GUEST_1K']);
  assert.equal(cart.totalPhp, 5490 + 3990 + 499);
  assert.equal(cart.photosAfter, 4150);
  assert.equal(cartFor(f, EMPTY_PICK).totalPhp, null, 'nothing picked → no total');
});

test('the Switch line: Event Hub + Setnayan AI → “Event Pro has both, plus 3,000 photos, for ₱90 less”', () => {
  const f = facts();
  const pick = { pack: null, singles: ['hub', 'ai'] as const, photos: null };
  const offer = switchOffer(f, { ...pick, singles: [...pick.singles] });
  assert.ok(offer);
  assert.equal(offer.pack, 'pro');
  assert.equal(offer.lessPhp, 90);
  assert.equal(offer.extraPhotos, 3000);
  const taken = applySwitch({ ...pick, singles: [...pick.singles] }, offer);
  assert.deepEqual(taken, { pack: 'pro', singles: [], photos: null });
  assert.equal(switchOffer(f, { pack: null, singles: ['live'], photos: null }), null, 'one single → no line');
  assert.equal(switchOffer(f, { pack: 'plus', singles: ['ai', 'live'], photos: null }), null, 'a pack picked → no line');
});

test('on a plan only the NEXT pack shows, and it says what it adds', () => {
  const f = facts({
    plan: 'pro',
    planName: 'Event Pro',
    packs: [
      pack('plus', null, 1000, { state: 'yours' }),
      pack('pro', null, 3000, { state: 'yours' }),
      pack('ultra', 4500, 6000, { addsCredits: 3000, upgrade: true }),
    ],
  });
  const shown = shownPacks(f);
  assert.equal(shown.title, 'Next pack');
  assert.deepEqual(shown.packs.map((p) => p.key), ['ultra']);
  assert.equal(packHoldsLine(shown.packs[0]!, true, 'pro'), 'Adds Live Watch · 3,000 more photos');
  assert.deepEqual(shownPacks(facts({ plan: 'ultra' })).packs, [], 'Ultra → no pack section');
  assert.equal(shownPacks(facts()).packs.length, 3, 'Free → every pack');
});

test('what each pack holds is the product’s own rule — Setnayan AI (AI_PLAN_SKUS) and Live Watch (the alias list)', () => {
  for (const [key, code] of Object.entries(PLAN_PRICE_CODES) as Array<[keyof typeof PACK_HOLDS, string]>) {
    assert.equal(PACK_HOLDS[key].includes('ai'), AI_PLAN_SKUS.includes(code), `${code}: Setnayan AI`);
    assert.equal(PACK_HOLDS[key].includes('live'), (SKU_OWNERSHIP_ALIASES.LIVE_STUDIO ?? []).includes(code), `${code}: Live Watch`);
    assert.ok(PACK_HOLDS[key].includes('hub'), `${code}: every plan holds the whole Event Hub (owner 20 Nov)`);
  }
  // The Event Hub single opens what Event Plus opens — on every one of Plus's gate lists.
  for (const [gate, keys] of Object.entries(SKU_OWNERSHIP_ALIASES)) {
    if (keys.includes('EVENT_PLUS')) assert.ok(keys.includes(EVENT_HUB_SKU), `${gate}: Event Plus opens it, the Event Hub single does not`);
  }
});

test('a pick from the browser is closed values only', () => {
  assert.deepEqual(parsePick({ pack: 'pro', singles: ['ai', 'ai', 'x'], photos: 'PAPIC_GUEST_1K', php: 1 }), {
    pack: 'pro',
    singles: ['ai'],
    photos: 'PAPIC_GUEST_1K',
  });
  assert.deepEqual(parsePick({ pack: 'gold', singles: 'ai', photos: "x'; drop" }), { pack: null, singles: [], photos: null });
  assert.deepEqual(parsePick(null), { pack: null, singles: [], photos: null });
});

test('the order mint prices nothing the browser sent — the cart is cartFor over the server’s own read', () => {
  const src = readFileSync(join(WEB, 'lib/event-services-orders.ts'), 'utf8');
  assert.match(src, /const facts = await readEventServices\(eventId\)/);
  assert.match(src, /const cart = cartFor\(facts, pick\)/);
  assert.match(src, /requested_total_php: cart\.totalPhp/);
  assert.match(src, /service_key: EVENT_SERVICES_SKU/);
});

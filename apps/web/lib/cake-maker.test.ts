/**
 * 🎂 The Cake Maker's rules (lib/cake-maker.ts, v6 — DECISION_LOG 2026-11-21 "CAKE MAKER v6 = THE BUILD REFERENCE"):
 * the shop's options set ONCE per shop, the design's estimate and its quote lines, and the chat message that names the
 * stored design. The server checks with the same functions the screens use, so these pin both.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  CAKE_DESIGN_HEAD,
  CAKE_INVITE_BODY,
  cakeDesignOf,
  cakeDesignRefOf,
  cakeOfferOf,
  cakeQuoteLines,
  cakeShopTemplate,
  formatCakeDesignBlock,
  isCakeKind,
  sanitizeCakeShopOptions,
  servesWords,
  tierName,
  type CakeShopOptions,
} from './cake-maker';
import { CAKE_DESIGN_HEAD_WORDS, CAKE_INVITE_WORDS, cakeDesignAt, isCakeInvite } from './chat-card-lines';
import { sanitizeCakeConfig, startingCakeConfig, type CakeConfig } from './cake-config';

const WEB = process.cwd();
const K = 100_000; // ₱1,000 — a SAMPLE extra
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

function shop(): CakeShopOptions {
  const o = cakeShopTemplate();
  o.sizes = o.sizes.map((s) => (s.count === 4 ? { ...s, extraCentavos: 3 * K, serves: 140 } : s.count === 5 ? { ...s, extraCentavos: 6 * K, serves: 200 } : s.count === 3 ? { ...s, serves: 90 } : s));
  o.display = { extraCentavos: K };
  o.flavours = o.flavours.map((f) => (f.label === 'Red velvet' ? { ...f, extraCentavos: K } : f));
  o.shapes = [
    { id: 'round', extraCentavos: 0 },
    { id: 'square', extraCentavos: K },
  ];
  o.tall = { extraCentavos: 2 * K };
  o.arrangements = [
    { id: 'stacked', extraCentavos: 0 },
    { id: 'floating', extraCentavos: 2 * K },
  ];
  o.accents = [
    { id: 'none', extraCentavos: 0 },
    { id: 'ribbon', extraCentavos: 0 },
    { id: 'pearls', extraCentavos: K },
  ];
  o.monogram = { extraCentavos: K };
  o.cupcakes = { packs: [{ count: 24, priceCentavos: 4 * K }], tower: true };
  return o;
}

test('a fresh Cake Maker saves as it is, with every extra at ₱0 — nothing is priced for the shop', () => {
  const t = cakeShopTemplate();
  const r = sanitizeCakeShopOptions(t);
  assert.ok(r.ok, r.ok ? '' : r.problem);
  const extras = JSON.stringify(t).match(/"(extraCentavos|priceCentavos)":(\d+)/g) ?? [];
  assert.ok(extras.length > 0 && extras.every((x) => x.endsWith(':0')), 'the template typed a peso figure');
  assert.ok(sanitizeCakeShopOptions(shop()).ok);
});

test('the shop’s options are refused, never repaired', () => {
  const no = (mut: (o: CakeShopOptions) => void, word: RegExp) => {
    const o = shop();
    mut(o);
    const r = sanitizeCakeShopOptions(o);
    assert.ok(!r.ok, `accepted: ${word}`);
    if (!r.ok) assert.match(r.problem, word);
  };
  no((o) => (o.sizes = o.sizes.map((s) => (s.count === o.standardSize ? { ...s, extraCentavos: K } : s))), /Standard size has no extra/);
  no((o) => (o.sizes = [...o.sizes, { count: 11, extraCentavos: 0, serves: null }]), /1 to 10/);
  no((o) => (o.shapes = o.shapes.filter((s) => s.id !== 'round')), /plain choice/);
  no((o) => (o.arrangements = [{ id: 'floating', extraCentavos: 0 }]), /plain choice/);
  no((o) => (o.flavours = [...o.flavours, { ref: 'f99', label: 'Vanilla chiffon', extraCentavos: 0 }]), /twice/);
  no((o) => (o.colourPick = 4), /1 to 3/);
  no((o) => (o.colours = [{ name: 'Rose', hex: 'pink' }]), /colour/i);
  no((o) => (o.messageMax = 61), /0 to 60/);
  // A negative extra is refused, never clamped to ₱0 (a discount is the shop's quote, not a pick).
  no((o) => (o.sizes = o.sizes.map((s) => (s.count === 4 ? { ...s, extraCentavos: -K } : s))), /below ₱0/);
  no((o) => (o.flavours = o.flavours.map((f, i) => (i === 1 ? { ...f, extraCentavos: -1 } : f))), /below ₱0/);
  no((o) => (o.display = { extraCentavos: -K }), /below ₱0/);
  no((o) => ((o as { v: number }).v = 2), /older Cake Maker/);
});

test('isCakeKind: the shops whose chat gets “Design a cake”', () => {
  assert.ok(isCakeKind('wedding_cake') && isCakeKind('cake'));
  assert.ok(!isCakeKind('catering') && !isCakeKind(null));
});

function design(o: CakeShopOptions, over: Partial<CakeConfig>): CakeConfig {
  const r = sanitizeCakeConfig({ ...startingCakeConfig(cakeOfferOf(o), o.standardSize, { flavourRef: o.standardFlavour }), ...over }, cakeOfferOf(o));
  assert.ok(r.ok, r.ok ? '' : r.reason);
  return r.config;
}

test('the estimate is the cake card’s one price + every extra the shop typed — per tier where it is per tier', () => {
  const o = shop();
  const config = design(o, {
    tiers: [
      { kind: 'display', flavourRef: null, accent: 'pearls', shape: 'round', tall: false },
      { kind: 'real', flavourRef: 'f5', accent: 'pearls', shape: 'round', tall: false },
      { kind: 'real', flavourRef: 'f1', accent: 'none', shape: 'round', tall: false },
      { kind: 'real', flavourRef: 'f1', accent: 'ribbon', shape: 'square', tall: true },
    ],
    cuttingTier: 3,
    arrangement: 'floating',
    monogram: 'board',
    cupcakes: { packRef: 'pack:24', flavourRef: null, match: true, placement: 'tower' },
  });
  const ONE = 18_000 * 100; // SAMPLE one price
  const d = cakeDesignOf(o, config, { name: 'Wedding cake', oneCentavos: ONE });
  // 4 tiers +3K · display +1K · red velvet +1K · square +1K · tall +2K · pearls ×2 +2K · floating +2K · monogram +1K · 24 cupcakes +4K
  const extras = 3 * K + K + K + K + 2 * K + 2 * K + 2 * K + K + 4 * K;
  assert.equal(d.extrasCentavos, extras);
  assert.equal(d.estimateCentavos, ONE + extras);
  const lines = cakeQuoteLines(d);
  assert.equal(lines[0]!.label, 'Wedding cake · one price');
  assert.equal(lines[0]!.centavos, ONE);
  assert.equal(lines.reduce((a, l) => a + l.centavos, 0), d.estimateCentavos, 'the quote lines add up to the estimate');
  assert.ok(lines.slice(1).every((l) => l.centavos > 0), 'a free pick is never a quote line');
  assert.equal(d.tiers[3]!.name, 'Tier 4 · bottom');
  assert.match(d.tiers[3]!.words, /real · vanilla chiffon · square · tall · cutting/);
});

test('no priced cake card → no estimate: the shop quotes the price (never a guessed one)', () => {
  const o = shop();
  const d = cakeDesignOf(o, design(o, {}), null);
  assert.equal(d.estimateCentavos, null);
  assert.equal(d.cardName, null);
  assert.match(formatCakeDesignBlock(d, '00000000-0000-4000-8000-000000000000'), /the shop quotes the price/);
});

test('servings sit beside the couple’s own guest count', () => {
  const o = shop();
  assert.equal(servesWords(o, 3, 180), '3 tiers serve about 90 · for your 180 guests, pick 5 or more');
  assert.equal(servesWords(o, 5, 180), '5 tiers serve about 200 · fits your 180 guests');
  assert.equal(servesWords(o, 1, 180), null, 'no “serves” typed → nothing said');
  assert.equal(tierName(0, 3), 'Tier 1');
});

test('the design message names its stored row last; the invite is its own words; plain text is neither', () => {
  const o = shop();
  const d = cakeDesignOf(o, design(o, {}), { name: 'Wedding cake', oneCentavos: 1_800_000 });
  const id = '3f2b8c1e-9a4d-4e6b-8c2a-1d2e3f4a5b6c';
  const body = formatCakeDesignBlock(d, id);
  assert.ok(body.startsWith(CAKE_DESIGN_HEAD));
  assert.equal(cakeDesignRefOf(body), id);
  assert.equal(cakeDesignRefOf(`${body}\nP.S. thanks`), null, 'the ref is the LAST line');
  assert.equal(cakeDesignRefOf('Design ref: not-a-uuid'), null);
  assert.equal(CAKE_DESIGN_HEAD.trimEnd(), CAKE_DESIGN_HEAD_WORDS.trimEnd(), 'the head words drifted from chat-card-lines');
  assert.equal(cakeDesignAt(`Hi!\n${body}`), 3);
  assert.ok(CAKE_INVITE_BODY.startsWith(CAKE_INVITE_WORDS), 'the invite words drifted from chat-card-lines');
  assert.ok(isCakeInvite(CAKE_INVITE_BODY) && !isCakeInvite('Design your cake for us'));
});

test('one server action carries the whole Cake Maker; the send re-checks the design and stores it before naming it', () => {
  const src = read('app/_components/cake-maker/cake-actions.ts');
  assert.equal((src.match(/^export async function /gm) ?? []).length, 1, 'a second server action crept in (the cap is 1251)');
  assert.match(src, /buildCakeDesign\(/);
  const send = src.slice(src.indexOf("if (op === 'send')"));
  assert.ok(send.indexOf('storeCakeDesign(') < send.indexOf('sendChatMessageCore('), 'the message must name a stored design');
  assert.match(send, /dropCakeDesign\(/, 'a refused message leaves a stored design behind');
});

test('nothing on service cards: no cake part on the Card Maker, and Book at this total is gone', () => {
  const maker = read('app/vendor-dashboard/services/_components/canvas-maker.tsx');
  assert.doesNotMatch(maker, /CakeOptions|cake-options-step|CAKE_OPTIONS_FIELD/);
  assert.match(maker, /<CustomFormAsk /, '“Need your own form?” left the customization part');
  for (const f of ['app/_components/cake-maker/cake-designer.tsx', 'app/_components/chat/cards/cake-design-card.tsx']) assert.doesNotMatch(read(f), /Book at this total/);
});

test('the migration names the two tables and nothing on packages', () => {
  const dir = join(WEB, '..', '..', 'supabase', 'migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_cake_maker_shop_and_designs.sql'));
  assert.ok(file, 'the Cake Maker migration is missing');
  const sql = readFileSync(join(dir, file), 'utf8');
  assert.match(sql, /create table if not exists public\.vendor_cake_makers/i);
  assert.match(sql, /create table if not exists public\.cake_designs/i);
  assert.match(sql, /enable row level security/i);
  assert.doesNotMatch(sql, /alter table public\.vendor_package_items|cake_part|look_key/i, 'the v6 build adds nothing to packages');
});

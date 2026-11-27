/**
 * 👗 THE DESIGNER PRICES, THE BRIDE SEES ONE NUMBER — plan step B2 (corpus WHATS_NEXT_Gown_Maker_Port_2026-11-27.md
 * § 5; DESIGN-REVIEW-v187 § D add-ons, owner 2026-11-27).
 *
 *   1 · The template prices nothing and offers no add-on (which are free is the designer's choice).
 *   2 · An unpriced line stays unpriced (null), never zero, and is left out of the totals and counted.
 *   3 · No starting price and nothing priced → no estimate ("Ask for a quote"), never ₱0.
 *   4 · "Covers the design until it costs more" and "Base plus every extra" on three gowns (worked by hand below).
 *   5 · Add-ons: Priced adds her amount, Included free shows "Included", On request shows "Ask your designer" with no
 *       amount, Not offered is hidden and never priced; a petticoat add-on covers the petticoat's tulle and hoop.
 *   6 · What the bride holds carries no line, no cost, no markup and no hour.
 *   7 · The options check refuses, never repairs.
 *   8 · Suggested for custom gown makers only (owner Q3); no peso typed and no money formatted outside lib/php.ts.
 *
 * Run: cd apps/web && npx tsx --test lib/gown-maker.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GOWN_ADD_ONS,
  GOWN_ADD_ON_ASK,
  GOWN_ADD_ON_INCLUDED,
  GOWN_PRICE_GROUPS,
  GOWN_PRICE_ITEMS,
  gownAddOnsOffered,
  gownDesignOf,
  gownShopTemplate,
  isGownKind,
  sanitizeGownShopOptions,
  type GownShopOptions,
} from './gown-maker';
import { emptyGownQuantities, startingGownConfig, type GownQuantities } from './gown-config';

// Amounts in tests are arbitrary round centavo figures chosen to make the arithmetic visible; they are not prices.
const C = (n: number) => n * 100;

function shop(over: Partial<GownShopOptions> = {}): GownShopOptions {
  return { ...gownShopTemplate(), ...over };
}
const design = (over: Partial<ReturnType<typeof startingGownConfig>> = {}) => ({ ...startingGownConfig(), ...over });
function qty(fn: (q: GownQuantities) => void): GownQuantities {
  const q = emptyGownQuantities();
  fn(q);
  return q;
}

// Three gowns. A: plain satin A-line. B: beaded mermaid with long sleeves. C: ball gown with a hoop petticoat.
const gownA = { d: design({ sil: 'aline', fabric: 'satin', lining: 'satin', closure: 'zipper' }), q: qty((q) => { q.materials.outerM = 6; q.materials.liningM = 5; q.materials.zippers = 1; }) };
const gownB = {
  d: design({ sil: 'mermaid', fabric: 'crepe', lining: 'satin', closure: 'buttons', sleeve: 'long' }),
  q: qty((q) => {
    q.materials.outerM = 5;
    q.materials.accentM = 1;
    q.materials.liningM = 4;
    q.materials.buttons = 20;
    q.materials.beads.crystal = 1000;
    q.labour.sleeve = 'long';
    q.labour.beads = 1000;
  }),
};
const gownC = {
  d: design({ sil: 'ball', fabric: 'mikado', lining: 'satin', closure: 'lace' }),
  q: qty((q) => { q.materials.outerM = 10; q.materials.liningM = 8; q.materials.netM = 12; q.materials.hoops = 1; q.materials.eyelets = 24; q.materials.cordM = 3; }),
};

const prices = {
  base_aline: C(20000), base_mermaid: C(30000), base_ball: C(40000),
  fab_satin: C(300), fab_crepe: C(400), fab_mikado: C(600),
  lin_satin: C(100), zipper: C(50), button: C(10), eyelet: C(5), cord: C(20), net: C(80), hoop: C(500),
  bead_crystal: C(200), rate: C(150),
};

test('1 · the template prices nothing and offers no add-on', () => {
  const t = gownShopTemplate();
  assert.deepEqual(t.prices, {});
  assert.deepEqual(gownAddOnsOffered(t), []);
  assert.ok(GOWN_ADD_ONS.every((a) => t.addOns[a.id].state === 'none'));
  assert.equal(t.markupPct, 0);
  assert.ok(sanitizeGownShopOptions(t).ok, 'the template does not pass its own check');
});

test('2 · an unpriced line stays unpriced, is left out and counted', () => {
  const o = shop({ prices: { base_aline: C(20000), fab_satin: C(300) } });
  const p = gownDesignOf(o, gownA.d, gownA.q, []);
  const lining = p.forShop.lines.find((l) => l.key === 'lin_satin')!;
  assert.equal(lining.unitCentavos, null);
  assert.equal(lining.amountCentavos, null);
  assert.equal(p.forShop.unpriced, 2, 'lining and zipper are unpriced');
  assert.equal(p.forShop.suppliesCentavos, 6 * C(300));
});

test('3 · no starting price and nothing priced → ask for a quote, never zero', () => {
  const p = gownDesignOf(shop(), gownA.d, gownA.q, []);
  assert.equal(p.forBride.estimateCentavos, null);
  assert.equal(p.forShop.totalCentavos, null);
  const ex = gownDesignOf(shop({ mode: 'extras', prices: { fab_satin: C(300) } }), gownA.d, gownA.q, []);
  assert.equal(ex.forBride.estimateCentavos, null, 'extras mode with no locked base still showed a price');
});

test('4 · covers mode on three gowns', () => {
  const o = shop({ prices, markupPct: 10 });
  // A: 6×300 + 5×100 + 50 = 2,350 cost → 2,585 with markup, under the 20,000 base → the base.
  const a = gownDesignOf(o, gownA.d, gownA.q, []);
  assert.equal(a.forShop.designCentavos, Math.round(C(2350) * 1.1));
  assert.equal(a.forBride.estimateCentavos, C(20000));
  assert.equal(a.forBride.withinBase, true);
  // B: supplies 5×400 + 1×400 + 4×100 + 20×10 + 10×200 = 5,000; labour (3 + 15) h × 150 = 2,700 → 7,700 × 1.1 = 8,470 < 30,000.
  const b = gownDesignOf(o, gownB.d, gownB.q, []);
  assert.equal(b.forShop.suppliesCentavos, C(5000));
  assert.equal(b.forShop.labourCentavos, C(2700));
  assert.equal(b.forBride.estimateCentavos, C(30000));
  // C priced over its base: raise the mikado so the design costs more than the starting price.
  const rich = shop({ prices: { ...prices, fab_mikado: C(5000) }, markupPct: 0 });
  const c = gownDesignOf(rich, gownC.d, gownC.q, []);
  // 10×5,000 + 8×100 + 12×80 + 500 + 24×5 + 3×20 = 52,440 > 40,000.
  assert.equal(c.forShop.designCentavos, C(52440));
  assert.equal(c.forBride.estimateCentavos, C(52440));
  assert.equal(c.forBride.withinBase, false);
});

test('4 · base-plus-extras mode on three gowns: the base is locked, In base costs nothing, no markup', () => {
  const o = shop({ mode: 'extras', prices, markupPct: 50 });
  // A: satin, satin lining and the zipper are In base by default → the base alone.
  const a = gownDesignOf(o, gownA.d, gownA.q, []);
  assert.equal(a.forBride.estimateCentavos, C(20000));
  assert.ok(a.forShop.lines.filter((l) => l.included).length === 3);
  // B: crepe 6 m × 400 + buttons 200 + crystals 2,000 + labour 2,700 on the base; lining In base.
  const b = gownDesignOf(o, gownB.d, gownB.q, []);
  assert.equal(b.forBride.estimateCentavos, C(30000) + C(2400) + C(200) + C(2000) + C(2700));
  // C: mikado 6,000 + net 960 + hoop 500 + eyelets 120 + cord 60 on the base.
  const c = gownDesignOf(o, gownC.d, gownC.q, []);
  assert.equal(c.forBride.estimateCentavos, C(40000) + C(6000) + C(960) + C(500) + C(120) + C(60));
});

test('5 · add-ons: priced, included, on request, not offered; a petticoat add-on covers its tulle and hoop', () => {
  const o = shop({ prices });
  o.addOns.veil = { state: 'priced', centavos: C(3000) };
  o.addOns.garter = { state: 'free' };
  o.addOns.shoes = { state: 'request' };
  o.addOns.gloves = { state: 'priced', centavos: null };
  o.addOns.petticoat = { state: 'priced', centavos: C(2500) };
  assert.deepEqual(gownAddOnsOffered(o), ['veil', 'gloves', 'petticoat', 'garter', 'shoes']);

  const p = gownDesignOf(o, gownC.d, gownC.q, ['veil', 'garter', 'shoes', 'gloves', 'petticoat', 'robe']);
  const words = Object.fromEntries(p.forBride.addOns.map((a) => [a.id, [a.centavos, a.words]]));
  assert.deepEqual(words.veil, [C(3000), null]);
  assert.deepEqual(words.garter, [null, GOWN_ADD_ON_INCLUDED]);
  assert.deepEqual(words.shoes, [null, GOWN_ADD_ON_ASK]);
  assert.deepEqual(words.gloves, [null, GOWN_ADD_ON_ASK], 'an unpriced add-on showed an amount');
  assert.equal(words.robe, undefined, 'a not-offered add-on reached the bride');
  assert.equal(p.forShop.addOnsCentavos, C(3000) + C(2500));
  assert.ok(!p.forShop.lines.some((l) => l.key === 'net' || l.key === 'hoop'), 'the petticoat was charged twice');
  // Covers: design 10×600 + 8×100 + 24×5 + 3×20 = 6,980 < 40,000 → base + add-ons.
  assert.equal(p.forBride.estimateCentavos, C(40000) + C(5500));
  // Add-ons are grouped last.
  const groups = p.forShop.lines.map((l) => l.group);
  assert.equal(groups.indexOf('Add-ons'), groups.length - p.forShop.lines.filter((l) => l.group === 'Add-ons').length);
});

test('6 · what the bride holds carries no line, cost, markup or hour', () => {
  const o = shop({ prices, markupPct: 25 });
  o.addOns.veil = { state: 'priced', centavos: C(3000) };
  const p = gownDesignOf(o, gownB.d, gownB.q, ['veil']);
  const json = JSON.stringify(p.forBride);
  assert.deepEqual(Object.keys(p.forBride).sort(), ['addOns', 'estimateCentavos', 'withinBase']);
  assert.doesNotMatch(json, /lines|supplies|labour|markup|hours|unit|rate|qty|design/i);
});

test('7 · the options check refuses, never repairs', () => {
  const t = gownShopTemplate();
  const bad = (o: unknown) => sanitizeGownShopOptions(o).ok === false;
  assert.ok(bad({ ...t, v: 2 }));
  assert.ok(bad({ ...t, mode: 'cheap' }));
  assert.ok(bad({ ...t, prices: { base_aline: 0 } }), 'a zero price passed');
  assert.ok(bad({ ...t, prices: { base_aline: 1.5 } }), 'a fractional centavo passed');
  assert.ok(bad({ ...t, prices: { made_up: C(1) } }));
  assert.ok(bad({ ...t, inBase: ['base_aline'] }), 'a starting price was marked In base');
  assert.ok(bad({ ...t, hours: { ...t.hours, tex: -1 } }));
  assert.ok(bad({ ...t, markupPct: 900 }));
  assert.ok(bad({ ...t, addOns: { ...t.addOns, veil: { state: 'priced', centavos: 0 } } }));
  assert.ok(bad({ ...t, addOns: { ...t.addOns, bow: { state: 'free' } } }), 'a bow passed (owner: no bows)');
  assert.ok(bad({ ...t, prices: { fab_satin: 'cheap' } }));
  const ok = sanitizeGownShopOptions({ ...t, prices: { base_aline: C(1), fab_satin: null } });
  assert.ok(ok.ok);
  if (ok.ok) assert.deepEqual(ok.options.prices, { base_aline: C(1) }, 'an empty price was stored as something');
});

test('7b · v193: the cape is its own price item, in Cover-ups, unpriced until the designer prices it', () => {
  const item = GOWN_PRICE_ITEMS.find((i) => i.key === 'cape');
  assert.deepEqual(item, { key: 'cape', label: 'Cape: cutting, sewing and finishing', unit: 'pc' });
  const group = GOWN_PRICE_GROUPS.find(([, f]) => f('cape'));
  assert.equal(group?.[0], 'Cover-ups');
  assert.equal(gownShopTemplate().prices.cape, undefined);
  assert.ok(GOWN_ADD_ONS.some((a) => a.id === 'cape'), 'the bride’s detachable cape add-on is still there');
  for (const i of GOWN_PRICE_ITEMS) assert.equal(GOWN_PRICE_GROUPS.filter(([, f]) => f(i.key)).length, 1, `${i.key} sits in ${GOWN_PRICE_GROUPS.filter(([, f]) => f(i.key)).length} groups`);
});

test('7c · v195: flutter cape sleeves (per pair, Sleeves) and an overlay (per piece, Skirt), unpriced until priced', () => {
  assert.deepEqual(GOWN_PRICE_ITEMS.find((i) => i.key === 'flutter'), { key: 'flutter', label: 'Flutter cape sleeves: cutting, sewing and finishing', unit: 'pair' });
  assert.deepEqual(GOWN_PRICE_ITEMS.find((i) => i.key === 'overlay'), { key: 'overlay', label: 'Overlay: cutting, sewing and finishing', unit: 'pc' });
  assert.equal(GOWN_PRICE_GROUPS.find(([, f]) => f('flutter'))?.[0], 'Sleeves');
  assert.equal(GOWN_PRICE_GROUPS.find(([, f]) => f('overlay'))?.[0], 'Skirt');
  assert.equal(gownShopTemplate().prices.flutter, undefined);
});

test('8 · custom gown makers only; no peso typed, no money formatted here', () => {
  assert.equal(isGownKind('bridal_gown_custom'), true);
  assert.equal(isGownKind('bridal_gown_rental'), false);
  assert.equal(isGownKind(null), false);
  const src = readFileSync(join(__dirname, 'gown-maker.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  assert.doesNotMatch(src, /₱|toLocaleString|Intl\.NumberFormat/, 'gown-maker.ts formats money itself; use lib/php.ts');
  assert.ok(!GOWN_ADD_ONS.some((a) => /bow/i.test(a.label)), 'owner: no bows');
});

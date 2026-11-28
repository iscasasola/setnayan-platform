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
  gownShopSeamAllow,
  gownFitSplit,
  gownFitJoin,
  sanitizeGownOrderPattern,
  gownPatternState,
  GOWN_ORDER_PATTERN_DEFAULT,
  GOWN_FIT_PATTERN_KEY,
  gownShopPaper,
  gownSeamAllowIsUsual,
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

test('7b · v196: one cape item per cape type, in Cover-ups, unpriced until the designer prices it', () => {
  const capes = GOWN_PRICE_ITEMS.filter((i) => i.key.startsWith('cape_'));
  assert.deepEqual(
    capes.map((i) => [i.key, i.label, i.unit]),
    [
      ['cape_neck', 'Cape (neck cape): cutting, sewing and finishing', 'pc'],
      ['cape_back', 'Cape (back cape): cutting, sewing and finishing', 'pc'],
      ['cape_pair', 'Cape (pair of shoulder capes): cutting, sewing and finishing', 'pc'],
      ['cape_side', 'Cape (side cape): cutting, sewing and finishing', 'pc'],
      ['cape_capelet', 'Cape (capelet): cutting, sewing and finishing', 'pc'],
      ['cape_drape', 'Cape (one-shoulder drape): cutting, sewing and finishing', 'pc'],
    ],
  );
  assert.equal(GOWN_PRICE_ITEMS.find((i) => i.key === ('cape' as never)), undefined, 'the single v193 cape item is gone');
  for (const c of capes) {
    assert.equal(GOWN_PRICE_GROUPS.find(([, f]) => f(c.key))?.[0], 'Cover-ups');
    assert.equal(gownShopTemplate().prices[c.key], undefined);
  }
  assert.ok(GOWN_ADD_ONS.some((a) => a.id === 'cape'), 'the bride’s detachable cape add-on is still there');
  for (const i of GOWN_PRICE_ITEMS) assert.equal(GOWN_PRICE_GROUPS.filter(([, f]) => f(i.key)).length, 1, `${i.key} sits in ${GOWN_PRICE_GROUPS.filter(([, f]) => f(i.key)).length} groups`);
});

test('7b2 · v196: ribbon by the metre is a Trims line, unpriced until priced; the retired v193 cape key is refused', () => {
  assert.deepEqual(GOWN_PRICE_ITEMS.find((i) => i.key === 'ribbon'), { key: 'ribbon', label: 'Ribbon (sash)', unit: 'm' });
  assert.equal(GOWN_PRICE_GROUPS.find(([, f]) => f('ribbon'))?.[0], 'Trims');
  assert.equal(gownShopTemplate().prices.ribbon, undefined);
  // Nothing was ever saved under it (the gown tables are not live yet), so the old key is simply not on the list.
  const old = sanitizeGownShopOptions({ ...gownShopTemplate(), prices: { cape: 100 } });
  assert.equal(old.ok, false, 'a price for the retired single cape item was accepted');
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

test('7d · owner 2026-11-27: a small bow is a Trims line, per piece, unpriced until priced', () => {
  assert.deepEqual(GOWN_PRICE_ITEMS.find((i) => i.key === 'bow'), { key: 'bow', label: 'Bow (small): making and attaching', unit: 'pc' });
  assert.equal(GOWN_PRICE_GROUPS.find(([, f]) => f('bow'))?.[0], 'Trims');
  assert.equal(gownShopTemplate().prices.bow, undefined);
});

test('7e · v197/v198: Fit and flare has its own starting price; the Bodice group has three labour lines; all unpriced', () => {
  assert.deepEqual(GOWN_PRICE_ITEMS.find((i) => i.key === 'base_fitflare'), { key: 'base_fitflare', label: 'Fit and flare', unit: 'gown' });
  assert.equal(GOWN_PRICE_GROUPS.find(([, f]) => f('base_fitflare'))?.[0], 'Starting prices');
  const bodice = GOWN_PRICE_ITEMS.filter((i) => GOWN_PRICE_GROUPS.find(([g]) => g === 'Bodice')![1](i.key));
  assert.deepEqual(
    bodice.map((i) => [i.key, i.label, i.unit]),
    [
      ['illu_bodice', 'Illusion bodice: sheer tulle panel and fitting', 'pc'],
      ['illu_back', 'Illusion back: sheer tulle panel and fitting', 'pc'],
      ['bone_show', 'Visible boning: channels and finishing', 'pc'],
    ],
  );
  const t = gownShopTemplate();
  for (const k of ['base_fitflare', 'illu_bodice', 'illu_back', 'bone_show'] as const) assert.equal(t.prices[k], undefined, `${k} starts priced`);
  for (const i of GOWN_PRICE_ITEMS) assert.equal(GOWN_PRICE_GROUPS.filter(([, f]) => f(i.key)).length, 1, `${i.key} is in more or fewer than one group`);
  assert.equal(new Set(GOWN_PRICE_ITEMS.map((i) => i.key)).size, GOWN_PRICE_ITEMS.length, 'a price key appears twice');
});

test('7f · v199 Straps and edges group; v196 cape lines from A6f quantities, unpriced until priced', () => {
  assert.deepEqual(GOWN_PRICE_ITEMS.find((i) => i.key === 'strap'), { key: 'strap', label: 'Straps: cutting, sewing and attaching', unit: 'pair' });
  assert.deepEqual(GOWN_PRICE_ITEMS.find((i) => i.key === 'scallop'), { key: 'scallop', label: 'Scalloped edge: shaping and finishing', unit: 'pc' });
  for (const k of ['strap', 'scallop'] as const) {
    assert.equal(GOWN_PRICE_GROUPS.find(([, f]) => f(k))?.[0], 'Straps and edges');
    assert.equal(gownShopTemplate().prices[k], undefined);
  }
  const q0 = emptyGownQuantities();
  const q = { ...q0, materials: { ...q0.materials, capeM: 3.2, ribbonM: 0.45 }, labour: { ...q0.labour, cape: 'side' as const } };
  const design = { ...startingGownConfig(), cape: 'side' as const, capeFab: null };
  const unpriced = gownDesignOf(shop(), design, q, []).forShop.lines;
  const capeLine = unpriced.find((l) => l.key === 'cape_side')!;
  assert.equal(capeLine.label, 'Cape (side cape): cutting, sewing and finishing');
  assert.equal(capeLine.amountCentavos, null, 'an unpriced cape was priced');
  assert.ok(unpriced.some((l) => l.key === 'fab_tulle' && l.label === 'Tulle (the cape)' && l.qty === 3.2), 'the side cape’s default tulle is not counted');
  assert.ok(unpriced.some((l) => l.key === 'ribbon' && l.qty === 0.45));
  const priced = gownDesignOf(shop({ prices: { ...shop().prices, cape_side: C(10), fab_tulle: C(2), ribbon: C(1) } }), design, q, []).forShop.lines;
  assert.equal(priced.find((l) => l.key === 'cape_side')!.amountCentavos, C(10));
  assert.equal(priced.find((l) => l.key === 'fab_tulle' && l.label === 'Tulle (the cape)')!.amountCentavos, Math.round(3.2 * C(2)));
  // No cape: no cape line.
  assert.ok(!gownDesignOf(shop(), startingGownConfig(), q0, []).forShop.lines.some((l) => l.key.startsWith('cape_')));
});

test('7g · v200/v203: 3D flowers, raised lace, glitter tulle, five sleeve styles, detachable bands and the over-robe are listed, grouped, and unpriced until priced', () => {
  const where = (k: string) => GOWN_PRICE_GROUPS.find(([, f]) => f(k as never))?.[0];
  const item = (k: string) => GOWN_PRICE_ITEMS.find((i) => i.key === k);
  assert.deepEqual(item('flowers3d'), { key: 'flowers3d', label: '3D flowers: making and attaching', unit: '10 flowers' });
  assert.equal(where('flowers3d'), '3D flowers');
  assert.equal(GOWN_PRICE_GROUPS.findIndex(([g]) => g === '3D flowers'), GOWN_PRICE_GROUPS.findIndex(([g]) => g === 'Lace and beads') + 1, '3D flowers sits right after Lace and beads');
  assert.deepEqual(item('lace_raised'), { key: 'lace_raised', label: 'Raised lace: shaping and finishing', unit: 'pc' });
  assert.equal(where('lace_raised'), 'Lace and beads');
  assert.deepEqual(item('fab_glitter_tulle'), { key: 'fab_glitter_tulle', label: 'Glitter tulle fabric', unit: 'm' });
  assert.equal(where('fab_glitter_tulle'), 'Fabrics');
  const sleeves = GOWN_PRICE_ITEMS.filter((i) => where(i.key) === 'Sleeves').map((i) => [i.key, i.label, i.unit]);
  assert.deepEqual(sleeves, [
    ['flutter', 'Flutter cape sleeves: cutting, sewing and finishing', 'pair'],
    ['sl_puff', 'Sleeves (puff): cutting, sewing and finishing', 'pair'],
    ['sl_bishop', 'Sleeves (bishop): cutting, sewing and finishing', 'pair'],
    ['sl_juliet', 'Sleeves (Juliet): cutting, sewing and finishing', 'pair'],
    ['sl_ruffle', 'Sleeves (ruffle band): cutting, sewing and finishing', 'pair'],
    ['sl_capesl', 'Sleeves (cape sleeves): cutting, sewing and finishing', 'pair'],
    ['sl_detach', 'Detachable sleeve bands', 'pair'],
  ]);
  assert.deepEqual(item('overrobe'), { key: 'overrobe', label: 'Over-robe: cutting, sewing and finishing', unit: 'pc' });
  assert.equal(where('overrobe'), 'Cover-ups');
  const fresh = ['flowers3d', 'lace_raised', 'fab_glitter_tulle', 'sl_puff', 'sl_bishop', 'sl_juliet', 'sl_ruffle', 'sl_capesl', 'sl_detach', 'overrobe'] as const;
  const t = gownShopTemplate();
  for (const k of fresh) assert.equal(t.prices[k], undefined, `${k} starts priced`);
  // a designer CAN price each one (the shop's own list), and an unknown key is still refused
  const priced = gownShopTemplate();
  for (const k of fresh) priced.prices[k] = 100;
  const ok = sanitizeGownShopOptions(priced);
  assert.ok(ok.ok, 'the new keys are accepted with a price');
  if (ok.ok) for (const k of fresh) assert.equal(ok.options.prices[k], 100);
  for (const i of GOWN_PRICE_ITEMS) assert.equal(GOWN_PRICE_GROUPS.filter(([, f]) => f(i.key)).length, 1, `${i.key} is in more or fewer than one group`);
  assert.equal(new Set(GOWN_PRICE_ITEMS.map((i) => i.key)).size, GOWN_PRICE_ITEMS.length, 'a price key appears twice');
});

test('7h · B11/B12 (v205): her allowances and paper ride on the options; absent means the usual ones on A4; out-of-range ones are held to the range', () => {
  const t = gownShopTemplate();
  assert.equal(t.seamAllow, undefined);
  assert.deepEqual(gownShopSeamAllow(t), { seam: 1.5, hem: 2.5, zip: 2, neck: 1 });
  assert.equal(gownShopPaper(t), 'a4');
  assert.ok(gownSeamAllowIsUsual(gownShopSeamAllow(t)));
  const ok = sanitizeGownShopOptions({ ...t, seamAllow: { seam: 1.04, hem: 20, zip: 2.5, neck: 0.1 }, patPaper: 'letter' });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.deepEqual(gownShopSeamAllow(ok.options), { seam: 1, hem: 8, zip: 2.5, neck: 0.3 });
    assert.equal(gownShopPaper(ok.options), 'letter');
    assert.ok(!gownSeamAllowIsUsual(gownShopSeamAllow(ok.options)));
  }
  const plain = sanitizeGownShopOptions(t);
  assert.ok(plain.ok && !('seamAllow' in plain.options) && !('patPaper' in plain.options), 'an options row without them gains them on save');
  assert.deepEqual(sanitizeGownShopOptions({ ...t, patPaper: 'legal' }), { ok: false, problem: 'Paper for printing patterns: choose A4 or US Letter.' });
});

test('7i · B11 (v205): one order’s pattern rides in the designer’s own fitting row, beside the tape, and never breaks it', () => {
  // The tape and the pattern come apart; junk under the reserved key reads as the shop's plain settings.
  const fit = { bust: 88, waistHip: 21.5, _pattern: { seamAllow: { seam: 1, hem: 4, zip: 2.5, neck: 0.8 }, netPattern: false } };
  assert.deepEqual(gownFitSplit(fit), { tape: { bust: 88, waistHip: 21.5 }, pattern: { seamAllow: { seam: 1, hem: 4, zip: 2.5, neck: 0.8 }, netPattern: false } });
  assert.deepEqual(gownFitSplit({ bust: 88 }), { tape: { bust: 88 }, pattern: GOWN_ORDER_PATTERN_DEFAULT });
  assert.deepEqual(gownFitSplit({ bust: 88, _pattern: 'x' }).pattern, GOWN_ORDER_PATTERN_DEFAULT);
  assert.deepEqual(gownFitSplit(null), { tape: {}, pattern: GOWN_ORDER_PATTERN_DEFAULT });
  // Back together: the shop's plain settings add nothing to the row; anything else rides under the reserved key.
  assert.deepEqual(gownFitJoin({ bust: 88 }, GOWN_ORDER_PATTERN_DEFAULT), { bust: 88 });
  assert.deepEqual(gownFitJoin({}, { seamAllow: null, netPattern: true }), { [GOWN_FIT_PATTERN_KEY]: { seamAllow: null, netPattern: true } });
  const back = gownFitSplit(fit);
  assert.deepEqual(gownFitSplit(gownFitJoin(back.tape, back.pattern)), back, 'a round trip changed the order');
  // What the order view sends is checked: allowances held to their ranges; a missing switch or junk is refused.
  assert.deepEqual(sanitizeGownOrderPattern({ seamAllow: { seam: 9, hem: 0.1, zip: 2, neck: 1 }, netPattern: false }), { seamAllow: { seam: 3, hem: 0.5, zip: 2, neck: 1 }, netPattern: false });
  assert.deepEqual(sanitizeGownOrderPattern({ seamAllow: null, netPattern: true }), { seamAllow: null, netPattern: true });
  assert.equal(sanitizeGownOrderPattern({ seamAllow: null }), null);
  assert.equal(sanitizeGownOrderPattern({ seamAllow: 'wide', netPattern: false }), null);
  // v205 patState, word for word.
  assert.equal(gownPatternState({ seamAllow: null, netPattern: true }), 'Off: net pattern');
  assert.equal(gownPatternState({ seamAllow: { seam: 1, hem: 2, zip: 2, neck: 1 }, netPattern: false }), 'On · set for this order');
  assert.equal(gownPatternState(GOWN_ORDER_PATTERN_DEFAULT), "On · your shop's allowances");
});

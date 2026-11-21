/**
 * 🎂 The Cake Maker's rules (lib/cake-maker.ts) against the SHIPPED pricer and validator — the estimate the couple
 * sees, the total `lockPackage` commits and the design the supplier reads are one computation over one package.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CAKE_PARTS,
  cakeConfigSelection,
  cakeConfigTotalCentavos,
  cakeDesignOf,
  cakeDesignRefOf,
  cakeOfferOf,
  cakeOptionsFromDraftItems,
  cakeOptionsProblem,
  cakeOptionsToDraftItems,
  cakeTemplate,
  formatCakeDesignBlock,
  parseCakeOptions,
  readCakeCard,
  serializeCakeOptions,
  type CakeOptions,
} from './cake-maker';
import { sanitizeCakeConfig, startingCakeConfig, type CakeConfig } from './cake-config';
import { validatePackageDraft, type DraftItem } from './package-authoring';
import { toPackageDraft } from './service-customization-draft';
import type { VendorPackageItemRow, VendorPackageWithItems } from './vendor-packages';

const ONE = 1_200_000; // the one price in this fixture, centavos
const K = 100_000; // one thousand pesos, centavos

/** A template with extras, as a supplier would type them. */
function priced(): CakeOptions {
  const c = cakeTemplate();
  c.tiers = { maxReal: 6, standard: 3, realExtraCentavos: 3 * K, display: { max: 2, extraCentavos: K } };
  c.flavours = c.flavours!.map((f) => (f.label === 'Red velvet' ? { ...f, extraCentavos: K } : f));
  c.finish = c.finish!.map((f) => (f.look === 'fondant' ? { ...f, extraCentavos: 2 * K } : f));
  c.accents = c.accents!.map((f) => (f.look === 'drip' ? { ...f, extraCentavos: K } : f));
  c.monogram = { extraCentavos: K };
  c.cupcakes = { packs: [{ count: 24, priceCentavos: 3 * K }], tower: { extraCentavos: K } };
  return c;
}

function asPackage(items: DraftItem[]): VendorPackageWithItems {
  const rows: VendorPackageItemRow[] = items.map((i, idx) => ({
    item_id: i.ref,
    package_id: 'pkg',
    canonical_service: i.canonical_service,
    service_description: i.service_description,
    is_default_included: i.is_default_included,
    is_required: i.is_required,
    replacement_value_centavos: i.replacement_value_centavos,
    display_order: idx,
    created_at: '2026-11-21T00:00:00Z',
    parent_option_id: null,
    pick_min: i.pickMin ?? null,
    pick_max: i.pickMax ?? null,
    max_extra_hours: null,
    extra_hour_centavos: null,
    cake_part: i.cakePart ?? null,
    options: i.options.map((o, oi) => ({
      option_id: o.ref,
      item_id: i.ref,
      option_label: o.label,
      price_delta_centavos: o.price_delta_centavos,
      is_default: o.is_default,
      is_available: o.is_available,
      display_order: oi,
      look_key: o.lookKey ?? null,
    })),
  }));
  return { package_id: 'pkg', vendor_profile_id: 'v', package_name: 'Wedding cake', total_price_centavos: ONE, consumable_budget_centavos: 0, is_consumable_flexible: false, is_active: true, items: rows } as unknown as VendorPackageWithItems;
}

const build = (c: CakeOptions = priced()) => {
  const pkg = asPackage(cakeOptionsToDraftItems(c, 'wedding_cake'));
  const card = readCakeCard(pkg)!;
  return { pkg, card, offer: cakeOfferOf(card, 40) };
};
const design = (offer: ReturnType<typeof build>['offer'], over: Partial<CakeConfig>) => {
  const r = sanitizeCakeConfig({ ...startingCakeConfig(offer), ...over }, offer);
  assert.ok(r.ok, `sanitized: ${JSON.stringify(r)}`);
  return r.config;
};

test('the parts are exactly the database CHECK', () => {
  const sql = readFileSync(join(process.cwd(), '../../supabase/migrations/20271356877338_cake_maker_parts_and_designs.sql'), 'utf8');
  const m = /cake_part IN \(([^)]*)\)/.exec(sql);
  assert.ok(m, 'the CHECK lists the parts');
  const inSql = m![1]!.split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean);
  assert.deepEqual([...inSql].sort(), [...CAKE_PARTS].sort());
});

test('the template is a package the shipped validator accepts, with every extra at ₱0', () => {
  const items = cakeOptionsToDraftItems(cakeTemplate(), 'wedding_cake');
  assert.deepEqual(validatePackageDraft(toPackageDraft(items, { packageName: 'Cake', totalPriceCentavos: ONE })), []);
  assert.ok(items.every((i) => i.options.every((o) => o.price_delta_centavos === 0)), 'nothing is guessed');
  assert.equal(cakeOptionsProblem(priced()), null);
  assert.deepEqual(validatePackageDraft(toPackageDraft(cakeOptionsToDraftItems(priced(), 'wedding_cake'), { packageName: 'Cake', totalPriceCentavos: ONE })), []);
});

test('flavour is written once and asked per real tier; accents are asked per tier, up to 10', () => {
  const items = cakeOptionsToDraftItems(priced(), 'wedding_cake');
  assert.equal(items.filter((i) => i.cakePart === 'flavour').length, 6, 'one flavour line per possible real tier');
  assert.equal(items.filter((i) => i.cakePart === 'accent').length, 8, 'one accent line per possible tier (6 real + 2 display)');
  const ten = cakeTemplate();
  ten.tiers = { maxReal: 10, standard: 3, realExtraCentavos: 0, display: { max: 9, extraCentavos: 0 } };
  assert.equal(cakeOptionsToDraftItems(ten, 'wedding_cake').filter((i) => i.cakePart === 'accent').length, 10, 'never more than 10');
});

test('the estimate is the shipped pricer: extra real tiers, display tiers, a flavour per tier, accents, monogram, cupcakes', () => {
  const { pkg, card, offer } = build();
  const base = design(offer, {});
  assert.equal(cakeConfigTotalCentavos(pkg, card, base, 0, false), ONE, 'the Standard cake is the one price');
  const big = design(offer, {
    tiers: [
      { kind: 'display', flavourRef: null, accent: 'none' },
      { kind: 'real', flavourRef: 'fl:5', accent: 'drip' },
      { kind: 'real', flavourRef: 'fl:5', accent: 'none' },
      { kind: 'real', flavourRef: null, accent: 'drip' },
      { kind: 'real', flavourRef: null, accent: 'none' },
    ],
    cuttingTier: 1,
    finish: 'fondant',
    monogram: 'front',
    cupcakes: { packRef: 'pack:24', flavourRef: null, match: true, placement: 'tower' },
  });
  // 4 real (1 above the 3 in the price) = 3K · 1 display = 1K · red velvet on 2 tiers = 2K · fondant 2K · drip on 2 layers
  // = 2K · monogram 1K · 24 cupcakes 3K · tower 1K
  assert.equal(cakeConfigTotalCentavos(pkg, card, big, 0, false), ONE + 15 * K);
});

test('a key the card no longer offers does not price — the design is refused, never thinned', () => {
  const { pkg, card } = build();
  const gone = { ...startingCakeConfig(cakeOfferOf(card, 40)), finish: 'semi_naked' as const };
  const fewer = priced();
  fewer.finish = fewer.finish!.filter((f) => f.look !== 'semi_naked');
  const after = build(fewer);
  assert.equal(cakeConfigSelection(after.card, gone), null);
  assert.notEqual(cakeConfigSelection(card, gone), null);
  assert.equal(cakeConfigTotalCentavos(after.pkg, after.card, gone, 0, false), null);
  void pkg;
});

test('options round-trip through the stored lines (editing a saved card) and through the wire', () => {
  const c = priced();
  const back = cakeOptionsFromDraftItems(cakeOptionsToDraftItems(c, 'wedding_cake'), c.message);
  assert.deepEqual(back?.tiers, c.tiers);
  assert.deepEqual(back?.accents, c.accents);
  assert.deepEqual(back?.monogram, c.monogram);
  assert.deepEqual(back?.cupcakes, c.cupcakes);
  assert.deepEqual(back?.flavours?.map((f) => [f.label, f.extraCentavos, f.standard]), c.flavours!.map((f) => [f.label, f.extraCentavos, f.standard]));
  const wire = parseCakeOptions(serializeCakeOptions(c));
  assert.ok(wire.ok && wire.cake);
  assert.deepEqual(parseCakeOptions(''), { ok: true, cake: null });
  assert.equal(parseCakeOptions('{"v":1,"cake":{}}').ok, false, 'an old wire is refused, never half-read');
});

test('the editor refuses what the save would refuse', () => {
  const c = priced();
  assert.match(cakeOptionsProblem({ ...c, tiers: { ...c.tiers, maxReal: 11 } }) ?? '', /1 to 10/);
  assert.match(cakeOptionsProblem({ ...c, tiers: { ...c.tiers, standard: 7 } }) ?? '', /ones you make/);
  assert.match(cakeOptionsProblem({ ...c, accents: c.accents!.filter((a) => a.look !== 'none') }) ?? '', /Plain/);
  assert.match(cakeOptionsProblem({ ...c, tiers: { ...c.tiers, realExtraCentavos: -1 } }) ?? '', /below ₱0/);
  assert.match(cakeOptionsProblem({ ...c, cupcakes: { packs: [], tower: null } }) ?? '', /pack/);
});

test('the design message names its stored row last, and plain text is not a design', () => {
  const { pkg, card, offer } = build();
  const cfg = design(offer, { message: 'Ana & Migs', instructions: 'Less sweet, please.' });
  const est = cakeConfigTotalCentavos(pkg, card, cfg, 0, false)!;
  const d = cakeDesignOf(card, cfg, { cardName: 'Wedding cake', oneCentavos: ONE, estimateCentavos: est });
  const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
  const block = formatCakeDesignBlock(d, id);
  assert.match(block, /^🎂 Cake design · Wedding cake\n/);
  assert.match(block, /Special instructions: Less sweet, please\./);
  assert.equal(cakeDesignRefOf(`Hi!\n\n${block}`), id);
  assert.equal(cakeDesignRefOf('Hi! We love your cakes'), null);
  assert.equal(cakeDesignRefOf('Design ref: not-a-uuid'), null);
});

test('the inquiry re-checks the design on the server and stores it before naming it — refused before anything is sent', () => {
  const src = readFileSync(join(process.cwd(), 'app', 'v', '[slug]', 'inquiry-actions.ts'), 'utf8');
  const at = src.indexOf('await buildCakeDesign(supabase, admin, {');
  const upsert = src.indexOf(".from('chat_threads')\n    .upsert(");
  assert.ok(at > 0 && upsert > at, 'the cake design is checked before the thread is upserted');
  assert.match(src, /config: input\.requirements\.cakeDesign,/, 'the browser sends a config, never labels or prices');
  assert.match(src, /cakeDesignId = await storeCakeDesign\(admin,/);
  assert.match(src, /if \(!cakeDesignId\) return \{ status: 'error', message: CAKE_DESIGN_UNREADABLE \};/);
  assert.match(src, /if \(cakeDesignId\) await dropCakeDesign\(admin, cakeDesignId\);/, 'a design whose message never posted is removed');
});

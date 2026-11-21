/**
 * 🎂 The Cake Maker's rules (lib/cake-maker.ts) against the SHIPPED pricer and validator — the estimate on the couple's
 * screen, the total `lockPackage` commits and the message the supplier reads are all one computation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CAKE_PARTS,
  cakeDesignOf,
  cakeOptionsFromDraftItems,
  cakeOptionsProblem,
  cakeOptionsToDraftItems,
  cakeSelection,
  cakeTemplate,
  cakeTotalCentavos,
  coloursOverCap,
  flavourLabelsByIndex,
  flavoursFor,
  formatCakeDesignBlock,
  parseCakeDesignBlock,
  parseCakeOptions,
  readCakeCard,
  serializeCakeOptions,
  startingCakeDesign,
  type CakeOptions,
} from './cake-maker';
import { validatePackageDraft, type DraftItem } from './package-authoring';
import { toPackageDraft } from './service-customization-draft';
import { unfinishedChoiceLines } from './package-choice-tree';
import type { VendorPackageItemRow, VendorPackageWithItems } from './vendor-packages';

const ONE = 1_200_000; // the one price in this fixture, centavos
const K = 100_000; // one thousand pesos, centavos

/** A template with extras, as a supplier would type them. */
function priced(): CakeOptions {
  const c = cakeTemplate();
  c.tiers.extraCentavos = { '4': 3 * K, '5': 6 * K };
  c.flavours = c.flavours!.map((f) => (f.label === 'Red velvet' ? { ...f, extraCentavos: K } : f));
  c.finish = c.finish!.map((f) => (f.label === 'Fondant' ? { ...f, extraCentavos: 2 * K } : f));
  c.design = c.design!.map((f) => (f.label === 'Floral cascade' ? { ...f, extraCentavos: 2 * K } : f));
  c.topper = c.topper!.map((f) => (f.label === 'Acrylic names' ? { ...f, extraCentavos: K } : f));
  return c;
}

/** The draft lines as stored rows: refs become ids, a follow-up's parentRef becomes its parent option's id. */
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
    parent_option_id: i.parentRef?.optionRef ?? null,
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
      photo_ref: o.photoRef ?? null,
    })),
  }));
  return {
    package_id: 'pkg',
    vendor_profile_id: 'v',
    package_name: 'Wedding cake',
    total_price_centavos: ONE,
    consumable_budget_centavos: 0,
    is_consumable_flexible: false,
    is_active: true,
    items: rows,
  } as unknown as VendorPackageWithItems;
}

test('the parts are exactly the database CHECK', () => {
  const sql = readFileSync(join(process.cwd(), '../../supabase/migrations/20271356877338_cake_maker_parts_photos_and_letters.sql'), 'utf8');
  const m = /cake_part IN \(([^)]+)\)/.exec(sql);
  assert.ok(m, 'the CHECK is in the migration');
  const inSql = m![1]!.split(',').map((s) => s.trim().replace(/'/g, ''));
  assert.deepEqual(inSql, [...CAKE_PARTS]);
});

test('the template is a package the shipped validator accepts, with every extra at ₱0', () => {
  const items = cakeOptionsToDraftItems(cakeTemplate(), 'cake');
  assert.equal(cakeOptionsProblem(cakeTemplate()), null);
  const problems = validatePackageDraft(toPackageDraft(items, { packageName: 'Wedding cake', totalPriceCentavos: ONE }));
  assert.deepEqual(problems, []);
  for (const i of items) for (const o of i.options) assert.equal(o.price_delta_centavos, 0, `${i.service_description} · ${o.label} guessed a price`);
});

test('flavour is written once and asked for each tier: one follow-up line per tier under each size', () => {
  const items = cakeOptionsToDraftItems(cakeTemplate(), 'cake');
  const flavourLines = items.filter((i) => i.cakePart === 'flavour');
  assert.equal(flavourLines.length, 1 + 2 + 3 + 4 + 5, 'sizes 1–5 → 15 tier lines');
  const under3 = flavourLines.filter((i) => i.parentRef?.optionRef === 'cake-tiers-3').map((i) => i.service_description);
  assert.deepEqual(under3, ['Flavour · bottom tier', 'Flavour · tier 2', 'Flavour · tier 3']);
  for (const l of flavourLines) {
    assert.equal(l.is_default_included, false, 'a follow-up is never inside the price');
    assert.deepEqual(l.options.map((o) => o.label), ['Vanilla chiffon', 'Chocolate', 'Ube', 'Mocha', 'Red velvet']);
  }
});

test('a flavour extra is charged once for each tier it is picked for — by the shipped pricer', () => {
  const pkg = asPackage(cakeOptionsToDraftItems(priced(), 'cake'));
  const card = readCakeCard(pkg)!;
  const start = startingCakeDesign(card);
  assert.equal(card.sizes.find((s) => s.option.option_id === start.sizeOptionId)!.tiers, 3, 'starts on 3 tiers');
  assert.equal(cakeTotalCentavos(pkg, card, start, 0), ONE, 'all Standard = the one price');

  const size3 = card.sizes.find((s) => s.tiers === 3)!;
  const redVelvet = (lineIdx: number) => size3.flavourLines[lineIdx]!.options!.find((o) => o.option_label === 'Red velvet')!.option_id;
  const twoRed = { ...start, flavours: { ...start.flavours, [size3.flavourLines[0]!.item_id]: redVelvet(0), [size3.flavourLines[2]!.item_id]: redVelvet(2) } };
  assert.equal(cakeTotalCentavos(pkg, card, twoRed, 0), ONE + 2 * K, 'Red velvet on two tiers = two extras');
});

test('a bigger size adds its extra; the flavours of the tiers below carry across', () => {
  const pkg = asPackage(cakeOptionsToDraftItems(priced(), 'cake'));
  const card = readCakeCard(pkg)!;
  const start = startingCakeDesign(card);
  const size3 = card.sizes.find((s) => s.tiers === 3)!;
  const ube = size3.flavourLines[0]!.options!.find((o) => o.option_label === 'Ube')!.option_id;
  const picked = { ...start, flavours: { ...start.flavours, [size3.flavourLines[0]!.item_id]: ube } };
  const size4 = card.sizes.find((s) => s.tiers === 4)!;
  const moved = { ...picked, sizeOptionId: size4.option.option_id, flavours: flavoursFor(size4, flavourLabelsByIndex(card, picked)) };
  assert.equal(flavourLabelsByIndex(card, moved)[0], 'Ube', 'the bottom tier kept Ube');
  assert.equal(flavourLabelsByIndex(card, moved)[3], 'Vanilla chiffon', 'the new top tier starts on Standard');
  assert.equal(cakeTotalCentavos(pkg, card, moved, 0), ONE + 3 * K);
});

test('Mood Board colours only: the shop colours line is removed, the total does not move and nothing is unfinished', () => {
  const pkg = asPackage(cakeOptionsToDraftItems(priced(), 'cake'));
  const card = readCakeCard(pkg)!;
  const state = { ...startingCakeDesign(card), colours: [{ kind: 'mood' as const, name: 'Sage', hex: '#9caf88' }] };
  const { selection, removedItemIds } = cakeSelection(card, state);
  assert.deepEqual(removedItemIds, [card.colours!.item_id]);
  assert.deepEqual(unfinishedChoiceLines(pkg, removedItemIds, selection), []);
  assert.equal(cakeTotalCentavos(pkg, card, state, 0), ONE);
});

test('a 4th colour is over the cap', () => {
  const pkg = asPackage(cakeOptionsToDraftItems(cakeTemplate(), 'cake'));
  const card = readCakeCard(pkg)!;
  const opts = card.colours!.options!;
  const three = opts.slice(0, 3).map((o) => ({ kind: 'shop' as const, optionId: o.option_id }));
  const s = startingCakeDesign(card);
  assert.equal(coloursOverCap(card, { ...s, colours: three }), false);
  assert.equal(coloursOverCap(card, { ...s, colours: [...three, { kind: 'mood', name: 'Ivory', hex: '#fffff0' }] }), true);
});

test('options round-trip through the stored lines (editing a saved card)', () => {
  const c = priced();
  c.design = c.design!.map((d, i) => (i === 1 ? { ...d, photoRef: 'portfolio/abc.jpg' } : d));
  const back = cakeOptionsFromDraftItems(cakeOptionsToDraftItems(c, 'cake'), c.message)!;
  const strip = (x: CakeOptions) => JSON.parse(JSON.stringify(x, (k, v) => (k === 'ref' ? undefined : v)));
  assert.deepEqual(strip(back), strip({ ...c, design: c.design!.map((d) => ({ ...d, photoRef: d.photoRef ?? null })) }));
});

test('the wire parse refuses what the editor would refuse, and reads absent as no cake', () => {
  assert.deepEqual(parseCakeOptions(''), { ok: true, cake: null });
  assert.equal(parseCakeOptions('{').ok, false);
  const bad = priced();
  bad.tiers.made = [3];
  assert.equal(parseCakeOptions(serializeCakeOptions(bad)).ok, false, 'one size is not a choice');
  const neg = priced();
  neg.finish![1]!.extraCentavos = -1;
  assert.equal(parseCakeOptions(serializeCakeOptions(neg)).ok, false, 'never below ₱0');
  const good = parseCakeOptions(serializeCakeOptions(priced()));
  assert.ok(good.ok && good.cake);
});

test('the design message round-trips, its estimate is the pricer’s, and plain text is not a design', () => {
  const pkg = asPackage(cakeOptionsToDraftItems(priced(), 'cake'));
  const card = readCakeCard(pkg)!;
  const s = startingCakeDesign(card);
  const design = card.design!.options!.find((o) => o.option_label === 'Floral cascade')!.option_id;
  const state = {
    ...s,
    designOptionId: design,
    colours: [
      { kind: 'mood' as const, name: 'Dusty rose', hex: '#d4a5a5' },
      { kind: 'shop' as const, optionId: card.colours!.options![1]!.option_id },
    ],
    message: 'Ana & Migs · 12.19\nline two',
  };
  const d = cakeDesignOf(pkg, card, state, { cardName: 'Wedding cake', messageMax: 40, paxCount: 0 })!;
  assert.equal(d.estimateCentavos, ONE + 2 * K);
  const block = formatCakeDesignBlock(d);
  assert.match(block, /^🎂 Cake design · Wedding cake\nTiers: 3 tiers\n/);
  assert.match(block, /Colours: Dusty rose \(Mood Board\) · Sage/);
  assert.match(block, /Design: Floral cascade \(\+₱2,000\)/);
  const back = parseCakeDesignBlock(`Hi! We designed our cake on your card 🙂\n\n${block}\n\nService: Wedding cake`)!;
  assert.equal(back.estimateCentavos, d.estimateCentavos);
  assert.equal(back.oneCentavos, ONE);
  assert.deepEqual(back.colours, [{ name: 'Dusty rose', mood: true }, { name: 'Sage', mood: false }]);
  assert.equal(back.design?.extraCentavos, 2 * K);
  assert.equal(back.message, 'Ana & Migs · 12.19 line two');
  assert.equal(parseCakeDesignBlock('Hi! Do you make wedding cakes?'), null);
  assert.equal(parseCakeDesignBlock('🎂 Cake design · Wedding cake\nTiers: 3 tiers'), null, 'no estimate → not a design');
});

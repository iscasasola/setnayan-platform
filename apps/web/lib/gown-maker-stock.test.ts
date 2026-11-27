/**
 * 👗 THE SHOP'S FABRICS, LACE AND LOOKS ARE CHECKED ON THE SERVER — plan step B5 (corpus
 * WHATS_NEXT_Gown_Maker_Port_2026-11-27.md § 5; drawing gown_maker_v196.html "Fabrics and lace", "Inspirations";
 * the four sliders are prototype v188 `tune:{shine,sheer,body,tex}`, saved as offsets from the type).
 *
 *   1 · A fabric's photos must sit in THIS shop's own gown folder of the public media bucket; another shop's, another
 *       folder, a private bucket or a web address is refused.
 *   2 · An empty price stays unpriced (null), never zero; a plain fabric carries no tile.
 *   3 · The type must be one the registry offers; the sliders stay within ±1 and an untouched slider is not stored.
 *   4 · A look's name and photo are checked the same way; its design goes on to `sanitizeGownConfig`.
 *   5 · The ops ride the one dispatcher, are the Shop Manager's, and the stock read is never part of a bride's read.
 *
 * Run: cd apps/web && npx tsx --test lib/gown-maker-stock.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GOWN_FABRIC_TUNE, gownShopMediaPrefix, sanitizeGownShopFabric, sanitizeGownShopLookShell } from './gown-maker';

const SHOP = '11111111-2222-4333-8444-555555555555';
const OTHER = '99999999-2222-4333-8444-555555555555';
const types = new Set(['satin', 'tulle']);
const ctx = { vendorProfileId: SHOP, typeIds: types };
const ref = (shop: string, tail = 'fabrics/a.webp') => `r2://setnayan-media/${gownShopMediaPrefix(shop)}${tail}`;
const fabric = (over: Record<string, unknown> = {}) => ({
  id: null,
  kind: 'fabric',
  name: 'Duchess satin',
  code: 'DS-01',
  typeId: 'satin',
  colours: [{ name: 'Ivory', hex: '#F0E8D6' }],
  pricePerMetreCentavos: null,
  tune: {},
  thumbKey: ref(SHOP),
  tileKey: null,
  active: true,
  ...over,
});

test('1 · a photo must sit in this shop’s own gown folder', () => {
  assert.ok(sanitizeGownShopFabric(fabric(), ctx).ok);
  for (const bad of [
    ref(OTHER),
    `r2://setnayan-media/vendors/${SHOP}/portfolio/a.webp`,
    `r2://thread-files/${gownShopMediaPrefix(SHOP)}a.webp`,
    'https://example.com/a.webp',
    `r2://setnayan-media/${gownShopMediaPrefix(SHOP)}`,
  ]) {
    assert.equal(sanitizeGownShopFabric(fabric({ thumbKey: bad }), ctx).ok, false, `accepted ${bad}`);
    assert.equal(sanitizeGownShopFabric(fabric({ tileKey: bad }), ctx).ok, false, `accepted tile ${bad}`);
  }
});

test('2 · an empty price stays unpriced; a plain fabric carries no tile', () => {
  const r = sanitizeGownShopFabric(fabric({ pricePerMetreCentavos: null }), ctx);
  assert.ok(r.ok && r.fabric.pricePerMetreCentavos === null && r.fabric.tileKey === null);
  assert.equal(sanitizeGownShopFabric(fabric({ pricePerMetreCentavos: 0 }), ctx).ok, false, 'zero was stored as a price');
  assert.equal(sanitizeGownShopFabric(fabric({ pricePerMetreCentavos: 1.5 }), ctx).ok, false);
  const r2 = sanitizeGownShopFabric(fabric({ pricePerMetreCentavos: 12300 }), ctx);
  assert.ok(r2.ok && r2.fabric.pricePerMetreCentavos === 12300);
  const c = sanitizeGownShopFabric(fabric({ colours: [{ hex: '#ABCDEF' }] }), ctx);
  assert.ok(c.ok && c.fabric.colours[0]!.hex === '#abcdef' && c.fabric.colours[0]!.name === null);
  assert.equal(sanitizeGownShopFabric(fabric({ colours: [{ hex: 'red' }] }), ctx).ok, false);
});

test('3 · the type is the registry’s; the sliders stay within ±1 and an untouched one is not stored', () => {
  assert.equal(sanitizeGownShopFabric(fabric({ typeId: 'kevlar' }), ctx).ok, false);
  assert.deepEqual(GOWN_FABRIC_TUNE.map((t) => t.label), ['Shine', 'See-through', 'Body', 'Texture']);
  const r = sanitizeGownShopFabric(fabric({ tune: { shine: 0.333, sheer: 0, body: -1 } }), ctx);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.fabric.tune, { shine: 0.33, body: -1 });
  assert.equal(sanitizeGownShopFabric(fabric({ tune: { shine: 1.2 } }), ctx).ok, false);
  assert.equal(sanitizeGownShopFabric(fabric({ tune: { glow: 0.2 } }), ctx).ok, false);
  assert.equal(sanitizeGownShopFabric(fabric({ kind: 'cloth' }), ctx).ok, false);
  assert.equal(sanitizeGownShopFabric(fabric({ name: '   ' }), ctx).ok, false);
  assert.equal(sanitizeGownShopFabric(fabric({ id: 'not-a-uuid' }), ctx).ok, false);
});

test('4 · a look’s name and photo are checked; its design goes on to the config check', () => {
  const ok = sanitizeGownShopLookShell({ id: null, name: 'Garden', photoKey: ref(SHOP, 'looks/g.webp'), config: { sil: 'aline' } }, SHOP);
  assert.ok(ok.ok && ok.look.active && (ok.config as { sil: string }).sil === 'aline');
  assert.equal(sanitizeGownShopLookShell({ name: 'Garden', photoKey: ref(OTHER, 'looks/g.webp') }, SHOP).ok, false);
  assert.equal(sanitizeGownShopLookShell({ name: '' }, SHOP).ok, false);
});

test('5 · the ops ride the one dispatcher, are the Shop Manager’s, and the stock read stays out of a bride’s read', () => {
  const src = readFileSync(join(__dirname, '..', 'app/_components/gown-maker/gown-actions.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  const shopBranch = src.slice(src.indexOf("op === 'stock' || op === 'fabric_save' || op === 'look_save'"), src.indexOf('// invite') > -1 ? src.indexOf('const threadId') : undefined);
  assert.match(shopBranch, /if \(op !== 'invite' && !canManageVendor\(/, 'the stock ops are not the Shop Manager’s');
  assert.ok(shopBranch.indexOf("if (op === 'stock')") < shopBranch.indexOf('if (!allowed.data)'), 'a locked shop can no longer read its stock');
  assert.ok(shopBranch.indexOf('if (!allowed.data)') < shopBranch.indexOf("if (op === 'fabric_save')"), 'a locked shop can save');
  assert.match(shopBranch, /sanitizeGownShopFabric\(/);
  assert.match(shopBranch, /sanitizeGownConfig\(/);
  const open = src.slice(src.indexOf("if (op !== 'open')"));
  assert.doesNotMatch(open, /readShopGownStock|ShopGownStock/, 'a bride’s read reaches the shop’s stock list');
});

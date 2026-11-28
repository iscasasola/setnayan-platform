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
  // The plan gate (lib/gown-plan.ts): a paused shop reads its stock; only making is refused, after the stock read.
  const stockAt = shopBranch.indexOf("if (op === 'stock')"), makeGateAt = shopBranch.indexOf('if (!canMake) return fail(');
  assert.ok(stockAt > -1 && makeGateAt > -1, 'the stock read or the make gate is gone from the shop branch');
  assert.ok(stockAt < makeGateAt, 'a locked shop can no longer read its stock');
  assert.ok(shopBranch.indexOf('if (!allowed.data)') < shopBranch.indexOf("if (op === 'fabric_save')"), 'a locked shop can save');
  assert.match(shopBranch, /sanitizeGownShopFabric\(/);
  assert.match(shopBranch, /sanitizeGownConfig\(/);
  const open = src.slice(src.indexOf("if (op !== 'open')"));
  assert.doesNotMatch(open, /readShopGownStock|ShopGownStock/, 'a bride’s read reaches the shop’s stock list');
});

test('6 · the screens: every control reaches the action; photos go to the shop’s own folder; no dead button', () => {
  const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  const stock = read('app/vendor-dashboard/shop/_components/gown-stock-panel.tsx');
  assert.match(stock, /gownAction\(\{ op: 'stock' \}\)/);
  assert.match(stock, /op: 'fabric_save'/);
  assert.match(stock, /op: 'look_save'/);
  assert.match(stock, /pathPrefix: `\$\{gownShopMediaPrefix\(shop\)\}\$\{folder\}`/, 'a photo goes outside the shop’s own gown folder');
  assert.match(stock, /'Not priced'/, 'an unpriced fabric reads as something else');
  assert.doesNotMatch(stock, /onClick=\{\(\) => \{\}\}|href="#"|console\.log/);
  // Brides never meet this screen: nothing in the bride's flow imports it.
  assert.doesNotMatch(read('app/_components/gown-maker/gown-actions.ts'), /gown-stock-panel/);
  const panel = read('app/vendor-dashboard/shop/_components/gown-maker-panel.tsx');
  assert.match(panel, /import\('\.\/gown-stock-panel'\)/, 'the stock screens are in the panel’s first load');
});

// ── B5b · the fabric-type registry ───────────────────────────────────────────────────────────────────────────────
import { sanitizeGownFabricType } from './gown-maker';

const TYPE = { id: 'duchess', name: 'Duchess satin', aliases: ['duchesse'], family: 'satins', gsm: 200, stiff: 0.5, sheen: 0.8, sheer: 0, stretch: 'none', usedFor: ['gown_body'], renderAs: 'satin', active: true, sort: 3, verified: false };

test('7 · a fabric type is checked against the table’s own rules', () => {
  const known = new Set(['satin', 'duchess']);
  const ok = sanitizeGownFabricType(TYPE, known);
  assert.ok(ok.ok && ok.type.renderAs === 'satin' && ok.type.verified === false);
  for (const [patch, why] of [
    [{ id: 'Duchess' }, 'a capital in the id'],
    [{ id: 'd' }, 'a one-letter id'],
    [{ gsm: 4 }, 'a weight under 5'],
    [{ gsm: 601 }, 'a weight over 600'],
    [{ stiff: 1.1 }, 'stiffness over 1'],
    [{ family: 'plastics' }, 'an unknown family'],
    [{ stretch: '3way' }, 'an unknown stretch'],
    [{ usedFor: [] }, 'no use'],
    [{ usedFor: ['curtains'] }, 'an unknown use'],
    [{ renderAs: 'kevlar' }, 'a look-alike that is not in the list'],
    [{ renderAs: 'duchess' }, 'a type that looks like itself'],
    [{ aliases: Array.from({ length: 13 }, (_, i) => `n${i}`) }, '13 other names'],
  ] as const) {
    assert.equal(sanitizeGownFabricType({ ...TYPE, ...patch }, known).ok, false, `accepted ${why}`);
  }
});

test('8 · the registry is Setnayan admin only, and is never a shop’s or a bride’s', () => {
  const src = readFileSync(join(__dirname, '..', 'app/_components/gown-maker/gown-actions.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  const branch = src.slice(src.indexOf("if (op === 'types' || op === 'type_save')"), src.indexOf("op === 'options' || op === 'save'"));
  assert.ok(branch.length > 0 && branch.indexOf('requireAdminAction()') > -1, 'the registry ops do not prove the admin');
  assert.ok(branch.indexOf('requireAdminAction()') < branch.indexOf('createAdminClient()'), 'the service role opens before the admin is proved');
  assert.match(branch, /sanitizeGownFabricType\(/);
  const surface = readFileSync(join(__dirname, '..', 'app/admin/studio/_surfaces/gown-fabric-types-surface.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  assert.match(surface, /gownAction\(\{ op: 'types' \}\)/);
  assert.match(surface, /op: 'type_save'/);
  assert.doesNotMatch(surface, /delete/i, 'a fabric type can be deleted — hide it instead');
  assert.match(readFileSync(join(__dirname, '..', 'app/admin/studio/page.tsx'), 'utf8'), /tab === 'fabric-types' \? \(\s*<GownFabricTypesSurface \/>/);
});

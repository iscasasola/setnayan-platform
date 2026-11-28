/**
 * 👗 THE ATTIRE MAKER'S SERVER SIDE KEEPS COSTS ON THE SERVER — plan steps B3/B4 (corpus
 * WHATS_NEXT_Gown_Maker_Port_2026-11-27.md § 5). Source pins in the shape of lib/cake-maker.test.ts, plus the pure halves.
 *
 *   1 · One server action carries the whole Attire Maker: `runGownAction` rides the existing `supplierScan` dispatcher
 *       (op `gown_tool`); no new exported action anywhere.
 *   2 · The send re-checks and prices on the server, stores the design BEFORE naming it in the chat, and drops the row
 *       when the message did not post.
 *   3 · `open` never hands a bride a price: no price list, no per-metre price, no cost line.
 *   4 · The stored row carries no cost line: only quantities and the one estimate.
 *   5 · The shop's price list is the Shop Manager's; the invite asks the verified-shop gate at the server; the gate is
 *       the one answer for `attire_tool`.
 *   6 · The design message names its stored row last; the add-ons a bride sees are words or her amount, never a cost.
 *   7 · The tile is registered and opens the panel (never a dead button); the panel saves through the action.
 *
 * Run: cd apps/web && npx tsx --test lib/gown-maker.server.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GOWN_DESIGN_HEAD, GOWN_DESIGN_REF, formatGownDesignBlock, gownDesignRefOf, gownShopTemplate } from './gown-maker';
import { startingGownConfig } from './gown-config';

const WEB = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

test('1 · one server action carries the whole Attire Maker, through supplierScan', () => {
  const src = strip(read('app/_components/gown-maker/gown-actions.ts'));
  assert.match(read('app/_components/gown-maker/gown-actions.ts'), /^import 'server-only';/);
  assert.doesNotMatch(src, /^['"]use server['"]/m, 'gown-actions.ts became a server-action file');
  assert.equal((src.match(/^export async function /gm) ?? []).length, 1);
  const scan = read('app/_actions/supplier-scan-actions.ts');
  assert.match(scan, /case 'gown_tool':\s*return \{ op: 'gown_tool', result: await runGownAction\(req\.input\) \};/);
  assert.match(read('app/_components/gown-maker/gown-call.ts'), /supplierScan\(\{ op: 'gown_tool', input \}\)/);
});

test('2 · the send re-checks, stores before naming, and drops a design whose message did not post', () => {
  const src = strip(read('app/_components/gown-maker/gown-actions.ts'));
  const send = src.slice(src.indexOf("if (op === 'send')"), src.indexOf("if (op !== 'open')"));
  assert.match(send, /buildGownDesign\(/);
  assert.ok(send.indexOf('storeGownDesign(') > -1 && send.indexOf('storeGownDesign(') < send.indexOf('sendChatMessageCore('), 'the message must name a stored design');
  assert.match(send, /dropGownDesign\(/, 'a refused message leaves a stored design behind');
});

test('3 · open never hands a bride a price', () => {
  const src = strip(read('app/_components/gown-maker/gown-actions.ts'));
  const open = src.slice(src.indexOf("if (op !== 'open')"));
  const ret = open.slice(open.lastIndexOf('return {'));
  assert.doesNotMatch(ret, /options[:,]|options\.data[^)]|prices|forShop/, 'open returns the shop’s price list');
  assert.match(ret, /pricePerMetreCentavos: _price, \.\.\.publicCols/, 'open hands the fabric rows with their price');
  assert.match(ret, /brideAddOnsOf\(options\.data\)/);
  const t = read('app/_components/gown-maker/gown-actions.ts');
  const openType = t.slice(t.indexOf('export type GownOpenRead'), t.indexOf('export type GownDesignRead'));
  assert.doesNotMatch(openType, /GownShopOptions|price|cost/i);
});

test('4 · the stored row carries no cost line', () => {
  const server = strip(read('lib/gown-maker.server.ts'));
  const store = server.slice(server.indexOf('export async function storeGownDesign'), server.indexOf('export async function dropGownDesign'));
  assert.match(store, /estimate_centavos: args\.built\.forBride\.estimateCentavos/);
  assert.doesNotMatch(store, /forShop|lines|cost|markup|hours/, 'a cost reached the row the bride can read');
  // The design read computes the cost lines for the shop only.
  const actions = strip(read('app/_components/gown-maker/gown-actions.ts'));
  const design = actions.slice(actions.indexOf("if (op === 'design')"), actions.indexOf("if (op === 'fit')"));
  assert.ok(design.indexOf('if (isShop)') > -1 && design.indexOf('if (isShop)') < design.indexOf('gownDesignOf('), 'cost lines are computed outside the shop branch');
});

test('5 · the price list is the Shop Manager’s; the invite asks the verified gate; one gate for attire_tool', () => {
  const src = strip(read('app/_components/gown-maker/gown-actions.ts'));
  assert.match(src, /canManageVendor\(await resolveVendorRoleForProfile\(/);
  const invite = src.slice(src.indexOf('// invite') > -1 ? src.indexOf('plusGateRefusal') - 400 : 0, src.indexOf("op === 'status'"));
  assert.match(invite, /plusGateRefusal\(await shopPlusGate\(admin, shop\)\)/);
  assert.match(read('lib/gown-maker.server.ts'), /readShopSpecialToolOpen\(admin, vendorProfileId, 'attire_tool', eventId\)/);
});

test('6 · the design message names its stored row last; the bride’s text is the estimate or "Ask for a quote"', () => {
  const id = '3f2b8c1e-9a4d-4e6b-8c2a-1d2e3f4a5b6c';
  const c = startingGownConfig();
  const ask = formatGownDesignBlock(c, { estimateCentavos: null, withinBase: false, addOns: [] }, id);
  assert.ok(ask.startsWith(GOWN_DESIGN_HEAD));
  assert.match(ask, /Ask for a quote/);
  assert.equal(gownDesignRefOf(ask), id);
  assert.equal(gownDesignRefOf(`${ask}\nthanks`), null, 'the ref is the LAST line');
  assert.equal(gownDesignRefOf(`${GOWN_DESIGN_REF}${id}`), null, 'only a gown design message names a gown design');
  const priced = formatGownDesignBlock(c, { estimateCentavos: 12345600, withinBase: true, addOns: [] }, id);
  assert.match(priced, /^Estimate: /m);
  assert.doesNotMatch(priced, /cost|markup|labour|supplies/i);
});

test('7 · the tile is registered, suggested to custom gown makers, and opens the panel that saves through the action', () => {
  const tools = read('lib/specialized-tools.ts');
  assert.match(tools, /key: 'attire_tool', title: 'Attire Maker'/);
  assert.match(tools, /if \(tool\.key === 'attire_tool'\) return services\.some\(isGownKind\);/);
  assert.match(read('lib/supplier-store.ts'), /PAID_STORE_TOOLS = \['cake_tool', 'attire_tool',/);
  const makers = read('app/vendor-dashboard/shop/_components/shop-makers.tsx');
  assert.match(makers, /tool\.door\.kind === 'attire_tool'[\s\S]{0,400}<GownMakerPanel \/>/, 'the tile opens nothing');
  const panel = strip(read('app/vendor-dashboard/shop/_components/gown-maker-panel.tsx'));
  assert.match(panel, /gownAction\(\{ op: 'options' \}\)/);
  assert.match(panel, /gownAction\(\{ op: 'save', options: o \}\)/);
  assert.doesNotMatch(panel, /onClick=\{\(\) => \{\}\}|href="#"/);
  assert.ok(gownShopTemplate().addOns.veil.state === 'none', 'an add-on starts offered');
});

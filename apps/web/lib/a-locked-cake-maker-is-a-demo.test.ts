/**
 * 🎂🔒 A LOCKED SPECIAL TOOL SHOWS ITS FRONT-END EXPERIENCE, NOT ITS SETTINGS (owner ruling, 2026-11-21).
 *
 * A Verified shop (below Pro), after the admin's start date: tapping the Cake Maker tile opens the couple's designer as
 * a DEMO on sample options — fully playable, nothing read, saved or sent, a calm bar with Upgrade in place of Send. The
 * settings stay Pro and up, and the server still refuses the save and the send. Before the start date nothing changes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { specialToolsAllowed } from './special-tools';
import { CAKE_DEMO_BAR_WORDS, cakeDemoOptions } from './cake-demo';
import { sanitizeCakeShopOptions } from './cake-maker';

const WEB = process.cwd();
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const PAST = '2026-01-01T00:00:00+08:00';
const NOW = Date.parse('2026-11-21T12:00:00+08:00');

test('a Verified shop after the start date is locked; before it, and on Pro, it is not', () => {
  assert.equal(specialToolsAllowed('verified', PAST, NOW), false, 'a Verified shop after the start date');
  assert.equal(specialToolsAllowed('verified', '2027-06-01T00:00:00+08:00', NOW), true, 'before the start date nothing changes');
  assert.equal(specialToolsAllowed('pro', PAST, NOW), true);
});

// 🔁 RE-AIMED 2026-11-23 (owner; Store drawing `supplier_store_graphs_badges_2026-11-23` v10, F3): a locked Cake Maker
// is not in Your tools at all — it waits in the Store, where its item's "Try it first" opens the SAME demo. Your tools
// lists only the tools the shop holds (`yourTools`: bought · with its plan · on the trial), so no tap opens the settings
// of a tool the shop does not have.
test('the locked Cake Maker is tried in the Store — the couple’s designer as a demo — never its settings', () => {
  const client = read('app/vendor-dashboard/shop/store/_components/store-client.tsx');
  assert.match(client, /tool === 'cake_tool' \? <CakeDesigner threadId="" demo onClose=/, 'the demo is not the couple’s own designer');
  // 🔁 RE-AIMED 2026-11-23 (specs 7d487adb Q6 — all four paid tools get a demo): the Cake Maker's "Try it first" is now
  // the ONE `ToolDemoButton` every paid tool's item draws; for the Cake Maker it still opens the designer above.
  const item = read('app/vendor-dashboard/shop/store/_components/store-screens.tsx');
  assert.match(item, /isPaidStoreTool\(tool\.key\) \?[\s\S]{0,200}label="Try it first"[\s\S]{0,300}<ToolDemoButton tool=\{tool\.key\}/, 'the Cake Maker item lost its demo');
  const page = read('app/vendor-dashboard/shop/page.tsx');
  assert.match(page, /mine: yourTools\(toolFacts\)/, 'Your tools is not the tools the shop holds');
});

test('the demo reads nothing, saves nothing, sends nothing — and shows no price', () => {
  const src = read('app/_components/cake-maker/cake-designer.tsx');
  assert.match(src, /demo \? \{ s: 'ok', data: demoRead\(\) \}/, 'the demo must start from the built-in sample, not a read');
  assert.match(src, /if \(!seed && !demo\) load\(\)/, 'the demo must not call cakeAction open');
  assert.match(src, /if \(demo \|\| overCap \|\| send\.s === 'sending'\) return;/, 'the demo must never send');
  const bar = src.slice(src.indexOf('{demo ? (\n              <div className={css.demoBar}'), src.indexOf(') : send.s === \'sent\' ? ('));
  assert.ok(bar.length > 50, 'the demo bar is missing');
  assert.doesNotMatch(bar, /doSend|cakeAction|Send to|Make a quote/, 'the demo bar must carry no Send');
  assert.match(bar, /CAKE_DEMO_BAR_WORDS/);
  assert.match(bar, /label="Upgrade" href=\{SPECIAL_TOOLS_UPGRADE_HREF\}/);
  assert.equal(CAKE_DEMO_BAR_WORDS, 'This special tool is included in Plus', 'the bar reads the plan table (every paid size, 2026-11-22)');
  // Fully playable, and never a guessed price: every part on, every extra ₱0.
  const o = cakeDemoOptions();
  assert.ok(sanitizeCakeShopOptions(o).ok, 'the demo options must be valid options');
  assert.equal(o.sizes.length, 10);
  assert.ok(o.monogram && o.cupcakes && o.display && o.tall && o.accents.length > 2 && o.arrangements.length === 5);
  const extras = JSON.stringify(o).match(/"(extraCentavos|priceCentavos)":(\d+)/g) ?? [];
  assert.ok(extras.every((x) => x.endsWith(':0')), 'the demo invented a price');
});

test('the settings stay Pro and up: the server refuses the save and the send below Pro', () => {
  const actions = read('app/_components/cake-maker/cake-actions.ts');
  assert.match(actions, /if \(!allowed\.data\) return fail\(/, 'the save no longer refuses a locked shop');
  const server = read('lib/cake-maker.server.ts');
  assert.match(server, /!allowed\.data\) return \{ ok: false, reason: 'not_offered' \}/, 'the couple’s send no longer refuses a locked shop');
});

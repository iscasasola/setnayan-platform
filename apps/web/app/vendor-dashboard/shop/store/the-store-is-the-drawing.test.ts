/**
 * GUARD — THE STORE IS THE DRAWING (owner 23 Nov 2026; drawing `supplier_store_graphs_badges_2026-11-23` v12).
 *
 *   1. Three shelves in the drawing's order — Widgets · Graphs · Badges (the place reads "Toolkit"; owner 23 Nov) — each with "See all N", one batched read.
 *   2. Every Shop [+] lands on its shelf: Add a graph → Graphs, Add a badge → Badges, Add a tool → Tools. Each of the
 *      three rows has an Edit that arranges it (reorder · remove) through the one action's op=layout.
 *   3. Buying is apply-then-pay through the ONE Store action: the price is the catalog row's (`vendor_billing_catalog`,
 *      active, positive) — the form carries a tool key only — and it ends on the pay page.
 *   4. A tool item says one-time and "Yours forever", or its state; "Price not set yet" when the catalog has none —
 *      never ₱0. Badges are earned, never sold: no Buy on the Badges shelf.
 *   5. The Store's pages are registered (Back knows them) and use the route builders.
 *   6. The Tools shelf opens with its tag chips and "For you" first; every tool row and item carries its tags. What is
 *      on the page says "✓ Installed" (v19); nothing on a shelf drags (the order lives on the Shop's Edit).
 *   7. No "Try it first" (owner 23 Nov 2026: "no more try first"): no demo door in the Store, and the Cake Maker
 *      designer has no demo mode.
 *
 * Sabotage: swap the shelves (1) · point Add a tool at /vendor-dashboard/services (2) · read the price from the form (3)
 * · put a Buy on the badges shelf (4) · drop an Edit (2) · put "More widgets" before "For you" (6) · bring back a "Try it first" section or `<CakeDesigner demo` (7).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const HERE = import.meta.dirname;
const WEB = join(HERE, '../../../..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const FRONT = read('app/vendor-dashboard/shop/store/page.tsx');
const SHELF = read('app/vendor-dashboard/shop/store/[shelf]/page.tsx');
const ITEM = read('app/vendor-dashboard/shop/store/[shelf]/[item]/page.tsx');
const ACTION = read('app/vendor-dashboard/shop/store/store-actions.ts');
const SHOP = read('app/vendor-dashboard/shop/page.tsx');
/** The screens every Store page (and the supplier lab) mounts — the pages only read and hand over. */
const SCREENS = read('app/vendor-dashboard/shop/store/_components/store-screens.tsx');

test('1 · three shelves in order, each with See all, from one read', () => {
  const at = ['title={SHELF_TITLE.tools}', 'title={SHELF_TITLE.graphs}', 'title={SHELF_TITLE.badges}'].map((k) => SCREENS.indexOf(k));
  assert.ok(at.every((n) => n > 0), 'a shelf is missing');
  assert.deepEqual(at, [...at].sort((a, b) => a - b), 'the shelves are out of the drawing’s order');
  for (const page of [FRONT, SHELF, ITEM]) assert.equal((page.match(/await loadStore\(\)/g) ?? []).length, 1, 'a Store page reads more than once');
  assert.doesNotMatch(SCREENS, /loadStore|createClient|createAdminClient|\.from\(/, 'a Store screen reads on its own');
  const views = read('app/vendor-dashboard/shop/store/_components/store-views.tsx');
  assert.match(views, /See all/);
  const data = read('app/vendor-dashboard/shop/store/_components/store-data.ts');
  assert.match(data, /Promise\.all\(/, 'the Store does not read in one batch');
});

test('2 · every Shop [+] lands on its shelf', () => {
  assert.match(SHOP, /addHref: routes\.vendorDashboard\.shop\.store\.shelf\('graphs'\)/);
  assert.match(SHOP, /addHref=\{routes\.vendorDashboard\.shop\.store\.shelf\('badges'\)\}/);
  assert.match(SHOP, /addToolHref=\{routes\.vendorDashboard\.shop\.store\.shelf\('tools'\)\}/);
  assert.match(SHOP, /seeAllHref=\{routes\.vendorDashboard\.shop\.badges\(\)\}/);
  // Each row's Edit — the one shared sheet, three rows.
  const carousel = read('app/vendor-dashboard/performance/_components/analytics-carousel.tsx');
  const badgeRow = read('app/vendor-dashboard/shop/_components/shop-badge-row.tsx');
  const makers = read('app/vendor-dashboard/shop/_components/shop-makers.tsx');
  assert.match(carousel, /<ArrangeEdit\s+row="graphs"/, 'Analytics lost its Edit');
  assert.match(badgeRow, /<ArrangeEdit\s+row="badges"/, 'Badges lost its Edit');
  assert.match(makers, /<ArrangeEdit\s+row="tools"/, 'Your tools lost its Edit');
  assert.match(badgeRow, />Add a badge</);
  const client = read('app/vendor-dashboard/shop/store/_components/store-client.tsx');
  assert.match(client, /fd\.set\('op', 'layout'\)/, 'the Edit sheet saves through another op');
  assert.match(client, /A widget you remove stays yours in the Toolkit\./);
});

test('3 · one Store action; the buy reads the catalog price and ends on the pay page', () => {
  const exported = [...readFileSync(join(WEB, 'app/vendor-dashboard/shop/store/store-actions.ts'), 'utf8').matchAll(/^export async function (\w+)/gm)].map((m) => m[1]);
  assert.deepEqual(exported, ['storeAction'], 'the Store grew a second server action (fold it into storeAction)');
  assert.match(ACTION, /from\('vendor_billing_catalog'\)\.select\('price_php, is_active, title'\)\.eq\('sku_code', sku\)/);
  assert.match(ACTION, /row\.is_active !== true \|\| !Number\.isFinite\(pricePhp\) \|\| pricePhp <= 0/);
  assert.doesNotMatch(ACTION, /formData\.get\('(price|amount|price_php)'\)/, 'the price comes from the form');
  assert.match(ACTION, /redirect\(payPath\(referenceCode\)\)/);
  assert.match(ACTION, /status: 'submitted'|'submitted'/, 'the order is not apply-then-pay');
});

test('4 · tool items say one-time or their state; no price = said; badges are never sold', () => {
  assert.match(SCREENS, /one-time/);
  assert.match(SCREENS, /Yours forever\. No renewal\./);
  assert.match(SCREENS, /Price not set yet/);
  assert.doesNotMatch(SCREENS + ITEM + SHELF + FRONT, /₱\s*0|₱\d/, 'a price is typed');
  const badges = SCREENS.slice(SCREENS.indexOf('function BadgesShelf'), SCREENS.indexOf('function Card('));
  assert.ok(badges.length > 0, 'the Badges shelf is gone');
  assert.doesNotMatch(badges, /op="buy"|Buy ·/, 'a badge is for sale');
  assert.match(ITEM, /if \(shelf === 'badges'\) redirect\(/, 'a badge has an item page of its own (it opens on the Badges page)');
});

test('5 · the pages are registered and use the route builders', () => {
  const home = read('lib/page-home.ts');
  assert.match(home, /'\/vendor-dashboard\/shop\/store': 'Toolkit'/, 'Back does not know the Toolkit (owner 23 Nov: the place is "Toolkit")');
  assert.match(home, /'\/vendor-dashboard\/shop\/store\/\[shelf\]\/\[item\]': \{ home: '\/vendor-dashboard\/shop\/store' \}/, 'an item’s Back does not go to the Store');
  const routes = read('lib/routes.ts');
  assert.match(routes, /store: \{[\s\S]{0,400}shelf: \(shelf[\s\S]{0,200}item: \(shelf/);
  assert.doesNotMatch(FRONT + SHELF + ITEM + SCREENS, /href="\/vendor-dashboard\//, 'a typed address instead of a route builder');
});

test('6 · tags and For you on the Tools shelf; on-page rows say so; shelves never drag', () => {
  const tools = SCREENS.slice(SCREENS.indexOf('function ToolsShelf'), SCREENS.indexOf('type GraphItemState'));
  const at = ['<StoreChips', 'label="For you"', 'label="Yours"', 'label="More widgets"'].map((k) => tools.indexOf(k));
  assert.ok(at.every((n) => n >= 0), 'a Tools shelf part is missing');
  assert.deepEqual(at, [...at].sort((a, b) => a - b), 'the Tools shelf is out of the drawing’s order');
  const views = read('app/vendor-dashboard/shop/store/_components/store-views.tsx');
  assert.match(views, /<TagChips key="tags" tags=\{row\.tags\} \/>/, 'a tool row lost its tags');
  assert.match(views, /tags=\{<TagChips tags=\{row\.tags\} max=\{1\} \/>\}/, 'a Store tile lost its tags');
  assert.match(SCREENS, /<TagChips tags=\{tags\} max=\{6\} \/>/, 'a tool item lost its tags');
  assert.match(views, /children = INSTALLED_WORD/, 'an installed row reads ✓ Installed (Toolkit v19)');
  assert.doesNotMatch(SCREENS, /GraphArrange|drag to arrange|onPointerDown/, 'a shelf drags again (the order lives on the Shop’s Edit)');
});

test('7 · no "Try it first": no demo door in the Store, no demo mode in the Cake Maker', () => {
  const client = read('app/vendor-dashboard/shop/store/_components/store-client.tsx');
  const designer = read('app/_components/cake-maker/cake-designer.tsx');
  assert.doesNotMatch(SCREENS + client + ITEM, /Try it first|CakeDemoButton|store-try|Open the demo/, 'a "Try it first" door is back');
  assert.doesNotMatch(designer, /\bdemo\b|cake-demo/, 'the Cake Maker designer has a demo mode again');
});


test('8 · every widget has its How to use it guide — on its Toolkit page and from its panel; no fake pictures', async () => {
  const { WIDGET_GUIDES } = await import('@/lib/supplier-store-guides');
  const { SPECIALIZED_TOOLS } = await import('@/lib/specialized-tools');
  for (const t of SPECIALIZED_TOOLS) {
    const g = WIDGET_GUIDES[t.key];
    assert.ok(g, `${t.key} has no guide`);
    assert.equal(g.key, t.key);
    assert.ok(g.steps.length <= 6, `${t.key}: a guide is short steps`);
    for (const s of g.steps) {
      assert.ok(s.title.length > 0 && s.body.length > 0 && s.body.length <= 240, `${t.key}: "${s.title}" is not a short step`);
      if (s.shot) assert.match(s.shot.src, /^\/guides\/widgets\/[a-z0-9_]+-\d+\.jpg$/, `${t.key}: a picture must be a real capture in public/guides/widgets`);
    }
  }
  assert.match(SCREENS, /<div id="guide"[\s\S]{0,200}<ToolSection label="How to use it" data="store-guide">\s*<WidgetGuideSteps guide=\{WIDGET_GUIDES\[tool\.key\]\} \/>/, 'the Toolkit page lost the guide');
  const makers = read('app/vendor-dashboard/shop/_components/shop-makers.tsx');
  assert.match(makers, /label="How to use it" href=\{`\$\{routes\.vendorDashboard\.shop\.store\.item\('tools', picked\.key\)\}#guide`\}/, 'a widget’s panel lost its How to use it door');
  const view = read('app/vendor-dashboard/shop/store/_components/widget-guide.tsx');
  assert.match(view, /data-guide-shot-missing/, 'a missing picture must draw an empty frame');
  assert.doesNotMatch(view, /placeholder|sample|example\.(png|jpg)/i, 'a stand-in picture');
});

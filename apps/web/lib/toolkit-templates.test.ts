import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AV_TEMPLATES,
  NO_TEMPLATES,
  PAY_PLAN_TEMPLATES,
  avInside,
  installedAvTemplates,
  partDueWords,
  partsLine,
  partsTotal,
  payInstalled,
  readPlanParts,
  readTemplatesLayout,
  templatePlanItems,
  withAvInstalled,
  withPayInstalled,
} from './toolkit-templates';
import { isCardPickableStyle } from './availability-styles';
import { HUB_TOOLS_SEED, nameKey } from './hub-tools';
import { planItemsToDrafts } from './vendor-pay-plans';
import { NO_LAYOUT, hiddenTemplates, includedSplit, readLayout, layoutColumn, shelfItems, storeTemplateRows, toolkitItems, visibleShelves } from './supplier-store';

/**
 * 🧩 TOOLKIT TEMPLATES (specs 24dcf90c, drawing `prototypes/toolkit_templates_2026-11-23/`): the template table, the
 * money rule (percents and days only), the installed state, the card gate and the one Toolkit list.
 */

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('1 · the eight payment plans and six availability set-ups are the drawing’s table', () => {
  assert.deepEqual(
    PAY_PLAN_TEMPLATES.map((t) => [t.name, t.parts.map((x) => x.pct)]),
    [
      ['Reserve with 20%', [20, 80]],
      ['First payment, then monthly', [25, 25, 25, 25]],
      ['Full upfront', [100]],
      ['Half now, half before', [50, 50]],
      ['20% to book, two more parts', [20, 40, 40]],
      ['30% to book, two more parts', [30, 35, 35]],
      ['Balance after the final count', [50, 40, 10]],
      ['Balance on the day', [30, 70]],
    ],
  );
  assert.deepEqual(
    AV_TEMPLATES.map((t) => [t.name, t.style, t.leadDays, t.perDay]),
    [
      ['One event a day', 'day', null, 1],
      ['More than one event a day', 'day', null, null],
      ['Made to order, two weeks ahead', 'order', 14, null],
      ['Made to order, a month ahead', 'order', 30, null],
      ['Rented by the piece', 'piece', null, null],
      ['Always available', 'none', null, null],
    ],
  );
  assert.ok(AV_TEMPLATES.every((t) => isCardPickableStyle(t.style)), 'a template on a style a card cannot pick yet');
  assert.equal(partsLine(PAY_PLAN_TEMPLATES[0]!), '2 parts · 20 · 80');
  assert.equal(partDueWords({ anchor: 'on_lock', days: 0 }), 'When booked');
  assert.equal(partDueWords({ anchor: 'on_lock', days: 30 }), '30 days after booking');
  assert.equal(partDueWords({ anchor: 'before_event', days: 0 }), 'The Day');
  assert.deepEqual(avInside(AV_TEMPLATES[2]!).map((r) => r.value), ['Made to order', 'You set it', '14 days before']);
});

test('2 · every plan adds up to 100%, is percent only (never a peso amount), and reads back as itself', () => {
  for (const t of PAY_PLAN_TEMPLATES) {
    assert.equal(partsTotal(t.parts), 100, `${t.name} does not add up to 100%`);
    const items = templatePlanItems(t);
    assert.ok(items.every((i) => i.amount_kind === 'percent' && i.amount_centavos === null), `${t.name} carries a peso amount`);
    const back = planItemsToDrafts(items);
    assert.ok(back, `${t.name} does not read back as a saved plan`);
    assert.deepEqual(back!.map((d) => d.percent), t.parts.map((x) => x.pct));
  }
  // No peso sign or price anywhere in the module (CLAUDE.md §1: prices are read, never typed).
  assert.doesNotMatch(src('./toolkit-templates.ts'), /₱|price_php|_centavos:\s*\d/);
});

test('3 · the For first tags are seed categories (tags only order, never lock)', () => {
  const seed = new Set(HUB_TOOLS_SEED.map((r) => nameKey(r.category)));
  for (const t of [...PAY_PLAN_TEMPLATES, ...AV_TEMPLATES])
    for (const c of t.forCategories) assert.ok(seed.has(nameKey(c)), `${t.name}: “${c}” is not a HUB_TOOLS_SEED category`);
});

test('4 · installed state: the layout keeps template keys, a pay template is installed while its plan is live', () => {
  const id = '11111111-2222-4333-8444-555555555555';
  const l = withAvInstalled(withPayInstalled(NO_TEMPLATES, 'reserve_20', id), 'order_14', true);
  assert.deepEqual(readTemplatesLayout(JSON.parse(JSON.stringify(l))), l, 'the column round-trips');
  assert.equal(payInstalled('reserve_20', l, new Set([id])), true);
  assert.equal(payInstalled('reserve_20', l, new Set()), false, 'a plan deleted in Payment Strategies is no longer installed');
  assert.equal(payInstalled('reserve_20', l, null), null, 'a refused plans read says unread, never "not installed"');
  assert.deepEqual(installedAvTemplates(l).map((t) => t.key), ['order_14']);
  assert.deepEqual(readTemplatesLayout({ pay: { nope: id, reserve_20: 'x' }, av: ['order_14', 'nope', 3] }), { pay: {}, av: ['order_14'] }, 'unknown keys and bad ids are dropped');
  assert.deepEqual(withAvInstalled(l, 'order_14', false).av, []);
  // The store layout carries it: read, write, never resets another row.
  const layout = readLayout({ graphs: ['slow'], templates: layoutColumn({ ...NO_LAYOUT, templates: l }).templates });
  assert.deepEqual(layout.templates, l);
  assert.deepEqual(layout.graphs, ['slow']);
});

test('5 · the plan editor’s rows: whole percents that add up to 100, a due anchor, days 0–730', () => {
  const fd = (rows: [string, string, string, string][]) => {
    const f = new FormData();
    for (const [l, p, a, d] of rows) {
      f.append('part_label', l);
      f.append('part_pct', p);
      f.append('part_anchor', a);
      f.append('part_days', d);
    }
    return f;
  };
  assert.deepEqual(readPlanParts(fd([['Deposit', '30', 'on_lock', '0'], ['Balance', '70', 'before_event', '7']])), [
    { label: 'Deposit', pct: 30, anchor: 'on_lock', days: 0 },
    { label: 'Balance', pct: 70, anchor: 'before_event', days: 7 },
  ]);
  assert.match(String(readPlanParts(fd([['Deposit', '25', 'on_lock', '0'], ['Rest', '65', 'before_event', '7']]))), /add up to 90%\. They must add up to 100%/);
  assert.match(String(readPlanParts(fd([['', '100', 'on_lock', '0']]))), /Name payment 1/);
  assert.match(String(readPlanParts(fd([['A', '100', 'whenever', '0']]))), /Pick when payment 1 is due/);
  assert.match(String(readPlanParts(fd([['A', '100', 'on_lock', '-3']]))), /days from 0 to 730/);
  assert.match(String(readPlanParts(new FormData())), /at least one payment/);
});

test('6 · the one Toolkit list: two template shelves, counted once; no online card hides what was never installed', () => {
  const all = toolkitItems({ papicCapture: false, badges: null });
  assert.equal(shelfItems(all, 'payment_plans').length, PAY_PLAN_TEMPLATES.length);
  assert.equal(shelfItems(all, 'availability').length, AV_TEMPLATES.length);
  assert.ok(visibleShelves(all).includes('payment_plans') && visibleShelves(all).includes('availability'));
  const split = includedSplit(all);
  assert.equal(split.included + split.withPlan, all.length, 'Included + With a plan is the whole list');

  // No online card: an uninstalled template is hidden; an installed one stays (greyed).
  const none = hiddenTemplates([], new Set(['pay:reserve_20']));
  assert.ok(none.has('pay:full_upfront') && !none.has('pay:reserve_20'));
  assert.equal(hiddenTemplates(null, new Set()).size, 0, 'an unread card list hides nothing');
  const rows = storeTemplateRows('pay', { layout: NO_LAYOUT, livePlanIds: new Set(), cards: [] });
  assert.equal(rows.length, 0);
  const caterer = storeTemplateRows('pay', { layout: NO_LAYOUT, livePlanIds: new Set(), cards: ['catering'] });
  assert.equal(caterer.length, PAY_PLAN_TEMPLATES.length, 'with an online card every template shows');
  assert.ok(caterer.find((r) => r.t.key === 'final_count')?.forYou, 'a caterer sees Balance after the final count first');
});

test('7 · the doors: the Templates chip, the shelves’ pages, the item pages, the card maker row, the Pay plan door', () => {
  const screens = src('../app/vendor-dashboard/shop/store/_components/store-screens.tsx');
  assert.match(screens, /label: 'Templates', shelves: \['chat_forms', 'card_forms', 'payment_plans', 'availability'\]/);
  assert.doesNotMatch(screens, /label: 'Forms'/, 'the chip still reads Forms');
  assert.match(screens, /Free with every shop\./);
  assert.match(screens, /Plus or higher\. Buy once; it works while you stay on a plan\./);
  const item = src('../app/vendor-dashboard/shop/store/[shelf]/[item]/page.tsx');
  assert.match(item, /shelf === 'payment_plans' && !payTemplateOf\(key\)\) notFound\(\)/);
  const action = src('../app/vendor-dashboard/shop/store/store-actions.ts');
  assert.match(action, /if \(op === 'template'\) return templateOp\(formData, shopId\);/);
  assert.equal((action.match(/^export async function/gm) ?? []).length, 1, 'the Toolkit keeps ONE server action');
  const maker = src('../app/vendor-dashboard/services/_components/canvas-maker.tsx');
  assert.match(maker, /data-maker-availability-template=\{t\.key\}/);
  assert.match(src('./service-card-maker.server.ts'), /avTemplates: tierRes\.error \|\| !tierRow \? null : installedAvTemplates/);
  assert.match(src('../app/vendor-dashboard/services/_components/payment-schedule-editor.tsx'), /routes\.vendorDashboard\.shop\.store\.shelf\('payment_plans'\)/);
  assert.match(src('../app/vendor-dashboard/shop/_components/service-scanner-pick.tsx'), /Ready-made for \{seed\.row\.category\}/);
});

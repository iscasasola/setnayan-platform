/**
 * 🛍 THE STORE'S RULES (owner 23 Nov 2026; drawing `supplier_store_graphs_badges_2026-11-23` v12; DECISION_LOG rows
 * 2026-11-23, specs 5a8c6bf3 → 46690f6d, 060467d5 · 14827167). Pure — `lib/supplier-store.ts`.
 *
 *   1. Money: four paid tools, each one catalog SKU (`vendor_tool_<key>`), seeded by the migration — the price is the
 *      row's, never typed in code. No price → "Price not set yet", never ₱0. A read that failed never sells.
 *   2. A paid tool: bought → Owned; the plan opens it → With your plan. NO TRIAL (owner 23 Nov, "guides only"): no
 *      trial state, no trial words, no trial clock in the migration.
 *   3. Your tools: never arranged = the free tools added, then the paid ones held. Arranged = the shop's order (a paid
 *      key shows only while held); a paid tool taken off stays owned and stays off; a new buy joins at the end.
 *   4. Graphs: the 17 shipped graphs only, once each; a graph its badge has not opened is never shown; never picked =
 *      every open graph.
 *   5. Badges: the ones the shop chose, any number, in its order; never chosen = the three closest to their next step.
 *   6. Storage: an unread store is "unread", never 0 of the plan.
 *   7. ONE layout for the three Shop rows: one column (`store_layout`), one action op (`layout`), no per-row mechanism.
 *   8. Tags: read only from the per-category table (seed + admin switches) and `suggestedFor`'s own rules; never typed.
 *      The shop's coverage labels alone never gate. 🟢 The CARD GATE (DECISION_LOG 3a2419fd, which supersedes the
 *      2026-10-28 "never a gate" for the Toolkit): a widget no ONLINE service card serves is hidden unless the shop holds
 *      it, and greyed (`no_card`) when it does; a failed card read gates nothing; shop-level widgets always show.
 *
 * Sabotage (each seen red): type a number price into supplier-store.ts (1) · put `plan` after `pending` (2) · bring back a trial state (2) · let `addedFreeTools`
 * keep a paid key (3) · drop the hidden filter in `analyticsGraphs` (4) · cap `cleanBadgePicks` at three (5) · add a
 * `store_badges` write to the action (7) · type 'Cake' into supplier-store.ts, or hide an untagged tool (8) · drop
 * `heldByShop` from `gatedRow`, or gate on a null card read (3a2419fd).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  DEFAULT_SHOP_BADGES,
  NO_LAYOUT,
  PAID_STORE_TOOLS,
  STORE_GRAPHS,
  STORE_TOOL_SKUS,
  addedFreeTools,
  analyticsGraphs,
  cleanBadgePicks,
  closestBadges,
  followedBadges,
  storageMeter,
  storeToolSku,
  INSTALLED_WORD,
  INSTALL_WORD,
  buyWords,
  toolAct,
  toolFootWords,
  toolIsInstalled,
  toolIsOpen,
  widgetPlaces,
  toolIsYours,
  toolkitCountWords,
  toolkitCounts,
  widgetLock,
  graphLockedLine,
  isNewGraph,
  toolOfSku,
  cleanLayoutRow,
  layoutColumn,
  readLayout,
  storeToolOf,
  storeToolRows,
  toolShelfGroups,
  toolStatus,
  toolTags,
  withLayoutRow,
  yourTools,
  type ToolFacts,
  toolkitItems,
  shelfItems,
  visibleShelves,
  installedQrs,
  hiddenQrs,
  isBuiltInQr,
  SHOP_LEVEL_WIDGETS,
  cardHiddenWidgets,
  cardTileOf,
  noCardWords,
  seedTileOf,
  unmappedSeedCategories,
} from './supplier-store';
import { PROMOTE_QR_MODES } from './supplier-qr-codes';

import { HUB_TOOLS_SEED, nameKey } from './hub-tools';
import { CARD_ORDER, DEFAULT_INSTALLED_GRAPHS } from '@/app/vendor-dashboard/performance/_components/analytics-cards';
import type { ShelfTile } from './shop-badge-shelf';
import { PAID_WIDGET_NEEDS_PLAN_WORDS, PAID_WIDGET_RESUBSCRIBE_WORDS } from './special-tools';
import { SPECIALIZED_TOOLS, listedWidgets } from './specialized-tools';
import { SHOP_BADGE_KEYS } from './badge-tiers';
import { TOOL_VIDEO_KEYS, toolVideoKey } from './toolkit-videos';

const WEB = process.cwd();

const facts = (over: Partial<ToolFacts> = {}): ToolFacts => ({
  freeOpen: true,
  owned: new Set(),
  pending: new Set(),
  subscribed: true,
  prices: { cake_tool: 123, song_bank: 123, papic_challenge: 123, plan_3d: 123 },
  picked: null,
  toolsOff: [],
  categoryLabels: [],
  services: [],
  ...over,
});

test('1b · free widgets open from Verified up — the day-of gate’s own rule (owner 23 Nov)', () => {
  // Verified (or a tier at Verified and above): the free widget is free and can be added.
  assert.deepEqual(toolStatus('headcount', facts({ freeOpen: true, picked: ['headcount'] })), { kind: 'free', added: true });
  // Not Verified: held back, with the door to Verify — never "Get", never a price. (Scanner, a built-in, is never held.)
  assert.deepEqual(toolStatus('headcount', facts({ freeOpen: false })), { kind: 'verify' });
  assert.equal(toolIsYours(toolStatus('headcount', facts({ freeOpen: false }))), false);
  assert.equal(toolFootWords({ kind: 'verify' }, String), 'Free once you’re Verified');
  // Unread: "Couldn't load", never open and never locked by guess.
  assert.deepEqual(toolStatus('headcount', facts({ freeOpen: null })), { kind: 'unread' });
  // Paid widgets do not ride the Verified fact: bought AND subscribed (owner a02673ac).
  assert.deepEqual(toolStatus('cake_tool', facts({ freeOpen: false, owned: new Set(['cake_tool']) })), { kind: 'owned' });
  // ONE rule: the server computes freeOpen with the gate's own function.
  const server = readFileSync(join(WEB, 'lib/supplier-store.server.ts'), 'utf8');
  assert.match(server, /freeWidgetsOpen\(sub, sub\.verified\)/);
  const gate = readFileSync(join(WEB, 'lib/vendor-specialization-gate.ts'), 'utf8');
  assert.match(gate, /!freeWidgetsOpen\(subscription, input\.verified\)/);
});

test('1 · four paid tools, one catalog SKU each, seeded by the migration; no price typed in code', () => {
  assert.deepEqual([...PAID_STORE_TOOLS], ['cake_tool', 'song_bank', 'papic_challenge', 'plan_3d']);
  for (const k of PAID_STORE_TOOLS) assert.equal(toolOfSku(storeToolSku(k)), k);
  assert.equal(toolOfSku('vendor_tool_nope'), null);
  const mig = readdirSync(join(WEB, '../../supabase/migrations')).find((f) => f.endsWith('_supplier_store_tools_graphs_badges.sql'));
  assert.ok(mig, 'the Store migration is missing');
  const sql = readFileSync(join(WEB, '../../supabase/migrations', mig!), 'utf8');
  for (const sku of STORE_TOOL_SKUS) assert.match(sql, new RegExp(`'${sku}'`), `${sku} is not seeded`);
  for (const f of ['lib/supplier-store.ts', 'lib/supplier-store.server.ts', 'app/vendor-dashboard/shop/store/store-actions.ts']) {
    assert.doesNotMatch(stripComments(readFileSync(join(WEB, f), 'utf8')), /₱\s*\d|price(?:_?[pP]hp)?\s*[:=]\s*\d{2,}/, `${f} types a price`);
  }
  // No price → said so; a price → the one-time words; never ₱0.
  assert.deepEqual(toolStatus('cake_tool', facts({ prices: {} })), { kind: 'no_price' });
  assert.deepEqual(toolStatus('cake_tool', facts({ prices: { cake_tool: 0 } })), { kind: 'no_price' });
  assert.deepEqual(toolStatus('cake_tool', facts()), { kind: 'buy', price: 123, needsPlan: false });
  assert.equal(toolFootWords({ kind: 'no_price' }, String), 'Price not set yet');
  // A read that failed on the way to "open" never sells.
  assert.deepEqual(toolStatus('cake_tool', facts({ owned: null })), { kind: 'unread' });
  assert.deepEqual(toolStatus('cake_tool', facts({ prices: null })), { kind: 'unread' });
  assert.deepEqual(toolStatus('cake_tool', facts({ pending: null })), { kind: 'unread' });
});

test('2 · bought AND subscribed (owner a02673ac): owned → resubscribe → pending → price (+ the plans door off-plan); no trial', () => {
  // Bought + on Plus, Pro or Ultra: open.
  assert.deepEqual(toolStatus('song_bank', facts({ owned: new Set(['song_bank']) })), { kind: 'owned' });
  // Bought + Free or Verified: locked, kept — "Works again when you subscribe", never a second Buy.
  const off = toolStatus('song_bank', facts({ owned: new Set(['song_bank']), subscribed: false }));
  assert.deepEqual(off, { kind: 'resubscribe' });
  assert.equal(toolIsYours(off), true, 'what a shop bought never disappears from Your widgets');
  assert.equal(toolIsOpen(off), false, '… but it does not work off-plan');
  assert.equal(toolFootWords(off, String), PAID_WIDGET_RESUBSCRIBE_WORDS);
  // The plan alone opens nothing.
  assert.deepEqual(toolStatus('song_bank', facts()), { kind: 'buy', price: 123, needsPlan: false });
  // Not bought on Free or Verified: the price AND the notice; the button is the plans door (store-screens).
  const free = toolStatus('plan_3d', facts({ subscribed: false }));
  assert.deepEqual(free, { kind: 'buy', price: 123, needsPlan: true });
  assert.match(toolFootWords(free, String), new RegExp(`^123 · ${PAID_WIDGET_NEEDS_PLAN_WORDS}$`));
  assert.equal(PAID_WIDGET_NEEDS_PLAN_WORDS, 'Works only while your shop is on Plus, Pro or Ultra', 'the plan names are read from the table');
  // A subscription read that failed never opens and never sells.
  assert.deepEqual(toolStatus('cake_tool', facts({ owned: new Set(['cake_tool']), subscribed: null })), { kind: 'unread' });
  assert.deepEqual(toolStatus('cake_tool', facts({ subscribed: null })), { kind: 'unread' });
  assert.deepEqual(toolStatus('plan_3d', facts({ pending: new Set(['plan_3d']) })), { kind: 'pending' });
  // The lock a page outside the Toolkit draws, from the same status.
  assert.deepEqual(widgetLock(off), { owned: true, subscribed: false, price: null });
  assert.deepEqual(widgetLock(free), { owned: false, subscribed: false, price: 123 });
  assert.equal(widgetLock({ kind: 'owned' }), null);
  // The buy refuses both off-plan states before it reads a price; the screens give them the plans door.
  const action = readFileSync(join(WEB, 'app/vendor-dashboard/shop/store/store-actions.ts'), 'utf8');
  assert.match(action, /if \(state\.kind === 'resubscribe'\) return err\(/);
  assert.match(action, /if \(state\.kind === 'buy' && state\.needsPlan\) return err\(/);
  const screens = readFileSync(join(WEB, 'app/vendor-dashboard/shop/store/_components/store-screens.tsx'), 'utf8');
  assert.match(screens, /a\.kind === 'resubscribe' \|\| \(a\.kind === 'buy' && a\.needsPlan\) \?/);
  assert.match(screens, /\{PAID_WIDGET_NEEDS_PLAN_WORDS\}\./, 'the Buy block says the plan rule before payment');
  // The trial is gone end to end (owner 23 Nov, "guides only").
  const code = ['lib/supplier-store.ts', 'lib/supplier-store.server.ts', 'app/vendor-dashboard/shop/store/store-actions.ts', 'app/vendor-dashboard/shop/_components/shop-makers.tsx', 'app/vendor-dashboard/shop/store/_components/store-views.tsx', 'app/vendor-dashboard/shop/store/_components/store-screens.tsx'];
  for (const f of code) assert.doesNotMatch(stripComments(readFileSync(join(WEB, f), 'utf8')), /Free trial|trialDays|trialEndsAt|kind: 'trial'|store_trial/, `${f} still carries the trial`);
  const mig = readdirSync(join(WEB, '../../supabase/migrations')).find((f) => f.endsWith('_supplier_store_tools_graphs_badges.sql'))!;
  const sql = readFileSync(join(WEB, '../../supabase/migrations', mig), 'utf8').replace(/--[^\n]*/g, '');
  assert.doesNotMatch(sql, /store_trial_ends_at|store_trial_on_verify|INTERVAL '30 days'/, 'the migration still stamps a trial');
  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION public\.vendor_store_tool_open[\s\S]{0,700}o\.status IN \('paid', 'fulfilled'\)\s*\)\s*AND public\.vendor_pro_tools_included\(p_vendor_profile_id, p_event_id\);\s*\$\$;/,
    'vendor_store_tool_open is no longer "bought AND subscribed"',
  );
});

test('3 · Your tools: the free ones added, in order, then the paid ones held', () => {
  const f = facts({ picked: ['headcount', 'cake_tool', 'scanner', 'nope', 'headcount'], owned: new Set(['plan_3d']) });
  assert.deepEqual(addedFreeTools(f), ['headcount', 'scanner']);
  assert.deepEqual(
    yourTools(f).map((r) => r.tool.key),
    ['headcount', 'scanner', 'plan_3d'],
  );
  // Arranged: the shop's order, paid keys too; a paid tool not held is skipped; a held one never placed joins at the end;
  // one taken off (tools_off) stays off — and stays owned.
  const held = facts({ owned: new Set(['plan_3d', 'song_bank']), picked: ['plan_3d', 'headcount', 'cake_tool'], toolsOff: ['song_bank'] });
  assert.deepEqual(
    yourTools(held).map((r) => r.tool.key),
    ['scanner', 'plan_3d', 'headcount'], // the built-in Scanner leads a saved order that leaves it out
  );
  assert.deepEqual(toolStatus('song_bank', held), { kind: 'owned' }, 'taking a tool off the page took it away');
  assert.deepEqual(
    yourTools(facts({ owned: new Set(['plan_3d', 'song_bank']), picked: ['headcount'] })).map((r) => r.tool.key),
    ['scanner', 'headcount', 'song_bank', 'plan_3d'],
  );
  // Never picked: Scanner + the tools suggested for the shop's services (no paid tool in that set).
  assert.ok(addedFreeTools(facts()).includes('scanner'));
  for (const k of addedFreeTools(facts())) assert.ok(!(PAID_STORE_TOOLS as readonly string[]).includes(k));
});

test('1c · install, never push (owner 23 Nov): a shop with NO layout row renders exactly today’s Shop; a new graph is never a default pick', () => {
  // TODAY'S SHOP, word for word: the 17 graphs a shop saw on 23 Nov, in that order — an explicit list, not CARD_ORDER.
  const TODAY = ['opened', 'asked', 'booked', 'sources', 'cardsell', 'reply', 'replyvs', 'quotes', 'split', 'calendar', 'lost', 'slow', 'rep', 'bench', 'price', 'gifts', 'invites'];
  assert.deepEqual([...DEFAULT_INSTALLED_GRAPHS], TODAY);
  const none = new Set<never>();
  assert.deepEqual(analyticsGraphs(NO_LAYOUT.graphs, { hidden: none }), TODAY, 'no layout row = every graph the shop has today');
  // Every CARD_ORDER key outside the default list is absent from the row when store_layout is null (Ship's guard): a
  // graph added to CARD_ORDER later (#8206's 12) lands only by Install, and shows in the Toolkit as New · Recommended.
  for (const k of CARD_ORDER) {
    if (DEFAULT_INSTALLED_GRAPHS.includes(k)) continue;
    assert.ok(!analyticsGraphs(null, { hidden: none }).includes(k), `${k} is pushed onto a shop that never installed it`);
    assert.equal(isNewGraph(k), true, k);
  }
  for (const k of DEFAULT_INSTALLED_GRAPHS) assert.equal(isNewGraph(k), false, k);
  // Every fallback for a missing layout reads the explicit list, never CARD_ORDER.
  const carousel = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/performance/_components/analytics-carousel.tsx'), 'utf8'));
  assert.match(carousel, /props\.order \?\? DEFAULT_INSTALLED_GRAPHS/);
  assert.doesNotMatch(carousel, /\?\? CARD_ORDER/);
  const lib = stripComments(readFileSync(join(WEB, 'lib/supplier-store.ts'), 'utf8'));
  assert.match(lib, /if \(picked === null\) return DEFAULT_INSTALLED_GRAPHS\.filter\(open\)/);
  // A badge-locked graph is never greyed on the Shop — it is simply not on the row; the Toolkit names its badge.
  assert.deepEqual(analyticsGraphs(null, { hidden: new Set(['gifts'] as const) }).includes('gifts' as never), false);
  assert.equal(graphLockedLine('Gifts given'), 'Unlocks free when you earn the Gifts given badge');
  // Tools: no layout row = Scanner + the suggested free widgets; the built-in Scanner can never be taken off.
  assert.equal(addedFreeTools(facts())[0], 'scanner');
  assert.ok(addedFreeTools(facts({ picked: ['headcount'] })).includes('scanner'), 'a saved order without Scanner still has it');
  assert.deepEqual(withLayoutRow(NO_LAYOUT, 'tools', ['headcount']).tools, ['scanner', 'headcount'], 'a save that drops Scanner keeps it');
  assert.deepEqual(toolStatus('scanner', facts({ freeOpen: false })), { kind: 'free', added: true }, 'a built-in is not held back by Verified');
  assert.equal(yourTools(facts({ picked: ['headcount'] }))[0]?.tool.key, 'scanner');
});

test('4 · graphs: the 17 shipped, once each, a shut one never shown; never picked = every open one', () => {
  assert.deepEqual(Object.keys(STORE_GRAPHS).sort(), [...CARD_ORDER].sort(), 'the Store sells a graph that is not one of the 17');
  const hidden = new Set(['gifts', 'invites'] as const);
  assert.deepEqual(analyticsGraphs(null, { hidden }), DEFAULT_INSTALLED_GRAPHS.filter((k) => !hidden.has(k as never)));
  assert.deepEqual(analyticsGraphs(['slow', 'gifts', 'slow', 'nope', 'opened'], { hidden }), ['slow', 'opened']);
  assert.deepEqual(analyticsGraphs([], { hidden }), []);
});

const tile = (key: ShelfTile['key'], pct: number, next: string | null = 'Next goal: x — 3 to go'): ShelfTile =>
  ({ key, title: key, state: 'locked', pct, next }) as unknown as ShelfTile;

test('5 · badges: the chosen ones, any number, in the shop’s order; never chosen = the three closest', () => {
  assert.equal(DEFAULT_SHOP_BADGES, 3);
  assert.deepEqual(cleanBadgePicks(['invites', 'verified', 'invites', 'gifts_given', 'trusted_by', 'five_star_reviews']), ['invites', 'gifts_given', 'trusted_by', 'five_star_reviews']);
  const tiles = [tile('verified', 100, null), tile('completed_bookings', 10), tile('five_star_reviews', 80), tile('gifts_given', 60), tile('trusted_by', 90), tile('invites', 5)];
  assert.deepEqual(closestBadges(tiles), ['trusted_by', 'five_star_reviews', 'gifts_given']);
  assert.deepEqual(followedBadges(null, tiles), { keys: ['trusted_by', 'five_star_reviews', 'gifts_given'], pinned: false });
  assert.deepEqual(followedBadges(['invites'], tiles), { keys: ['invites'], pinned: true });
  // An empty choice is a choice: only the [+] shows (never silently refilled with the closest three).
  assert.deepEqual(followedBadges([], tiles), { keys: [], pinned: true });
});

test('6 · storage: an unread store is unread, never 0 of the plan', () => {
  assert.deepEqual(storageMeter('pro', { status: 'unread' }), { kind: 'unread' });
  assert.deepEqual(storageMeter('pro', null), { kind: 'unread' });
  const m = storageMeter('pro', { status: 'ok', bytes: 0 });
  assert.ok(m.kind === 'meter' || m.kind === 'no_limit');
  if (m.kind === 'meter') assert.equal(m.used, '0 MB');
});

test('7 · one layout: one column, one action op, every row add/remove/reorder through it', () => {
  // The column reads leniently: anything malformed = never arranged, never "nothing chosen".
  assert.deepEqual(readLayout(null), NO_LAYOUT);
  assert.deepEqual(readLayout('x'), NO_LAYOUT);
  assert.deepEqual(readLayout({ graphs: ['slow', 3], badges: [], tools_off: ['plan_3d'] }), { graphs: ['slow'], badges: [], tools: null, toolsOff: ['plan_3d'], qrs: null });
  // Cleaning: known keys of that row only, once each, in order.
  assert.deepEqual(cleanLayoutRow('graphs', ['slow', 'nope', 'slow', 'opened']), ['slow', 'opened']);
  assert.deepEqual(cleanLayoutRow('badges', ['verified', 'invites', 'trusted_by']), ['invites', 'trusted_by']);
  assert.deepEqual(cleanLayoutRow('tools', ['plan_3d', 'scanner', 'nope']), ['plan_3d', 'scanner']);
  // One row's save keeps the others.
  const before = { ...NO_LAYOUT, graphs: ['opened'], badges: ['invites'] };
  assert.deepEqual(withLayoutRow(before, 'badges', ['trusted_by', 'invites']), { ...before, badges: ['trusted_by', 'invites'] });
  // Tools: a paid tool taken off goes to tools_off; adding it back takes it out; a free one never enters tools_off.
  const off = withLayoutRow(NO_LAYOUT, 'tools', ['scanner'], ['plan_3d', 'headcount']);
  assert.deepEqual(off.toolsOff, ['plan_3d']);
  assert.deepEqual(withLayoutRow(off, 'tools', ['scanner', 'plan_3d']).toolsOff, []);
  assert.deepEqual(layoutColumn(off), { graphs: null, badges: null, tools: ['scanner'], tools_off: ['plan_3d'], qrs: null });
  // QR designs (v19 PR 2): known codes only; My page is built in — a save that leaves it out keeps it.
  assert.deepEqual(cleanLayoutRow('qrs', ['reviews', 'crew', 'page', 'reviews']), ['reviews', 'page']);
  assert.deepEqual(withLayoutRow(NO_LAYOUT, 'qrs', ['dates']).qrs, ['page', 'dates']);

  // The code: one column, written in one place, by one op.
  const action = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/shop/store/store-actions.ts'), 'utf8'));
  assert.equal((action.match(/store_layout/g) ?? []).length, 1, 'the layout must be written once, by op=layout');
  assert.equal((action.match(/^export async function/gm) ?? []).length, 1, 'the Store keeps ONE server action');
  assert.doesNotMatch(action, /'(graphs|graph_add|graph_remove|badge_follow|badge_unfollow|tool_add)'/, 'a per-row op came back');
  const mig = readdirSync(join(WEB, '../../supabase/migrations')).find((f) => f.endsWith('_supplier_store_tools_graphs_badges.sql'))!;
  const sql = readFileSync(join(WEB, '../../supabase/migrations', mig), 'utf8');
  assert.match(sql, /ADD COLUMN IF NOT EXISTS store_layout JSONB/);
  assert.doesNotMatch(sql.replace(/--.*$/gm, ''), /store_(graphs|badges|tools)\b/, 'three columns came back');
});

test('8 · tags: from the per-category table only, never typed; coverage labels alone never gate', () => {
  const labels = (k: string) => toolTags(storeToolOf(k)!).map((t) => t.label);
  assert.deepEqual(labels('scanner'), ['Every service']);
  assert.deepEqual(labels('cake_tool'), ['Cake']);
  for (const music of ['Live Band', 'Wedding Singer', 'DJ']) assert.ok(labels('song_bank').includes(music), music);
  // Every hub-key tool's tags are exactly the seed rows that carry one of its keys.
  for (const k of ['headcount', 'run_of_show', 'plan_3d', 'papic_challenge', 'live_watch']) {
    const tool = storeToolOf(k)!;
    assert.deepEqual(labels(k), HUB_TOOLS_SEED.filter((r) => tool.hubKeys.some((h) => r.tools.includes(h))).map((r) => r.category), k);
  }
  // An admin's switches replace that category's seed row.
  assert.ok(labels('headcount').includes('Catering'));
  assert.ok(!toolTags(storeToolOf('headcount')!, new Map([[nameKey('Catering'), ['serving_times']]])).some((t) => t.label === 'Catering'));
  // Never typed: no seed category name is a string in the Store's code.
  const code = stripComments(readFileSync(join(WEB, 'lib/supplier-store.ts'), 'utf8'));
  for (const r of HUB_TOOLS_SEED) assert.ok(!code.includes(`'${r.category}'`), `${r.category} is typed in supplier-store.ts`);
  // Coverage labels alone never gate (the card gate reads ONLINE cards, below): a cake shop with no card read sees every
  // tool, each in the same state as a shop with no categories.
  const plain = storeToolRows(facts());
  const cake = storeToolRows(facts({ categoryLabels: ['Cake'], services: ['cake'] }));
  assert.equal(cake.length, plain.length);
  for (const r of cake) assert.deepEqual(r.status, plain.find((p) => p.tool.key === r.tool.key)!.status, r.tool.key);
  // "For you" leads: the cake shop's Cake Maker is in it.
  const g = toolShelfGroups(cake);
  assert.ok(g.forYou.some((r) => r.tool.key === 'cake_tool'));
  assert.equal(g.forYou.length + g.yours.length + g.more.length, cake.length, 'a tool fell off the shelf');
});

test('3a2419fd · the card gate: hidden unless held, greyed when held, back by itself; shop-level always; a failed read gates nothing', () => {
  const keys = (f: ToolFacts) => storeToolRows(f).map((r) => r.tool.key);
  const row = (f: ToolFacts, k: string) => storeToolRows(f).find((r) => r.tool.key === k);
  // The join is the taxonomy's tile: a leaf card (photoman) meets the seed's Photo Booth row; Florist through florals.
  assert.equal(cardTileOf('photoman'), 'photo_booth');
  assert.equal(seedTileOf(HUB_TOOLS_SEED.find((r) => cardTileOf('photo_booth') === seedTileOf(r.category))!.category), 'photo_booth');
  assert.equal(cardTileOf('florals'), 'florist');
  // Not held + no card of its kind → hidden (not listed, not counted).
  const florist = facts({ cards: ['florals'] });
  assert.ok(!keys(florist).includes('cake_tool'), 'Cake Maker shows to a florist with no cake card');
  assert.ok(cardHiddenWidgets(florist).has('cake_tool'));
  const all = toolkitCounts({ papicCapture: false, badges: null }).widgets;
  assert.equal(toolkitCounts({ papicCapture: false, badges: null, hidden: cardHiddenWidgets(florist) }).widgets, all - cardHiddenWidgets(florist).size);
  // A cake card serves it.
  assert.ok(keys(facts({ cards: ['wedding_cake'] })).includes('cake_tool'));
  // Held (bought) + the card offline → shown greyed, still owned, the approved line; back online → open again.
  const bought = { owned: new Set(['cake_tool'] as const) };
  const off = row(facts({ ...bought, cards: ['florals'] }), 'cake_tool')!;
  assert.equal(off.status.kind, 'no_card');
  assert.ok(off.status.kind === 'no_card' && off.status.prior.kind === 'owned', 'nothing bought is lost');
  assert.equal(off.status.kind === 'no_card' ? noCardWords(off.status.category) : '', 'Turn on a Cake card to use it.');
  assert.equal(row(facts({ ...bought, cards: ['wedding_cake'] }), 'cake_tool')!.status.kind, 'owned');
  // An installed free widget greys and stays installed (on Your widgets).
  const freeWidget = storeToolRows(facts()).find((r) => r.status.kind === 'free' && !SHOP_LEVEL_WIDGETS.includes(r.tool.key) && r.tags.length > 0 && !storeToolRows(facts({ cards: [] })).some((x) => x.tool.key === r.tool.key))!;
  assert.ok(freeWidget, 'no free widget the card gate can hide');
  const installed = row(facts({ cards: [], picked: [freeWidget.tool.key] }), freeWidget.tool.key)!;
  assert.equal(installed.status.kind, 'no_card');
  assert.equal(installed.installed, true);
  assert.ok(yourTools(facts({ cards: [], picked: [freeWidget.tool.key] })).some((r) => r.tool.key === freeWidget.tool.key));
  // Shop-level: always shown, never greyed, with no card at all.
  for (const k of SHOP_LEVEL_WIDGETS) assert.notEqual(row(facts({ cards: [] }), k)?.status.kind ?? 'hidden', 'no_card', k);
  for (const k of SHOP_LEVEL_WIDGETS) assert.ok(keys(facts({ cards: [] })).includes(k), k);
  // A widget tagged with a seed category no card kind maps to stays shop-level (never guessed).
  const unmapped = new Set(unmappedSeedCategories());
  for (const r of storeToolRows(facts())) {
    if (r.tags.some((t) => unmapped.has(t.label))) assert.ok(keys(facts({ cards: [] })).includes(r.tool.key), `${r.tool.key} hidden on an unmapped category`);
  }
  // A failed card read hides nothing and greys nothing; absent = no gate.
  assert.deepEqual(storeToolRows(facts({ cards: null })).map((r) => [r.tool.key, r.status.kind]), storeToolRows(facts()).map((r) => [r.tool.key, r.status.kind]));
  assert.equal(cardHiddenWidgets(facts({ cards: null })).size, 0);
  // The one read is the shop's ACTIVE cards; the buy action refuses a widget no card serves.
  const server = stripComments(readFileSync(join(WEB, 'lib/supplier-store.server.ts'), 'utf8'));
  assert.match(server, /from\('vendor_services'\)\.select\('category'\)\.eq\('vendor_profile_id', vendorProfileId\)\.eq\('is_active', true\)/);
  const act = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/shop/store/store-actions.ts'), 'utf8'));
  assert.match(act, /toolRowFor\(tool, facts\)\?\.status/);
  // The dashboard count leaves the hidden out; /for-suppliers stays the whole catalogue.
  const screens = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/shop/store/_components/store-screens.tsx'), 'utf8'));
  assert.match(screens, /hidden: cardHiddenWidgets\(d\.tools\)/);
  const front = stripComments(readFileSync(join(WEB, 'app/for-suppliers/_components/supplier-front-page.tsx'), 'utf8'));
  assert.doesNotMatch(front, /cardHiddenWidgets|hidden:/);
});

test('5ae3fbb2 · the live count, from the ONE Toolkit list — unique items, gated ones out, a failed badge read shows nothing', () => {
  const on = { papicCapture: true, badges: SHOP_BADGE_KEYS };
  const off = { papicCapture: false, badges: SHOP_BADGE_KEYS };
  const c = toolkitCounts(off);
  assert.deepEqual(c, { widgets: SPECIALIZED_TOOLS.length - 1, qr: PROMOTE_QR_MODES.length, graphs: CARD_ORDER.length, badges: SHOP_BADGE_KEYS.length });
  assert.equal(toolkitCounts(on).widgets, SPECIALIZED_TOOLS.length, 'the Papic camera counts only while its switch is on');
  assert.equal(
    toolkitCountWords(c),
    `${SPECIALIZED_TOOLS.length - 1} widgets · ${PROMOTE_QR_MODES.length} QR designs · ${CARD_ORDER.length} graphs · ${SHOP_BADGE_KEYS.length} badges`,
  );
  assert.equal(toolkitCountWords(toolkitCounts({ papicCapture: false, badges: null })), `${SPECIALIZED_TOOLS.length - 1} widgets · ${PROMOTE_QR_MODES.length} QR designs · ${CARD_ORDER.length} graphs`, 'an unread badge count is left out, never 0');
  assert.equal(toolkitCountWords({ widgets: null, qr: null, graphs: null, badges: null }), null, 'nothing read = nothing shown');
  // ONE array: the count IS the list's length, by kind; every item once, however many shelves it sits on.
  const items = toolkitItems(on);
  assert.equal(items.length, Object.values(toolkitCounts(on)).reduce<number>((a, n) => a + (n ?? 0), 0));
  const ids = items.map((i) => `${i.kind}:${i.key}`);
  assert.equal(new Set(ids).size, ids.length, 'an item is listed twice');
  assert.equal(ids.filter((i) => i === 'widget:scanner').length, 1, 'Scanner is ONE item, never one per service');
  // Graphs read CARD_ORDER: a graph added there is counted the day it lands.
  assert.deepEqual(items.filter((i) => i.kind === 'graph').map((i) => i.key), [...CARD_ORDER]);
  // Both surfaces read the ONE function — never a typed number.
  const screens = readFileSync(join(WEB, 'app/vendor-dashboard/shop/store/_components/store-screens.tsx'), 'utf8');
  assert.match(screens, /toolkitCountWords\(toolkitCounts\(listFacts\(d\)\)\)/);
  assert.match(screens, /const items = toolkitItems\(listFacts\(d\)\);\n  const shelves = visibleShelves\(items\);/, 'the front does not draw its shelves from the one list');
  const front = readFileSync(join(WEB, 'app/for-suppliers/_components/supplier-front-page.tsx'), 'utf8');
  assert.match(front, /toolkitCountWords\(toolkitCounts\(\{ papicCapture, badges: SHOP_BADGE_KEYS \}\)\)/);
});

test('v19 PR 2 · a shelf with no real item is hidden: the three Forms shelves today; never a sample item', () => {
  const items = toolkitItems({ papicCapture: false, badges: SHOP_BADGE_KEYS });
  for (const f of ['chat_forms', 'card_forms', 'payment_plans'] as const) assert.deepEqual(shelfItems(items, f), [], `${f} lists an item`);
  assert.deepEqual(visibleShelves(items), ['chat', 'present', 'hub', 'shop_page', 'qr', 'graphs', 'badges']);
  // A failed badge read lists no badge: that shelf is hidden, and the screen says the read failed.
  assert.ok(!visibleShelves(toolkitItems({ papicCapture: false, badges: null })).includes('badges'));
  // Each widget shelf holds exactly the widgets that name it.
  for (const sh of ['chat', 'present', 'hub', 'shop_page'] as const) {
    assert.deepEqual(shelfItems(items, sh).map((i) => i.key), listedWidgets(false).filter((t) => t.shelves.includes(sh)).map((t) => t.key), sh);
  }
});

test('v19 PR 2 · QR designs: My page built in; removing one only takes it off Promote; a refused read hides nothing', () => {
  assert.deepEqual(installedQrs(null), [...PROMOTE_QR_MODES], 'never arranged = all four installed');
  assert.deepEqual(hiddenQrs(null), []);
  assert.deepEqual(hiddenQrs({ qrs: ['page', 'dates'] }), ['shortlist', 'reviews']);
  assert.ok(installedQrs({ qrs: [] }).includes('page'), 'My page was removed');
  assert.ok(isBuiltInQr('page') && !isBuiltInQr('dates'));
  const promote = readFileSync(join(WEB, 'app/vendor-dashboard/shop/promote/_components/promote-body.tsx'), 'utf8');
  assert.match(promote, /readStoreLayout\(supabase, profile\.vendor_profile_id\)\.then\(hiddenQrs\)/);
  const codes = readFileSync(join(WEB, 'app/vendor-dashboard/invite/_components/qr-codes.tsx'), 'utf8');
  assert.match(codes, /const rows = listed\.filter\(\(r\) => r\.key === 'page' \|\| !\(hide as readonly string\[\]\)\.includes\(r\.key\)\);/);
});

test('v19 PR 2 · the Papic camera is not listed while its switch is off — not on a shelf, not in Your widgets', () => {
  assert.ok(!storeToolRows(facts()).some((r) => r.tool.key === 'papic_camera'));
  assert.ok(storeToolRows(facts({ papicCapture: true })).some((r) => r.tool.key === 'papic_camera'));
  assert.ok(!yourTools(facts({ picked: ['scanner', 'papic_camera'] })).some((r) => r.tool.key === 'papic_camera'));
});

test('4c07edd7 · a paid widget’s clip sits at the top of its Toolkit page and draws nothing until it is recorded', () => {
  assert.deepEqual(Object.keys(TOOL_VIDEO_KEYS).sort(), [...PAID_STORE_TOOLS].sort(), 'one slot per paid widget');
  for (const k of PAID_STORE_TOOLS) assert.equal(toolVideoKey(k), null, `${k}: no clip is recorded yet`);
  assert.equal(toolVideoKey('scanner'), null, 'a free widget has no clip slot');
  const views = readFileSync(join(WEB, 'app/vendor-dashboard/shop/store/_components/store-views.tsx'), 'utf8');
  assert.match(views, /export function ToolVideo\(\{ src, title \}[^)]*\) \{\s*if \(!src\) return null;/, 'an empty path must render nothing');
  assert.match(views, /<video src=\{src\} autoPlay muted loop playsInline/);
  const screens = readFileSync(join(WEB, 'app/vendor-dashboard/shop/store/_components/store-screens.tsx'), 'utf8');
  const pin = screens.indexOf('<BackToShelf shelf="tools" />');
  const video = screens.indexOf('<ToolVideo src={toolVideoSrc(tool.key)}');
  const head = screens.indexOf('<Card data="tool-head">');
  assert.ok(pin > 0 && video > pin && head > video, 'the clip is the top of the widget page');
});

test('5920bbf4 · Toolkit v19: one word for the act — Install · Buy ₱… · ✓ Installed; never "Get"; Where it works opens in every state', () => {
  // Free, not on the page → Install; on the page → Installed; a built-in → Installed, built in (no Remove).
  const f = facts({ picked: ['headcount'] });
  assert.deepEqual(toolAct('song_desk', toolStatus('song_desk', f), false), { kind: 'install', owned: false });
  assert.deepEqual(toolAct('headcount', toolStatus('headcount', f), true), { kind: 'installed', builtIn: false });
  assert.deepEqual(toolAct('scanner', toolStatus('scanner', f), true), { kind: 'installed', builtIn: true });
  // Owned (bought or grandfathered) and on the page → Installed; taken off → Install (again, free).
  const held = facts({ owned: new Set(['plan_3d', 'song_bank']), toolsOff: ['song_bank'] });
  const s3d = toolStatus('plan_3d', held);
  const sSong = toolStatus('song_bank', held);
  assert.equal(toolIsInstalled('plan_3d', s3d, held), true);
  assert.equal(toolIsInstalled('song_bank', sSong, held), false);
  assert.deepEqual(toolAct('song_bank', sSong, false), { kind: 'install', owned: true });
  // Not bought → Buy with the catalog price; owned off-plan → resubscribe (no "Included" state anywhere).
  assert.deepEqual(toolAct('cake_tool', toolStatus('cake_tool', facts()), false), { kind: 'buy', price: 123, needsPlan: false });
  assert.deepEqual(toolAct('song_bank', toolStatus('song_bank', facts({ owned: new Set(['song_bank']), subscribed: false })), true), { kind: 'resubscribe' });
  assert.equal(buyWords(800, (n) => `₱${n}`), 'Buy ₱800');
  assert.deepEqual([INSTALL_WORD, INSTALLED_WORD], ['Install', 'Installed']);
  // Every row carries its installed fact and its act.
  for (const r of storeToolRows(held)) assert.deepEqual(r.act, toolAct(r.tool.key, r.status, r.installed), r.tool.key);
  // "Get" and "Included" are gone from the Toolkit's screens.
  for (const f2 of ['app/vendor-dashboard/shop/store/_components/store-views.tsx', 'app/vendor-dashboard/shop/store/_components/store-screens.tsx']) {
    const code = stripComments(readFileSync(join(WEB, f2), 'utf8'));
    assert.doesNotMatch(code, /label="Get(?: · Free)?"|<Pill>Get<\/Pill>|>Included</, `${f2} still says Get or Included`);
  }
  // Where it works: every widget has places, each with a real address, and "On its own" opens its tile on the Shop.
  for (const t of SPECIALIZED_TOOLS) {
    const places = widgetPlaces(t);
    assert.ok(places.length >= 2, t.key);
    for (const p of places) assert.match(p.href, /^\/vendor-dashboard\//, `${t.key} · ${p.place}`);
    assert.ok(places.some((p) => p.key === 'own' && p.href.includes(`tool=${encodeURIComponent(t.key)}`)), t.key);
  }
  assert.deepEqual(widgetPlaces(storeToolOf('cake_tool')!).map((p) => p.place), ['Chat', 'On its own']);
  const screens = readFileSync(join(WEB, 'app/vendor-dashboard/shop/store/_components/store-screens.tsx'), 'utf8');
  assert.match(screens, /data-store-place-open=\{p\.key\}>\s*Open/, 'a Where it works link must read Open, in every state');
});

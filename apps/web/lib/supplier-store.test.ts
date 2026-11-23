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
 *   8. Tags: read only from the per-category table (seed + admin switches) and `suggestedFor`'s own rules; never typed,
 *      never a gate — every shop sees and can get every tool.
 *
 * Sabotage (each seen red): type a number price into supplier-store.ts (1) · put `plan` after `pending` (2) · bring back a trial state (2) · let `addedFreeTools`
 * keep a paid key (3) · drop the hidden filter in `analyticsGraphs` (4) · cap `cleanBadgePicks` at three (5) · add a
 * `store_badges` write to the action (7) · type 'Cake' into supplier-store.ts, or hide an untagged tool (8).
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
  toolFootWords,
  toolIsYours,
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
} from './supplier-store';
import { HUB_TOOLS_SEED, nameKey } from './hub-tools';
import { CARD_ORDER, DEFAULT_INSTALLED_GRAPHS } from '@/app/vendor-dashboard/performance/_components/analytics-cards';
import type { ShelfTile } from './shop-badge-shelf';

const WEB = process.cwd();

const facts = (over: Partial<ToolFacts> = {}): ToolFacts => ({
  freeOpen: true,
  owned: new Set(),
  pending: new Set(),
  planOpen: { cake_tool: false, song_bank: false, papic_challenge: false, plan_3d: false },
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
  // Paid widgets do not ride the Verified fact: bought or in the plan.
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
  assert.deepEqual(toolStatus('cake_tool', facts()), { kind: 'buy', price: 123 });
  assert.equal(toolFootWords({ kind: 'no_price' }, String), 'Price not set yet');
  // A read that failed on the way to "open" never sells.
  assert.deepEqual(toolStatus('cake_tool', facts({ owned: null })), { kind: 'unread' });
  assert.deepEqual(toolStatus('cake_tool', facts({ prices: null })), { kind: 'unread' });
  assert.deepEqual(toolStatus('cake_tool', facts({ pending: null })), { kind: 'unread' });
});

test('2 · owned → plan → pending → price; no trial anywhere', () => {
  assert.deepEqual(toolStatus('song_bank', facts({ owned: new Set(['song_bank']), planOpen: { song_bank: true } })), { kind: 'owned' });
  assert.deepEqual(toolStatus('song_bank', facts({ planOpen: { song_bank: true } })), { kind: 'plan' });
  assert.deepEqual(toolStatus('plan_3d', facts({ pending: new Set(['plan_3d']) })), { kind: 'pending' });
  assert.deepEqual(toolStatus('plan_3d', facts()), { kind: 'buy', price: 123 }, 'a shop that has not bought it sees the price — no free days');
  // The trial is gone end to end (owner 23 Nov, "guides only").
  const code = ['lib/supplier-store.ts', 'lib/supplier-store.server.ts', 'app/vendor-dashboard/shop/store/store-actions.ts', 'app/vendor-dashboard/shop/_components/shop-makers.tsx', 'app/vendor-dashboard/shop/store/_components/store-views.tsx', 'app/vendor-dashboard/shop/store/_components/store-screens.tsx'];
  for (const f of code) assert.doesNotMatch(stripComments(readFileSync(join(WEB, f), 'utf8')), /Free trial|trialDays|trialEndsAt|kind: 'trial'|store_trial/, `${f} still carries the trial`);
  const mig = readdirSync(join(WEB, '../../supabase/migrations')).find((f) => f.endsWith('_supplier_store_tools_graphs_badges.sql'))!;
  const sql = readFileSync(join(WEB, '../../supabase/migrations', mig), 'utf8').replace(/--[^\n]*/g, '');
  assert.doesNotMatch(sql, /store_trial_ends_at|store_trial_on_verify|INTERVAL '30 days'/, 'the migration still stamps a trial');
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.vendor_store_tool_open[\s\S]{0,600}o\.status IN \('paid', 'fulfilled'\)\s*\);\s*\$\$;/, 'vendor_store_tool_open is no longer "bought once" only');
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
  assert.deepEqual(readLayout({ graphs: ['slow', 3], badges: [], tools_off: ['plan_3d'] }), { graphs: ['slow'], badges: [], tools: null, toolsOff: ['plan_3d'] });
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
  assert.deepEqual(layoutColumn(off), { graphs: null, badges: null, tools: ['scanner'], tools_off: ['plan_3d'] });

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

test('8 · tags: from the per-category table only, never typed, never a gate', () => {
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
  // Never a gate: a cake shop still sees every tool, each in the same state as a shop with no categories.
  const plain = storeToolRows(facts());
  const cake = storeToolRows(facts({ categoryLabels: ['Cake'], services: ['cake'] }));
  assert.equal(cake.length, plain.length);
  for (const r of cake) assert.deepEqual(r.status, plain.find((p) => p.tool.key === r.tool.key)!.status, r.tool.key);
  // "For you" leads: the cake shop's Cake Maker is in it.
  const g = toolShelfGroups(cake);
  assert.ok(g.forYou.some((r) => r.tool.key === 'cake_tool'));
  assert.equal(g.forYou.length + g.yours.length + g.more.length, cake.length, 'a tool fell off the shelf');
});

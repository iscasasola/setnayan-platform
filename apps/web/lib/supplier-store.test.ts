/**
 * 🛍 THE STORE'S RULES (owner 23 Nov 2026; drawing `supplier_store_graphs_badges_2026-11-23` v12; DECISION_LOG rows
 * 2026-11-23, specs 5a8c6bf3 → 46690f6d, 060467d5 · 14827167). Pure — `lib/supplier-store.ts`.
 *
 *   1. Money: four paid tools, each one catalog SKU (`vendor_tool_<key>`), seeded by the migration — the price is the
 *      row's, never typed in code. No price → "Price not set yet", never ₱0. A read that failed never sells.
 *   2. A paid tool: bought → Owned; the plan opens it → With your plan; the 30-day trial runs → "Free trial · N days left".
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
 * Sabotage (each seen red): type a number price into supplier-store.ts (1) · put `plan` after `trial` (2) · let `addedFreeTools`
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
  toolOfSku,
  cleanLayoutRow,
  layoutColumn,
  readLayout,
  storeToolOf,
  storeToolRows,
  toolShelfGroups,
  toolStatus,
  toolTags,
  trialDaysLeft,
  withLayoutRow,
  yourTools,
  type ToolFacts,
} from './supplier-store';
import { HUB_TOOLS_SEED, nameKey } from './hub-tools';
import { CARD_ORDER } from '@/app/vendor-dashboard/performance/_components/analytics-cards';
import type { ShelfTile } from './shop-badge-shelf';

const WEB = process.cwd();
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-23T12:00:00+08:00');

const facts = (over: Partial<ToolFacts> = {}): ToolFacts => ({
  owned: new Set(),
  pending: new Set(),
  trialEndsAt: null,
  planOpen: { cake_tool: false, song_bank: false, papic_challenge: false, plan_3d: false },
  prices: { cake_tool: 123, song_bank: 123, papic_challenge: 123, plan_3d: 123 },
  picked: null,
  toolsOff: [],
  categoryLabels: [],
  services: [],
  nowMs: NOW,
  ...over,
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
  assert.deepEqual(toolStatus('cake_tool', facts({ trialEndsAt: 'unread' })), { kind: 'unread' });
});

test('2 · owned → plan → trial → pending → price', () => {
  assert.deepEqual(toolStatus('song_bank', facts({ owned: new Set(['song_bank']), planOpen: { song_bank: true } })), { kind: 'owned' });
  assert.deepEqual(toolStatus('song_bank', facts({ planOpen: { song_bank: true }, trialEndsAt: new Date(NOW + 5 * DAY).toISOString() })), { kind: 'plan' });
  assert.deepEqual(toolStatus('plan_3d', facts({ trialEndsAt: new Date(NOW + 5 * DAY).toISOString() })), { kind: 'trial', daysLeft: 5 });
  assert.deepEqual(toolStatus('plan_3d', facts({ pending: new Set(['plan_3d']) })), { kind: 'pending' });
  assert.equal(toolFootWords({ kind: 'trial', daysLeft: 1 }, String), 'Free trial · 1 day left');
  assert.equal(trialDaysLeft(null, NOW), 0);
  assert.equal(trialDaysLeft(new Date(NOW - DAY).toISOString(), NOW), 0);
  assert.equal(trialDaysLeft(new Date(NOW + 30 * DAY).toISOString(), NOW), 30);
  assert.equal(trialDaysLeft('unread', NOW), null);
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
    ['plan_3d', 'headcount'],
  );
  assert.deepEqual(toolStatus('song_bank', held), { kind: 'owned' }, 'taking a tool off the page took it away');
  assert.deepEqual(
    yourTools(facts({ owned: new Set(['plan_3d', 'song_bank']), picked: ['headcount'] })).map((r) => r.tool.key),
    ['headcount', 'song_bank', 'plan_3d'],
  );
  // Never picked: Scanner + the tools suggested for the shop's services (no paid tool in that set).
  assert.ok(addedFreeTools(facts()).includes('scanner'));
  for (const k of addedFreeTools(facts())) assert.ok(!(PAID_STORE_TOOLS as readonly string[]).includes(k));
});

test('4 · graphs: the 17 shipped, once each, a shut one never shown; never picked = every open one', () => {
  assert.deepEqual(Object.keys(STORE_GRAPHS).sort(), [...CARD_ORDER].sort(), 'the Store sells a graph that is not one of the 17');
  const hidden = new Set(['gifts', 'invites'] as const);
  assert.deepEqual(analyticsGraphs(null, { hidden }), CARD_ORDER.filter((k) => !hidden.has(k as never)));
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

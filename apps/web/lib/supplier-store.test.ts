/**
 * 🛍 THE STORE'S RULES (owner 23 Nov 2026; drawing `supplier_store_graphs_badges_2026-11-23` v10; DECISION_LOG rows
 * 2026-11-23, specs 5a8c6bf3 → 46690f6d). Pure — `lib/supplier-store.ts`.
 *
 *   1. Money: four paid tools, each one catalog SKU (`vendor_tool_<key>`), seeded by the migration — the price is the
 *      row's, never typed in code. No price → "Price not set yet", never ₱0. A read that failed never sells.
 *   2. A paid tool: bought → Owned; the plan opens it → With your plan; the 30-day trial runs → "Free trial · N days left".
 *   3. Your tools: the free tools added, in the shop's order, then the paid ones it holds. Unknown or paid keys in the
 *      free list are dropped.
 *   4. Graphs: the 17 shipped graphs only, once each; a graph its badge has not opened is never shown; never picked =
 *      every open graph.
 *   5. Badges: up to three followed, in the shop's order; none followed = the three closest to their next step.
 *   6. Storage: an unread store is "unread", never 0 of the plan.
 *
 * Sabotage (each seen red): type a number price into supplier-store.ts (1) · put `plan` after `trial` (2) · let `addedFreeTools`
 * keep a paid key (3) · drop the hidden filter in `analyticsGraphs` (4) · let `cleanBadgePicks` keep four (5).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  MAX_FOLLOWED_BADGES,
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
  toolStatus,
  trialDaysLeft,
  yourTools,
  type ToolFacts,
} from './supplier-store';
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

test('5 · badges: three followed at most, in the shop’s order; none = the three closest', () => {
  assert.equal(MAX_FOLLOWED_BADGES, 3);
  assert.deepEqual(cleanBadgePicks(['invites', 'verified', 'invites', 'gifts_given', 'trusted_by', 'five_star_reviews']), ['invites', 'gifts_given', 'trusted_by']);
  const tiles = [tile('verified', 100, null), tile('completed_bookings', 10), tile('five_star_reviews', 80), tile('gifts_given', 60), tile('trusted_by', 90), tile('invites', 5)];
  assert.deepEqual(closestBadges(tiles), ['trusted_by', 'five_star_reviews', 'gifts_given']);
  assert.deepEqual(followedBadges(null, tiles), { keys: ['trusted_by', 'five_star_reviews', 'gifts_given'], pinned: false });
  assert.deepEqual(followedBadges(['invites'], tiles), { keys: ['invites'], pinned: true });
});

test('6 · storage: an unread store is unread, never 0 of the plan', () => {
  assert.deepEqual(storageMeter('pro', { status: 'unread' }), { kind: 'unread' });
  assert.deepEqual(storageMeter('pro', null), { kind: 'unread' });
  const m = storageMeter('pro', { status: 'ok', bytes: 0 });
  assert.ok(m.kind === 'meter' || m.kind === 'no_limit');
  if (m.kind === 'meter') assert.equal(m.used, '0 MB');
});

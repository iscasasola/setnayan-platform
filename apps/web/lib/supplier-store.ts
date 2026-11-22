/**
 * 🛍 THE SUPPLIER STORE — tools, graphs and badges for the shop, as words and states (owner 23 Nov 2026).
 *
 * ⚖ DECISION_LOG 2026-11-23 (specs 5a8c6bf3 · eb51e640 · d019ce12 · 1aaedb5e · 022681cf · 6be18189 · 6a7db142 · 85bcb51a ·
 *   46690f6d). Drawing: specs `prototypes/supplier_store_graphs_badges_2026-11-23/` v10 (F1 Store · F2 Tools shelf ·
 *   F3 item · F4/F5 Graphs shelf · F7/F8 graph item · F9 Badges shelf).
 *
 *   · THREE SHELVES — Specialized Tools · Graphs · Badges. A [+] tile on the Shop opens the Store at that shelf.
 *   · TOOLS: free forever = Scanner · Headcount · Run of show · Emcee script · Song Desk · Floor Command + March · Live
 *     Watch. Paid = Cake Maker · Song bank · Papic challenge · 3D plan, each ONE-TIME, owned forever (never re-locks).
 *     The price is the `vendor_billing_catalog` row `vendor_tool_<key>`, never typed here; a row with no usable price says
 *     "Price not set yet", never ₱0. 30 days free from the day the shop became Verified (tools only).
 *   · GRAPHS: all free. The shop picks which show on its Analytics and their order (`vendor_profiles.store_graphs`);
 *     a graph a badge opens says "Opens with <badge> · Bronze · N to go" until then (lib/graph-unlocks.ts decides).
 *   · BADGES: earned, never sold. Follow up to three on the Shop (`vendor_profiles.store_badges`); none followed = the
 *     three closest to done.
 *
 * PURE — no I/O, no clock (the caller passes `nowMs`). Reads: `lib/supplier-store.server.ts`. 🔒 lib/supplier-store.test.ts
 */
import { SPECIALIZED_TOOLS, specializedToolsFor, type SpecializedTool, type SpecializedToolKey } from './specialized-tools';
import { CARD_ORDER, FIXED_WINDOW, type CardKey } from '@/app/vendor-dashboard/performance/_components/analytics-cards';
import { BADGE_GRAPHS, BADGE_NAME, type GraphUnlocks, type UnlockBadge } from './graph-unlocks';
import { SHOP_BADGE_KEYS, type ShopBadgeKey } from './badge-tiers';
import type { ShelfTile } from './shop-badge-shelf';
import { storageWords } from './downgrade-limits';
import { storageAllowanceBytes } from './supplier-storage';
import { BADGE_WORDS } from '@/app/vendor-dashboard/shop/_components/badges/badge-page-model';

// ── THE SHELVES ─────────────────────────────────────────────────────────────

export const STORE_SHELVES = ['tools', 'graphs', 'badges'] as const;
export type StoreShelf = (typeof STORE_SHELVES)[number];

export const SHELF_TITLE: Readonly<Record<StoreShelf, string>> = {
  tools: 'Specialized Tools',
  graphs: 'Graphs',
  badges: 'Badges',
};

export function isStoreShelf(v: unknown): v is StoreShelf {
  return typeof v === 'string' && (STORE_SHELVES as readonly string[]).includes(v);
}

// ── TOOLS ───────────────────────────────────────────────────────────────────

/** The four paid tools (owner 23 Nov, specs 1aaedb5e): one-time each, owned forever. Every other tool is free forever. */
export const PAID_STORE_TOOLS = ['cake_tool', 'song_bank', 'papic_challenge', 'plan_3d'] as const satisfies readonly SpecializedToolKey[];
export type PaidStoreTool = (typeof PAID_STORE_TOOLS)[number];

export function isPaidStoreTool(k: string): k is PaidStoreTool {
  return (PAID_STORE_TOOLS as readonly string[]).includes(k);
}

/** The catalog row of a paid tool — the SQL twin is `vendor_store_tool_open` ('vendor_tool_' || p_tool). */
export function storeToolSku(k: PaidStoreTool): string {
  return `vendor_tool_${k}`;
}
export const STORE_TOOL_SKUS: readonly string[] = PAID_STORE_TOOLS.map(storeToolSku);

/** The tool a SKU sells, or null for any other SKU. */
export function toolOfSku(sku: string | null | undefined): PaidStoreTool | null {
  const k = typeof sku === 'string' && sku.startsWith('vendor_tool_') ? sku.slice('vendor_tool_'.length) : '';
  return isPaidStoreTool(k) ? k : null;
}

export function storeToolOf(key: string): SpecializedTool | null {
  return SPECIALIZED_TOOLS.find((t) => t.key === key) ?? null;
}

/** A catalog price as read: a peso number, `null` = the row has no usable price ("Price not set yet"). */
export type ToolPrice = number | null;

export type ToolFacts = {
  /** Paid tools the shop bought (an order paid or fulfilled). null = unread. */
  owned: ReadonlySet<PaidStoreTool> | null;
  /** Paid tools with an order in review (submitted). null = unread. */
  pending: ReadonlySet<PaidStoreTool> | null;
  /** The 30-day trial's end (ISO), null = never started, 'unread' = could not read. */
  trialEndsAt: string | null | 'unread';
  /** The plan (or the admin's open-to-all window) already opens this paid tool. Missing / null = unread. */
  planOpen: Partial<Record<PaidStoreTool, boolean | null>>;
  /** Each paid tool's catalog price. The whole map null = the catalog could not be read. */
  prices: Partial<Record<PaidStoreTool, ToolPrice>> | null;
  /** The free tools the shop added, in order (`vendor_profiles.store_tools`); null = never picked (the default set). */
  picked: readonly string[] | null;
  categoryLabels: readonly string[];
  services: readonly string[];
  nowMs: number;
};

export type ToolStatus =
  | { kind: 'owned' }
  | { kind: 'plan' }
  | { kind: 'trial'; daysLeft: number }
  | { kind: 'free'; added: boolean }
  | { kind: 'pending' }
  | { kind: 'buy'; price: number }
  | { kind: 'no_price' }
  | { kind: 'unread' };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days left in the trial, counting today (1 on its last day); 0 = over or never started; null = unread. */
export function trialDaysLeft(trialEndsAt: string | null | 'unread', nowMs: number): number | null {
  if (trialEndsAt === 'unread') return null;
  if (!trialEndsAt) return 0;
  const end = Date.parse(trialEndsAt);
  if (Number.isNaN(end) || end <= nowMs) return 0;
  return Math.max(1, Math.ceil((end - nowMs) / DAY_MS));
}

/** The free tools a shop that never picked gets: Scanner + the tools suggested for its services. */
export function defaultFreeTools(categoryLabels: readonly string[], services: readonly string[]): SpecializedToolKey[] {
  return specializedToolsFor(categoryLabels, services)
    .filter(({ tool, suggested }) => !isPaidStoreTool(tool.key) && (tool.key === 'scanner' || suggested))
    .map(({ tool }) => tool.key);
}

/** The free tools in Your tools, in the shop's order (unknown or paid keys in the column are dropped). */
export function addedFreeTools(f: Pick<ToolFacts, 'picked' | 'categoryLabels' | 'services'>): SpecializedToolKey[] {
  const raw = f.picked ?? defaultFreeTools(f.categoryLabels, f.services);
  const seen = new Set<string>();
  const out: SpecializedToolKey[] = [];
  for (const k of raw) {
    const t = storeToolOf(k);
    if (!t || isPaidStoreTool(t.key) || seen.has(t.key)) continue;
    seen.add(t.key);
    out.push(t.key);
  }
  return out;
}

/**
 * One tool's state. A paid tool: bought → owned; the plan opens it → plan; the trial runs → trial; an order in review →
 * pending; else the catalog price (or "Price not set yet"). A read that failed on the way to "open" never sells: a shop
 * we cannot tell about sees "Couldn't load", not a price.
 */
export function toolStatus(key: SpecializedToolKey, f: ToolFacts): ToolStatus {
  if (!isPaidStoreTool(key)) return { kind: 'free', added: addedFreeTools(f).includes(key) };
  if (f.owned?.has(key)) return { kind: 'owned' };
  if (f.planOpen[key] === true) return { kind: 'plan' };
  const days = trialDaysLeft(f.trialEndsAt, f.nowMs);
  if (days !== null && days > 0) return { kind: 'trial', daysLeft: days };
  if (f.owned === null || f.planOpen[key] == null || days === null || f.pending === null || f.prices === null) return { kind: 'unread' };
  if (f.pending.has(key)) return { kind: 'pending' };
  const price = f.prices[key];
  return typeof price === 'number' && Number.isFinite(price) && price > 0 ? { kind: 'buy', price } : { kind: 'no_price' };
}

/** Is the tool in the shop's hands right now (Your tools + Open)? */
export function toolIsYours(s: ToolStatus): boolean {
  return s.kind === 'owned' || s.kind === 'plan' || s.kind === 'trial' || (s.kind === 'free' && s.added);
}

export type StoreToolRow = { tool: SpecializedTool; status: ToolStatus; suggested: boolean };

/** Every tool, suggested first (Scanner leads), each with its state — the Tools shelf's order. */
export function storeToolRows(f: ToolFacts): StoreToolRow[] {
  return specializedToolsFor(f.categoryLabels, f.services).map(({ tool, suggested }) => ({ tool, suggested, status: toolStatus(tool.key, f) }));
}

/** Your tools on the Shop: the free tools in the shop's order, then the paid tools it holds (owned, plan, trial). */
export function yourTools(f: ToolFacts): StoreToolRow[] {
  const rows = storeToolRows(f);
  const byKey = new Map(rows.map((r) => [r.tool.key, r]));
  const free = addedFreeTools(f).map((k) => byKey.get(k)!).filter(Boolean);
  const paid = rows.filter((r) => isPaidStoreTool(r.tool.key) && toolIsYours(r.status));
  return [...free, ...paid];
}

/** The drawing's foot line for a tool tile/row. */
export function toolFootWords(s: ToolStatus, formatPrice: (php: number) => string): string {
  switch (s.kind) {
    case 'owned':
      return 'Owned';
    case 'plan':
      return 'With your plan';
    case 'trial':
      return `Free trial · ${s.daysLeft} ${s.daysLeft === 1 ? 'day' : 'days'} left`;
    case 'free':
      return 'Free';
    case 'pending':
      return 'Payment in review';
    case 'buy':
      return `${formatPrice(s.price)} · one-time`;
    case 'no_price':
      return 'Price not set yet';
    case 'unread':
      return 'Couldn’t load';
  }
}

// ── GRAPHS ──────────────────────────────────────────────────────────────────

/** The Graphs shelf's groups — the drawing's, in its order. */
export const GRAPH_GROUPS = [
  'Being found',
  'Inquiries and replies',
  'Quotes, bookings and money',
  'Your calendar',
  'What couples say',
  'Your market',
  'Opened by a badge',
] as const;
export type GraphGroup = (typeof GRAPH_GROUPS)[number];

/**
 * The 17 shipped graphs as the Store names them. Titles are the carousel's own (🔒 the test reads them from the carousel
 * source, so the two cannot drift); `asks` is the drawing's question; `counts` what one point is.
 */
export const STORE_GRAPHS: Readonly<Record<CardKey, { title: string; group: GraphGroup; asks: string; counts: string }>> = {
  opened: { title: 'Opened', group: 'Being found', asks: 'Are couples finding my page?', counts: 'Couples opening your page' },
  sources: { title: 'Where couples found you', group: 'Being found', asks: 'Which doors bring couples to me?', counts: 'Search, your link, a category, a share' },
  asked: { title: 'Asked', group: 'Inquiries and replies', asks: 'How many couples are asking?', counts: 'Inquiries, on the day they arrived' },
  reply: { title: 'How fast you answer', group: 'Inquiries and replies', asks: 'Am I answering fast enough?', counts: 'Minutes to your first reply' },
  replyvs: { title: 'Reply speed vs bookings', group: 'Inquiries and replies', asks: 'Does a fast reply win me the booking?', counts: 'Reply speed against the bookings it won' },
  booked: { title: 'Booked', group: 'Quotes, bookings and money', asks: 'How many bookings am I closing?', counts: 'Bookings confirmed' },
  cardsell: { title: 'Which card sells', group: 'Quotes, bookings and money', asks: 'Which service card earns its place?', counts: 'Each card: opened, asked about, booked' },
  quotes: { title: 'Quotes waiting', group: 'Quotes, bookings and money', asks: 'Which quotes need a nudge?', counts: 'Quotes sent and not yet answered' },
  split: { title: 'Setnayan vs your own book', group: 'Quotes, bookings and money', asks: 'How much of my work comes through Setnayan?', counts: 'Bookings, by where they came from' },
  calendar: { title: 'The next 13 weeks', group: 'Your calendar', asks: 'What is my next quarter like?', counts: 'Booked days, and days you were full' },
  lost: { title: 'Dates you lost', group: 'Your calendar', asks: 'Which days am I turning couples away?', counts: 'Dates couples asked for while you were full' },
  slow: { title: 'Slow months ahead', group: 'Your calendar', asks: 'Which months need a push?', counts: 'Bookings per month, ahead' },
  rep: { title: 'What couples say · your badges', group: 'What couples say', asks: 'How do couples rate me?', counts: 'Your reviews and your badges' },
  bench: { title: 'Compared with similar suppliers', group: 'Your market', asks: 'Where do I stand among shops like mine?', counts: 'Your place among shops like yours — never their numbers' },
  price: { title: 'Where your price sits', group: 'Your market', asks: 'Is my price low, middle or high for my area?', counts: 'Your starting price against your area’s' },
  gifts: { title: 'Gifts given → bookings', group: 'Opened by a badge', asks: 'Do my gifts turn into bookings?', counts: 'Couples who asked and booked, with and without a gift' },
  invites: { title: 'Suppliers you invited', group: 'Opened by a badge', asks: 'What became of the suppliers I brought in?', counts: 'Suppliers you invited: booked, completed an event' },
};

export function isGraphKey(v: unknown): v is CardKey {
  return typeof v === 'string' && (CARD_ORDER as readonly string[]).includes(v);
}

/** The window words a graph row shows ("30 days · 12 months" for the switchable ones). */
export function graphWindowWords(k: CardKey): string {
  return FIXED_WINDOW[k] ?? '30 days · 12 months';
}

/** The badge whose Bronze opens this graph, or null. */
export function graphBadge(k: CardKey): UnlockBadge | null {
  for (const b of SHOP_BADGE_KEYS) if (BADGE_GRAPHS[b].includes(k)) return b;
  return null;
}

export type GraphStatus =
  | { kind: 'on' }
  | { kind: 'off' }
  /** Shut until a badge's Bronze: "Opens with Gifts given · Bronze · 60 points to go" (toGo null = count unread). */
  | { kind: 'locked'; badge: UnlockBadge; badgeName: string; toGo: string | null };

/** Graphs on the shop's Analytics, in its order: its picks (open ones only), or every open graph in the shipped order. */
export function analyticsGraphs(picked: readonly string[] | null, unlocks: Pick<GraphUnlocks, 'hidden'>): CardKey[] {
  const open = (k: CardKey) => !unlocks.hidden.has(k);
  if (picked === null) return CARD_ORDER.filter(open);
  const seen = new Set<string>();
  const out: CardKey[] = [];
  for (const k of picked) {
    if (!isGraphKey(k) || seen.has(k) || !open(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

/** "60 to go" from a badge tile's goal line; null when the tile has no goal or is unread. */
export function toGoOf(tile: Pick<ShelfTile, 'next'> | null | undefined): string | null {
  return /— (.+ to go)$/.exec(tile?.next ?? '')?.[1] ?? null;
}

/** "60 points" — what is left, with the badge's own unit ("60 points to go" reads from it). Null = no goal / unread. */
export function leftWithUnit(tile: Pick<ShelfTile, 'key' | 'next'> | null | undefined): string | null {
  const left = /^([\d,]+) to go$/.exec(toGoOf(tile) ?? '')?.[1];
  if (!left || !tile || !isShopBadgeKey(tile.key)) return null;
  const n = Number(left.replace(/,/g, ''));
  return `${left} ${BADGE_WORDS[tile.key].unit(n)}`;
}

/** Each graph's state on the shelf. `tiles` = the badge tiles (for "N to go"); null when unread. */
export function graphStatus(k: CardKey, on: readonly CardKey[], unlocks: Pick<GraphUnlocks, 'hidden'>, tiles: readonly ShelfTile[] | null): GraphStatus {
  if (on.includes(k)) return { kind: 'on' };
  if (unlocks.hidden.has(k)) {
    const badge = graphBadge(k);
    if (badge) {
      const left = leftWithUnit(tiles?.find((t) => t.key === badge));
      return { kind: 'locked', badge, badgeName: BADGE_NAME[badge], toGo: left ? `${left} to go` : null };
    }
  }
  return { kind: 'off' };
}

/** The shelf's groups with their graphs NOT on the Analytics (the on-list is its own card). */
export function graphGroups(on: readonly CardKey[]): { group: GraphGroup; graphs: CardKey[] }[] {
  return GRAPH_GROUPS.map((group) => ({ group, graphs: CARD_ORDER.filter((k) => STORE_GRAPHS[k].group === group && !on.includes(k)) })).filter(
    (g) => g.graphs.length > 0,
  );
}

/** A graph order the shop sent, cleaned: known keys, once each, open ones only. */
export function cleanGraphPicks(raw: readonly unknown[], unlocks: Pick<GraphUnlocks, 'hidden'>): CardKey[] {
  return analyticsGraphs(raw.filter((x): x is string => typeof x === 'string'), unlocks);
}

// ── BADGES ──────────────────────────────────────────────────────────────────

/** At most three badges follow on the Shop (owner 23 Nov, specs 5a8c6bf3). */
export const MAX_FOLLOWED_BADGES = 3;

export function isShopBadgeKey(v: unknown): v is ShopBadgeKey {
  return typeof v === 'string' && (SHOP_BADGE_KEYS as readonly string[]).includes(v);
}

/** A badge list the shop sent, cleaned: known tiered badges, once each, at most three. */
export function cleanBadgePicks(raw: readonly unknown[]): ShopBadgeKey[] {
  const out: ShopBadgeKey[] = [];
  for (const k of raw) if (isShopBadgeKey(k) && !out.includes(k) && out.length < MAX_FOLLOWED_BADGES) out.push(k);
  return out;
}

/** The three closest to done — tiered badges still climbing, the highest percentage first; ties by the row's order. */
export function closestBadges(tiles: readonly ShelfTile[]): ShopBadgeKey[] {
  const tiered = tiles.filter((t): t is ShelfTile & { key: ShopBadgeKey } => t.key !== 'verified');
  const climbing = tiered.filter((t) => (t.state === 'earned' || t.state === 'locked') && t.next !== null);
  const rest = tiered.filter((t) => !climbing.includes(t));
  const order = new Map(SHOP_BADGE_KEYS.map((k, i) => [k, i]));
  climbing.sort((a, b) => b.pct - a.pct || order.get(a.key)! - order.get(b.key)!);
  return [...climbing, ...rest].slice(0, MAX_FOLLOWED_BADGES).map((t) => t.key);
}

/** The badges on the Shop: the followed ones (in the shop's order), or the three closest when none are followed. */
export function followedBadges(picked: readonly string[] | null, tiles: readonly ShelfTile[]): { keys: ShopBadgeKey[]; pinned: boolean } {
  const pins = picked ? cleanBadgePicks(picked) : [];
  return pins.length > 0 ? { keys: pins, pinned: true } : { keys: closestBadges(tiles), pinned: false };
}

/** The ring's two short lines on the Shop: "60 to go" · "Bronze next" (or the tier reached / the honest state). */
export function followLines(t: ShelfTile): { toGo: string; next: string } {
  const toGo = toGoOf(t);
  const nextTier = /^(.+?) at /.exec(t.nextShort ?? '')?.[1] ?? null;
  if (toGo && nextTier) return { toGo, next: `${nextTier} next` };
  return { toGo: t.sub, next: t.tierName ?? '' };
}

/** "920 reviews to Emerald" — the Badges shelf/page goal, from the tile's own goal; null at the top or unread. */
export function goalWords(t: ShelfTile): string | null {
  const left = leftWithUnit(t);
  const nextTier = /^(.+?) at /.exec(t.nextShort ?? '')?.[1] ?? null;
  return left && nextTier ? `${left} to ${nextTier}` : null;
}

/**
 * 💾 THE COVER'S STORAGE ROW (drawing v10, F0 + F15 "Storage"): "12 GB of 128 GB", the bar, and the plan chip that opens
 * the storage sheet. The number is the plan's (`storageAllowanceBytes` ← `TIER_CAPS`); what is stored is
 * `readStoredBytes`. Honest: an unread store is `unread` (the row says "Couldn’t load"), never "0 MB of …". A plan with no
 * allowance draws no bar ("No limit").
 */
export type StorageMeter =
  | { kind: 'meter'; used: string; total: string; pct: number; over: boolean }
  | { kind: 'no_limit'; used: string | null }
  | { kind: 'unread' };

export function storageMeter(plan: string | null | undefined, read: { status: 'ok'; bytes: number } | { status: 'unread' } | null): StorageMeter {
  if (!read || read.status !== 'ok') return { kind: 'unread' };
  const used = read.bytes <= 0 ? '0 MB' : storageWords(read.bytes);
  const allowance = storageAllowanceBytes(plan);
  if (allowance === null || allowance <= 0) return { kind: 'no_limit', used };
  const pct = Math.min(100, Math.max(0, (read.bytes / allowance) * 100));
  return { kind: 'meter', used, total: storageWords(allowance), pct: Math.round(pct * 10) / 10, over: read.bytes > allowance };
}

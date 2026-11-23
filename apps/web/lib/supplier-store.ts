/**
 * 🛍 THE SUPPLIER STORE — tools, graphs and badges for the shop, as words and states (owner 23 Nov 2026).
 *
 * ⚖ DECISION_LOG 2026-11-23 (specs 5a8c6bf3 · eb51e640 · d019ce12 · 1aaedb5e · 022681cf · 6be18189 · 6a7db142 · 85bcb51a ·
 *   46690f6d · 060467d5 · 14827167). Drawing: specs `prototypes/supplier_store_graphs_badges_2026-11-23/` v12 (Shop ·
 *   Edit per row · Store · Tools shelf with tags · item · Graphs shelf · graph item · Badges shelf · Badges page).
 *
 *   · THREE SHELVES — Specialized Tools · Graphs · Badges. A [+] tile on the Shop opens the Store at that shelf.
 *   · TOOLS: free forever = Scanner · Headcount · Run of show · Emcee script · Song Desk · Floor Command + March · Live
 *     Watch. Paid = Cake Maker · Song bank · Papic challenge · 3D plan, each ONE-TIME, owned forever (never re-locks).
 *     The price is the `vendor_billing_catalog` row `vendor_tool_<key>`, never typed here; a row with no usable price says
 *     "Price not set yet", never ₱0. No trial (owner 23 Nov, "guides only"). Free widgets open from Verified up
 *     (`freeWidgetsOpen`, shared with the day-of gate); before that a free widget says "Free once you’re Verified".
 *   · GRAPHS: all free. The shop picks which show on its Analytics and their order; a graph a badge opens says
 *     "Unlocks free when you earn the <badge> badge" until then (lib/graph-unlocks.ts decides). Never greyed on the Shop:
 *     a locked graph is simply not on the Analytics row. Never arranged = `DEFAULT_INSTALLED_GRAPHS` (explicit); a graph
 *     not in it is "New · Recommended" in the Toolkit until installed.
 *   · BADGES: earned, never sold. The Shop row shows the badges the shop chose, any number, in its order; never chosen
 *     = the three closest to done.
 *   · ONE LAYOUT for the three Shop rows (owner via the controller, 23 Nov): add ([+] → Store), remove (off the page
 *     only — a bought tool stays owned) and reorder, all in `vendor_profiles.store_layout`, written by one action op.
 *
 * PURE — no I/O, no clock. Reads: `lib/supplier-store.server.ts`. 🔒 lib/supplier-store.test.ts
 */
import { SPECIALIZED_TOOLS, specializedToolsFor, suggestedFor, type SpecializedTool, type SpecializedToolKey } from './specialized-tools';
import { HUB_TOOLS_SEED, nameKey } from './hub-tools';
import { isCakeKind } from './cake-maker';
import { isMusicToolCategory } from './songs';
import { CARD_ORDER, DEFAULT_INSTALLED_GRAPHS, FIXED_WINDOW, type CardKey } from '@/app/vendor-dashboard/performance/_components/analytics-cards';
import { BADGE_GRAPHS, BADGE_NAME, type GraphUnlocks, type UnlockBadge } from './graph-unlocks';
import { SHOP_BADGE_KEYS, type ShopBadgeKey } from './badge-tiers';
import type { ShelfTile } from './shop-badge-shelf';
import { storageWords } from './downgrade-limits';
import { storageAllowanceBytes } from './supplier-storage';
import { BADGE_WORDS } from '@/app/vendor-dashboard/shop/_components/badges/badge-page-model';
import { PAID_WIDGET_NEEDS_PLAN_WORDS, PAID_WIDGET_RESUBSCRIBE_WORDS } from './special-tools';
import { formatCount } from './format-number';
import { routes } from './routes';

// ── THE SHELVES ─────────────────────────────────────────────────────────────

export const STORE_SHELVES = ['tools', 'graphs', 'badges'] as const;
export type StoreShelf = (typeof STORE_SHELVES)[number];

export const SHELF_TITLE: Readonly<Record<StoreShelf, string>> = {
  tools: 'Widgets',
  graphs: 'Graphs',
  badges: 'Badges',
};

export function isStoreShelf(v: unknown): v is StoreShelf {
  return typeof v === 'string' && (STORE_SHELVES as readonly string[]).includes(v);
}

/**
 * 🔢 THE LIVE COUNT (DECISION_LOG 5ae3fbb2, owner 23 Nov): how many widgets, graphs and badges the Toolkit holds, read
 * from the ONE Toolkit list (`SPECIALIZED_TOOLS`, `CARD_ORDER`, the badge tiles) — never typed. The Toolkit masthead
 * and the /for-suppliers Toolkit section both read it. `badges: null` = the badge read failed: that part shows nothing.
 */
export type ToolkitCounts = Readonly<Record<StoreShelf, number | null>>;

export function toolkitCounts(badges: readonly unknown[] | null): ToolkitCounts {
  return { tools: SPECIALIZED_TOOLS.length, graphs: CARD_ORDER.length, badges: badges ? badges.length : null };
}

const SHELF_NOUN: Readonly<Record<StoreShelf, [string, string]>> = {
  tools: ['widget', 'widgets'],
  graphs: ['graph', 'graphs'],
  badges: ['badge', 'badges'],
};

/** "11 widgets · 29 graphs · 9 badges" — a shelf whose count is unread is left out; nothing read = null (show nothing). */
export function toolkitCountWords(c: ToolkitCounts): string | null {
  const parts = STORE_SHELVES.flatMap((k) => {
    const n = c[k];
    return n == null || !Number.isFinite(n) ? [] : [`${formatCount(n)} ${SHELF_NOUN[k][n === 1 ? 0 : 1]}`];
  });
  return parts.length ? parts.join(' · ') : null;
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
  /**
   * Do the FREE widgets open for this shop — Verified up (owner 23 Nov)? Computed with `freeWidgetsOpen`, the same rule
   * the day-of gate uses, so the Toolkit and the event day never disagree. null = unread.
   */
  freeOpen: boolean | null;
  /** Paid tools the shop bought (an order paid or fulfilled). null = unread. */
  owned: ReadonlySet<PaidStoreTool> | null;
  /** Paid tools with an order in review (submitted). null = unread. */
  pending: ReadonlySet<PaidStoreTool> | null;
  /**
   * SUBSCRIBED — the shop is on Plus, Pro or Ultra now (`vendor_pro_tools_included`). A paid widget opens only when
   * bought AND subscribed (owner a02673ac, 23 Nov); the plan alone opens nothing. null = unread.
   */
  subscribed: boolean | null;
  /** Each paid tool's catalog price. The whole map null = the catalog could not be read. */
  prices: Partial<Record<PaidStoreTool, ToolPrice>> | null;
  /** Your tools in the shop's order (`store_layout.tools`, free and paid keys); null = never arranged (the default set). */
  picked: readonly string[] | null;
  /** Paid tools the shop took off its page (`store_layout.tools_off`) — still owned, just not shown. */
  toolsOff: readonly string[];
  categoryLabels: readonly string[];
  services: readonly string[];
  /** An admin's saved hub tools per category (the tags' source beside the seed). Absent / empty = the seed alone. */
  hubOverrides?: HubOverrides;
};

// ── TOOL TAGS (owner via the controller, 23 Nov: "which supplier types it is for") ──────────────────────────
//
// Read ONLY from the one per-category table — `HUB_TOOLS_SEED` (lib/hub-tools.ts), with an admin's saved switches
// (`category_hub_settings` + `category_hub_tool_switches`) replacing a category's seed row — and the rules
// `suggestedFor` already uses for the three tools that have no hub key (Scanner: every service; Cake Maker: the cake
// kinds; Song bank: the music kinds). No category is typed here. A tag is a SUGGESTION, never a gate (2026-10-28):
// every shop can get every tool, whatever its tags say.

/** The categories an admin saved, by `nameKey(label)` → the hub tools switched on for it (replacing its seed row). */
export type HubOverrides = ReadonlyMap<string, readonly string[]>;

export type ToolTag = { label: string; group: string | null };

/** Scanner's one tag: it suits every shop. */
export const EVERY_SERVICE_TAG: ToolTag = { label: 'Every service', group: null };

/** A seed category's service kind, the way the kind keys are spelt ("Live Band" → live_band). */
const kindOf = (category: string) => nameKey(category).replace(/ /g, '_');

/** Which supplier types this tool is for, in the table's order. */
export function toolTags(tool: SpecializedTool, overrides: HubOverrides = new Map()): ToolTag[] {
  if (tool.key === 'scanner') return [EVERY_SERVICE_TAG];
  const fits = (category: string, tools: readonly string[]): boolean => {
    if (tool.key === 'cake_tool') return isCakeKind(kindOf(category));
    if (tool.key === 'song_bank') return isMusicToolCategory([kindOf(category)]);
    return tool.hubKeys.some((k) => tools.includes(k));
  };
  return HUB_TOOLS_SEED.filter((r) => fits(r.category, overrides.get(nameKey(r.category)) ?? r.tools)).map((r) => ({ label: r.category, group: r.group }));
}

/**
 * "For you": the tool is suggested for this shop (`suggestedFor`) or tagged with one of the shop's own categories.
 * Order only — never a gate.
 */
export function toolIsForYou(tool: SpecializedTool, tags: readonly ToolTag[], f: Pick<ToolFacts, 'categoryLabels' | 'services'>): boolean {
  if (suggestedFor(tool, f.categoryLabels, f.services)) return true;
  const mine = new Set(f.categoryLabels.map(nameKey));
  return tags.some((t) => mine.has(nameKey(t.label)));
}

/** The chip a group filters by (`data-store-show` takes space-free tokens). */
export function groupChipKey(group: string): string {
  return `g-${nameKey(group).replace(/ /g, '-')}`;
}

/** The chip row on the Tools shelf: All · For you · each seed group some tool is tagged with, in the table's order. */
export function toolChipGroups(tagsOf: (tool: SpecializedTool) => readonly ToolTag[]): string[] {
  const used = new Set(SPECIALIZED_TOOLS.flatMap((t) => tagsOf(t).map((x) => x.group)).filter((g): g is string => !!g));
  return [...new Set(HUB_TOOLS_SEED.map((r) => r.group))].filter((g) => used.has(g));
}

export type ToolStatus =
  /** Bought AND subscribed: open. */
  | { kind: 'owned' }
  /** Bought, but the shop is on Free or Verified: locked and kept — "Works again when you subscribe", the plans door, no second Buy. */
  | { kind: 'resubscribe' }
  | { kind: 'free'; added: boolean }
  /** A free widget, held back until the shop is Verified (owner 23 Nov: free widgets open from Verified up). */
  | { kind: 'verify' }
  | { kind: 'pending' }
  /** Not bought. `needsPlan`: on Free or Verified — the price and the notice show, and the button opens the plans door. */
  | { kind: 'buy'; price: number; needsPlan: boolean }
  | { kind: 'no_price' }
  | { kind: 'unread' };

/**
 * 🧷 BUILT-IN WIDGETS — always installed, never removed (owner, ruled earlier and restated 23 Nov via the controller:
 * "Built-in items (shop page QR, Scanner) are always installed and can't be removed"). Not held back by the Verified
 * rule either: a built-in is part of every shop. (The shop page QR lives on the Shop's cover, not in this row.)
 */
export const BUILT_IN_WIDGETS: readonly SpecializedToolKey[] = ['scanner'];
export function isBuiltInWidget(k: string): boolean {
  return (BUILT_IN_WIDGETS as readonly string[]).includes(k);
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
  // A built-in is always installed: first, unless the shop's own order already places it.
  const out: SpecializedToolKey[] = BUILT_IN_WIDGETS.filter((b) => !raw.includes(b));
  for (const b of out) seen.add(b);
  for (const k of raw) {
    const t = storeToolOf(k);
    if (!t || isPaidStoreTool(t.key) || seen.has(t.key)) continue;
    seen.add(t.key);
    out.push(t.key);
  }
  return out;
}

/**
 * One tool's state. A paid widget (owner a02673ac, 23 Nov: bought AND subscribed): bought + on Plus, Pro or Ultra →
 * owned; bought + on Free or Verified → resubscribe (locked, kept); an order in review → pending (no trial); else the
 * catalog price, with `needsPlan` when the shop is not subscribed (or "Price not set yet"). The SQL twin is
 * `vendor_store_tool_open`. A read that failed on the way to "open" never sells: "Couldn't load", not a price.
 */
export function toolStatus(key: SpecializedToolKey, f: ToolFacts): ToolStatus {
  if (!isPaidStoreTool(key)) {
    if (isBuiltInWidget(key)) return { kind: 'free', added: true };
    if (f.freeOpen === null) return { kind: 'unread' };
    if (f.freeOpen === false) return { kind: 'verify' };
    return { kind: 'free', added: addedFreeTools(f).includes(key) };
  }
  if (f.owned === null || f.subscribed === null) return { kind: 'unread' };
  if (f.owned.has(key)) return f.subscribed ? { kind: 'owned' } : { kind: 'resubscribe' };
  if (f.pending === null || f.prices === null) return { kind: 'unread' };
  if (f.pending.has(key)) return { kind: 'pending' };
  const price = f.prices[key];
  return typeof price === 'number' && Number.isFinite(price) && price > 0 ? { kind: 'buy', price, needsPlan: !f.subscribed } : { kind: 'no_price' };
}

/**
 * Is the tool the shop's (Your widgets)? An owned widget stays the shop's when it locks off-plan — nothing a shop
 * bought disappears; it reads "Works again when you subscribe" (`toolIsOpen` says whether it works right now).
 */
export function toolIsYours(s: ToolStatus): boolean {
  return s.kind === 'owned' || s.kind === 'resubscribe' || (s.kind === 'free' && s.added);
}

/**
 * A paid widget's lock, for a page outside the Toolkit (`LockNeed` kind `widget`): owned off-plan → resubscribe; not
 * bought → the price (null = not set) and whether the shop is subscribed (which door the button is). Open, pending or
 * unread → null (the page says that state itself).
 */
export function widgetLock(s: ToolStatus): { owned: boolean; subscribed: boolean; price: number | null } | null {
  if (s.kind === 'resubscribe') return { owned: true, subscribed: false, price: null };
  if (s.kind === 'buy') return { owned: false, subscribed: !s.needsPlan, price: s.price };
  if (s.kind === 'no_price') return { owned: false, subscribed: true, price: null };
  return null;
}

/** Does the tool work for the shop right now? */
export function toolIsOpen(s: ToolStatus): boolean {
  return s.kind === 'owned' || (s.kind === 'free' && s.added);
}

/**
 * 🧩 INSTALLED (Toolkit v19, DECISION_LOG 5920bbf4): is the widget on the shop's Your widgets now? Free: added (a
 * built-in always). Paid: held — bought, open or locked off-plan — and not taken off (`store_layout.tools_off`).
 */
export function toolIsInstalled(key: string, s: ToolStatus, f: Pick<ToolFacts, 'toolsOff'>): boolean {
  if (s.kind === 'free') return s.added;
  if (s.kind === 'owned' || s.kind === 'resubscribe') return !f.toolsOff.includes(key);
  return false;
}

/**
 * ONE WORD FOR THE ACT (Toolkit v19, controller call 5920bbf4): free, owned and grandfathered items not on the page read
 * "Install"; a paid item not bought reads "Buy ₱…" (the catalog price); an item on the page reads "✓ Installed". "Get" is
 * never used. An owned paid widget on Free or Verified stays `resubscribe` ("Works again when you subscribe").
 */
export type ToolAct =
  | { kind: 'installed'; builtIn: boolean }
  | { kind: 'install'; owned: boolean }
  | Exclude<ToolStatus, { kind: 'owned' } | { kind: 'free' }>;

export function toolAct(key: string, s: ToolStatus, installed: boolean): ToolAct {
  if (s.kind === 'owned' || s.kind === 'free') {
    return installed ? { kind: 'installed', builtIn: isBuiltInWidget(key) } : { kind: 'install', owned: s.kind === 'owned' };
  }
  return s;
}

export const INSTALL_WORD = 'Install';
export const INSTALLED_WORD = 'Installed';
/** "Buy ₱800" — the price is always the catalog's, formatted by the caller's `lib/php.ts` formatter. */
export const buyWords = (price: number, formatPrice: (php: number) => string) => `Buy ${formatPrice(price)}`;

/**
 * 📍 WHERE IT WORKS (Toolkit v19): each place a widget works, with an "Open" to that place's home — in every state,
 * installed or not. Read from the widget's own door; every address is a `lib/routes.ts` builder.
 */
export type WidgetPlace = { key: 'chat' | 'hub' | 'clients' | 'songs' | 'own'; place: string; line: string; href: string };

export function widgetPlaces(tool: SpecializedTool): WidgetPlace[] {
  const vd = routes.vendorDashboard;
  const own: WidgetPlace = { key: 'own', place: 'On its own', line: `Shop › Your widgets › ${tool.title}`, href: `${vd.shop.index()}?tool=${encodeURIComponent(tool.key)}#tools` };
  const hub: WidgetPlace = { key: 'hub', place: 'Event Hub', line: 'On each booked event’s day', href: vd.onTheDay() };
  if (tool.door.kind === 'cake_tool') {
    return [{ key: 'chat', place: 'Chat', line: 'Your client builds a cake from a card in your chat', href: vd.messages.index() }, { ...own, line: `${own.line}, where you set what you offer` }];
  }
  if (tool.door.kind === 'scanner') {
    return [{ ...hub, line: 'On the day, the Scanner view counts each guest you serve' }, { ...own, line: `${own.line}, where you set how a scan counts` }];
  }
  if (tool.door.kind === 'per_event') return [hub, own];
  if (tool.key === 'song_bank') return [{ key: 'songs', place: 'Your songs', line: 'The songs you play, kept for your shop page', href: vd.repertoire() }, own];
  // Papic challenge and the 3D plan work on a booked client's page.
  return [{ key: 'clients', place: 'Your clients', line: 'On a booked client’s page', href: vd.clients.index() }, own];
}

export type StoreToolRow = { tool: SpecializedTool; status: ToolStatus; installed: boolean; act: ToolAct; suggested: boolean; tags: ToolTag[]; forYou: boolean };

/** Every tool, suggested first (Scanner leads), each with its state and tags — the Tools shelf's order. */
export function storeToolRows(f: ToolFacts): StoreToolRow[] {
  return specializedToolsFor(f.categoryLabels, f.services).map(({ tool, suggested }) => {
    const tags = toolTags(tool, f.hubOverrides);
    const status = toolStatus(tool.key, f);
    const installed = toolIsInstalled(tool.key, status, f);
    return { tool, suggested, status, installed, act: toolAct(tool.key, status, installed), tags, forYou: toolIsForYou(tool, tags, f) };
  });
}

/** The Tools shelf's three groups (v12): For you first, then Yours, then More tools. */
export function toolShelfGroups(rows: readonly StoreToolRow[]): { forYou: StoreToolRow[]; yours: StoreToolRow[]; more: StoreToolRow[] } {
  const forYou = rows.filter((r) => r.forYou);
  const rest = rows.filter((r) => !r.forYou);
  return { forYou, yours: rest.filter((r) => toolIsYours(r.status)), more: rest.filter((r) => !toolIsYours(r.status)) };
}

/**
 * Your tools on the Shop, in the shop's order. Never arranged = the free tools added, then the paid ones it holds (owned,
 * or locked off-plan). Arranged = the shop's list (a paid key shows only while held); a paid tool held since and not taken off
 * joins at the end — a new buy lands last.
 */
export function yourTools(f: ToolFacts): StoreToolRow[] {
  const rows = storeToolRows(f);
  const byKey = new Map(rows.map((r) => [r.tool.key, r]));
  const held = rows.filter((r) => isPaidStoreTool(r.tool.key) && toolIsYours(r.status));
  if (f.picked === null) return [...addedFreeTools(f).map((k) => byKey.get(k)!).filter(Boolean), ...held];
  const seen = new Set<string>();
  // A built-in the saved order leaves out still leads the row (always installed).
  const out: StoreToolRow[] = BUILT_IN_WIDGETS.filter((b) => !f.picked!.includes(b)).flatMap((b) => {
    const r = byKey.get(b);
    if (r) seen.add(b);
    return r ? [r] : [];
  });
  for (const k of f.picked) {
    const r = byKey.get(k as SpecializedToolKey);
    if (!r || seen.has(r.tool.key)) continue;
    if (isPaidStoreTool(r.tool.key) && !toolIsYours(r.status)) continue;
    seen.add(r.tool.key);
    out.push(r);
  }
  for (const r of held) if (!seen.has(r.tool.key) && !f.toolsOff.includes(r.tool.key)) out.push(r);
  return out;
}

/** The drawing's foot line for a tool tile/row. */
export function toolFootWords(s: ToolStatus, formatPrice: (php: number) => string): string {
  switch (s.kind) {
    case 'owned':
      return 'Owned';
    case 'resubscribe':
      return PAID_WIDGET_RESUBSCRIBE_WORDS;
    case 'free':
      return 'Free';
    case 'verify':
      return 'Free once you’re Verified';
    case 'pending':
      return 'Payment in review';
    case 'buy':
      return s.needsPlan ? `${formatPrice(s.price)} · ${PAID_WIDGET_NEEDS_PLAN_WORDS}` : `${formatPrice(s.price)} · one-time`;
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
  /** Shut until a badge's Bronze: "Unlocks free when you earn the Gifts given badge" (toGo null = count unread). */
  | { kind: 'locked'; badge: UnlockBadge; badgeName: string; toGo: string | null };

/** The Toolkit's line for a badge-locked graph (owner 23 Nov) — the badge's name from the seal rows, never typed. */
export function graphLockedLine(badgeName: string): string {
  return `Unlocks free when you earn the ${badgeName} badge`;
}

/** A graph a shop never had by default — "New · Recommended" in the Toolkit until the shop installs it. */
export function isNewGraph(k: CardKey): boolean {
  return !DEFAULT_INSTALLED_GRAPHS.includes(k);
}

/**
 * Graphs on the shop's Analytics, in its order: its picks (open ones only), or — never arranged — the default installed
 * graphs (`DEFAULT_INSTALLED_GRAPHS`, an explicit list) that are open. A badge-locked graph is left out, never greyed.
 */
export function analyticsGraphs(picked: readonly string[] | null, unlocks: Pick<GraphUnlocks, 'hidden'>): CardKey[] {
  const open = (k: CardKey) => !unlocks.hidden.has(k);
  if (picked === null) return DEFAULT_INSTALLED_GRAPHS.filter(open);
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

/** How many badges a shop that never chose gets on its Shop: the three closest to done. Choosing has no cap (23 Nov). */
export const DEFAULT_SHOP_BADGES = 3;

export function isShopBadgeKey(v: unknown): v is ShopBadgeKey {
  return typeof v === 'string' && (SHOP_BADGE_KEYS as readonly string[]).includes(v);
}

/** A badge list the shop sent, cleaned: known tiered badges, once each, in its order. */
export function cleanBadgePicks(raw: readonly unknown[]): ShopBadgeKey[] {
  const out: ShopBadgeKey[] = [];
  for (const k of raw) if (isShopBadgeKey(k) && !out.includes(k)) out.push(k);
  return out;
}

/** The three closest to done — tiered badges still climbing, the highest percentage first; ties by the row's order. */
export function closestBadges(tiles: readonly ShelfTile[]): ShopBadgeKey[] {
  const tiered = tiles.filter((t): t is ShelfTile & { key: ShopBadgeKey } => t.key !== 'verified');
  const climbing = tiered.filter((t) => (t.state === 'earned' || t.state === 'locked') && t.next !== null);
  const rest = tiered.filter((t) => !climbing.includes(t));
  const order = new Map(SHOP_BADGE_KEYS.map((k, i) => [k, i]));
  climbing.sort((a, b) => b.pct - a.pct || order.get(a.key)! - order.get(b.key)!);
  return [...climbing, ...rest].slice(0, DEFAULT_SHOP_BADGES).map((t) => t.key);
}

/**
 * The badges on the Shop: the ones the shop chose, in its order (any number — an empty choice shows none, only the
 * [+]); never chosen (null) = the three closest to done.
 */
export function followedBadges(picked: readonly string[] | null, tiles: readonly ShelfTile[]): { keys: ShopBadgeKey[]; pinned: boolean } {
  return picked === null ? { keys: closestBadges(tiles), pinned: false } : { keys: cleanBadgePicks(picked), pinned: true };
}

// ── THE SHOP'S LAYOUT (one column for the three rows) ──────────────────────

export const LAYOUT_ROWS = ['graphs', 'badges', 'tools'] as const;
export type LayoutRow = (typeof LAYOUT_ROWS)[number];

export function isLayoutRow(v: unknown): v is LayoutRow {
  return typeof v === 'string' && (LAYOUT_ROWS as readonly string[]).includes(v);
}

/** `vendor_profiles.store_layout`, read. A row that is null was never arranged (its default is drawn). */
export type StoreLayout = { graphs: string[] | null; badges: string[] | null; tools: string[] | null; toolsOff: string[] };

export const NO_LAYOUT: StoreLayout = { graphs: null, badges: null, tools: null, toolsOff: [] };

/** The column's jsonb as the app reads it — anything malformed reads as never arranged, never as "nothing chosen". */
export function readLayout(raw: unknown): StoreLayout {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const list = (v: unknown): string[] | null => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null);
  return { graphs: list(o.graphs), badges: list(o.badges), tools: list(o.tools), toolsOff: list(o.tools_off) ?? [] };
}

/** At most this many keys in one row (the column's size check backs it). */
const MAX_ROW_KEYS = 40;

/** One row's list as the shop sent it, cleaned to known keys, once each, in its order. */
export function cleanLayoutRow(row: LayoutRow, raw: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const k of raw) {
    if (typeof k !== 'string' || out.includes(k) || out.length >= MAX_ROW_KEYS) continue;
    const known = row === 'graphs' ? isGraphKey(k) : row === 'badges' ? isShopBadgeKey(k) : storeToolOf(k) !== null;
    if (known) out.push(k);
  }
  return out;
}

/**
 * The layout after one row is set: its new order, and (tools) the paid tools taken off — a removed paid tool goes into
 * `tools_off` so a later purchase elsewhere never puts it back by itself; adding it again takes it out.
 */
export function withLayoutRow(prev: StoreLayout, row: LayoutRow, sent: readonly string[], off: readonly string[] = []): StoreLayout {
  if (row !== 'tools') return { ...prev, [row]: [...sent] };
  // A built-in is never removed: a save that leaves it out keeps it, first.
  const keys = [...BUILT_IN_WIDGETS.filter((b) => !sent.includes(b)), ...sent];
  const removed = off.filter((k) => isPaidStoreTool(k) && !keys.includes(k));
  const toolsOff = [...new Set([...prev.toolsOff.filter((k) => !keys.includes(k)), ...removed])];
  return { ...prev, tools: [...keys], toolsOff };
}

/** The layout as the column stores it. */
export function layoutColumn(l: StoreLayout): { graphs: string[] | null; badges: string[] | null; tools: string[] | null; tools_off: string[] } {
  return { graphs: l.graphs, badges: l.badges, tools: l.tools, tools_off: l.toolsOff };
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

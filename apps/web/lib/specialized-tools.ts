/**
 * 🧰 SHOP › MAKERS › SPECIALIZED TOOLS — the carousel's tiles (Build 3 Lane E item 13; DECISION_LOG 2026-11-09
 * ✅🏪 "LANE E PROTOTYPE v3 APPROVED — EVERY TOOL TILE OPEN, SUGGESTED FIRST" and ✅🧰 "THE SCANNER MOVES INTO SPECIALIZED
 * TOOLS").
 *
 * DOORS ONLY. Every tile opens a page that ALREADY ships — this file adds no tool, no price, no SKU and no lock (Build 4
 * owns those: `lib/entitlements.ts`, `lib/sku-activation.ts`, `vendor_billing_catalog`). Owner, 9 Nov:
 *   · *"This means our scanner will live inside the specialized tools."* → Scanner is the FIRST tile (the shipped
 *     `ServiceScannerPick` body, one line per service).
 *   · Song bank → its main page (`/vendor-dashboard/repertoire`); also a Portfolio section (music shops).
 *   · Song Desk · Emcee script · Floor Command + March · Run of show · Headcount · Live Watch → their per-event homes on
 *     the day (`/vendor-dashboard/on-the-day/live/<event>`); a shop with no booked event is told "Runs on your booked
 *     events" — never a dead door.
 *   · Papic challenge · 3D plan → their shipped pages and CURRENT purchase flow (Your plan's cards) — pricing unchanged.
 *   · Moodboard library is a Portfolio section, not a tile. Manpower gigs gets NO door (owner: "lets not deal with this
 *     first"). NO "Make your own" tile until the Tools Maker exists — a tile with no door is not drawn.
 *   · EVERY tile is open to EVERY shop (the 2026-10-28 rule: "available to all services" — category = suggested, never a
 *     gate). The shop's own categories only decide the ORDER: suggested first.
 * The "suggested" reading comes from the one per-category tool table (`lib/hub-tools.ts` HUB_TOOLS_SEED) — never a
 * category list typed here.
 * 🔒 lib/specialized-tools.test.ts
 */
import { HUB_TOOLS_SEED, nameKey } from '@/lib/hub-tools';
import { isMusicToolCategory } from '@/lib/songs';
import { isCakeKind } from '@/lib/cake-maker';
import { isGownKind } from '@/lib/gown-maker';

export type SpecializedToolKey =
  | 'scanner'
  | 'cake_tool'
  | 'gown_tool'
  | 'song_bank'
  | 'song_desk'
  | 'emcee_script'
  | 'floor_command'
  | 'run_of_show'
  | 'headcount'
  | 'live_watch'
  | 'papic_challenge'
  | 'plan_3d'
  | 'spaces'
  // 🧭 Finished features (owner 23 Nov, "Yes, include them"; controller GO): shipped day-of screens, listed so the
  // Toolkit shows them. Each opens its shipped home; nothing about them is re-coded here.
  | 'shot_list'
  | 'issues_log'
  | 'production_sheet'
  | 'live_reviews'
  | 'handover'
  | 'seat_plan'
  | 'papic_camera';

/**
 * The Toolkit v19 widget shelves (drawing `supplier_store_graphs_badges_2026-11-23` v19, DECISION_LOG 5920bbf4): where
 * a widget is used — Chat · Present (live, in person with a client) · Event Hub (on the day) · Shop page. A widget can
 * sit on more than one; it is still ONE item (counted once).
 */
export const WIDGET_SHELVES = ['chat', 'present', 'hub', 'shop_page'] as const;
export type WidgetShelf = (typeof WIDGET_SHELVES)[number];

export type SpecializedTool = {
  key: SpecializedToolKey;
  title: string;
  /** What it is, in one line (the tile's second line). */
  line: string;
  /**
   * Where the tile goes:
   *   scanner   → the Scanner lines, drawn in the panel (no page of its own)
   *   page      → one shipped page
   *   per_event → the event's on-the-day screen, one door per booked event
   *   cake_tool → the shop's Cake Maker options, edited in the panel (set once per shop)
   *   gown_tool → the Gown Maker itself (its own page; its setup is the tool's own Settings) — the tile OPENS THE TOOL,
   *               and its panel holds Open + Share a design (Customers › QR codes › Gown design)
   *   day_console → the On the day console (`/vendor-dashboard/on-the-day`), where each booking's day-of parts sit
   *   client_page → a page of one booked client (`/vendor-dashboard/clients/<event>/<page>`), one door per booked event
   */
  door:
    | { kind: 'scanner' }
    | { kind: 'cake_tool' }
    | { kind: 'gown_tool' }
    | { kind: 'page'; href: string }
    | { kind: 'per_event' }
    | { kind: 'day_console' }
    | { kind: 'client_page'; page: 'detail' | 'productionSheet' | 'seatPlan' };
  /** The `HUB_TOOL_LIBRARY` keys that make a category "suggested" for this tile (empty = see `suggestedFor`). */
  hubKeys: readonly string[];
  /** The Toolkit shelves it sits on (v19). */
  shelves: readonly WidgetShelf[];
  /**
   * Listed only while a switch is on: `papic_capture` = the counsel-gated Papic capture (`isVendorPapicCaptureEnabled`,
   * the same check the on-the-day page makes). Off = not in the Toolkit at all, never a locked promise.
   */
  gate?: 'papic_capture';
};

/** The on-the-day screen of one booked event — every per-event tool lives there. */
export const onTheDayHref = (eventId: string) => `/vendor-dashboard/on-the-day/live/${eventId}`;

export const SPECIALIZED_TOOLS: readonly SpecializedTool[] = [
  { key: 'scanner', title: 'Scanner', line: 'One per service · how each scan counts', door: { kind: 'scanner' }, hubKeys: [], shelves: ['hub'] },
  // 🎂 DECISION_LOG 2026-11-21 "CAKE MAKER v6 = THE BUILD REFERENCE": options set ONCE per shop here; couples design in the chat.
  { key: 'cake_tool', title: 'Cake Maker', line: 'Couples design their cake in your chat', door: { kind: 'cake_tool' }, hubKeys: [], shelves: ['chat', 'present'] },
  // 👗 Owner 26 Nov 2026: the Gown Maker's icon opens the tool directly ("people launch it far more than they set it
  // up"); its quotations, fabrics, inspirations and pricing are the tool's own Settings, seen only by the supplier.
  // A design is shared as a QR (Shortlist or Booked) and lands as a card in the couple's chat (lib/gown-maker.ts).
  { key: 'gown_tool', title: 'Gown Maker', line: 'Design gowns in 3D, then share one as a QR', door: { kind: 'gown_tool' }, hubKeys: [], shelves: ['chat', 'present'] },
  { key: 'song_bank', title: 'Song bank', line: 'The songs you play; couples request and preview', door: { kind: 'page', href: '/vendor-dashboard/repertoire' }, hubKeys: [], shelves: ['chat', 'present', 'shop_page'] },
  { key: 'song_desk', title: 'Song Desk', line: 'Requests on the day', door: { kind: 'per_event' }, hubKeys: ['song_desk'], shelves: ['hub'] },
  { key: 'emcee_script', title: 'Emcee script', line: 'The host’s lines, live', door: { kind: 'per_event' }, hubKeys: ['emcee_script'], shelves: ['chat', 'hub'] },
  { key: 'floor_command', title: 'Floor Command + March', line: 'Cue the room and the march', door: { kind: 'per_event' }, hubKeys: ['floor_command', 'march'], shelves: ['hub'] },
  { key: 'run_of_show', title: 'Run of show', line: 'Now · Next · Coming, with a countdown', door: { kind: 'per_event' }, hubKeys: ['run_of_show'], shelves: ['chat', 'hub'] },
  { key: 'headcount', title: 'Headcount', line: 'Who is coming, from the RSVPs', door: { kind: 'per_event' }, hubKeys: ['headcount'], shelves: ['hub'] },
  { key: 'live_watch', title: 'Live Watch', line: 'The day’s live feed', door: { kind: 'per_event' }, hubKeys: ['live_watch'], shelves: ['hub'] },
  { key: 'papic_challenge', title: 'Papic challenge', line: 'Photo games for the guests', door: { kind: 'page', href: '/vendor-dashboard/subscription' }, hubKeys: ['papic_camera'], shelves: ['hub'] },
  { key: 'plan_3d', title: '3D plan', line: 'Your booth inside the couple’s 3D plan', door: { kind: 'page', href: '/vendor-dashboard/subscription' }, hubKeys: ['floor_plan', 'tables_and_seating', 'floor_command'], shelves: ['chat', 'present', 'shop_page'] },
  // 🏛 Owner 19 Nov ("SHOP PAGE FINAL + SPACES COMBINED WITH ROOMS & SEATING"): Spaces is a tool inside Specialized tools,
  // AFTER Scanner — halls, rooms and what the shop rents out, set once. It replaces 18 Nov's "Rooms & seating" tile and
  // page, and fills the `floor_plan` + `tables_and_seating` hub keys. Shown only once the shop has a space (the page's
  // `spacesCount`); the first is added from a card's Uses pick.
  { key: 'spaces', title: 'Spaces', line: 'Rooms · clothing · objects you rent out', door: { kind: 'page', href: '/vendor-dashboard/spaces' }, hubKeys: ['floor_plan', 'tables_and_seating'], shelves: ['present', 'hub'] },
  // ── Finished features (owner 23 Nov "Yes, include them"): each is a shipped screen, opened where it already lives. ──
  // on-the-day/page.tsx ShotListSection · shot-list-actions.ts (event_shot_list_items)
  { key: 'shot_list', title: 'Shot list', line: 'Your must-get shots, checked off as you shoot', door: { kind: 'day_console' }, hubKeys: ['shot_list'], shelves: ['hub'] },
  // on-the-day/_components/issues-log.tsx (the coordinator's day-of log)
  { key: 'issues_log', title: 'Issues log', line: 'Log anything that comes up on the floor', door: { kind: 'day_console' }, hubKeys: ['incident_log'], shelves: ['hub'] },
  // clients/[eventId]/production-sheet (food services; its RPC holds the same gate as the Brief's dietary part)
  { key: 'production_sheet', title: 'Production sheet', line: 'Per-part pax and your portion math', door: { kind: 'client_page', page: 'productionSheet' }, hubKeys: [], shelves: ['hub'] },
  // on-the-day/live/[eventId] LiveReviews
  { key: 'live_reviews', title: 'Live reviews', line: 'Your reviews as they land, private to you', door: { kind: 'per_event' }, hubKeys: [], shelves: ['hub'] },
  // clients/[eventId] "Your handovers" (vendorPostHandover: Album link · Sample / proof · Note · All delivered) → the
  // couple's "I received it" (chat handover-card.tsx); progress on the On the day console (booking_handovers)
  { key: 'handover', title: 'Hand over to the couple', line: 'Mark your deliverable done and let the couple acknowledge it', door: { kind: 'client_page', page: 'detail' }, hubKeys: [], shelves: ['hub'] },
  // clients/[eventId]/seat-plan (read-only: the published floor plan with seated COUNTS; names never cross)
  { key: 'seat_plan', title: 'Seat plan', line: 'The couple’s published floor plan, with each table’s count', door: { kind: 'client_page', page: 'seatPlan' }, hubKeys: ['tables_and_seating'], shelves: ['hub'] },
  // on-the-day/live/[eventId]/papic — counsel-gated (vendor-dayof-flags.ts)
  { key: 'papic_camera', title: 'Papic camera', line: 'Shoot photos and clips of the event you’re working', door: { kind: 'per_event' }, hubKeys: ['papic_camera'], shelves: ['hub'], gate: 'papic_capture' },
];

/** The hub tools each of the shop's categories gets, from the one table (labels matched the table's own way). */
function hubToolsOf(categoryLabels: readonly string[]): Set<string> {
  const out = new Set<string>();
  const want = new Set(categoryLabels.map(nameKey));
  for (const row of HUB_TOOLS_SEED) if (want.has(nameKey(row.category))) row.tools.forEach((t) => out.add(t));
  return out;
}

/** Is this tile suggested for the shop? Scanner: every shop with a service. Song bank: music shops. Cake Maker: cake shops. Gown Maker: attire shops. Else the table. */
export function suggestedFor(tool: SpecializedTool, categoryLabels: readonly string[], services: readonly string[]): boolean {
  if (tool.key === 'scanner') return categoryLabels.length > 0;
  if (tool.key === 'song_bank') return isMusicToolCategory(services);
  if (tool.key === 'cake_tool') return services.some(isCakeKind);
  if (tool.key === 'gown_tool') return services.some(isGownKind);
  const have = hubToolsOf(categoryLabels);
  return tool.hubKeys.some((k) => have.has(k));
}

/**
 * The carousel, in order: Scanner FIRST (owner 9 Nov), then the tiles suggested by the shop's categories, then every
 * other tile — all open, none greyed. Stable within each group (the table's order).
 */
export function specializedToolsFor(categoryLabels: readonly string[], services: readonly string[]): { tool: SpecializedTool; suggested: boolean }[] {
  const all = SPECIALIZED_TOOLS.map((tool, i) => ({ tool, i, suggested: suggestedFor(tool, categoryLabels, services) }));
  all.sort((a, b) => {
    if (a.tool.key === 'scanner') return -1;
    if (b.tool.key === 'scanner') return 1;
    // Spaces sits right after Scanner (owner 19 Nov, Shop final pick 2: "Specialized tools (Spaces inside, after Scanner)").
    if (a.tool.key === 'spaces') return -1;
    if (b.tool.key === 'spaces') return 1;
    if (a.suggested !== b.suggested) return a.suggested ? -1 : 1;
    return a.i - b.i;
  });
  return all.map(({ tool, suggested }) => ({ tool, suggested }));
}

/** The widgets the Toolkit lists right now: every one, less a gated one whose switch is off (`gate`). */
export function listedWidgets(papicCapture: boolean): readonly SpecializedTool[] {
  return SPECIALIZED_TOOLS.filter((t) => t.gate !== 'papic_capture' || papicCapture);
}

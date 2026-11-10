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

export type SpecializedToolKey =
  | 'scanner'
  | 'song_bank'
  | 'song_desk'
  | 'emcee_script'
  | 'floor_command'
  | 'run_of_show'
  | 'headcount'
  | 'live_watch'
  | 'papic_challenge'
  | 'plan_3d';

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
   */
  door: { kind: 'scanner' } | { kind: 'page'; href: string } | { kind: 'per_event' };
  /** The `HUB_TOOL_LIBRARY` keys that make a category "suggested" for this tile (empty = see `suggestedFor`). */
  hubKeys: readonly string[];
};

/** The on-the-day screen of one booked event — every per-event tool lives there. */
export const onTheDayHref = (eventId: string) => `/vendor-dashboard/on-the-day/live/${eventId}`;

export const SPECIALIZED_TOOLS: readonly SpecializedTool[] = [
  { key: 'scanner', title: 'Scanner', line: 'One per service · how each scan counts', door: { kind: 'scanner' }, hubKeys: [] },
  { key: 'song_bank', title: 'Song bank', line: 'The songs you play; couples request and preview', door: { kind: 'page', href: '/vendor-dashboard/repertoire' }, hubKeys: [] },
  { key: 'song_desk', title: 'Song Desk', line: 'Requests on the day', door: { kind: 'per_event' }, hubKeys: ['song_desk'] },
  { key: 'emcee_script', title: 'Emcee script', line: 'The host’s lines, live', door: { kind: 'per_event' }, hubKeys: ['emcee_script'] },
  { key: 'floor_command', title: 'Floor Command + March', line: 'Cue the room and the march', door: { kind: 'per_event' }, hubKeys: ['floor_command', 'march'] },
  { key: 'run_of_show', title: 'Run of show', line: 'Now · Next · Coming, with a countdown', door: { kind: 'per_event' }, hubKeys: ['run_of_show'] },
  { key: 'headcount', title: 'Headcount', line: 'Who is coming, from the RSVPs', door: { kind: 'per_event' }, hubKeys: ['headcount'] },
  { key: 'live_watch', title: 'Live Watch', line: 'The day’s live feed', door: { kind: 'per_event' }, hubKeys: ['live_watch'] },
  { key: 'papic_challenge', title: 'Papic challenge', line: 'Photo games for the guests', door: { kind: 'page', href: '/vendor-dashboard/subscription#papic-challenge' }, hubKeys: ['papic_camera'] },
  { key: 'plan_3d', title: '3D plan', line: 'Your booth inside the couple’s 3D plan', door: { kind: 'page', href: '/vendor-dashboard/subscription#booth-addon' }, hubKeys: ['floor_plan', 'tables_and_seating', 'floor_command'] },
];

/** The hub tools each of the shop's categories gets, from the one table (labels matched the table's own way). */
function hubToolsOf(categoryLabels: readonly string[]): Set<string> {
  const out = new Set<string>();
  const want = new Set(categoryLabels.map(nameKey));
  for (const row of HUB_TOOLS_SEED) if (want.has(nameKey(row.category))) row.tools.forEach((t) => out.add(t));
  return out;
}

/** Is this tile suggested for the shop? Scanner: every shop with a service. Song bank: music shops. Else the table. */
export function suggestedFor(tool: SpecializedTool, categoryLabels: readonly string[], services: readonly string[]): boolean {
  if (tool.key === 'scanner') return categoryLabels.length > 0;
  if (tool.key === 'song_bank') return isMusicToolCategory(services);
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
    if (a.suggested !== b.suggested) return a.suggested ? -1 : 1;
    return a.i - b.i;
  });
  return all.map(({ tool, suggested }) => ({ tool, suggested }));
}

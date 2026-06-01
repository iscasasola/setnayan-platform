import type { SupabaseClient } from '@supabase/supabase-js';
import type { EventTableRow, TableType } from '@/lib/seating';

/**
 * apps/web/lib/indoor-blueprint.ts
 *
 * Closes the partial INDOOR_BLUEPRINT SKU (₱1,499 · "Your whole venue, mapped
 * and seated" · v2.1 brief § 5 + Onboarding Blueprint §3.3). The seating-chart
 * editor (iteration 0008) is already live — tables placed on a floor plan,
 * guests assigned. v2-catalog.ts marks INDOOR_BLUEPRINT 'partial' because the
 * "entrance → table" wayfinding half ("entrance-to-table nav not built") has
 * never shipped. THIS adds the missing wayfinding: a guest-facing "find your
 * table" view that highlights the guest's assigned table on the published floor
 * plan and draws a path from the venue entrance, plus a couple-facing preview.
 *
 * Gating — same owned-orders pattern as eventOwnsProWebsite() / the
 * custom-qr-guest page (CLAUDE.md 2026-05-22 + 2026-05-30): an `orders` row
 * with service_key = 'INDOOR_BLUEPRINT' whose status is NOT cancelled /
 * refunded / lapsed. A still-in-reconciliation 'submitted' order counts as
 * owned so the couple can't double-buy mid-reconciliation.
 *
 * SAFETY — every helper here that touches the database runs ONLY behind a gate
 * (the couple's add-on page is auth-bound; the guest find-my-table route is
 * behind the same ownership check before any seating query fires). NOTHING here
 * runs on the always-rendered public landing page. Graceful-degrade on a
 * missing/legacy table (42P01 undefined_table · 42703 undefined_column) so a
 * pre-bootstrap database surfaces the upgrade CTA / no-blueprint state rather
 * than crashing — matches the PR #380/#390 + website/page.tsx hotfix pattern.
 */

export const INDOOR_BLUEPRINT_SERVICE_KEY = 'INDOOR_BLUEPRINT';
export const INDOOR_BLUEPRINT_PRICE_PHP = 1499; // v2.1 brief § 5 · ₱1,499

const RELINQUISHED_STATUSES = new Set(['cancelled', 'refunded', 'lapsed']);

/**
 * Does this event own the paid Indoor Blueprint upgrade?
 *
 * Returns false on any DB shape error (missing table/column) so the gated
 * surface degrades to the upgrade CTA rather than throwing. Mirrors
 * eventOwnsProWebsite() exactly.
 */
export async function eventOwnsIndoorBlueprint(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('orders')
    .select('status')
    .eq('event_id', eventId)
    .eq('service_key', INDOOR_BLUEPRINT_SERVICE_KEY)
    .not('status', 'in', '("cancelled","refunded","lapsed")');

  if (error) {
    if (error.code === '42P01' || error.code === '42703') return false;
    throw new Error(`Failed to resolve Indoor Blueprint ownership: ${error.message}`);
  }

  return (data ?? []).some(
    (row) => !RELINQUISHED_STATUSES.has((row.status as string | null) ?? ''),
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Geometry — the wayfinding map renders the same canonical floor-plan
// coordinate system the seating editor (FloorPlan component) uses: tables
// positioned by x_pos / y_pos as 0–100 percentages on a 4:3 canvas, the
// stage banner pinned at the top, and an entrance marker (NEW) the couple
// can place. Coordinates here are duplicated/extracted from the editor's
// shapeFor() + defaultGrid() so the read-only guest map matches what the
// couple arranged 1:1 without importing the 'use client' editor component.
// ─────────────────────────────────────────────────────────────────────────

export type WayfindingShape =
  | 'circle'
  | 'long_banquet'
  | 'family_head'
  | 'sweetheart'
  | 'serpentine';

/**
 * Canonical TableType → render shape. EXACT copy of the editor's shapeFor()
 * (floor-plan.tsx) so the guest's read-only map matches the couple's layout.
 */
export function wayfindingShapeFor(type: TableType): WayfindingShape {
  if (type.startsWith('round_')) return 'circle';
  if (type.startsWith('long_banquet_')) return 'long_banquet';
  if (type.startsWith('family_head_')) return 'family_head';
  if (type === 'sweetheart_2') return 'sweetheart';
  if (type.startsWith('serpentine_')) return 'serpentine';
  return 'circle';
}

/** Default grid position when a table's x/y is unset — copy of editor's defaultGrid(). */
export function wayfindingDefaultGrid(
  index: number,
  total: number,
): { x: number; y: number } {
  const cols = Math.max(2, Math.ceil(Math.sqrt(total)));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const rows = Math.max(1, Math.ceil(total / cols));
  return {
    x: ((col + 0.5) / cols) * 100,
    y: 20 + ((row + 0.5) / rows) * 75,
  };
}

/** Resolve a table's render position the same way the editor does. */
export function wayfindingPosition(
  table: EventTableRow,
  index: number,
  total: number,
): { x: number; y: number } {
  if (table.x_pos !== null && table.y_pos !== null) {
    return { x: Number(table.x_pos), y: Number(table.y_pos) };
  }
  return wayfindingDefaultGrid(index, total);
}

/**
 * Default entrance position when the couple hasn't placed one.
 *
 * Guests almost always enter from the front/bottom of a reception hall,
 * opposite the stage/head table (which the editor pins at the TOP, y≈3–18).
 * Bottom-center (x 50, y 96) is the safe, conventional default — and it's
 * exactly where the couple is most likely to confirm it anyway.
 */
export const DEFAULT_ENTRANCE: { x: number; y: number } = { x: 50, y: 96 };

export type EntrancePos = { x: number; y: number };

/**
 * Resolve the entrance marker for an event. Reads the optional
 * events.venue_entrance_x / venue_entrance_y columns (migration
 * 20260717000000) and falls back to DEFAULT_ENTRANCE when unset OR when the
 * columns don't exist yet (pre-migration database). This keeps the feature
 * fully functional the moment the gating SKU is owned, even before the
 * migration applies — the wayfinding just uses the conventional default.
 */
export async function fetchEntrance(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EntrancePos> {
  const { data, error } = await supabase
    .from('events')
    .select('venue_entrance_x, venue_entrance_y')
    .eq('event_id', eventId)
    .maybeSingle();

  // Missing column (pre-migration) or any read error → conventional default.
  if (error) return DEFAULT_ENTRANCE;

  const x = data?.venue_entrance_x;
  const y = data?.venue_entrance_y;
  if (typeof x === 'number' && typeof y === 'number') {
    return { x: clampPct(x), y: clampPct(y) };
  }
  return DEFAULT_ENTRANCE;
}

export function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.max(2, Math.min(98, n));
}

/**
 * A simple two-leg path from the entrance to a target table:
 * entrance → an aisle waypoint (lateral move toward the table's column, kept
 * in the lower-middle of the room) → the table. This reads as "walk in, head
 * up the aisle, your table is here" — clear directional guidance without
 * needing true A* obstacle avoidance (explicitly out of scope for v1).
 *
 * Returns SVG-space points on a 0–100 grid.
 */
export function wayfindingPath(
  entrance: EntrancePos,
  target: { x: number; y: number },
): Array<{ x: number; y: number }> {
  // Aisle waypoint: move laterally toward the table's x at a y that's between
  // the entrance and the table, biased toward the entrance so the "turn" reads
  // as happening near the door. Clamped so it never overlaps the stage band.
  const midY = clampPct(entrance.y - (entrance.y - target.y) * 0.45);
  return [
    { x: clampPct(entrance.x), y: clampPct(entrance.y) },
    { x: clampPct(target.x), y: midY },
    { x: clampPct(target.x), y: clampPct(target.y) },
  ];
}

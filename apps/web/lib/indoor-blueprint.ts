import type { SupabaseClient } from '@supabase/supabase-js';
import { defaultTablePosition, type EventTableRow, type TableType } from '@/lib/seating';

/**
 * apps/web/lib/indoor-blueprint.ts
 *
 * The entrance→table wayfinding shared by the couple studio
 * (/dashboard/[eventId]/studio/indoor-blueprint) and the guest surfaces
 * (/[slug]/find-my-table + the inline seat map on the landing page): geometry
 * that highlights a guest's assigned table on the published floor plan and
 * draws a path from the venue entrance.
 *
 * FREE (owner 2026-07-23: "indoor blueprint is free and uses the 2D Plan for
 * free"). Indoor Blueprint rides on the already-free 2D seat plan (iteration
 * 0008), so it is NOT sold — the retired paid ₱1,499 INDOOR_BLUEPRINT SKU stays
 * is_active=false and none of these helpers gate on ownership anymore. The old
 * eventOwnsIndoorBlueprint / INDOOR_BLUEPRINT_SERVICE_KEY / *_PRICE_PHP paid-gate
 * exports were removed with that change (no remaining importers).
 *
 * SAFETY — the DB helpers here (fetchEntrance) run only behind an auth/session
 * gate (the couple's add-on page is auth-bound; the guest find-my-table route is
 * session-cookie gated) and graceful-degrade on a missing/legacy column (42P01 /
 * 42703) to the conventional default rather than crashing. NOTHING here runs on
 * the always-rendered public landing page unrestricted.
 */

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
  // Match the editor's free auto-grow default so an un-arranged layout looks the
  // same here as in the editor (the map fits it via fitFloorTransform).
  return defaultTablePosition(index, total, true);
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
 * Resolve the entrance marker for an event — the ONE answer to "where is the
 * door", shared with the 3D surfaces.
 *
 * ⚠ THIS USED TO BE A SECOND SOURCE OF TRUTH. Wayfinding read
 * `events.venue_entrance_x/y` (written by the Indoor Blueprint studio) while
 * the seating lab, the public venue walk, plan3d-scene and venue-decor all read
 * `event_floor_plan.entrance_x/y` (written by the lab's floor markers). Two
 * tables, two editors, neither writing the other — so a couple who moved the
 * door in one place left the other pointing at the old one. They agreed only
 * because both happened to default to bottom-centre.
 *
 * `event_floor_plan` is canonical: it carries `entrance_enabled`, a service
 * entrance, and door-vs-walk-through geometry, and four surfaces already read
 * it. Resolution order:
 *
 *   1. A floor-plan row with the doorway ENABLED — the couple placed a door and
 *      the 3D room draws it there, so wayfinding points at exactly that door.
 *   2. Otherwise the legacy `events.venue_entrance_*` columns, when set. This
 *      is a TRANSITIONAL fallback so no existing blueprint choice is discarded
 *      before the backfill runs; it is not a second opinion, it is the old one
 *      still being honoured.
 *   3. DEFAULT_ENTRANCE — the conventional bottom-centre, which is also what
 *      every 3D surface walks in at when no doorway is enabled.
 *
 * Any read error (including a pre-migration database missing either column set)
 * degrades to the conventional default rather than throwing.
 */
export async function fetchEntrance(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EntrancePos> {
  const { data: plan, error: planError } = await supabase
    .from('event_floor_plan')
    .select('entrance_enabled, entrance_x, entrance_y')
    .eq('event_id', eventId)
    .maybeSingle();

  if (!planError && plan?.entrance_enabled) {
    const px = (plan as { entrance_x?: unknown }).entrance_x;
    const py = (plan as { entrance_y?: unknown }).entrance_y;
    if (typeof px === 'number' && typeof py === 'number') {
      return { x: clampPct(px), y: clampPct(py) };
    }
  }

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

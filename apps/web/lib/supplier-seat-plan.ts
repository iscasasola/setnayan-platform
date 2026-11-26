/**
 * 🔗 THE SUPPLIER'S SEAT PLAN, READ THROUGH THE ONE ENGINE (A7-16, final check 25 Nov 2026; DECISION_LOG 2026-11-20
 * "one seat-plan engine for the couple and the supplier"). The shape `get_vendor_seat_plan` sends, and the two readings
 * the supplier page draws from it: the engine's Plan (`planFromSeating`, drawn by `PlanPoster`) and the hosts' display
 * units (`groupTablesIntoUnits`). Pure — no client, no UI — so the claims are tested without rendering.
 */
import { planFromSeating, type TableType } from '@/lib/seat-plan-engine';
import { groupTablesIntoUnits } from '@/lib/seating';

export type PlanTable = {
  table_id: string;
  label: string;
  table_type: string;
  capacity: number;
  x: number | null;
  y: number | null;
  rotation_deg: number;
  sort_order: number;
  seated: number;
  meal_counts: Record<string, number> | null;
  /** A7-17: the chairs the hosts removed (`get_vendor_seat_plan`, 20271363213887). Absent on an older read → none. */
  removed_seats?: number[] | null;
  /** A7-16: the hosts' join (`get_vendor_seat_plan`, 20271363442215). Absent on an older read → not joined. */
  link_group_id?: string | null;
  link_group_label?: string | null;
};

/**
 * 🔗 A7-16 · ONE SEAT-PLAN ENGINE (DECISION_LOG 2026-11-20). The supplier's tables, read the way the hosts' own plan reads
 * them: as display units (`groupTablesIntoUnits`, lib/seating.ts) — a joined set is ONE row under the group's name, its
 * seats the sum of each member's `effectiveCapacity` (A7-17: removed chairs never count).
 */
export function tableUnits(tables: PlanTable[]) {
  return groupTablesIntoUnits(
    tables.map((t) => ({
      table_id: t.table_id,
      table_label: t.label,
      // `table_type` is the `event_tables.table_type` enum, sent as text — always one of the engine's couple types.
      table_type: t.table_type as TableType,
      capacity: t.capacity,
      removed_seats: t.removed_seats ?? [],
      link_group_id: t.link_group_id ?? null,
      link_group_label: t.link_group_label ?? null,
      src: t,
    })),
  );
}

/** A7-17: the covers on a set of tables (their meal counts added up), or null when no meal counts were sent. */
export function mealsOf(tables: PlanTable[]): Record<string, number> | null {
  if (!tables.some((t) => t.meal_counts)) return null;
  const out: Record<string, number> = {};
  for (const t of tables) for (const [k, n] of Object.entries(t.meal_counts ?? {})) out[k] = (out[k] ?? 0) + n;
  return out;
}

/**
 * 🔗 A7-16: the supplier's picture is the hosts' picture — the plan read through the engine (`planFromSeating`) and
 * drawn by the one `PlanPoster`: real table shapes and sizes, the hosts' removed chairs, a joined set's chairs spaced as
 * one chain, an unsized room as the engine's default room (`DEFAULT_ROOM_M`). A joined set carries the group's name on
 * its lead table. Only placed tables are drawn; the rows below say which are not placed yet.
 */
export function supplierPlanOf(plan: Plan) {
  const placed = plan.tables.filter((t) => t.x !== null && t.y !== null);
  const leads = new Set(tableUnits(placed).map((u) => u.lead.table_id));
  return planFromSeating(
    placed.map((t) => ({
      table_id: t.table_id,
      table_label: t.link_group_id ? (leads.has(t.table_id) ? (t.link_group_label ?? t.label) : '') : t.label,
      table_type: t.table_type as TableType,
      capacity: t.capacity,
      x_pos: t.x,
      y_pos: t.y,
      rotation_deg: t.rotation_deg,
      removed_seats: t.removed_seats ?? [],
      link_group_id: t.link_group_id ?? null,
    })),
    {
      venue_width_m: plan.venue.width_m,
      venue_length_m: plan.venue.length_m,
      entrance_enabled: plan.entrance !== null,
      entrance_x: plan.entrance?.x ?? 50,
      entrance_y: plan.entrance?.y ?? 100,
      service_entrance_enabled: plan.service_entrance !== null,
      service_entrance_x: plan.service_entrance?.x ?? 50,
      service_entrance_y: plan.service_entrance?.y ?? 100,
    },
  );
}

export type PlanObject = {
  object_id: string;
  zone: 'reception' | 'cocktail';
  object_type: string;
  label: string;
  x: number;
  y: number;
  is_mine: boolean;
  vendor_name: string | null;
};

export type PlanCocktail = {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  venue: { width_m: number | null; length_m: number | null };
  window: { label: string; start_at: string | null; end_at: string | null } | null;
};

export type Plan = {
  published_at: string;
  venue: { width_m: number | null; length_m: number | null };
  stage: { x: number; y: number; w: number; h: number };
  dance: { x: number; y: number; w: number; h: number } | null;
  entrance: { x: number; y: number } | null;
  service_entrance: { x: number; y: number } | null;
  cocktail: PlanCocktail | null;
  dietary_included: boolean;
  tables: PlanTable[];
  objects: PlanObject[];
};

/**
 * table-order.ts — 🪑 ONE ORDER FOR AN EVENT'S TABLES, AND NO TWO DRAWN ON ONE SPOT (owner 2026-11-01, live on his own
 * event: *"not organizing the seats properly"*). Measured there: Tables 1, 2 and 3 all had `sort_order` 0 (a table made
 * by "＋ New table" never set one), the rest ran 1…22 out of label order, and two tables sat on the very same spot
 * (100, 100) with two more on the bottom edge.
 *
 *   · `compareTables` — every seats reader orders by the label read NATURALLY ("Table 2" < "Table 10"), then
 *     `sort_order`, then when it was made, then its id: the same list everywhere, whatever the stored numbers say.
 *   · `spreadForDisplay` — the 2D plan and the 3D room never draw two tables on one spot: tables that share a spot are
 *     fanned out around it and a table on the very edge is drawn just inside it. DISPLAY ONLY — nothing is written
 *     (the host's own move, if they make one, saves where they put it).
 * 🔒 lib/tables-keep-one-order-and-never-stack.test.ts
 */

type Orderable = { table_id: string; table_label: string; sort_order: number; created_at?: string | null };

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

export function compareTables(a: Orderable, b: Orderable): number {
  return (
    collator.compare((a.table_label ?? '').trim(), (b.table_label ?? '').trim()) ||
    (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
    String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')) ||
    a.table_id.localeCompare(b.table_id)
  );
}

export function sortTables<T extends Orderable>(rows: readonly T[]): T[] {
  return [...rows].sort(compareTables);
}

/** How close (0–100 grid units) two tables may be before they count as one spot. */
export const SAME_SPOT = 1.5;
/** How far from a shared spot each table is drawn. */
export const SPREAD_RADIUS = 7;
/** The drawn edge band — a table is never drawn closer to the plan's edge than this. */
export const EDGE_INSET = 4;

type Placed = { table_id: string; x_pos: number | null; y_pos: number | null };

/**
 * The positions to DRAW (a copy; the rows themselves are untouched). Tables with no position stay unplaced.
 * Deterministic: the order within a shared spot is the list's own order (call it with `sortTables` output).
 */
export function spreadForDisplay<T extends Placed>(rows: readonly T[]): T[] {
  const clamp = (v: number) => Math.min(100 - EDGE_INSET, Math.max(EDGE_INSET, v));
  const spots: { x: number; y: number; ids: string[] }[] = [];
  for (const r of rows) {
    if (r.x_pos === null || r.y_pos === null) continue;
    const x = Number(r.x_pos);
    const y = Number(r.y_pos);
    const hit = spots.find((s) => Math.abs(s.x - x) < SAME_SPOT && Math.abs(s.y - y) < SAME_SPOT);
    if (hit) hit.ids.push(r.table_id);
    else spots.push({ x, y, ids: [r.table_id] });
  }
  const at = new Map<string, { x: number; y: number }>();
  for (const s of spots) {
    const cx = clamp(s.x);
    const cy = clamp(s.y);
    if (s.ids.length === 1) {
      at.set(s.ids[0]!, { x: cx, y: cy });
      continue;
    }
    // Fan the shared spot out on a small ring, first one straight up, clockwise.
    s.ids.forEach((id, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / s.ids.length;
      at.set(id, { x: clamp(cx + SPREAD_RADIUS * Math.cos(a)), y: clamp(cy + SPREAD_RADIUS * Math.sin(a)) });
    });
  }
  return rows.map((r) => {
    const p = at.get(r.table_id);
    return p && (p.x !== r.x_pos || p.y !== r.y_pos) ? { ...r, x_pos: Math.round(p.x * 100) / 100, y_pos: Math.round(p.y * 100) / 100 } : r;
  });
}

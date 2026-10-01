import type { SupabaseClient } from '@supabase/supabase-js';
import { PLAN_GROUPS, type PlanGroup } from '@/lib/wedding-plan-groups';

/**
 * plan-groups-by-event-type.ts — WHICH bookable categories this event type has.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────────
 * `PLAN_GROUPS` is a single hardcoded **wedding** ladder — `ceremony_venue`
 * ("Where you say I do"), `bridal_car`, `rings`, `officiant` — and every surface
 * that counts categories iterated it for all 16 event types. So a BIRTHDAY host
 * opened their dashboard to "Book a vendor · 21 categories still open" and a
 * top decision of "Lock your reception venue", measured against a denominator
 * that had nothing to do with their event.
 *
 * ── WHY THIS IS WIRING, NOT DESIGN ───────────────────────────────────────────
 * The per-type map ALREADY EXISTS, is fully populated, and is owner-editable:
 * `service_categories.applicable_event_types` (tier 2), maintained from
 * `/admin/event-types/<type>/categories`. 72 of 73 tier-2 rows are scoped —
 * `bridal_car → [wedding]`, `ceremony_venue → [wedding, christening]`,
 * `cake → 13 types`. The marketplace and Shortlist have consumed it for a
 * while. The couple's decisions board and progress rail simply never did.
 *
 * So nothing here invents taxonomy. It joins the existing ladder to the
 * existing map on the key they already share: `PlanGroup.catalogTile` is a
 * `service_categories.id`. All 22 tiles referenced by PLAN_GROUPS resolve.
 *
 * ── FAIL-OPEN, DELIBERATELY ──────────────────────────────────────────────────
 * Every unknown resolves to "applies". A DB hiccup, a tile with no row, a
 * NULL/empty allow-list, or a plan group with no `catalogTile` at all (today:
 * `attire`, `music_entertainment`, `logistics` — all genuinely universal) keeps
 * the group.
 *
 * This is the opposite of the fail-CLOSED posture used for entitlement gates,
 * and the asymmetry is the point: the cost of wrongly INCLUDING a category is a
 * slightly long checklist, while the cost of wrongly EXCLUDING one is a couple
 * never being reminded to book their venue. `applicable_event_types` is
 * documented as an allow-list where NULL means universal, so this matches the
 * column's own semantics rather than inventing a stricter reading.
 */

/** tile id → allow-list, or null when the tile is universal. */
export type PlanGroupScope = ReadonlyMap<string, readonly string[] | null>;

/** An empty scope — every group applies. The safe degradation. */
export const PLAN_GROUP_SCOPE_UNKNOWN: PlanGroupScope = new Map();

/**
 * Read the tier-2 allow-lists. Never throws: on any error the caller gets an
 * empty map, which `planGroupsForEventType` treats as "everything applies".
 */
export async function fetchPlanGroupScope(
  db: SupabaseClient,
): Promise<PlanGroupScope> {
  try {
    const { data, error } = await db
      .from('service_categories')
      .select('id, applicable_event_types')
      .eq('tier', 2);
    if (error || !Array.isArray(data)) return PLAN_GROUP_SCOPE_UNKNOWN;

    const out = new Map<string, readonly string[] | null>();
    for (const row of data as Array<Record<string, unknown>>) {
      const id = typeof row.id === 'string' ? row.id : '';
      if (!id) continue;
      const raw = row.applicable_event_types;
      // NULL *and* [] both mean universal — the admin toggle writes an empty
      // array when the last type is switched off, and the marketplace reads
      // that as "serves everything" too. Treating [] as "serves nothing" here
      // would silently empty a ladder the admin thought they were widening.
      const list = Array.isArray(raw) && raw.length > 0 ? (raw as string[]) : null;
      out.set(id, list);
    }
    return out;
  } catch {
    return PLAN_GROUP_SCOPE_UNKNOWN;
  }
}

/**
 * PURE. The plan groups a given event type actually books — THE one resolver.
 *
 * ⚖ THERE WERE TWO until 2026-10-01: this DB-backed one (read only by the
 * dashboard counts) and a same-named one in `wedding-plan-groups.ts` that read
 * only the code `eventTypes` field (used by the Suppliers page, event costs and
 * upcoming items). So the Suppliers page showed Bridal car / Rings / Honeymoon
 * to a birthday while the dashboard, reading the DB, did not. One rule now:
 *
 *   1. the code floor — a group with `eventTypes` shows only where it is named
 *      (the farewell cards), so a REFUSED scope read still never puts "Choose
 *      the funeral home" on a wedding;
 *   2. the DB scope — `service_categories.applicable_event_types` of the
 *      group's tile, failing OPEN on anything unknown (see the header).
 *
 * `scope` defaults to unknown, which reduces this to the code floor alone —
 * the right reading for a caller that files costs and must never drop a
 * category a cost may already carry.
 *
 * `wedding` is byte-identical to `PLAN_GROUPS`-minus-farewell as long as every
 * tile's allow-list contains 'wedding' — which it does today, and which
 * `plan-groups-by-event-type.test.ts` pins, because silently shortening the
 * wedding ladder is the one regression that would matter most.
 */
export function planGroupsForEventType(
  eventType: string | null | undefined,
  scope: PlanGroupScope = PLAN_GROUP_SCOPE_UNKNOWN,
  groups: ReadonlyArray<PlanGroup> = PLAN_GROUPS,
): PlanGroup[] {
  // A null/unknown type is treated as a wedding — the same default the rest of
  // the dashboard uses when `events.event_type` is missing.
  const type = eventType ?? 'wedding';
  return groups.filter((g) => {
    if (g.eventTypes && !g.eventTypes.includes(type)) return false; // code floor
    const tile = g.catalogTile;
    if (!tile) return true; // no tile ⇒ nothing to scope on ⇒ universal
    if (!scope.has(tile)) return true; // no row ⇒ unknown ⇒ fail open
    const list = scope.get(tile);
    // NULL *or* [] ⇒ universal. The empty-array case is normalised in
    // fetchPlanGroupScope too, and is re-checked here on purpose: this function
    // is pure and callable with a hand-built map, so relying on the fetcher to
    // have normalised would make the fail-open guarantee depend on which door
    // the data came through. Defence in depth on the branch whose failure mode
    // is "a couple is never reminded to book their venue".
    if (list == null || list.length === 0) return true;
    return list.includes(type);
  });
}

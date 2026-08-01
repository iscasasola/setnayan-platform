/**
 * WHICH ROLES A SUPPLIER WAS BOOKED FOR — read from what they were actually
 * booked to DO, not from the booking's single summary field.
 *
 * ── THE BUG THIS FIXES (owner, 2026-08-01) ─────────────────────────────────
 *
 * A booking already records several services: `event_vendors.requested_service_ids`
 * lists them and each `vendor_services` row carries its own category. A supplier
 * being the band AND the emcee at one wedding has always been expressible.
 *
 * But the day-of surfaces narrowed on `event_vendors.category` alone — ONE
 * value, because the booking row has one — so a supplier booked for two jobs
 * resolved to one role, and the second desk was unreachable. The information
 * was recorded and simply never read.
 *
 * *(An earlier reading of this concluded the booking model could not express two
 * roles at all and proposed a schema change. That was wrong — it looked at the
 * summary column and missed the services underneath. No new tables are needed.)*
 *
 * ── WHY UNION, NEVER REPLACE ───────────────────────────────────────────────
 *
 * The row's `category` stays in the answer. It is the booking's own summary and
 * is populated on every booking, including old ones made before services
 * existed. Dropping it would make this a REGRESSION for every historic booking
 * — the services list is empty on those, so replacing would narrow to nothing.
 *
 * Union means this can only ever ADD a role, never remove one. A supplier who
 * sees one desk today keeps seeing it.
 *
 * ── BOTH VOCABULARIES, SAFELY ──────────────────────────────────────────────
 *
 * `vendor_services.category` is genuinely ambiguous today — written as a
 * canonical tile key in one path and read as a legacy enum in another, with
 * zero rows in production to settle it (see the 2026-07-31 fault-reporting fix).
 * `tilesForVendorCategories` already handles both: it maps a known legacy
 * category to its tiles and PASSES AN UNRECOGNISED VALUE THROUGH UNCHANGED,
 * because an unmapped string is more likely a tile already. So feeding it both
 * sources is correct under either reading, and no second mapping table is
 * introduced — a taxonomy in two places is what caused the original desk
 * blackout.
 */
import { tilesForVendorCategories } from './vendor-category-taxonomy';

/**
 * The canonical tiles a supplier holds ON THIS EVENT.
 *
 * Returns `null` — "the event cannot say, do not narrow" — only when BOTH
 * sources are empty. That is the shipped contract of `tilesForVendorCategories`
 * and it matters: an empty array is truthy, and a caller treating it as a
 * narrowing set would exclude every tile and silently hide every desk.
 */
export function eventTilesForBooking(input: {
  /** `get_vendor_event_brief().booked_categories` — the booking row summary. */
  bookedCategories?: readonly string[] | null;
  /** `vendor_services.category` for every service on this booking. */
  bookedServiceCategories?: readonly string[] | null;
}): string[] | null {
  const merged = new Set<string>();
  for (const source of [input.bookedCategories, input.bookedServiceCategories]) {
    for (const v of source ?? []) {
      if (typeof v === 'string' && v.trim()) merged.add(v.trim());
    }
  }
  if (merged.size === 0) return null;
  return tilesForVendorCategories([...merged]);
}

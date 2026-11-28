/**
 * 📌 BOOKED, DEFINED ONCE (L5 · C2). The `event_vendors.status` values that mean the couple has a booking with this
 * supplier, and the one test every screen asks of a row. A LEAF on purpose: no imports, so a client component
 * (Book's shortlist, the plan groups) and a server reader (Budget's resolver) can share it without dragging
 * `node:crypto` (vendor-funnel) or the taxonomy into a bundle. `lib/vendor-funnel.ts` re-exports the set under its
 * old name, so the SQL twin `booked_event_vendor_statuses()` still has one TypeScript partner.
 */

// ⚠ 'paid' was once a member and is NOT in the `vendor_status` enum
// (considering · shortlisted · contracted · deposit_paid · delivered · complete).
// Postgres rejects the entire `.in()` on an unknown label — 22P02 — so every
// event_vendors query fed by the array errored and every booked count read zero.
export const BOOKED_EVENT_VENDOR_STATUSES = [
  'contracted',
  'deposit_paid',
  'delivered',
  'complete',
] as const;

export type BookedEventVendorStatus = (typeof BOOKED_EVENT_VENDOR_STATUSES)[number];

const BOOKED: ReadonlySet<string> = new Set(BOOKED_EVENT_VENDOR_STATUSES);

/** Is this `event_vendors.status` a booking? The one test every screen asks. */
export function isBookedStatus(status: string | null | undefined): boolean {
  return status != null && BOOKED.has(status);
}

/** How many suppliers the couple has booked: distinct `vendor_id`s with a booked status. */
export function bookedSupplierCount(rows: ReadonlyArray<{ vendor_id: string; status: string | null }>): number {
  const ids = new Set<string>();
  for (const r of rows) if (isBookedStatus(r.status)) ids.add(r.vendor_id);
  return ids.size;
}

/**
 * A screen row (a shortlist supplier, a plan-group pick) is booked when its view status is `'locked'` — the word the
 * readers set from `isBookedStatus` and nothing else (`shortlist-taxonomy`, `statusOfVendor`). Book, Build and the
 * vendors page ask THIS, never `status === 'locked'` of their own, so "booked" is decided in one module.
 */
export function isBookedView(row: { status: string }): boolean {
  return row.status === 'locked';
}

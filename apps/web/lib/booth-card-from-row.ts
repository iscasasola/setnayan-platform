import type { FloorBoothRow } from '@/lib/seating';
import type { Lab3DBooth } from '@/lib/seating-3d';

/**
 * 🏪 A 2D BOOTH OPENS THE SAME SUPPLIER CARD AS THE 3D WALK (owner 2026-11-01, DECISION_LOG "SEATS: WHAT EACH VIEW DOES"
 * — *"tapping a 2D booth opens the supplier card"*). The 2D plan holds its booths as `FloorBoothRow`s (`fetchBooths`,
 * which already joins the booked supplier's PUBLIC business identity — zero personal data); `BoothVendorCard` reads the
 * 3D walk's `Lab3DBooth`. This is the one mapping between them.
 *
 * The logo is a RAW stored ref on the row and is not resolved in the browser, so the 2D card shows the supplier's
 * initials (the card's own fallback) — never a broken image. The menu / set-list lines are a server read the 2D plan
 * does not make, so the card shows the inclusions it has (the offerings line).
 */
export function boothCardFromRow(b: FloorBoothRow): Lab3DBooth {
  return {
    id: b.booth_id,
    kind: b.booth_type,
    label: b.label,
    xPct: b.x_pos,
    yPct: b.y_pos,
    offerings: b.offerings,
    cardItems: null,
    vendor: b.vendor
      ? {
          name: b.vendor.vendor_name,
          category: b.vendor.category,
          logoUrl: null,
          tier: b.vendor.tier,
          slug: b.vendor.slug,
          bookable: b.vendor.bookable,
          boothAddonActive: b.vendor.boothAddonActive,
        }
      : null,
  };
}

/** Only a booth a booked supplier runs has a supplier card to open. */
export function boothHasSupplier(b: Pick<FloorBoothRow, 'vendor'>): boolean {
  return Boolean(b.vendor);
}

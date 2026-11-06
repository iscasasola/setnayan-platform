import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchBooths, type FloorBoothRow } from '@/lib/seating';
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

/**
 * 🏪 THE GUEST-SAFE BOOTH READ (Seats S1d, owner 2026-11-01 item 5 — guest seat pages drew no booths before). Called by a
 * guest page only AFTER its seat gate let the guest see the room (`guestsMaySeeSeatsFor`), with the admin client the
 * page already reads seats with. What leaves: booths a BOOKED supplier runs, each with its place on the grid, its label,
 * its offerings line and the supplier's PUBLIC business identity (`boothCardFromRow` — name, category, tier, public slug;
 * the raw logo ref is dropped). No guest, no price, no contact. A failed read draws no booths (`fetchBooths` degrades to
 * the plain rows, which carry no supplier and so are not drawn) — the seat itself never depends on it.
 */
export async function readGuestBooths(admin: SupabaseClient, eventId: string): Promise<Lab3DBooth[]> {
  const rows = await fetchBooths(admin, eventId, { brandedReader: admin });
  return rows.filter(boothHasSupplier).map(boothCardFromRow);
}

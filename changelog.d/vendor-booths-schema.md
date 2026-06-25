## 2026-06-25 · feat(seating-3d): vendor-booth placement schema (build #2 foundation)

Build #2 (vendor booths) foundation. New `event_vendor_booth_placements` — where
a vendor's booth sits in the couple's 3D scene, sourced from the couple's own
vendor registry (`event_vendors`, iteration 0006) so EVERY vendor can be placed
for a complete floor plan (owner: "list all the vendors for the full floor
plan"). Couple-scoped RLS (`current_couple_event_ids`), RLS at create time,
idempotent. Applied to `setnayan-prod`.

Booth renders GENERIC for now; the Pro/Enterprise branded skin (logo + theme +
promo) is the next increment — it first needs the registry↔platform-vendor link
resolved (two vendor sources: `event_vendors` registry vs
`vendor_schedule_pool_bookings` platform bookings), deliberately not guessed.

SPEC IMPACT: 0008 Seating + 0006 Vendors — couples can place vendor booths.

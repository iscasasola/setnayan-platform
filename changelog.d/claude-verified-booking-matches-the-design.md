## 2026-11-06 · fix(couple-photos): "From couples" is the approved 3-column grid with the ✓ Verified booking pill on the photo

The service card's "From couples" (PR #7316) drew a sideways strip of 96 px thumbnails with a 9 px terracotta mark,
and the shop's own answer screen drew text rows with Approve · Decline under them. Both now copy the approved For
Suppliers prototype (`Setnayan-specs/prototypes/for_suppliers_2026-11-06/index.html`, the "Photos from couples"
sample gallery — `.sgrid` / `.vbm` / `.appr`) into the app's tokens:

- `app/_components/service-card-view.tsx` — a 3-column grid of large square photos (4 px gap, 10 px corners); the
  "✓ Verified booking" pill sits on the photo in the house ok-green (`--color-ok`) on a cream plate, at 12 px (the
  public floor; the design's 9.3 px is below it, so the pill may wrap on a narrow tile). One `VerifiedBookingMark`,
  still drawn ONLY from the read's `verifiedBooking === true`.
- `app/vendor-dashboard/shop/_components/couple-photos-list.tsx` — the same grid; a waiting photo carries the white
  plate "Shared by the couple · Approve" ON the photo, through the SHIPPED `couplePhotoShare` op 'answer'; an approved
  one says "✓ On your card" (its read does not return the booking mark, so it never claims it). Decline and Take off
  stay as the ✕ / ↶ beside each caption.
- Guards: `lib/a-couples-photo-shows-only-when-approved.test.ts` retargeted to the one mark component (and now holds
  the shop's grid to never saying "Verified booking"); new `lib/from-couples-is-the-approved-grid.test.ts` pins the
  grid, the pill and the on-photo Approve.

Proof at 390 px: `docs/screenshots/2026-11-06-verified-booking-grid/`.

SPEC IMPACT: None

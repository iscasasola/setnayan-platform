## 2026-10-22 · feat(venues): a manual venue's pin is set in Studio › Info; a shop's venue follows the shop's pin

Owner, 2026-10-22: *"can we place the setting the pin here also? · manual entry venues can set pin. · venues from
actual suppliers cannot customize pin, only follows what the suppliers pinned."* · *"manual is the manual added
suppliers."*

- **Resolver** (`lib/event-venues.ts`, what the guest page, prints and reminders read): a booking linked to a
  Setnayan shop (`marketplace_vendor_id`, else `linked_vendor_profile_id`) takes its pin from the shop's
  `vendor_profiles.hq_*` ONLY — never the couple's contact card (a manual supplier who claims its shop keeps the card
  on the row; the shop's pin takes over from that moment) and never the event's typed pin under "Enter your own". A
  shop with no pin gives no pin (the shared map already says "not on the map", #6739). Each booking now says whose
  pin it is (`pinFrom`).
- **Where a pin is set** (`lib/venue-pin-door.ts`, one value, two doors): shop → nobody on the couple's side, and the
  editors say "Pinned by <shop>" or "<shop> hasn't pinned their place yet"; a supplier added by hand → its own
  contact card, through the card's writer (`saveManualVenuePin` → `saveSelfAddedServiceCard`), live as the Suppliers
  card always was ("Saved to your supplier's card · guests see it now"); nothing booked / "Enter your own" over a
  non-shop → the event's own venue columns through the draft (at Apply).
- **Studio › Info › Venues** is no longer read-only: `StudioVenues` (lazy, in the `maker-details` chunk; the map
  field itself is `next/dynamic`) draws the shipped `AddressPinField` for a manual or unbooked venue and one quiet row
  for a shop's. The date stays read-only.
- **Details › Venues and the Suppliers place sheet**: a manual supplier on its own details gets the same
  `AddressPinField` under the booked card; a shop's card says whose pin guests follow; "Enter your own" over a shop
  types the name and address but no pin (`AddressPinField pinLocked`) and drafts no pin columns.
- Lab: `saveManualVenuePin` joins the Studio actions context with a stand-in and a refusal; `/dev/details-lab?studio=1&venue=mixed`.
- Guards: `lib/a-shop-venue-follows-the-shops-pin.test.ts` (property over 128 mixes + round trip; sabotaged), and
  `lib/info-shows-date-and-venue-read-only.test.ts` test 3 (render: shop row has no field and says unpinned; manual
  row carries the pin field).

SPEC IMPACT: DECISION_LOG.md — new 2026-10-22 row "A MANUAL VENUE TAKES THE COUPLE'S PIN; A SHOP'S VENUE TAKES THE
SHOP'S", amending 2026-10-06 "DATE AND VENUE LIVE IN SUPPLIERS, NOT IN 'YOUR EVENT'" for the venue's pin.

## 2026-07-11 · feat(vendors): facet refinements + service-date availability in category search

Added two additive refinements to the couple's category vendor search (the
in-place overlay launched from the Vendors tab / Merkado flow), on top of the
existing free-text + verified-only + distance controls:

1. **Facet refinements** — the couple can filter/rank by structured service
   attributes. New `lib/vendor-facets.ts` reads `canonical_service_schemas`
   (+ `shared_attribute_groups`) for the selectable multi_select/enum facets and
   matches candidate vendors' `vendor_service_attributes` by per-dimension array
   overlap. `searchCategoryVendors` seeds the selection from the couple's saved
   `event_vendor_preferences`, floats matching vendors up within the existing
   owner-locked tier ladder (soft rank), and supports an optional "only exact
   matches" hard filter. Vendors with no attribute row are NEVER excluded.

2. **Service-date availability** — extends the dormant date-availability reader
   (`lib/vendor-availability.getBatchVendorAvailableDays`) to the event's locked
   `events.event_date`: a vendor whose `vendor_calendar_blocks` cover the date is
   badged "Booked your date" and stable-down-ranked to the bottom (never removed).

Prod-safe / graceful-degrade: every new read uses the RLS-scoped session client
(never admin/service-role) and fails open — a not-yet-migrated table, an
RLS-denied read, or empty data yields no facet chips + no availability flags, so
the search behaves exactly as it does today. Inert in production until vendors
carry facet tags / calendar blocks the couple can read.

Files: `apps/web/lib/vendor-facets.ts` (new),
`apps/web/app/dashboard/[eventId]/vendors/_actions/category-search.ts`,
`apps/web/app/dashboard/[eventId]/vendors/_components/category-search-overlay.tsx`.

SPEC IMPACT: None — additive search refinement; matches the Merkado /
Vendor_Match_Personalization design intent (float-not-exclude, seed from saved
preferences). No pricing / token / inquiry-flow changes.

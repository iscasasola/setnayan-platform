-- event_vendors.package_item_id — make the package cascade item-precise.
-- ============================================================================
-- DEFECT THIS FIXES. `lockPackage` cascade-inserts one `event_vendors` row per
-- kept `vendor_package_items` row, but the only link back was
-- (event_vendor_package_id, category). `removeItemFromPackage` therefore
-- deleted by CATEGORY:
--
--     .eq('event_vendor_package_id', bookingId).eq('category', removedCategory)
--
-- and PACKAGE_CANONICAL_TO_VENDOR_CATEGORY is MANY-TO-ONE. Removing one line
-- deleted every sibling row sharing its vendor_category while appending only
-- that one item_id to removed_item_ids — so the booking's included list and its
-- event_vendors rows silently desynchronised. Worst cases in the shipped map:
--
--   reception_venue · function_hall · events_place · hotel_ballroom ·
--   garden_reception_venue · resort_reception_venue      → 'venue'
--   ~15 *_venue canonicals                               → 'religious_venue'
--   florals · florist                                    → 'florist'
--   bridal_hmua · hair_makeup                            → 'makeup_artist'
--   transportation_bridal_car · transportation_guest_shuttle → 'transportation'
--
-- A catering package listing both a reception venue and a garden venue would
-- lose both when the host dropped either one.
--
-- SAFETY. Additive + idempotent + nullable, so nothing existing breaks. No
-- backfill is needed or possible: prod holds ZERO packages and ZERO package
-- bookings (verified 2026-07-26 — vendor_packages=0, event_vendor_packages=0),
-- so there is no historical row whose originating item could be inferred.
-- Rows created before this column exists simply keep NULL, and the delete path
-- falls back to the old category match for them (see actions.ts).
--
-- ON DELETE SET NULL, not CASCADE: a vendor editing their catalogue must never
-- silently delete a host's BOOKED service row. Losing the provenance link is
-- recoverable; losing the booking is not.
--
-- RLS: inherited from event_vendors, unchanged — this is a column add only.
-- ============================================================================

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS package_item_id UUID
    REFERENCES public.vendor_package_items(item_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.event_vendors.package_item_id IS
  'The vendor_package_items row this cascaded event_vendors row came from. Set by lockPackage; the precise key removeItemFromPackage deletes by. NULL for rows not created from a package, and for package rows created before 2026-07-26 (none exist in prod). ON DELETE SET NULL so catalogue edits never delete a booked service.';

-- Partial index: the delete path always filters on the booking first, and only
-- package-cascaded rows carry a non-NULL item.
CREATE INDEX IF NOT EXISTS event_vendors_package_item_idx
  ON public.event_vendors (event_vendor_package_id, package_item_id)
  WHERE package_item_id IS NOT NULL;

-- One event_vendors row per (booking, item). Guards the cascade against a
-- double-lock or a retried insert producing duplicate rows for one item —
-- which would make the host's booking list disagree with the package.
CREATE UNIQUE INDEX IF NOT EXISTS event_vendors_booking_item_uniq
  ON public.event_vendors (event_vendor_package_id, package_item_id)
  WHERE package_item_id IS NOT NULL;

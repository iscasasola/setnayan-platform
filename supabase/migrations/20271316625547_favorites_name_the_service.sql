-- favorites_name_the_service — A FAVORITE IS THE SERVICE, NOT THE SHOP (owner 2026-11-06).
--
-- Owner, 6 Nov, on "Favorites after an event": a favorite reads "Mobile bar · SetnaProd · from your wedding" and
-- opens the shop at that service. `guest_saved_vendors` (the favorites table since the same ruling — it already
-- carries `source_event_id`) named only the shop, and its UNIQUE (user_id, vendor_profile_id) let one person keep
-- ONE favorite per shop, so two booked services of the same shop could never both be kept.
--
-- This migration (the one the owner allowed for this change):
--   1. adds `vendor_service_id`, nullable, FK to `vendor_services` ON DELETE SET NULL. NULL = the whole shop: every
--      row written before today stays valid and means exactly what it meant;
--   2. swaps the shop-only unique key for (user_id, vendor_profile_id, vendor_service_id).
--
-- ⚖ WHY THE NEW KEY IS NULLS DISTINCT (the default), NOT NULLS NOT DISTINCT. Suppliers hard-delete services
-- (app/vendor-dashboard/services/actions.ts). With ON DELETE SET NULL a deleted service's favorite becomes a
-- shop-level row; under NULLS NOT DISTINCT that row would collide with a shop-level favorite the same person
-- already holds, and the SUPPLIER'S delete would fail on a guest's bookmark. So two shop-level rows may exist; the
-- writer checks before it inserts a shop-level row, and the reader (lib/favorites.ts `collapseFavorites`) keeps one
-- row per shop+service. A favorite can never block a supplier's own edit.
--
-- RLS: unchanged (owner-only select / insert / delete). No data is rewritten.

ALTER TABLE public.guest_saved_vendors
  ADD COLUMN IF NOT EXISTS vendor_service_id uuid
    REFERENCES public.vendor_services(vendor_service_id) ON DELETE SET NULL;

-- The shop-only key, whatever Postgres named it: the UNIQUE constraint on exactly (user_id, vendor_profile_id).
DO $$
DECLARE
  con text;
BEGIN
  FOR con IN
    SELECT c.conname
      FROM pg_constraint c
     WHERE c.conrelid = 'public.guest_saved_vendors'::regclass
       AND c.contype = 'u'
       AND (
         SELECT array_agg(a.attname::text ORDER BY a.attname::text)
           FROM unnest(c.conkey) AS k(attnum)
           JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
       ) = ARRAY['user_id', 'vendor_profile_id']
  LOOP
    EXECUTE format('ALTER TABLE public.guest_saved_vendors DROP CONSTRAINT %I', con);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.guest_saved_vendors'::regclass
       AND conname = 'guest_saved_vendors_user_shop_service_key'
  ) THEN
    ALTER TABLE public.guest_saved_vendors
      ADD CONSTRAINT guest_saved_vendors_user_shop_service_key
      UNIQUE (user_id, vendor_profile_id, vendor_service_id);
  END IF;
END $$;

-- The service FK is looked up by the supplier's delete cascade.
CREATE INDEX IF NOT EXISTS guest_saved_vendors_service_idx
  ON public.guest_saved_vendors (vendor_service_id)
  WHERE vendor_service_id IS NOT NULL;

COMMENT ON COLUMN public.guest_saved_vendors.vendor_service_id IS
  'The service this favorite names ("Mobile bar · SetnaProd"), owner 2026-11-06. NULL = the whole shop (every row before this column, a booking with no service on it, and a favorite whose service the supplier deleted). ON DELETE SET NULL.';

COMMENT ON TABLE public.guest_saved_vendors IS
  'FAVORITES (owner 2026-11-06, "favorites only exist if they have experienced the suppliers service. From an event"): a person''s favorite of a supplier service they experienced at source_event_id — as a host/co-host of the event after the day (a booked event_vendors row), or as a guest checked in at the door (guest_checkins). Host vs guest is decided at read time. One row per user + shop + service. Distinct from event_vendors (a shortlist inside one plan) and vendor_follows (the chat-gate relation).';

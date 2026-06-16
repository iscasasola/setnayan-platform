-- Migration: 20270108000100_inquiry_multi_service
--
-- Adds `requested_service_ids` UUID[] to event_vendors so a multi-service
-- inquiry (owner directive 2026-06-17: "bundle all selected services into ONE
-- thread") can persist the full set of vendor_services UUIDs the couple
-- expressed interest in at inquiry time.
--
-- Design notes:
--   • UUID[] (not a junction table) because the set is small (a vendor rarely
--     has more than 5–10 services), append-only after creation, and read by
--     the thread header in a single join. A junction table would add 2× query
--     complexity for no normalisation benefit at this scale.
--   • DEFAULT '{}'::uuid[] — existing rows stay as empty arrays (no nullability
--     complexity downstream, clean array-contains checks).
--   • ON DELETE behaviour: vendor_services rows can be deactivated but not
--     typically deleted. If a service IS deleted, its UUID simply becomes a
--     stale entry in the array — benign since the thread-header lookup
--     discards missing rows.
--   • RLS: event_vendors already has couple-write + couple-read + vendor-read
--     policies; no additional policy needed.
--   • GIN index on the array so `requested_service_ids @> ARRAY[some_uuid]`
--     (used by the "already inquired about this service?" check) is O(log n)
--     rather than sequential.

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS requested_service_ids UUID[] NOT NULL DEFAULT '{}';

-- GIN index enables efficient containment checks
CREATE INDEX IF NOT EXISTS event_vendors_requested_service_ids_gin
  ON public.event_vendors
  USING GIN (requested_service_ids);

COMMENT ON COLUMN public.event_vendors.requested_service_ids IS
  'UUIDs of vendor_services this couple expressed interest in when they sent '
  'the inquiry. Populated by the multi-service inquiry modal; empty array = '
  'pre-feature row or single-service inquiry that did not need the modal. '
  'Displayed as service-name tags in the thread header on both couple and '
  'vendor thread views.';

-- switcher_gallery_count_rpc
-- ============================================================================
-- AccountSwitcher gallery counts — replaces a full-row-scan performance bug in
-- getSwitcherData() (apps/web/app/_components/account-switcher/get-switcher-data.ts).
--
-- That function used to do
--   .from('papic_photos').select('event_id').in('event_id', eventIds)
-- to count photos per event — pulling ONE ROW PER PHOTO across every event the
-- user belongs to, just to tally them in JS. For a wedding with thousands of
-- tagged Papic photos, that's thousands of rows crossing the wire on every
-- render of ANY dashboard chrome (customer/vendor/admin all call
-- getSwitcherData via their layout). Replaced with a single grouped COUNT so
-- only the per-event totals cross the wire.
--
-- Self-gated via current_event_ids() (auth.uid()-scoped event_members lookup,
-- defined in 20260512000000_setnayan_base.sql) — no event_id input needed, so
-- there's no ID-list to validate/spoof. Matches the existing behavior exactly:
-- counts every papic_photos row per event (no hidden_at filter — the switcher
-- gallery card never excluded hidden photos before this migration either).
--
-- Idempotent: CREATE OR REPLACE + REVOKE/GRANT. No tables, no policies.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.current_user_gallery_counts()
RETURNS TABLE(
  event_id    UUID,
  photo_count INTEGER
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.event_id, COUNT(*)::INTEGER
  FROM public.papic_photos p
  WHERE p.event_id IN (SELECT public.current_event_ids())
  GROUP BY p.event_id;
$$;

REVOKE ALL ON FUNCTION public.current_user_gallery_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_gallery_counts() TO authenticated;

COMMENT ON FUNCTION public.current_user_gallery_counts() IS
  'AccountSwitcher gallery card. Per-event papic_photos count for the calling user''s own events (current_event_ids()-gated). Replaces a full-row-scan .select(event_id).in(...) that transferred one row per photo just to count them in JS.';

COMMIT;

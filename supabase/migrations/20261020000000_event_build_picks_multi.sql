-- ============================================================================
-- 20261020000000_event_build_picks_multi.sql
-- Allow MULTIPLE build picks per category for the multi-service folders
-- (owner 2026-06-09: "there are services that can accept more than 1 services" —
-- Look, Booths, Prints). Everything else stays single-pick, enforced at the app
-- layer (setBuildPick deletes the prior pick before inserting for single folders).
--
-- The original PK (event_id, plan_group_id) hard-capped one pick per category at
-- the DB level. Widen it to (event_id, plan_group_id, vendor_id) so a category
-- can hold several distinct vendors; idempotency (same vendor added twice) is
-- still guaranteed by the vendor_id in the key. Existing rows are already unique
-- on the wider key, so the swap is data-safe.
-- ============================================================================

ALTER TABLE public.event_build_picks DROP CONSTRAINT IF EXISTS event_build_picks_pkey;
ALTER TABLE public.event_build_picks
  ADD CONSTRAINT event_build_picks_pkey PRIMARY KEY (event_id, plan_group_id, vendor_id);

-- A per-category lookup index (the old PK used to serve this) so "picks for this
-- (event, group)" stays fast now that the leading PK columns aren't unique alone.
CREATE INDEX IF NOT EXISTS event_build_picks_event_group_idx
  ON public.event_build_picks (event_id, plan_group_id);

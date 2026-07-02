-- vendor_branch_geocode_coords
--
-- Branches gain a precise map location so the vendor can DROP A PIN when adding
-- one (My Shop → Branches, owner 2026-07-02) instead of typing a city. The pin
-- reverse-geocodes to `branch_city` (kept — it's what the dashboard shows) and
-- stores the exact coords + the resolved address here. Coords also let the
-- coverage-reach map draw each branch's ring, not just the HQ's.
--
-- Columns are nullable: legacy branches (typed-city, pre-pin) keep working with
-- NULL coords, and a pin-drop that fails to reverse-geocode still saves coords
-- with a NULL address. RLS is unchanged — these are new columns on the existing
-- vendor_branches table (owner/admin manage via current_vendor_profile_ids()).

ALTER TABLE public.vendor_branches
  ADD COLUMN IF NOT EXISTS branch_latitude  numeric,
  ADD COLUMN IF NOT EXISTS branch_longitude numeric,
  ADD COLUMN IF NOT EXISTS branch_address   text;

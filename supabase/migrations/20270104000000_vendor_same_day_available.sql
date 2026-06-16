-- Event Lifecycle Menu · PR5 — same-day "Get help" (2026-06-16).
--
-- A vendor opt-in flag: "I'm willing to take a same-day / day-of job." On the
-- wedding day, if something goes wrong (a no-show, a last-minute gap), the
-- couple's Day-of "Get help" card surfaces a shortlist of nearby vendors who
-- have opted in — sorted by distance from the venue. The escalation-to-support
-- CTA stays the floor; this shortlist is the "fire a flare" above it.
--
-- Scope (per spec §4): the shortlist is filtered to public_visibility='verified'
-- AND tier_state <> 'free' AND same_day_available=TRUE. The tier gate matters —
-- only PAID vendors surface, whose names are always visible (free+verified names
-- stay masked until first chat reply per the hybrid-anonymity doctrine), and who
-- have skin in the game. V1 is filter + escalation only; real same-day BOOKING
-- is V1.5.
--
-- RLS: no policy change. `same_day_available` is a plain column on the existing
-- vendor_profiles table — the vendor edits it through the same self-update path
-- as every other profile field, and the public read of verified profiles already
-- exposes the row. Default FALSE so nothing changes until a vendor opts in.

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS same_day_available BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.vendor_profiles.same_day_available IS
  'Vendor opt-in (Event Lifecycle Menu PR5): willing to take same-day / day-of jobs. Surfaces the vendor in the couple Day-of Get-help shortlist (verified + paid tier only). Default FALSE.';

-- Partial index for the shortlist filter — tiny working set (only opted-in
-- vendors are indexed), so the day-of query never scans the whole table.
CREATE INDEX IF NOT EXISTS vendor_profiles_same_day_idx
  ON public.vendor_profiles (same_day_available)
  WHERE same_day_available;

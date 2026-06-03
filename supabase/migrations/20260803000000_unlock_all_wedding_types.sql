-- 20260803000000_unlock_all_wedding_types.sql
-- Owner-directed 2026-06-03: "unlock all religions."
--
-- Iteration 0043 shipped catholic + civil as 'active' and christian / inc /
-- muslim / cultural as 'coming_soon' (gated behind per-region vendor density).
-- This flips every wedding_type_launch_status row to 'active' so all faiths are
-- selectable in the create-event picker (data-driven by this table) and the
-- onboarding flow (hardcoded mirror flipped in the same change).
--
-- The create-event picker already collects + validates the muslim/cultural
-- tradition sub-type; the onboarding flow defaults it (general_muslim / other)
-- since it has no tradition step.
--
-- Idempotent: only touches rows that aren't already active, and stamps
-- activated_at only where it was still NULL so re-runs don't churn the timestamp.

UPDATE public.wedding_type_launch_status
SET
  status       = 'active',
  activated_at = COALESCE(activated_at, NOW()),
  updated_at   = NOW()
WHERE status <> 'active';

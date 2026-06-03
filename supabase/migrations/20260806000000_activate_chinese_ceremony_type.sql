-- 20260806000000_activate_chinese_ceremony_type.sql
-- Owner-directed 2026-06-03: ship the Chinese / Tsinoy wedding as a FULLY
-- SELECTABLE ceremony tradition, not "coming soon".
--
-- Migration 20260804000000 added 'chinese' but seeded its launch-status row as
-- 'coming_soon' (gated until vendor density). The owner reviewed the live
-- onboarding flow and decided Chinese should be selectable now, like the other
-- six faiths that were unlocked on 2026-06-03 — a lone gated faith was
-- inconsistent. This flips the row to 'active' so the create-event picker
-- (data-driven by this table) lets couples pick it. The matching commit also
-- adds 'chinese' to the ALLOWED_CEREMONIES / ALLOWED_CEREMONY_TYPES allow-lists
-- in the onboarding, create-event, and dashboard-modal server actions, and
-- un-greys the chips. No CHECK-constraint change is needed — 20260804000000
-- already widened all four ceremony_type constraints to permit 'chinese'.
--
-- Idempotent + re-runnable.

UPDATE public.wedding_type_launch_status
SET status = 'active',
    activated_at = COALESCE(activated_at, now())
WHERE ceremony_type = 'chinese'
  AND region = 'all'
  AND status <> 'active';

-- Safety net: if 20260804000000's seed was skipped (row absent for any reason),
-- insert it directly as active so the picker doesn't fall back to a stale state.
INSERT INTO public.wedding_type_launch_status (ceremony_type, region, status, activated_at)
VALUES ('chinese', 'all', 'active', now())
ON CONFLICT (ceremony_type, region) DO NOTHING;

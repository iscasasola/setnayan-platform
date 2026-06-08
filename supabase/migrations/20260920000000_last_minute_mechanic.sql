-- Setnayan AI — the last-minute mechanic (build PR-3).
--
-- The §4 net-new layer of What_Is_Setnayan_AI_2026-06-08.md (owner-locked
-- 2026-06-08 · §9.3). Two data homes, dormant by default:
--
--   1. Last-minute START — PLATFORM-set, per taxonomy leaf. The month when
--      "last-minute" begins for a category. Reuses planning_deadlines — the
--      codebase's canonical "admin-set, per-category-or-leaf, months counted
--      back from the wedding" config table — via a new kind='last_minute_start'.
--      Category default (scope='category', ref_key = plan-group id) + per-leaf
--      override (scope='leaf', ref_key = canonical service). NO SEED: with no
--      START row the whole mechanic is inert (every zone resolves to 'normal'),
--      so production is unchanged until the owner dials in START per category
--      (the START months are a load-bearing platform-design value — not
--      invented here). Edited from /admin/taxonomy beside the deadline control.
--
--   2. Last-minute END (floor) + optional surcharge — VENDOR-set, per service,
--      on vendor_services. END = "I'll still accept a booking until this month
--      before the wedding" (NULL → 0 = until the night before). Surcharge =
--      optional 0–100% bump within the last-minute window (NULL/0 = flat).
--
-- Additive + safe + idempotent: a new enum value + two nullable columns, no
-- data change, no behavior change. The read path (upcoming-items.ts) filters
-- planning_deadlines on kind='service', so the new kind never leaks into
-- deadline reminders.

-- ── 1. planning_deadlines: allow kind='last_minute_start' ──────────────────
-- The original CHECK is the inline-named planning_deadlines_kind_check.
ALTER TABLE public.planning_deadlines
  DROP CONSTRAINT IF EXISTS planning_deadlines_kind_check;
ALTER TABLE public.planning_deadlines
  ADD CONSTRAINT planning_deadlines_kind_check
  CHECK (kind IN ('service', 'milestone', 'document', 'last_minute_start'));

COMMENT ON COLUMN public.planning_deadlines.ref_key IS
  'For kind=service/last_minute_start: a plan-group id (scope=category) or a canonical service leaf (scope=leaf). For document/milestone: the doc/milestone key. last_minute_start rows hold the per-leaf month when last-minute begins (Setnayan AI §4); no rows seeded → mechanic dormant.';

-- ── 2. vendor_services: per-service last-minute floor + surcharge ───────────
ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS last_minute_end_months    SMALLINT,
  ADD COLUMN IF NOT EXISTS last_minute_surcharge_pct SMALLINT;

ALTER TABLE public.vendor_services
  DROP CONSTRAINT IF EXISTS vendor_services_last_minute_end_months_check;
ALTER TABLE public.vendor_services
  ADD CONSTRAINT vendor_services_last_minute_end_months_check
  CHECK (last_minute_end_months IS NULL OR last_minute_end_months >= 0);

ALTER TABLE public.vendor_services
  DROP CONSTRAINT IF EXISTS vendor_services_last_minute_surcharge_pct_check;
ALTER TABLE public.vendor_services
  ADD CONSTRAINT vendor_services_last_minute_surcharge_pct_check
  CHECK (last_minute_surcharge_pct IS NULL
         OR (last_minute_surcharge_pct >= 0 AND last_minute_surcharge_pct <= 100));

COMMENT ON COLUMN public.vendor_services.last_minute_end_months IS
  'Vendor''s last-minute floor: still accepts a booking until this many months before the wedding. NULL → 0 = until the night before (Setnayan AI §4.1).';
COMMENT ON COLUMN public.vendor_services.last_minute_surcharge_pct IS
  'Optional 0–100% price bump within the last-minute window. NULL/0 = flat (last-minute is opt-in; a vendor may use it purely to stay discoverable late, §4.3).';

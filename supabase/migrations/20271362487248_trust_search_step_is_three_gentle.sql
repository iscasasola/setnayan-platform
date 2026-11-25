-- trust_search_step_is_three_gentle
-- Created via `pnpm migration:new`. Data only: no schema change.
--
-- Owner, verbatim, 24 Nov 2026: "3 — gentle" (DECISION_LOG, the row that
-- follows the 21 Nov "trusted shops rank higher in search" ruling).
-- platform_settings.trust_search_step = 3, so a shop moves up one search step
-- at 1, 3, 9, 27 … real, mutual, qualified trusted partners.
--
-- The column was added NULL ("trust lifts nobody") by
-- 20271361607663_trust_needs_one_completed_paid_event_served_together.sql,
-- live since the 24 Nov ship train (#8264). Its CHECK allows 2..10.
--
-- Guarded: it writes 3 only while the value is still NULL, so it never
-- overwrites a number an admin has since set in Admin › Settings, and
-- re-applying it changes nothing.
UPDATE public.platform_settings
   SET trust_search_step = 3
 WHERE id = 1
   AND trust_search_step IS NULL;

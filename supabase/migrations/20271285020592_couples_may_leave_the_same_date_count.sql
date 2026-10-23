-- A couple may leave the same-date count.
--
-- ⚖ DPO ruling 2026-10-23 (corpus DECISION_LOG, "OWNER ANSWERS ON THE BUILD
-- TRACKER"): *"couples may opt out of the same-date count"*. Until now /privacy
-- said plainly "You cannot switch this one off" (RoPA DPS-17 carried the open
-- question for the DPO). This is the switch.
--
-- What it does: an event with this set is left out of the count other couples
-- see ("N other couples inquired for your date"). It does not change what this
-- couple sees, and it never reaches a supplier.
--
-- ── GRANTS ──────────────────────────────────────────────────────────────────
-- `events` SELECT is a column allowlist (20271007100000), so a new column is
-- born unreadable to `authenticated`: GRANT SELECT so the couple's own settings
-- page can read their answer. NO UPDATE grant — `events` UPDATE RLS is
-- row-level, so the couple writes it through a membership-checked server action
-- on the service role, the same shape as `live_media_public`.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS same_date_count_opt_out boolean NOT NULL DEFAULT false;

GRANT SELECT (same_date_count_opt_out) ON public.events TO authenticated;

COMMENT ON COLUMN public.events.same_date_count_opt_out IS
  'The couple left the same-date count (DPO ruling 2026-10-23). TRUE = this '
  'event never contributes to the "N other couples inquired for your date" '
  'count other couples see. Read by the couple vendors page holds query; '
  'written by setSameDateCountOptOut (service-role, host-checked).';

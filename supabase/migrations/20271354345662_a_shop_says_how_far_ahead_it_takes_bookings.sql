-- ============================================================================
-- HOW FAR AWAY A SHOP TAKES BOOKINGS — "At least" and "At most" (owner 2026-11-19, DECISION_LOG
-- "HOW FAR AWAY A SHOP TAKES BOOKINGS: AT LEAST AND AT MOST, EMPTY AT MOST = 3 YEARS"; approved drawing
-- `prototypes/schedule_questions_placement_2026-11-19.html` §5, "OK all").
--
-- Owner, verbatim: "how far away min max: from 7 days - 2 years." · "at least and at most" ·
-- "if at most is not set. you can book up to 3 years from now".
--
-- One shop setting, every card, in Clients ⚙ › Teams and days:
--   1. vendor_profiles.booking_min_days   — At least: days of notice before the event. NULL = the same day is
--                                            allowed (gap D). The drawing's picks are 0 · 3 · 7 · 14 · 30.
--   2. vendor_profiles.booking_max_months — At most: how far ahead, in months. NULL = 3 years (36 months), which
--                                            replaces the fixed `CHECK_DATE_MONTHS_AHEAD = 37` in lib/check-a-date.ts.
--                                            The drawing's picks are 6 · 12 · 24 · 36.
--
-- The rule is read in TypeScript (`lib/booking-window.ts`), by the couple's date checks — Check a date
-- (`lib/check-a-date.server.ts`), Find (`lib/bench-bookable-days.server.ts`) — and by the ask (`finalizeVendor`),
-- where a card's own "Order at least N days before" can only make its card STRICTER than the shop's At least.
-- `service_cards_unbookable_on` is deliberately NOT redefined: it mirrors the lock's calendar refusals, held line by
-- line by `lib/h6-mirrors-the-booking-path.test.ts`; the window is a statement about dates, not about the calendar.
--
-- Written by the shop's own session (vendor_profiles_owner, FOR ALL on its own row — the same door the waiting-list
-- settings use). Read by the shop's team and couples through `authenticated`; never by anon (the table-level grant
-- would hand a new column to anon, so the readers are named — the paused_at pattern, 20271350091032).
-- Idempotent.
-- ============================================================================

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS booking_min_days INT;
ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS booking_max_months INT;

ALTER TABLE public.vendor_profiles DROP CONSTRAINT IF EXISTS vendor_profiles_booking_min_days_check;
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_booking_min_days_check
  CHECK (booking_min_days IS NULL OR booking_min_days BETWEEN 0 AND 30);

ALTER TABLE public.vendor_profiles DROP CONSTRAINT IF EXISTS vendor_profiles_booking_max_months_check;
ALTER TABLE public.vendor_profiles
  ADD CONSTRAINT vendor_profiles_booking_max_months_check
  CHECK (booking_max_months IS NULL OR booking_max_months BETWEEN 1 AND 36);

COMMENT ON COLUMN public.vendor_profiles.booking_min_days IS
  'At least: how many days before the event a couple must book this shop, for every card (owner 2026-11-19, '
  'Clients ⚙ › Teams and days). NULL or 0 = the same day is allowed. A card''s own order_lead_days can only be '
  'stricter. Read by lib/booking-window.ts.';
COMMENT ON COLUMN public.vendor_profiles.booking_max_months IS
  'At most: how many months ahead a couple can book this shop, for every card (owner 2026-11-19, Clients ⚙ › Teams '
  'and days). NULL = 3 years (36 months). Read by lib/booking-window.ts.';

GRANT SELECT (booking_min_days) ON public.vendor_profiles TO authenticated;
GRANT SELECT (booking_max_months) ON public.vendor_profiles TO authenticated;
REVOKE SELECT (booking_min_days) ON public.vendor_profiles FROM anon;
REVOKE SELECT (booking_max_months) ON public.vendor_profiles FROM anon;

-- ── The shop's own view re-projected (its projection is frozen at CREATE) ──
-- `lint-vendor-profiles-column-grants.mjs`: a new vendor_profiles column must reach vendor_profiles_self, or the shop's
-- own dashboard reads it as always empty. The 20271350091032 block verbatim, with the two window columns added to its
-- anti-vacuity check.
DROP VIEW IF EXISTS public.vendor_profiles_self;

DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg('vp.' || quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'vendor_profiles';
  IF cols IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: computed vendor_profiles_self projection is empty';
  END IF;
  IF position('find_locked_at' IN cols) = 0 OR position('is_findable' IN cols) = 0
     OR position('gallery_video_titles' IN cols) = 0
     OR position('papers_lapsed_at' IN cols) = 0 OR position('papers_current' IN cols) = 0
     OR position('paused_at' IN cols) = 0 OR position('paused_by' IN cols) = 0
     OR position('booking_min_days' IN cols) = 0 OR position('booking_max_months' IN cols) = 0 THEN
    RAISE EXCEPTION 'ANTI-VACUITY FAILED: vendor_profiles_self would not carry the find-lock, video-title, papers, pause or booking-window columns';
  END IF;
  EXECUTE format($v$
    CREATE VIEW public.vendor_profiles_self
      WITH (security_invoker = false) AS
      SELECT %s
        FROM public.vendor_profiles vp
       WHERE vp.user_id = auth.uid()
          OR vp.vendor_profile_id IN (SELECT public.current_vendor_ids('viewer'))
  $v$, cols);
END $$;

ALTER VIEW public.vendor_profiles_self OWNER TO postgres;
REVOKE ALL ON public.vendor_profiles_self FROM PUBLIC;
REVOKE ALL ON public.vendor_profiles_self FROM anon;
REVOKE ALL ON public.vendor_profiles_self FROM authenticated;
GRANT SELECT ON public.vendor_profiles_self TO authenticated, service_role;

COMMENT ON VIEW public.vendor_profiles_self IS
  'Definer view: the caller''s OWN shops (owner via user_id = auth.uid(), or a '
  'team member via current_vendor_ids(''viewer'')), projecting every '
  'vendor_profiles column INCLUDING the eleven tax/registration/owner-identity '
  'columns that 20271217955839 revoked from `authenticated` at table level. '
  'Predicate mirrors policies vendor_profiles_owner + vendor_profiles_member_read '
  'exactly -- it widens nothing. SELECT ONLY: an auto-updatable definer view '
  'would let a teammate write past vendor_profiles_owner. Admin and public '
  'surfaces do NOT use this -- they read the table on the service-role client.';

-- a_card_books_by_its_own_availability_style
-- Created via `pnpm migration:new`. Idempotent — safe to re-apply.
--
-- AVAILABILITY PLAN, STEP 3 — A SERVICE CARD CARRIES ITS OWN AVAILABILITY STYLE (owner "ok" to every pick on
-- prototypes/availability_steps_3_4_2026-11-19.html, DECISION_LOG 2026-11-19 "AVAILABILITY STEPS 3 AND 4 APPROVED").
--
-- 1 · vendor_services.availability_style — the card's own style, one of the same seven values as
--     canonical_service_taxonomy.availability_style (step 2, 20271350696878). The card maker pre-fills it from the
--     service's style ("Recommended for … · Use it"). NULL = NOT SET: the card behaves exactly as it did before this
--     migration — nothing here reads NULL as `day`. apps/web/lib/availability-styles.test.ts holds this CHECK to the
--     code's one list, like the taxonomy's.
--
-- 2 · vendor_services.order_lead_days — "Order at least N days before the date they need it" (Made to order only).
--     A hard rule, checked when a couple asks (finalizeVendor, through service_card_order_lead_days below). It sits
--     BESIDE "Book ahead (months)" (`recommended_lead_time_months`), which stays advice (owner ruling 1). NULL or 0 =
--     no rule. 0..365.
--
-- 3 · service_card_daily_limit — an Always available card (AV-NONE) has NO limit: it is never counted (owner ruling
--     4 — a couple still gives the event date, but it is never counted). Every other card is unchanged: the card's
--     own daily_capacity. A card Not set still reads its daily_capacity, as before.
--
-- 4 · service_card_order_lead_days(card) — the one server-only reader of (2): the days, or NULL when the card is
--     not Made to order or has no rule. EXECUTE is service_role only, like service_card_daily_limit.
--
-- "Rented by the piece" has NO cap above 500 (owner ruling 3). vendor_services.daily_capacity has never had an
-- upper bound in SQL (CHECK > 0 only, 20260925000002), so nothing changes here; the app's 500 ceiling is skipped for
-- a piece card (lib/card-bookings-per-date.ts).
--
-- RLS / GRANTS: vendor_services keeps its row-ownership policies. The two new columns inherit the table-level grants
-- like their siblings (a shop already writes every column of its own cards); neither reveals anything about a
-- couple. Recorded in the exposure baseline in the same PR.
--
-- Production today: no card carries a style (the column is new) — no booking accepted yesterday is refused today.

BEGIN;

ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS availability_style TEXT,
  ADD COLUMN IF NOT EXISTS order_lead_days INT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'vendor_services_availability_style_check'
       AND conrelid = 'public.vendor_services'::regclass
  ) THEN
    ALTER TABLE public.vendor_services
      ADD CONSTRAINT vendor_services_availability_style_check
      CHECK (availability_style IS NULL OR availability_style IN ('day', 'order', 'hour', 'piece', 'time', 'night', 'none'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'vendor_services_order_lead_days_check'
       AND conrelid = 'public.vendor_services'::regclass
  ) THEN
    ALTER TABLE public.vendor_services
      ADD CONSTRAINT vendor_services_order_lead_days_check
      CHECK (order_lead_days IS NULL OR order_lead_days BETWEEN 0 AND 365);
  END IF;
END $$;

COMMENT ON COLUMN public.vendor_services.availability_style IS
  'How this card books (Availability plan step 3, owner 2026-11-19): day · order · hour · piece · time · night · none. '
  'Pre-filled from canonical_service_taxonomy.availability_style. NULL = Not set — the card behaves as before; never read as day. '
  'Code source: apps/web/lib/availability-styles.ts.';
COMMENT ON COLUMN public.vendor_services.order_lead_days IS
  'Made to order: couples must order at least this many days before the date they need it (checked when a couple asks). '
  'NULL or 0 = no rule. Beside recommended_lead_time_months, which stays advice (owner ruling 1, 2026-11-19).';

CREATE OR REPLACE FUNCTION public.service_card_daily_limit(p_service_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN vs.availability_style = 'none' THEN NULL ELSE NULLIF(vs.daily_capacity, 0) END
    FROM public.vendor_services vs
   WHERE vs.vendor_service_id = p_service_id;
$function$;

COMMENT ON FUNCTION public.service_card_daily_limit(uuid) IS
  'The most bookings this service takes on one date: the card''s OWN daily_capacity — no plan cap since 2026-11-18 '
  '(owner, ruling 17). NULL = no per-card limit, and ALWAYS NULL for an Always available card (availability_style '
  '''none'', owner 2026-11-19 ruling 4: never counted). Read by vendor_agree_to_lock, vendor_day_check and '
  'service_cards_unbookable_on. Bookings already held are never touched.';

REVOKE ALL ON FUNCTION public.service_card_daily_limit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_card_daily_limit(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.service_card_order_lead_days(p_service_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN vs.availability_style = 'order' THEN NULLIF(vs.order_lead_days, 0) ELSE NULL END
    FROM public.vendor_services vs
   WHERE vs.vendor_service_id = p_service_id;
$function$;

COMMENT ON FUNCTION public.service_card_order_lead_days(uuid) IS
  'Made to order: how many days before the date a couple must order this card, or NULL when the card is not Made to '
  'order or sets no rule (owner 2026-11-19). Read when a couple asks (finalizeVendor). Server-only.';

REVOKE ALL ON FUNCTION public.service_card_order_lead_days(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_card_order_lead_days(uuid) TO service_role;

COMMIT;

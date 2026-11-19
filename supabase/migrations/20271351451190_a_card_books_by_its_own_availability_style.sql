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


-- ── Copy to another branch carries the card's style ─────────────────────────
-- copy_vendor_service_to_branch lists every authored column by name (body identical to
-- 20271348490157 plus availability_style + order_lead_days), so a branch copy books the same way.
-- ⚠ Any later migration that redefines it must keep these two columns.
CREATE OR REPLACE FUNCTION public.copy_vendor_service_to_branch(
  p_vendor_profile_id UUID,
  p_source_service_id UUID,
  p_branch_id         UUID,      -- NULL = the main location
  p_price_php         INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s          public.vendor_services%ROWTYPE;
  v_new_id   UUID := gen_random_uuid();
  v_pool_id  UUID;
  v_capacity INTEGER;
  v_label    TEXT;
  v_start    INTEGER;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND p_vendor_profile_id NOT IN (SELECT public.current_vendor_ids('admin')) THEN
    RAISE EXCEPTION 'Only an admin of this shop can copy its cards.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_price_php IS NULL OR p_price_php <= 0 OR p_price_php > 100000000 THEN
    RAISE EXCEPTION 'Set the price there before you copy.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO s FROM public.vendor_services
   WHERE vendor_service_id = p_source_service_id AND vendor_profile_id = p_vendor_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not found.' USING ERRCODE = 'no_data_found';
  END IF;
  IF s.branch_id IS NOT DISTINCT FROM p_branch_id THEN
    RAISE EXCEPTION 'That card is already at this branch.' USING ERRCODE = 'check_violation';
  END IF;

  IF p_branch_id IS NOT NULL THEN
    SELECT branch_label INTO v_label FROM public.vendor_branches
     WHERE branch_id = p_branch_id AND parent_vendor_profile_id = p_vendor_profile_id AND cancelled_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That branch is not one of yours.' USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    v_label := 'Main';
  END IF;

  -- "Price there" is the card's headline number on its own basis; the "from ₱X" anchor follows it the same way
  -- parsePricingFields (services/actions.ts) computes it.
  v_start := CASE COALESCE(s.pricing_basis, 'fixed')
               WHEN 'per_pax'  THEN p_price_php * COALESCE(NULLIF(s.min_pax, 0), 1)
               ELSE p_price_php
             END;

  PERFORM set_config('setnayan.branch_copy', 'on', true);
  INSERT INTO public.vendor_services (
    vendor_service_id, vendor_profile_id, category, title, branch_id, branch_copy_of, is_active,
    starting_price_php, per_pax_price_php, hour_base_php,
    crew_size, crew_meal_required, crew_meal_included, transport_included, transport_flat_fee_php,
    package_inclusions, primary_photo_r2_key, showcase_video_r2_key, showcase_photo_r2_keys,
    last_minute_end_months, last_minute_surcharge_pct, daily_capacity, is_linked_only,
    added_pax_price_php, added_pax_block, recommended_lead_time_months, exclusive_perk_text,
    is_demo, demo_batch_id, base_pax, coverage_id, pricing_basis, min_pax, min_hours, extra_hour_php,
    includes_setnayan_gift, gift_pack_code, category_request_id,
    availability_style, order_lead_days
  ) VALUES (
    v_new_id, s.vendor_profile_id, s.category, s.title, p_branch_id, s.vendor_service_id, s.is_active,
    v_start,
    CASE WHEN s.pricing_basis = 'per_pax'  THEN p_price_php ELSE s.per_pax_price_php END,
    CASE WHEN s.pricing_basis = 'per_hour' THEN p_price_php ELSE s.hour_base_php END,
    s.crew_size, s.crew_meal_required, s.crew_meal_included, s.transport_included, s.transport_flat_fee_php,
    s.package_inclusions, s.primary_photo_r2_key, s.showcase_video_r2_key, s.showcase_photo_r2_keys,
    s.last_minute_end_months, s.last_minute_surcharge_pct, s.daily_capacity, s.is_linked_only,
    s.added_pax_price_php, s.added_pax_block, s.recommended_lead_time_months, s.exclusive_perk_text,
    s.is_demo, s.demo_batch_id, s.base_pax, s.coverage_id, s.pricing_basis, s.min_pax, s.min_hours, s.extra_hour_php,
    s.includes_setnayan_gift, s.gift_pack_code, s.category_request_id,
    s.availability_style, s.order_lead_days
  );

  PERFORM set_config('setnayan.branch_copy', '', true);

  INSERT INTO public.vendor_service_price_brackets (vendor_service_id, vendor_profile_id, min_pax, max_pax, price_php, sort_order)
  SELECT v_new_id, vendor_profile_id, min_pax, max_pax, price_php, sort_order
    FROM public.vendor_service_price_brackets WHERE vendor_service_id = s.vendor_service_id;

  INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label, worth_php, sort_order)
  SELECT v_new_id, vendor_profile_id, label, worth_php, sort_order
    FROM public.vendor_service_inclusions WHERE vendor_service_id = s.vendor_service_id;

  INSERT INTO public.vendor_service_discounts (vendor_service_id, vendor_profile_id, discount_type, rate, unit, expires_at, conditions_md, sort_order, min_lead_months)
  SELECT v_new_id, vendor_profile_id, discount_type, rate, unit, expires_at, conditions_md, sort_order, min_lead_months
    FROM public.vendor_service_discounts WHERE vendor_service_id = s.vendor_service_id;

  INSERT INTO public.vendor_service_addons (vendor_service_id, vendor_profile_id, label, from_price_php, sort_order)
  SELECT v_new_id, vendor_profile_id, label, from_price_php, sort_order
    FROM public.vendor_service_addons WHERE vendor_service_id = s.vendor_service_id;

  INSERT INTO public.vendor_service_payment_schedules (vendor_service_id, vendor_profile_id, seq, label, amount_kind, percent_bps, amount_centavos, due_anchor, due_offset_days, cancellation_terms, downpayment_non_refundable, refund_window_days, no_show_forfeit)
  SELECT v_new_id, vendor_profile_id, seq, label, amount_kind, percent_bps, amount_centavos, due_anchor, due_offset_days, cancellation_terms, downpayment_non_refundable, refund_window_days, no_show_forfeit
    FROM public.vendor_service_payment_schedules WHERE vendor_service_id = s.vendor_service_id;

  INSERT INTO public.vendor_service_time_slots (vendor_service_id, vendor_profile_id, slot_label, start_time, end_time, slot_capacity, display_order, is_active, seat_capacity)
  SELECT v_new_id, vendor_profile_id, slot_label, start_time, end_time, slot_capacity, display_order, is_active, seat_capacity
    FROM public.vendor_service_time_slots WHERE vendor_service_id = s.vendor_service_id;

  -- Its own calendar: a new vendor-named pool, as many a day as the original's calendar allows.
  SELECT p.daily_booking_capacity INTO v_capacity
    FROM public.vendor_schedule_calendar_services c
    JOIN public.vendor_schedule_pools p ON p.pool_id = c.pool_id
   WHERE c.vendor_service_id = s.vendor_service_id;
  INSERT INTO public.vendor_schedule_pools (vendor_profile_id, pool_label, calendar_name, daily_booking_capacity, is_vendor_created)
  VALUES (
    s.vendor_profile_id,
    left(COALESCE(NULLIF(btrim(s.title), ''), s.category) || ' · ' || v_label, 80),
    left(COALESCE(NULLIF(btrim(s.title), ''), s.category) || ' · ' || v_label, 80),
    LEAST(GREATEST(COALESCE(v_capacity, 1), 1), 50),
    TRUE
  )
  RETURNING pool_id INTO v_pool_id;
  INSERT INTO public.vendor_schedule_calendar_services (vendor_service_id, pool_id, vendor_profile_id)
  VALUES (v_new_id, v_pool_id, s.vendor_profile_id);

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.copy_vendor_service_to_branch(UUID, UUID, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_vendor_service_to_branch(UUID, UUID, UUID, INTEGER) TO authenticated, service_role;

COMMENT ON FUNCTION public.copy_vendor_service_to_branch(UUID, UUID, UUID, INTEGER) IS
  'Copy to another branch (owner 2026-11-14, item 10). Admin of the shop only. Copies the card''s AUTHORED fields and children, references the same photos, sets branch_copy_of (so it uses no card), gives it its own price and its own schedule pool. Never copies bookings, reviews, halls, agents or the public id.';

COMMIT;

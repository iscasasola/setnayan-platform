-- A CARD HAS A DESCRIPTION AND A VIDEO LINK — Card Maker HYBRID part 2 (schema).
--
-- Ruling: HYBRID map Q3 "Description + video link: add in this build (pick)" (spec corpus
-- prototypes/service_card_maker_HYBRID_MAP_2026-11-17.md, rows "Video link" and "Description", both
-- RULED-NEEDS-SCHEMA: "none on vendor_services"), placed under More details by the 17 Nov clean rebuild, and
-- built onto the shipped one-page maker per 2026-11-18 "extend the app's one-page maker".
--
--   • description — a few plain sentences about this card, shown on the full card. Words only.
--   • video_url   — a link to a video hosted elsewhere (YouTube, Facebook, TikTok, Vimeo…). Distinct from the
--                   shipped 30-second clip (showcase_video_r2_key), which is an upload we store. https only.
--
-- Both are optional and NULL by default: no card changes until its supplier types something. Both are part of
-- the card couples already read (vendor_services_public_read is untouched, and vendor_services carries no
-- column grants, so the new columns follow the table's own policies).
--
-- copy_vendor_service_to_branch lists the card's authored columns BY NAME, so a column added without it would
-- be silently dropped on "Copy to another branch". It is redefined below, unchanged except that it now carries
-- description, video_url and pay_plan_id (the plan from 20271350884376 — same shop, so the copy follows it too).
BEGIN;

ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS description TEXT
    CHECK (description IS NULL OR char_length(btrim(description)) BETWEEN 1 AND 1000),
  ADD COLUMN IF NOT EXISTS video_url TEXT
    CHECK (video_url IS NULL OR (char_length(video_url) <= 500 AND video_url ~* '^https://[^[:space:]]+$'));

COMMENT ON COLUMN public.vendor_services.description IS
  'A few plain sentences about this card (HYBRID map Q3, 2026-11-17). NULL = none. Up to 1,000 characters.';
COMMENT ON COLUMN public.vendor_services.video_url IS
  'A link to a video of this service hosted elsewhere (HYBRID map Q3, 2026-11-17). https only, up to 500 characters. Not the 30-second clip (showcase_video_r2_key), which is an upload.';

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
    description, video_url, pay_plan_id
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
    s.description, s.video_url, s.pay_plan_id
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

COMMENT ON FUNCTION public.copy_vendor_service_to_branch(UUID, UUID, UUID, INTEGER) IS
  'Copy to another branch (owner 2026-11-14, item 10). Admin of the shop only. Copies the card''s AUTHORED fields and children, references the same photos, sets branch_copy_of (so it uses no card), gives it its own price and its own schedule pool. Never copies bookings, reviews, halls, agents or the public id. Since 20271351531329 it also carries the description, the video link and the pay plan the card follows.';

REVOKE ALL ON FUNCTION public.copy_vendor_service_to_branch(UUID, UUID, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_vendor_service_to_branch(UUID, UUID, UUID, INTEGER) TO authenticated, service_role;

COMMIT;

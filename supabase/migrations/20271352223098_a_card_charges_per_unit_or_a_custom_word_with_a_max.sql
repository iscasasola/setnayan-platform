-- A CARD CHARGES PER UNIT, OR PER A WORD OF ITS OWN, AND MAY HAVE A MAX — Card Maker part 7 (schema).
--
-- Rulings (spec corpus prototypes/service_card_maker_HYBRID_MAP_2026-11-17.md, rounds of 17 Nov, owner direct):
--   · "How you charge. Flat Price / Per Pax : Each Extra Pax : Max Pax / Per Hour : Each Extra Hour : Max Hours /
--      Per Unit : Each Extra Unit : Max Units / Custom : Custom" — Custom = the supplier types what they charge per
--      (sample "table"), and the typed word carries into the card ("per chair").
--   · "Base Price · Initial Hours / Starting Pax / Initial Units" — a base price for a starting number, then Each
--      extra past it, then Max.
--   · "max hours cannot be equal or less than Initial Hours. same with others. max hours can be blank to have no
--      limit." · "Values cannot be negative." · Flat price "no extra per pax, hour, unit" (so no Max on Flat).
-- Built onto the shipped one-page maker per 2026-11-18 "Yes, extend it".
--
--   • pricing_basis gains 'per_unit'. Custom is per_unit WITH a word (unit_word); Per unit is per_unit with none.
--   • unit_word       — what a Custom card charges per ("table", "chair"). NULL = "unit".
--   • unit_base_php   — the base price, for initial_units of them (the card's "from" figure).
--   • initial_units   — how many the base price covers.
--   • extra_unit_php  — each one past initial_units.
--   • price_max       — the most a card takes: guests (per_pax), hours (per_hour) or units (per_unit). NULL = no
--                       limit. Must be MORE than the starting number; never on a Flat price.
-- Per guest and Per hour keep their shipped columns (per_pax_price_php · min_pax · hour_base_php · min_hours ·
-- extra_hour_php); only price_max is new to them.
--
-- Additive: every existing row keeps its basis and reads NULL in the new columns, which every CHECK allows. The new
-- columns are part of the card couples already read (vendor_services_public_read is untouched; vendor_services
-- carries no column grants).
--
-- save_vendor_service IS redefined (from 20271222415682, its latest definition) to write the five in the SAME
-- statement as pricing_basis: a CHECK is checked per statement, so writing them after would refuse every per-unit
-- save (no base yet) and every switch back to a Flat price (a stale Max). Absent keys write NULL, as every other
-- per-basis column does. ⚠ Any later migration that redefines it must keep them.
--
-- copy_vendor_service_to_branch lists a card's columns BY NAME, so it is redefined to carry the five. 🔀 It is the
-- UNION of every earlier definition (review 2026-11-20): it starts from 20271352068061 (#8012 — availability_style,
-- order_lead_days and usual_prep_days, carried since 20271351451190 · #8011, and the 1..500 schedule cap) and adds
-- 20271351531329's description, video link and pay plan, then the five. Redefining it from 20271351531329 alone (as
-- first drafted) would have silently dropped a branch copy's Availability style, its "Order at least" and its usual
-- preparation time, and put the schedule cap back to 50 — undoing #8011 (live) and #8012. ⚠ Any later migration that
-- redefines it must keep EVERY column listed here (DB test: a-card-charges-per-unit… "a branch copy keeps …").
BEGIN;

ALTER TABLE public.vendor_services DROP CONSTRAINT IF EXISTS vendor_services_pricing_basis_check;
ALTER TABLE public.vendor_services
  ADD CONSTRAINT vendor_services_pricing_basis_check
    CHECK (pricing_basis IN ('fixed', 'per_pax', 'per_hour', 'per_unit'));

ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS unit_word TEXT
    CHECK (unit_word IS NULL OR (char_length(btrim(unit_word)) BETWEEN 1 AND 24 AND unit_word !~ '[0-9<>]')),
  ADD COLUMN IF NOT EXISTS unit_base_php INTEGER
    CHECK (unit_base_php IS NULL OR (unit_base_php > 0 AND unit_base_php <= 100000000)),
  ADD COLUMN IF NOT EXISTS initial_units INTEGER
    CHECK (initial_units IS NULL OR (initial_units > 0 AND initial_units <= 100000)),
  ADD COLUMN IF NOT EXISTS extra_unit_php INTEGER
    CHECK (extra_unit_php IS NULL OR (extra_unit_php >= 0 AND extra_unit_php <= 100000000)),
  ADD COLUMN IF NOT EXISTS price_max INTEGER
    CHECK (price_max IS NULL OR (price_max > 0 AND price_max <= 100000));

-- A per-unit card has its base price and its starting number; nothing else carries a word.
ALTER TABLE public.vendor_services DROP CONSTRAINT IF EXISTS vendor_services_per_unit_has_its_base;
ALTER TABLE public.vendor_services
  ADD CONSTRAINT vendor_services_per_unit_has_its_base
    CHECK (pricing_basis IS DISTINCT FROM 'per_unit' OR (unit_base_php IS NOT NULL AND initial_units IS NOT NULL));
ALTER TABLE public.vendor_services DROP CONSTRAINT IF EXISTS vendor_services_unit_word_is_per_unit;
ALTER TABLE public.vendor_services
  ADD CONSTRAINT vendor_services_unit_word_is_per_unit
    CHECK (unit_word IS NULL OR pricing_basis = 'per_unit');

-- Max: never on a Flat price, and always MORE than the starting number ("cannot be equal or less").
ALTER TABLE public.vendor_services DROP CONSTRAINT IF EXISTS vendor_services_price_max_above_the_start;
ALTER TABLE public.vendor_services
  ADD CONSTRAINT vendor_services_price_max_above_the_start
    CHECK (
      price_max IS NULL
      OR (
        COALESCE(pricing_basis, 'fixed') <> 'fixed'
        AND price_max > CASE pricing_basis
                          WHEN 'per_pax'  THEN COALESCE(min_pax, 0)
                          WHEN 'per_hour' THEN COALESCE(min_hours, 0)
                          WHEN 'per_unit' THEN COALESCE(initial_units, 0)
                          ELSE 0
                        END
      )
    );

COMMENT ON COLUMN public.vendor_services.unit_word IS
  'What a Custom card charges per ("table", "chair") — Card Maker part 7, HYBRID map 17 Nov. NULL = "unit". Only on pricing_basis = per_unit. 1–24 characters, no digits.';
COMMENT ON COLUMN public.vendor_services.unit_base_php IS
  'Per-unit card: the base price for initial_units units (the card''s "from" figure). Card Maker part 7.';
COMMENT ON COLUMN public.vendor_services.initial_units IS
  'Per-unit card: how many units the base price covers. Card Maker part 7.';
COMMENT ON COLUMN public.vendor_services.extra_unit_php IS
  'Per-unit card: the price of each unit past initial_units. Card Maker part 7.';
COMMENT ON COLUMN public.vendor_services.price_max IS
  'The most a card takes — guests (per_pax), hours (per_hour) or units (per_unit). NULL = no limit. Always more than the starting number; never on a Flat price. Card Maker part 7.';

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
               ELSE p_price_php   -- per_hour and per_unit: the base price IS the "from" figure
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
    description, video_url, pay_plan_id,
    unit_word, unit_base_php, initial_units, extra_unit_php, price_max,
    availability_style, order_lead_days, usual_prep_days
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
    s.description, s.video_url, s.pay_plan_id,
    s.unit_word,
    CASE WHEN s.pricing_basis = 'per_unit' THEN p_price_php ELSE s.unit_base_php END,
    s.initial_units, s.extra_unit_php, s.price_max,
    s.availability_style, s.order_lead_days, s.usual_prep_days
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
    LEAST(GREATEST(COALESCE(v_capacity, 1), 1), 500),  -- the schedule's own CHECK 1..500 (20271350427190), as #8012 set it
    TRUE
  )
  RETURNING pool_id INTO v_pool_id;
  INSERT INTO public.vendor_schedule_calendar_services (vendor_service_id, pool_id, vendor_profile_id)
  VALUES (v_new_id, v_pool_id, s.vendor_profile_id);

  RETURN v_new_id;
END;
$$;

COMMENT ON FUNCTION public.copy_vendor_service_to_branch(UUID, UUID, UUID, INTEGER) IS
  'Copy to another branch (owner 2026-11-14, item 10). Admin of the shop only. Copies the card''s AUTHORED fields and children, references the same photos, sets branch_copy_of (so it uses no card), gives it its own price and its own schedule pool. Never copies bookings, reviews, halls, agents or the public id. Since 20271351531329 it also carries the description, the video link and the pay plan the card follows; since 20271351451190 / 20271352068061 the Availability style, "Order at least", the usual preparation time and the 1..500 schedule cap; since 20271352223098 the per-unit price, its word and the Max.';

REVOKE ALL ON FUNCTION public.copy_vendor_service_to_branch(UUID, UUID, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_vendor_service_to_branch(UUID, UUID, UUID, INTEGER) TO authenticated, service_role;

-- ── save_vendor_service — reproduced from 20271222415682; ONE delta: the five part-7 columns in the INSERT and UPDATE.
CREATE OR REPLACE FUNCTION public.save_vendor_service(p_vendor_profile_id uuid, p_service_id uuid, p_fields jsonb, p_links jsonb, p_schedule jsonb, p_discounts jsonb, p_brackets jsonb, p_inclusions jsonb, p_publish boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_service_id uuid;
  v_perk       text;
  v_perk_given boolean;
  v_was_live   boolean;
BEGIN
  -- ② Distinguish "the caller cleared it" from "the caller never mentioned it".
  v_perk_given := p_fields ? 'exclusive_perk_text';
  v_perk       := NULLIF(btrim(COALESCE(p_fields->>'exclusive_perk_text', '')), '');

  -- ① The perk requirement WAS enforced here. It is not a requirement any more
  --    (owner 2026-09-09: "exclusive setnayan gift then should be optional").
  --    A card publishes on its PRICE alone; enforce_service_publish_gate() is
  --    the other half of that rule and already agrees.

  -- ③ H2 · GOING LIVE NEEDS A COVER, A PRICE AND WHAT'S INCLUDED (owner
  --    2026-09-09: "the cover-photo · title · inclusions requirements stay").
  --    Judged only when this save takes a card live — a card already live is
  --    flagged, never refused (see the migration header).
  IF p_publish THEN
    v_was_live := p_service_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.vendor_services
       WHERE vendor_service_id = p_service_id
         AND vendor_profile_id = p_vendor_profile_id
         AND is_active IS TRUE
    );
    IF NOT v_was_live THEN
      IF NULLIF(btrim(COALESCE(p_fields->>'primary_photo_r2_key', '')), '') IS NULL THEN
        RAISE EXCEPTION
          'Add a cover photo before you publish this card — it is the first thing a couple sees. You can still save it as a draft.'
          USING ERRCODE = 'check_violation';
      END IF;
      IF COALESCE((p_fields->>'starting_price_php')::int, 0) <= 0 THEN
        RAISE EXCEPTION
          'Set a starting price before you publish this card — it is how couples planning a budget find you. You can still save it as a draft.'
          USING ERRCODE = 'check_violation';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(p_inclusions, '[]'::jsonb)) AS e
         WHERE NULLIF(btrim(COALESCE(e->>'label', '')), '') IS NOT NULL
      ) THEN
        RAISE EXCEPTION
          'Add what is included before you publish this card — a couple needs to see what the price gets them. You can still save it as a draft.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  IF p_service_id IS NULL THEN
    INSERT INTO public.vendor_services (
      vendor_profile_id, category, title, starting_price_php, added_pax_price_php,
      base_pax, coverage_id,
      pricing_basis, per_pax_price_php, min_pax, hour_base_php, min_hours, extra_hour_php,
      unit_word, unit_base_php, initial_units, extra_unit_php, price_max,
      crew_size, crew_meal_required, crew_meal_included,
      transport_included, transport_flat_fee_php,
      showcase_video_r2_key, showcase_photo_r2_keys,
      branch_id, recommended_lead_time_months,
      last_minute_end_months, last_minute_surcharge_pct, daily_capacity,
      exclusive_perk_text, primary_photo_r2_key, includes_setnayan_gift, is_active
    ) VALUES (
      p_vendor_profile_id,
      p_fields->>'category',
      NULLIF(p_fields->>'title', ''),
      (p_fields->>'starting_price_php')::int,
      (p_fields->>'added_pax_price_php')::int,
      (p_fields->>'base_pax')::int,
      (p_fields->>'coverage_id')::bigint,
      COALESCE(p_fields->>'pricing_basis', 'fixed'),
      (p_fields->>'per_pax_price_php')::int,
      (p_fields->>'min_pax')::int,
      (p_fields->>'hour_base_php')::int,
      (p_fields->>'min_hours')::numeric,
      (p_fields->>'extra_hour_php')::int,
      NULLIF(btrim(p_fields->>'unit_word'), ''),
      (p_fields->>'unit_base_php')::int,
      (p_fields->>'initial_units')::int,
      (p_fields->>'extra_unit_php')::int,
      (p_fields->>'price_max')::int,
      (p_fields->>'crew_size')::int,
      COALESCE((p_fields->>'crew_meal_required')::boolean, FALSE),
      COALESCE((p_fields->>'crew_meal_included')::boolean, FALSE),
      COALESCE((p_fields->>'transport_included')::boolean, FALSE),
      (p_fields->>'transport_flat_fee_php')::int,
      NULLIF(p_fields->>'showcase_video_r2_key', ''),
      COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_fields->'showcase_photo_r2_keys', '[]'::jsonb))),
        ARRAY[]::text[]
      ),
      (p_fields->>'branch_id')::uuid,
      (p_fields->>'recommended_lead_time_months')::numeric,
      (p_fields->>'last_minute_end_months')::int,
      (p_fields->>'last_minute_surcharge_pct')::int,
      (p_fields->>'daily_capacity')::int,
      v_perk,
      NULLIF(p_fields->>'primary_photo_r2_key', ''),
      COALESCE((p_fields->>'includes_setnayan_gift')::boolean, FALSE),
      p_publish
    )
    RETURNING vendor_service_id INTO v_service_id;
  ELSE
    UPDATE public.vendor_services SET
      title                        = NULLIF(p_fields->>'title', ''),
      starting_price_php           = (p_fields->>'starting_price_php')::int,
      added_pax_price_php          = (p_fields->>'added_pax_price_php')::int,
      base_pax                     = (p_fields->>'base_pax')::int,
      coverage_id                  = (p_fields->>'coverage_id')::bigint,
      pricing_basis                = COALESCE(p_fields->>'pricing_basis', 'fixed'),
      per_pax_price_php            = (p_fields->>'per_pax_price_php')::int,
      min_pax                      = (p_fields->>'min_pax')::int,
      hour_base_php                = (p_fields->>'hour_base_php')::int,
      min_hours                    = (p_fields->>'min_hours')::numeric,
      extra_hour_php               = (p_fields->>'extra_hour_php')::int,
      unit_word                    = NULLIF(btrim(p_fields->>'unit_word'), ''),
      unit_base_php                = (p_fields->>'unit_base_php')::int,
      initial_units                = (p_fields->>'initial_units')::int,
      extra_unit_php               = (p_fields->>'extra_unit_php')::int,
      price_max                    = (p_fields->>'price_max')::int,
      crew_size                    = (p_fields->>'crew_size')::int,
      crew_meal_required           = COALESCE((p_fields->>'crew_meal_required')::boolean, FALSE),
      crew_meal_included           = COALESCE((p_fields->>'crew_meal_included')::boolean, FALSE),
      transport_included           = COALESCE((p_fields->>'transport_included')::boolean, FALSE),
      transport_flat_fee_php       = (p_fields->>'transport_flat_fee_php')::int,
      showcase_video_r2_key        = NULLIF(p_fields->>'showcase_video_r2_key', ''),
      showcase_photo_r2_keys       = COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_fields->'showcase_photo_r2_keys', '[]'::jsonb))),
        ARRAY[]::text[]
      ),
      branch_id                    = (p_fields->>'branch_id')::uuid,
      recommended_lead_time_months = (p_fields->>'recommended_lead_time_months')::numeric,
      last_minute_end_months       = (p_fields->>'last_minute_end_months')::int,
      last_minute_surcharge_pct    = (p_fields->>'last_minute_surcharge_pct')::int,
      daily_capacity               = (p_fields->>'daily_capacity')::int,
      -- ② The line this whole migration exists to protect.
      exclusive_perk_text          = CASE WHEN v_perk_given THEN v_perk
                                          ELSE exclusive_perk_text END,
      primary_photo_r2_key         = NULLIF(p_fields->>'primary_photo_r2_key', ''),
      includes_setnayan_gift       = COALESCE((p_fields->>'includes_setnayan_gift')::boolean,
                                              includes_setnayan_gift),
      is_active                    = p_publish,
      updated_at                   = NOW()
    WHERE vendor_service_id = p_service_id
      AND vendor_profile_id = p_vendor_profile_id
    RETURNING vendor_service_id INTO v_service_id;

    -- ⚠ KEPT FROM THE LIVE BODY (restored 2026-09-10). Every definition of this
    -- function since 20270208451790 refuses an UPDATE that matched no row. The
    -- first cut of this migration dropped it while copying the body, so a save
    -- naming a card that is not this shop's (or was deleted mid-edit) would
    -- have gone on to write child rows against a NULL id and returned NULL as
    -- if it had saved. Only the gift rule was meant to change here.
    IF v_service_id IS NULL THEN
      RAISE EXCEPTION 'Service not found.' USING ERRCODE = 'no_data_found';
    END IF;
  END IF;

  -- Replace-all "comes with" links.
  DELETE FROM public.vendor_service_links
    WHERE vendor_service_id = v_service_id AND vendor_profile_id = p_vendor_profile_id;
  INSERT INTO public.vendor_service_links
    (vendor_service_id, vendor_profile_id, linked_canonical_service, linked_label, display_order)
  SELECT v_service_id, p_vendor_profile_id,
         e->>'linked_canonical_service', e->>'linked_label',
         COALESCE((e->>'display_order')::int, 0)
  FROM jsonb_array_elements(COALESCE(p_links, '[]'::jsonb)) AS e;

  -- Replace-all payment schedule.
  DELETE FROM public.vendor_service_payment_schedules
    WHERE vendor_service_id = v_service_id AND vendor_profile_id = p_vendor_profile_id;
  INSERT INTO public.vendor_service_payment_schedules
    (vendor_service_id, vendor_profile_id, seq, label, amount_kind, percent_bps, amount_centavos, due_anchor, due_offset_days)
  SELECT v_service_id, p_vendor_profile_id,
         (e->>'seq')::int, e->>'label', e->>'amount_kind',
         (e->>'percent_bps')::int, (e->>'amount_centavos')::bigint,
         e->>'due_anchor', (e->>'due_offset_days')::int
  FROM jsonb_array_elements(COALESCE(p_schedule, '[]'::jsonb)) AS e;

  -- Replace-all discounts (multi; couple sees the best). min_lead_months carries
  -- the early_booking ladder rung's threshold (NULL for every other type and for
  -- a thresholdless legacy early_booking row).
  DELETE FROM public.vendor_service_discounts
    WHERE vendor_service_id = v_service_id AND vendor_profile_id = p_vendor_profile_id;
  INSERT INTO public.vendor_service_discounts
    (vendor_service_id, vendor_profile_id, discount_type, rate, unit, min_lead_months, expires_at, conditions_md, sort_order)
  SELECT v_service_id, p_vendor_profile_id,
         e->>'discount_type', (e->>'rate')::numeric,
         COALESCE(e->>'unit', 'pct'),
         (e->>'min_lead_months')::int,
         (e->>'expires_at')::timestamptz, e->>'conditions_md',
         COALESCE((e->>'sort_order')::int, 0)
  FROM jsonb_array_elements(COALESCE(p_discounts, '[]'::jsonb)) AS e;

  -- Replace-all fixed-basis price brackets.
  DELETE FROM public.vendor_service_price_brackets
    WHERE vendor_service_id = v_service_id AND vendor_profile_id = p_vendor_profile_id;
  INSERT INTO public.vendor_service_price_brackets
    (vendor_service_id, vendor_profile_id, min_pax, max_pax, price_php, sort_order)
  SELECT v_service_id, p_vendor_profile_id,
         (e->>'min_pax')::int, (e->>'max_pax')::int, (e->>'price_php')::int,
         COALESCE((e->>'sort_order')::int, 0)
  FROM jsonb_array_elements(COALESCE(p_brackets, '[]'::jsonb)) AS e;

  -- Replace-all inclusions (free items with worth).
  DELETE FROM public.vendor_service_inclusions
    WHERE vendor_service_id = v_service_id AND vendor_profile_id = p_vendor_profile_id;
  INSERT INTO public.vendor_service_inclusions
    (vendor_service_id, vendor_profile_id, label, worth_php, sort_order)
  SELECT v_service_id, p_vendor_profile_id,
         e->>'label', (e->>'worth_php')::int,
         COALESCE((e->>'sort_order')::int, 0)
  FROM jsonb_array_elements(COALESCE(p_inclusions, '[]'::jsonb)) AS e;

  RETURN v_service_id;
END;
$function$;

-- The grant stays what 20271030569442 made it: service_role only.
REVOKE ALL ON FUNCTION public.save_vendor_service(uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_vendor_service(uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, boolean) TO service_role;

COMMIT;

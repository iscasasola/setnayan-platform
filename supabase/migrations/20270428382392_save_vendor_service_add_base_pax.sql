-- save_vendor_service_add_base_pax
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. Idempotent (CREATE OR REPLACE FUNCTION).
--
-- Wire `base_pax` (added by 20270426250948) into the atomic wizard writer so the
-- guided "create a service" flow can set flat/pax pricing — parity with the
-- legacy createVendorService/updateVendorService actions. Re-defines the LATEST
-- copy (20270209713470, which added primary_photo_r2_key) verbatim + base_pax in
-- the INSERT column list, the VALUES, and the UPDATE SET. Everything else is
-- unchanged (perk publish gate, replace-all links + payment schedules).

CREATE OR REPLACE FUNCTION public.save_vendor_service(
  p_vendor_profile_id uuid,
  p_service_id        uuid,     -- NULL = create, else update
  p_fields            jsonb,    -- vendor_services column values (TS-validated)
  p_links             jsonb,    -- [{linked_canonical_service,linked_label,display_order}]
  p_schedule          jsonb,    -- [{seq,label,amount_kind,percent_bps,amount_centavos,due_anchor,due_offset_days}]
  p_publish           boolean
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_id uuid;
  v_perk       text;
BEGIN
  v_perk := NULLIF(btrim(COALESCE(p_fields->>'exclusive_perk_text', '')), '');

  -- Publish gate (server-of-record): a published service needs a perk.
  IF p_publish AND v_perk IS NULL THEN
    RAISE EXCEPTION 'A Setnayan Exclusive perk is required to publish this service.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_service_id IS NULL THEN
    INSERT INTO public.vendor_services (
      vendor_profile_id, category, title, starting_price_php, added_pax_price_php,
      base_pax,
      crew_size, crew_meal_required, branch_id, recommended_lead_time_months,
      last_minute_end_months, last_minute_surcharge_pct, daily_capacity,
      discount_type, discount_value, discount_expires_at, discount_conditions_md,
      exclusive_perk_text, primary_photo_r2_key, is_active
    ) VALUES (
      p_vendor_profile_id,
      p_fields->>'category',
      NULLIF(p_fields->>'title', ''),
      (p_fields->>'starting_price_php')::int,
      (p_fields->>'added_pax_price_php')::int,
      (p_fields->>'base_pax')::int,
      (p_fields->>'crew_size')::int,
      COALESCE((p_fields->>'crew_meal_required')::boolean, FALSE),
      (p_fields->>'branch_id')::uuid,
      (p_fields->>'recommended_lead_time_months')::numeric,
      (p_fields->>'last_minute_end_months')::int,
      (p_fields->>'last_minute_surcharge_pct')::int,
      (p_fields->>'daily_capacity')::int,
      p_fields->>'discount_type',
      (p_fields->>'discount_value')::numeric,
      (p_fields->>'discount_expires_at')::timestamptz,
      p_fields->>'discount_conditions_md',
      v_perk,
      NULLIF(p_fields->>'primary_photo_r2_key', ''),
      p_publish
    )
    RETURNING vendor_service_id INTO v_service_id;
  ELSE
    UPDATE public.vendor_services SET
      title                        = NULLIF(p_fields->>'title', ''),
      starting_price_php           = (p_fields->>'starting_price_php')::int,
      added_pax_price_php          = (p_fields->>'added_pax_price_php')::int,
      base_pax                     = (p_fields->>'base_pax')::int,
      crew_size                    = (p_fields->>'crew_size')::int,
      crew_meal_required           = COALESCE((p_fields->>'crew_meal_required')::boolean, FALSE),
      branch_id                    = (p_fields->>'branch_id')::uuid,
      recommended_lead_time_months = (p_fields->>'recommended_lead_time_months')::numeric,
      last_minute_end_months       = (p_fields->>'last_minute_end_months')::int,
      last_minute_surcharge_pct    = (p_fields->>'last_minute_surcharge_pct')::int,
      daily_capacity               = (p_fields->>'daily_capacity')::int,
      discount_type                = p_fields->>'discount_type',
      discount_value               = (p_fields->>'discount_value')::numeric,
      discount_expires_at          = (p_fields->>'discount_expires_at')::timestamptz,
      discount_conditions_md       = p_fields->>'discount_conditions_md',
      exclusive_perk_text          = v_perk,
      primary_photo_r2_key         = NULLIF(p_fields->>'primary_photo_r2_key', ''),
      is_active                    = p_publish,
      updated_at                   = NOW()
    WHERE vendor_service_id = p_service_id
      AND vendor_profile_id = p_vendor_profile_id
    RETURNING vendor_service_id INTO v_service_id;

    IF v_service_id IS NULL THEN
      RAISE EXCEPTION 'Service not found.' USING ERRCODE = 'no_data_found';
    END IF;
  END IF;

  -- Replace-all "comes with" links (atomic with the row write).
  DELETE FROM public.vendor_service_links
    WHERE vendor_service_id = v_service_id
      AND vendor_profile_id = p_vendor_profile_id;
  INSERT INTO public.vendor_service_links
    (vendor_service_id, vendor_profile_id, linked_canonical_service, linked_label, display_order)
  SELECT v_service_id, p_vendor_profile_id,
         e->>'linked_canonical_service',
         e->>'linked_label',
         COALESCE((e->>'display_order')::int, 0)
  FROM jsonb_array_elements(COALESCE(p_links, '[]'::jsonb)) AS e;

  -- Replace-all payment schedule (atomic with the row write).
  DELETE FROM public.vendor_service_payment_schedules
    WHERE vendor_service_id = v_service_id
      AND vendor_profile_id = p_vendor_profile_id;
  INSERT INTO public.vendor_service_payment_schedules
    (vendor_service_id, vendor_profile_id, seq, label, amount_kind, percent_bps, amount_centavos, due_anchor, due_offset_days)
  SELECT v_service_id, p_vendor_profile_id,
         (e->>'seq')::int,
         e->>'label',
         e->>'amount_kind',
         (e->>'percent_bps')::int,
         (e->>'amount_centavos')::bigint,
         e->>'due_anchor',
         (e->>'due_offset_days')::int
  FROM jsonb_array_elements(COALESCE(p_schedule, '[]'::jsonb)) AS e;

  RETURN v_service_id;
END;
$$;

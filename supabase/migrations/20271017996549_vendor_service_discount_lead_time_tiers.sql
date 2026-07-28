-- Reallocated from 20271017262879: that prefix was handed out before the
-- 20271017567807 papic reissue landed, so it would have sorted BELOW the
-- applied head and silently never run (the exact class the reissue fixed).
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)
--
-- ============================================================================
-- LEAD-TIME (EARLY-BOOKING) DISCOUNT TIERS — owner-locked 2026-07-27
-- (DECISION_LOG "🧙 THE MAKER IS ZERO STEPS" row, ruling ②:
--  "give discounts depend on how far their event is? 12 months, 6 months?").
--
-- WHAT ALREADY SHIPPED: `vendor_service_discounts.discount_type` has carried
-- 'early_booking' since 20270502342558, with rate + unit(pct|php). What it could
-- NOT carry was the THRESHOLD — how far ahead the couple must book — which today
-- can only be free text inside `conditions_md` ("Book ≥ 6 months ahead"), i.e.
-- unreadable by code and un-pickable by the couple's event date.
--
-- THE DELTA (this migration): ONE nullable INT column. Several early_booking
-- rows on the same service, each with its own threshold, ARE the ladder
-- (12 → −15%, 6 → −10%). The couple's event date picks the tier automatically
-- app-side (`applicableLeadTimeTier` in apps/web/lib/vendor-lead-time-tier.ts:
-- the largest threshold ≤ months-away wins); nothing is negotiated in chat.
--
-- DISPLAY ONLY. Services stay inquiry-based — the vendor confirms the final
-- price in their reply. No charge path, no package/lock pricing, no booking fee
-- reads this column.
--
-- Additive + NULL-safe: every existing row keeps min_lead_months = NULL, which
-- means "no threshold" and behaves exactly as it does today (an early_booking
-- discount that always applies). The CHECK admits NULL so legacy rows insert
-- unchanged. NO grant/policy/RLS change — the column rides the table's existing
-- vendor-owner + console-admin write policies and the published+active
-- public-read policy, exactly like `rate` and `unit` next to it.
-- ============================================================================

-- ============================================================================
-- 1 · vendor_service_discounts.min_lead_months — the ladder rung's threshold
-- ============================================================================
ALTER TABLE public.vendor_service_discounts
  ADD COLUMN IF NOT EXISTS min_lead_months INT
    CHECK (min_lead_months IS NULL OR min_lead_months >= 1);

COMMENT ON COLUMN public.vendor_service_discounts.min_lead_months IS
  'Lead-time threshold for an early_booking tier: this discount applies when the couple''s event is AT LEAST this many months away (months = days / 30.44, resolved app-side by applicableLeadTimeTier). Several early_booking rows on one service form the ladder — the LARGEST threshold the couple satisfies wins (12+ -> -15%, 6+ -> -10%). NULL = no threshold: legacy behaviour unchanged (the discount always applies) and the only meaning for the non-early_booking types. DISPLAY ONLY — services are inquiry-based; the vendor confirms the final price in their reply. Owner-locked 2026-07-27 (DECISION_LOG "MAKER IS ZERO STEPS" ruling 2).';

-- ============================================================================
-- 2 · save_vendor_service RPC — carry min_lead_months on the discounts write.
--     The wizard (service-wizard.tsx) saves through this RPC while the inline
--     My Shop form writes via replaceServiceLists; BOTH mount the same
--     DiscountsEditor, so the RPC must persist the new field or the wizard
--     would silently drop every vendor's ladder.
--
--     Signature UNCHANGED (same 9 args) — this is a CREATE OR REPLACE of the
--     body from 20270502342558 with exactly one edit: the replace-all discounts
--     INSERT now reads e->>'min_lead_months'. Everything else is verbatim.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.save_vendor_service(
  p_vendor_profile_id uuid,
  p_service_id        uuid,     -- NULL = create, else update
  p_fields            jsonb,    -- vendor_services column values (TS-validated)
  p_links             jsonb,    -- [{linked_canonical_service,linked_label,display_order}]
  p_schedule          jsonb,    -- [{seq,label,amount_kind,percent_bps,amount_centavos,due_anchor,due_offset_days}]
  p_discounts         jsonb,    -- [{discount_type,rate,unit,min_lead_months,expires_at,conditions_md,sort_order}]
  p_brackets          jsonb,    -- [{min_pax,max_pax,price_php,sort_order}]  (fixed basis)
  p_inclusions        jsonb,    -- [{label,worth_php,sort_order}]
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

  IF p_publish AND v_perk IS NULL THEN
    RAISE EXCEPTION 'A Setnayan Exclusive perk is required to publish this service.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_service_id IS NULL THEN
    INSERT INTO public.vendor_services (
      vendor_profile_id, category, title, starting_price_php, added_pax_price_php,
      base_pax, coverage_id,
      pricing_basis, per_pax_price_php, min_pax, hour_base_php, min_hours, extra_hour_php,
      crew_size, crew_meal_required, crew_meal_included,
      transport_included, transport_flat_fee_php,
      showcase_video_r2_key, showcase_photo_r2_keys,
      branch_id, recommended_lead_time_months,
      last_minute_end_months, last_minute_surcharge_pct, daily_capacity,
      exclusive_perk_text, primary_photo_r2_key, is_active
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
$$;

COMMENT ON FUNCTION public.save_vendor_service(uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,boolean) IS
  'Atomic writer for the guided service-card save. Writes vendor_services + replace-all links/payment-schedule/discounts/price-brackets/inclusions. Discounts carry min_lead_months (the early_booking lead-time ladder rung; owner-locked 2026-07-27). Service-card redesign 2026-07-02.';

-- ============================================================================
-- 3 · POST-CONDITION — assert the OBJECT, not the ledger.
--     `schema_migrations` can record a migration as APPLIED while its columns
--     never landed (see [[project_setnayan_schema_drift_false_applied]]). So the
--     migration proves its own effect and RAISEs if the column, its nullability,
--     its type, its CHECK, or the RPC's use of it is not really there.
-- ============================================================================
DO $$
DECLARE
  v_type      text;
  v_nullable  text;
  v_checks    int;
  v_rpc_body  text;
BEGIN
  SELECT data_type, is_nullable
    INTO v_type, v_nullable
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'vendor_service_discounts'
     AND column_name  = 'min_lead_months';

  IF v_type IS NULL THEN
    RAISE EXCEPTION
      'POST-CONDITION FAILED: public.vendor_service_discounts.min_lead_months does not exist after this migration.';
  END IF;
  IF v_type <> 'integer' THEN
    RAISE EXCEPTION
      'POST-CONDITION FAILED: min_lead_months is %, expected integer.', v_type;
  END IF;
  IF v_nullable <> 'YES' THEN
    RAISE EXCEPTION
      'POST-CONDITION FAILED: min_lead_months must stay NULLABLE (NULL = no threshold = legacy behaviour), got is_nullable=%.', v_nullable;
  END IF;

  -- The CHECK must exist, or 0 / negative thresholds would slip in.
  SELECT count(*) INTO v_checks
    FROM pg_constraint
   WHERE conrelid = 'public.vendor_service_discounts'::regclass
     AND contype  = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%min_lead_months%';
  IF v_checks < 1 THEN
    RAISE EXCEPTION
      'POST-CONDITION FAILED: no CHECK constraint mentions min_lead_months (0 / negative thresholds would be accepted).';
  END IF;

  -- The RPC must actually write the column — a wizard save that drops the ladder
  -- is exactly the silent failure this block exists to catch.
  SELECT pg_get_functiondef(p.oid) INTO v_rpc_body
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'save_vendor_service'
   LIMIT 1;
  IF v_rpc_body IS NULL OR position('min_lead_months' in v_rpc_body) = 0 THEN
    RAISE EXCEPTION
      'POST-CONDITION FAILED: save_vendor_service does not reference min_lead_months — the wizard would silently drop every lead-time tier.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- THE SETNAYAN GIFT IS A YES OR A NO — the supplier's control stops being prose.
--
-- Owner ruling 2026-09-09, verbatim: "papic credits will be auto computed based
-- on what they pay. it will be proportionally computed to the value. (so it is
-- either a yes or a no)." And, narrowing his own two-item shelf minutes after
-- setting it: "ok then only offer papic credits. so it is simple and useful."
-- And on whether a supplier may give more: "no. just max to 40%. nothing more."
--
-- ⇒ THE SUPPLIER HAS NO AMOUNT CONTROL AND NO PICK. One gift (Papic credits),
-- sized from the booking fee at 40%, capped at the 50,000-credit rung. The only
-- thing a supplier decides is WHETHER. That is a boolean, so this is a boolean.
--
-- ⛔ THIS MIGRATION DOES NOT COMPUTE, BILL OR GRANT ANYTHING. The photo count is
-- derived from a price that does not exist yet when a card is written, and it
-- appears on the QUOTE, never on the card. That is EX-2.
--
-- ───────────────────────────────────────────────────────────────────────────
-- 1. THE FREE TEXT IS RETIRED AS THE CONTROL, NOT AS DATA.
--
-- `exclusive_perk_text` stays on the table, stays readable, stays in the chat
-- unlock message. Production holds exactly TWO service cards, both active, both
-- carrying it, and NEITHER of them is Papic credits — measured 2026-09-09:
--   S89S-GZ6GJB1K5N (live_band) "Free 1-hour extension for Setnayan couples"
--   S89S-811M6SWNPK (host_mc)   "FREE"
-- A card that already promises something keeps promising it.
--
-- 🔴 AND THAT IS WHY THIS MIGRATION HAS TO TOUCH `save_vendor_service`. Its
-- UPDATE branch writes `exclusive_perk_text = v_perk`, where v_perk is derived
-- from `p_fields->>'exclusive_perk_text'` — so an ABSENT key writes NULL. The
-- moment the app stops rendering the input (this change), the next save of
-- either live card would ERASE the promise it is meant to keep. Absent now
-- means UNCHANGED. Present still means set-or-clear, so an admin or a future
-- surface can still edit the text deliberately.
--
-- ───────────────────────────────────────────────────────────────────────────
-- 2. THE SECOND COMPULSORY CHECK, WHICH THE FIRST HALF OF THIS WORK MISSED.
--
-- Migration 20271215941485 ("the Setnayan gift is optional") moved
-- `enforce_service_publish_gate()` and the TypeScript together, and its own
-- docblock warns that moving one without the other leaves "the app saying yes
-- and the DATABASE saying no". It then left EXACTLY THAT here: this function
-- still raises
--     'A Setnayan Exclusive perk is required to publish this service.'
-- whenever p_publish is true and no perk text is present. `commitVendorService`
-- publishes through THIS function, so the ruling was unreachable on the main
-- save path — the trigger allowed the publish and the RPC threw first.
-- Removed here, for the same reason and on the same ruling.
--
-- ───────────────────────────────────────────────────────────────────────────
-- 3. RLS AND GRANTS — CHECKED, NOT ASSUMED.
--
-- `vendor_services` already has RLS enabled with Pattern D (public-read,
-- vendor-write): `vendor_services_public_read` (SELECT) + `vendor_services_manage`
-- (ALL). Both are ROW-scoped, so a new column inherits them; a new policy here
-- would be a second copy of a rule, not a protection.
--
-- 🔑 NO PER-COLUMN GRANT IS NEEDED, AND THAT WAS VERIFIED AGAINST PRODUCTION
-- RATHER THAN ASSUMED FROM A NEIGHBOUR. `events` holds NO table-level SELECT —
-- its grants are a per-column allowlist (174 anon / 194 authenticated), which is
-- why adding a column there without `GRANT SELECT (col)` makes PostgREST refuse
-- the WHOLE query and every read goes silently empty. `vendor_services` is the
-- OTHER shape: it holds table-level SELECT for both `anon` and `authenticated`,
-- so this column is readable the moment it exists. Do not copy the events
-- recipe onto this table; the two are not the same and the difference is
-- invisible unless you look.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── The control ────────────────────────────────────────────────────────────
--
-- DEFAULT FALSE and DELIBERATELY NOT BACKFILLED FROM `exclusive_perk_text`.
-- Backfilling TRUE would read as tidy and would be a money event: this boolean
-- means "charge me 40% of my booking fee, on top of the fee, to gift Papic
-- credits". Neither live row offers Papic credits — one offers an extra hour,
-- one says the word "FREE" — so flipping them TRUE would bill two suppliers for
-- a gift they never chose. They keep their existing badge through the legacy
-- text instead (service-card-face.tsx renders that branch unchanged), so
-- nothing is lost and nothing is invented.
ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS includes_setnayan_gift BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.vendor_services.includes_setnayan_gift IS
  'The supplier''s whole say over the Setnayan Exclusive: yes or no. The gift is '
  'Papic credits (owner 2026-09-09, "only offer papic credits"), sized at 40% of '
  'the booking fee and capped at the 50,000-credit rung — so there is no amount '
  'here to set and no product here to pick, by ruling ("no. just max to 40%. '
  'nothing more."). FALSE on every pre-existing row on purpose: this flag costs '
  'the supplier money, so it is never inferred from the retired free-text field '
  'exclusive_perk_text. The photo COUNT is computed from the agreed price and '
  'shown on the quote, never on the card.';

-- ── The writer of record ───────────────────────────────────────────────────
--
-- Reproduced from the live definition (pg_get_functiondef, prod, 2026-09-09)
-- with exactly THREE changes, all of them named above:
--   ① the compulsory-perk RAISE is gone            (owner: the gift is optional)
--   ② exclusive_perk_text: absent key = UNCHANGED  (retired as control, kept as data)
--   ③ includes_setnayan_gift is written            (the new yes/no)
-- Every other line — the links, schedule, discounts, brackets and inclusions
-- replace-alls, and the ownership predicate on the UPDATE — is byte-identical.
--
-- ⚠ ON ③ AND THE UNCHECKED CHECKBOX. An unchecked HTML checkbox submits
-- NOTHING, so "key absent" must never quietly mean FALSE at this layer or a
-- supplier could not turn the gift OFF through a surface that omits the field.
-- The server action resolves the checkbox to a definite true/false and ALWAYS
-- sends the key; this COALESCE preserves the stored value only for a caller
-- that does not mention the field at all.
CREATE OR REPLACE FUNCTION public.save_vendor_service(
  p_vendor_profile_id uuid, p_service_id uuid, p_fields jsonb, p_links jsonb,
  p_schedule jsonb, p_discounts jsonb, p_brackets jsonb, p_inclusions jsonb,
  p_publish boolean)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_service_id uuid;
  v_perk       text;
  v_perk_given boolean;
BEGIN
  -- ② Distinguish "the caller cleared it" from "the caller never mentioned it".
  v_perk_given := p_fields ? 'exclusive_perk_text';
  v_perk       := NULLIF(btrim(COALESCE(p_fields->>'exclusive_perk_text', '')), '');

  -- ① The perk requirement WAS enforced here. It is not a requirement any more
  --    (owner 2026-09-09: "exclusive setnayan gift then should be optional").
  --    A card publishes on its PRICE alone; enforce_service_publish_gate() is
  --    the other half of that rule and already agrees.

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

COMMENT ON FUNCTION public.save_vendor_service(uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, boolean) IS
  'Atomic writer for a service card and its five child tables. Two things here '
  'are load-bearing and easy to undo by accident: (1) it no longer refuses to '
  'publish a card without a Setnayan gift — the gift became optional on the '
  'owner ruling of 2026-09-09 and enforce_service_publish_gate() agrees; '
  '(2) an ABSENT exclusive_perk_text key leaves the stored text alone, because '
  'the field is retired as a control while two live cards still promise through '
  'it — a plain assignment here would erase them on the next save. '
  'includes_setnayan_gift is the supplier''s whole say over the gift: yes or no.';

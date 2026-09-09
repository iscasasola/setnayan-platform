-- ═══════════════════════════════════════════════════════════════════════════
-- THE SETNAYAN GIFT IS A SWITCH, NOT A SENTENCE.
--
-- Owner rulings, 2026-09-09, in the order he gave them:
--   • "ok then only offer papic credits. so it is simple and useful"
--     ⇒ the Setnayan Exclusive is ONE thing: Papic credits. Not five products.
--   • "papic credits will be auto computed based on what they pay. it will be
--     proportionally computed to the value. (so it is either a yes or a no)."
--     ⇒ the supplier's control is a PURE YES/NO. There is no amount to set.
--   • "no. just max to 40%. nothing more."
--     ⇒ 40% of the booking fee is a CEILING. No slider, no picker, no top-up.
--   • "exclusive setnayan gift then should be optional."
--     ⇒ a card may publish with the switch off (shipped in the migration
--       immediately before this one, 20271215941485).
--
-- WHAT THIS MIGRATION DOES — three things, and it is worth reading why each
-- one is here rather than assuming the first is the whole change.
--
-- ① `vendor_services.setnayan_gift_enabled` — the switch itself.
--
--    ⚖ `NOT NULL DEFAULT FALSE`, and the default is the load-bearing part.
--    Turning it ON is a decision to pay us 40% MORE than the booking fee, so
--    the value a pre-existing row wakes up holding must be the one that costs
--    its owner nothing. Production holds 2 service cards, both active, and
--    both already carry `exclusive_perk_text` — they keep that text and keep
--    displaying it, and they are NOT opted into the new paid gift by a
--    migration. Nobody is charged anything by this change.
--
--    🔒 NO NEW RLS AND NO NEW GRANT, MEASURED RATHER THAN ASSUMED. Read out of
--    production before writing this: `vendor_services` carries TABLE-level
--    grants (`relacl` = anon/authenticated/service_role each `arwdDxtm`) and
--    ZERO per-column ACLs (`pg_attribute.attacl` is null on all 40 columns),
--    so a new column inherits the table's privileges. This table is NOT the
--    `events` per-column-allowlist pattern, where a column with no
--    `GRANT SELECT (col)` makes PostgREST refuse the WHOLE query and every
--    read goes silently empty. RLS is already enabled with two row policies
--    (`vendor_services_manage` — the shop's own rows — and
--    `vendor_services_public_read`), and a column has no policy of its own.
--
-- ② `save_vendor_service` STOPS REFUSING A GIFTLESS PUBLISH.
--
--    🚨 THIS WAS THE FOURTH COPY OF THE COMPULSORY RULE AND NOTHING HAD
--    TOUCHED IT. The optional ruling was applied in three places on
--    2026-09-09 — `PUBLISH_REQUIREMENTS` in TypeScript, the
--    `enforce_service_publish_gate` trigger, and the maker's guided pass — and
--    this function, which is the very first write on the maker's and the
--    wizard's Publish button, still carried its own:
--
--        IF p_publish AND v_perk IS NULL THEN
--          RAISE EXCEPTION 'A Setnayan Exclusive perk is required to publish…'
--
--    Read out of production by the object (`pg_get_functiondef`), not from a
--    migration comment. So a supplier pressing Publish in the canvas maker
--    with no gift would have passed every relaxed gate and then read a raw
--    database sentence in a banner — exactly the failure the previous
--    migration's own docblock warned about, in the one place it did not look.
--    🔑 A rule written four times has a fourth copy; enumerate the writers
--    from the object, never from the change that just fixed three of them.
--
-- ③ `exclusive_perk_text` IS PRESERVED WHEN THE CALLER DOES NOT NAME IT.
--
--    The free text is retired as the CONTROL, not as data: the editors stop
--    offering a box to type into, so their saves stop naming the field. With
--    the old body that silently wrote NULL — a card that already promises
--    something would have lost the promise the first time its owner touched
--    an unrelated field. (This repo has paid for that exact shape once
--    already, on the admin price screen: a closed panel posted nothing and 32
--    of 34 saves blanked a description.)
--
--    ⇒ THE RULE, ONE SENTENCE: `exclusive_perk_text` is written only when the
--    caller NAMES it; otherwise the stored value stands. Spelled here with
--    the `?` key-existence operator, and mirrored in `updateVendorService`
--    (apps/web/app/vendor-dashboard/services/actions.ts). The INSERT branch is
--    unchanged — a brand-new row has nothing to preserve, and the maker's
--    "start from this card" copy deliberately still names the field so a
--    copied card keeps the promise its source made.
--
-- ⛔ NOT IN THIS MIGRATION, AND DELIBERATELY: the arithmetic (40% of the fee,
-- interpolated along the live PAPIC_GUEST* rung ladder, capped at the 50,000
-- rung), the line on the supplier's bill, and the grant into the couple's
-- Papic pot. That is one change and it is real money; it is EX-2's, and it
-- reads this column.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS setnayan_gift_enabled boolean NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.vendor_services.setnayan_gift_enabled IS
  'The Setnayan Exclusive, as a yes/no. TRUE means this shop gives the couple '
  'free Papic credits on a booking made through Setnayan, funded by 40% of the '
  'booking fee charged ON TOP of it (owner 2026-09-09: "papic credits will be '
  'auto computed based on what they pay… so it is either a yes or a no"). '
  'There is NO amount here on purpose: 40% is a ceiling with no top-up ("no. '
  'just max to 40%. nothing more."), the number of photographs is derived from '
  'the agreed price and appears on the QUOTE, never on the card. DEFAULT FALSE '
  'because switching it on costs the shop money, so the value a pre-existing '
  'row holds must be the one nobody was charged for. ⚠ NOT the same thing as '
  'exclusive_perk_text, which is the retired free-text promise a card may also '
  'still carry.';

CREATE OR REPLACE FUNCTION public.save_vendor_service(
  p_vendor_profile_id uuid,
  p_service_id uuid,
  p_fields jsonb,
  p_links jsonb,
  p_schedule jsonb,
  p_discounts jsonb,
  p_brackets jsonb,
  p_inclusions jsonb,
  p_publish boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_service_id uuid;
  v_perk       text;
  v_gift       boolean;
BEGIN
  v_perk := NULLIF(btrim(COALESCE(p_fields->>'exclusive_perk_text', '')), '');

  -- ⚖ THE GIFT IS OPTIONAL (owner 2026-09-09). The refusal that used to stand
  -- here — 'A Setnayan Exclusive perk is required to publish this service.' —
  -- is GONE, and it was the fourth and last copy of that rule. ⛔ Putting it
  -- back is an owner decision and a RATE CHANGE, not a tidy-up: the gift is
  -- 40% of the booking fee charged on top of it, so compulsory takes what a
  -- shop pays us from 5% to 7% of the first PHP 100,000 and makes the line we
  -- sell against 25%-commission rivals with ("we only charge 5% and 1%")
  -- untrue.

  -- The switch. Absent or malformed reads as FALSE — the value that costs its
  -- owner nothing — never as "leave whatever was there", because a supplier
  -- turning the gift OFF posts an unchecked checkbox, which is an absence.
  v_gift := COALESCE((p_fields->>'setnayan_gift_enabled')::boolean, FALSE);

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
      exclusive_perk_text, setnayan_gift_enabled, primary_photo_r2_key, is_active
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
      v_gift,
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
      -- 🔑 NAMED OR PRESERVED — never blanked by an absence. The editors no
      -- longer offer a box to type this into, so their saves stop naming it;
      -- with the old unconditional assignment the first unrelated edit would
      -- have wiped a promise the card was still making to couples.
      exclusive_perk_text          = CASE
                                       WHEN p_fields ? 'exclusive_perk_text' THEN v_perk
                                       ELSE vendor_services.exclusive_perk_text
                                     END,
      setnayan_gift_enabled        = v_gift,
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
$function$;

COMMENT ON FUNCTION public.save_vendor_service(uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, boolean) IS
  'Atomic vendor service save. Since 2026-09-09 it no longer refuses a publish '
  'without a Setnayan Exclusive — the owner ruled the gift optional, and this '
  'function held the FOURTH copy of that rule after PUBLISH_REQUIREMENTS, the '
  'enforce_service_publish_gate trigger and the maker''s guided pass. It writes '
  'the yes/no setnayan_gift_enabled, and it PRESERVES exclusive_perk_text when '
  'the caller does not name that key, because the editors retired the free-text '
  'box and an unnamed field must not blank a promise a card is still making. '
  '⚠ SECURITY DEFINER with p_vendor_profile_id as a TRUSTED parameter — revoked '
  'from anon and authenticated by 20271030569442; only the admin client may '
  'call it, and the ownership answer comes from the session.';

-- ⚠ Revoked from anon + authenticated by 20271030569442. `CREATE OR REPLACE`
-- keeps a function's existing ACL, so this is a restatement of the shipped
-- state and not a widening — asserted rather than assumed, because a REPLACE
-- on this very function has silently reverted a guard in this repo before.
REVOKE EXECUTE ON FUNCTION public.save_vendor_service(uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, boolean) FROM anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- A SERVICE CARD NEEDS A COVER PHOTO AND "WHAT'S INCLUDED" TO GO LIVE (H2)
--
-- Owner, 2026-09-09, while making the Setnayan gift optional: *"the cover-photo
-- · title · inclusions requirements stay"* — they are what a card needs to be
-- legible; the gift is not. The build plan's sentence for it: a couple never
-- meets a card that is only a price and a category word. The TITLE is already
-- handled (B1 names a blank card — `fill_blank_service_card_title`). This adds
-- the other two.
--
-- 🔴 ALL THREE LAYERS MOVE TOGETHER, AS #5373 PROVED THEY MUST. The shared gate
-- (`lib/service-publish-gate.ts`), this trigger, and `save_vendor_service`. A
-- TypeScript-only rule leaves the database answering differently: a shop can
-- PATCH `is_active` or INSERT a card straight through PostgREST
-- (`vendor_services_manage` is `FOR ALL` on "this row is yours"; `is_active`
-- DEFAULTS TO TRUE, so an insert that omits it creates a LIVE card).
--
-- ── WHAT COUNTS ─────────────────────────────────────────────────────────────
--   • a cover  = `primary_photo_r2_key` non-blank (the 1:1 photo a couple sees
--                first; the card face's `hasCover`).
--   • included = at least one `vendor_service_inclusions` row with a non-blank
--                label (the card face's "Includes: …" line).
--
-- ── WHEN IT IS JUDGED — GOING LIVE, NEVER A CARD ALREADY LIVE ───────────────
-- Both are judged when a card GOES live: inserted live, or flipped draft → live.
-- A card that is ALREADY live and lacks one is FLAGGED to its shop (the editor
-- and the maker's health meter), NEVER unpublished and never refused an edit.
-- 🔢 Measured in production 2026-09-11: 2 cards, both live, BOTH with zero
-- inclusions, one with no cover. This migration changes no row; both stay live
-- and both still save. (The price keeps its older, stricter rule — a live card
-- may not empty its price — because that one already stood.)
--
-- ── WHY "WHAT'S INCLUDED" IS A DEFERRED CONSTRAINT TRIGGER ──────────────────
-- Inclusions are CHILD rows: they cannot exist until the card row does.
-- `save_vendor_service` writes the card first and replaces its inclusions after,
-- in one transaction; a BEFORE trigger on the card would see the OLD inclusions
-- (none, for a new card) and refuse a publish whose inclusions arrive two
-- statements later. Checked at COMMIT instead, it sees the finished card —
-- whatever order the writer used — and still refuses a card that went live and
-- ends the transaction with nothing included. It re-reads `is_active` at commit,
-- so a card published and taken back to draft in the same transaction passes.
--
-- ── AND host_mc GETS A PROPER LABEL (the bundle override on H2) ─────────────
-- B1's trigger names a blank card from `canonical_service_schemas`, else
-- `initcap(key)`. `host_mc` has no row there, so a blank host card was named
-- "Host Mc by …". The taxonomy ALREADY carries the right words:
-- `service_categories` (id 'host_mc', label_en 'Host / MC' — the same label the
-- app's WEDDING_TILE_LABEL uses). The kind now falls back to that tree label
-- before the humanised key, so every leaf the tree names gets its real name —
-- not only host_mc — and nothing is added to `canonical_service_schemas`, whose
-- rows other surfaces treat as "a canonical service exists".
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) The immediate gate: price (as before) + the cover ────────────────────
-- Reproduced from 20271215941485 (the live body, identical in production by
-- pg_get_functiondef 2026-09-11). Deltas: the "going live" arm now also asks
-- for a cover, and it is asked FIRST — the order the shared gate and the
-- maker's first pass use (cover · price · what's included).
CREATE OR REPLACE FUNCTION public.enforce_service_publish_gate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_priced     boolean;
  v_going_live boolean;
  v_judging    boolean;
BEGIN
  -- A draft is nobody's business. Every card is born one.
  IF NEW.is_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Judge only the act of publishing, or of emptying what publishing required.
  --
  -- ⚠ `exclusive_perk_text` is deliberately GONE from this test as well as
  -- from the check below. Leaving it here would re-judge a live card every
  -- time its gift text changed and refuse it for a missing PRICE it never had
  -- — a refusal triggered by editing an unrelated, now-optional field.
  IF TG_OP = 'INSERT' THEN
    v_going_live := TRUE;
  ELSE
    v_going_live := OLD.is_active IS NOT TRUE;
  END IF;
  v_judging := v_going_live
            OR (TG_OP = 'UPDATE' AND NEW.starting_price_php IS DISTINCT FROM OLD.starting_price_php);

  IF NOT v_judging THEN
    RETURN NEW;
  END IF;

  -- THE COVER — asked only of a card GOING live. A card already live without
  -- one is flagged to its shop, never refused an edit (see the header).
  IF v_going_live AND NULLIF(btrim(COALESCE(NEW.primary_photo_r2_key, '')), '') IS NULL THEN
    RAISE EXCEPTION
      'Add a cover photo before you publish this card — it is the first thing a couple sees. You can still save it as a draft.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_priced := NEW.starting_price_php IS NOT NULL AND NEW.starting_price_php > 0;

  IF NOT v_priced THEN
    RAISE EXCEPTION
      'Set a starting price before you publish this card — it is how couples planning a budget find you. You can still save it as a draft.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

-- ── 2) "What's included" — judged at COMMIT ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_service_publish_gate_inclusions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_live boolean;
BEGIN
  -- By commit the card may have gone back to draft, or been deleted.
  SELECT is_active INTO v_live
    FROM public.vendor_services
   WHERE vendor_service_id = NEW.vendor_service_id;
  IF v_live IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.vendor_service_inclusions i
     WHERE i.vendor_service_id = NEW.vendor_service_id
       AND NULLIF(btrim(COALESCE(i.label, '')), '') IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'Add what is included before you publish this card — a couple needs to see what the price gets them. You can still save it as a draft.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$function$;

COMMENT ON FUNCTION public.enforce_service_publish_gate_inclusions() IS
  'Refuses, at COMMIT, a service card that went live (inserted live, or flipped '
  'draft → live) with no named "what''s included" line. Deferred because '
  'inclusions are child rows written after the card. A card already live is '
  'never judged here — it is flagged to its shop instead (H2, 2026-09-11).';

-- INSERT and UPDATE are two triggers because an INSERT trigger's WHEN clause may
-- not read OLD — and the UPDATE one must, or every save of an already-live card
-- (the RPC re-writes `is_active = true` on each) would be re-judged.
DROP TRIGGER IF EXISTS trg_enforce_service_publish_gate_inclusions_ins ON public.vendor_services;
CREATE CONSTRAINT TRIGGER trg_enforce_service_publish_gate_inclusions_ins
  AFTER INSERT ON public.vendor_services
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (NEW.is_active IS TRUE)
  EXECUTE FUNCTION public.enforce_service_publish_gate_inclusions();

DROP TRIGGER IF EXISTS trg_enforce_service_publish_gate_inclusions_upd ON public.vendor_services;
CREATE CONSTRAINT TRIGGER trg_enforce_service_publish_gate_inclusions_upd
  AFTER UPDATE OF is_active ON public.vendor_services
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (NEW.is_active IS TRUE AND OLD.is_active IS NOT TRUE)
  EXECUTE FUNCTION public.enforce_service_publish_gate_inclusions();

REVOKE ALL ON FUNCTION public.enforce_service_publish_gate_inclusions() FROM PUBLIC, anon, authenticated;

-- ── 3) save_vendor_service says the same thing, from the payload ────────────
-- Reproduced from 20271216515644 (the live body — pg_get_functiondef
-- 2026-09-11, identical). ONE delta: when this save PUBLISHES a card that is
-- not already live, it refuses a payload with no cover, no price or nothing
-- included, in the shared gate's order and with its exact sentences — so the
-- supplier reads a sentence from the function that is asked, not from a
-- trigger three statements later. Every other line is byte-identical,
-- including the absent-perk rule and the "Service not found." refusal.
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

-- ── 4) The blank-card name reads the taxonomy's own label ───────────────────
-- Reproduced from 20271217522970 (live body, identical by pg_get_functiondef
-- 2026-09-11). ONE delta: between `canonical_service_schemas` and the humanised
-- key, the kind is read from `service_categories.label_en` — so `host_mc` is
-- named "Host / MC by …", not "Host Mc by …". SECURITY INVOKER as before: the
-- tree is public-read, and an unreadable row only falls through to the key.
CREATE OR REPLACE FUNCTION public.fill_blank_service_card_title()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_kind text;
  v_shop text;
  v_name text;
BEGIN
  -- The supplier's own words always win. The WHEN clause below already skips
  -- this call for a named card; this is the belt, because a future trigger
  -- definition that loses the WHEN must not start renaming people's cards.
  IF NULLIF(btrim(COALESCE(NEW.title, '')), '') IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(btrim(COALESCE(s.display_name_en, '')), '')
    INTO v_kind
    FROM public.canonical_service_schemas s
   WHERE s.canonical_service = NEW.category;

  -- H2 · the taxonomy tree's own label for the leaf ('host_mc' → 'Host / MC').
  IF v_kind IS NULL THEN
    SELECT NULLIF(btrim(COALESCE(c.label_en, '')), '')
      INTO v_kind
      FROM public.service_categories c
     WHERE c.id = NEW.category;
  END IF;

  IF v_kind IS NULL THEN
    v_kind := NULLIF(btrim(initcap(replace(COALESCE(NEW.category, ''), '_', ' '))), '');
  END IF;

  -- No kind to name it after → leave the column NULL rather than store an empty
  -- string. Every reader tests `title?.trim()`, so '' would be an absence
  -- wearing the costume of a value.
  IF v_kind IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(btrim(COALESCE(p.business_name, '')), '')
    INTO v_shop
    FROM public.vendor_profiles p
   WHERE p.vendor_profile_id = NEW.vendor_profile_id
     AND (p.verification_state = 'verified' OR p.name_revealed_at IS NOT NULL);

  v_name := left(
    CASE WHEN v_shop IS NULL THEN v_kind ELSE v_kind || ' by ' || v_shop END,
    80
  );

  NEW.title := NULLIF(btrim(v_name), '');
  RETURN NEW;
END;
$function$;

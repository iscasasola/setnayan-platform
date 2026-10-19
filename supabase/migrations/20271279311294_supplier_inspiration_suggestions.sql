-- ============================================================================
-- 20271279311294_supplier_inspiration_suggestions.sql
-- Created via `pnpm migration:new`. Idempotent.
--
-- 🤝🖼 A BOOKED SUPPLIER SUGGESTS PHOTOS TO ITS OWN PARTS; THE COUPLE KEEPS THEM
-- (owner 2026-10-19, DECISION_LOG "SUPPLIERS ADD INSPIRATION BY THEIR CATEGORY —
-- EVERY PART, ATTIRE INCLUDED" + "FIVE CONTROLLER RECOMMENDATIONS APPROVED" item 4:
-- option (b) as drawn in prototypes/supplier_inspiration_suggestions_2026-10-19.html).
--
-- MEASURED BEFORE THIS (PALETTE-HANDOVER-2026-10-19): a booked supplier could
-- not add a photo to an event's board AT ALL — `event_inspiration_assets`' insert
-- policy is event members only. This migration does NOT widen that policy. A
-- supplier's photo lands in a table of its own and reaches the couple's board
-- only when the couple taps Keep, through a function that writes the board row.
--
-- ── WHAT LANDS ──────────────────────────────────────────────────────────────
--   1 · `inspiration_suggestion_services(slot)` — the SQL mirror of the ONE
--       slot→trade map (`MOODBOARD_SLOT_TRADES` → `canonicalServicesForSlot`,
--       apps/web/lib/moodboard-gallery.ts), for EVERY part the couple's Studio
--       draws a photos line on. Any other slot answers EMPTY (refused).
--       tests/db/a-supplier-suggests-only-to-its-own-parts.db.test.ts compares
--       the two for every slot and fails when they disagree.
--   2 · `event_inspiration_suggestions` — one row per suggested photo, RLS at
--       CREATE TABLE time: the couple reads its event's rows, the supplier reads
--       its own booking's rows, admin all. No signed-in role may INSERT, UPDATE
--       or DELETE it directly.
--   3 · `event_inspiration_assets` — `source_kind` gains 'supplier_suggestion',
--       paired by a biconditional CHECK with `from_suggestion_id` (the credit).
--   4 · Four SECURITY DEFINER functions, each deciding its caller in SQL:
--         vendor_begin_inspiration_suggestion     (supplier: booking · fee · trade · 3 waiting)
--         vendor_withdraw_inspiration_suggestion  (supplier: its own waiting row)
--         couple_decide_inspiration_suggestion    (couple: Keep / No thanks; a full part needs a position)
--         couple_undo_kept_inspiration_suggestion (couple: the Keep toast's Undo)
--
-- 🔑 THE PHOTO CANNOT REACH THE COUPLE WITHOUT THE CONTENT SCREEN. The supplier's
-- own session may only OPEN a row ('screening', no photo). The photo, its colours
-- and the move to 'waiting' are written by the server (service role) AFTER the
-- shipped content screen (`screenGalleryImage`) passed it — so a supplier calling
-- the function directly gets an empty row the couple never sees, and nothing else.
--
-- 🔑 KEEP NEVER REPLACES SILENTLY. On a part that holds 3 photos, Keep without a
-- position changes NOTHING and answers 'full'; only an explicit position replaces
-- one, and the replaced row is soft-deleted (removed_at) so Undo can put it back.
--
-- In-app only: nothing here sends anything (owner rule — no new emails).
-- ============================================================================

BEGIN;

-- ── 1 · THE SLOT → SERVICES MIRROR ──────────────────────────────────────────
-- Generated from canonicalServicesForSlot(slot) for every part in
-- libraryPhotoParts() (apps/web/lib/inspiration-slots.ts), sorted. A slot that is
-- not a couple part (venue, flowers, cocktail, palette, …) answers EMPTY.
CREATE OR REPLACE FUNCTION public.inspiration_suggestion_services(
  p_slot_key TEXT
) RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_slot_key
    WHEN 'overall' THEN ARRAY['capiz_native_decor','chuppah_rental','day_of_coordinator','decorator_general','despedida_planner','destination_wedding_specialist','double_happiness_decor','events_place','function_hall','garden_reception_venue','gender_separated_reception_coordinator','hacienda_heritage_decor','hotel_ballroom','inc_wedding_coordinator','lights_sound','mahr_coordination','mandap_decor','maranao_okir_decor','pamamanhikan_coordinator','reception_venue','religious_venue_coordinator','resort_reception_venue','setnayan_concierge','sponsor_coordinator','stylist_decorator','tea_set_styling','wedding_coordination','wedding_planner_partial']
    WHEN 'stage' THEN ARRAY['av_production','capiz_native_decor','chuppah_rental','decorator_general','double_happiness_decor','hacienda_heritage_decor','lights_sound','mandap_decor','maranao_okir_decor','stylist_decorator','tea_set_styling']
    WHEN 'ceiling' THEN ARRAY['capiz_native_decor','chuppah_rental','decorator_general','double_happiness_decor','hacienda_heritage_decor','lights_sound','mandap_decor','maranao_okir_decor','stylist_decorator','tea_set_styling']
    WHEN 'backdrop' THEN ARRAY['capiz_native_decor','chuppah_rental','decorator_general','double_happiness_decor','hacienda_heritage_decor','led_video_wall','mandap_decor','maranao_okir_decor','stylist_decorator','tea_set_styling']
    WHEN 'tunnel' THEN ARRAY['capiz_native_decor','chuppah_rental','decorator_general','double_happiness_decor','hacienda_heritage_decor','mandap_decor','maranao_okir_decor','stylist_decorator','tea_set_styling']
    WHEN 'table' THEN ARRAY['beach_wedding_florist','bridal_bouquet_specialty','capiz_native_decor','chuppah_rental','decorator_general','double_happiness_decor','florals','garden_wedding_florist','hacienda_heritage_decor','mandap_decor','maranao_okir_decor','stylist_decorator','tea_set_styling']
    WHEN 'chairs' THEN ARRAY['capiz_native_decor','chair_table_rental','chuppah_rental','decorator_general','double_happiness_decor','event_lights_rental','hacienda_heritage_decor','mandap_decor','maranao_okir_decor','stylist_decorator','tea_set_styling','tent_canopy_rental']
    WHEN 'ribbons_candles' THEN ARRAY['capiz_native_decor','chuppah_rental','decorator_general','double_happiness_decor','hacienda_heritage_decor','mandap_decor','maranao_okir_decor','stylist_decorator','tea_set_styling']
    WHEN 'lights' THEN ARRAY['capiz_native_decor','chuppah_rental','decorator_general','double_happiness_decor','hacienda_heritage_decor','lights_sound','mandap_decor','maranao_okir_decor','stylist_decorator','tea_set_styling']
    WHEN 'bridal_bouquet' THEN ARRAY['beach_wedding_florist','bridal_bouquet_specialty','florals','garden_wedding_florist']
    WHEN 'entourage_bouquets' THEN ARRAY['beach_wedding_florist','bridal_bouquet_specialty','florals','garden_wedding_florist']
    WHEN 'centrepieces' THEN ARRAY['accommodation','beach_wedding_florist','bridal_bouquet_specialty','capiz_native_decor','catering','chinese_lauriat_caterer','chuppah_rental','decorator_general','double_happiness_decor','florals','garden_wedding_florist','hacienda_heritage_decor','halal_catering','lechonero','mandap_decor','maranao_okir_decor','stylist_decorator','tea_set_styling']
    WHEN 'flower_accents' THEN ARRAY['beach_wedding_florist','bridal_bouquet_specialty','capiz_native_decor','chuppah_rental','decorator_general','double_happiness_decor','florals','garden_wedding_florist','hacienda_heritage_decor','mandap_decor','maranao_okir_decor','stylist_decorator','tea_set_styling']
    WHEN 'cake' THEN ARRAY['dessert_station','donut_wall_display','wedding_cake']
    WHEN 'bride' THEN ARRAY['barong_tagalog_custom','barong_tagalog_rental','bridal_gown_custom','bridal_gown_rental','bridal_hair_stylist','bridal_hmua','family_mua','filipiniana_balintawak','filipiniana_maria_clara','filipiniana_terno','inc_modest_bridal','maranao_wedding_attire','maternity_bride_mua','mature_bride_mua','muslim_modest_bridal','qipao_cheongsam_attire','sari_lehenga_bridal','tausug_wedding_attire','touchup_mua','yakan_wedding_attire']
    WHEN 'groom' THEN ARRAY['barong_tagalog_custom','barong_tagalog_rental','eighteen_roses_attire','filipiniana_balintawak','filipiniana_maria_clara','filipiniana_terno','groom_suit_custom','groom_suit_rental','groomsman_set','inc_modest_bridal','junior_groomsman','maranao_groom_attire','maranao_wedding_attire','muslim_groom_attire','muslim_modest_bridal','ninong_attire','ring_bearer_suit','sherwani_groom','tausug_groom_attire','tausug_wedding_attire','yakan_groom_attire','yakan_wedding_attire']
    WHEN 'bridesmaids' THEN ARRAY['barong_tagalog_custom','barong_tagalog_rental','bridesmaid_dress','debutante_gown','filipiniana_balintawak','filipiniana_maria_clara','filipiniana_terno','flower_girl_dress','inc_modest_bridal','junior_bridesmaid_dress','maranao_wedding_attire','mother_of_bride_gown','muslim_modest_bridal','ninang_attire','tausug_wedding_attire','yakan_wedding_attire']
    WHEN 'groomsmen' THEN ARRAY['barong_tagalog_custom','barong_tagalog_rental','eighteen_roses_attire','filipiniana_balintawak','filipiniana_maria_clara','filipiniana_terno','groomsman_set','inc_modest_bridal','junior_groomsman','maranao_wedding_attire','muslim_modest_bridal','ninong_attire','ring_bearer_suit','tausug_wedding_attire','yakan_wedding_attire']
    WHEN 'flower_girl' THEN ARRAY['barong_tagalog_custom','barong_tagalog_rental','bridesmaid_dress','debutante_gown','filipiniana_balintawak','filipiniana_maria_clara','filipiniana_terno','flower_girl_dress','inc_modest_bridal','junior_bridesmaid_dress','maranao_wedding_attire','mother_of_bride_gown','muslim_modest_bridal','ninang_attire','tausug_wedding_attire','yakan_wedding_attire']
    WHEN 'ring_bearer' THEN ARRAY['barong_tagalog_custom','barong_tagalog_rental','eighteen_roses_attire','filipiniana_balintawak','filipiniana_maria_clara','filipiniana_terno','groomsman_set','inc_modest_bridal','junior_groomsman','maranao_wedding_attire','muslim_modest_bridal','ninong_attire','ring_bearer_suit','tausug_wedding_attire','yakan_wedding_attire']
    ELSE ARRAY[]::TEXT[]
  END;
$$;

COMMENT ON FUNCTION public.inspiration_suggestion_services(TEXT) IS
  'The canonical shop services that may SUGGEST a photo to one couple part — the '
  'SQL mirror of canonicalServicesForSlot (MOODBOARD_SLOT_TRADES, '
  'apps/web/lib/moodboard-gallery.ts) for every part libraryPhotoParts() lists. '
  'A slot that is not a couple part answers EMPTY. tests/db/a-supplier-suggests-'
  'only-to-its-own-parts.db.test.ts fails when the two disagree: re-list it in a '
  'NEW migration from the TS map, never by hand.';

REVOKE ALL ON FUNCTION public.inspiration_suggestion_services(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.inspiration_suggestion_services(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.inspiration_suggestion_services(TEXT) TO authenticated;

-- ── 2 · THE SUGGESTIONS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_inspiration_suggestions (
  suggestion_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id             UUID NOT NULL
                         REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- The booking that suggested it. NULL once that booking is deleted — the row
  -- (and any photo the couple kept from it) stays, credited by `shop_label`.
  event_vendor_id      UUID
                         REFERENCES public.event_vendors(vendor_id) ON DELETE SET NULL,
  vendor_profile_id    UUID
                         REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE SET NULL,
  -- The shop's name AS IT READ when it suggested — the couple's credit.
  shop_label           TEXT NOT NULL,
  slot_key             TEXT NOT NULL,
  state                TEXT NOT NULL DEFAULT 'screening'
                         CONSTRAINT event_inspiration_suggestions_state_chk
                         CHECK (state IN ('screening', 'refused', 'waiting', 'kept', 'declined', 'withdrawn')),
  image_url            TEXT,
  r2_key               TEXT,
  sampled_hex_1        CHAR(7),
  sampled_hex_2        CHAR(7),
  sampled_hex_3        CHAR(7),
  sampled_hex_4        CHAR(7),
  sampled_hex_5        CHAR(7),
  sampled_hex_6        CHAR(7),
  -- What the content screen flagged without refusing (NULL = clean), for admin.
  screen_findings      JSONB,
  suggested_by_user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  screened_at          TIMESTAMPTZ,
  decided_at           TIMESTAMPTZ,
  decided_by_user_id   UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  -- The couple's photo a Keep replaced (soft-deleted, so Undo can restore it).
  replaced_inspiration_id UUID
                         REFERENCES public.event_inspiration_assets(inspiration_id) ON DELETE SET NULL,

  -- A row the couple can see carries a screened photo and its six colours.
  CONSTRAINT event_inspiration_suggestions_screened_has_photo
    CHECK (
      state IN ('screening', 'refused')
      OR (
        image_url IS NOT NULL AND screened_at IS NOT NULL
        AND sampled_hex_1 IS NOT NULL AND sampled_hex_2 IS NOT NULL AND sampled_hex_3 IS NOT NULL
        AND sampled_hex_4 IS NOT NULL AND sampled_hex_5 IS NOT NULL AND sampled_hex_6 IS NOT NULL
      )
    ),
  CONSTRAINT event_inspiration_suggestions_decided_dated
    CHECK (state NOT IN ('kept', 'declined', 'withdrawn') OR decided_at IS NOT NULL)
);

COMMENT ON TABLE public.event_inspiration_suggestions IS
  'A photo a BOOKED supplier suggested for one part of the couple''s board, '
  'waiting for the couple''s Keep / No thanks (owner 2026-10-19, option (b)). '
  'Opened by vendor_begin_inspiration_suggestion under the supplier''s session '
  '(booking, fee, trade and the 3-waiting cap decided in SQL); the photo and the '
  'move to ''waiting'' are written by the server ONLY after the content screen. '
  'Reaches event_inspiration_assets only through couple_decide_inspiration_suggestion.';

CREATE INDEX IF NOT EXISTS event_inspiration_suggestions_event_idx
  ON public.event_inspiration_suggestions (event_id, created_at DESC)
  WHERE state = 'waiting';
CREATE INDEX IF NOT EXISTS event_inspiration_suggestions_booking_idx
  ON public.event_inspiration_suggestions (event_vendor_id, slot_key)
  WHERE event_vendor_id IS NOT NULL;

ALTER TABLE public.event_inspiration_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_inspiration_suggestions_couple_read ON public.event_inspiration_suggestions;
CREATE POLICY event_inspiration_suggestions_couple_read
  ON public.event_inspiration_suggestions
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()) OR public.is_admin());

DROP POLICY IF EXISTS event_inspiration_suggestions_vendor_read ON public.event_inspiration_suggestions;
CREATE POLICY event_inspiration_suggestions_vendor_read
  ON public.event_inspiration_suggestions
  FOR SELECT TO authenticated
  USING (event_vendor_id IN (SELECT public.current_vendor_event_vendor_ids()));

DROP POLICY IF EXISTS event_inspiration_suggestions_admin_all ON public.event_inspiration_suggestions;
CREATE POLICY event_inspiration_suggestions_admin_all
  ON public.event_inspiration_suggestions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON TABLE public.event_inspiration_suggestions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.event_inspiration_suggestions FROM authenticated;

-- ── 3 · THE BOARD ROW A KEEP WRITES ─────────────────────────────────────────
ALTER TABLE public.event_inspiration_assets
  ADD COLUMN IF NOT EXISTS from_suggestion_id UUID
    REFERENCES public.event_inspiration_suggestions(suggestion_id) ON DELETE CASCADE;

COMMENT ON COLUMN public.event_inspiration_assets.from_suggestion_id IS
  'The supplier suggestion this board photo was KEPT from (source_kind = '
  '''supplier_suggestion''); its shop_label is the credit the couple reads. NULL '
  'for every other source.';

CREATE INDEX IF NOT EXISTS idx_event_inspiration_assets_from_suggestion
  ON public.event_inspiration_assets (from_suggestion_id)
  WHERE from_suggestion_id IS NOT NULL;

-- Re-listed from its LATEST definition (20271202349564, _v3), every value kept.
ALTER TABLE public.event_inspiration_assets
  DROP CONSTRAINT IF EXISTS event_inspiration_assets_source_kind_check_v3;
ALTER TABLE public.event_inspiration_assets
  DROP CONSTRAINT IF EXISTS event_inspiration_assets_source_kind_check_v4;
ALTER TABLE public.event_inspiration_assets
  ADD CONSTRAINT event_inspiration_assets_source_kind_check_v4
  CHECK (source_kind IN ('url_paste', 'file_upload', 'gallery_pick', 'render_pick', 'supplier_suggestion'));

ALTER TABLE public.event_inspiration_assets
  DROP CONSTRAINT IF EXISTS event_inspiration_assets_suggestion_has_provenance;
ALTER TABLE public.event_inspiration_assets
  ADD CONSTRAINT event_inspiration_assets_suggestion_has_provenance
  CHECK ((source_kind = 'supplier_suggestion') = (from_suggestion_id IS NOT NULL));

-- ── 4a · THE SUPPLIER OPENS A SUGGESTION ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vendor_begin_inspiration_suggestion(
  p_event_id UUID,
  p_slot_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking  UUID;
  v_profile  UUID;
  v_label    TEXT;
  v_waiting  INT;
  v_id       UUID;
BEGIN
  IF p_event_id IS NULL OR p_slot_key IS NULL OR auth.uid() IS NULL THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;

  -- The same door as get_vendor_mood_board: the booking fee unlocks the event.
  IF public.vendor_event_fee_gate_stage(p_event_id, TRUE) <> 'unlocked' THEN
    RAISE EXCEPTION 'fee_unsettled' USING ERRCODE = '42501';
  END IF;

  -- BOOKED on this event, by a shop the caller owns or admins.
  IF NOT EXISTS (
    SELECT 1 FROM public.event_vendors ev
    WHERE ev.event_id = p_event_id
      AND ev.marketplace_vendor_id IN (SELECT public.current_vendor_profile_ids())
  ) THEN
    RAISE EXCEPTION 'not_booked' USING ERRCODE = '42501';
  END IF;

  -- …whose services dress THIS part (the ONE slot→trade map, mirrored above).
  SELECT ev.vendor_id, vp.vendor_profile_id, COALESCE(NULLIF(btrim(vp.business_name), ''), 'Your supplier')
    INTO v_booking, v_profile, v_label
  FROM public.event_vendors ev
  JOIN public.vendor_profiles vp ON vp.vendor_profile_id = ev.marketplace_vendor_id
  WHERE ev.event_id = p_event_id
    AND ev.marketplace_vendor_id IN (SELECT public.current_vendor_profile_ids())
    AND COALESCE(vp.services, ARRAY[]::TEXT[]) && public.inspiration_suggestion_services(p_slot_key)
  ORDER BY ev.created_at
  LIMIT 1;
  IF v_booking IS NULL THEN
    RETURN jsonb_build_object('status', 'wrong_trade');
  END IF;

  -- Up to THREE waiting per part per shop. A row still being screened counts
  -- for ten minutes (an upload in flight), then stops counting.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_event_id::TEXT || ':' || p_slot_key || ':' || v_profile::TEXT, 0));
  SELECT count(*) INTO v_waiting
  FROM public.event_inspiration_suggestions s
  WHERE s.event_id = p_event_id
    AND s.slot_key = p_slot_key
    AND s.vendor_profile_id = v_profile
    AND (s.state = 'waiting' OR (s.state = 'screening' AND s.created_at > NOW() - INTERVAL '10 minutes'));
  IF v_waiting >= 3 THEN
    RETURN jsonb_build_object('status', 'full');
  END IF;

  INSERT INTO public.event_inspiration_suggestions
    (event_id, event_vendor_id, vendor_profile_id, shop_label, slot_key, state, suggested_by_user_id)
  VALUES
    (p_event_id, v_booking, v_profile, v_label, p_slot_key, 'screening', auth.uid())
  RETURNING suggestion_id INTO v_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'suggestion_id', v_id,
    'vendor_profile_id', v_profile,
    'shop_label', v_label
  );
END;
$$;

COMMENT ON FUNCTION public.vendor_begin_inspiration_suggestion(UUID, TEXT) IS
  'Opens ONE suggestion row (state ''screening'', no photo) for the caller''s '
  'booked shop on this event and this part. Raises not_booked / fee_unsettled; '
  'answers wrong_trade when no booked shop of the caller''s dresses the part '
  '(inspiration_suggestion_services) and full at three waiting. The photo is '
  'attached by the server after the content screen — never by this function.';

REVOKE ALL ON FUNCTION public.vendor_begin_inspiration_suggestion(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_begin_inspiration_suggestion(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.vendor_begin_inspiration_suggestion(UUID, TEXT) TO authenticated;

-- ── 4b · THE SUPPLIER TAKES ONE BACK ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vendor_withdraw_inspiration_suggestion(
  p_suggestion_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.event_inspiration_suggestions%ROWTYPE;
BEGIN
  IF p_suggestion_id IS NULL OR auth.uid() IS NULL THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;
  SELECT * INTO v_row FROM public.event_inspiration_suggestions
   WHERE suggestion_id = p_suggestion_id FOR UPDATE;
  IF NOT FOUND OR v_row.event_vendor_id IS NULL
     OR v_row.event_vendor_id NOT IN (SELECT public.current_vendor_event_vendor_ids()) THEN
    RAISE EXCEPTION 'not_yours' USING ERRCODE = '42501';
  END IF;
  IF v_row.state = 'withdrawn' THEN
    RETURN jsonb_build_object('status', 'already');
  END IF;
  IF v_row.state NOT IN ('waiting', 'screening') THEN
    RETURN jsonb_build_object('status', 'decided', 'state', v_row.state);
  END IF;
  UPDATE public.event_inspiration_suggestions
     SET state = 'withdrawn', decided_at = NOW(), decided_by_user_id = auth.uid()
   WHERE suggestion_id = p_suggestion_id;
  RETURN jsonb_build_object('status', 'ok');
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_withdraw_inspiration_suggestion(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_withdraw_inspiration_suggestion(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.vendor_withdraw_inspiration_suggestion(UUID) TO authenticated;

-- ── 4c · THE COUPLE: ✓ KEEP · ✕ NO THANKS ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.couple_decide_inspiration_suggestion(
  p_suggestion_id    UUID,
  p_keep             BOOLEAN,
  p_replace_position SMALLINT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row      public.event_inspiration_suggestions%ROWTYPE;
  v_pos      SMALLINT;
  v_replaced UUID;
  v_asset    UUID;
BEGIN
  IF p_suggestion_id IS NULL OR p_keep IS NULL THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;
  SELECT * INTO v_row FROM public.event_inspiration_suggestions
   WHERE suggestion_id = p_suggestion_id FOR UPDATE;
  IF NOT FOUND OR NOT public.colour_access_caller_is_couple(v_row.event_id) THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;
  IF v_row.state <> 'waiting' THEN
    RETURN jsonb_build_object('status', 'already', 'state', v_row.state);
  END IF;

  IF NOT p_keep THEN
    UPDATE public.event_inspiration_suggestions
       SET state = 'declined', decided_at = NOW(), decided_by_user_id = auth.uid()
     WHERE suggestion_id = p_suggestion_id;
    RETURN jsonb_build_object('status', 'ok', 'kept', FALSE);
  END IF;

  -- One writer per part at a time.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_row.event_id::TEXT || ':board:' || v_row.slot_key, 0));

  IF p_replace_position IS NULL THEN
    SELECT p INTO v_pos
    FROM unnest(ARRAY[1, 2, 3]::SMALLINT[]) AS p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.event_inspiration_assets a
      WHERE a.event_id = v_row.event_id AND a.slot_key = v_row.slot_key
        AND a.slot_position = p AND a.removed_at IS NULL
    )
    ORDER BY p
    LIMIT 1;
    -- 🔑 FULL: nothing is replaced unless the couple names which photo.
    IF v_pos IS NULL THEN
      RETURN jsonb_build_object('status', 'full');
    END IF;
  ELSE
    IF p_replace_position NOT IN (1, 2, 3) THEN
      RETURN jsonb_build_object('status', 'bad_input');
    END IF;
    v_pos := p_replace_position;
    UPDATE public.event_inspiration_assets
       SET removed_at = NOW()
     WHERE event_id = v_row.event_id AND slot_key = v_row.slot_key
       AND slot_position = v_pos AND removed_at IS NULL
    RETURNING inspiration_id INTO v_replaced;
  END IF;

  INSERT INTO public.event_inspiration_assets
    (event_id, added_by_user_id, slot_key, slot_position, source_kind, from_suggestion_id,
     image_url, r2_key,
     sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6)
  VALUES
    (v_row.event_id, auth.uid(), v_row.slot_key, v_pos, 'supplier_suggestion', v_row.suggestion_id,
     v_row.image_url, v_row.r2_key,
     v_row.sampled_hex_1, v_row.sampled_hex_2, v_row.sampled_hex_3,
     v_row.sampled_hex_4, v_row.sampled_hex_5, v_row.sampled_hex_6)
  RETURNING inspiration_id INTO v_asset;

  UPDATE public.event_inspiration_suggestions
     SET state = 'kept', decided_at = NOW(), decided_by_user_id = auth.uid(),
         replaced_inspiration_id = v_replaced
   WHERE suggestion_id = p_suggestion_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'kept', TRUE,
    'inspiration_id', v_asset,
    'slot_position', v_pos,
    'replaced', v_replaced IS NOT NULL
  );
END;
$$;

COMMENT ON FUNCTION public.couple_decide_inspiration_suggestion(UUID, BOOLEAN, SMALLINT) IS
  'The couple''s ✓ Keep / ✕ No thanks on one waiting suggestion '
  '(colour_access_caller_is_couple). Keep takes the part''s first free place; on '
  'a part holding three it answers ''full'' and CHANGES NOTHING unless '
  'p_replace_position names the photo to replace (soft-deleted, so Undo restores '
  'it). The board row carries source_kind ''supplier_suggestion'' + from_suggestion_id.';

REVOKE ALL ON FUNCTION public.couple_decide_inspiration_suggestion(UUID, BOOLEAN, SMALLINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.couple_decide_inspiration_suggestion(UUID, BOOLEAN, SMALLINT) FROM anon;
GRANT EXECUTE ON FUNCTION public.couple_decide_inspiration_suggestion(UUID, BOOLEAN, SMALLINT) TO authenticated;

-- ── 4d · THE KEEP TOAST'S UNDO ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.couple_undo_kept_inspiration_suggestion(
  p_suggestion_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row   public.event_inspiration_suggestions%ROWTYPE;
  v_pos   SMALLINT;
BEGIN
  IF p_suggestion_id IS NULL THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;
  SELECT * INTO v_row FROM public.event_inspiration_suggestions
   WHERE suggestion_id = p_suggestion_id FOR UPDATE;
  IF NOT FOUND OR NOT public.colour_access_caller_is_couple(v_row.event_id) THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;
  IF v_row.state <> 'kept' THEN
    RETURN jsonb_build_object('status', 'already', 'state', v_row.state);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_row.event_id::TEXT || ':board:' || v_row.slot_key, 0));

  UPDATE public.event_inspiration_assets
     SET removed_at = NOW()
   WHERE from_suggestion_id = p_suggestion_id AND removed_at IS NULL
  RETURNING slot_position INTO v_pos;

  -- The photo it replaced comes back — only into a place still free.
  IF v_row.replaced_inspiration_id IS NOT NULL THEN
    UPDATE public.event_inspiration_assets a
       SET removed_at = NULL
     WHERE a.inspiration_id = v_row.replaced_inspiration_id
       AND a.removed_at IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.event_inspiration_assets b
         WHERE b.event_id = a.event_id AND b.slot_key = a.slot_key
           AND b.slot_position = a.slot_position AND b.removed_at IS NULL
       );
  END IF;

  UPDATE public.event_inspiration_suggestions
     SET state = 'waiting', decided_at = NULL, decided_by_user_id = NULL,
         replaced_inspiration_id = NULL
   WHERE suggestion_id = p_suggestion_id;

  RETURN jsonb_build_object('status', 'ok', 'slot_position', v_pos);
END;
$$;

REVOKE ALL ON FUNCTION public.couple_undo_kept_inspiration_suggestion(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.couple_undo_kept_inspiration_suggestion(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.couple_undo_kept_inspiration_suggestion(UUID) TO authenticated;

COMMIT;

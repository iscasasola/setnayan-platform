-- ============================================================================
-- 20271278232574_palette_parts_five_more_slots.sql
-- Created via `pnpm migration:new`. Idempotent (each CHECK is dropped before it
-- is re-added). No column, no table, no policy, no grant, no data rewrite.
--
-- 🎨🖼 EVERY PALETTE PART HAS ITS OWN PHOTOS (owner 2026-10-19, DECISION_LOG
-- "APPROVED — PALETTE + INSPIRATION AS ONE LIST": Studio › Mood Board's Palette
-- and Inspiration become one list, each part drawn like an Attire row with its
-- own photos line; asked whether the five parts with no photo slot get one:
-- "yes"). Five parts of the room and the flowers had nowhere to keep a photo:
--
--     chairs · ribbons_candles · lights · entourage_bouquets · flower_accents
--
-- (Chairs · Ribbons & candles · Lights · warmth · Entourage bouquets · the
-- florist's Accents). Every other part already has a slot (stage, ceiling,
-- backdrop = Walls, tunnel, table = Table linens, bridal_bouquet, centrepieces,
-- cake).
--
-- Both gates are re-listed from their LATEST definition
-- (20271266380994_attire_boards_four_more_slots) under the SAME names (a db test
-- and the Ugat map name them), every value kept verbatim, plus the five. The
-- supplier gallery's gate widens with the board's for the reason that file
-- gives: a supplier's upload shelves derive from the ONE slot vocabulary
-- (`MOODBOARD_SLOT_KEYS`), so a board the gallery refused would search empty
-- for ever. The shop and rights-warranty halves of that predicate are untouched.
--
-- ADDITIVE ONLY. Both new lists are strict supersets of the old ones, so no
-- stored row can be invalidated and none is rewritten. Nothing reads the new
-- keys until the app that draws their parts is deployed; an older app never
-- writes them.
-- ============================================================================

BEGIN;

-- ── 1. The board's gate ─────────────────────────────────────────────────────
ALTER TABLE public.event_inspiration_assets
  DROP CONSTRAINT IF EXISTS event_inspiration_assets_slot_key_check_v3;
ALTER TABLE public.event_inspiration_assets
  ADD CONSTRAINT event_inspiration_assets_slot_key_check_v3
  CHECK (slot_key IN (
    'venue','tunnel','stage','table','ceiling','overall',
    'backdrop','flowers','cocktail','reception_venue','cake',
    'palette',
    'groom','bride','principal_sponsor','entourage','parents','guests',
    'bridal_bouquet','centrepieces',
    'bridesmaids','groomsmen','flower_girl','ring_bearer',
    'chairs','ribbons_candles','lights','entourage_bouquets','flower_accents'
  ));

-- ── 2. The supplier gallery's gate ──────────────────────────────────────────
ALTER TABLE public.moodboard_library_assets
  DROP CONSTRAINT IF EXISTS moodboard_library_assets_supplier_gallery_shape;
ALTER TABLE public.moodboard_library_assets
  ADD CONSTRAINT moodboard_library_assets_supplier_gallery_shape
  CHECK (
    asset_type <> 'supplier_gallery'
    OR (
      vendor_profile_id IS NOT NULL
      AND asset_subtype IN (
        'venue','tunnel','stage','table','ceiling','overall',
        'backdrop','flowers','cocktail','reception_venue','cake',
        'palette',
        'groom','bride','principal_sponsor','entourage','parents','guests',
        'bridal_bouquet','centrepieces',
        'bridesmaids','groomsmen','flower_girl','ring_bearer',
    'chairs','ribbons_candles','lights','entourage_bouquets','flower_accents'
      )
      AND (approved_at IS NULL OR rights_warranted_at IS NOT NULL)
    )
  );

-- ── Said out loud: both gates carry the five, and neither lost a value ──────
DO $$
DECLARE
  gate TEXT;
  def TEXT;
  k TEXT;
BEGIN
  FOREACH gate IN ARRAY ARRAY[
    'event_inspiration_assets_slot_key_check_v3',
    'moodboard_library_assets_supplier_gallery_shape'
  ] LOOP
    SELECT pg_get_constraintdef(c.oid) INTO def
      FROM pg_constraint c
     WHERE c.conname = gate AND c.connamespace = 'public'::regnamespace;
    IF def IS NULL THEN
      RAISE EXCEPTION 'refusing to finish: % is missing after the re-listing', gate;
    END IF;
    FOREACH k IN ARRAY ARRAY[
      'venue','tunnel','stage','table','ceiling','overall',
      'backdrop','flowers','cocktail','reception_venue','cake',
      'palette',
      'groom','bride','principal_sponsor','entourage','parents','guests',
      'bridal_bouquet','centrepieces',
      'bridesmaids','groomsmen','flower_girl','ring_bearer',
    'chairs','ribbons_candles','lights','entourage_bouquets','flower_accents'
    ] LOOP
      IF position(quote_literal(k) IN def) = 0 THEN
        RAISE EXCEPTION 'refusing to finish: % does not list %', gate, k;
      END IF;
    END LOOP;
  END LOOP;
END $$;

COMMIT;

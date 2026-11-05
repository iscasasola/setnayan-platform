-- ============================================================================
-- 20271266380994_attire_boards_four_more_slots.sql
-- Created via `pnpm migration:new`. Idempotent (each CHECK is dropped before it
-- is re-added). No column, no table, no policy, no grant, no data rewrite.
--
-- 👗 FOUR MORE ATTIRE BOARDS — Bridesmaids · Groomsmen · Flower girl · Ring
-- bearer (owner 2026-10-08, verbatim: "Inspiration can go more. Bridal Gown,
-- Groom's Suit, Groomsmen, Bridesmaid, Flowergirl, Ring Bearer" · "this simply
-- means on attire, they can upload inspiration photos and also search from the
-- photos uploaded by vendors"; asked whether the database change for the four
-- may go ahead: "go").
--
-- Studio › Mood Board & Dress Code › Attire drew three boards on the slots that
-- already existed (`bride` · `groom` · `entourage`). The other four had nowhere
-- to keep a photo: a board's photos live in `event_inspiration_assets`, one row
-- per (event, slot_key, slot_position), and `slot_key` is a closed list held by
-- a CHECK. This file adds the four keys to that list:
--
--     bridesmaids · groomsmen · flower_girl · ring_bearer
--
-- named the way their neighbours are (`bride`, `groom`, `entourage`, `parents`,
-- `guests`) — and `bridesmaids` / `groomsmen` are also the keys the guest list's
-- role groups and the Mood Board's palettes already use for those people.
--
-- ── 1. event_inspiration_assets_slot_key_check_v3 — the board's gate ────────
-- Re-listed from its LATEST definition (20271265788160) under the SAME name
-- (a db test and the Ugat map name it) with every value kept verbatim, plus the
-- four.
--
-- ── 2. moodboard_library_assets_supplier_gallery_shape — the gallery's gate ─
-- The second CHECK, and the reason this file touches two tables. A board's
-- "Search ideas ›" reads the supplier gallery BY SHELF: a supplier's photo
-- carries the slot it belongs in (`asset_subtype`), and this CHECK closes that
-- list. The app keeps ONE slot vocabulary (`MOODBOARD_SLOT_KEYS`) and derives a
-- supplier's upload shelves from it, so widening the board's gate alone would
-- offer a tailor a "Bridesmaids' attire" shelf the database then refuses — and
-- that board's search would be empty for ever (the same hazard 20271265788160
-- names for the bouquet). Re-listed verbatim from 20271265788160, plus the four;
-- the shop and rights-warranty halves of the predicate are untouched.
--
-- ADDITIVE ONLY. Both new lists are strict supersets of the old ones, so no
-- stored row can be invalidated and no row is rewritten; ADD CONSTRAINT
-- re-checks the existing rows against a list that still holds every value they
-- can carry. Nothing reads the new keys until the app that draws the boards is
-- deployed; an older app never writes them.
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
    'bridesmaids','groomsmen','flower_girl','ring_bearer'
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
        'bridesmaids','groomsmen','flower_girl','ring_bearer'
      )
      AND (approved_at IS NULL OR rights_warranted_at IS NOT NULL)
    )
  );

-- ── Said out loud: both gates carry the four, and neither lost a value ──────
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
      'bridesmaids','groomsmen','flower_girl','ring_bearer'
    ] LOOP
      IF position(quote_literal(k) IN def) = 0 THEN
        RAISE EXCEPTION 'refusing to finish: % does not list %', gate, k;
      END IF;
    END LOOP;
  END LOOP;
END $$;

COMMIT;

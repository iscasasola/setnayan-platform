-- ============================================================================
-- 20271297295494_inspiration_photo_links_its_card.sql
-- 🔗🖼 A SUPPLIER'S INSPIRATION PHOTO IS CONNECTED FOUR WAYS — ITS SERVICE CARD · THE EVENT · THE SUPPLIER'S PAGE ·
-- THE CATEGORY/SERVICE POOL (owner 2026-10-30, DECISION_LOG row of that name: "When a vendor uploads an inspiration
-- photo, it is connected to their service card, to the event and to their website and the inspiration pool for that
-- category/service" → "Yes").
--
-- Measured before writing: NOTHING linked a photo to a service card. The event link already existed
-- (`moodboard_library_assets.source_event_id`, `event_inspiration_suggestions.event_id`), the pool already existed
-- (`approved_at` + `retired_at` + the public read policy) and the supplier's page is a READ (no schema). So this adds
-- exactly two facts:
--
--   1 · THE CARD. `vendor_service_id` on `moodboard_library_assets` and on `event_inspiration_suggestions` — nullable
--       (a photo that fits no card belongs to the SHOP only, owner 2026-10-29 "card-optional"), FK → vendor_services,
--       ON DELETE SET NULL (deleting a card must never delete a couple's inspiration, nor block the card's delete).
--   2 · THE SUGGESTION A POOL PHOTO CAME FROM. `moodboard_library_assets.source_suggestion_id` — a Mood Board
--       suggestion is also offered to the library as a PENDING pool row (approved_at NULL → admin approves as today).
--       One pool row per suggestion (partial UNIQUE), ON DELETE SET NULL.
--
-- 🛑 THE CARD MUST BE THE ROW'S OWN SHOP — HELD HERE, NOT ONLY IN THE ACTION. A trigger refuses a card that belongs to
-- another shop on BOTH tables, and refuses a card on a library row that is not a supplier-gallery photo. RLS is
-- row-level, never value-level (SEC-8 / 20271202522764), and the service role skips RLS but not a trigger.
--   ⚠ THE TRIGGER NEVER RAISES ON A NULL. A SET NULL cascade (the card deleted, or a suggestion's shop SET NULL when
--   the shop closes) fires UPDATE through this trigger; raising there would turn ON DELETE SET NULL into RESTRICT —
--   the trap 20271202522764's source_event_id comment names for CHECKs. A row whose shop went NULL loses its card in
--   the same write instead.
--   🔑 And no CHECK constraint names either new column, for that same reason.
--
-- 🔒 GRANTS. `moodboard_library_assets` holds column-level grants for anon/authenticated since MB11 (table-level
-- revoked, an explicit allow-list re-granted), so a NEW column inherits NOTHING:
--   · vendor_service_id    → SELECT granted to anon + authenticated. The link is public by design: an approved photo
--                            shows its card on the supplier's page, and the card itself is public (`vendor_services`
--                            public read of active rows). INSERT/UPDATE are NOT granted — written by the server only,
--                            after it proved the card is the uploader's (`verifyCardForPart`).
--   · source_suggestion_id → NOTHING. It is a correlation handle on a couple's event (a suggestion belongs to one
--                            event), exactly the class `source_event_id` is withheld for. Service role only.
-- `event_inspiration_suggestions` keeps table-level SELECT for authenticated (RLS decides the rows: the couple, the
-- booking, admin) and NO write grant (20271279311294) — so its new column is readable by those two parties and
-- writable by the service role only, the same as every other column there.
--
-- RLS: unchanged. No policy is added, dropped or widened.
--
-- 🛑 NOT APPLIED BY HAND. `deploy-prod.yml` runs `supabase db push --include-all --yes` on the committed file.
-- ============================================================================

BEGIN;

-- ── 1 · THE CARD ────────────────────────────────────────────────────────────
ALTER TABLE public.moodboard_library_assets
  ADD COLUMN IF NOT EXISTS vendor_service_id UUID
    REFERENCES public.vendor_services(vendor_service_id) ON DELETE SET NULL;

ALTER TABLE public.event_inspiration_suggestions
  ADD COLUMN IF NOT EXISTS vendor_service_id UUID
    REFERENCES public.vendor_services(vendor_service_id) ON DELETE SET NULL;

-- The card's inspiration is read BY CARD (the supplier's page, a service card's looks) — and the SET NULL cascade
-- scans by it on every card delete.
CREATE INDEX IF NOT EXISTS moodboard_library_assets_vendor_service_idx
  ON public.moodboard_library_assets (vendor_service_id) WHERE vendor_service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS event_inspiration_suggestions_vendor_service_idx
  ON public.event_inspiration_suggestions (vendor_service_id) WHERE vendor_service_id IS NOT NULL;

COMMENT ON COLUMN public.moodboard_library_assets.vendor_service_id IS
  'Which of the supplier''s own service cards this inspiration photo belongs to (owner 2026-10-30, "connected four ways"). NULL = the shop only (no card fits). Supplier-gallery rows only, and only a card of THIS row''s shop — both held by the trigger inspiration_card_is_the_shops_own. Written by the server only (no INSERT/UPDATE grant); SELECT granted to anon/authenticated because the link is shown on the supplier''s public page.';
COMMENT ON COLUMN public.event_inspiration_suggestions.vendor_service_id IS
  'Which of the suggesting shop''s service cards this suggested photo belongs to (owner 2026-10-30). NULL = the shop only. Held to the row''s own shop by the trigger inspiration_card_is_the_shops_own; written by the service role only, like every column of this table.';

-- ── 2 · THE SUGGESTION A POOL PHOTO CAME FROM ───────────────────────────────
ALTER TABLE public.moodboard_library_assets
  ADD COLUMN IF NOT EXISTS source_suggestion_id UUID
    REFERENCES public.event_inspiration_suggestions(suggestion_id) ON DELETE SET NULL;

-- One pool row per suggestion: a double tap, a retry or a crafted second call cannot file the same photo twice.
CREATE UNIQUE INDEX IF NOT EXISTS moodboard_library_assets_one_per_suggestion
  ON public.moodboard_library_assets (source_suggestion_id) WHERE source_suggestion_id IS NOT NULL;

COMMENT ON COLUMN public.moodboard_library_assets.source_suggestion_id IS
  'The Mood Board suggestion this pool photo was offered from (owner 2026-10-30: a suggestion, kept or declined, is also offered to the library — PENDING until an admin approves). One per suggestion (partial UNIQUE). Counts toward the per-category back-catalogue quota although it is event-linked. NO grant to anon/authenticated: a suggestion belongs to one event, so this is a correlation handle on a couple''s event, withheld like source_event_id. Service role only.';

-- ── 3 · THE CARD MUST BE THE ROW'S OWN SHOP ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.inspiration_card_is_the_shops_own()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.vendor_service_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- A row whose shop went NULL (a suggestion's shop closed: SET NULL) cannot keep a card — dropped, never raised,
  -- so the cascade that fired this UPDATE still succeeds.
  IF NEW.vendor_profile_id IS NULL THEN
    NEW.vendor_service_id := NULL;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'moodboard_library_assets' AND (to_jsonb(NEW) ->> 'asset_type') IS DISTINCT FROM 'supplier_gallery' THEN
    RAISE EXCEPTION 'only a supplier''s inspiration photo can name a service card'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_services s
     WHERE s.vendor_service_id = NEW.vendor_service_id
       AND s.vendor_profile_id = NEW.vendor_profile_id
  ) THEN
    RAISE EXCEPTION 'that service card is not this shop''s'
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- A trigger function is not an API: nobody calls it, so nobody holds EXECUTE (the exposure freeze).
REVOKE ALL ON FUNCTION public.inspiration_card_is_the_shops_own() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS inspiration_card_is_the_shops_own ON public.moodboard_library_assets;
CREATE TRIGGER inspiration_card_is_the_shops_own
  BEFORE INSERT OR UPDATE OF vendor_service_id, vendor_profile_id, asset_type ON public.moodboard_library_assets
  FOR EACH ROW EXECUTE FUNCTION public.inspiration_card_is_the_shops_own();

DROP TRIGGER IF EXISTS inspiration_card_is_the_shops_own ON public.event_inspiration_suggestions;
CREATE TRIGGER inspiration_card_is_the_shops_own
  BEFORE INSERT OR UPDATE OF vendor_service_id, vendor_profile_id ON public.event_inspiration_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.inspiration_card_is_the_shops_own();

-- ── 4 · GRANTS ──────────────────────────────────────────────────────────────
-- Adds ONE column to MB11's SELECT allow-list (a bare column GRANT only adds; it cannot reopen anything MB11 closed).
GRANT SELECT (vendor_service_id) ON public.moodboard_library_assets TO anon, authenticated;
GRANT ALL ON public.moodboard_library_assets TO service_role;
GRANT ALL ON public.event_inspiration_suggestions TO service_role;

-- ── 5 · SAID OUT LOUD ───────────────────────────────────────────────────────
DO $$
DECLARE
  rle TEXT;
BEGIN
  FOREACH rle IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF NOT has_column_privilege(rle, 'public.moodboard_library_assets', 'vendor_service_id', 'SELECT') THEN
      RAISE EXCEPTION 'refusing to finish: % cannot read vendor_service_id — the supplier page could not show the card', rle;
    END IF;
    IF has_column_privilege(rle, 'public.moodboard_library_assets', 'vendor_service_id', 'INSERT')
       OR has_column_privilege(rle, 'public.moodboard_library_assets', 'vendor_service_id', 'UPDATE') THEN
      RAISE EXCEPTION 'refusing to finish: % can WRITE vendor_service_id — a supplier could name another shop''s card past the action', rle;
    END IF;
    IF has_column_privilege(rle, 'public.moodboard_library_assets', 'source_suggestion_id', 'SELECT')
       OR has_column_privilege(rle, 'public.moodboard_library_assets', 'source_suggestion_id', 'INSERT')
       OR has_column_privilege(rle, 'public.moodboard_library_assets', 'source_suggestion_id', 'UPDATE') THEN
      RAISE EXCEPTION 'refusing to finish: % holds a privilege on source_suggestion_id — a correlation handle on a couple''s event', rle;
    END IF;
    -- The column MB11 withheld stays withheld.
    IF has_column_privilege(rle, 'public.moodboard_library_assets', 'source_event_id', 'SELECT') THEN
      RAISE EXCEPTION 'refusing to finish: % can read source_event_id again', rle;
    END IF;
  END LOOP;
  IF has_column_privilege('authenticated', 'public.event_inspiration_suggestions', 'vendor_service_id', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.event_inspiration_suggestions', 'vendor_service_id', 'INSERT') THEN
    RAISE EXCEPTION 'refusing to finish: a signed-in session can write a suggestion''s card';
  END IF;
END $$;

COMMIT;

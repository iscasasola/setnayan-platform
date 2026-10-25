-- ============================================================================
-- 20271287668170_inspiration_parts_on_the_taxonomy.sql
-- Created via `pnpm migration:new`. Idempotent: CREATE … IF NOT EXISTS, CREATE OR
-- REPLACE FUNCTION, DROP … IF EXISTS before every policy and trigger, and a seed
-- that is ON CONFLICT DO NOTHING (a re-run never overwrites an admin's edit).
--
-- 🧩 THE INSPIRATION PARTS MOVE ONTO THE TAXONOMY (owner 2026-10-26, verbatim:
-- "Approve the redesign package — build the nine steps in order, each final";
-- the package is the corpus's `prototypes/admin_inspiration_groups_2026-10-25/
-- PLAN.md`, this file is its step ①). Today the Mood Board's parts are three
-- TypeScript consts plus a CHECK (`MOODBOARD_SLOT_KEYS`, `MOODBOARD_SLOT_TRADES`,
-- the labels, `event_inspiration_assets_slot_key_check_v3`): adding a part is a
-- migration and three const edits. Two tables replace them, ON TOP OF
-- `service_categories` — nothing parallel to the taxonomy:
--
--   inspiration_parts            one row per part, keyed by TODAY'S slot key,
--                                with its HOME category (tier 2)
--   inspiration_part_categories  "also from": more tier-2 categories whose shops
--                                may fill the part, in the credit's order
--
-- ADDITIVE ONLY. No existing table, column, constraint or row is touched: photos
-- keep their keys (`event_inspiration_assets.slot_key`,
-- `moodboard_library_assets.asset_subtype`), and nothing reads these tables until
-- step ② ships its reader (which falls back to the consts). Step ② swaps the
-- board's CHECK for an FK into `inspiration_parts(slot_key)`.
--
-- RULES HELD BY THE DATABASE, NOT BY HOPE:
--   · every `part` has a home category (CHECK), and every category named here is
--     a tier-2 row of `service_categories` (trigger — a CHECK cannot read another
--     table);
--   · the key is permanent (trigger — a photo row carries it);
--   · a part that holds a photo, on the couple's board OR in a supplier's
--     gallery, can only be HIDDEN, never deleted (trigger).
--
-- RLS at CREATE TABLE time, `service_categories`' own pattern: anyone reads
-- (anon + authenticated — the couple, the supplier and the public gallery all
-- draw these names), only `is_admin()` writes. anon's write grants are revoked
-- outright, so RLS is not the only layer.
--
-- 🌱 THE SEED IS GENERATED, NOT TYPED: `apps/web/scripts/gen-inspiration-parts-
-- seed.ts` prints the block between the GENERATED SEED markers from
-- `apps/web/lib/inspiration-parts-seed.ts` (the consts), and
-- `tests/db/inspiration-parts-seed-equals-the-consts.db.test.ts` holds the
-- replayed rows equal to the consts. Prod check before writing (2026-10-26,
-- read-only): all 21 tiles the seed names are active tier-2 rows.
-- ============================================================================

BEGIN;

-- ── 1. The parts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inspiration_parts (
  slot_key          TEXT PRIMARY KEY,
  label_en          TEXT NOT NULL,
  -- 'system' = the palette: a colour reference is nobody's portfolio, so it has
  -- no supplying category.
  kind              TEXT NOT NULL DEFAULT 'part',
  home_category_id  TEXT REFERENCES public.service_categories(id) ON DELETE RESTRICT,
  sort_order        INT  NOT NULL DEFAULT 0,
  -- Hidden from couples. Hide, never delete, once a photo exists.
  hidden            BOOLEAN NOT NULL DEFAULT FALSE,
  status            TEXT NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT inspiration_parts_kind_chk CHECK (kind IN ('part','system')),
  CONSTRAINT inspiration_parts_status_chk CHECK (status IN ('active','retired')),
  CONSTRAINT inspiration_parts_part_has_a_home CHECK (kind = 'system' OR home_category_id IS NOT NULL),
  -- The key lands in two photo tables and a URL (`?open=p:<key>`): lower-case words only.
  CONSTRAINT inspiration_parts_slot_key_shape CHECK (slot_key ~ '^[a-z][a-z0-9_]{1,39}$'),
  CONSTRAINT inspiration_parts_label_len CHECK (char_length(btrim(label_en)) BETWEEN 1 AND 60)
);

COMMENT ON TABLE public.inspiration_parts IS
  'The Mood Board''s inspiration parts, on the taxonomy: one row per part, keyed by '
  'the slot key its photos carry (event_inspiration_assets.slot_key, '
  'moodboard_library_assets.asset_subtype for supplier_gallery), with a tier-2 home '
  'category. A part with photos is hidden, never deleted. PLAN admin_inspiration_groups_2026-10-25 step 1.';

CREATE INDEX IF NOT EXISTS inspiration_parts_home_idx
  ON public.inspiration_parts (home_category_id);

ALTER TABLE public.inspiration_parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inspiration_parts_read_all ON public.inspiration_parts;
CREATE POLICY inspiration_parts_read_all
  ON public.inspiration_parts FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS inspiration_parts_admin_write ON public.inspiration_parts;
CREATE POLICY inspiration_parts_admin_write
  ON public.inspiration_parts FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.inspiration_parts FROM anon;

-- ── 2. "Also from" ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inspiration_part_categories (
  slot_key    TEXT NOT NULL REFERENCES public.inspiration_parts(slot_key) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES public.service_categories(id) ON DELETE RESTRICT,
  -- The credit's order: "the first tile a shop matches is the one printed on the
  -- credit" (MOODBOARD_SLOT_TRADES), so the order of the also-categories is data.
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (slot_key, category_id)
);

COMMENT ON TABLE public.inspiration_part_categories IS
  'More tier-2 categories whose shops may fill an inspiration part, besides its home '
  '(inspiration_parts.home_category_id), in credit order.';

CREATE INDEX IF NOT EXISTS inspiration_part_categories_category_idx
  ON public.inspiration_part_categories (category_id);

ALTER TABLE public.inspiration_part_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inspiration_part_categories_read_all ON public.inspiration_part_categories;
CREATE POLICY inspiration_part_categories_read_all
  ON public.inspiration_part_categories FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS inspiration_part_categories_admin_write ON public.inspiration_part_categories;
CREATE POLICY inspiration_part_categories_admin_write
  ON public.inspiration_part_categories FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.inspiration_part_categories FROM anon;

-- ── 3. Every category named is a tier-2 category ────────────────────────────
CREATE OR REPLACE FUNCTION public.inspiration_part_category_is_tier_2()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  cat TEXT;
  t SMALLINT;
BEGIN
  IF TG_TABLE_NAME = 'inspiration_parts' THEN
    cat := NEW.home_category_id;
  ELSE
    cat := NEW.category_id;
  END IF;
  IF cat IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT sc.tier INTO t FROM public.service_categories sc WHERE sc.id = cat;
  IF t IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'an inspiration part names category %, which is not a tier-2 category (tier %)', cat, t
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inspiration_parts_home_is_tier_2 ON public.inspiration_parts;
CREATE TRIGGER inspiration_parts_home_is_tier_2
  BEFORE INSERT OR UPDATE OF home_category_id ON public.inspiration_parts
  FOR EACH ROW EXECUTE FUNCTION public.inspiration_part_category_is_tier_2();

DROP TRIGGER IF EXISTS inspiration_part_categories_is_tier_2 ON public.inspiration_part_categories;
CREATE TRIGGER inspiration_part_categories_is_tier_2
  BEFORE INSERT OR UPDATE OF category_id ON public.inspiration_part_categories
  FOR EACH ROW EXECUTE FUNCTION public.inspiration_part_category_is_tier_2();

-- ── 4. The key is permanent; updated_at moves ───────────────────────────────
CREATE OR REPLACE FUNCTION public.inspiration_parts_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.slot_key IS DISTINCT FROM OLD.slot_key THEN
    RAISE EXCEPTION 'an inspiration part''s key is permanent (% → %): photos carry it — rename the label instead',
      OLD.slot_key, NEW.slot_key
      USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inspiration_parts_before_update ON public.inspiration_parts;
CREATE TRIGGER inspiration_parts_before_update
  BEFORE UPDATE ON public.inspiration_parts
  FOR EACH ROW EXECUTE FUNCTION public.inspiration_parts_before_update();

-- ── 5. A part with photos can only be hidden ────────────────────────────────
-- SECURITY DEFINER so the count sees every event's photos, whoever deletes — an
-- RLS-filtered count of zero would let a delete through that orphans photos the
-- caller cannot see. Counts removed (soft-deleted) board rows too: they still
-- carry the key.
CREATE OR REPLACE FUNCTION public.inspiration_parts_refuse_delete_with_photos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  board_n BIGINT;
  gallery_n BIGINT;
BEGIN
  SELECT count(*) INTO board_n
    FROM public.event_inspiration_assets a
   WHERE a.slot_key = OLD.slot_key;
  SELECT count(*) INTO gallery_n
    FROM public.moodboard_library_assets m
   WHERE m.asset_type = 'supplier_gallery'
     AND m.asset_subtype = OLD.slot_key;
  IF board_n + gallery_n > 0 THEN
    RAISE EXCEPTION 'inspiration part % holds % photo(s) — hide it instead', OLD.slot_key, board_n + gallery_n
      USING ERRCODE = 'restrict_violation',
            HINT = 'UPDATE public.inspiration_parts SET hidden = TRUE WHERE slot_key = ' || quote_literal(OLD.slot_key);
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.inspiration_parts_refuse_delete_with_photos() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS inspiration_parts_refuse_delete_with_photos ON public.inspiration_parts;
CREATE TRIGGER inspiration_parts_refuse_delete_with_photos
  BEFORE DELETE ON public.inspiration_parts
  FOR EACH ROW EXECUTE FUNCTION public.inspiration_parts_refuse_delete_with_photos();

-- ── 6. The seed — today's map, byte for byte ────────────────────────────────
-- BEGIN GENERATED SEED (scripts/gen-inspiration-parts-seed.ts)
INSERT INTO public.inspiration_parts (slot_key, label_en, kind, home_category_id, sort_order, hidden) VALUES
  ('overall', 'Venue & decor', 'part', 'reception', 10, FALSE),
  ('stage', 'Stage', 'part', 'stylist_decorator', 20, FALSE),
  ('ceiling', 'Ceiling', 'part', 'stylist_decorator', 30, FALSE),
  ('backdrop', 'Walls', 'part', 'stylist_decorator', 40, FALSE),
  ('tunnel', 'Tunnel', 'part', 'stylist_decorator', 50, FALSE),
  ('table', 'Table linens', 'part', 'stylist_decorator', 60, FALSE),
  ('chairs', 'Chairs', 'part', 'chairs_tents', 70, FALSE),
  ('ribbons_candles', 'Ribbons & candles', 'part', 'stylist_decorator', 80, FALSE),
  ('lights', 'Lights · warmth', 'part', 'lights_sound', 90, FALSE),
  ('bridal_bouquet', 'Bridal bouquet', 'part', 'florist', 100, FALSE),
  ('entourage_bouquets', 'Entourage bouquets', 'part', 'florist', 110, FALSE),
  ('centrepieces', 'Centrepieces', 'part', 'florist', 120, FALSE),
  ('flower_accents', 'Accents', 'part', 'florist', 130, FALSE),
  ('cake', 'Cake', 'part', 'cake', 140, FALSE),
  ('bride', 'Bridal gown', 'part', 'brides_attire', 150, FALSE),
  ('groom', 'Groom’s suit', 'part', 'grooms_attire', 160, FALSE),
  ('bridesmaids', 'Bridesmaids', 'part', 'womens_attire', 170, FALSE),
  ('groomsmen', 'Groomsmen', 'part', 'mens_attire', 180, FALSE),
  ('flower_girl', 'Flower girl', 'part', 'womens_attire', 190, FALSE),
  ('ring_bearer', 'Ring bearer', 'part', 'mens_attire', 200, FALSE),
  ('venue', 'Ceremony venue', 'part', 'ceremony_venue', 210, FALSE),
  ('reception_venue', 'Reception venue', 'part', 'reception', 220, FALSE),
  ('flowers', 'Flowers', 'part', 'florist', 230, TRUE),
  ('cocktail', 'Cocktail hour', 'part', 'mobile_bar', 240, FALSE),
  ('principal_sponsor', 'Principal sponsors’ attire', 'part', 'womens_attire', 250, FALSE),
  ('entourage', 'Entourage attire', 'part', 'womens_attire', 260, FALSE),
  ('parents', 'Parents’ attire', 'part', 'womens_attire', 270, FALSE),
  ('guests', 'Guest attire', 'part', 'womens_attire', 280, FALSE),
  ('palette', 'Palette', 'system', NULL, 290, TRUE)
ON CONFLICT (slot_key) DO NOTHING;

INSERT INTO public.inspiration_part_categories (slot_key, category_id, sort_order) VALUES
  ('overall', 'stylist_decorator', 10),
  ('overall', 'lights_sound', 20),
  ('overall', 'coordinator', 30),
  ('stage', 'av_production', 10),
  ('stage', 'lights_sound', 20),
  ('ceiling', 'lights_sound', 10),
  ('backdrop', 'led_wall', 10),
  ('table', 'florist', 10),
  ('chairs', 'stylist_decorator', 10),
  ('lights', 'stylist_decorator', 10),
  ('centrepieces', 'stylist_decorator', 10),
  ('centrepieces', 'catering', 20),
  ('flower_accents', 'stylist_decorator', 10),
  ('cake', 'dessert', 10),
  ('bride', 'filipiniana_barongs', 10),
  ('bride', 'hmua', 20),
  ('groom', 'mens_attire', 10),
  ('groom', 'filipiniana_barongs', 20),
  ('bridesmaids', 'filipiniana_barongs', 10),
  ('groomsmen', 'filipiniana_barongs', 10),
  ('flower_girl', 'filipiniana_barongs', 10),
  ('ring_bearer', 'filipiniana_barongs', 10),
  ('flowers', 'stylist_decorator', 10),
  ('cocktail', 'mocktail', 10),
  ('cocktail', 'coffee_espresso', 20),
  ('principal_sponsor', 'mens_attire', 10),
  ('principal_sponsor', 'filipiniana_barongs', 20),
  ('entourage', 'mens_attire', 10),
  ('entourage', 'filipiniana_barongs', 20),
  ('parents', 'mens_attire', 10),
  ('parents', 'filipiniana_barongs', 20),
  ('guests', 'mens_attire', 10),
  ('guests', 'filipiniana_barongs', 20)
ON CONFLICT (slot_key, category_id) DO NOTHING;
-- END GENERATED SEED

-- ── Said out loud: every key the board's CHECK allows is a part ─────────────
DO $$
DECLARE
  k TEXT;
  n INT;
BEGIN
  FOREACH k IN ARRAY ARRAY[
    'venue','tunnel','stage','table','ceiling','overall',
    'backdrop','flowers','cocktail','reception_venue','cake',
    'palette',
    'groom','bride','principal_sponsor','entourage','parents','guests',
    'bridal_bouquet','centrepieces',
    'bridesmaids','groomsmen','flower_girl','ring_bearer',
    'chairs','ribbons_candles','lights','entourage_bouquets','flower_accents'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM public.inspiration_parts WHERE slot_key = k) THEN
      RAISE EXCEPTION 'refusing to finish: slot key % has no inspiration part', k;
    END IF;
  END LOOP;
  SELECT count(*) INTO n FROM public.inspiration_parts WHERE kind = 'part' AND home_category_id IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'refusing to finish: % part(s) have no home category', n;
  END IF;
END $$;

COMMIT;

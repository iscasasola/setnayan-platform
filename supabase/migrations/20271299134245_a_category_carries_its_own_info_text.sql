-- a_category_carries_its_own_info_text
-- Created via `pnpm migration:new`. Idempotent — safe to re-apply.
--
-- THE ⓘ OF A CATEGORY (AND OF A GROUP) IS WRITTEN IN ADMIN › CATEGORIES (owner 2026-10-31, live):
--   "I added a category shoes but there is not (i)" … "This means you need to add a place for me to write an (i)".
-- Corpus DECISION_LOG row "A CATEGORY'S ⓘ IS WRITTEN IN ADMIN" (2026-10-31).
--
-- BEFORE. The Suppliers page drew a category's ⓘ only when a HARD-CODED map knew the category
-- (`TILE_HINTS` in apps/web/lib/category-hints.ts, or the `hint` of a plan group in
-- apps/web/lib/wedding-plan-groups.ts), and a group's ⓘ only from `FOLDER_HINTS`. A category the owner adds
-- in Admin › Categories is in none of them, so its ⓘ was hidden — a second, code-side copy of the taxonomy,
-- against the standing rule "Group › Category › Service › Part lives ONLY in Admin › Categories" (2026-10-26).
--
-- AFTER. One nullable column on the category's own row:
--   · `service_categories.hint_en` — the ⓘ text, English, written on Admin › Categories › a group or a
--     category › Name › "ⓘ text" (saves in place). NULL / blank = not written yet.
--   · The app answers every ⓘ in this order (apps/web/lib/category-hints.ts `categoryInfoText` /
--     `folderInfoText`): this column → the old hard-coded line (kept only as the fallback for the categories that
--     had one) → a line built from Admin's own data ("Shoes covers: <its services>"). No ⓘ is ever hidden.
--   · Nothing is backfilled: the hard-coded lines keep answering until the owner writes his own.
--
-- RLS / GRANTS: unchanged. `service_categories` keeps its policies (public read `service_categories_read_all`,
-- admin-only write `service_categories_admin_write`); a new column carries them. The admin page writes through
-- the service role, behind its own admin check, like every other column of this row.

ALTER TABLE public.service_categories
  ADD COLUMN IF NOT EXISTS hint_en TEXT;

-- Short on purpose: an ⓘ is one or two lines in a popup, never a page.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'service_categories_hint_en_length'
       AND conrelid = 'public.service_categories'::regclass
  ) THEN
    ALTER TABLE public.service_categories
      ADD CONSTRAINT service_categories_hint_en_length
      CHECK (hint_en IS NULL OR char_length(hint_en) <= 280);
  END IF;
END $$;

COMMENT ON COLUMN public.service_categories.hint_en IS
  'The ⓘ text of a group (tier 1) or a category (tier 2), English, written on Admin › Categories › Name › ⓘ text (owner 2026-10-31: "add a place for me to write an (i)"). NULL = not written; the app then falls back to the old hard-coded line, else a line built from the category''s services. Read by lib/taxonomy-db.ts getTaxonomy() into TaxonomySnapshot.categoryHints.';

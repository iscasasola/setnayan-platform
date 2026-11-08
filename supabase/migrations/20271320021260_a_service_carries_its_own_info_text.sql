-- a_service_carries_its_own_info_text
-- Created via `pnpm migration:new`. Idempotent — safe to re-apply.
--
-- THE ⓘ OF A SERVICE IS WRITTEN IN ADMIN › CATEGORIES (plan Track D, item D4).
-- Corpus DECISION_LOG row 2026-11-06 "EVERY CATEGORY AND SERVICE IN THE SIGN-UP PICKER GETS AN ⓘ WITH A
-- ONE-LINE DEFINITION". Owner: "add (i) for each so we can define the categories and service so they know
-- where they should locate themselves." The row: "Services have NO field … one nullable text column, plus
-- the same 'ⓘ text' field on the service row in Admin › Categories. Reuse the category pattern; don't add a
-- parallel one."
--
-- BEFORE. A category's ⓘ reads `service_categories.hint_en` (migration 20271299134245). A service had no
-- place for one: neither `canonical_service_taxonomy` nor `canonical_service_schemas` carried a description.
--
-- AFTER. One nullable column on the service's NAME row — the row that already holds its English and
-- Tagalog names, the way `service_categories.hint_en` sits beside `label_en`:
--   · `canonical_service_schemas.hint_en` — the one-line definition, English, written on Admin › Categories
--     › a service › Name › "ⓘ text" (saves in place). NULL = not written.
--   · NULL means NO ⓘ. Unlike a category, a service has no fallback line: an unwritten definition draws
--     nothing, never a placeholder. Nothing is backfilled — every row starts empty until the owner writes it
--     (a model-drafted set exists in the corpus, `taxonomy-definitions-DRAFT.json`, and is NOT applied here).
--   · Read by apps/web/lib/service-definitions.server.ts `getServiceDefinitions()` / `serviceDefinition(key)`.
--
-- WHY THIS TABLE AND NOT canonical_service_taxonomy: the taxonomy row is the service's PLACEMENT (folder,
-- tile, flags, merged_into) and is what a merge re-tiles; the schema row is its WORDS (display names). A
-- definition is words. It is also the table PR #7355 (taxonomy v2) only INSERTs into / UPDATEs by named
-- columns — an added nullable column changes nothing it does.
--
-- RLS / GRANTS: unchanged. `canonical_service_schemas` keeps its policies (public read
-- `canonical_service_schemas_read_all`, admin-only write `canonical_service_schemas_admin_write`); a new
-- column carries them and the table-level grants, like `display_name_tl`. The admin page writes through the
-- service role, behind its own admin check, like every other column of this row.

ALTER TABLE public.canonical_service_schemas
  ADD COLUMN IF NOT EXISTS hint_en TEXT;

-- One line. The ruling counts words ("≤16 words each"), not characters; 120 characters is the cap the D4
-- build brief sets when the ruling names none. Raising it later is one constraint swap.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'canonical_service_schemas_hint_en_length'
       AND conrelid = 'public.canonical_service_schemas'::regclass
  ) THEN
    ALTER TABLE public.canonical_service_schemas
      ADD CONSTRAINT canonical_service_schemas_hint_en_length
      CHECK (hint_en IS NULL OR char_length(hint_en) <= 120);
  END IF;
END $$;

COMMENT ON COLUMN public.canonical_service_schemas.hint_en IS
  'The one-line ⓘ definition of a service, English, written on Admin › Categories › a service › Name › ⓘ text (DECISION_LOG 2026-11-06: "add (i) for each so we can define the categories and service"). NULL = not written = no ⓘ (no fallback line). At most 120 characters. Read by lib/service-definitions.server.ts.';

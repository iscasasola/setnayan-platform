-- Taxonomy Studio · PR 1 of 3 — representation layer (icons).
--
-- Adds an admin-editable Lucide icon name to every taxonomy node
-- (service_categories: the 10 tier-1 folders + 56 tier-2 tiles). The couple-
-- facing tile/folder grids currently hardcode their icons in TS; this column
-- lets an admin override that per-node from the Taxonomy Studio (PR 2) with no
-- deploy, read live by getTaxonomy(). NULL (every row today) = fall back to the
-- code default, so this migration is a no-op for couples until an admin sets an
-- icon. The companion `sample_photo_r2_key` column already exists (migration
-- 20260803001000); no photo column is added here.

ALTER TABLE public.service_categories
  ADD COLUMN IF NOT EXISTS icon_name text;

COMMENT ON COLUMN public.service_categories.icon_name IS
  'Admin-set Lucide icon name for this taxonomy node''s couple-facing tile/folder '
  'icon. Validated in app code against the curated Lucide allowlist (lib/nav-icons.ts, '
  'the same source of truth the nav registry / /admin/menus icon picker uses). '
  'NULL = fall back to the hardcoded code default.';

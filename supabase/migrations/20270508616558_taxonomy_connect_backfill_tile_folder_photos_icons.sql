-- Taxonomy Studio · PR 4 — CONNECT the representation layer.
--
-- The icon_name + sample_photo_r2_key columns exist on service_categories
-- (icons: 20270506707877 · photos: 20260803001000) but are empty on every one
-- of the 10 tier-1 folders + 56 tier-2 tiles, so the couple-facing grids all
-- fall back to their hardcoded code defaults. This migration SEEDS those empty
-- values from the exact same code defaults the app already renders — a VISUAL
-- NO-OP that just moves the source of truth into the DB so an admin never has
-- to hand-fill 66 rows in the Studio.
--
-- DATA-ONLY. Idempotent. Every UPDATE is guarded `WHERE … IS NULL OR = ''`, so
-- re-running never overwrites a manual admin edit (or a value another statement
-- in this file just set), and it races safely against a live Studio edit.
--
-- Three fills:
--   1. Tile photos  — each tier-2 tile inherits its anchored active refinement
--      leaf's main_photo (lowest sort_order with a non-empty photo). Pure
--      relational — no literals for the 45 tiles that have an anchor.
--   2. Folder photos — each tier-1 folder inherits its first child tile's
--      (by tile sort_order) now-set photo.
--   3. Icons        — the 10 folder icon_names seeded from the code-default
--      FOLDER_ICON map (icon-tile-folder-strip.tsx). Every name is on the
--      Lucide allowlist (lib/nav-icons.ts → getLucideIcon), so the seeded glyph
--      is byte-identical to what couples see today. Tiles have NO independent
--      code-default icon map — their fallback IS the parent folder's icon — so
--      tile icon_name is intentionally left NULL and keeps inheriting the folder
--      icon via the existing app fallback (also a visual no-op).
--   + 11 gap tiles (no anchored refinement photo) get a repo-committed editorial
--      photo under /public/taxonomy/tiles/<tile_id>.webp.

BEGIN;

-- ── 1. Tile photos from the anchored refinement leaf ────────────────────────
-- DISTINCT ON picks the lowest-sort_order active leaf that has a non-empty
-- main_photo, per tile. Relational; the /public paths + r2:// refs both stay
-- verbatim (VALID_PHOTO-legal, resolved by displayUrlForStoredAsset at render).
WITH tile_anchor AS (
  SELECT DISTINCT ON (r.tile_id)
    r.tile_id,
    r.main_photo
  FROM public.onboarding_refinements r
  WHERE r.tile_id IS NOT NULL
    AND r.status = 'active'
    AND r.main_photo IS NOT NULL
    AND r.main_photo <> ''
  ORDER BY r.tile_id, r.sort_order ASC
)
UPDATE public.service_categories sc
SET sample_photo_r2_key = a.main_photo
FROM tile_anchor a
WHERE sc.id = a.tile_id
  AND sc.tier = 2
  AND (sc.sample_photo_r2_key IS NULL OR sc.sample_photo_r2_key = '');

-- ── 1b. Gap-tile photos — the 11 tier-2 tiles with no anchored refinement ────
-- photo get a repo-committed editorial WebP shipped in this PR under
-- /public/taxonomy/tiles/. /public paths are legacy_url refs — used verbatim by
-- the renderer, no presign. Guarded empty-only so this never clobbers a later
-- admin upload or the anchor fill above.
UPDATE public.service_categories sc
SET sample_photo_r2_key = '/taxonomy/tiles/' || sc.id || '.webp'
WHERE sc.tier = 2
  AND sc.id IN (
    'lights_sound', 'dance_floor', 'fireworks', 'led_wall', 'digital_services',
    'editorial', 'wellness_fitness', 'date_specialist', 'trophies_awards',
    'orchestra', 'host_mc'
  )
  AND (sc.sample_photo_r2_key IS NULL OR sc.sample_photo_r2_key = '');

-- ── 2. Folder photos inherit the first child tile's now-set photo ───────────
-- "First" = lowest tile sort_order among the folder's children that have a
-- (now-filled) photo. Runs after fills 1 + 1b so every tile is populated.
WITH folder_photo AS (
  SELECT DISTINCT ON (child.parent_id)
    child.parent_id AS folder_id,
    child.sample_photo_r2_key
  FROM public.service_categories child
  WHERE child.tier = 2
    AND child.parent_id IS NOT NULL
    AND child.sample_photo_r2_key IS NOT NULL
    AND child.sample_photo_r2_key <> ''
  ORDER BY child.parent_id, child.sort_order ASC
)
UPDATE public.service_categories sc
SET sample_photo_r2_key = f.sample_photo_r2_key
FROM folder_photo f
WHERE sc.id = f.folder_id
  AND sc.tier = 1
  AND (sc.sample_photo_r2_key IS NULL OR sc.sample_photo_r2_key = '');

-- ── 3. Folder icons from the code-default FOLDER_ICON map ────────────────────
-- Names verified against the Lucide allowlist (lib/nav-icons.ts): a visual
-- no-op — each seeded name renders the exact glyph the strip already shows.
UPDATE public.service_categories sc
SET icon_name = seed.icon_name
FROM (VALUES
  ('venue',       'Building2'),
  ('planning',    'ClipboardList'),
  ('feast',       'UtensilsCrossed'),
  ('design',      'Flower2'),
  ('program',     'Music'),
  ('documentary', 'Camera'),
  ('look',        'Shirt'),
  ('booths',      'Tent'),
  ('prints',      'Mail'),
  ('transport',   'Car')
) AS seed(folder_id, icon_name)
WHERE sc.id = seed.folder_id
  AND sc.tier = 1
  AND (sc.icon_name IS NULL OR sc.icon_name = '');

COMMIT;

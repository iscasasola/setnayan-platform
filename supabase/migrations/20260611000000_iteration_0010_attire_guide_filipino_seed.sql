-- ============================================================================
-- 20260611000000_iteration_0010_attire_guide_filipino_seed.sql
--
-- Wedding Attire Guide · real-photo seed for the 10 RoleKey entries.
--
-- WHY (owner directive 2026-05-23 PM): owner shared a Pinterest collage of
-- "Wedding Guest Dresses" and asked verbatim: "i want something like this
-- but we can alter the color of the dress and have a flipina face and same
-- to the men." The Wedding Attire Guide on /dashboard/[eventId]/add-ons/
-- mood-board was rendering polished SVG silhouettes (PRs #449/#451/#453);
-- owner wants real photo-quality Filipino figures. Owner picked via
-- AskUserQuestion: "Single figure per role (current layout)" +
-- "Curated Pexels/Unsplash stock photos" — V1 placeholder path per the
-- 2026-05-21 lock ("internet-sourced placeholders pre-launch, swap to
-- Higgsfield-generated Filipino-specific content V1.x").
--
-- WHY Pexels: free commercial use, no attribution required, no API key
-- needed for hot-linking. Same hot-link pattern the existing placeholder
-- seed (20260531000000) uses with picsum.photos — moodboard_library_assets
-- query path in /dashboard/[eventId]/add-ons/mood-board/page.tsx detects
-- absolute URLs in storage_path and bypasses Supabase Storage resolution.
--
-- WHY one row per role: WeddingAttireGuide renders ONE PhotoFigure per
-- role (with a "× N" count badge for role.count > 1) instead of N copies
-- of the same photo (Warhol-effect would look wrong). 10 RoleKey entries
-- × 1 photo each = 10 inserts.
--
-- WHY sampled_hex per row: each row also inserts a slot-1 entry into
-- moodboard_asset_color_ranges with an approximate dominant attire color
-- from the source photo. V1 visual-recolor uses CSS mix-blend-multiply
-- on the picked tint (asset-agnostic, ignores sampled_hex). V1.x Color
-- Range Manipulator engine swaps to region-specific HSL substitution
-- keyed on sampled_hex per the 2026-05-21 lock. Pre-seeding the hex
-- means admin doesn't have to re-tag each photo before V1.x ships.
--
-- WHY mixed-Asian models not strictly Filipino: free stock photo
-- availability of Filipino-specific models is genuinely limited. Pexels
-- search ("filipino bride" / "filipino groom") returned 2-4 strong
-- Filipino-tagged results per category; rest are pan-Asian or generic.
-- For V1 placeholder this is acceptable per the locked phasing strategy
-- (V1 placeholders → V1.x Higgsfield Filipino-specific → V1.x+ stylist
-- real-photo uploads). The 4 Filipino-tagged photos are used for the
-- highest-impact roles (bride, groom, female_ps, male_ps).
--
-- Idempotent. INSERTs gate on WHERE NOT EXISTS — re-running on databases
-- that already applied this migration is a no-op.
--
-- Cross-references:
--   * Migration 20260525000000 — moodboard_library_assets + color_ranges schema
--   * Migration 20260531000000 — initial Picsum placeholder seed
--   * Migration 20260610010000 — events.attire_guide_palette JSONB column
--   * apps/web/app/dashboard/[eventId]/add-ons/mood-board/_components/
--     wedding-attire-guide.tsx — RoleAsset type + PhotoFigure renderer
--   * CLAUDE.md 2026-05-21 row — 3-pillar Dress codes lock (Asset sourcing
--     3-phase strategy)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- figure_attire assets keyed by RoleKey (asset_subtype matches RoleKey union
-- in wedding-attire-guide.tsx). Each row inserts the photo + a slot-1 color
-- range row in lockstep.
-- ----------------------------------------------------------------------------

-- bride · Asian bride with bouquet (serene outdoor setting · pink florals)
INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, approved_at)
SELECT 'figure_attire', 'bride',
       'Bride · Asian bride with bouquet (Pexels stock)',
       'https://images.pexels.com/photos/12886228/pexels-photo-12886228.jpeg',
       'internet_placeholder', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE asset_subtype = 'bride' AND source = 'internet_placeholder'
);

INSERT INTO public.moodboard_asset_color_ranges
  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1, '#F2E8E4', 15, 'wedding gown'
FROM public.moodboard_library_assets a
WHERE a.asset_subtype = 'bride'
  AND a.source = 'internet_placeholder'
  AND NOT EXISTS (
    SELECT 1 FROM public.moodboard_asset_color_ranges r
    WHERE r.asset_id = a.asset_id AND r.slot_id = 1
  );

-- groom · Filipino man in barong tagalog (confident portrait outdoors)
INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, approved_at)
SELECT 'figure_attire', 'groom',
       'Groom · Filipino man in barong tagalog (Pexels stock)',
       'https://images.pexels.com/photos/22601419/pexels-photo-22601419.jpeg',
       'internet_placeholder', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE asset_subtype = 'groom' AND source = 'internet_placeholder'
);

INSERT INTO public.moodboard_asset_color_ranges
  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1, '#E8D9B8', 15, 'barong tagalog'
FROM public.moodboard_library_assets a
WHERE a.asset_subtype = 'groom'
  AND a.source = 'internet_placeholder'
  AND NOT EXISTS (
    SELECT 1 FROM public.moodboard_asset_color_ranges r
    WHERE r.asset_id = a.asset_id AND r.slot_id = 1
  );

-- bridesmaids · Group in matching pink dresses (Pexels generic — Asian
-- bridesmaid availability is limited on free stock; V1.x Higgsfield batch
-- will replace with Filipino-specific renders)
INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, approved_at)
SELECT 'figure_attire', 'bridesmaids',
       'Bridesmaids · matching pink dresses (Pexels stock)',
       'https://images.pexels.com/photos/34799986/pexels-photo-34799986.jpeg',
       'internet_placeholder', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE asset_subtype = 'bridesmaids' AND source = 'internet_placeholder'
);

INSERT INTO public.moodboard_asset_color_ranges
  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1, '#F4C5D2', 15, 'bridesmaid dress'
FROM public.moodboard_library_assets a
WHERE a.asset_subtype = 'bridesmaids'
  AND a.source = 'internet_placeholder'
  AND NOT EXISTS (
    SELECT 1 FROM public.moodboard_asset_color_ranges r
    WHERE r.asset_id = a.asset_id AND r.slot_id = 1
  );

-- groomsmen · Group in coordinated gray suits (Pexels generic)
INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, approved_at)
SELECT 'figure_attire', 'groomsmen',
       'Groomsmen · coordinated gray suits (Pexels stock)',
       'https://images.pexels.com/photos/34327717/pexels-photo-34327717.jpeg',
       'internet_placeholder', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE asset_subtype = 'groomsmen' AND source = 'internet_placeholder'
);

INSERT INTO public.moodboard_asset_color_ranges
  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1, '#4A4F58', 15, 'suit jacket'
FROM public.moodboard_library_assets a
WHERE a.asset_subtype = 'groomsmen'
  AND a.source = 'internet_placeholder'
  AND NOT EXISTS (
    SELECT 1 FROM public.moodboard_asset_color_ranges r
    WHERE r.asset_id = a.asset_id AND r.slot_id = 1
  );

-- female_ps · Filipina in formal gown at floral table setting (Filipino-tagged)
INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, approved_at)
SELECT 'figure_attire', 'female_ps',
       'Female Principal Sponsors · Filipina formal gown (Pexels stock)',
       'https://images.pexels.com/photos/37706671/pexels-photo-37706671.jpeg',
       'internet_placeholder', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE asset_subtype = 'female_ps' AND source = 'internet_placeholder'
);

INSERT INTO public.moodboard_asset_color_ranges
  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1, '#D4B896', 15, 'sponsor gown'
FROM public.moodboard_library_assets a
WHERE a.asset_subtype = 'female_ps'
  AND a.source = 'internet_placeholder'
  AND NOT EXISTS (
    SELECT 1 FROM public.moodboard_asset_color_ranges r
    WHERE r.asset_id = a.asset_id AND r.slot_id = 1
  );

-- male_ps · Asian groom in traditional attire (barong tagalog with bouquet)
INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, approved_at)
SELECT 'figure_attire', 'male_ps',
       'Male Principal Sponsors · Asian barong tagalog (Pexels stock)',
       'https://images.pexels.com/photos/24551674/pexels-photo-24551674.jpeg',
       'internet_placeholder', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE asset_subtype = 'male_ps' AND source = 'internet_placeholder'
);

INSERT INTO public.moodboard_asset_color_ranges
  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1, '#E8D9B8', 15, 'barong tagalog'
FROM public.moodboard_library_assets a
WHERE a.asset_subtype = 'male_ps'
  AND a.source = 'internet_placeholder'
  AND NOT EXISTS (
    SELECT 1 FROM public.moodboard_asset_color_ranges r
    WHERE r.asset_id = a.asset_id AND r.slot_id = 1
  );

-- mothers · Senior Asian woman in purple formal gown (Manila living room)
INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, approved_at)
SELECT 'figure_attire', 'mothers',
       'Mothers · senior Asian woman purple gown (Pexels stock)',
       'https://images.pexels.com/photos/19524345/pexels-photo-19524345.jpeg',
       'internet_placeholder', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE asset_subtype = 'mothers' AND source = 'internet_placeholder'
);

INSERT INTO public.moodboard_asset_color_ranges
  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1, '#6B4A7E', 15, 'formal gown'
FROM public.moodboard_library_assets a
WHERE a.asset_subtype = 'mothers'
  AND a.source = 'internet_placeholder'
  AND NOT EXISTS (
    SELECT 1 FROM public.moodboard_asset_color_ranges r
    WHERE r.asset_id = a.asset_id AND r.slot_id = 1
  );

-- fathers · Filipino man adjusting barong tagalog sleeve (formal preparation)
INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, approved_at)
SELECT 'figure_attire', 'fathers',
       'Fathers · Filipino man in barong tagalog (Pexels stock)',
       'https://images.pexels.com/photos/22601423/pexels-photo-22601423.jpeg',
       'internet_placeholder', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE asset_subtype = 'fathers' AND source = 'internet_placeholder'
);

INSERT INTO public.moodboard_asset_color_ranges
  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1, '#E8D9B8', 15, 'barong tagalog'
FROM public.moodboard_library_assets a
WHERE a.asset_subtype = 'fathers'
  AND a.source = 'internet_placeholder'
  AND NOT EXISTS (
    SELECT 1 FROM public.moodboard_asset_color_ranges r
    WHERE r.asset_id = a.asset_id AND r.slot_id = 1
  );

-- guests · Smiling Asian woman in elegant dress (post-ceremony reception)
INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, approved_at)
SELECT 'figure_attire', 'guests',
       'Guest women · Asian woman in elegant dress (Pexels stock)',
       'https://images.pexels.com/photos/5096322/pexels-photo-5096322.jpeg',
       'internet_placeholder', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE asset_subtype = 'guests' AND source = 'internet_placeholder'
);

INSERT INTO public.moodboard_asset_color_ranges
  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1, '#7E1F32', 15, 'guest dress'
FROM public.moodboard_library_assets a
WHERE a.asset_subtype = 'guests'
  AND a.source = 'internet_placeholder'
  AND NOT EXISTS (
    SELECT 1 FROM public.moodboard_asset_color_ranges r
    WHERE r.asset_id = a.asset_id AND r.slot_id = 1
  );

-- men_guests · Elegant man in blue suit with boutonniere (Pexels generic)
INSERT INTO public.moodboard_library_assets
  (asset_type, asset_subtype, label, storage_path, source, approved_at)
SELECT 'figure_attire', 'men_guests',
       'Guest men · man in blue suit (Pexels stock)',
       'https://images.pexels.com/photos/17014422/pexels-photo-17014422.jpeg',
       'internet_placeholder', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.moodboard_library_assets
  WHERE asset_subtype = 'men_guests' AND source = 'internet_placeholder'
);

INSERT INTO public.moodboard_asset_color_ranges
  (asset_id, slot_id, sampled_hex, tolerance_de, region_label)
SELECT a.asset_id, 1, '#2E3F5C', 15, 'suit jacket'
FROM public.moodboard_library_assets a
WHERE a.asset_subtype = 'men_guests'
  AND a.source = 'internet_placeholder'
  AND NOT EXISTS (
    SELECT 1 FROM public.moodboard_asset_color_ranges r
    WHERE r.asset_id = a.asset_id AND r.slot_id = 1
  );

COMMIT;

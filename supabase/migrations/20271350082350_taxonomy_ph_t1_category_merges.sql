-- T1 PART 2 · THE CATEGORY MERGES of the owner-approved Philippine taxonomy (owner, 16 Nov 2026: "make the
-- taxonomy go live now"; spec TAXONOMY_PH_FULL_2026-11-07.md, "the ONE spec for build T1"). Stacked on part 1
-- (20271349668764), which renamed, added, folded and hid SERVICES; this file folds whole CATEGORIES:
--
--   Men's Attire                               → Entourage & Sponsors   (womens_attire)
--   Wedding Singer                             → Live Band & Singers    (live_band)
--   Mocktail                                   → Mobile Bar             (mobile_bar)
--   Dessert · Food Truck                       → Food Carts             (food_cart)
--   Mini Nail Bar · Perfume Bar · Henna        → Pampering              (massage_chair)
--   Outdoor · Fireworks · Dance Floor          → Rentals & Special Effects (chairs_tents)
--   Transfers & Rentals                        → Van / Coaster Rental   (guest_shuttle)
--   AV / Production                            → Speakers & AV          (speaker_talent)
--
-- What Admin › Categories' "delete with a destination" (`deleteTileWithDestination`) does, except that NOTHING
-- is deleted: every holder of the old category id moves to the destination, the destination takes the old one's
-- event reach (so no host loses a category and no supplier loses an event), and the emptied category stays as a
-- HIDDEN row carrying `merged_into_category_id` — so an old id still names where it went.
-- Holders, measured in prod by column (every FK to service_categories + every text column named like a tile or
-- category; only these hold a source id): canonical_service_taxonomy.tile_id/secondary_tiles · event_vendors.category_key
-- · inspiration_parts.home_category_id · inspiration_part_categories (rewritten from its derivation) ·
-- onboarding_refinements.tile_id · vendor_service_recommendations.tile_id. Shops' own `services` hold service keys,
-- which do not change here. Data only. Idempotent: every write is guarded, so a re-run changes nothing.
BEGIN;

CREATE TEMP TABLE t1_category_merges (src TEXT PRIMARY KEY, dest TEXT NOT NULL) ;
INSERT INTO t1_category_merges (src, dest) VALUES
  ('mens_attire', 'womens_attire'),
  ('wedding_singer', 'live_band'),
  ('mocktail', 'mobile_bar'),
  ('dessert', 'food_cart'),
  ('food_truck', 'food_cart'),
  ('mini_nail_bar', 'massage_chair'),
  ('perfume_bar', 'massage_chair'),
  ('henna_tattoo', 'massage_chair'),
  ('outdoor', 'chairs_tents'),
  ('fireworks', 'chairs_tents'),
  ('dance_floor', 'chairs_tents'),
  ('transfers_rentals', 'guest_shuttle'),
  ('av_production', 'speaker_talent');
-- A replay or a later admin edit may have removed a row; merge only pairs where both categories exist.
DELETE FROM t1_category_merges m
 WHERE NOT EXISTS (SELECT 1 FROM public.service_categories WHERE id = m.src AND tier = 2)
    OR NOT EXISTS (SELECT 1 FROM public.service_categories WHERE id = m.dest AND tier = 2);

-- 0 · Inspiration parts: which categories each part links WHOLE, before anything moves (as part 1 step 0).
CREATE TEMP TABLE t1m_part_whole_categories AS
SELECT p.slot_key, pr.category_id
  FROM public.inspiration_parts p
  JOIN (SELECT category_id, array_agg(canonical_service) AS svcs
          FROM public.inspiration_category_service_pairs() GROUP BY category_id) pr ON TRUE
 WHERE p.kind = 'part'
   AND NOT EXISTS (SELECT 1 FROM unnest(pr.svcs) AS u(s)
                    WHERE NOT EXISTS (SELECT 1 FROM public.inspiration_part_services l
                                       WHERE l.slot_key = p.slot_key AND l.canonical_service = u.s));

-- 1 · The destination keeps every event the merged category reached (NULL = every event, and stays so).
UPDATE public.service_categories d
   SET applicable_event_types = CASE
         WHEN d.applicable_event_types IS NULL OR s.types IS NULL THEN NULL
         ELSE (SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(d.applicable_event_types || s.types) AS u(x))
       END,
       updated_at = now()
  FROM (SELECT m.dest,
               CASE WHEN bool_or(c.applicable_event_types IS NULL) THEN NULL
                    ELSE array_agg(DISTINCT x) END AS types
          FROM t1_category_merges m
          JOIN public.service_categories c ON c.id = m.src
          LEFT JOIN LATERAL unnest(c.applicable_event_types) AS u(x) ON TRUE
         GROUP BY m.dest) s
 WHERE d.id = s.dest
   AND d.applicable_event_types IS NOT NULL
   AND (s.types IS NULL OR NOT (d.applicable_event_types @> s.types));

-- 2 · Services move category (what deleteTileWithDestination does): tile, its group, and any cross-listing.
UPDATE public.canonical_service_taxonomy t
   SET tile_id = m.dest, folder_id = c.parent_id, updated_at = now()
  FROM t1_category_merges m JOIN public.service_categories c ON c.id = m.dest
 WHERE t.tile_id = m.src;
UPDATE public.canonical_service_taxonomy t
   SET secondary_tiles = (SELECT COALESCE(array_agg(DISTINCT y ORDER BY y) FILTER (WHERE y IS DISTINCT FROM t.tile_id), ARRAY[]::TEXT[])
                            FROM unnest(t.secondary_tiles) AS u(x)
                            LEFT JOIN t1_category_merges m ON m.src = u.x
                            CROSS JOIN LATERAL (SELECT COALESCE(m.dest, u.x) AS y) z),
       updated_at = now()
 WHERE t.secondary_tiles && (SELECT array_agg(src) FROM t1_category_merges);

-- 3 · A couple's booked or saved supplier filed under the old category is filed under the new one.
UPDATE public.event_vendors e SET category_key = m.dest
  FROM t1_category_merges m WHERE e.category_key = m.src;

-- 4 · "What couples choose" cards and the supplier recommendations follow their category.
UPDATE public.onboarding_refinements o SET tile_id = m.dest
  FROM t1_category_merges m WHERE o.tile_id = m.src;
DELETE FROM public.vendor_service_recommendations r
 USING t1_category_merges m
 WHERE r.tile_id = m.src
   AND EXISTS (SELECT 1 FROM public.vendor_service_recommendations x WHERE x.tile_id = m.dest AND x.service_code = r.service_code);
UPDATE public.vendor_service_recommendations r SET tile_id = m.dest
  FROM t1_category_merges m WHERE r.tile_id = m.src;

-- 5 · Inspiration parts. A part whose home was a merged category is now at home in the destination.
UPDATE public.inspiration_parts p SET home_category_id = m.dest
  FROM t1_category_merges m WHERE p.home_category_id = m.src;
--     A category a part linked whole is linked whole again: the merged category's whole has moved into the
--     destination, so the part takes the destination's services too (Pampering, Food Carts, …) — the shops that
--     may add a photo stay the category expansion (part-eligibility-is-unchanged-by-the-move.db.test.ts).
INSERT INTO public.inspiration_part_services (slot_key, canonical_service, sort_order)
SELECT w.slot_key, pr.canonical_service,
       COALESCE(
         (SELECT max(x.sort_order) FROM public.inspiration_part_services x
            JOIN public.inspiration_category_service_pairs() p2 ON p2.canonical_service = x.canonical_service AND p2.category_id = COALESCE(m.dest, w.category_id)
           WHERE x.slot_key = w.slot_key),
         (SELECT COALESCE(max(x.sort_order), 0) FROM public.inspiration_part_services x WHERE x.slot_key = w.slot_key)
           + row_number() OVER (PARTITION BY w.slot_key ORDER BY pr.category_id, pr.canonical_service))
  FROM t1m_part_whole_categories w
  LEFT JOIN t1_category_merges m ON m.src = w.category_id
  JOIN public.inspiration_category_service_pairs() pr ON pr.category_id = COALESCE(m.dest, w.category_id)
 WHERE NOT EXISTS (SELECT 1 FROM public.inspiration_part_services l WHERE l.slot_key = w.slot_key AND l.canonical_service = pr.canonical_service)
ON CONFLICT DO NOTHING;
--     The stored copy of every part's categories is its derivation again (the ③a double write; the triggers only
--     fire on a link or home change, and a service changing category is neither).
DELETE FROM public.inspiration_part_categories c
 WHERE NOT EXISTS (SELECT 1 FROM public.inspiration_part_categories_derived d WHERE d.slot_key = c.slot_key AND d.category_id = c.category_id);
INSERT INTO public.inspiration_part_categories (slot_key, category_id, sort_order)
SELECT d.slot_key, d.category_id, d.sort_order FROM public.inspiration_part_categories_derived d
ON CONFLICT (slot_key, category_id) DO UPDATE SET sort_order = EXCLUDED.sort_order
 WHERE public.inspiration_part_categories.sort_order IS DISTINCT FROM EXCLUDED.sort_order;

-- 6 · Names of the merged destinations (the spec's category names).
UPDATE public.service_categories SET label_en = 'Entourage & Sponsors', updated_at = now() WHERE id = 'womens_attire' AND label_en IS DISTINCT FROM 'Entourage & Sponsors';
UPDATE public.service_categories SET label_en = 'Live Band & Singers', updated_at = now() WHERE id = 'live_band' AND label_en IS DISTINCT FROM 'Live Band & Singers';
UPDATE public.service_categories SET label_en = 'Speakers & AV', updated_at = now() WHERE id = 'speaker_talent' AND label_en IS DISTINCT FROM 'Speakers & AV';

-- 7 · The emptied categories stay, HIDDEN, pointing at where they went. Never deleted.
UPDATE public.service_categories c
   SET marketplace_hidden = TRUE, merged_into_category_id = m.dest, updated_at = now()
  FROM t1_category_merges m
 WHERE c.id = m.src AND (c.marketplace_hidden IS DISTINCT FROM TRUE OR c.merged_into_category_id IS DISTINCT FROM m.dest);

-- 8 · Refuse to commit a half merge.
DO $guard$
DECLARE v_bad text;
BEGIN
  SELECT string_agg(DISTINCT t.tile_id, ', ') INTO v_bad FROM public.canonical_service_taxonomy t JOIN t1_category_merges m ON m.src = t.tile_id;
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'T1 merges: services still filed under %', v_bad; END IF;
  SELECT string_agg(DISTINCT e.category_key, ', ') INTO v_bad FROM public.event_vendors e JOIN t1_category_merges m ON m.src = e.category_key;
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'T1 merges: couples'' suppliers still filed under %', v_bad; END IF;
  SELECT string_agg(DISTINCT p.home_category_id, ', ') INTO v_bad FROM public.inspiration_parts p JOIN t1_category_merges m ON m.src = p.home_category_id;
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'T1 merges: inspiration parts still at home in %', v_bad; END IF;
  SELECT string_agg(m.src, ', ') INTO v_bad FROM t1_category_merges m JOIN public.service_categories c ON c.id = m.src
   WHERE c.marketplace_hidden IS DISTINCT FROM TRUE OR c.merged_into_category_id IS DISTINCT FROM m.dest;
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'T1 merges: not hidden / not forwarded: %', v_bad; END IF;
  SELECT string_agg(m.dest, ', ') INTO v_bad FROM t1_category_merges m JOIN public.service_categories c ON c.id = m.dest
   WHERE c.marketplace_hidden IS TRUE OR c.status IS DISTINCT FROM 'active';
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'T1 merges: a destination is not live: %', v_bad; END IF;
END $guard$;

DROP TABLE t1m_part_whole_categories;
DROP TABLE t1_category_merges;
COMMIT;

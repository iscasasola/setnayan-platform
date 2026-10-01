-- ============================================================================
-- 20271257951866_find_a_supplier_reads_the_event_type.sql
--
-- Find a supplier shows ONLY the categories this event's type is scoped to
-- (DECISION_LOG 2026-10-01 "SUPPLIER INBOX + FIND-A-SUPPLIER DESIGN — APPROVED,
-- WITH BOTH RECOMMENDATIONS"). Two data changes, both additive:
--
--   1. a per-type starter pass for the birthday list the owner named;
--   2. a new tier-2 leaf "Chairs & tents" (chairs · tents · lights) for wakes
--      and home birthdays / get-togethers, pickable by suppliers.
--
-- ─── WHAT WAS COUNTED FIRST (the replayed schema, 2026-10-01) ───────────────
-- The decision row says "253 unscoped services". Measured on a full replay:
--
--   service_categories tier 2 (the CATEGORIES a host browses)  79 rows,
--                                                              77 scoped
--   canonical_service_taxonomy (the SERVICES under them)      288 rows,
--                                                             253 NULL
--
-- 🔑 SO THE 253 ARE SERVICES, NOT CATEGORIES, AND NULL THERE MEANS "INHERIT".
-- A service's NULL list resolves to its tile's list (`getCoverageTaxonomy`:
-- leaf override, else tile, else universal — and `tile-event-type-fillable.
-- db.test.ts` pins exactly that). They are not "shown to everything"; a
-- `wedding_cake` service already reaches only what the Cake tile reaches.
--
-- ⚖ WHY THEY ARE NOT SEEDED HERE. Admin › Event type › Scope categories — the
-- screen the owner reviews these lists on — writes the TILE column only. A list
-- copied onto 253 service rows would OVERRIDE the tile forever, so every later
-- owner edit in that screen would silently stop reaching suppliers (the leaf
-- wins), and a tile the owner widens would become unfillable for the new type.
-- The review the owner asked for only works while the services inherit.
--
-- The two NULL tiles are deliberate and stay NULL: `livestream` (hidden; a
-- NULL that every type reaches — see 20271174521331, which warns against
-- "adding wake" to it) and `everything_else` (hidden; the self-added fallback
-- every type must keep — see 20271240202428).
--
-- ─── 1 · THE BIRTHDAY STARTER LIST ──────────────────────────────────────────
-- Owner's list: cake · photo booth · kids' entertainer · dessert · food cart ·
-- LED wall · performers · souvenirs. Seven of the eight already include
-- `birthday`; LED Wall did not. It is appended, never replaced — a type is only
-- ever ADDED to an allow-list here, so nothing anyone sees today disappears and
-- the wedding's list is byte-identical (asserted at the bottom).
--
-- ─── 2 · "CHAIRS & TENTS" ──────────────────────────────────────────────────
-- A new tier-2 leaf under `design` ("Styling, flowers & lights") — the folder
-- that already holds Outdoor and Lights & Sound, so a supplier who rents chairs
-- finds it beside the trades they already list. Three services so the shelf is
-- never empty (a tile with no service is unfindable — the vendor picker prunes
-- it). Scoped to wake · birthday · simple_event: the home wake and the backyard
-- birthday are where a family rents a tent and monobloc chairs by the dozen.
--
-- ⚠ OVERLAP, FLAGGED FOR THE OWNER: Outdoor already carries `tent_rental` and
-- `outdoor_lighting_specialist` for weddings. They are left where they are —
-- moving a service between tiles re-files every supplier who lists it — and the
-- new services are named for the rental a family books, not the wedding trade.
--
-- No vendor_category enum value is added: the leaf files under the coarse
-- `reception_decor`, exactly as Outdoor and Dance Floor do
-- (`lib/vendor-branch-category.ts`), so `no-service-lands-in-misc` holds.
--
-- Idempotent. Additive. The owner reviews every list in Admin › Event type ›
-- Scope categories before it matters.
-- ============================================================================

BEGIN;

-- ── 0 · snapshot the wedding's list, so the end can prove it did not move ──
CREATE TEMP TABLE _wedding_tiles_before ON COMMIT DROP AS
  SELECT id
    FROM public.service_categories
   WHERE tier = 2
     AND status = 'active'
     AND (applicable_event_types IS NULL OR cardinality(applicable_event_types) = 0
          OR 'wedding' = ANY (applicable_event_types));

-- ── 1 · the birthday starter list: append, never replace ───────────────────
UPDATE public.service_categories
   SET applicable_event_types = array_append(applicable_event_types, 'birthday')
 WHERE id IN ('cake', 'photo_booth', 'kids_entertainer', 'dessert', 'food_cart',
              'led_wall', 'performers', 'souvenir_giveaways')
   AND applicable_event_types IS NOT NULL
   AND cardinality(applicable_event_types) > 0
   AND NOT ('birthday' = ANY (applicable_event_types));

-- ── 2 · Chairs & tents ─────────────────────────────────────────────────────
-- Schema stubs first: `display_name_en` is the public label a supplier picks in
-- "add a service", and the coverage picker reads it.
INSERT INTO public.canonical_service_schemas
  (canonical_service, schema_version, display_name_en, shared_attribute_groups,
   category_specific_attributes, filter_facets, required_for_visibility, ranking_signal_weights)
VALUES
  ('chair_table_rental',   1, 'Chairs & tables',  '{}', '{}', '[]', '{}', '{}'),
  ('tent_canopy_rental',   1, 'Tents & canopies', '{}', '{}', '[]', '{}', '{}'),
  ('event_lights_rental',  1, 'Lights rental',    '{}', '{}', '[]', '{}', '{}')
ON CONFLICT (canonical_service) DO NOTHING;

INSERT INTO public.service_categories
  (id, parent_id, tier, kind, label_en, label_short, slug, sort_order, scope, marketplace_hidden, status)
VALUES
  ('chairs_tents', 'design', 2, 'leaf', 'Chairs & tents', NULL, 'chairs-tents', 78, 'global', FALSE, 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.canonical_service_taxonomy
  (canonical_service, folder_id, tile_id, phase, faith, is_ph, is_setnayan, is_rental, dietary, is_tradition, marketplace_hidden, secondary_tiles)
VALUES
  ('chair_table_rental',  'design', 'chairs_tents', 'V1.2', NULL, FALSE, FALSE, TRUE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('tent_canopy_rental',  'design', 'chairs_tents', 'V1.2', NULL, FALSE, FALSE, TRUE, NULL, FALSE, FALSE, '{}'::TEXT[]),
  ('event_lights_rental', 'design', 'chairs_tents', 'V1.2', NULL, FALSE, FALSE, TRUE, NULL, FALSE, FALSE, '{}'::TEXT[])
ON CONFLICT (canonical_service) DO NOTHING;

-- The scope lives on the TILE only; the three services inherit it (NULL), so
-- the owner's later edits in Scope categories reach suppliers.
UPDATE public.service_categories
   SET applicable_event_types = ARRAY['wake', 'birthday', 'simple_event']
 WHERE id = 'chairs_tents'
   AND applicable_event_types IS NULL;

-- Belt and braces for a re-run against a hand-edited row: the parent decides
-- which folder it renders in, and hidden would make it unfindable.
UPDATE public.service_categories
   SET parent_id = 'design', marketplace_hidden = FALSE, status = 'active'
 WHERE id = 'chairs_tents'
   AND (parent_id IS DISTINCT FROM 'design'
        OR marketplace_hidden IS DISTINCT FROM FALSE
        OR status IS DISTINCT FROM 'active');

-- ── REFUSE TO APPLY IF ANY OF IT IS NOT TRUE ───────────────────────────────
DO $guard$
DECLARE
  v_lost   INTEGER;
  v_n      INTEGER;
BEGIN
  -- The new leaf resolves to an ACTIVE tier-1 parent (an orphan never renders).
  IF NOT EXISTS (
    SELECT 1
      FROM public.service_categories c
      JOIN public.service_categories p ON p.id = c.parent_id
     WHERE c.id = 'chairs_tents' AND c.tier = 2 AND c.status = 'active'
       AND c.marketplace_hidden IS FALSE
       AND p.tier = 1 AND p.status = 'active'
  ) THEN
    RAISE EXCEPTION 'refusing to apply: chairs_tents is not an active tier-2 leaf under an active tier-1 parent';
  END IF;

  -- …scoped to exactly the three types, never universal.
  IF NOT EXISTS (
    SELECT 1 FROM public.service_categories
     WHERE id = 'chairs_tents'
       AND applicable_event_types @> ARRAY['wake', 'birthday', 'simple_event']
       AND NOT ('wedding' = ANY (applicable_event_types))
  ) THEN
    RAISE EXCEPTION 'refusing to apply: chairs_tents is not scoped to wake + birthday + simple_event';
  END IF;

  -- …with services under it, or the shelf is dead.
  SELECT count(*) INTO v_n
    FROM public.canonical_service_taxonomy WHERE tile_id = 'chairs_tents';
  IF v_n < 3 THEN
    RAISE EXCEPTION 'refusing to apply: chairs_tents has % services — an empty tile is unfindable', v_n;
  END IF;

  -- The owner's birthday list is whole.
  SELECT count(*) INTO v_n
    FROM public.service_categories
   WHERE id IN ('cake', 'photo_booth', 'kids_entertainer', 'dessert', 'food_cart',
                'led_wall', 'performers', 'souvenir_giveaways')
     AND 'birthday' = ANY (applicable_event_types);
  IF v_n <> 8 THEN
    RAISE EXCEPTION 'refusing to apply: only % of the 8 birthday starter categories reach a birthday', v_n;
  END IF;

  -- 🔑 A wedding keeps every category it had.
  SELECT count(*) INTO v_lost
    FROM _wedding_tiles_before b
    JOIN public.service_categories c ON c.id = b.id
   WHERE NOT (c.applicable_event_types IS NULL OR cardinality(c.applicable_event_types) = 0
              OR 'wedding' = ANY (c.applicable_event_types));
  IF v_lost <> 0 THEN
    RAISE EXCEPTION 'refusing to apply: % categories stopped reaching a wedding', v_lost;
  END IF;
END;
$guard$;

COMMIT;

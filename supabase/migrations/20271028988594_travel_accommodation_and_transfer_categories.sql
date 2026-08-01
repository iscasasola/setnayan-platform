-- travel: accommodation + transfers/rentals become real bookable categories
-- ============================================================================
-- Owner decision 2026-08-01: travel needs "location activities like klook,
-- accomodation like booking and airbnb, restaurant seat reservation" — and,
-- asked whether those should be affiliate links out to those platforms or real
-- Setnayan vendors, the owner chose "Real Setnayan vendors in those
-- categories". So this is taxonomy reach, not an integration: local tour
-- operators, guesthouses and restaurants onboard like any other vendor and are
-- booked through the existing inquiry flow at 0% commission.
--
-- No pricing, no entitlement, no SKU, no event type, no new table/view/function.
--
-- ── WHAT ALREADY EXISTED (found first, per RULE 0 — do NOT rebuild) ─────────
-- Travel already reaches 8 tier-2 tiles, and THREE of the four things the
-- owner named were already shipped:
--   * ACTIVITIES  → tile+leaf `tour_activity`  ("Tours & Activities") ['travel']
--   * TOUR GUIDE  → tile+leaf `tour_guide`                            ['travel']
--   * RESTAURANTS → tile+leaf `restaurant_reservation`  ['travel','date','hangout']
-- plus `travel_insurance`, `event_insurance`, `personal_accident_insurance`,
-- `photo_video` and `digital_services`. None of those are touched here.
--
-- The genuine gaps were ACCOMMODATION and TRANSPORT.
--
-- ── (1) ACCOMMODATION — a REUSE, not a new concept ──────────────────────────
-- The canonical leaf `accommodation` ALREADY EXISTS and is ALREADY tagged
-- ['travel','wedding']. It was unreachable for travel hosts anyway, because its
-- TILE is `reception` — the wedding reception-venue shelf (function_hall,
-- hotel_ballroom, garden/resort reception venue, events_place) — and that tile
-- is scoped to the hosted-party types, travel not among them.
--
-- That is the EXACT MIRROR of the dead end `20271027794853` fixed for
-- date/hangout, and it is why this is fixed rather than routed around. There
-- the tile offered a type its leaf refused; here the leaf accepts a type its
-- tile never surfaces:
--
--   leaf `accommodation` resolves ['travel','wedding'] → a hotel vendor CAN
--   tick Travel on the coverage picker (lib/vendor-coverages.ts: the leaf
--   override WINS over the tile) → but every couple-side surface narrows on the
--   TILE (lib/taxonomy-filters.ts `passesEventTypeFilter`, consumed by /explore,
--   the Shortlist and the onboarding picker, and by lib/plan-groups-by-event-
--   type.ts) → so no travel host is ever shown a shelf that leaf sits on.
--
-- A vendor could declare it and never be found through it. Invisible today only
-- because prod is pre-launch (`vendor_services` = 0 rows, `vendor_coverages` = 1
-- row, none on `accommodation`) — precisely the condition that makes a dead
-- shelf and a new shelf render identically.
--
-- So `accommodation` is RE-SHELVED onto its own tile rather than duplicated. A
-- second "where you sleep" concept beside the existing one is how two
-- vocabularies drift apart, which is the failure this codebase has paid for.
--
-- ⚠ THIS IS THE ONE CHANGE THAT TOUCHES WEDDING, and it is deliberate:
--   * the new tile claims ['travel','wedding'], NOT travel alone. Scoping it to
--     travel only would STRIP wedding's access to a leaf it has today — a
--     regression dressed up as a narrow change.
--   * wedding's REACH is therefore unchanged: a wedding couple can still book a
--     guest room block. What changes is the SHELF — "Accommodation" instead of
--     buried inside "Reception". `reception` keeps its 6 real reception venues
--     and stays non-empty (it never depended on this leaf; see the note at
--     lib/taxonomy.ts "the semantic half of the fix").
--   * the leaf keeps `secondary_tiles = {catering}` (PH hotels bundle catering,
--     2026-05-22 directive) — untouched.
-- Post-conditions assert BOTH that travel gains it and that wedding keeps it,
-- so a later edit cannot quietly drop half of that.
--
-- ── (2) TRANSPORT — genuinely new ──────────────────────────────────────────
-- The `transport` folder holds only hosted-event constructs: `bridal_car`
-- (wedding), `guest_shuttle` (ferrying guests to a venue), `escort` (motorcade).
-- None describes getting around on a trip, and no other tile does either, so
-- `transfers_rentals` is created — the only genuinely NEW category family here.
-- Scoped ['travel'] ONLY: an airport transfer or a scooter rental is not a
-- wedding/debut/corporate service, and quietly widening those types' reach is
-- not this change's business.
--
-- ── NEW CANONICAL LEAVES (product surface — named loudly on purpose) ────────
-- Accommodation tile (all ['travel']; `accommodation` stays the generic
-- catch-all, mirroring how `reception_venue` is the generic beside
-- `hotel_ballroom` — generic + specific is the established shape):
--   hotel_stay · resort_stay · guesthouse_homestay · vacation_rental
-- Transfers & Rentals tile (all ['travel']):
--   airport_transfer · private_car_charter · van_rental ·
--   motorcycle_scooter_rental · boat_ferry_charter
-- `is_rental` is set on the three that are literally rentals; `is_ph` on the
-- four that are PH-shaped (guesthouse/homestay, van, scooter, banca/ferry).
--
-- Naming follows the shipped conventions exactly: tile id snake_case, slug
-- kebab-case, label_en Title Case with "&" (as in "Tours & Activities"),
-- kind='leaf', scope='global', status='active', service_nature='service' (all
-- 73 tier-2 tiles are 'service'), leaves phase 'V1.2' (the phase every other
-- travel leaf carries).
--
-- ── AFTERWARDS, ADMINS EDIT THESE AT ───────────────────────────────────────
--   /admin/event-types/travel/categories  — which event types each TILE reaches
--                                          (service_categories.applicable_event_types)
--   /admin/taxonomy                       — the Taxonomy Studio: tiles, leaves,
--                                          folder/tile placement, secondary_tiles
-- Seeds are idempotent (ON CONFLICT DO NOTHING + guarded UPDATEs), so an admin's
-- later edits SURVIVE this migration replaying — it never overwrites their work.
--
-- No new table/function/view => nothing to REVOKE from anon.
-- No RLS policy, USING or WITH CHECK touched => exposure baseline unchanged.
-- ============================================================================

BEGIN;

-- ---- (1) the two new tier-2 tiles -----------------------------------------
-- ON CONFLICT DO NOTHING: a replay must not clobber an admin's later relabel,
-- re-scope or re-sort of these rows.
INSERT INTO public.service_categories
  (id, parent_id, tier, kind, label_en, slug, sort_order, scope, status,
   service_nature, marketplace_hidden, applicable_event_types)
VALUES
  ('accommodation', 'venue', 2, 'leaf', 'Accommodation', 'accommodation',
   69, 'global', 'active', 'service', false, ARRAY['travel','wedding']::text[]),
  ('transfers_rentals', 'transport', 2, 'leaf', 'Transfers & Rentals', 'transfers-rentals',
   70, 'global', 'active', 'service', false, ARRAY['travel']::text[])
ON CONFLICT (id) DO NOTHING;

-- ---- (2) re-shelf the existing `accommodation` leaf onto its own tile ------
-- Guarded so a replay against an already-moved row is a true no-op, and so an
-- admin who has since moved it elsewhere is not overridden. folder_id stays
-- 'venue' (same folder, new shelf). secondary_tiles + applicable_event_types
-- are deliberately NOT written — the leaf already carries the right ones.
UPDATE public.canonical_service_taxonomy
   SET tile_id = 'accommodation',
       updated_at = now()
 WHERE canonical_service = 'accommodation'
   AND tile_id = 'reception';

-- ---- (3) the new canonical leaves ------------------------------------------
INSERT INTO public.canonical_service_taxonomy
  (canonical_service, folder_id, tile_id, phase, is_ph, is_rental,
   marketplace_hidden, applicable_event_types)
VALUES
  -- Accommodation
  ('hotel_stay',               'venue',     'accommodation',     'V1.2', false, false, false, ARRAY['travel']::text[]),
  ('resort_stay',              'venue',     'accommodation',     'V1.2', false, false, false, ARRAY['travel']::text[]),
  ('guesthouse_homestay',      'venue',     'accommodation',     'V1.2', true,  false, false, ARRAY['travel']::text[]),
  ('vacation_rental',          'venue',     'accommodation',     'V1.2', false, true,  false, ARRAY['travel']::text[]),
  -- Transfers & Rentals
  ('airport_transfer',         'transport', 'transfers_rentals', 'V1.2', false, false, false, ARRAY['travel']::text[]),
  ('private_car_charter',      'transport', 'transfers_rentals', 'V1.2', false, false, false, ARRAY['travel']::text[]),
  ('van_rental',               'transport', 'transfers_rentals', 'V1.2', true,  true,  false, ARRAY['travel']::text[]),
  ('motorcycle_scooter_rental','transport', 'transfers_rentals', 'V1.2', true,  true,  false, ARRAY['travel']::text[]),
  ('boat_ferry_charter',       'transport', 'transfers_rentals', 'V1.2', true,  false, false, ARRAY['travel']::text[])
ON CONFLICT (canonical_service) DO NOTHING;

-- ---- (4) display names (canonical_service_schemas.display_name_en NOT NULL) -
-- Without a row here the coverage picker falls back to humanize(slug)
-- ("Guesthouse Homestay"), so these are what a vendor actually reads.
INSERT INTO public.canonical_service_schemas (canonical_service, display_name_en)
VALUES
  ('hotel_stay',                'Hotel'),
  ('resort_stay',               'Resort'),
  ('guesthouse_homestay',       'Guesthouse / Homestay'),
  ('vacation_rental',           'Vacation Rental'),
  ('airport_transfer',          'Airport Transfer'),
  ('private_car_charter',       'Private Car Charter'),
  ('van_rental',                'Van Rental'),
  ('motorcycle_scooter_rental', 'Motorcycle / Scooter Rental'),
  ('boat_ferry_charter',        'Boat / Ferry Charter')
ON CONFLICT (canonical_service) DO NOTHING;

-- ---- post-conditions -------------------------------------------------------
DO $$
DECLARE
  types TEXT[];
  n INT;
  missing TEXT;
BEGIN
  -- (1a) both tiles exist and are visible to the couple-side filter.
  SELECT count(*) INTO n
    FROM public.service_categories
   WHERE id IN ('accommodation','transfers_rentals')
     AND tier = 2
     AND COALESCE(status,'active') <> 'retired'
     AND COALESCE(marketplace_hidden,false) = false;
  IF n <> 2 THEN
    RAISE EXCEPTION
      'post-condition failed: expected 2 visible tier-2 travel tiles, found %', n;
  END IF;

  -- (1b) both tiles must reach travel, or the whole migration bought nothing.
  SELECT string_agg(id, ', ') INTO missing
    FROM public.service_categories
   WHERE id IN ('accommodation','transfers_rentals')
     AND NOT ('travel' = ANY(COALESCE(applicable_event_types, ARRAY[]::text[])));
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'post-condition failed: tile(s) % do not reach travel', missing;
  END IF;

  -- (2a) the accommodation leaf now hangs off the accommodation tile.
  SELECT tile_id INTO missing
    FROM public.canonical_service_taxonomy
   WHERE canonical_service = 'accommodation';
  IF missing IS DISTINCT FROM 'accommodation' THEN
    RAISE EXCEPTION
      'post-condition failed: accommodation leaf sits on tile %, expected accommodation', missing;
  END IF;

  -- (2b) THE REGRESSION THIS MUST NEVER CAUSE: wedding keeps accommodation.
  -- Mirrors getCoverageTaxonomy resolution (leaf override wins, else tile).
  SELECT COALESCE(NULLIF(c.applicable_event_types,'{}'), t.applicable_event_types)
    INTO types
    FROM public.canonical_service_taxonomy c
    JOIN public.service_categories t ON t.id = c.tile_id
   WHERE c.canonical_service = 'accommodation';
  IF types IS NULL OR NOT ('wedding' = ANY(types)) OR NOT ('travel' = ANY(types)) THEN
    RAISE EXCEPTION
      'post-condition failed: accommodation must stay declarable for BOTH wedding and travel, resolved %', types;
  END IF;

  -- (2c) the tile it left must not have been emptied by the move — an empty
  -- tile is pruned entirely by getCoverageTaxonomy, which would delete the
  -- wedding reception shelf as a side effect of a travel change.
  SELECT count(*) INTO n
    FROM public.canonical_service_taxonomy
   WHERE tile_id = 'reception' AND COALESCE(marketplace_hidden,false) = false;
  IF n < 6 THEN
    RAISE EXCEPTION
      'post-condition failed: reception tile left with only % visible leaves', n;
  END IF;

  -- (3a) all 9 new leaves landed, each with a display name.
  SELECT count(*) INTO n
    FROM public.canonical_service_taxonomy c
    JOIN public.canonical_service_schemas s USING (canonical_service)
   WHERE c.canonical_service IN
     ('hotel_stay','resort_stay','guesthouse_homestay','vacation_rental',
      'airport_transfer','private_car_charter','van_rental',
      'motorcycle_scooter_rental','boat_ferry_charter');
  IF n <> 9 THEN
    RAISE EXCEPTION
      'post-condition failed: expected 9 new travel leaves with schemas, found %', n;
  END IF;

  -- (3b) FILLABILITY — the invariant tests/db/tile-event-type-fillable.db.test.ts
  -- guards: every event type a tile claims must have >= 1 leaf resolving to it.
  -- Asserted here too so the migration itself refuses to create a dead shelf.
  SELECT string_agg(claims.tile || ':' || claims.event_type, ', ') INTO missing
    FROM (
      SELECT id AS tile, unnest(applicable_event_types) AS event_type
        FROM public.service_categories
       WHERE id IN ('accommodation','transfers_rentals')
    ) claims
   WHERE NOT EXISTS (
     SELECT 1
       FROM public.canonical_service_taxonomy c
       JOIN public.service_categories t ON t.id = c.tile_id
      WHERE c.tile_id = claims.tile
        AND COALESCE(c.marketplace_hidden,false) = false
        AND (
          COALESCE(NULLIF(c.applicable_event_types,'{}'), t.applicable_event_types) IS NULL
          OR claims.event_type = ANY(
               COALESCE(NULLIF(c.applicable_event_types,'{}'), t.applicable_event_types))
        )
   );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION
      'post-condition failed: unfillable tile:event_type pair(s) created — %', missing;
  END IF;

  -- (4) NO OTHER EVENT TYPE'S REACH MOVED. The only cross-type effect allowed
  -- is wedding gaining the accommodation TILE (asserted at 2b). Nothing else may
  -- have picked up 'travel' as a side effect of this migration.
  SELECT count(*) INTO n
    FROM public.service_categories
   WHERE tier = 2
     AND 'travel' = ANY(COALESCE(applicable_event_types, ARRAY[]::text[]));
  IF n <> 10 THEN
    RAISE EXCEPTION
      'post-condition failed: expected exactly 10 travel-reaching tiles (8 before + 2 new), found %', n;
  END IF;
END $$;

COMMIT;

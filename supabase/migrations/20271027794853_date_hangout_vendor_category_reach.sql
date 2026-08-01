-- date + hangout vendor category reach
-- ============================================================================
-- Two repairs to the reach `20270902999627` seeded for the DATE and HANGOUT
-- event types. Both are wiring, not product design — no new canonical service,
-- no new tile, no new event type, no pricing/entitlement change.
--
-- ── (1) THE STRUCTURAL DEAD-END (the real defect) ───────────────────────────
-- `20270902999627` widened the TILE `service_categories.restaurant_reservation`
-- to ['travel','date','hangout'], but left the tile's ONLY leaf,
-- `canonical_service_taxonomy.restaurant_reservation`, on its older ['travel']
-- override. The leaf override WINS over the tile (lib/vendor-coverages.ts
-- `getCoverageTaxonomy`), and the server ENFORCES it (`parseEventTypes` in
-- app/vendor-dashboard/services/coverage-actions.ts).
--
-- So today, in prod:
--   * a DATE / HANGOUT host DOES see the "Restaurant (Reservation)" tile — it
--     is the single dining tile either type has, and
--   * a restaurant vendor CANNOT tick Date or Hangout on that coverage: the
--     chip does not render (`allowedEventOptions`) and the server would strip
--     it anyway, so `vendor_coverages.event_types` can never contain them, so
--     `syncProfileFromCoverages` can never put them in
--     `vendor_profiles.event_types`, so /explore's
--     `.contains('event_types', [eventType])` can never return that vendor.
-- The tile is a permanent dead end BY CONSTRUCTION — still empty after launch
-- with a thousand restaurants signed up. It is invisible today only because
-- prod is pre-launch (`vendor_services` has 0 rows), which is exactly the
-- condition that makes "denied" and "empty" look identical.
--
-- The fix DELETES the override rather than restating it. The leaf is the sole
-- child of its tile, so the override was pure duplication of the tile's list —
-- and duplication is what let the two drift apart. NULL means "inherit the
-- tile" (documented on the column since `20261104000000`), so from here the
-- tile is the single place an admin edits and the leaf follows automatically.
--
-- ── (2) THE ASYMMETRY: a barkada may hire a photographer, a couple may not ──
-- `photo_video` lists 14 event types including `hangout` but NOT `date`. There
-- is no reading of the taxonomy under which a barkada dinner is photographable
-- and a proposal dinner is not — the tile's own leaves are
-- `engagement_photographer`, `pre_nup_photographer`,
-- `studio_portrait_photographer`, `boudoir_photographer`. Adds `date`.
--
-- `performers` gains `date` for the same market reason: `acoustic_performer`
-- (a serenade at a proposal / anniversary dinner) is a real, commonly-booked PH
-- service and no other tile carries it. `hangout` is NOT added — a live act at
-- a barkada dinner is the restaurant's feature, not something the barkada books.
--
-- ── WHAT THIS DELIBERATELY DOES NOT DO ─────────────────────────────────────
-- `travel` is untouched (owner-gated): it keeps every type it has today.
-- NOT added, and flagged in the PR for the owner instead: `stylist_decorator`,
-- `hmua`, `photo_booth`, `arcade_games`, `mobile_bar`, `catering`, `food_cart`,
-- `dessert`, `tour_activity`. Each is either a HOSTED-PARTY rental or a TRAVEL
-- construct, while both types describe an OUTING in their own `event_type_vocab`
-- rows ("dinner, lunch, or a movie" / "a meal, coffee, or a movie night").
-- Several also carry bridal/ritual leaves (`chuppah_rental`, `mandap_decor`,
-- `bridal_hmua`) that would read as noise on a one-week, Tier-D plan. Whether
-- DATE/HANGOUT mean "an outing" or "a small hosted gathering" is the owner's
-- call, not a wiring fix, so this migration does not quietly make it.
--
-- Net effect: date 4 -> 6 offered tiles; hangout stays 4 but its only dining
-- tile becomes fillable. Every other event type is byte-unchanged.
--
-- Idempotent: a guarded append + a guarded NULL-out, both re-runnable.
-- Post-conditions RAISE if the intended end state is not true.
-- No new table/function/view => nothing to REVOKE from anon.
-- No RLS policy, USING or WITH CHECK touched => exposure baseline unchanged.
-- ============================================================================

BEGIN;

-- ---- (1) drop the duplicated leaf override so it inherits its tile ---------
-- Guarded so a replay against an already-NULL row is a true no-op. Scoped to
-- this one canonical_service; no other leaf override is touched.
UPDATE public.canonical_service_taxonomy
   SET applicable_event_types = NULL
 WHERE canonical_service = 'restaurant_reservation'
   AND applicable_event_types IS NOT NULL;

-- ---- (2) widen the two tiles (guarded append) ------------------------------
-- An append, never an overwrite, so an admin's own later edits at
-- /admin/event-types/<type>/categories survive this migration replaying.
UPDATE public.service_categories
   SET applicable_event_types = applicable_event_types || ARRAY['date']::text[],
       updated_at = now()
 WHERE id IN ('photo_video', 'performers')
   AND applicable_event_types IS NOT NULL
   AND cardinality(applicable_event_types) > 0
   AND NOT ('date' = ANY(applicable_event_types));

-- ---- post-conditions -------------------------------------------------------
DO $$
DECLARE
  types TEXT[];
  missing TEXT;
BEGIN
  -- (1a) the leaf must no longer carry its own list.
  SELECT applicable_event_types INTO types
    FROM public.canonical_service_taxonomy
   WHERE canonical_service = 'restaurant_reservation';
  IF types IS NOT NULL THEN
    RAISE EXCEPTION
      'post-condition failed: restaurant_reservation leaf still overrides its tile with %', types;
  END IF;

  -- (1b) the tile it now inherits must actually offer travel+date+hangout, or
  -- the NULL-out made things WORSE: a resolved allow-list of NULL is read as
  -- WEDDING-ONLY by lib/leaf-suggestions-core.ts, which would hide the leaf
  -- from all three types instead of one.
  SELECT applicable_event_types INTO types
    FROM public.service_categories
   WHERE id = 'restaurant_reservation';
  IF types IS NULL
     OR NOT ('travel' = ANY(types))
     OR NOT ('date' = ANY(types))
     OR NOT ('hangout' = ANY(types)) THEN
    RAISE EXCEPTION
      'post-condition failed: restaurant_reservation TILE must offer travel+date+hangout, has %', types;
  END IF;

  -- (2a) both widened tiles must now offer date.
  SELECT string_agg(id, ', ') INTO missing
    FROM public.service_categories
   WHERE id IN ('photo_video', 'performers')
     AND NOT ('date' = ANY(COALESCE(applicable_event_types, ARRAY[]::text[])));
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'post-condition failed: tile(s) % do not offer date', missing;
  END IF;

  -- (2b) the thing this migration must never do is STRIP a type. Both widened
  -- tiles served weddings before; assert they still do.
  SELECT string_agg(id, ', ') INTO missing
    FROM public.service_categories
   WHERE id IN ('photo_video', 'performers')
     AND NOT ('wedding' = ANY(COALESCE(applicable_event_types, ARRAY[]::text[])));
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'post-condition failed: tile(s) % lost wedding', missing;
  END IF;
END $$;

COMMIT;

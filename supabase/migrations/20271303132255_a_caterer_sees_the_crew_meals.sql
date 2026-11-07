-- a_caterer_sees_the_crew_meals
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 🍱 THE CATERER SEES THE CREW MEALS THE HOST SET, PER BOOKED SUPPLIER (owner 2026-11-02, DECISION_LOG "SCHEDULE FITS
-- THE COORDINATOR'S TIMELINE AS WRITTEN: 4 ADDITIONS" (4)). A real coordinator's timeline ends with "Crew meals:
-- Photo 4 · Video 3 · HMUA 2 · Coord 5 …" for the caterer to plate.
--
-- 🔑 RULE 0 — NOTHING NEW TO STORE. The couple side ALREADY holds this, per booked supplier, since 2026-07-09:
--   event_vendors.crew_size          — the crew this supplier brings on the day (the host's number; blank = the
--                                      supplier's own listing, `vendor_services.crew_size`, the largest one);
--   event_vendors.crew_meal_covered  — the event feeds this crew (its food allowance is then not counted twice).
-- Σ of those is exactly the meal count the crew-meal provider's own workspace already prints ("Covering N meals").
-- What was missing is the CATERER'S READ: a supplier reads no other supplier's booking row (RLS), so nothing reached
-- the production sheet. This function is that read — nothing more.
--
-- 🔐 SECURITY DEFINER, gated exactly like `get_vendor_catering_metrics` (its twin on the same page): the fee gate in
-- SQL, the caller's own org (profile owner or team member), BOOKED on this event, and a food category — plus
-- 'crew_meals', the dedicated crew-meal provider. It returns names and counts only: never a price, a phone, an email,
-- or anybody's money. `STABLE`, read-only.
--
-- Held by apps/web/tests/db/a-caterer-sees-the-crew-meals.db.test.ts.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_vendor_crew_meals(p_event_id UUID)
RETURNS TABLE (vendor_name TEXT, category TEXT, meals INTEGER, from_listing BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_profile_ids       UUID[];
  v_booked_categories TEXT[];
BEGIN
  IF public.vendor_event_fee_gate_stage(p_event_id, TRUE) <> 'unlocked' THEN
    RAISE EXCEPTION 'fee_unsettled' USING ERRCODE = '42501';
  END IF;

  SELECT ARRAY(
    SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = auth.uid()
    UNION
    SELECT tm.vendor_profile_id FROM public.vendor_team_members tm WHERE tm.user_id = auth.uid()
  ) INTO v_profile_ids;
  IF v_profile_ids IS NULL OR COALESCE(array_length(v_profile_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'not_a_vendor' USING ERRCODE = '42501';
  END IF;

  SELECT ARRAY_AGG(DISTINCT ev.category::TEXT) INTO v_booked_categories
    FROM public.event_vendors ev
   WHERE ev.event_id = p_event_id
     AND ev.marketplace_vendor_id = ANY (v_profile_ids)
     AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete');
  IF v_booked_categories IS NULL THEN
    RAISE EXCEPTION 'not_booked' USING ERRCODE = '42501';
  END IF;
  IF NOT (v_booked_categories && ARRAY['catering', 'crew_meals', 'cake_maker', 'mobile_bar', 'venue', 'planner_coordinator']) THEN
    RAISE EXCEPTION 'not_food_relevant' USING ERRCODE = '42501';
  END IF;

  -- Every BOOKED supplier whose crew the event feeds, with the host's number — or, left blank, the supplier's own
  -- listing (said, so the caterer knows it is the supplier's and not the host's). A crew of 0 is not a meal.
  RETURN QUERY
    SELECT x.vendor_name, x.category, x.meals, x.from_listing
      FROM (
        SELECT ev.vendor_name::TEXT AS vendor_name,
               ev.category::TEXT    AS category,
               COALESCE(
                 ev.crew_size,
                 (SELECT max(vs.crew_size) FROM public.vendor_services vs
                   WHERE vs.vendor_profile_id = ev.marketplace_vendor_id AND vs.crew_size IS NOT NULL)
               )::INTEGER          AS meals,
               (ev.crew_size IS NULL) AS from_listing
          FROM public.event_vendors ev
         WHERE ev.event_id = p_event_id
           AND ev.crew_meal_covered IS TRUE
           AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
      ) x
     WHERE COALESCE(x.meals, 0) > 0
     ORDER BY x.category, x.vendor_name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_vendor_crew_meals(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vendor_crew_meals(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_vendor_crew_meals(UUID) IS
  'The crew meals a booked caterer (or crew-meal provider) plates: each booked supplier the host marked crew_meal_covered, '
  'with event_vendors.crew_size (or the supplier''s own listing). Names and counts only. Gated like get_vendor_catering_metrics. 20271303132255.';

COMMIT;

-- ============================================================================
-- CATERER PRODUCTION SHEET — Vendor Portal data-link program ②
-- (corpus: 03_Strategy/Vendor_Portal_Event_Data_Link_2026-06-13.md § 2).
--
--   1. vendor_portion_rules — vendor-defined per-head ratios ("Rice — 0.2 kg
--      per guest, +10% buffer"). Setnayan never invents quantities; ingredient
--      totals are the vendor's own rules × live RSVP counts. Rules are PER
--      VENDOR ORG and reused across every booked event.
--   2. get_vendor_catering_metrics(event_id) — SECURITY DEFINER aggregate
--      read, same booked gate + food-category gate + PII guard as
--      get_vendor_event_brief (migration 20261128): COUNTS only, never guest
--      rows. Adds what the Brief doesn't have: 3 headcount scenarios
--      (confirmed / expected / ceiling), per-block pax via invited_to_blocks
--      (cocktail pax ≠ dinner pax), provisional-vs-final stamp, freshness
--      timestamp.
--
-- Deterministic SQL throughout — zero LLM, ₱0 marginal cost. Idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · vendor_portion_rules
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_portion_rules (
  rule_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id  UUID NOT NULL
                     REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  label              TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 120),
  unit               TEXT NOT NULL CHECK (length(unit) BETWEEN 1 AND 30),
  qty_per_guest      NUMERIC(10,3) NOT NULL CHECK (qty_per_guest > 0),
  -- NULL = applies to all attending guests; subset = only those meal prefs.
  applies_to_meals   public.meal_preference[],
  -- NULL = headline headcount; set = that block's invited_to_blocks pax
  -- (the canonical tags from apps/web/lib/guests.ts INVITED_TO_BLOCKS).
  applies_to_block   TEXT CHECK (applies_to_block IN
                     ('ceremony', 'reception', 'cocktails', 'after_party', 'rehearsal_dinner')),
  headcount_basis    TEXT NOT NULL DEFAULT 'confirmed'
                     CHECK (headcount_basis IN ('confirmed', 'expected', 'ceiling')),
  waste_factor_pct   NUMERIC(5,2) NOT NULL DEFAULT 0
                     CHECK (waste_factor_pct >= 0 AND waste_factor_pct <= 100),
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_portion_rules_vendor_idx
  ON public.vendor_portion_rules(vendor_profile_id, sort_order);

ALTER TABLE public.vendor_portion_rules ENABLE ROW LEVEL SECURITY;

-- Vendor org (owner or team member) manages its own rules. No couple or
-- public read in V1 — the computed totals surface on the vendor's own
-- production sheet only.
DROP POLICY IF EXISTS vendor_portion_rules_org_all ON public.vendor_portion_rules;
CREATE POLICY vendor_portion_rules_org_all
  ON public.vendor_portion_rules FOR ALL TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

COMMENT ON TABLE public.vendor_portion_rules IS
  'Vendor-defined per-head portion ratios (data-link program ②). Ingredient totals = these rules × live RSVP counts — deterministic multiplication, vendor-authored quantities.';

-- ----------------------------------------------------------------------------
-- 2 · get_vendor_catering_metrics
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_vendor_catering_metrics(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_profile_ids       UUID[];
  v_booked_categories TEXT[];
  v_event_date        DATE;
  v_confirmed         INTEGER;
  v_maybe             INTEGER;
  v_pending           INTEGER;
  v_declined          INTEGER;
  v_invited           INTEGER;
  v_meal_counts       JSONB;
  v_per_block         JSONB;
  v_as_of             TIMESTAMPTZ;
  v_restrictions      INTEGER;
  v_is_final          BOOLEAN;
BEGIN
  -- Caller's vendor org(s): profile owner or team member (same resolution
  -- as get_vendor_event_brief).
  SELECT ARRAY(
    SELECT vp.vendor_profile_id
    FROM public.vendor_profiles vp
    WHERE vp.user_id = auth.uid()
    UNION
    SELECT tm.vendor_profile_id
    FROM public.vendor_team_members tm
    WHERE tm.user_id = auth.uid()
  ) INTO v_profile_ids;

  IF v_profile_ids IS NULL OR COALESCE(array_length(v_profile_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'not_a_vendor' USING ERRCODE = '42501';
  END IF;

  -- Booked gate (access keys on BOOKED status).
  SELECT ARRAY_AGG(DISTINCT ev.category::TEXT) INTO v_booked_categories
  FROM public.event_vendors ev
  WHERE ev.event_id = p_event_id
    AND ev.marketplace_vendor_id = ANY (v_profile_ids)
    AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete');

  IF v_booked_categories IS NULL THEN
    RAISE EXCEPTION 'not_booked' USING ERRCODE = '42501';
  END IF;

  -- Food-category gate — same matrix as the Brief's dietary section.
  IF NOT (v_booked_categories
          && ARRAY['catering', 'cake_maker', 'mobile_bar', 'venue', 'planner_coordinator']) THEN
    RAISE EXCEPTION 'not_food_relevant' USING ERRCODE = '42501';
  END IF;

  SELECT e.event_date INTO v_event_date
  FROM public.events e WHERE e.event_id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- One pass over guests: counts only, soft-deleted rows excluded.
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE g.rsvp_status = 'attending'),
    COUNT(*) FILTER (WHERE g.rsvp_status = 'maybe'),
    COUNT(*) FILTER (WHERE g.rsvp_status = 'pending'),
    COUNT(*) FILTER (WHERE g.rsvp_status = 'declined'),
    MAX(g.rsvp_responded_at)
  INTO v_invited, v_confirmed, v_maybe, v_pending, v_declined, v_as_of
  FROM public.guests g
  WHERE g.event_id = p_event_id AND g.deleted_at IS NULL;

  -- Meal mix of attending guests (NULL preference surfaces as 'unspecified'
  -- so the caterer sees the gap instead of a silently short total).
  SELECT COALESCE(jsonb_object_agg(m.pref, m.n), '{}'::jsonb) INTO v_meal_counts
  FROM (
    SELECT COALESCE(g.meal_preference::TEXT, 'unspecified') AS pref, COUNT(*) AS n
    FROM public.guests g
    WHERE g.event_id = p_event_id AND g.deleted_at IS NULL
      AND g.rsvp_status = 'attending'
    GROUP BY COALESCE(g.meal_preference::TEXT, 'unspecified')
  ) m;

  -- Per-block pax: cocktail pax ≠ dinner pax. invited_to_blocks is a TEXT[]
  -- on guests; all three scenarios per block so portion rules can apply
  -- their headcount basis consistently.
  SELECT COALESCE(jsonb_object_agg(b.block, jsonb_build_object(
           'confirmed', b.confirmed,
           'expected',  b.confirmed + b.maybe,
           'ceiling',   b.confirmed + b.maybe + b.pending
         )), '{}'::jsonb) INTO v_per_block
  FROM (
    SELECT u.block,
           COUNT(*) FILTER (WHERE g.rsvp_status = 'attending') AS confirmed,
           COUNT(*) FILTER (WHERE g.rsvp_status = 'maybe')     AS maybe,
           COUNT(*) FILTER (WHERE g.rsvp_status = 'pending')   AS pending
    FROM public.guests g, UNNEST(g.invited_to_blocks) AS u(block)
    WHERE g.event_id = p_event_id AND g.deleted_at IS NULL
    GROUP BY u.block
  ) b;

  SELECT COUNT(*) INTO v_restrictions
  FROM public.guests g
  WHERE g.event_id = p_event_id AND g.deleted_at IS NULL
    AND g.rsvp_status = 'attending'
    AND NULLIF(TRIM(g.dietary_restrictions), '') IS NOT NULL;

  -- FINAL when nobody is pending/maybe, or the event is ≤ 7 days out (the
  -- working assumption every PH caterer already uses for final pax).
  v_is_final := (v_pending + v_maybe = 0)
                OR (v_event_date IS NOT NULL AND v_event_date - CURRENT_DATE <= 7);

  RETURN jsonb_build_object(
    'as_of', v_as_of,
    'event_date', v_event_date,
    'finality', jsonb_build_object(
      'is_provisional', NOT v_is_final,
      'responded_pct', CASE WHEN v_invited = 0 THEN 0
                            ELSE ROUND((v_invited - v_pending)::NUMERIC / v_invited, 2) END,
      'pending', v_pending,
      'maybe', v_maybe
    ),
    'headcount_scenarios', jsonb_build_object(
      'confirmed', v_confirmed,
      'expected',  v_confirmed + v_maybe,
      'ceiling',   v_confirmed + v_maybe + v_pending
    ),
    'invited', v_invited,
    'declined', v_declined,
    'meal_counts', v_meal_counts,
    'per_block_headcount', v_per_block,
    'dietary_restriction_count', v_restrictions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_vendor_catering_metrics(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_vendor_catering_metrics(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_vendor_catering_metrics(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_vendor_catering_metrics(UUID) IS
  'Caterer Production Sheet metrics (data-link program ②): headcount scenarios, meal mix, per-block pax, finality stamp. Booked + food-category gated; counts only, guest PII never crosses.';

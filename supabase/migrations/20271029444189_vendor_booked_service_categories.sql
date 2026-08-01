-- vendor_booked_service_categories
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).

-- ═══════════════════════════════════════════════════════════════════════════
-- WHICH SERVICES A SUPPLIER WAS BOOKED FOR — readable by that supplier.
--
-- ── THE BUG THIS CLOSES ────────────────────────────────────────────────────
--
-- PR #4010 taught the day-of console to work out a supplier's roles from the
-- services on their booking rather than the booking row's single summary
-- category. Correct idea; it could not actually read them.
--
-- Verified in production AS THE VENDOR'S OWN IDENTITY (`SET LOCAL ROLE
-- authenticated` + their jwt claims), which is the only way this shows up:
--
--     can read their OWN vendor_services   -> 2 rows   OK
--     can read their OWN event_vendors row -> 0 rows   DENIED
--
-- A marketplace vendor cannot read the `event_vendors` row that links them to
-- the couple's event, so `requested_service_ids` is invisible to them and the
-- read in #4010 silently returns nothing. No error -- an RLS denial and an empty
-- list are the same value to the caller, so the feature would simply have sat
-- dormant looking fine.
--
-- That is exactly why `booked_categories` works today: `get_vendor_event_brief`
-- is SECURITY DEFINER. The category was never read directly either.
--
-- ── WHY A NEW SMALL FUNCTION, NOT AN EDIT TO THE BRIEF ─────────────────────
--
-- `get_vendor_event_brief` is a large shipped function carrying the disclosure
-- ladder, the budget-band derivation and the dietary matrix. Replacing its whole
-- body to add one array is a large blast radius for a small need. This mirrors
-- its identity resolution and its booked-stage gate exactly, and nothing else.
--
-- ── WHAT IT DOES AND DOES NOT EXPOSE ───────────────────────────────────────
--
-- Returns ONLY the `vendor_services.category` values on the CALLER'S OWN
-- booking for that event -- text the caller already authored. No couple data, no
-- other supplier's services, no prices, no ids. A caller with no booked row gets
-- an empty array, which is the honest answer and the same one they get today.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.get_vendor_booked_service_categories(p_event_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile_ids UUID[];
  v_categories  TEXT[];
BEGIN
  -- Identity, resolved exactly as get_vendor_event_brief does: the profile
  -- owner OR a team member. One idiom, so the two can never disagree about who
  -- the caller is.
  SELECT ARRAY(
    SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = auth.uid()
    UNION
    SELECT tm.vendor_profile_id FROM public.vendor_team_members tm WHERE tm.user_id = auth.uid()
  ) INTO v_profile_ids;

  -- Not a vendor at all -> nothing, rather than an exception. This feeds a
  -- REFINEMENT (which desks to offer), never a gate, so a silent empty is the
  -- correct degradation: the caller falls back to the booking's summary
  -- category, which is exactly today's behaviour.
  IF v_profile_ids IS NULL OR COALESCE(array_length(v_profile_ids, 1), 0) = 0 THEN
    RETURN ARRAY[]::TEXT[];
  END IF;

  -- The caller's OWN booking on this event, at the same booked-stage bar the
  -- brief uses. A shortlisted-but-unbooked link must not confer a desk.
  SELECT ARRAY_AGG(DISTINCT vs.category)
    INTO v_categories
    FROM public.event_vendors ev
    JOIN public.vendor_services vs
      ON vs.vendor_service_id = ANY (ev.requested_service_ids)
   WHERE ev.event_id = p_event_id
     AND ev.marketplace_vendor_id = ANY (v_profile_ids)
     AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     AND vs.vendor_profile_id = ANY (v_profile_ids)   -- belt: only their own services
     AND vs.category IS NOT NULL
     AND btrim(vs.category) <> '';

  RETURN COALESCE(v_categories, ARRAY[]::TEXT[]);
END;
$function$;

COMMENT ON FUNCTION public.get_vendor_booked_service_categories(UUID) IS
  'The categories of the services on the CALLING vendor''s own booking for this event. SECURITY DEFINER for the same reason get_vendor_event_brief is: a marketplace vendor cannot read their own event_vendors row under RLS, so requested_service_ids is otherwise invisible to them (verified in prod as the vendor identity, 2026-08-01). Feeds the day-of role narrowing - a REFINEMENT, never a gate - so an empty result degrades to the booking''s summary category, i.e. previous behaviour. Exposes only text the caller authored.';

-- Callable by a signed-in vendor; never by a stranger.
REVOKE ALL ON FUNCTION public.get_vendor_booked_service_categories(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vendor_booked_service_categories(UUID) TO authenticated;

COMMIT;

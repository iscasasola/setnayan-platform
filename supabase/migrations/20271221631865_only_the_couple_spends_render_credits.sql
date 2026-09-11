-- only_the_couple_spends_render_credits
-- ============================================================================
-- ONLY THE COUPLE (AND SETNAYAN ADMINS) MAY SPEND THE COUPLE'S MOOD-BOARD
-- RENDER CREDITS OR GIVE SHARE CONSENT. Every other member keeps exactly the
-- READ access they had.
--
-- OWNER RULING, 2026-09-11 (DECISION_LOG): "Only the couple (Recommended)" —
-- and Setnayan admins. Found by N3 (#5415), whose migration 20271220579615
-- named it and deliberately left it: "who may start a render / give share
-- consent (moodboard_render_caller_may_act's missing member_type filter) is a
-- product question left to the owner".
--
-- MEASURED IN PRODUCTION (read-only, 2026-09-11), the live objects:
--   moodboard_render_caller_may_act(event) = TRUE for a NULL auth.uid()
--   (trusted server), is_admin(), or ANY event_members row — couple, guest,
--   booked supplier, coordinator — with no member_type filter. It gates ten
--   SECURITY DEFINER functions, all EXECUTE-able by `authenticated`:
--     spend / act — begin_render, reserve_render_credits,
--                   release_render_credits, finish_render, fail_render,
--                   attach_gallery_copy, set_share_consent
--     read        — render_balance (STABLE), inspiration_pool (STABLE)
--   (set_render_featured is is_admin()-only and does not use it.)
--   So a guest could spend the couple's credits (or make a 0-credit row), and
--   ANY member could give the consent that puts the couple's renders into the
--   pool other couples browse and makes them featurable.
--
-- THE CHANGE:
--   1. moodboard_render_caller_may_act — NARROWED to the couple
--      (current_couple_event_ids(), the SAME definition
--      colour_access_caller_is_couple already uses) or is_admin(). The NULL
--      auth.uid() server arm is KEPT exactly as it was: a service-role caller
--      has no uid, and anon holds EXECUTE on none of these functions.
--      Every spend/act function above inherits the narrowing unchanged.
--   2. moodboard_render_caller_may_view — NEW, the OLD rule verbatim (any
--      member, admin, trusted server). Used ONLY by the two read functions,
--      so a guest, supplier or coordinator still sees the balance and can
--      browse the pool exactly as before. It is NOT granted to any browser
--      role: it is only ever called from inside those two SECURITY DEFINER
--      functions, which run as their owner, so no EXECUTE widening exists.
--   3. moodboard_render_balance and moodboard_inspiration_pool re-created
--      with the read gate; their bodies are otherwise the live bodies
--      (pg_get_functiondef, production) byte-for-byte in logic.
--
-- NOT CHANGED: the table RLS (event_renders / share_consent / credit tables
-- are member-READ policies and hold no browser write grant — unchanged), the
-- key pinning of 20271220579615, set_render_featured (admin only).
--
-- Production today: event_renders 0 rows, so no existing render is orphaned.
--
-- IDEMPOTENT: CREATE OR REPLACE throughout. REVERSIBLE: restore
-- moodboard_render_caller_may_act from 20271199871696 (the two read functions
-- then behave identically whichever gate they name).
-- ============================================================================

BEGIN;

-- ── 2 (first, because 3 names it) · the READ gate: the old rule, verbatim ──
CREATE OR REPLACE FUNCTION public.moodboard_render_caller_may_view(
  p_event_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event_id IS NULL THEN
    RETURN FALSE;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN TRUE;                       -- service_role / trusted server context
  END IF;
  RETURN public.is_admin() OR EXISTS (
    SELECT 1 FROM public.event_members em
    WHERE em.event_id = p_event_id
      AND em.user_id  = auth.uid()
  );
END;
$$;

-- Called only from inside the two SECURITY DEFINER readers (they run as the
-- owner), so no browser role needs — or gets — EXECUTE.
REVOKE ALL ON FUNCTION public.moodboard_render_caller_may_view(UUID) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.moodboard_render_caller_may_view(UUID) IS
  'READ gate for the mood-board render ledger (balance, inspiration pool): any '
  'member of the event, an admin, or a trusted server context (NULL auth.uid()). '
  'Deliberately wider than moodboard_render_caller_may_act, which since '
  '20271221631865 admits only the couple and admins to SPEND or CONSENT.';

-- ── 1 · the ACT gate: the couple, or an admin ───────────────────────────────
CREATE OR REPLACE FUNCTION public.moodboard_render_caller_may_act(
  p_event_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event_id IS NULL THEN
    RETURN FALSE;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN TRUE;                       -- service_role / trusted server context
  END IF;
  -- Owner ruling 2026-09-11: ONLY THE COUPLE (and Setnayan admins) spend the
  -- couple's render credits or give share consent. A guest, a booked
  -- supplier and a coordinator are members — and are refused here.
  RETURN public.is_admin()
      OR p_event_id IN (SELECT public.current_couple_event_ids());
END;
$$;

COMMENT ON FUNCTION public.moodboard_render_caller_may_act(UUID) IS
  'ACT gate for mood-board renders — begin, reserve, release, finish, fail, '
  'attach the gallery copy, set share consent: the COUPLE of the event '
  '(current_couple_event_ids) or an admin, or a trusted server context (NULL '
  'auth.uid()). Owner ruling 2026-09-11. Reads use moodboard_render_caller_may_view.';

-- ── 3a · balance: READ gate ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.moodboard_render_balance(
  p_event_id UUID
) RETURNS TABLE (
  credits_granted INTEGER,
  credits_used    INTEGER,
  credits_left    INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_granted INTEGER;
  v_used    INTEGER;
BEGIN
  IF NOT public.moodboard_render_caller_may_view(p_event_id) THEN
    RETURN;                            -- zero rows, NOT a zero balance
  END IF;

  SELECT COALESCE(SUM(g.credits), 0) INTO v_granted
    FROM public.event_render_credit_grants g
   WHERE g.event_id = p_event_id;

  SELECT COALESCE(u.credits_used, 0) INTO v_used
    FROM public.event_render_credit_usage u
   WHERE u.event_id = p_event_id;

  v_used := COALESCE(v_used, 0);

  credits_granted := v_granted;
  credits_used    := v_used;
  credits_left    := GREATEST(v_granted - v_used, 0);
  RETURN NEXT;
END;
$$;

-- ── 3b · inspiration pool: READ gate ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.moodboard_inspiration_pool(
  p_event_id  UUID,
  p_part_ids  TEXT[]  DEFAULT NULL,
  p_limit     INTEGER DEFAULT 6,
  p_offset    INTEGER DEFAULT 0,
  p_render_id UUID    DEFAULT NULL
) RETURNS TABLE (
  render_id         UUID,
  part_id           TEXT,
  gallery_image_key TEXT,
  swatches          TEXT[],
  created_at        TIMESTAMPTZ,
  total_count       BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The caller must belong to the event they browse for. Browsing is a READ,
  -- so every member keeps it (owner ruling 2026-09-11 narrowed only spending
  -- and consent).
  IF NOT public.moodboard_render_caller_may_view(p_event_id) THEN
    RETURN;                              -- zero rows, and the caller says so
  END IF;

  RETURN QUERY
    SELECT r.render_id,
           r.part_id,
           r.gallery_image_key,
           CASE
             WHEN jsonb_typeof(r.design_snapshot -> 'role_palette' -> 'reception') = 'array'
               THEN ARRAY(
                 SELECT jsonb_array_elements_text(
                          r.design_snapshot -> 'role_palette' -> 'reception')
               )
             ELSE '{}'::TEXT[]
           END,
           r.created_at,
           COUNT(*) OVER () AS total_count
      FROM public.event_renders r
      JOIN public.event_render_share_consent c
        ON c.event_id = r.event_id
     WHERE r.reusable                              -- note-free · delivered · not failed · not quarantined
       AND r.gallery_image_key IS NOT NULL         -- watermarked, or it is not shown
       AND c.consented                             -- MB8's consent, per event
       AND r.event_id IS DISTINCT FROM p_event_id  -- not your own; you already have those
       AND (p_part_ids IS NULL
            OR cardinality(p_part_ids) = 0
            OR r.part_id = ANY (p_part_ids))
       AND (p_render_id IS NULL OR r.render_id = p_render_id)
     ORDER BY r.created_at DESC, r.render_id
     LIMIT GREATEST(LEAST(COALESCE(p_limit, 6), 24), 1)
    OFFSET GREATEST(LEAST(COALESCE(p_offset, 0), 600), 0);
END;
$$;

-- CREATE OR REPLACE keeps existing ACLs; restated so a fresh replay matches
-- production exactly (REVOKE first — CREATE FUNCTION grants PUBLIC).
REVOKE ALL ON FUNCTION public.moodboard_render_caller_may_act(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moodboard_render_balance(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moodboard_inspiration_pool(UUID, TEXT[], INTEGER, INTEGER, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moodboard_render_caller_may_act(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.moodboard_render_balance(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.moodboard_inspiration_pool(UUID, TEXT[], INTEGER, INTEGER, UUID) TO authenticated, service_role;

-- ── POST-CONDITIONS ────────────────────────────────────────────────────────
DO $$
DECLARE
  act  text := pg_get_functiondef('public.moodboard_render_caller_may_act(uuid)'::regprocedure);
  view text := pg_get_functiondef('public.moodboard_render_caller_may_view(uuid)'::regprocedure);
  bal  text := pg_get_functiondef('public.moodboard_render_balance(uuid)'::regprocedure);
  pool text := pg_get_functiondef('public.moodboard_inspiration_pool(uuid,text[],integer,integer,uuid)'::regprocedure);
BEGIN
  IF act NOT LIKE '%current_couple_event_ids()%' OR act LIKE '%event_members%' THEN
    RAISE EXCEPTION 'POST-CONDITION 1 FAILED: may_act is not the couple-only rule';
  END IF;
  IF view NOT LIKE '%event_members%' THEN
    RAISE EXCEPTION 'POST-CONDITION 2 FAILED: may_view lost the member rule -- every non-couple member would lose READ';
  END IF;
  IF bal NOT LIKE '%moodboard_render_caller_may_view(p_event_id)%'
     OR pool NOT LIKE '%moodboard_render_caller_may_view(p_event_id)%' THEN
    RAISE EXCEPTION 'POST-CONDITION 3 FAILED: a READ function still uses the narrowed ACT gate';
  END IF;
  IF has_function_privilege('anon', 'public.moodboard_render_caller_may_view(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.moodboard_render_caller_may_view(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-CONDITION 4 FAILED: may_view is callable by a browser role';
  END IF;
  IF has_function_privilege('anon', 'public.moodboard_render_caller_may_act(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'POST-CONDITION 5 FAILED: anon may call may_act -- a NULL uid would read as the server';
  END IF;
END $$;

COMMIT;

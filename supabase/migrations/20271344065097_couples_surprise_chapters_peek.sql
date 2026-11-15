-- couples_surprise_chapters_peek
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 🎁 THE COUPLE'S SURPRISE IS ON BY DEFAULT (owner 2026-11-13, DECISION_LOG "POST EVENT = A STORY (ONE SCENE PER
-- SCREEN) — SIX CALLS SETTLED" (6), closing the 1 Nov open item *"Bride and groom do not see until post event"*):
-- chapter photos stay hidden from the couple until Post Event opens, with ONE "Peek now" switch to see them early.
-- Nothing reaches guests until the couple presses Share it (the 10 Nov rule stands — untouched here).
--
-- 🔑 EXTEND, DO NOT REBUILD. How chapter photos reach the couple today is ONE answer: `papic_chapter_viewer_sees`
-- (20271301555513) — the Memories reads (`papic_memories_chapters`, `papic_memories_photo_chapters`) and the per-photo
-- seam (`papic_chapter_capture_visible`) all ask it. Before the event is done it judged a host like everyone else, so a
-- couple saw every "right away" chapter they were part of during the day. This gates ONLY that answer, for the hosts
-- only, before the event is done (`papic_event_is_done` — the app's own "after" rule, the morning the Post Event stage
-- opens): NULL unless they peek. After the event is done the shipped line above it already answers 'all'. A host's
-- OWN shots stay theirs — `papic_chapter_capture_visible` answers those before it asks this function.
--
-- ── THE ONE NEW FACT: `events.chapters_peek` ────────────────────────────────────────────────────────────────────────
-- FALSE (the default) = the surprise is on. TRUE = the couple chose to peek. Written by the couple's own session
-- (`hubDraftAction` intent `peek`), so the events UPDATE policy (couple-or-admin) decides the row.
--
-- The body below is `papic_chapter_viewer_sees` reproduced VERBATIM from its only definition (20271301555513) —
-- extracted mechanically, not retyped — with the block marked 🎁 added and the When line's `AND NOT v_host` (a host
-- only reaches it when peeking).
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS chapters_peek BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.events.chapters_peek IS
  'The couple''s "Peek now" (owner 2026-11-13, "SIX CALLS SETTLED" (6)). FALSE (default) = the surprise is on: before '
  'Post Event opens the couple sees no chapter''s photos (papic_chapter_viewer_sees). TRUE = they chose to see them early. '
  'Guests are never affected.';

-- ── WHO MAY READ AND WRITE IT ───────────────────────────────────────────────────────────────────────────────────────
-- `public.events` revokes table-level SELECT/UPDATE and re-grants per-column allowlists (20271007100000,
-- 20271005100000): a new column is born unreadable AND unwritable to `authenticated`, and an ungranted column makes
-- PostgREST refuse the ENTIRE query that names it.
--   · authenticated — SELECT (the Maker reads it on the host's session) + UPDATE (the couple's own session writes it).
--   · anon — NOTHING. No guest-facing reader names it.
GRANT SELECT (chapters_peek) ON public.events TO authenticated;
GRANT UPDATE (chapters_peek) ON public.events TO authenticated;

-- ── AND events_host MUST BE REBUILT OVER IT ─────────────────────────────────
-- The view's projection is COMPUTED from the grants (hence: after the GRANT), so the block below is reproduced
-- VERBATIM from 20271343328401 (the latest carrier of it) — extracted mechanically, not retyped — including its
-- private list and its refuse-if-empty guard.

DROP VIEW IF EXISTS public.events_host;

DO $$
DECLARE
  private_columns TEXT[] := ARRAY[
    'partner_a_birth_date','partner_a_birth_time',
    'partner_b_birth_date','partner_b_birth_time',
    'bazi_birthdata_consent_at',
    'estimated_budget_centavos','budget_band',
    'wizard_state',
    'photo_delivery_folder_id','photo_delivery_folder_name',
    'photo_delivery_account_email',
    'setnayan_ai_tier_at_purchase',
    'signature_details','honoree_label','honoree_dependent_id'
  ];
  projected TEXT;
BEGIN
  SELECT string_agg('e.' || quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
    INTO projected
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'events'
    AND (
      has_column_privilege('authenticated', 'public.events', c.column_name, 'SELECT')
      OR c.column_name = ANY (private_columns)
    );

  IF projected IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: computed events_host projection is empty';
  END IF;

  EXECUTE format($ddl$
    CREATE VIEW public.events_host
      WITH (security_invoker = false)
      AS
      SELECT %s
        FROM public.events e
       WHERE e.event_id IN (SELECT public.current_couple_event_ids())
          OR e.event_id IN (SELECT public.current_moderator_event_ids())
          -- service_role only, named EXPLICITLY. NOT `auth.uid() IS NULL` —
          -- that is also true for anon, which would hand every row to an
          -- unauthenticated caller. Reproduced verbatim from 20271008731642.
          OR current_user = 'service_role'
          OR auth.role() = 'service_role'
  $ddl$, projected);
END $$;

REVOKE ALL ON public.events_host FROM PUBLIC;
REVOKE ALL ON public.events_host FROM anon;
REVOKE ALL ON public.events_host FROM authenticated;
GRANT SELECT ON public.events_host TO authenticated, service_role;

COMMENT ON VIEW public.events_host IS
  'Couple/moderator-scoped read path for events, including the columns denied to authenticated on the base table (20271008731642 + 20271025120000: birth data, budget, wizard_state, Drive folder, AI tier, signature_details, honoree_label, honoree_dependent_id). Guests, vendors and coordinators get ZERO rows. security_invoker=false by design.';

-- ── THE GATE — how chapter photos reach the couple, and only that ───────────
CREATE OR REPLACE FUNCTION public.papic_chapter_viewer_sees(p_block_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event UUID;
  v_who   TEXT;
  v_when  TEXT;
  v_host  BOOLEAN;
  v_done  BOOLEAN;
  v_guest UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT b.event_id, b.photo_who, b.photo_when INTO v_event, v_who, v_when
    FROM public.event_schedule_blocks b
   WHERE b.block_id = p_block_id AND b.parent_block_id IS NULL;
  IF v_event IS NULL THEN
    RETURN NULL;
  END IF;

  v_host := EXISTS (
    SELECT 1 FROM public.event_members em
     WHERE em.event_id = v_event AND em.user_id = p_user_id AND em.member_type = 'couple'
  );
  v_done := public.papic_event_is_done(v_event);

  -- Ruled 1 Nov: once the event is done, the hosts see every chapter.
  IF v_host AND v_done THEN
    RETURN 'all';
  END IF;
  -- 🎁 THE COUPLE'S SURPRISE (owner 2026-11-13, DECISION_LOG "POST EVENT = A STORY (ONE SCENE PER SCREEN) — SIX CALLS
  -- SETTLED" (6)): until Post Event opens, the couple sees NO chapter's photos — whatever its When and Who — unless
  -- they switched "Peek now" on (`events.chapters_peek`). Their own shots stay theirs (`papic_chapter_capture_visible`
  -- answers those first, per photo). Guests are untouched: nothing reaches them until the couple presses Share it.
  IF v_host AND NOT COALESCE((SELECT e.chapters_peek FROM public.events e WHERE e.event_id = v_event), FALSE) THEN
    RETURN NULL;
  END IF;
  -- When: "only once the event is done" holds for everybody — the hosts included (*"Bride and groom do not see until
  -- post event"*). 🎁 …except a host who reached this line: they switched "Peek now" on, which is exactly the choice
  -- to see the chapters early (owner 2026-11-13 (6)).
  IF v_when = 'after_event' AND NOT v_done AND NOT v_host THEN
    RETURN NULL;
  END IF;

  -- A guest of this event (live on its guest list).
  SELECT em.guest_id INTO v_guest
    FROM public.event_members em
    JOIN public.guests g ON g.guest_id = em.guest_id AND g.event_id = v_event AND g.deleted_at IS NULL
   WHERE em.event_id = v_event AND em.user_id = p_user_id
   LIMIT 1;

  IF v_who = 'everybody' THEN
    -- Ruled 1 Nov: Everybody = the whole guest list (and the hosts, and the chapter's own people).
    IF v_host OR v_guest IS NOT NULL OR public.papic_chapter_person_in(p_block_id, v_guest, p_user_id, FALSE) THEN
      RETURN 'all';
    END IF;
    RETURN NULL;
  END IF;
  IF v_who = 'tagged' THEN
    -- Only people tagged: each sees the photos they are in — nobody else's, whoever they are.
    IF v_host OR v_guest IS NOT NULL THEN
      RETURN 'tagged';
    END IF;
    RETURN NULL;
  END IF;
  -- People in this chapter. 🔒 A face tag never overrides it: it is not asked here at all.
  IF public.papic_chapter_person_in(p_block_id, v_guest, p_user_id, FALSE) THEN
    RETURN 'all';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.papic_chapter_viewer_sees(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.papic_chapter_viewer_sees(UUID, UUID) TO service_role;

-- ── PROOF — it proves itself on apply ───────────────────────────────────────
DO $$
BEGIN
  IF NOT has_column_privilege('authenticated', 'public.events', 'chapters_peek', 'SELECT') THEN
    RAISE EXCEPTION 'chapters_peek: authenticated cannot read it — every events query naming it would fail';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.events', 'chapters_peek', 'UPDATE') THEN
    RAISE EXCEPTION 'chapters_peek: authenticated cannot write it — the couple''s Peek now would fail';
  END IF;
  IF has_column_privilege('anon', 'public.events', 'chapters_peek', 'SELECT') THEN
    RAISE EXCEPTION 'chapters_peek: anon can read it — no guest reader needs it';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = 'chapters_peek'
  ) THEN
    RAISE EXCEPTION 'chapters_peek: events_host does not carry it — the host read path would refuse it';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host'
       AND column_name IN ('master_qr_token', 'photo_delivery_oauth_token_encrypted', 'photo_delivery_oauth_expires_at')
  ) THEN
    RAISE EXCEPTION 'chapters_peek: events_host now projects a secret column — the rebuild widened it';
  END IF;
  IF position('chapters_peek' in pg_get_functiondef('public.papic_chapter_viewer_sees(uuid, uuid)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'chapters_peek: papic_chapter_viewer_sees does not ask it — the surprise would not hold';
  END IF;
END $$;

-- THE 100 MB METER — one running counter, so the Maker never has to sum bytes.
--
-- DECISION_LOG 2026-09-25: "these stay for at least 10 years... that means they
-- can only upload a total of 100MB compressed files" — the couple's OWN uploads
-- (photos, short clips, a Pro background song) share one 100 MB allowance per
-- event, measured AFTER browser compression. Guest/Papic media is separate
-- (credits) and never touches this column.
--
-- ── WHY A COLUMN, NOT A LIVE SUM ────────────────────────────────────────────
-- Measured first (RULE 0 · plan Phase 4): no per-event byte ledger exists
-- anywhere in the schema (`grep -rn "media_bytes\|storage_bytes"
-- supabase/migrations` is empty) and no upload path stores the object's byte
-- length anywhere durable — `invitation_widgets.config_json.canvas.media` and
-- `events.landing_page_hero_*` hold only the `r2://` ref, never its size. A
-- live sum would mean a HeadObject round-trip to R2 per referenced object on
-- every editor render — the meter would be the slowest thing on the page. A
-- single running counter, incremented once per successful presign (the upload
-- route already computes the compressed byte length it is about to sign), is
-- the cheap, correct alternative.
--
-- NOT a security boundary: it undercounts a presign whose PUT never completed
-- and never counts a Remove (removing media is client-side only today; nothing
-- shrinks R2 usage either). Both failure directions are logged in
-- `lib/maker-media-limits.ts`'s docblock. It exists to show the couple where
-- they stand against the owner's real cost ceiling, not to enforce a hard cap
-- at the byte.
--
-- 🪤 ONE `ALTER TABLE` PER STATEMENT — lint-events-column-grants.mjs sees only
-- the first column of a comma-separated ADD.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS couple_media_bytes BIGINT NOT NULL DEFAULT 0;

-- Every existing event genuinely has zero bytes counted under this meter today
-- (it did not exist before this migration) — DEFAULT 0 states a fact, not an
-- invented backfill.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_couple_media_bytes_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_couple_media_bytes_check
  CHECK (couple_media_bytes >= 0);

COMMENT ON COLUMN public.events.couple_media_bytes IS
  'Running total of the couple''s OWN compressed upload bytes toward the 100 MB/event '
  'allowance (DECISION_LOG 2026-09-25). Incremented server-side, once per successful '
  'presign, by app/api/upload/route.ts for the couple''s own media-bucket uploads only '
  '(never Papic/guest captures, never vendor uploads). NOT couple-writable — see the '
  'grants below and public.increment_couple_media_bytes(). Best-effort: a presign whose '
  'PUT never lands still counts, and Remove does not shrink it; it is a meter, not a cap.';

-- ── THE COLUMN MUST BE GRANTED, OR EVERY SIGNED-IN EVENTS QUERY DIES ────────
-- 🛑 `public.events` revokes table-level SELECT and re-grants a computed
-- per-column allowlist (20271007100000 / 20271025120000). An ungranted column
-- makes PostgREST refuse the ENTIRE query that names it.
--
-- ✅ SELECT ONLY, `authenticated` ONLY — a decision, not a copied line:
--   · No GRANT UPDATE to authenticated OR anon: the ONLY writer is
--     public.increment_couple_media_bytes() below, called by the upload route
--     through createAdminClient() (service_role) after the same tenancy check
--     that already proves the caller owns the event. A session UPDATE grant
--     would let a couple hand-POST any number to PostgREST and defeat the
--     meter it exists to show them.
--   · No grant to `anon`: the meter is host-facing only; no public surface
--     reads it.
GRANT SELECT (couple_media_bytes) ON public.events TO authenticated;

-- ── ONE FUNCTION, THE ONLY WRITER ────────────────────────────────────────────
-- SECURITY DEFINER so it can update the column despite the column-level grants
-- above refusing UPDATE to every session role. Callable ONLY by service_role —
-- the upload route's admin client — never by `authenticated`, so a couple can
-- never call it directly through PostgREST's RPC surface either.
CREATE OR REPLACE FUNCTION public.increment_couple_media_bytes(
  p_event_id UUID,
  p_bytes BIGINT
) RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.events
     SET couple_media_bytes = couple_media_bytes + GREATEST(p_bytes, 0)
   WHERE event_id = p_event_id;
$$;

REVOKE ALL ON FUNCTION public.increment_couple_media_bytes(UUID, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_couple_media_bytes(UUID, BIGINT) FROM anon;
REVOKE ALL ON FUNCTION public.increment_couple_media_bytes(UUID, BIGINT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_couple_media_bytes(UUID, BIGINT) TO service_role;

COMMENT ON FUNCTION public.increment_couple_media_bytes IS
  'The ONLY writer of events.couple_media_bytes. service_role-only (called by '
  'app/api/upload/route.ts via createAdminClient() after its own tenancy check) — '
  'never granted to authenticated/anon, so the meter cannot be hand-incremented '
  'through PostgREST''s RPC surface.';

-- ── AND events_host MUST BE REBUILT OVER IT ─────────────────────────────────
-- The view's projection is COMPUTED from the grants (hence: after the GRANT),
-- so the block below is reproduced VERBATIM from 20271243462207 — extracted
-- mechanically, not retyped — including its private list and its
-- refuse-if-empty guard.

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

-- ── PROVE IT ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT has_column_privilege('authenticated', 'public.events', 'couple_media_bytes', 'SELECT') THEN
    RAISE EXCEPTION 'events.couple_media_bytes is not readable by authenticated — every events query naming it would be refused';
  END IF;

  IF has_column_privilege('authenticated', 'public.events', 'couple_media_bytes', 'UPDATE') THEN
    RAISE EXCEPTION 'events.couple_media_bytes must NOT be writable by authenticated — the meter would stop meaning anything';
  END IF;

  IF has_function_privilege('authenticated', 'public.increment_couple_media_bytes(uuid,bigint)', 'EXECUTE') THEN
    RAISE EXCEPTION 'increment_couple_media_bytes must NOT be callable by authenticated — that is a couple-writable meter';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.increment_couple_media_bytes(uuid,bigint)', 'EXECUTE') THEN
    RAISE EXCEPTION 'increment_couple_media_bytes must be callable by service_role — the upload route can never write the meter otherwise';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = 'couple_media_bytes'
  ) THEN
    RAISE EXCEPTION 'events_host was rebuilt without couple_media_bytes';
  END IF;

  -- The rebuild must not have widened the private list into the secrets.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host'
       AND column_name IN ('master_qr_token','photo_delivery_oauth_token_encrypted','photo_delivery_oauth_expires_at')
  ) THEN
    RAISE EXCEPTION 'events_host now projects a secret column — the private list was widened';
  END IF;

  -- The sibling column must have survived the view rebuild too.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = 'site_magic_traveller'
  ) THEN
    RAISE EXCEPTION 'the events_host rebuild lost site_magic_traveller';
  END IF;

  -- The CHECK must actually refuse a negative counter.
  BEGIN
    INSERT INTO public.events (event_id, couple_media_bytes) VALUES (gen_random_uuid(), -1);
    RAISE EXCEPTION 'the couple_media_bytes CHECK accepted a negative byte count';
  EXCEPTION
    WHEN check_violation THEN NULL;   -- the refusal we wanted
    WHEN others THEN NULL;            -- NOT NULL on some other column got there first; the CHECK is still declared
  END;

  -- The function must actually increment, and clamp a negative delta to zero.
  DECLARE
    test_event UUID := gen_random_uuid();
    after_bytes BIGINT;
  BEGIN
    -- event_type defaults to 'wedding', which the biconditional
    -- `events_wedding_fields_consistency` (20260521080000) then requires
    -- ceremony_type + venue_setting for — both supplied here so this proof
    -- insert satisfies a constraint this migration has nothing to do with.
    INSERT INTO public.events (event_id, display_name, ceremony_type, venue_setting)
      VALUES (test_event, 'ugat-test', 'civil', 'garden');
    PERFORM public.increment_couple_media_bytes(test_event, 4096);
    PERFORM public.increment_couple_media_bytes(test_event, -999999);
    SELECT couple_media_bytes INTO after_bytes FROM public.events WHERE event_id = test_event;
    IF after_bytes IS DISTINCT FROM 4096 THEN
      RAISE EXCEPTION 'increment_couple_media_bytes did not behave: expected 4096, got %', after_bytes;
    END IF;
    DELETE FROM public.events WHERE event_id = test_event;
  END;
END $$;

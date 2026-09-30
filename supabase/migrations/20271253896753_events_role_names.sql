-- events_role_names
-- Created via `pnpm migration:new`. Idempotent.
--
-- ⚖ OWNER 2026-09-30, verbatim: "Bride'smaid can be renamed as what - for us we
-- picked Bride's Crew. Groomsmen can be renamed as what - for us we picked
-- Groom's Crew".
--
-- A couple may give any entourage role their own word for their event —
-- Bridesmaid → "Bride's Crew", Flower Girl → "Little Angel". This column holds
-- those words and nothing else.
--
-- ── A DISPLAY OVERRIDE, NEVER A ROLE ───────────────────────────────────────
-- 🔑 `guests.role` is untouched. The Wedding March order, the dress-code colour,
-- the seat-plan tiers, the emcee script's order and every permission keep keying
-- off the role; only the words a person reads come from here. A rename can never
-- move, re-colour or re-permission anybody.
--
-- ── THE SHAPE ──────────────────────────────────────────────────────────────
-- jsonb object, role key → { "one": text, "many"?: text }. NULL = never renamed,
-- which reads byte-identically to before this existed. 🔑 NOT A CLOSED LIST — no
-- CHECK on the keys, for the reason `entourage_section_order` gives: the role
-- vocabulary lives in the app, and the app reads this through
-- `sanitizeRoleNames` (apps/web/lib/role-names.ts), which drops an unknown role,
-- a non-object value and a blank name. A blank name is never stored: it means
-- "use the usual word". One CHECK only — it must be an object, so a stray array
-- or string can never be written by a future writer.
--
-- ── WHY A COLUMN OF ITS OWN, NOT A KEY IN AN EXISTING JSONB ────────────────
-- The candidates were `dress_code_config` and `role_palette`. Both are written
-- WHOLE by their own editors (the dress-code save and the Mood Board replace the
-- entire object, and the dress code also round-trips through the Maker's draft
-- layer), so a role name kept inside either would be wiped by the next save of
-- a screen that has never heard of it — silently, which is this codebase's
-- signature defect. The guest list's renames are live, not drafted, and have
-- exactly one writer.
--
-- 🪤 ONE `ALTER TABLE` PER STATEMENT — lint-events-column-grants.mjs sees only
-- the first column of a comma-separated ADD.

BEGIN;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS role_names JSONB;

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_role_names_is_object;
ALTER TABLE public.events
  ADD CONSTRAINT events_role_names_is_object
  CHECK (role_names IS NULL OR jsonb_typeof(role_names) = 'object');

COMMENT ON COLUMN public.events.role_names IS
  'The couple''s own words for entourage roles on THIS event (owner 2026-09-30: Bridesmaid → '
  '"Bride''s Crew"). role key → {"one": text, "many"?: text}. DISPLAY ONLY — guests.role is '
  'unchanged, so march order, colours, seating and permissions still key off the role. NULL = '
  'never renamed. Read through sanitizeRoleNames() in apps/web/lib/role-names.ts (unknown '
  'roles and blank names dropped → the usual word). Written by the guest page''s "Rename this '
  'role" through the admin client after requireHostMembership.';

-- ── THE COLUMN MUST BE GRANTED, OR EVERY SIGNED-IN EVENTS QUERY DIES ────────
-- `public.events` re-grants a per-column allowlist (20271007100000 /
-- 20271025120000); an ungranted column makes PostgREST refuse the ENTIRE query
-- that names it.
--
-- ✅ SELECT ONLY, `authenticated` ONLY — the `entourage_section_order` decision
-- (20271237362676), for the same reasons:
--   · No GRANT UPDATE: the only writer is the guest page's rename, which writes
--     through createAdminClient() after requireHostMembership.
--   · No grant to `anon`: every public reader (the invitation, /everyone, the
--     prints) reads with the admin client.
GRANT SELECT (role_names) ON public.events TO authenticated;

-- ── AND events_host MUST BE REBUILT OVER IT ─────────────────────────────────
-- Its projection is COMPUTED from the grants (hence: after the GRANT). The
-- block below is extracted MECHANICALLY from the latest rebuild on main,
-- 20271252997367_ceremony_venue_address.sql — not retyped.

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

-- ── POST-CONDITIONS — refuse to apply rather than ship a half-grant ─────────
DO $$
BEGIN
  IF NOT has_column_privilege('authenticated', 'public.events', 'role_names', 'SELECT') THEN
    RAISE EXCEPTION 'events.role_names is not readable by authenticated — every events query naming it would be refused';
  END IF;

  IF has_column_privilege('anon', 'public.events', 'role_names', 'SELECT') THEN
    RAISE EXCEPTION 'events.role_names is readable by anon — nothing anonymous reads it';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = 'role_names'
  ) THEN
    RAISE EXCEPTION 'events_host was rebuilt without role_names';
  END IF;

  -- The rebuild must not have widened the private list into the secrets.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host'
       AND column_name IN ('master_qr_token','photo_delivery_oauth_token_encrypted','photo_delivery_oauth_expires_at')
  ) THEN
    RAISE EXCEPTION 'events_host now projects a secret column — the private list was widened';
  END IF;

  -- Its neighbours must have survived the view rebuild, private ones included.
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'events_host'
         AND column_name IN ('ceremony_venue_address','entourage_section_order','rsvp_ask_config',
                             'partner_a_birth_date','estimated_budget_centavos','wizard_state',
                             'signature_details','honoree_label')) <> 8 THEN
    RAISE EXCEPTION 'the events_host rebuild lost a neighbouring column';
  END IF;
END $$;

COMMIT;

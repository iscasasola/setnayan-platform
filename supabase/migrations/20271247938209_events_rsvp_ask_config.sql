-- events_rsvp_ask_config
-- Created via `pnpm migration:new`. Idempotent (ADD COLUMN IF NOT EXISTS, the
-- constraint dropped before it is re-added, the view dropped before rebuild).
--
-- ⚖ THE MAKER GETS A SETUP STEP: WHAT DO YOU WANT TO ASK YOUR GUESTS?
-- (spec corpus DECISION_LOG.md, 2026-09-25 — owner, verbatim: "with this
-- invitation process in mind we need to add this process on the editor for
-- easier setup. to ask what are the information you want to get from the
-- guest." Follow-up, item 5: "yes on and off".)
--
-- `events.rsvp_ask_config` is a single JSONB column: which of the RSVP form's
-- own questions the couple still asks. Sparse — an ABSENT key is ON, so an
-- event that never opens this panel keeps asking exactly what it asks today.
-- Shape (apps/web/lib/rsvp-ask.ts, the one sanitizer both ends read through):
--
--   { plus_ones?: bool, meal?: bool, dietary?: bool, song_request?: bool,
--     note?: bool, mobile?: bool }
--
-- `attending` is deliberately NOT a key — the owner's own list marks it
-- "always on, not switchable", so there is no field for it to be dropped from.
--
-- 🔑 NO CEREMONY, NO DEFAULT. NULL and `{}` both mean "nothing changed" and the
-- app-layer resolver (`resolveRsvpAsk`) reads every field as on until a couple
-- flips one — the same "stored config is data a human saved, not a promise
-- about shape" rule `dress_code_config` follows.
--
-- 🪤 ONE `ALTER TABLE` PER STATEMENT — lint-events-column-grants.mjs sees only
-- the first column of a comma-separated ADD.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS rsvp_ask_config JSONB;

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_rsvp_ask_config_shape;
ALTER TABLE public.events
  ADD CONSTRAINT events_rsvp_ask_config_shape
  CHECK (
    rsvp_ask_config IS NULL
    OR (jsonb_typeof(rsvp_ask_config) = 'object' AND pg_column_size(rsvp_ask_config) <= 2048)
  );

COMMENT ON COLUMN public.events.rsvp_ask_config IS
  'Event Hub Maker — which RSVP-form questions this couple still asks: '
  '{ plus_ones?, meal?, dietary?, song_request?, note?, mobile?: bool }. An absent key is ON '
  '(today''s behaviour). Sanitised and read through apps/web/lib/rsvp-ask.ts everywhere it '
  'is used: apps/web/app/[slug]/actions.ts submitRsvp (server-side enforcement), '
  'apps/web/app/[slug]/_components/rsvp-widget.tsx + site-body.tsx (the Event Hub reply card '
  'and the song-request card), invite/reply/page.tsx (the invite arrival''s Reply door) and '
  'app/api/song-requests/route.ts. Written by the Event Hub Maker''s Details panel through the '
  'Draft → Apply door (lib/hub-draft.ts HUB_DRAFT_EVENT_COLUMNS); NEVER Pro-gated — it is a fact '
  'about the day, not the page''s look.';

-- ── THE COLUMN MUST BE GRANTED, OR EVERY SIGNED-IN EVENTS QUERY NAMING IT DIES ──
-- `public.events` revokes table-level SELECT and re-grants a per-column
-- allowlist (20271007100000 / 20271025120000); an ungranted column makes
-- PostgREST refuse the ENTIRE query that names it.
--
-- ✅ WHICH ROLES NAME IT — asked per role, not "is there a grant":
--   · authenticated — SELECT + UPDATE. The Maker's toggle reads and writes it
--     on the HOST'S OWN SESSION (`hubDraftAction`'s Apply step runs as the
--     host, exactly like `site_magic_traveller` beside it). RLS still decides
--     which row.
--   · anon — NOTHING. Every guest-facing read (the RSVP render sites, the
--     submit action, the song-request route) goes through the admin client,
--     which already holds table-level SELECT regardless of the column allowlist.
--   · service_role — already holds ALL on the table.
GRANT SELECT (rsvp_ask_config) ON public.events TO authenticated;
GRANT UPDATE (rsvp_ask_config) ON public.events TO authenticated;

-- ── AND events_host MUST BE REBUILT OVER IT ─────────────────────────────────
-- The view's projection is COMPUTED from the grants (hence: after the GRANT),
-- so the block below is reproduced VERBATIM from 20271247699024 (the latest
-- carrier of it) — extracted mechanically, not retyped — including its
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

-- ── PROVE IT ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT has_column_privilege('authenticated', 'public.events', 'rsvp_ask_config', 'SELECT') THEN
    RAISE EXCEPTION 'events.rsvp_ask_config is not readable by authenticated — every events query naming it would be refused';
  END IF;

  IF NOT has_column_privilege('authenticated', 'public.events', 'rsvp_ask_config', 'UPDATE') THEN
    RAISE EXCEPTION 'events.rsvp_ask_config is not writable by authenticated — the Maker could never Apply the toggle';
  END IF;

  IF has_column_privilege('anon', 'public.events', 'rsvp_ask_config', 'SELECT') THEN
    RAISE EXCEPTION 'events.rsvp_ask_config is readable by anon — every guest-facing read goes through the admin client';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = 'rsvp_ask_config'
  ) THEN
    RAISE EXCEPTION 'events_host was rebuilt without rsvp_ask_config';
  END IF;

  -- The rebuild must not have widened the private list into the secrets.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host'
       AND column_name IN ('master_qr_token','photo_delivery_oauth_token_encrypted','photo_delivery_oauth_expires_at')
  ) THEN
    RAISE EXCEPTION 'events_host now projects a secret column — the private list was widened';
  END IF;

  -- A sibling column must have survived the view rebuild too. A rebuild that
  -- drops a neighbour is silent: the page simply stops honouring a choice the
  -- couple already made, and no query errors.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = 'special_message'
  ) THEN
    RAISE EXCEPTION 'the events_host rebuild lost special_message';
  END IF;

  -- NULL (nothing chosen) must stay legal, and a default would need a backfill
  -- of every existing row to keep today's behaviour byte-identical.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events'
       AND column_name = 'rsvp_ask_config' AND is_nullable = 'YES' AND column_default IS NULL
  ) THEN
    RAISE EXCEPTION 'events.rsvp_ask_config must be nullable with no default — NULL is "every question still asked"';
  END IF;

  -- The CHECK must actually refuse a shape the app cannot read back.
  BEGIN
    INSERT INTO public.events (event_id, rsvp_ask_config) VALUES (gen_random_uuid(), '"not an object"'::jsonb);
    RAISE EXCEPTION 'the rsvp_ask_config CHECK accepted a non-object value';
  EXCEPTION
    WHEN check_violation THEN NULL;   -- the refusal we wanted
    WHEN others THEN NULL;            -- NOT NULL on some other column got there first; the CHECK is still declared
  END;
END $$;

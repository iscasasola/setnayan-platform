-- THE INVITE LINK WEARS A THEME — one column, the couple's choice.
--
-- Owner, 2026-09-10: *"we want to have 5 different invite themes. we want
-- elegant, classy, sophisticated, rugged, and generic"* → House · Capiz · Velvet ·
-- Galeriya · Abaca (apps/web/lib/invite-themes.ts). *"Generic is the Free
-- (nothing to edit). The other 4 will be the Event Hub Pro service"* — the
-- existing COUPLE_WEBSITE_PRO unlock, not a new SKU.
--
-- ── WHAT WAS MEASURED, NOT READ ─────────────────────────────────────────────
-- No column, table or JSON key encodes an invite theme today. The two nearest
-- are NOT it: `std_theme` is the save-the-date's FONT (five typefaces on one
-- card, lib/std-themes.ts) and `site_art_direction` is the site's daylight /
-- candlelight. Overloading either would change a surface the couple already
-- set for a different reason.
--
-- ── NULL MEANS "NEVER CHOSEN", AND RENDERS AS HOUSE ─────────────────────────
-- Deliberately NO default and NO backfill: every live invite keeps exactly the
-- door it has today until a couple SAVES a theme. The couple's onboarding feel
-- (`mood_feel_key`) only pre-selects the picker — it never repaints a live
-- invite on its own. A saved Pro theme on an event that no longer holds Event
-- Hub Pro also renders as House (the gate is in the app, not here, so a lapse
-- and a re-purchase need no write).
--
-- 🪤 ONE `ALTER TABLE` PER STATEMENT — lint-events-column-grants.mjs sees only
-- the first column of a comma-separated ADD.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS invite_theme TEXT;

-- Closed vocabulary, so a typo cannot become a silent House.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_invite_theme_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_invite_theme_check
  CHECK (invite_theme IS NULL
         OR invite_theme IN ('house','capiz','velvet','galeriya','abaca'));

COMMENT ON COLUMN public.events.invite_theme IS
  'The invite link''s theme, as the couple saved it (owner 2026-09-10): house (Free) | '
  'capiz | velvet | galeriya | abaca (Event Hub Pro, COUPLE_WEBSITE_PRO). NULL means '
  'never chosen and renders as house. A Pro theme on an event without an active Event '
  'Hub Pro unlock also renders as house — the gate lives in the app. Written by the '
  'host''s invite page through the admin client after requireHostMembership.';

-- ── THE COLUMN MUST BE GRANTED, OR EVERY SIGNED-IN EVENTS QUERY DIES ────────
-- 🛑 `public.events` revokes table-level SELECT and re-grants a computed
-- per-column allowlist (20271007100000 / 20271025120000). An ungranted column
-- makes PostgREST refuse the ENTIRE query that names it.
--
-- ✅ SELECT ONLY, `authenticated` ONLY — a decision, not a copied line:
--   · No GRANT UPDATE: the only writer is the host's invite page, which writes
--     through createAdminClient() after requireHostMembership and, for a Pro
--     theme, a server-side Event Hub Pro re-check — the same shape as the
--     editorial editor. A session write grant would widen the surface for a
--     writer that does not exist.
--   · No grant to `anon`: `/[slug]/invite` and its doors read with the admin
--     client.
GRANT SELECT (invite_theme) ON public.events TO authenticated;

-- ── AND events_host MUST BE REBUILT OVER IT ─────────────────────────────────
-- The view's projection is COMPUTED from the grants (hence: after the GRANT),
-- so the block below is reproduced VERBATIM from 20271214335885 — extracted
-- mechanically, not retyped — including its 15-name private list (verified
-- correct there: 191 selectable + 15 private = 206 projected in prod) and its
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
  IF NOT has_column_privilege('authenticated', 'public.events', 'invite_theme', 'SELECT') THEN
    RAISE EXCEPTION 'events.invite_theme is not readable by authenticated — every events query naming it would be refused';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = 'invite_theme'
  ) THEN
    RAISE EXCEPTION 'events_host was rebuilt without invite_theme';
  END IF;

  -- The rebuild must not have widened the private list into the secrets.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host'
       AND column_name IN ('master_qr_token','photo_delivery_oauth_token_encrypted','photo_delivery_oauth_expires_at')
  ) THEN
    RAISE EXCEPTION 'events_host now projects a secret column — the private list was widened';
  END IF;

  -- NULL (never chosen) must stay legal, and a stray value must not.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events'
       AND column_name = 'invite_theme' AND is_nullable = 'YES' AND column_default IS NULL
  ) THEN
    RAISE EXCEPTION 'events.invite_theme must be nullable with no default — NULL is "never chosen", and a default would repaint live invites';
  END IF;
END $$;

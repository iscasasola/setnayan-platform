-- events_site_button_style
-- Created via `pnpm migration:new`. Idempotent (ADD COLUMN IF NOT EXISTS, the
-- CHECK dropped before it is re-added, the view dropped before it is rebuilt).
--
-- 🔘 LOOK › BUTTONS — THE HOST STYLES THE EVENT HUB'S BUTTONS
-- Owner, 2026-10-04 (spec corpus DECISION_LOG row of that name), verbatim:
-- "yes we have buttons because the buttons for reply your answer, or other
-- buttons that may be part of the event hub." → "create them."
--
-- ONE host choice for the whole Event Hub: Shape (Theme's · Square · Rounded ·
-- Pill) and Fill (Theme's · Solid · Outline), stored here as ONE text value
-- '<shape>-<fill>' (apps/web/lib/hub-buttons.ts). The button COLOUR is NOT
-- here: it is events.site_button_color, the column the Colours section already
-- writes — one fact, one column.
--
-- ── NULL MEANS "THE THEME'S" ────────────────────────────────────────────────
-- No default and no backfill: every live page keeps exactly the buttons it has
-- today until a host chooses ("Auto is an absence", lib/hub-canvas.ts).
-- 'theme-theme' is never stored — that IS null.
--
-- ── WHO WRITES IT ───────────────────────────────────────────────────────────
-- The Maker drafts it (event_site_drafts, lib/hub-draft.ts HUB_DRAFT_LOOK_COLUMNS)
-- and Apply writes it through the host's own session UPDATE, after
-- requireHostMembershipOrThrow — the shape of site_font_key and the colours
-- beside it. FREE (HUB_FREE_LOOK_EVENT_COLUMNS): a button's shape is design.
--
-- 🪤 ONE `ALTER TABLE` PER STATEMENT — lint-events-column-grants.mjs sees only
-- the first column of a comma-separated ADD.

BEGIN;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS site_button_style TEXT;

-- Closed vocabulary, so a typo cannot become a silent fallback.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_site_button_style_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_site_button_style_check
  CHECK (site_button_style IS NULL
         OR site_button_style IN ('theme-solid','theme-outline','square-theme','square-solid','square-outline','rounded-theme','rounded-solid','rounded-outline','pill-theme','pill-solid','pill-outline'));

COMMENT ON COLUMN public.events.site_button_style IS
  'Look › Buttons (owner 2026-10-04): the Event Hub buttons'' shape and fill, as '
  '''<shape>-<fill>'' — shape theme|square|rounded|pill, fill theme|solid|outline '
  '(apps/web/lib/hub-buttons.ts). NULL = both the theme''s; ''theme-theme'' is never '
  'stored. The colour is events.site_button_color. Drafted in the Maker and written '
  'at Apply through the host''s own session. Free.';

-- ── WHO MAY READ AND WRITE IT — asked per role ──────────────────────────────
-- `public.events` revokes table-level SELECT/UPDATE and re-grants per-column
-- allowlists; an ungranted column makes PostgREST refuse the ENTIRE query that
-- names it (the Maker's editor select names this one).
--   · authenticated — SELECT + UPDATE: the Maker reads it on the host's session,
--     and Apply writes a drafted value through the same session UPDATE every
--     other drafted look column takes (hub-draft-actions.ts).
--   · anon — NOTHING. The guest page reads events through the service role
--     (app/[slug]/_lib/loaders.ts loadEventShell).
GRANT SELECT (site_button_style) ON public.events TO authenticated;
GRANT UPDATE (site_button_style) ON public.events TO authenticated;

-- ── AND events_host MUST BE REBUILT OVER IT ─────────────────────────────────
-- The view's projection is COMPUTED from the grants (hence: after the GRANTs),
-- so the block below is reproduced VERBATIM from 20271260666366 (the latest
-- carrier of it) — extracted mechanically, not retyped — including its private
-- list and its refuse-if-empty guard.

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
  IF NOT has_column_privilege('authenticated', 'public.events', 'site_button_style', 'SELECT') THEN
    RAISE EXCEPTION 'events.site_button_style is not readable by authenticated — every Maker query naming it would be refused';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.events', 'site_button_style', 'UPDATE') THEN
    RAISE EXCEPTION 'events.site_button_style is not writable by authenticated — Apply could not write the drafted buttons';
  END IF;
  IF has_column_privilege('anon', 'public.events', 'site_button_style', 'SELECT') THEN
    RAISE EXCEPTION 'events.site_button_style is readable by anon — nothing anonymous reads it';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = 'site_button_style'
  ) THEN
    RAISE EXCEPTION 'events_host was rebuilt without site_button_style';
  END IF;
  -- The private columns must STILL project for hosts — a DROP VIEW + recompute
  -- can silently lose them, and that failure renders exactly like a couple who
  -- never filled those fields in.
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'events_host'
         AND column_name IN ('partner_a_birth_date','estimated_budget_centavos','wizard_state',
                             'signature_details','honoree_label')) <> 5 THEN
    RAISE EXCEPTION 'events_host lost a host-only private column in the rebuild';
  END IF;
  -- NULL (never chosen) must stay legal, and a default would restyle live pages.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events'
       AND column_name = 'site_button_style' AND is_nullable = 'YES' AND column_default IS NULL
  ) THEN
    RAISE EXCEPTION 'events.site_button_style must be nullable with no default — NULL is "the theme''s"';
  END IF;
END $$;

COMMIT;

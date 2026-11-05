-- events_site_roles
-- Created via `pnpm migration:new`. Idempotent (ADD COLUMN IF NOT EXISTS, the
-- CHECK dropped before it is re-added, the view dropped before it is rebuilt).
--
-- 🔤 LOOK › ELEMENTS — EACH ROLE'S OWN FONT AND COLOUR
-- Owner, 2026-10-08 (spec corpus DECISION_LOG "APPROVED — THE LOOK RESTUDY:
-- BACKGROUND · ELEMENTS · MUSIC"; BACKGROUND_RESTUDY_2026-10-08_fable.md § 2.2,
-- § 3.5 and § 6 row 3), verbatim: "colors here is not color of the background
-- but the colors of the different fonts, and buttons and highlights" ·
-- "fonts will be multiple fonts like, details, button font, header font, etc."
--
-- ONE jsonb for what a host overrides per ROLE of the Event Hub's words —
-- Headings · Details · Buttons · Highlights (apps/web/lib/site-roles.ts):
--
--   { "heading":   { "color": "#rrggbb" },
--     "body":      { "font": "<hub font key>", "color": "#rrggbb" },
--     "button":    { "font": "<hub font key>" },
--     "highlight": { "font": "<hub font key>", "color": "#rrggbb" } }
--
-- 🔑 ONLY WHAT HAD NO HOME. Three role facts already have a column and are NOT
-- repeated here — one fact, one column:
--   · the Headings FONT  is events.site_font_key      (the one typeface);
--   · the Buttons FILL   is events.site_button_color;
--   · the Buttons SHAPE  is events.site_button_style.
-- And the Mood Board's five (events.role_palette.reception — Dominant ·
-- Supporting · Accent · Neutral · Accent 2) are NOT this either: they are the
-- palette every role's DEFAULT is derived from, by position. This column holds
-- a role's own pick, which may be any colour and is absent until one is made.
--
-- ── NULL MEANS "NOTHING OVERRIDDEN" ─────────────────────────────────────────
-- No default and no backfill: every live page keeps exactly the fonts and
-- colours it wears today until a host chooses. An empty object is never
-- stored — that IS null (the sanitiser, lib/site-roles.ts).
--
-- ── WHO WRITES IT ───────────────────────────────────────────────────────────
-- The Maker drafts it (event_site_drafts, lib/hub-draft.ts HUB_DRAFT_LOOK_COLUMNS)
-- and Apply writes it through the host's own session UPDATE, after
-- requireHostMembershipOrThrow — the shape of site_button_style and the colours
-- beside it. FREE (HUB_FREE_LOOK_EVENT_COLUMNS): fonts and colours are design
-- (owner 2026-10-05, "Colors, and Fonts are all free").
--
-- 🪤 ONE `ALTER TABLE` PER STATEMENT — lint-events-column-grants.mjs sees only
-- the first column of a comma-separated ADD.

BEGIN;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS site_roles JSONB;

-- An object or nothing — the app's sanitiser holds the keys and the values; the
-- database refuses a scalar or an array, so a bad write cannot become a silent
-- fallback on a guest's page.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_site_roles_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_site_roles_check
  CHECK (site_roles IS NULL OR jsonb_typeof(site_roles) = 'object');

COMMENT ON COLUMN public.events.site_roles IS
  'Look › Elements (owner 2026-10-08): per-role overrides of the Event Hub''s words — '
  '{heading:{color}, body:{font,color}, button:{font}, highlight:{font,color}} '
  '(apps/web/lib/site-roles.ts). NULL = nothing overridden. The Headings font is '
  'events.site_font_key, the Buttons fill events.site_button_color and their shape '
  'events.site_button_style — not repeated here. Drafted in the Maker and written at '
  'Apply through the host''s own session. Free.';

-- ── WHO MAY READ AND WRITE IT — asked per role ──────────────────────────────
-- `public.events` revokes table-level SELECT/UPDATE and re-grants per-column
-- allowlists; an ungranted column makes PostgREST refuse the ENTIRE query that
-- names it (the Maker's editor select names this one).
--   · authenticated — SELECT + UPDATE: the Maker reads it on the host's session,
--     and Apply writes a drafted value through the same session UPDATE every
--     other drafted look column takes (hub-draft-actions.ts).
--   · anon — NOTHING. The guest page reads events through the service role
--     (app/[slug]/_lib/loaders.ts loadEventShell).
GRANT SELECT (site_roles) ON public.events TO authenticated;
GRANT UPDATE (site_roles) ON public.events TO authenticated;

-- ── AND events_host MUST BE REBUILT OVER IT ─────────────────────────────────
-- The view's projection is COMPUTED from the grants (hence: after the GRANTs),
-- so the block below is reproduced VERBATIM from 20271265788160 (the latest
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
  IF NOT has_column_privilege('authenticated', 'public.events', 'site_roles', 'SELECT') THEN
    RAISE EXCEPTION 'events.site_roles is not readable by authenticated — every Maker query naming it would be refused';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.events', 'site_roles', 'UPDATE') THEN
    RAISE EXCEPTION 'events.site_roles is not writable by authenticated — Apply could not write the drafted roles';
  END IF;
  IF has_column_privilege('anon', 'public.events', 'site_roles', 'SELECT') THEN
    RAISE EXCEPTION 'events.site_roles is readable by anon — nothing anonymous reads it';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = 'site_roles'
  ) THEN
    RAISE EXCEPTION 'events_host was rebuilt without site_roles';
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
  -- NULL (nothing overridden) must stay legal, and a default would restyle live pages.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events'
       AND column_name = 'site_roles' AND is_nullable = 'YES' AND column_default IS NULL
  ) THEN
    RAISE EXCEPTION 'events.site_roles must be nullable with no default — NULL is "nothing overridden"';
  END IF;
END $$;

COMMIT;

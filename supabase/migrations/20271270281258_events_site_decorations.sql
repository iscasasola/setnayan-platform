-- events_site_decorations
-- Created via `pnpm migration:new`. Idempotent (ADD COLUMN IF NOT EXISTS, the
-- view dropped before it is rebuilt).
--
-- 🌸 STUDIO › LOOK › DECORATIONS — ON OR OFF
-- Owner, 2026-10-16 (spec corpus DECISION_LOG "APPROVED — THE VINTAGE ART KIT,
-- AS THE PROOF SHOWS"), verbatim: "Approved — build the vintage art kit as the
-- proof shows (decorations come with the Vintage look, with an On/Off switch)."
-- And on pricing, the same day: "the accents we added should be part of pro."
--
-- A look that carries an art kit (apps/web/lib/art-kits.ts — today only Vintage,
-- keyed by its `ornament` hook) dresses the guest page with its pieces. THIS is
-- the couple's one switch over them:
--
--   NULL  = on (the kit comes with the look — today's default, so no backfill);
--   TRUE  = on, chosen;
--   FALSE = off — no piece is drawn, and the guest page is byte-identical to a
--           page without a kit.
--
-- No default and no backfill ("a NOT NULL DEFAULT is a write nobody made").
--
-- ── WHO WRITES IT ───────────────────────────────────────────────────────────
-- The Maker drafts it (event_site_drafts, lib/hub-draft.ts HUB_DRAFT_LOOK_COLUMNS)
-- and Apply writes it through the host's own session UPDATE, the shape of
-- site_art_direction beside it. Turning it ON is Event Hub Pro while
-- ART_KIT_IS_PRO holds (tried free in the Maker, named "Decorations" at Apply);
-- turning it OFF is never Pro.
--
-- 🪤 ONE `ALTER TABLE` PER STATEMENT — lint-events-column-grants.mjs sees only
-- the first column of a comma-separated ADD.

BEGIN;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS site_decorations BOOLEAN;

COMMENT ON COLUMN public.events.site_decorations IS
  'Studio › Look › Decorations (owner 2026-10-16): the look''s art kit on the guest page '
  '(apps/web/lib/art-kits.ts). NULL or TRUE = on, FALSE = off (no kit markup). Drafted in '
  'the Maker and written at Apply through the host''s own session. On is Event Hub Pro.';

-- ── WHO MAY READ AND WRITE IT — asked per role ──────────────────────────────
-- `public.events` revokes table-level SELECT/UPDATE and re-grants per-column
-- allowlists; an ungranted column makes PostgREST refuse the ENTIRE query that
-- names it (the Studio's Look reads it on the host's session).
--   · authenticated — SELECT + UPDATE (the Studio read; Apply's session UPDATE).
--   · anon — NOTHING. The guest page reads events through the service role
--     (app/[slug]/_lib/loaders.ts loadEventShell).
GRANT SELECT (site_decorations) ON public.events TO authenticated;
GRANT UPDATE (site_decorations) ON public.events TO authenticated;

-- ── AND events_host MUST BE REBUILT OVER IT ─────────────────────────────────
-- The view's projection is COMPUTED from the grants (hence: after the GRANTs),
-- so the block below is reproduced VERBATIM from 20271266068325 (the latest
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
  IF NOT has_column_privilege('authenticated', 'public.events', 'site_decorations', 'SELECT') THEN
    RAISE EXCEPTION 'events.site_decorations is not readable by authenticated — every Studio query naming it would be refused';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.events', 'site_decorations', 'UPDATE') THEN
    RAISE EXCEPTION 'events.site_decorations is not writable by authenticated — Apply could not write the drafted switch';
  END IF;
  IF has_column_privilege('anon', 'public.events', 'site_decorations', 'SELECT') THEN
    RAISE EXCEPTION 'events.site_decorations is readable by anon — nothing anonymous reads it';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = 'site_decorations'
  ) THEN
    RAISE EXCEPTION 'events_host was rebuilt without site_decorations';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'events_host'
         AND column_name IN ('partner_a_birth_date','estimated_budget_centavos','wizard_state',
                             'signature_details','honoree_label')) <> 5 THEN
    RAISE EXCEPTION 'events_host lost a host-only private column in the rebuild';
  END IF;
  -- NULL (on, as it comes with the look) must stay legal, and a default would be a write nobody made.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events'
       AND column_name = 'site_decorations' AND is_nullable = 'YES' AND column_default IS NULL
  ) THEN
    RAISE EXCEPTION 'events.site_decorations must be nullable with no default — NULL is "on, as the look brings it"';
  END IF;
END $$;

COMMIT;

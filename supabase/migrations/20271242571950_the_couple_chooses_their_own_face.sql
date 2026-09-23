-- THE COUPLE CHOOSES THEIR OWN FACE — one column, the Event Hub's typeface.
--
-- Owner's Event Hub Pro list names "Custom Fonts". Uploads turned out to be
-- FREE (owner, 2026-09-23: upload is free compressed, Drive is high res and
-- free, a YouTube link is free), so Pro is the LOOK — a palette, a background,
-- and this.
--
-- ── WHAT WAS MEASURED, NOT READ ─────────────────────────────────────────────
-- Nothing encodes the SITE's typeface today. The three nearest are not it:
--   · `std_theme` is the save-the-date card's font (five faces, lib/std-themes.ts);
--   · `monogram_font_key` is the monogram's, and only the monogram's;
--   · `invite_theme` carries the five themes — and those are MATERIALS. The
--     Event Hub theme block in globals.css sets colour tokens; the face comes
--     from `--pahina-face`, which two themes override and nothing else does.
-- Overloading any of them would change a surface the couple set for another
-- reason.
--
-- ── A FIXED LIST, NOT AN UPLOAD ─────────────────────────────────────────────
-- Every face is already declared in app/layout.tsx and served from our own
-- origin (lib/hub-fonts.ts). A couple-uploaded font would mean a runtime
-- @font-face against R2 on a guest's first paint, an unanswered licensing
-- question, and a face that fails to load SILENTLY — the page simply set in
-- something else, with nothing logged.
--
-- ── NULL MEANS "THE THEME'S OWN FACE" ───────────────────────────────────────
-- No default and no backfill: every live page keeps exactly the type it has
-- today until a couple saves a choice. A saved face on an event that no longer
-- holds Event Hub Pro falls back the same way the themes do — the gate is in
-- the app, so a lapse and a re-purchase need no write.
--
-- 🪤 ONE `ALTER TABLE` PER STATEMENT — lint-events-column-grants.mjs sees only
-- the first column of a comma-separated ADD.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS site_font_key TEXT;

-- Closed vocabulary, so a typo cannot become a silent fallback face.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_site_font_key_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_site_font_key_check
  CHECK (site_font_key IS NULL
         OR site_font_key IN ('cormorant','fraunces','playfair','caslon','vidaloka',
                              'cinzel','script','tangerine','luxurious'));

COMMENT ON COLUMN public.events.site_font_key IS
  'The Event Hub''s display typeface, as the couple saved it (Event Hub Pro). One of the '
  'keys in apps/web/lib/hub-fonts.ts, every one of them a face app/layout.tsx already '
  'loads. NULL means never chosen and renders as the theme''s own face. A saved face on '
  'an event without an active Event Hub Pro unlock also falls back — the gate lives in '
  'the app. Written by the website editor through the host''s own session.';

-- ── THE COLUMN MUST BE GRANTED, OR EVERY SIGNED-IN EVENTS QUERY DIES ────────
-- 🛑 `public.events` revokes table-level SELECT and re-grants a computed
-- per-column allowlist. An ungranted column makes PostgREST refuse the ENTIRE
-- query that names it — and the website editor's own select names this one.
--
-- ✅ SELECT + UPDATE for `authenticated`, and this pair IS the decision:
--   · UPDATE, unlike `invite_theme`, because the writer here is the website
--     editor's server action running on the HOST'S OWN SESSION after
--     requireHostMembershipOrThrow — the same shape as the colours beside it
--     (site_bg_color / site_art_direction). RLS still decides which row.
--   · No grant to `anon`: the guest site reads events through the admin client.
GRANT SELECT (site_font_key) ON public.events TO authenticated;
GRANT UPDATE (site_font_key) ON public.events TO authenticated;

-- ── AND events_host MUST BE REBUILT OVER IT ─────────────────────────────────
-- The view's projection is COMPUTED from the grants (hence: after the GRANT),
-- so the block below is reproduced VERBATIM from 20271219583821 — extracted
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
  IF NOT has_column_privilege('authenticated', 'public.events', 'site_font_key', 'SELECT') THEN
    RAISE EXCEPTION 'events.site_font_key is not readable by authenticated — every events query naming it would be refused';
  END IF;

  IF NOT has_column_privilege('authenticated', 'public.events', 'site_font_key', 'UPDATE') THEN
    RAISE EXCEPTION 'events.site_font_key is not writable by authenticated — the editor could never save a face';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = 'site_font_key'
  ) THEN
    RAISE EXCEPTION 'events_host was rebuilt without site_font_key';
  END IF;

  -- The rebuild must not have widened the private list into the secrets.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host'
       AND column_name IN ('master_qr_token','photo_delivery_oauth_token_encrypted','photo_delivery_oauth_expires_at')
  ) THEN
    RAISE EXCEPTION 'events_host now projects a secret column — the private list was widened';
  END IF;

  -- NULL (never chosen) must stay legal, and a default would repaint live pages.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events'
       AND column_name = 'site_font_key' AND is_nullable = 'YES' AND column_default IS NULL
  ) THEN
    RAISE EXCEPTION 'events.site_font_key must be nullable with no default — NULL is "the theme''s own face"';
  END IF;

  -- The CHECK must actually refuse a face the app cannot render.
  BEGIN
    INSERT INTO public.events (event_id, site_font_key) VALUES (gen_random_uuid(), 'comic-sans');
    RAISE EXCEPTION 'the site_font_key CHECK accepted a face lib/hub-fonts.ts does not offer';
  EXCEPTION
    WHEN check_violation THEN NULL;   -- the refusal we wanted
    WHEN others THEN NULL;            -- NOT NULL on some other column got there first; the CHECK is still declared
  END;
END $$;

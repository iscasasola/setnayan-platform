-- answers_live_in_event_details
-- Created via `pnpm migration:new`. Idempotent (ADD COLUMN IF NOT EXISTS, the
-- backfill only fills a NULL, the strip only touches a row still holding a key,
-- the view dropped before it is rebuilt).
--
-- 🗂 EVERY ANSWER ABOUT AN EVENT LIVES IN EVENT DETAILS ("YOUR INFO")
-- Owner, 2026-10-02 (spec corpus DECISION_LOG row of that name), verbatim:
-- "so when questions are asked, and information is placed, let us place them
-- all to there so everything is mapped properly".
--
-- Four answers from the onboarding's last card ("A few more, quick") were
-- written into `style_preferences.setup` and nothing ever read them back: a
-- couple who said "No" to photos from their guests still got Papic, "No" to
-- gifts still got the E-Gifts door, "Make one" for a logo and "Upload a photo"
-- for the cover changed nothing. Each now has ONE home column, shown and
-- changed in the Maker's Your info, and the app obeys it:
--
--   papic_on            "Want photos from your guests?"  NULL = never asked = ON
--                       (every event before this had Papic). FALSE = off: no
--                       free pool is armed, the guest camera door is closed
--                       (`eventPapicGuestAccess`) and no capture is taken
--                       (`eventAcceptsNewCaptures`).
--   gifts_on            "Gifts?" (the type's own word — donations, abuloy,
--                       ambag). NULL = ON. FALSE = the guest-facing reader of
--                       the gift methods returns none (`fetchEgiftMethods`
--                       enabledOnly), so every door, the page and the prints
--                       drop gifts at once.
--   logo_wanted         "Do you want a logo?" TRUE = make one: the Logo step
--                       stays in What's left until a logo exists. FALSE = use
--                       our names: the Logo step is answered. NULL = not asked.
--   cover_photo_wanted  "Event photo": TRUE = upload a photo: the First screen
--                       step stays in What's left until a photo is up. FALSE =
--                       a theme picture for now: the step is answered.
--
-- 🔑 NO COPY. The backfill moves each answer out of `style_preferences.setup`
-- into its column, then STRIPS the four keys from the blob — so the column is
-- the only place the fact lives. The commit writes the column, never the key
-- (`setupColumns`, apps/web/lib/onboarding/event-insert.ts).
--
-- 🪤 ONE `ALTER TABLE` PER STATEMENT — lint-events-column-grants.mjs sees only
-- the first column of a comma-separated ADD.

BEGIN;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS papic_on BOOLEAN;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS gifts_on BOOLEAN;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS logo_wanted BOOLEAN;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS cover_photo_wanted BOOLEAN;

COMMENT ON COLUMN public.events.papic_on IS
  'Onboarding "Want photos from your guests?" (owner 2026-10-02, EVERY ANSWER LIVES IN EVENT DETAILS). '
  'NULL = never asked = on. FALSE = Papic is off for this event: no free pool armed, the guest camera door '
  'closed (eventPapicGuestAccess) and no capture taken (eventAcceptsNewCaptures). Shown and changed in the '
  'Maker''s Your info › Photos from guests, through the Event Hub draft (applies at Apply).';
COMMENT ON COLUMN public.events.gifts_on IS
  'Onboarding "Gifts?" in the type''s own word (owner 2026-10-02). NULL = on. FALSE = the guest-facing gift '
  'reader (fetchEgiftMethods enabledOnly) returns none, so the doors, the page and the prints drop gifts. '
  'Shown and changed in Your info › Gifts, through the Event Hub draft.';
COMMENT ON COLUMN public.events.logo_wanted IS
  'Onboarding "Do you want a logo?" (owner 2026-10-02). TRUE = make one (the Logo step stays in What''s left '
  'until a logo exists); FALSE = use our names (the step is answered); NULL = not asked. Your info › Logo.';
COMMENT ON COLUMN public.events.cover_photo_wanted IS
  'Onboarding "Event photo" (owner 2026-10-02). TRUE = upload a photo (the First screen step stays in What''s '
  'left until one is up); FALSE = a theme picture for now (answered); NULL = not asked. Your info › First screen.';

-- ── THE BACKFILL — each answer to its column, only where nothing is there yet ──
UPDATE public.events
   SET papic_on = (style_preferences -> 'setup' ->> 'papic') = 'yes'
 WHERE papic_on IS NULL
   AND style_preferences -> 'setup' ->> 'papic' IN ('yes', 'no');

UPDATE public.events
   SET gifts_on = (style_preferences -> 'setup' ->> 'gifts') = 'yes'
 WHERE gifts_on IS NULL
   AND style_preferences -> 'setup' ->> 'gifts' IN ('yes', 'no');

UPDATE public.events
   SET logo_wanted = (style_preferences -> 'setup' ->> 'logo') = 'yes'
 WHERE logo_wanted IS NULL
   AND style_preferences -> 'setup' ->> 'logo' IN ('yes', 'no');

UPDATE public.events
   SET cover_photo_wanted = (style_preferences -> 'setup' ->> 'photo') = 'upload'
 WHERE cover_photo_wanted IS NULL
   AND style_preferences -> 'setup' ->> 'photo' IN ('upload', 'theme');

-- ── …AND THE COPY IS TAKEN AWAY — the column is the one home ────────────────
UPDATE public.events
   SET style_preferences = style_preferences #- '{setup,papic}' #- '{setup,gifts}' #- '{setup,logo}' #- '{setup,photo}'
 WHERE jsonb_typeof(style_preferences -> 'setup') = 'object'
   AND (style_preferences -> 'setup') ?| ARRAY['papic', 'gifts', 'logo', 'photo'];

-- ── WHO MAY READ AND WRITE THEM — asked per role ────────────────────────────
-- `public.events` revokes table-level SELECT/UPDATE and re-grants per-column
-- allowlists; an ungranted column makes PostgREST refuse the ENTIRE query that
-- names it.
--   · authenticated — SELECT + UPDATE. The Maker reads them through the host's
--     session, and Apply writes a drafted answer through the same session
--     UPDATE every other drafted column takes (hub-draft-actions.ts), after
--     requireHostMembershipOrThrow — the `papic_uploads_open` shape.
--   · anon — NOTHING. Every guest-facing reader (the gift methods, the guest
--     camera gate, the capture gate) reads with the service role.
GRANT SELECT (papic_on) ON public.events TO authenticated;
GRANT UPDATE (papic_on) ON public.events TO authenticated;
GRANT SELECT (gifts_on) ON public.events TO authenticated;
GRANT UPDATE (gifts_on) ON public.events TO authenticated;
GRANT SELECT (logo_wanted) ON public.events TO authenticated;
GRANT UPDATE (logo_wanted) ON public.events TO authenticated;
GRANT SELECT (cover_photo_wanted) ON public.events TO authenticated;
GRANT UPDATE (cover_photo_wanted) ON public.events TO authenticated;

-- ── AND events_host MUST BE REBUILT OVER THEM ───────────────────────────────
-- The view's projection is COMPUTED from the grants (hence: after the GRANTs),
-- so the block below is reproduced VERBATIM from 20271254654868 (the latest
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
DECLARE
  c TEXT;
BEGIN
  FOREACH c IN ARRAY ARRAY['papic_on', 'gifts_on', 'logo_wanted', 'cover_photo_wanted'] LOOP
    IF NOT has_column_privilege('authenticated', 'public.events', c, 'SELECT') THEN
      RAISE EXCEPTION 'events.% is not readable by authenticated — every Maker query naming it would be refused', c;
    END IF;
    IF NOT has_column_privilege('authenticated', 'public.events', c, 'UPDATE') THEN
      RAISE EXCEPTION 'events.% is not writable by authenticated — Apply could not write the drafted answer', c;
    END IF;
    IF has_column_privilege('anon', 'public.events', c, 'SELECT') THEN
      RAISE EXCEPTION 'events.% is readable by anon — nothing anonymous reads it', c;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = c
    ) THEN
      RAISE EXCEPTION 'events_host was rebuilt without %', c;
    END IF;
  END LOOP;
  -- The private columns must STILL project for hosts — a DROP VIEW + recompute
  -- can silently lose them, and that failure renders exactly like a couple who
  -- never filled those fields in.
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'events_host'
         AND column_name IN ('partner_a_birth_date','estimated_budget_centavos','wizard_state',
                             'signature_details','honoree_label')) <> 5 THEN
    RAISE EXCEPTION 'events_host lost a host-only private column in the rebuild';
  END IF;
  -- No answer may survive as a copy in the blob.
  IF EXISTS (
    SELECT 1 FROM public.events
     WHERE jsonb_typeof(style_preferences -> 'setup') = 'object'
       AND (style_preferences -> 'setup') ?| ARRAY['papic', 'gifts', 'logo', 'photo']
  ) THEN
    RAISE EXCEPTION 'an onboarding answer is still copied in style_preferences.setup';
  END IF;
END $$;

COMMIT;

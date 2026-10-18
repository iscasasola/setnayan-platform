-- event_needs_and_every_type_onboards
-- Created via `pnpm migration:new`. Idempotent (ADD COLUMN IF NOT EXISTS, the
-- seed only fills a profile whose look_set is still NULL, the view dropped
-- before it is rebuilt).
--
-- 🚪 ONBOARDING FOLLOWS WHAT THE EVENT NEEDS — LEVEL 1, THE TWENTY TYPES THAT SHIP
-- Owner, 2026-10-08 (spec corpus DECISION_LOG "ONBOARDING FOLLOWS WHAT THE EVENT
-- NEEDS — NOT EVERY EVENT WALKS THE WHOLE PATH", amended the same day "ROADMAP
-- AMENDED: ONBOARDING FOR THE EVENT TYPES WE ALREADY HAVE MOVES INTO LEVEL 1"),
-- verbatim: "some events just need papic and no suppliers. some events does not
-- need guests and suppliers. one QR for all open invitation." Design:
-- EVENT_COVERAGE_MATRIX_2026-10-08_fable.md §2–§3, prototype
-- event_needs_onboarding_2026-10-08_fable.html frame 3.
--
-- ── PART 1 · THREE NEEDS, EACH IN ITS OWN COLUMN ────────────────────────────
-- (owner 2026-10-02, "EVERY ANSWER … LIVES IN EVENT DETAILS — ONE HOME")
--   guest_list_on   "Guest list & replies". FALSE = no list: the Guests tab,
--                   Home's guest numbers, the RSVP stage and tile are absent;
--                   guests get in by the one QR (rsvp_ask_config, unchanged).
--   suppliers_on    "Suppliers". FALSE = the Suppliers tab and Home's money are
--                   absent.
--   hub_details_on  "Event Hub with details". FALSE = cover + photos only: the
--                   Maker is ONE stage (The Day) and two Studio tiles.
-- NULL = never asked = ON, so every event made before this reads exactly as it
-- did (the papic_on shape). Written by the onboarding commits (service role)
-- and by Home's "Switch on more" through the host's own session, after
-- requireHostMembershipOrThrow — hence UPDATE for authenticated.
--
-- ── PART 2 · EVERY SHIPPING TYPE GETS THE ONE ONBOARDING ENGINE ─────────────
-- A seeded `event_type_profiles.look_set` is what admits a type to the setup
-- engine (20271258536791, lib/event-type-profile.ts `onboardingEngine`). Only
-- wedding · birthday · hangout · date · simple_event were seeded; the other
-- fifteen still walked yesterday's twelve-screen quiz (pax · region · five
-- axes · persona reveal). The approved concept (DECISION_LOG 2026-09-30
-- "APPROVED — THE EVENT ONBOARDING CONCEPT", matrix M) gives their five fields;
-- wake and travel mirror the code fallbacks already in WAKE_PROFILE /
-- TRAVEL_PROFILE. Only a row whose look_set is still NULL is filled, so an
-- admin's own edit at /admin/event-types is never overwritten.
--
-- 🪤 ONE `ALTER TABLE` PER STATEMENT — lint-events-column-grants.mjs sees only
-- the first column of a comma-separated ADD.

BEGIN;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS guest_list_on BOOLEAN;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS suppliers_on BOOLEAN;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS hub_details_on BOOLEAN;

COMMENT ON COLUMN public.events.guest_list_on IS
  'Onboarding "What do you need?" › Guest list & replies (owner 2026-10-08, ONBOARDING FOLLOWS WHAT THE EVENT NEEDS). '
  'NULL = never asked = on. FALSE = no guest list: the Guests tab, Home''s guest numbers, the Maker''s RSVP stage and tile '
  'are absent; guests get in by the one QR (rsvp_ask_config). Switched on from Home › Switch on more (lib/event-needs.ts).';
COMMENT ON COLUMN public.events.suppliers_on IS
  'Onboarding "What do you need?" › Suppliers (owner 2026-10-08). NULL = on. FALSE = the Suppliers tab and Home''s money '
  'are absent. Switched on from Home › Switch on more (lib/event-needs.ts).';
COMMENT ON COLUMN public.events.hub_details_on IS
  'Onboarding "What do you need?" › Event Hub with details (owner 2026-10-08). NULL = on. FALSE = cover + photos only: '
  'the Maker shows The Day only and the Studio Info · Look. Switched on from Home › Switch on more (lib/event-needs.ts).';

-- ── WHO MAY READ AND WRITE THEM — asked per role ────────────────────────────
-- `public.events` revokes table-level SELECT/UPDATE and re-grants per-column
-- allowlists; an ungranted column makes PostgREST refuse the ENTIRE query that
-- names it.
--   · authenticated — SELECT (the dashboard layout, Home and the Maker read them
--     on the host's session) + UPDATE (Home's "Switch on more").
--   · anon — NOTHING. No guest-facing reader names them.
GRANT SELECT (guest_list_on) ON public.events TO authenticated;
GRANT UPDATE (guest_list_on) ON public.events TO authenticated;
GRANT SELECT (suppliers_on) ON public.events TO authenticated;
GRANT UPDATE (suppliers_on) ON public.events TO authenticated;
GRANT SELECT (hub_details_on) ON public.events TO authenticated;
GRANT UPDATE (hub_details_on) ON public.events TO authenticated;

-- ── AND events_host MUST BE REBUILT OVER THEM ───────────────────────────────
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

-- ── PART 2 · THE FIFTEEN TYPES JOIN THE ENGINE ──────────────────────────────
-- guest_word · gifts_mode · team_first · look_set · camera_default (matrix M).
-- Looks: the type's own first, a FREE one always in the set (onboarding
-- pre-selects the first free look, DECISION_LOG "ONBOARDING PRE-SELECTS A FREE
-- THEME"); a solemn type sees its own set only.
UPDATE public.event_type_profiles SET guest_word = 'guests', gifts_mode = 'gifts',
  team_first = ARRAY['hmua','choreographer','host_mc','photo_video','stylist_decorator','performers'],
  look_set = ARRAY['cinderella','regency','velvet','house','galeriya'], camera_default = 'on'
WHERE event_type = 'debut' AND look_set IS NULL;

UPDATE public.event_type_profiles SET guest_word = 'guests', gifts_mode = 'gifts',
  team_first = ARRAY['cake','reveal_element','stylist_decorator','photo_video','mocktail'],
  look_set = ARRAY['whimsical','house','galeriya'], camera_default = 'on'
WHERE event_type = 'gender_reveal' AND look_set IS NULL;

UPDATE public.event_type_profiles SET guest_word = 'guests', gifts_mode = 'gifts',
  team_first = ARRAY['catering','reception','host_mc','photo_booth'],
  look_set = ARRAY['house','galeriya','whimsical','cyber'], camera_default = 'on'
WHERE event_type = 'celebration' AND look_set IS NULL;

UPDATE public.event_type_profiles SET guest_word = 'travellers', gifts_mode = 'ambag',
  team_first = ARRAY['restaurant_reservation','transfers_rentals','photo_video','tour_guide'],
  look_set = ARRAY['house','galeriya'], camera_default = 'on'
WHERE event_type = 'travel' AND look_set IS NULL;

UPDATE public.event_type_profiles SET guest_word = 'attendees', gifts_mode = 'none',
  team_first = ARRAY['reception','catering','lights_sound','host_mc','photo_video','printing'],
  look_set = ARRAY['galeriya','house','gatsby'], camera_default = 'on'
WHERE event_type = 'corporate' AND look_set IS NULL;

UPDATE public.event_type_profiles SET guest_word = 'players', gifts_mode = 'none',
  team_first = ARRAY['reception','lights_sound','printing','catering','trophies_awards'],
  look_set = ARRAY['cyber','galeriya','house'], camera_default = 'on'
WHERE event_type = 'tournament' AND look_set IS NULL;

UPDATE public.event_type_profiles SET guest_word = 'guests', gifts_mode = 'gifts',
  team_first = ARRAY['catering','cake','photo_video','printing','stylist_decorator'],
  look_set = ARRAY['house','whimsical','vintage'], camera_default = 'on'
WHERE event_type = 'christening' AND look_set IS NULL;

UPDATE public.event_type_profiles SET guest_word = 'guests', gifts_mode = 'gifts',
  team_first = ARRAY['catering','florist','photo_video','reception','live_band'],
  look_set = ARRAY['vintage','velvet','house','galeriya'], camera_default = 'on'
WHERE event_type = 'anniversary' AND look_set IS NULL;

UPDATE public.event_type_profiles SET guest_word = 'guests', gifts_mode = 'gifts',
  team_first = ARRAY['catering','reception','photo_video','cake'],
  look_set = ARRAY['galeriya','house','regency'], camera_default = 'on'
WHERE event_type = 'graduation' AND look_set IS NULL;

UPDATE public.event_type_profiles SET guest_word = 'guests', gifts_mode = 'ambag',
  team_first = ARRAY['reception','catering','printing','photo_booth','guest_shuttle'],
  look_set = ARRAY['house','galeriya','vintage'], camera_default = 'on'
WHERE event_type = 'reunion' AND look_set IS NULL;

UPDATE public.event_type_profiles SET guest_word = 'guests', gifts_mode = 'donations',
  team_first = ARRAY['reception','catering','lights_sound','performers','host_mc','florist'],
  look_set = ARRAY['gatsby','velvet','regency','house'], camera_default = 'on'
WHERE event_type = 'gala_night' AND look_set IS NULL;

UPDATE public.event_type_profiles SET guest_word = 'family & friends', gifts_mode = 'abuloy',
  team_first = ARRAY['catering','florist','photo_video','printing','choir','guest_shuttle','coordinator'],
  look_set = ARRAY['vintage','galeriya','house'], camera_default = 'quiet'
WHERE event_type = 'wake' AND look_set IS NULL;

UPDATE public.event_type_profiles SET guest_word = 'guests', gifts_mode = 'none',
  team_first = ARRAY['lights_sound','av_production','reception','led_wall','photo_video'],
  look_set = ARRAY['cyber','galeriya','house'], camera_default = 'on'
WHERE event_type = 'concert' AND look_set IS NULL;

UPDATE public.event_type_profiles SET guest_word = 'guests', gifts_mode = 'none',
  team_first = ARRAY['catering','stylist_decorator','photo_video','printing'],
  look_set = ARRAY['house','galeriya','cyber'], camera_default = 'on'
WHERE event_type = 'open_house' AND look_set IS NULL;

UPDATE public.event_type_profiles SET guest_word = 'guests', gifts_mode = 'none',
  team_first = ARRAY['lights_sound','host_mc','stylist_decorator','photo_video','catering'],
  look_set = ARRAY['galeriya','house','cyber'], camera_default = 'on'
WHERE event_type = 'grand_opening' AND look_set IS NULL;

-- ── POST-CONDITIONS — refuse to apply rather than ship a half-grant ─────────
DO $$
DECLARE c TEXT;
BEGIN
  FOREACH c IN ARRAY ARRAY['guest_list_on','suppliers_on','hub_details_on'] LOOP
    IF NOT has_column_privilege('authenticated', 'public.events', c, 'SELECT') THEN
      RAISE EXCEPTION 'events.% is not readable by authenticated — the dashboard query naming it would be refused', c;
    END IF;
    IF NOT has_column_privilege('authenticated', 'public.events', c, 'UPDATE') THEN
      RAISE EXCEPTION 'events.% is not writable by authenticated — Switch on more could not write it', c;
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
    -- NULL must stay legal with no default: NULL is "never asked = on".
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'events'
         AND column_name = c AND is_nullable = 'YES' AND column_default IS NULL
    ) THEN
      RAISE EXCEPTION 'events.% must be nullable with no default — NULL is "never asked = on"', c;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'events_host'
         AND column_name IN ('partner_a_birth_date','estimated_budget_centavos','wizard_state',
                             'signature_details','honoree_label')) <> 5 THEN
    RAISE EXCEPTION 'events_host lost a host-only private column in the rebuild';
  END IF;
END $$;

COMMIT;

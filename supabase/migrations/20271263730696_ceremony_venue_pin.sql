-- ============================================================================
-- 20271263730696_ceremony_venue_pin.sql
--
-- THE CEREMONY GETS A MAP PIN OF ITS OWN.
--
-- Owner, 2026-10-01 (DECISION_LOG "THE MAKER'S VENUES GET A REAL PIN AND A
-- PICKED CITY — NOT FREE TEXT"): *"address and city is not giving us precise
-- data of the location and city/area coverage"* ⇒ in Details › Your event ›
-- Venues, "Enter your own" uses the shipped AddressPinField, and "Ceremony /
-- Reception each keep their own pin; the reception pin also refreshes the
-- events.venue_latitude/longitude anchor". Design approved 2026-10-04
-- (prototypes/maker_venues_pin_and_time_2026-10-04_fable.html, "YES TO ALL").
--
-- ── WHAT ALREADY EXISTS (measured in the tree, 2026-10-04) ──────────────────
--   • RECEPTION: `events.venue_latitude` / `venue_longitude` (20260525010000) —
--     the event's own venue anchor, the reception fallback in
--     `lib/event-venues.ts` `resolveEventVenues`. It FITS, so it is reused.
--   • CEREMONY: a typed name (`std_film_ceremony_name`) and a typed street
--     address (`ceremony_venue_address`, 20271252997367) — but no pin. A booked
--     ceremony takes its pin from the booking. So these TWO columns.
--
-- ── THE SHAPE ────────────────────────────────────────────────────────────────
-- NUMERIC(10,7), NULLABLE, NO DEFAULT — the exact type of venue_latitude /
-- venue_longitude. Both or neither (a half pin is refused rather than stored as
-- half a place — the rule `event_manual_vendors` already holds). NULL = not
-- pinned: guests' Directions then search the name and address, as today.
--
-- ── WHO MAY SEE IT ───────────────────────────────────────────────────────────
-- The rule of `ceremony_venue_address`, unchanged (`lib/venue-disclosure.ts`
-- `withheldVenue` closes these two beside it): the couple always; a guest once
-- they have replied or on the day. Guest-facing reads go through the
-- service-role client, so `anon` holds nothing here.
--
-- ── GRANTS (lint-events-column-grants) ───────────────────────────────────────
-- SELECT + UPDATE to `authenticated` — Apply writes the drafted pin through the
-- couple's own session (`hub-draft-actions.ts`). Then `events_host` is rebuilt
-- over it, the recipe of 20271260666366 (the latest rebuild), line for line.
-- ============================================================================

BEGIN;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ceremony_venue_latitude NUMERIC(10, 7);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ceremony_venue_longitude NUMERIC(10, 7);

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_ceremony_venue_pin_range;
ALTER TABLE public.events
  ADD CONSTRAINT events_ceremony_venue_pin_range
  CHECK (
    (ceremony_venue_latitude IS NULL OR ceremony_venue_latitude BETWEEN -90 AND 90)
    AND (ceremony_venue_longitude IS NULL OR ceremony_venue_longitude BETWEEN -180 AND 180)
  );

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_ceremony_venue_pin_pair;
ALTER TABLE public.events
  ADD CONSTRAINT events_ceremony_venue_pin_pair
  CHECK ((ceremony_venue_latitude IS NULL) = (ceremony_venue_longitude IS NULL));

COMMENT ON COLUMN public.events.ceremony_venue_latitude IS
  'The CEREMONY venue''s map pin (latitude), placed by the couple in Details › Your event › Venues '
  '(owner 2026-10-01, "THE MAKER''S VENUES GET A REAL PIN"). Used when no ceremony venue is booked — '
  'a booking''s own pin wins (apps/web/lib/event-venues.ts resolveEventVenues). The reception''s pin is '
  'events.venue_latitude (reused). Guest visibility follows ceremony_venue_address (lib/venue-disclosure.ts '
  'withheldVenue). Written at Apply from the Event Hub draft. NULL = not pinned; both or neither.';
COMMENT ON COLUMN public.events.ceremony_venue_longitude IS
  'The CEREMONY venue''s map pin (longitude) — see ceremony_venue_latitude. Both or neither.';

GRANT SELECT (ceremony_venue_latitude) ON public.events TO authenticated;
GRANT UPDATE (ceremony_venue_latitude) ON public.events TO authenticated;
GRANT SELECT (ceremony_venue_longitude) ON public.events TO authenticated;
GRANT UPDATE (ceremony_venue_longitude) ON public.events TO authenticated;

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

DO $$
DECLARE
  c TEXT;
BEGIN
  FOREACH c IN ARRAY ARRAY['ceremony_venue_latitude', 'ceremony_venue_longitude'] LOOP
    IF NOT has_column_privilege('authenticated', 'public.events', c, 'SELECT') THEN
      RAISE EXCEPTION 'events.% is not readable by authenticated — every Maker query naming it would be refused', c;
    END IF;
    IF NOT has_column_privilege('authenticated', 'public.events', c, 'UPDATE') THEN
      RAISE EXCEPTION 'events.% is not writable by authenticated — Apply could not write the drafted pin', c;
    END IF;
    IF has_column_privilege('anon', 'public.events', c, 'SELECT') THEN
      RAISE EXCEPTION 'events.% is readable by anon — every guest-facing read goes through the admin client', c;
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
  -- Its neighbours must have survived the view rebuild.
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'events_host'
         AND column_name IN ('ceremony_venue_address','papic_on','rsvp_ask_config','venue_latitude')) <> 4 THEN
    RAISE EXCEPTION 'events_host lost a neighbouring column in the rebuild';
  END IF;
  -- The rebuild must not have widened the private list into the secrets.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host'
       AND column_name IN ('master_qr_token','photo_delivery_oauth_token_encrypted','photo_delivery_oauth_expires_at')
  ) THEN
    RAISE EXCEPTION 'events_host now projects a secret column — the private list was widened';
  END IF;
END $$;

COMMIT;

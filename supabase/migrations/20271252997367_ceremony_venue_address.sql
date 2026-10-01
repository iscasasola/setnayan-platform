-- ============================================================================
-- 20271252997367_ceremony_venue_address.sql
--
-- THE CEREMONY GETS A STREET ADDRESS OF ITS OWN.
--
-- Owner, 2026-09-29 (DECISION_LOG "OWNER: YES TO ALL FOUR…", item 4): *"yes to
-- all 4"* ⇒ venues gain a full street address per venue (ceremony + reception),
-- typed once in Details › Your event › Venues, used for maps, directions,
-- prints and the Save the Date — "the smallest storage (an existing
-- venue_address-style column if it fits; else one forward migration)".
--
-- ── WHAT ALREADY EXISTS (measured in the tree, 2026-09-29) ──────────────────
--   • RECEPTION: `events.venue_address` — the event's own venue address, the
--     reception fallback in `lib/event-venues.ts` `resolveEventVenues` when no
--     reception is booked. It FITS, so it is reused: nothing is added for it.
--   • CEREMONY: a typed NAME exists (`events.std_film_ceremony_name`, the
--     fallback when no ceremony venue is booked) but no address column of any
--     kind. A booked ceremony takes its address from the booking. A couple who
--     typed their church had nowhere to say where it is — so this ONE column.
--
-- ── THE SHAPE ────────────────────────────────────────────────────────────────
-- TEXT, NULLABLE, NO DEFAULT: NULL means "not typed", and the Event Hub then
-- offers a directions search by the ceremony's name (`venueSearchQuery`),
-- exactly as today. A length CHECK (1–300 once trimmed, the same bound a guest
-- reads on one card) so a blank string is never stored as an "address".
--
-- ── WHO MAY SEE IT ───────────────────────────────────────────────────────────
-- The same rule as `venue_address`, unchanged (owner 2026-09-20,
-- `lib/venue-disclosure.ts`): the couple always; a guest once they have replied
-- or on the day; the closed state drops the street address and keeps the name.
-- `withheldVenue` closes this column beside `venue_address`. Guest-facing reads
-- go through the service-role client, so `anon` holds nothing here.
--
-- ── GRANTS (lint-events-column-grants) ───────────────────────────────────────
-- `public.events` re-grants a COLUMN ALLOWLIST (20271007100000), so a new
-- column is born unreadable unless it carries its own grant. SELECT + UPDATE to
-- `authenticated` (the couple's Details save writes it through their own
-- client, `saveAllStdContent`), then `events_host` is rebuilt over it — the
-- rebuild recipe of 20271247938209, followed line for line.
-- ============================================================================

BEGIN;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ceremony_venue_address TEXT;

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_ceremony_venue_address_length;
ALTER TABLE public.events
  ADD CONSTRAINT events_ceremony_venue_address_length
  CHECK (
    ceremony_venue_address IS NULL
    OR char_length(btrim(ceremony_venue_address)) BETWEEN 1 AND 300
  );

COMMENT ON COLUMN public.events.ceremony_venue_address IS
  'The CEREMONY venue''s street address, typed by the couple in Details › Your event › Venues '
  '(owner 2026-09-29, "yes to all 4"). Used when no ceremony venue is booked — a booking''s own '
  'address wins (apps/web/lib/event-venues.ts resolveEventVenues). The reception''s typed address '
  'is events.venue_address (reused, not duplicated). Guest visibility follows venue_address: '
  'closed until the guest replies or the day arrives (apps/web/lib/venue-disclosure.ts '
  'withheldVenue). Written through saveAllStdContent. NULL = not typed.';

GRANT SELECT (ceremony_venue_address) ON public.events TO authenticated;
GRANT UPDATE (ceremony_venue_address) ON public.events TO authenticated;

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
BEGIN
  IF NOT has_column_privilege('authenticated', 'public.events', 'ceremony_venue_address', 'SELECT') THEN
    RAISE EXCEPTION 'events.ceremony_venue_address is not readable by authenticated — every events query naming it would be refused';
  END IF;

  IF NOT has_column_privilege('authenticated', 'public.events', 'ceremony_venue_address', 'UPDATE') THEN
    RAISE EXCEPTION 'events.ceremony_venue_address is not writable by authenticated — Details could never save it';
  END IF;

  IF has_column_privilege('anon', 'public.events', 'ceremony_venue_address', 'SELECT') THEN
    RAISE EXCEPTION 'events.ceremony_venue_address is readable by anon — every guest-facing read goes through the admin client';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = 'ceremony_venue_address'
  ) THEN
    RAISE EXCEPTION 'events_host was rebuilt without ceremony_venue_address';
  END IF;

  -- The rebuild must not have widened the private list into the secrets.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host'
       AND column_name IN ('master_qr_token','photo_delivery_oauth_token_encrypted','photo_delivery_oauth_expires_at')
  ) THEN
    RAISE EXCEPTION 'events_host now projects a secret column — the private list was widened';
  END IF;

  -- Its neighbours must have survived the view rebuild.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = 'venue_address'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = 'rsvp_ask_config'
  ) THEN
    RAISE EXCEPTION 'the events_host rebuild lost a neighbouring column';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events'
       AND column_name = 'ceremony_venue_address' AND is_nullable = 'YES' AND column_default IS NULL
  ) THEN
    RAISE EXCEPTION 'events.ceremony_venue_address must be nullable with no default — NULL is "not typed"';
  END IF;
END $$;

COMMIT;

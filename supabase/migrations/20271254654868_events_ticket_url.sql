-- events_ticket_url
-- Created via `pnpm migration:new`. Idempotent (ADD COLUMN IF NOT EXISTS, the
-- constraint dropped before it is re-added, the view dropped before rebuild).
--
-- 🎟 "WHERE TO GET TICKETS" ON A PUBLIC EVENT
-- Owner, 2026-09-29 (spec corpus DECISION_LOG "DISCOVER — UNPARKED", item b):
-- a public event may carry a "Where to get tickets" link. THE ORGANIZER SELLS
-- THE TICKETS — NEVER SETNAYAN. This column is only the address of the
-- organizer's own ticket page; nothing here prices, sells or records a ticket.
--
-- 🔑 NULL = NO LINK. The guest page draws "Get tickets" only when the event is
-- Public AND this is set (apps/web/lib/ticket-url.ts `publicTicketUrl`).
--
-- 🔒 HTTPS ONLY, BOUNDED, CHECKED HERE — not only in the app. The app parses the
-- same shape (`TICKET_URL_PATTERN` / `TICKET_URL_MAX` in apps/web/lib/ticket-url.ts,
-- held equal to this CHECK by apps/web/lib/ticket-url.test.ts), but a CHECK is the
-- only rule no writer can skip: no `javascript:`, no `http:`, no `data:`, no
-- whitespace, no user@host, at most 500 characters.
--
-- 🪤 ONE `ALTER TABLE` PER STATEMENT — lint-events-column-grants.mjs sees only
-- the first column of a comma-separated ADD.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ticket_url TEXT;

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_ticket_url_https;
ALTER TABLE public.events
  ADD CONSTRAINT events_ticket_url_https
  CHECK (
    ticket_url IS NULL
    OR (
      char_length(ticket_url) <= 500
      AND ticket_url ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
    )
  );

COMMENT ON COLUMN public.events.ticket_url IS
  'The organizer''s own ticket page for a PUBLIC event (owner 2026-09-29: the organizer sells, never Setnayan). '
  'https only, at most 500 characters (CHECK events_ticket_url_https). NULL = no link. Shown as "Get tickets" on the '
  'guest Event Hub only while the event is Public. Written only by the host server action '
  'updateLandingPageVisibility (apps/web/app/dashboard/[eventId]/website/privacy/actions.ts) through the service '
  'role, after its host gate.';

-- ── WHO MAY READ AND WRITE IT — asked per role, not "is there a grant" ──────
-- `public.events` revokes table-level SELECT/UPDATE and re-grants per-column
-- allowlists (20271005100000 / 20271007100000 / 20271025120000); an ungranted
-- column makes PostgREST refuse the ENTIRE query that names it.
--   · authenticated — SELECT only. The Maker reads it through the host's own
--     session (website/editor/page.tsx). NO UPDATE: the host writes it through
--     the server action above, which validates it and then writes with the
--     service role — the `live_media_public` shape. A host session cannot PATCH
--     it straight through PostgREST.
--   · anon — NOTHING. The guest page reads the event through the admin client
--     (app/[slug]/_lib/loaders.ts `loadEventShell`).
--   · service_role — already holds ALL on the table.
GRANT SELECT (ticket_url) ON public.events TO authenticated;

-- ── AND events_host MUST BE REBUILT OVER IT ─────────────────────────────────
-- The view's projection is COMPUTED from the grants (hence: after the GRANT),
-- so the block below is reproduced VERBATIM from 20271247938209 (the latest
-- carrier of it) — extracted mechanically with sed, not retyped — including its
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

-- ── POST-CONDITIONS — refuse to apply rather than ship a half-grant ─────────
DO $$
BEGIN
  IF NOT has_column_privilege('authenticated', 'public.events', 'ticket_url', 'SELECT') THEN
    RAISE EXCEPTION 'events.ticket_url is not readable by authenticated — every Maker query naming it would be refused';
  END IF;
  IF has_column_privilege('authenticated', 'public.events', 'ticket_url', 'UPDATE') THEN
    RAISE EXCEPTION 'events.ticket_url is writable by authenticated — it must be written only through the host server action';
  END IF;
  IF has_column_privilege('anon', 'public.events', 'ticket_url', 'SELECT') THEN
    RAISE EXCEPTION 'events.ticket_url is readable by anon — nothing anonymous reads it';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = 'ticket_url'
  ) THEN
    RAISE EXCEPTION 'events_host was rebuilt without ticket_url';
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
  -- The CHECK must refuse what it exists to refuse — asserted, not assumed.
  IF 'http://tickets.example.com' ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
     OR 'javascript:alert(1)' ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
     OR NOT ('https://tickets.example.com/show?id=1' ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]{1,5})?([/?#][^[:space:]]*)?$') THEN
    RAISE EXCEPTION 'events_ticket_url_https does not separate https links from everything else';
  END IF;
END $$;

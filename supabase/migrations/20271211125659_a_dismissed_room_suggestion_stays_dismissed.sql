-- RV2 · A DISMISSED SUGGESTION STAYS DISMISSED — and it is not part of the room.
--
-- Owner ruling 2026-09-06 (Q9): when a couple has booked a supplier whose trade
-- reaches a reception zone, that zone SUGGESTS the treatment and one click makes
-- it theirs. `events.reception_design` is never written without that click.
-- Waving the offer away is the other half of that: it has to stick, per booking,
-- per zone, per couple, or the room nags forever.
--
-- ── WHY THIS IS A COLUMN AND NOT A KEY INSIDE `reception_design` ────────────
-- 🛑 THE BRIEF ASKED FOR `reception_design.dismissed_suggestions`, AND THAT
-- CANNOT WORK IN THIS CODEBASE. `sanitizeReceptionDesign`
-- (apps/web/lib/reception-scene.ts) is the single trust boundary every writer
-- and every 3D/SVG reader passes through, and it keeps ONLY known
-- part → attribute → valid-option-id triples, dropping everything else. A
-- `dismissed_suggestions` key would therefore be silently deleted on the next
-- save of the design — by `saveReceptionDesign` itself — and the chip would
-- come back. The type says the same thing: `ReceptionDesign` is
-- `Partial<Record<PartId, …>>`, and a key that is not a PartId does not belong
-- in it.
--
-- 🔑 AND A SEPARATE COLUMN MAKES THE RULING STRUCTURAL RATHER THAN CAREFUL.
-- The invariant RV2 exists to hold is "dismissing changes NOTHING about the
-- room". With the list in its own column, dismissing cannot touch
-- `reception_design` — not because the code is disciplined, but because it
-- writes a different column and never calls the design writer at all. Held in
-- the same object, that guarantee would have rested on a diff nobody re-reads.
--
-- ── WHAT IT HOLDS ──────────────────────────────────────────────────────────
-- A JSONB array of `<vendor_id>:<zone>` strings, e.g. `["a1b2…:program"]`.
-- Keyed on the BOOKING (`event_vendors.vendor_id`), never a flag on the booking
-- row: a booking is a fact about a supplier, and "this couple waved that chip
-- away" is a fact about this couple's room. A NEW booking — even of the same
-- trade — has a vendor_id nothing has dismissed, so it gets a fresh chip.
--
-- No FK and no CHECK on the contents on purpose: the keys are display state,
-- an entry naming a removed booking is inert (nothing renders it), and
-- `sanitizeDismissedSuggestions` is the reader's own total, never-throwing
-- boundary — the same contract `sanitizeReceptionDesign` keeps for its column.
--
-- RLS: none is added or needed. `events` already carries its policies, and this
-- column rides on the row's existing host-only write path — the SAME path
-- `reception_design` uses. No new grant, no new policy, no new surface.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS dismissed_room_suggestions JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.events.dismissed_room_suggestions IS
  'RV2 (owner ruling Q9, 2026-09-06). Reception-designer suggestion chips this '
  'couple has waved away, as a JSONB array of "<event_vendors.vendor_id>:<zone>" '
  'strings. Deliberately NOT a key inside reception_design: sanitizeReceptionDesign '
  'keeps only known part->attribute->option triples and would silently drop it, and '
  'a separate column makes "dismissing never changes the room" structural rather '
  'than a matter of care. Display state only — an entry naming a booking that has '
  'since been removed is inert.';

-- ── THE COLUMN MUST BE GRANTED, OR THE WHOLE PAGE GOES EMPTY ────────────────
-- 🛑 `public.events` REVOKES table-level SELECT and re-grants a computed
-- per-column allowlist (20271007100000). A column added without its own
-- `GRANT SELECT (col)` is not merely invisible — **PostgREST refuses the ENTIRE
-- query**, so `seating/lab/page.tsx`, whose `events` select now names this
-- column, would return no row at all and the seating lab would render as an
-- event that does not exist.
--
-- Caught by `apps/web/scripts/lint-events-column-grants.mjs`, which says in its
-- own output why the db coverage tests CANNOT catch it: their `before()`
-- re-applies the lockdown, which recomputes the allowlist over the new column
-- and makes the bug disappear exactly where it would be tested.
--
-- ✅ `authenticated` IS THE RIGHT AUDIENCE, and this is a deliberate choice
-- rather than a copied line. The column holds which suggestion chips this
-- couple waved away — display state on their own room, read by their own
-- session on their own page, and already row-scoped by the existing `events`
-- RLS. It is not birth data, budget or wizard state; there is no reason for it
-- to sit in the host-only private set.
GRANT SELECT (dismissed_room_suggestions) ON public.events TO authenticated;

-- ── AND events_host MUST BE REBUILT OVER IT ─────────────────────────────────
-- That view has an EXPLICIT column projection, so a new base-table column is a
-- phantom on it until the view is recreated — and `/dashboard/[eventId]/details`
-- THROWS on a query error, which would kill Personalization for every host on
-- every event type.
--
-- The projection is COMPUTED from the grants (hence: after the GRANT above),
-- so this block is reproduced from 20271025120000 verbatim, including its
-- private-column list and its refuse-if-empty guard. Nothing here is retyped
-- from memory: an omitted private column would silently drop it from the host's
-- read path, which renders exactly like a couple who never filled it in.
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

-- ── PROVE IT, rather than assume the DO block did what it says ──────────────
DO $$
BEGIN
  IF NOT has_column_privilege('authenticated', 'public.events', 'dismissed_room_suggestions', 'SELECT') THEN
    RAISE EXCEPTION 'dismissed_room_suggestions is not readable by authenticated — every events query would be refused';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'events_host'
       AND column_name = 'dismissed_room_suggestions'
  ) THEN
    RAISE EXCEPTION 'events_host was rebuilt without dismissed_room_suggestions';
  END IF;
END $$;

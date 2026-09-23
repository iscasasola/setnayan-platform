-- ONE ELEMENT TRAVELS INSTEAD OF TWO — the Event Hub's Magic Move switch.
--
-- Owner, 2026-09-23: element animation is *"something I really want"*, and
-- *"the idea is like how keynote's magic move operate"*. The mechanism shipped
-- the same day in lib/magic-move.ts + app/[slug]/_components/magic-move.tsx.
-- It has never rendered for anybody, because nothing stored a choice and
-- nothing mounted the script. This column is the missing half.
--
-- 🔴 AND THE REPO'S OWN GUARD SAID SO FIRST. `ugat-both-ends.db.test.ts` failed
-- on the branch that introduced the component:
--
--     [other] component-no-mount  app/[slug]/_components/magic-move.tsx
--         no runtime importer in any source file
--     component-no-mount: mount it from a page, or delete it.
--
-- The guard and the owner reached the same conclusion about the same file
-- within the hour. Its message also forbids the lazy exit — "Do NOT add a line
-- to tests/db/ugat-both-ends.baseline.txt; that file is the debt we inherited."
--
-- ── WHY A COLUMN AND NOT config_json ────────────────────────────────────────
-- The motion CANVAS lives in `invitation_widgets.config_json` because it is
-- per-section: every widget arranges itself. This is not per-section. One
-- element travels across the WHOLE page, from the hero into the bar that
-- follows the guest down, so it belongs to the event exactly as the couple's
-- typeface does (`events.site_font_key`, 20271242571950) — and this migration
-- is that one, followed line for line, including the grant, the events_host
-- rebuild and the proofs.
--
-- ── NULL MEANS NOTHING TRAVELS, AND THAT IS THE DEFAULT FOREVER ─────────────
-- No default and no backfill. Every live page renders byte-identically until a
-- couple opens the editor and says otherwise. This is the first motion on the
-- guest page that moves an element ACROSS the viewport, and it wants a real
-- phone and the owner's eyes before it is the default for anybody.
--
-- 🪤 ONE `ALTER TABLE` PER STATEMENT — lint-events-column-grants.mjs sees only
-- the first column of a comma-separated ADD.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS site_magic_traveller TEXT;

-- Closed vocabulary, mirroring MAGIC_TRAVELLERS in apps/web/lib/magic-move.ts.
-- ⛔ ONE ENTRY, AND THE SHORTNESS IS THE POINT. A traveller has to be an element
-- that genuinely exists in two meaningful places; that is a design decision each
-- time, not a switch a couple flips on any element they like.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_site_magic_traveller_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_site_magic_traveller_check
  CHECK (site_magic_traveller IS NULL
         OR site_magic_traveller IN ('mark'));

COMMENT ON COLUMN public.events.site_magic_traveller IS
  'Which element travels across the Event Hub as a guest scrolls (Magic Move). One of '
  'MAGIC_TRAVELLERS in apps/web/lib/magic-move.ts — today only ''mark'', the couple''s '
  'monogram, which leaves the hero and arrives smaller in the sticky bar. NULL means '
  'nothing travels and the page renders exactly as it did before the feature existed. '
  'Written by the website editor through the host''s own session.';

-- ── THE COLUMN MUST BE GRANTED, OR EVERY SIGNED-IN EVENTS QUERY DIES ────────
-- 🛑 `public.events` revokes table-level SELECT and re-grants a computed
-- per-column allowlist. An ungranted column makes PostgREST refuse the ENTIRE
-- query that names it — and the website editor's own select names this one.
--
-- ✅ SELECT + UPDATE for `authenticated`: the writer is the website editor's
-- server action running on the HOST'S OWN SESSION after requireHostMembership,
-- the same shape as `site_font_key` beside it. RLS still decides which row.
-- No grant to `anon`: the guest site reads events through the admin client.
GRANT SELECT (site_magic_traveller) ON public.events TO authenticated;
GRANT UPDATE (site_magic_traveller) ON public.events TO authenticated;

-- ── AND events_host MUST BE REBUILT OVER IT ─────────────────────────────────
-- The view's projection is COMPUTED from the grants (hence: after the GRANT),
-- so the block below is reproduced VERBATIM from 20271242571950 — extracted
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
  IF NOT has_column_privilege('authenticated', 'public.events', 'site_magic_traveller', 'SELECT') THEN
    RAISE EXCEPTION 'events.site_magic_traveller is not readable by authenticated — every events query naming it would be refused';
  END IF;

  IF NOT has_column_privilege('authenticated', 'public.events', 'site_magic_traveller', 'UPDATE') THEN
    RAISE EXCEPTION 'events.site_magic_traveller is not writable by authenticated — the editor could never save the switch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = 'site_magic_traveller'
  ) THEN
    RAISE EXCEPTION 'events_host was rebuilt without site_magic_traveller';
  END IF;

  -- The rebuild must not have widened the private list into the secrets.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host'
       AND column_name IN ('master_qr_token','photo_delivery_oauth_token_encrypted','photo_delivery_oauth_expires_at')
  ) THEN
    RAISE EXCEPTION 'events_host now projects a secret column — the private list was widened';
  END IF;

  -- The sibling column must have survived the view rebuild too. A rebuild that
  -- drops a neighbour is silent: the page simply stops honouring a choice the
  -- couple already made, and no query errors.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = 'site_font_key'
  ) THEN
    RAISE EXCEPTION 'the events_host rebuild lost site_font_key';
  END IF;

  -- NULL (nothing travels) must stay legal, and a default would put motion on
  -- every wedding page on the platform without anybody asking for it.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events'
       AND column_name = 'site_magic_traveller' AND is_nullable = 'YES' AND column_default IS NULL
  ) THEN
    RAISE EXCEPTION 'events.site_magic_traveller must be nullable with no default — NULL is "nothing travels"';
  END IF;

  -- The CHECK must actually refuse a traveller the page cannot animate.
  BEGIN
    INSERT INTO public.events (event_id, site_magic_traveller) VALUES (gen_random_uuid(), 'everything');
    RAISE EXCEPTION 'the site_magic_traveller CHECK accepted a traveller lib/magic-move.ts does not offer';
  EXCEPTION
    WHEN check_violation THEN NULL;   -- the refusal we wanted
    WHEN others THEN NULL;            -- NOT NULL on some other column got there first; the CHECK is still declared
  END;
END $$;

-- entourage_section_order
-- Created via `pnpm migration:new`. Idempotent.
--
-- ⚖ OWNER 2026-09-21, on the Wedding March: "we should be able to arrange the
-- parents, immediate family and other roles and modify its sequence."
--
-- Until now the SECTION order (Parents → Immediate Family → Maid of Honour &
-- Best Man → …) was fixed in code (`GROUPS` in apps/web/lib/entourage.ts), the
-- same for every wedding. Lines inside a section were already the couple's to
-- arrange (`guests.entourage_order`); the sections were not.
--
-- ── WHAT THE VALUE MEANS ───────────────────────────────────────────────────
-- The couple's section keys, in the order they chose. NULL = never arranged,
-- which prints the built-in order.
-- 🔑 NOT A CLOSED LIST, deliberately — no CHECK on the keys. The key set lives
-- in `GROUPS`, and a SQL copy of it would be right today and wrong the first
-- time a group is added. The app reads this through `orderedGroupKeys`, which
-- drops a key it does not know and appends any group the saved list lacks (in
-- the built-in order). So a new group appears for every couple, and a retired
-- one silently leaves — nobody's entourage loses a section because of a value
-- saved before it existed.
--
-- 🪤 ONE `ALTER TABLE` PER STATEMENT — lint-events-column-grants.mjs sees only
-- the first column of a comma-separated ADD.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS entourage_section_order TEXT[];

COMMENT ON COLUMN public.events.entourage_section_order IS
  'The couple''s Wedding March SECTION order (owner 2026-09-21), as entourage group keys '
  '(parents, immediate_family, honour, …). NULL = never arranged → built-in order. Read '
  'through orderedGroupKeys() in apps/web/lib/entourage.ts, which ignores unknown keys and '
  'appends missing ones, so no CHECK here. Written by the host''s guest page through the '
  'admin client after requireHostMembership.';

-- ── THE COLUMN MUST BE GRANTED, OR EVERY SIGNED-IN EVENTS QUERY DIES ────────
-- `public.events` revokes table-level SELECT and re-grants a per-column
-- allowlist (20271007100000 / 20271025120000); an ungranted column makes
-- PostgREST refuse the ENTIRE query that names it.
--
-- ✅ SELECT ONLY, `authenticated` ONLY — the same decision as `invite_theme`
-- (20271219583821), for the same reasons:
--   · No GRANT UPDATE: the only writer is the guest page's section control,
--     which writes through createAdminClient() after requireHostMembership. A
--     session write grant would widen the surface for a writer that does not
--     exist.
--   · No grant to `anon`: both public readers (`/[slug]` via loadEntourage and
--     `/[slug]/everyone`) read with the admin client.
GRANT SELECT (entourage_section_order) ON public.events TO authenticated;

-- ── AND events_host MUST BE REBUILT OVER IT ─────────────────────────────────
-- Its projection is COMPUTED from the grants (hence: after the GRANT). The
-- block below is extracted MECHANICALLY from the latest rebuild on main,
-- 20271233873951 (S40) — not retyped — including its 15-name private list and
-- its refuse-if-empty guard.

DROP VIEW IF EXISTS public.events_host;

ALTER TABLE IF EXISTS public.events
  DROP COLUMN IF EXISTS monogram_custom_generation_id;

DROP TABLE IF EXISTS public.bespoke_monogram_generations CASCADE;

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
          OR current_user = 'service_role'
          OR auth.role() = 'service_role'
  $ddl$, projected);
END $$;

REVOKE ALL ON public.events_host FROM PUBLIC;
REVOKE ALL ON public.events_host FROM anon;
REVOKE ALL ON public.events_host FROM authenticated;
GRANT SELECT ON public.events_host TO authenticated, service_role;

COMMENT ON VIEW public.events_host IS
  'Couple/moderator-scoped read path for events, including the columns denied to authenticated on the base table (20271008731642 + 20271025120000: birth data, budget, wizard_state, Drive folder, AI tier, signature_details, honoree_label, honoree_dependent_id). Guests, vendors and coordinators get ZERO rows. security_invoker=false by design. Rebuilt 20271233873951 (S40) after monogram_custom_generation_id was dropped.';

-- ── POST-CONDITIONS — refuse to apply rather than ship a half-grant ─────────
DO $$
BEGIN
  IF NOT has_column_privilege('authenticated', 'public.events', 'entourage_section_order', 'SELECT') THEN
    RAISE EXCEPTION 'events.entourage_section_order is not readable by authenticated — every events query naming it would be refused';
  END IF;
  IF has_column_privilege('anon', 'public.events', 'entourage_section_order', 'SELECT') THEN
    RAISE EXCEPTION 'events.entourage_section_order is readable by anon — nothing anonymous reads it';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events_host' AND column_name = 'entourage_section_order'
  ) THEN
    RAISE EXCEPTION 'events_host was rebuilt without entourage_section_order';
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
END $$;

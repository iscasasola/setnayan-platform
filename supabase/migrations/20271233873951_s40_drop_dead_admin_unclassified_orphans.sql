-- s40_drop_dead_admin_unclassified_orphans
--
-- S40 (orphan sweep, ADMIN + UNCLASSIFIED tier - apps/web/tests/db/
-- ugat-both-ends.baseline.txt). Each object below was re-measured against
-- origin/main on 2026-09-18 and confirmed to have NO live caller/writer and
-- NO documented future-PR intent (unlike the sibling ADMIN/UNCLASSIFIED rows
-- left untouched this session - render_jobs, seo_suggestions,
-- concierge_brain_chunks, concierge_response_cache, person_stewardships,
-- stewardship_transfers, execute_manpower_telemetry_reward - all of which
-- carry an explicit "inert scaffolding, later PR" or owner-pending-decision
-- comment in their own migration and are NOT part of this drop).
--
-- Idempotent: every statement is IF EXISTS. Safe to re-run.

BEGIN;

-- 1. current_user_gallery_counts() - built (20270424527466) to replace a
--    full-row-scan perf bug in getSwitcherData(). The switcher panel was
--    slimmed to events-first (owner 2026-06-22) before the RPC swap landed;
--    get-switcher-data.ts's own docblock says outright: "That RPC is now
--    unused by the switcher and can be dropped in a later migration." Zero
--    callers anywhere in the app.
DROP FUNCTION IF EXISTS public.current_user_gallery_counts();

-- 2. hamming_distance(bigint, bigint) - built (20270330665855) for the
--    repost-watch match query, but the match itself runs entirely client-side
--    (lib/perceptual-hash.ts's hammingDistance, an explicit "exact JS mirror
--    of the SQL public.hamming_distance()" per lib/vendor-image-repost-watch.ts).
--    Both live pHash consumers - vendor image repost-watch AND the
--    inspiration-gallery logo-collision check (lib/moodboard-gallery-screen.
--    server.ts) - use the JS mirror, never the SQL function. No SQL body or
--    policy calls it either.
DROP FUNCTION IF EXISTS public.hamming_distance(BIGINT, BIGINT);

-- 3. moderator_can_see_row(...) - built (20260519100000) as a helper "used by
--    RLS policies on cart / vendor_orders / vendor_chat_threads / calendar /
--    budget tables in subsequent phases" that never arrived; those tables
--    shipped their own RLS instead. Not one of the 4 canonical RLS helpers
--    (is_admin, current_event_ids, current_vendor_ids, current_thread_ids -
--    CLAUDE.md "RLS canonical patterns"). Zero policies anywhere call it.
DROP FUNCTION IF EXISTS public.moderator_can_see_row(UUID, UUID, TEXT[], TEXT[], TEXT);

-- 4. bespoke_monogram_generations - the Bespoke AI Monogram Studio table
--    (20261112000000). The feature was retired 2026-06-19 (commit
--    "feat(monogram): reduce Monogram Maker to Vector Studio + Upload", owner
--    decision 2026-06-19): "Cipher Studio, Bespoke AI studio ... are retired
--    from the page." That commit deliberately left the table + the
--    events.monogram_custom_generation_id FK intact - "existing marks still
--    render ... A DB cleanup can follow once confirmed unneeded." Re-measured
--    live 2026-09-18: 0 rows in bespoke_monogram_generations, 0 events
--    reference it via monogram_custom_generation_id. Confirmed unneeded -
--    this is that cleanup. The 2026-06-23 "reveal unification" (hero-
--    monogram.tsx) also settled that studio/bespoke marks animate via the
--    chosen StudioRevealPlayer reveal, NOT a bespoke-generation provenance
--    pointer, so the column has no forward use either.
-- events_host (rebuilt 20271230123132) has an EXPLICIT, computed column
-- projection that included monogram_custom_generation_id, so the plain DROP
-- COLUMN below fails with "other objects depend on it" until the view is
-- rebuilt without it. Rebuild block copied verbatim from 20271230123132
-- (itself copied from 20271197327520) -- the private_columns array is
-- unchanged; it re-derives its SELECT list from information_schema, so
-- running it again AFTER the DROP COLUMN naturally excludes the dropped
-- column with no other edit needed.
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

-- 5. founder_time_log - shipped 2026-05-23 (20260523000000) as a "weekly
--    self-report" table; that migration's own scope note says "Out of scope
--    (separate migrations / app code): ... The dashboard React components."
--    No dashboard, no writer, no reader ever shipped in the four months
--    since. Re-measured live 2026-09-18: 0 rows.
DROP TABLE IF EXISTS public.founder_time_log CASCADE;

COMMIT;

-- The price is public. What the price COSTS US is not.
--
-- ── WHAT IS READABLE TODAY ──────────────────────────────────────────────────
-- `platform_retail_catalog_v2.saas_overhead_cost_php` is our internal per-SKU
-- model/vendor cost. Measured against production 2026-09-03, by executing it:
--
--   select has_column_privilege('anon','public.platform_retail_catalog_v2',
--                               'saas_overhead_cost_php','SELECT');            -- true
--   select count(*) from platform_retail_catalog_v2
--    where saas_overhead_cost_php is not null;                                 -- 35 of 35
--
-- The publishable key is inlined into the production bundle BY DESIGN and
-- PostgREST is reachable directly, so this is not "a column an admin page can
-- see" — it is a column a stranger with `curl` can see, for every SKU we sell,
-- without ever loading a page. Subtracting it from `retail_price_php` gives our
-- margin on the whole catalogue.
--
-- ── WHY IT IS READABLE, WHICH IS NOT WHAT IT LOOKS LIKE ─────────────────────
-- Nobody granted this. `relacl` reads `anon=arwdDxtm` because this database
-- carries `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO
-- anon, authenticated` — every table in `public` ships OPEN and stays open
-- until something revokes it. The table's one RLS policy is
-- `platform_retail_catalog_v2_public_read … USING (true)`, and RLS is
-- ROW-level: it can never hide a column. See supabase/security/README.md.
--
-- ⚠ PRE-EXISTING. The column (20260628000000) and the public-read policy (same
-- file) both predate every feature that reads them. This is not a regression
-- from any recent PR — PR #5146 (MOODBOARD_RENDER_PACK) merely added the 36th
-- row to a table that was already exposed.
--
-- ── WHY A COLUMN ALLOW-LIST AND NOT A VIEW ──────────────────────────────────
-- Postgres cannot subtract a column from a table-level grant, so the table
-- privilege is revoked and an explicit column list granted back — the identical
-- mechanism as 20271007100000 on `events`, and the fix supabase/security/README
-- names for exactly this shape ("a secret column on a table strangers already
-- read"). A view was the alternative and was rejected: it needs every reader
-- rewritten, and there are 31 of them.
--
-- ── HOW THE DENY-SET WAS DERIVED ────────────────────────────────────────────
-- Every `.from('platform_retail_catalog_v2')` call site in apps/web (31 files)
-- was extracted and its Supabase client resolved to service-role vs session:
--
--   • 30 of 31 use `createAdminClient()` — service-role, which bypasses RLS and
--     grants entirely and is UNAFFECTED by this migration. That includes the
--     ONLY reader of the cost column, lib/v2-catalog.ts fetchV2CustomerCatalog,
--     and both `select('*')` calls (app/admin/pricing/actions.ts).
--   • 1 of 31 reads through the caller's own session — the signed-in supplier
--     page app/vendor-dashboard/recommendations/page.tsx. It names ten columns
--     explicitly (service_code, title, retail_price_php, billing_period,
--     is_active, is_pax_priced, pax_floor, pax_floor_price_php,
--     pax_increment_size, pax_increment_price_php) and none of them is denied
--     here. Post-condition (c) asserts all ten survive.
--
-- SQL callers were checked too, because a TS grep cannot see one: exactly one
-- function in `public` reads this table in its body — `event_comp_active_skus`
-- (20270322869207) — and it is SECURITY DEFINER, so it runs as its owner and no
-- session-role grant reaches it. There are NO views over this table and no
-- `'use client'` file reads it.
--
-- 🔑 SO THE HONEST FINDING IS THAT `anon` HAS NO READER AT ALL TODAY. Public
-- price reads happen SERVER-SIDE through the service-role client, not through
-- the browser's key — `/pricing` renders from fetchV2CustomerCatalog(). anon is
-- nevertheless kept on the allow-list rather than revoked outright, because the
-- catalogue is a DELIBERATELY world-readable price list (20271139128584 says so
-- in as many words) and retiring that is an owner's call, not a side effect of
-- a margin fix. Revoking `anon` entirely is a one-line follow-up if the owner
-- wants it; this migration is the strictly-safer half.
--
-- ── THE FOUR DENIED COLUMNS ─────────────────────────────────────────────────
--   saas_overhead_cost_php  our cost per SKU · the margin leak this fixes
--   retirement_reason       free-text internal rationale for pulling a SKU
--   retired_by_admin_id     auth.users UUID of a Setnayan staff account
--   updated_by_admin_id     auth.users UUID of a Setnayan staff account
--
-- The last three are opportunistic and were found by the same audit; they are
-- internal bookkeeping with zero session-role readers. They are denied "if
-- present" rather than asserted to exist — see the tolerance note below.
--
-- ── WRITES GO TOO ───────────────────────────────────────────────────────────
-- The table-level grant is `arwdDxtm`, so `anon` nominally holds INSERT/UPDATE/
-- DELETE on the price list; only the ABSENCE of a write policy stops it. That
-- is one mechanism deep, and SEC-4b (20271008178212) is this project's costed
-- lesson in not leaving it there. All 12 catalogue writes in apps/web go
-- through `createAdminClient()`, so REVOKE ALL costs nothing and removes the
-- second mechanism's dependence on the first.
--
-- REVERSIBLE: `GRANT ALL ON public.platform_retail_catalog_v2 TO anon,
-- authenticated;` restores the previous state exactly.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  -- Denied to anon + authenticated. service_role keeps everything.
  denied_columns TEXT[] := ARRAY[
    'saas_overhead_cost_php',
    'retirement_reason',
    'retired_by_admin_id',
    'updated_by_admin_id'
  ];
  present_denied TEXT[];
  allowed        TEXT;
BEGIN
  -- 1. The column this migration EXISTS for must exist. A typo here would deny
  --    nothing and the migration would "pass" vacuously.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'platform_retail_catalog_v2'
       AND column_name  = 'saas_overhead_cost_php'
  ) THEN
    RAISE EXCEPTION
      'refusing to apply: platform_retail_catalog_v2.saas_overhead_cost_php does not exist';
  END IF;

  -- 2. The other three are denied IF PRESENT, deliberately not asserted.
  --    They are opportunistic hardening, not the point of this file, and a hard
  --    RAISE on an absent bonus column would fail `db push` — which on this
  --    project does not fail alone: deploy-prod runs `db push --include-all`
  --    BEFORE the Vercel hook, fail-closed, so one refusing migration strands
  --    every subsequent merge (2026-09-02 cost seven PRs and three hours).
  --    Denying what is there is the whole benefit at none of that risk.
  SELECT array_agg(c ORDER BY c) INTO present_denied
  FROM unnest(denied_columns) AS c
  WHERE EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'platform_retail_catalog_v2'
       AND column_name  = c
  );

  -- 3. Compute the allow-list from the live catalog: everything MINUS the
  --    deny-set. Never hand-enumerated — a hand-typed list is how a legitimate
  --    read gets silently broken, and this table gains columns often.
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO allowed
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'platform_retail_catalog_v2'
    AND column_name <> ALL (present_denied);

  IF allowed IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: computed allow-list is empty';
  END IF;

  -- 4. Table-level privilege must go FIRST — Postgres cannot subtract a column
  --    from a table-level grant. ALL, not just SELECT: see the writes note.
  EXECUTE 'REVOKE ALL ON public.platform_retail_catalog_v2 FROM anon, authenticated';
  EXECUTE format(
    'GRANT SELECT (%s) ON public.platform_retail_catalog_v2 TO anon, authenticated',
    allowed
  );

  -- 5. Restate service_role's full access explicitly. It already holds this in
  --    prod (Supabase default privileges), so this is a no-op there — but it
  --    makes the migration self-sufficient rather than assuming HOW service_role
  --    acquired its grant, and keeps the post-conditions meaningful on a
  --    freshly-built database.
  EXECUTE 'GRANT ALL ON public.platform_retail_catalog_v2 TO service_role';

  RAISE NOTICE 'platform_retail_catalog_v2: denied % column(s) to anon+authenticated',
    coalesce(array_length(present_denied, 1), 0);
END $$;

-- ----------------------------------------------------------------------------
-- Post-conditions — asserted against the REAL catalog, so a half-applied or
-- silently-ineffective grant fails the migration instead of shipping.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  bad TEXT[] := ARRAY[]::TEXT[];
  c   TEXT;
  p   TEXT;
BEGIN
  -- (a) THE POINT. The cost is unreadable by both session roles, for every
  --     privilege — not just SELECT. A stranger cannot read it, and cannot
  --     probe it through a WHERE/ORDER BY either: Postgres requires SELECT on
  --     any column named in a predicate, so `?saas_overhead_cost_php=gt.100`
  --     and `?order=saas_overhead_cost_php` now fail too. A policy re-scope
  --     would not have touched those.
  FOREACH p IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE'] LOOP
    IF has_column_privilege('anon', 'public.platform_retail_catalog_v2',
                            'saas_overhead_cost_php', p)
       OR has_column_privilege('authenticated', 'public.platform_retail_catalog_v2',
                               'saas_overhead_cost_php', p) THEN
      bad := array_append(bad, 'cost-still-' || lower(p) || 'able');
    END IF;
  END LOOP;

  -- (b) the three bonus columns, each only if it exists on this database.
  FOREACH c IN ARRAY ARRAY[
    'retirement_reason', 'retired_by_admin_id', 'updated_by_admin_id'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name   = 'platform_retail_catalog_v2'
         AND column_name  = c
    ) AND (
      has_column_privilege('anon', 'public.platform_retail_catalog_v2', c, 'SELECT')
      OR has_column_privilege('authenticated', 'public.platform_retail_catalog_v2', c, 'SELECT')
    ) THEN
      bad := array_append(bad, 'still-readable:' || c);
    END IF;
  END LOOP;

  -- (c) THE PRICE STAYS PUBLIC. These are the exact columns the shipped readers
  --     select through a session client — the ten from the supplier
  --     recommendations page, plus the customer-facing display fields. If any
  --     lost SELECT, a signed-in supplier's picker goes blank and any future
  --     browser-side price read 42501s. An over-eager edit that adds one of
  --     these to the deny-set fails HERE, not in production.
  FOREACH c IN ARRAY ARRAY[
    'service_code', 'title', 'retail_price_php', 'billing_period', 'is_active',
    'is_pax_priced', 'pax_floor', 'pax_floor_price_php', 'pax_increment_size',
    'pax_increment_price_php', 'is_token_able', 'description'
  ] LOOP
    IF NOT has_column_privilege('authenticated', 'public.platform_retail_catalog_v2', c, 'SELECT')
       OR NOT has_column_privilege('anon', 'public.platform_retail_catalog_v2', c, 'SELECT') THEN
      bad := array_append(bad, 'lost-public-read:' || c);
    END IF;
  END LOOP;

  -- (d) the writes are shut at the grant layer, not merely at the policy layer.
  IF has_table_privilege('anon', 'public.platform_retail_catalog_v2', 'INSERT')
     OR has_table_privilege('anon', 'public.platform_retail_catalog_v2', 'UPDATE')
     OR has_table_privilege('anon', 'public.platform_retail_catalog_v2', 'DELETE')
     OR has_table_privilege('authenticated', 'public.platform_retail_catalog_v2', 'INSERT')
     OR has_table_privilege('authenticated', 'public.platform_retail_catalog_v2', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.platform_retail_catalog_v2', 'DELETE') THEN
    bad := array_append(bad, 'write-grant-survived');
  END IF;

  -- (e) service_role must be entirely unaffected — it is now the ONLY way to
  --     read the cost, so this assert is load-bearing for /admin/pricing, the
  --     pricing report and fetchV2CustomerCatalog.
  IF NOT has_table_privilege('service_role', 'public.platform_retail_catalog_v2', 'SELECT')
     OR NOT has_column_privilege('service_role', 'public.platform_retail_catalog_v2',
                                 'saas_overhead_cost_php', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.platform_retail_catalog_v2', 'UPDATE') THEN
    bad := array_append(bad, 'service_role-lost-access');
  END IF;

  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'catalog margin post-condition failed: %', array_to_string(bad, ', ');
  END IF;
END $$;

COMMENT ON COLUMN public.platform_retail_catalog_v2.saas_overhead_cost_php IS
  'INTERNAL — our per-SKU model/vendor cost. NOT readable by anon/authenticated '
  'since 20271201188010; read it with the service-role client only. Subtracting '
  'it from retail_price_php is our margin, so it must never reach a browser. '
  'Guarded by apps/web/tests/db/the-catalog-keeps-its-margin.db.test.ts.';

COMMIT;

-- ============================================================================
-- ⚠ MAINTENANCE NOTE FOR FUTURE MIGRATIONS
--
-- The allow-list is a snapshot taken at apply time. A column added to
-- public.platform_retail_catalog_v2 AFTER this migration is NOT SELECT-granted
-- to anon/authenticated. That is fail-CLOSED (safe) but LOUD: PostgREST refuses
-- the WHOLE query that names it, with 42501 — not just that column. On `events`
-- this exact trap took three shipped screens dark for weeks (20271179873885).
--
-- So every `ALTER TABLE public.platform_retail_catalog_v2 ADD COLUMN` from here
-- on must decide, in the same migration, one of two things:
--
--   • it is customer-facing →
--       GRANT SELECT (new_col) ON public.platform_retail_catalog_v2
--         TO anon, authenticated;
--   • it is internal (a cost, a margin, an admin identity, a private note) →
--       add it to DENIED_COLUMNS in
--       apps/web/tests/db/the-catalog-keeps-its-margin.db.test.ts.
--
-- That test fails with this exact instruction when a column is neither granted
-- nor deliberately denied, so this cannot rot silently.
-- ============================================================================

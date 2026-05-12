-- RLS audit query per 02_Specifications/RLS_Policy_Pattern.md § 9.
-- Non-empty result on any branch fails the CI deploy gate.

-- A) Tables with RLS disabled (security gap)
SELECT 'A: rls_disabled' AS category, schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = pg_tables.tablename
      AND n.nspname = pg_tables.schemaname
      AND c.relrowsecurity = TRUE
  )

UNION ALL

-- B) Tables with RLS enabled but no policies (locks legitimate access too)
SELECT 'B: rls_no_policy' AS category, t.schemaname, t.tablename
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = t.tablename
      AND n.nspname = t.schemaname
      AND c.relrowsecurity = TRUE
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = t.tablename
      AND n.nspname = t.schemaname
  )

UNION ALL

-- C) Anon-granted public tables without any policy (over-broad GRANT)
SELECT 'C: anon_grant_no_policy' AS category, table_schema AS schemaname, table_name AS tablename
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
  AND table_schema = 'public'
  AND privilege_type = 'SELECT'
  AND table_name NOT IN (
    SELECT c.relname FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
  );

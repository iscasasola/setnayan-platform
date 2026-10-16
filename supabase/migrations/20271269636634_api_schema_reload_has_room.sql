-- api_schema_reload_has_room
--
-- WHY (measured 2026-10-16, Supabase postgrest_logs + postgres_logs):
-- Every time Supabase Realtime's tenant restarts it runs "Creating partitions
-- for realtime.messages". That DDL fires PostgREST's ddl watch, and PostgREST
-- reloads its whole schema cache (5 reload messages per restart, ~13 restarts
-- a day). The schema-cache query runs as `authenticator`, whose
-- statement_timeout was 8s. It usually takes ~0.6 s, but pg_stat_statements
-- shows a max of 7.9 s. When it crosses 8 s, Postgres cancels it (57014).
-- PostgREST then answers EVERY API call with PGRST002 "Could not query the
-- database for the schema cache. Retrying." until a retry succeeds. That
-- happened 2026-10-15 16:37 (306 failed calls) and 2026-10-16 07:35:18 →
-- 07:36:06. /dashboard took 20 s+ for the owner in that window.
--
-- WHAT: give `authenticator` 30 s, so a slow reload finishes instead of
-- failing. API REQUESTS ARE NOT AFFECTED. PostgREST applies the impersonated
-- role's own timeout per request (anon 3 s, authenticated 8 s, both
-- unchanged). service_role has no timeout of its own and FALLS BACK to
-- authenticator's, so it is pinned at the 8 s it has today. Without that
-- pin, this change would quietly let service-role calls run 30 s.
--
-- Allowed on Supabase: supautils.reserved_roles lists `authenticator*` and
-- `service_role*`, and the `*` means the privileged role may ALTER ROLE … SET
-- on them. Supabase's own timeouts guide documents
-- `alter role … set statement_timeout` and the `reload config` NOTIFY below.
--
-- Idempotent: ALTER ROLE … SET simply overwrites the value. The test replay
-- (PGlite) has no `authenticator` role, so that statement is guarded.
-- Re-measure with:
--   select rolname, rolconfig from pg_roles
--   where rolname in ('authenticator','service_role','anon','authenticated');

ALTER ROLE service_role SET statement_timeout = '8s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    EXECUTE 'ALTER ROLE authenticator SET statement_timeout = ''30s''';
  END IF;
END
$$;

NOTIFY pgrst, 'reload config';

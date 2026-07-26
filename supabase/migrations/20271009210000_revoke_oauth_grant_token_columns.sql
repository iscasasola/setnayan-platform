-- ============================================================================
-- SEC-8 · `oauth_grants.refresh_token` / `.access_token` are readable through
--         PostgREST by any couple member of the event.
--
-- Found 2026-07-26, during the same audit that produced SEC-1..SEC-7. Same
-- root cause as every one of them, and literally the same shape as SEC-2b:
-- **RLS is ROW-level and can never hide a COLUMN.**
--
-- ── WHAT WAS TRUE IN PRODUCTION (verified against the live catalog) ─────────
--   · `public.oauth_grants` stores Google credentials in PLAINTEXT:
--     `refresh_token` (long-lived) and `access_token`.
--   · TABLE-level SELECT was granted to BOTH `anon` and `authenticated`, and
--     `has_column_privilege(...,'SELECT')` returned true for EVERY column of
--     the table for BOTH roles — tokens included.
--   · RLS is ON, with two PERMISSIVE policies, both `TO authenticated`:
--       admin_manages_oauth_grants        · is_admin()                 · cmd *
--       event_member_reads_oauth_grants   · event_id IN
--                                           current_couple_event_ids() · SELECT
--   · `anon` is NOT the exposure: no policy names it, so it matches zero rows.
--     It is revoked below anyway — a future `TO public` policy must not be the
--     thing that decides whether a credential is world-readable.
--   · `authenticated` IS the exposure. `event_member_reads_oauth_grants` admits
--     every couple member of the event to the ROW; nothing then withheld the
--     COLUMN. So:
--         GET /rest/v1/oauth_grants?select=refresh_token
--     returned a live, long-lived Google credential to any couple member —
--     with curl, without ever loading a Setnayan page.
--   · Live data at the time of writing: 2 rows — one UNREVOKED `drive` grant
--     (external_account_display = the owner's Google address) and one revoked
--     `youtube` grant. `metadata` was inspected and carries no token material
--     (keys: picture_url, account_name, drive_folder_id, drive_subfolders,
--     drive_folder_name, thumbnail_url), so it stays readable.
--
-- ── SCALE, HONESTLY ────────────────────────────────────────────────────────
-- There has been ONE signup ever, so today the only person who can do this is
-- reading their own token, and there is no evidence of any breach. The reason
-- to fix it now is what it becomes at 5,000 weddings: partner A can lift
-- partner B's Google Drive refresh token, and ANY couple member holds a bearer
-- credential to the connected Google account — a credential that outlives the
-- wedding, is not scoped to Setnayan's UI, and cannot be un-leaked.
--
-- ── WHY A COLUMN REVOKE AND NOT A POLICY CHANGE ────────────────────────────
-- Tightening `event_member_reads_oauth_grants` would break the couple-facing
-- "Connected to Drive as <email>" surfaces, which legitimately read
-- external_account_display / granted_at / connection_health / metadata off the
-- same rows. The row policy is correct; only two columns are wrong. A
-- column-level denial is the minimum cut.
--
-- ⚠ THE NAIVE FIX IS A NO-OP. Postgres: "if a role has been granted privileges
--   on a table, then revoking the same privileges from individual columns will
--   have no effect." Both roles hold TABLE-level SELECT here, so
--     REVOKE SELECT (refresh_token, access_token) ON public.oauth_grants
--       FROM anon, authenticated;
--   applies without error and changes nothing. Table-level SELECT must be
--   revoked FIRST and an explicit column list granted back — the shape SEC-2b
--   (20271008731642) established on `events`.
--
-- ── EVERY TOKEN READER WAS CHECKED, AND EVERY ONE IS ALREADY service_role ───
-- Nothing needed to move for this revoke to be safe (audited 2026-07-26 across
-- the whole of apps/web; all seven use `createAdminClient()`):
--   app/api/cron/oauth-refresh/route.ts:79           refresh_token
--   app/api/oauth/drive/disconnect/route.ts:84       refresh_token
--   app/api/oauth/youtube/disconnect/route.ts:69     refresh_token
--   app/api/photo-delivery/disconnect/route.ts:61    refresh_token
--   app/dashboard/[eventId]/studio/photo-delivery/actions.ts:203
--                                                    refresh_token  (a server
--     action: it authenticates the caller with the SESSION client, then does
--     the grant read on the ADMIN client — the pattern that makes this safe)
--   lib/drive-copy.ts:425            refresh_token + access_token (+ refresh write)
--   lib/photo-delivery-release.ts:479 refresh_token + access_token (+ refresh write)
-- The three OAuth callbacks (drive / youtube / photo-delivery) WRITE tokens,
-- also on the admin client. Every couple-facing read is token-free — the
-- widest is the Panood setup page's
-- `grant_id, external_account_id, external_account_display, granted_at, metadata`.
-- So Drive/YouTube connect, the refresh cron and disconnect are all unaffected.
--
-- ── WRITES ARE DELIBERATELY LEFT ALONE ─────────────────────────────────────
-- `authenticated` keeps table-level INSERT/UPDATE, which sounds worse than it
-- is: RLS gates writes ROW-wise, and the only write policy is
-- `admin_manages_oauth_grants` (is_admin()). A non-admin matches zero rows for
-- UPDATE, so there is no write path to close and no behaviour to risk. The
-- SELECT hole existed precisely because the read policy DOES match.
-- ============================================================================

DO $$
DECLARE
  -- The plaintext credentials. Everything else on the row is connection
  -- metadata the couple's own "Connected as…" UI renders.
  secret_columns TEXT[] := ARRAY['refresh_token', 'access_token'];
  missing TEXT[];
  rle     TEXT;
  allowed TEXT;
BEGIN
  -- Fail loudly on a rename: a misspelled entry would deny nothing and this
  -- migration would ship a green no-op.
  SELECT array_agg(c) INTO missing
  FROM unnest(secret_columns) AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'oauth_grants' AND column_name = c
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'secret_columns names non-existent oauth_grants column(s): %',
      array_to_string(missing, ', ');
  END IF;

  FOREACH rle IN ARRAY ARRAY['authenticated', 'anon'] LOOP
    -- Computed from LIVE privileges, not from the full catalog. That makes this
    -- a UNION with the `granted_by_user_id` denial applied minutes earlier by
    -- 20271009200000 rather than a silent undo of it — post-condition (b)
    -- proves the union held.
    SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
      INTO allowed
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name   = 'oauth_grants'
      AND c.column_name <> ALL (secret_columns)
      AND has_column_privilege(rle, 'public.oauth_grants', c.column_name, 'SELECT');

    IF allowed IS NULL THEN
      RAISE EXCEPTION 'refusing to apply: computed oauth_grants allow-list for % is empty', rle;
    END IF;

    EXECUTE format('REVOKE SELECT ON public.oauth_grants FROM %I', rle);
    EXECUTE format('GRANT SELECT (%s) ON public.oauth_grants TO %I', allowed, rle);
  END LOOP;

  -- The server side must keep its full read. True already via Supabase default
  -- privileges; restated so a freshly-built database matches prod and so the
  -- post-condition is meaningful rather than accidentally satisfied.
  EXECUTE 'GRANT SELECT ON public.oauth_grants TO service_role';
END $$;

COMMENT ON COLUMN public.oauth_grants.refresh_token IS
  'Plaintext Google refresh token. SELECT is REVOKED from anon + authenticated (SEC-8, 20271009210000): RLS is row-level and the couple-read policy admits every event member to the row, so nothing but a column revoke can withhold it. Read it ONLY through a service-role client (lib/drive-copy.ts, lib/photo-delivery-release.ts, /api/cron/oauth-refresh, the three OAuth callbacks and the three disconnect routes). If a new surface needs it, that surface belongs on the server — do not re-grant.';

COMMENT ON COLUMN public.oauth_grants.access_token IS
  'Plaintext Google access token. SELECT is REVOKED from anon + authenticated (SEC-8, 20271009210000) — see refresh_token. Short-lived, but a bearer credential all the same.';

-- ----------------------------------------------------------------------------
-- Post-conditions — assert against the REAL catalog, in the house style of
-- 20271008731642, so a silently-ineffective grant fails the migration rather
-- than shipping and looking fixed.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  bad TEXT[] := ARRAY[]::TEXT[];
  c   TEXT;
BEGIN
  -- (a) THE FINDING. Neither browser role may SELECT either credential.
  FOREACH c IN ARRAY ARRAY['refresh_token', 'access_token'] LOOP
    IF has_column_privilege('authenticated', 'public.oauth_grants', c, 'SELECT') THEN
      bad := array_append(bad, 'authenticated can still SELECT ' || c);
    END IF;
    IF has_column_privilege('anon', 'public.oauth_grants', c, 'SELECT') THEN
      bad := array_append(bad, 'anon can still SELECT ' || c);
    END IF;
  END LOOP;

  -- (b) UNION ASSERT. 20271009200000 denied granted_by_user_id on this same
  --     table. If the allow-list above were ever recomputed from the full
  --     catalog instead of from live privileges, that denial would come back
  --     silently and the erasure-attribution column would be host-writable
  --     again. This is the assertion that notices.
  IF has_column_privilege('authenticated', 'public.oauth_grants', 'granted_by_user_id', 'SELECT')
     OR has_column_privilege('anon', 'public.oauth_grants', 'granted_by_user_id', 'SELECT') THEN
    bad := array_append(bad, 'regressed the 20271009200000 granted_by_user_id denial');
  END IF;

  -- (c) the couple-facing connection UI must survive. These are the exact
  --     columns the browser reads today: the Panood setup page's projection,
  --     the Papic + Photo-Delivery "Connected as… / needs reconnect" panels,
  --     and the several `select('grant_id')` existence probes.
  FOREACH c IN ARRAY ARRAY[
    'grant_id','event_id','provider','scopes','access_token_expires_at',
    'external_account_id','external_account_display','granted_at','revoked_at',
    'last_refreshed_at','metadata','connection_health'
  ] LOOP
    IF NOT has_column_privilege('authenticated', 'public.oauth_grants', c, 'SELECT') THEN
      bad := array_append(bad, 'lost couple SELECT on ' || c);
    END IF;
  END LOOP;

  -- (d) the SERVER must be untouched — this is what keeps Drive/YouTube
  --     connect, the refresh cron and disconnect working. If this ever fails,
  --     photo delivery and Live Studio stop, loudly.
  IF NOT has_table_privilege('service_role', 'public.oauth_grants', 'SELECT')
     OR NOT has_column_privilege('service_role', 'public.oauth_grants', 'refresh_token', 'SELECT')
     OR NOT has_column_privilege('service_role', 'public.oauth_grants', 'access_token', 'SELECT')
     OR NOT has_column_privilege('service_role', 'public.oauth_grants', 'access_token', 'UPDATE') THEN
    bad := array_append(bad, 'service_role lost its token access');
  END IF;

  -- (e) RLS must still be ON. A column revoke is not a substitute for the row
  --     policy, and turning RLS off here would expose every event's grant row.
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'oauth_grants' AND c.relrowsecurity
  ) THEN
    bad := array_append(bad, 'RLS is not enabled on oauth_grants');
  END IF;

  IF array_length(bad, 1) > 0 THEN
    RAISE EXCEPTION 'SEC-8 oauth_grants token revoke post-condition failed: %',
      array_to_string(bad, '; ');
  END IF;
END $$;

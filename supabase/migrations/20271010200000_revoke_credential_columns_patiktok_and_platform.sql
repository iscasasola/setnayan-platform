-- ============================================================================
-- SEC-8b · The SEC-8 twin, plus two more tables of the same class.
--
-- SEC-8 (20271009210000) took the plaintext Google credentials on
-- `public.oauth_grants` off the browser read surface. This file does the same
-- for every remaining credential column that `anon` or `authenticated` can
-- still SELECT. Same root cause as SEC-2b and SEC-8:
-- **RLS is ROW-level and can never hide a COLUMN.**
--
-- Three tables, and they are NOT equally dangerous. Stated separately on
-- purpose, because collapsing them would overstate two and understate one.
--
-- ── (1) public.patiktok_oauth_grants — THE EXPLOITABLE SHAPE ────────────────
-- Verified against the live catalog 2026-07-26:
--   · Stores TikTok credentials in PLAINTEXT: `access_token`, `refresh_token`.
--   · has_column_privilege(...,'SELECT') was TRUE for BOTH `anon` and
--     `authenticated` on ALL 15 columns, tokens included.
--   · RLS is ON with two PERMISSIVE policies, both `TO authenticated`:
--       admin_writes_oauth_grants          · is_admin()                  · cmd *
--       couple_reads_patiktok_oauth_grants · event_id IN
--                                            current_couple_event_ids()  · SELECT
--   · `anon` is not the exposure — no policy names it, so it matches zero rows.
--     Revoked anyway: a future `TO public` policy must not be the thing that
--     decides whether a credential is world-readable.
--   · `authenticated` IS the exposure, exactly as in SEC-8. The couple-read
--     policy admits every couple member of the event to the ROW and nothing
--     then withheld the COLUMN, so
--         GET /rest/v1/patiktok_oauth_grants?select=refresh_token
--     would have returned a live TikTok credential to any couple member, with
--     curl, without loading a Setnayan page.
--
--   DORMANT, NOT SAFE. The table holds 0 rows today because Patiktok has issued
--   no grants — `publishPatiktokCompilation` (apps/web/lib/patiktok-tiktok.ts)
--   still returns {ok:false, reason:'not-implemented'} and the connect CTA only
--   renders when the TikTok app is configured. Fixing it while it is empty costs
--   nothing; the alternative is that the feature ships already-broken and the
--   first real grant is exposed from the moment it is written.
--
-- ── (2) public.platform_integration_secrets — NOT reachable, one policy away ─
-- NINE `_enc` columns were SELECTable by both browser roles:
--   google_drive_oauth_client_secret_enc · maya_public_api_key_enc ·
--   maya_secret_api_key_enc · meta_page_access_token_enc · openai_api_key_enc ·
--   resend_api_key_enc · tiktok_access_token_enc · tiktok_client_secret_enc ·
--   youtube_oauth_client_secret_enc
--
--   These are not per-event or per-user data. They are SETNAYAN'S OWN
--   platform-wide credentials, and there is 1 live row.
--
--   ⚠ It is NOT currently exploitable, and this file does not claim otherwise:
--   RLS is ON and the table has **ZERO policies**, so `anon` and
--   `authenticated` match no rows at all. The column grants are inert.
--
--   It is fixed here because inert is not the same as safe. The only thing
--   standing between the public internet and every platform credential is the
--   absence of a policy — so the day anyone adds one for a legitimate reason
--   ("let admins read this in the dashboard"), nine secrets become readable by
--   whoever that policy admits, silently, with no second line of defence. That
--   is precisely the failure this audit has now hit four times. Values are
--   encrypted at rest, which lowers the severity but is not a reason to publish
--   the ciphertext.
--
-- ── (3) public.vendor_ig_connections.access_token_enc — inconsistent ────────
--   `authenticated` was ALREADY revoked on this column; `anon` was not. There is
--   no anon policy, so it is unreachable, and the table holds 0 rows. This is
--   tidy-up of a half-applied revoke, finished so the pair cannot drift apart.
--
-- ── WHY A COLUMN REVOKE AND NOT A POLICY CHANGE ────────────────────────────
-- For (1) the row policy is CORRECT — the couple legitimately reads
-- `tiktok_handle, tiktok_open_id, expires_at` to render "Connected as @handle"
-- (app/dashboard/[eventId]/studio/patiktok/page.tsx:159-164). Only two columns
-- are wrong. A column-level denial is the minimum cut.
--
-- ⚠ THE NAIVE FIX IS A NO-OP AGAINST PRODUCTION. Postgres: "if a role has been
--   granted privileges on a table, then revoking the same privileges from
--   individual columns will have no effect." All three tables hold TABLE-level
--   SELECT for the roles being restricted, so
--     REVOKE SELECT (access_token, refresh_token) ON public.patiktok_oauth_grants
--       FROM anon, authenticated;
--   applies without error and changes nothing. Hence REVOKE-then-GRANT with the
--   allow-list computed from LIVE privileges, so this UNIONs with any earlier
--   denial instead of silently undoing it. Same shape as 20271009210000
--   (SEC-8) and 20271008731642 (SEC-2b).
--
-- ── EVERY READER WAS AUDITED FIRST; NOTHING HAD TO MOVE ────────────────────
-- patiktok_oauth_grants (whole of apps/web, 2026-07-26):
--   · studio/patiktok/page.tsx:159-164 — SESSION client, selects
--     `tiktok_handle, tiktok_open_id, expires_at`. Token-free. Still works.
--   · studio/patiktok/actions.ts:641-650 — session client is used only for the
--     `event_members` couple check; the grant UPDATE runs on createAdminClient().
--   · api/tiktok/auth/callback/route.ts:50,99,109 — createAdminClient(), WRITES.
--   · api/cron/oauth-refresh/route.ts:146 — does not touch this table; its
--     tiktok branch short-circuits with 'provider_not_yet_implemented'.
--   · lib/patiktok-tiktok.ts — names access_token only in a TYPE and a comment;
--     it issues no read of this table today.
--   ⇒ There is NO session-client token reader. Connect / disconnect / the
--     "Connected as…" panel are all unaffected.
-- platform_integration_secrets: all readers go through createAdminClient()
--   (lib/integration-config.ts, lib/integrations/write.ts, lib/secrets/*,
--   admin/secrets/page.tsx, admin/integrations/*). They must already, since the
--   table has no policies — a session-client read would return zero rows today.
-- vendor_ig_connections: vendor-dashboard/instagram-actions.ts,
--   api/vendor/instagram/callback, lib/vendor-instagram-status.ts.
--
-- ── WRITES ARE DELIBERATELY LEFT ALONE ─────────────────────────────────────
-- Same reasoning as SEC-8: RLS gates writes ROW-wise, and on
-- patiktok_oauth_grants the only write policy is admin_writes_oauth_grants
-- (is_admin()), so a non-admin matches zero rows for UPDATE. The SELECT hole
-- existed precisely because the READ policy does match.
-- ============================================================================

DO $$
DECLARE
  -- table_name → the credential columns to take off the browser read surface.
  targets JSONB := jsonb_build_object(
    'patiktok_oauth_grants',        jsonb_build_array('access_token', 'refresh_token'),
    'platform_integration_secrets', jsonb_build_array(
      'google_drive_oauth_client_secret_enc', 'maya_public_api_key_enc',
      'maya_secret_api_key_enc', 'meta_page_access_token_enc',
      'openai_api_key_enc', 'resend_api_key_enc', 'tiktok_access_token_enc',
      'tiktok_client_secret_enc', 'youtube_oauth_client_secret_enc'),
    'vendor_ig_connections',        jsonb_build_array('access_token_enc')
  );
  tbl      TEXT;
  secrets  TEXT[];
  missing  TEXT[];
  rle      TEXT;
  allowed  TEXT;
BEGIN
  FOR tbl IN SELECT jsonb_object_keys(targets) LOOP
    SELECT array_agg(value::TEXT) INTO secrets
    FROM jsonb_array_elements_text(targets -> tbl) AS value;

    -- Fail loudly on a rename: a misspelled entry would deny nothing and this
    -- migration would ship a green no-op.
    SELECT array_agg(c) INTO missing
    FROM unnest(secrets) AS c
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = c
    );
    IF missing IS NOT NULL THEN
      RAISE EXCEPTION 'SEC-8b names non-existent %(%) column(s)', tbl, array_to_string(missing, ', ');
    END IF;

    FOREACH rle IN ARRAY ARRAY['authenticated', 'anon'] LOOP
      -- Computed from LIVE privileges, not from the full catalog, so this is a
      -- UNION with any earlier denial rather than a silent undo of it.
      SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
        INTO allowed
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name   = tbl
        AND c.column_name <> ALL (secrets)
        AND has_column_privilege(rle, format('public.%I', tbl), c.column_name, 'SELECT');

      -- NOTE: unlike SEC-8, an empty allow-list is LEGITIMATE here.
      -- vendor_ig_connections already denies `authenticated` everything, and a
      -- future table could too. Revoke and grant nothing back; do not RAISE.
      EXECUTE format('REVOKE SELECT ON public.%I FROM %I', tbl, rle);
      IF allowed IS NOT NULL THEN
        EXECUTE format('GRANT SELECT (%s) ON public.%I TO %I', allowed, tbl, rle);
      END IF;
    END LOOP;

    -- The server side must keep its full read. True already via Supabase
    -- default privileges; restated so a freshly-built database matches prod and
    -- the post-condition is meaningful rather than accidentally satisfied.
    EXECUTE format('GRANT SELECT ON public.%I TO service_role', tbl);
  END LOOP;
END $$;

COMMENT ON COLUMN public.patiktok_oauth_grants.refresh_token IS
  'Plaintext TikTok refresh token. SELECT is REVOKED from anon + authenticated (SEC-8b, 20271010200000): RLS is row-level and couple_reads_patiktok_oauth_grants admits every couple member of the event to the row, so nothing but a column revoke can withhold it. Read it ONLY through a service-role client. If a new surface needs it, that surface belongs on the server — do not re-grant.';

COMMENT ON COLUMN public.patiktok_oauth_grants.access_token IS
  'Plaintext TikTok access token. SELECT is REVOKED from anon + authenticated (SEC-8b, 20271010200000) — see refresh_token. Short-lived, but a bearer credential all the same.';

-- ----------------------------------------------------------------------------
-- Post-conditions — assert against the REAL catalog, in the house style of
-- 20271009210000, so a silently-ineffective revoke fails the migration rather
-- than shipping and looking fixed.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  bad TEXT[] := ARRAY[]::TEXT[];
  c   TEXT;
  t   TEXT;
BEGIN
  -- (a) THE FINDING. No browser role may SELECT any credential column.
  FOREACH c IN ARRAY ARRAY['access_token', 'refresh_token'] LOOP
    IF has_column_privilege('authenticated', 'public.patiktok_oauth_grants', c, 'SELECT') THEN
      bad := array_append(bad, 'authenticated can still SELECT patiktok_oauth_grants.' || c);
    END IF;
    IF has_column_privilege('anon', 'public.patiktok_oauth_grants', c, 'SELECT') THEN
      bad := array_append(bad, 'anon can still SELECT patiktok_oauth_grants.' || c);
    END IF;
  END LOOP;

  FOREACH c IN ARRAY ARRAY[
    'google_drive_oauth_client_secret_enc','maya_public_api_key_enc',
    'maya_secret_api_key_enc','meta_page_access_token_enc','openai_api_key_enc',
    'resend_api_key_enc','tiktok_access_token_enc','tiktok_client_secret_enc',
    'youtube_oauth_client_secret_enc'
  ] LOOP
    IF has_column_privilege('authenticated', 'public.platform_integration_secrets', c, 'SELECT')
       OR has_column_privilege('anon', 'public.platform_integration_secrets', c, 'SELECT') THEN
      bad := array_append(bad, 'a browser role can still SELECT platform_integration_secrets.' || c);
    END IF;
  END LOOP;

  IF has_column_privilege('authenticated', 'public.vendor_ig_connections', 'access_token_enc', 'SELECT')
     OR has_column_privilege('anon', 'public.vendor_ig_connections', 'access_token_enc', 'SELECT') THEN
    bad := array_append(bad, 'a browser role can still SELECT vendor_ig_connections.access_token_enc');
  END IF;

  -- (b) the couple-facing TikTok connection UI must survive. These are the
  --     exact columns studio/patiktok/page.tsx reads today.
  FOREACH c IN ARRAY ARRAY['tiktok_handle', 'tiktok_open_id', 'expires_at'] LOOP
    IF NOT has_column_privilege('authenticated', 'public.patiktok_oauth_grants', c, 'SELECT') THEN
      bad := array_append(bad, 'lost couple SELECT on patiktok_oauth_grants.' || c);
    END IF;
  END LOOP;

  -- (c) the SERVER must be untouched — this is what keeps the TikTok callback,
  --     the admin secrets console and the Instagram connect flow working.
  FOREACH t IN ARRAY ARRAY[
    'patiktok_oauth_grants', 'platform_integration_secrets', 'vendor_ig_connections'
  ] LOOP
    IF NOT has_table_privilege('service_role', format('public.%I', t), 'SELECT') THEN
      bad := array_append(bad, 'service_role lost SELECT on ' || t);
    END IF;
  END LOOP;
  IF NOT has_column_privilege('service_role', 'public.patiktok_oauth_grants', 'refresh_token', 'SELECT')
     OR NOT has_column_privilege('service_role', 'public.platform_integration_secrets', 'maya_secret_api_key_enc', 'SELECT') THEN
    bad := array_append(bad, 'service_role lost credential access');
  END IF;

  -- (d) RLS must still be ON everywhere. A column revoke is not a substitute
  --     for the row policy.
  FOREACH t IN ARRAY ARRAY[
    'patiktok_oauth_grants', 'platform_integration_secrets', 'vendor_ig_connections'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c2 JOIN pg_namespace n ON n.oid = c2.relnamespace
       WHERE n.nspname = 'public' AND c2.relname = t AND c2.relrowsecurity
    ) THEN
      bad := array_append(bad, 'RLS is not enabled on ' || t);
    END IF;
  END LOOP;

  -- (e) DO NOT REGRESS SEC-8. If this file's allow-list were ever recomputed
  --     from the full catalog instead of from live privileges, the Google
  --     token denial on the SIBLING table could come back silently. Cheap to
  --     assert, and it is the exact mistake this pattern exists to prevent.
  IF has_column_privilege('authenticated', 'public.oauth_grants', 'refresh_token', 'SELECT')
     OR has_column_privilege('anon', 'public.oauth_grants', 'refresh_token', 'SELECT') THEN
    bad := array_append(bad, 'regressed the SEC-8 oauth_grants.refresh_token denial');
  END IF;

  IF array_length(bad, 1) > 0 THEN
    RAISE EXCEPTION 'SEC-8b credential revoke post-condition failed: %',
      array_to_string(bad, '; ');
  END IF;
END $$;

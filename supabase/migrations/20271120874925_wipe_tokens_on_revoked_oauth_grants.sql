-- A revoked OAuth grant must not still hold the key.
--
-- WHAT IS ACTUALLY WRONG (verified in LIVE PROD 2026-08-07, not inferred):
--   oauth_grants has 2 rows. One is a YouTube grant, granted 2026-07-25 and
--   REVOKED 2026-07-26, which still holds a 103-char refresh_token and a
--   253-char access_token, with connection_health still reading 'ok'. Someone
--   pressed Disconnect thirteen days ago and we are still holding a credential
--   that opens their Google account. A Google refresh token does not expire on
--   its own.
--
-- 🔑 THE REGISTER CALLED THIS "nobody cleaned up the one already there". THAT
--    UNDERSTATES IT. The wipe-on-disconnect was added to the YouTube route on
--    2026-07-27 and NEVER ADDED TO THE DRIVE ROUTE — which sets `revoked_at`
--    alone to this day. So it is not one stale row: it is a live path that
--    reproduces the row on the next Drive disconnect. Prod currently holds an
--    ACTIVE drive grant, so the very next Disconnect press would have done it
--    again. The route fix ships in this same PR.
--
-- ⚠ `refresh_token` is NOT NULL, so the wipe writes '' rather than NULL — the
--    same shape `lib/live-studio-channel-grants.ts` already uses for the
--    Setnayan-owned channel pool. `access_token` is nullable and goes to NULL.
--
-- SCOPE: only rows already marked revoked. An ACTIVE grant is untouched —
-- wiping one would break a working Drive or YouTube connection.
--
-- Idempotent: re-running matches nothing once the rows are clean.

UPDATE public.oauth_grants
   SET refresh_token = '',
       access_token  = NULL
 WHERE revoked_at IS NOT NULL
   AND (COALESCE(refresh_token, '') <> '' OR access_token IS NOT NULL);

-- Belt-and-braces for the OTHER credential store, which has the same shape.
-- live_studio_channel_grants already wipes on disconnect in code; this catches
-- any row that predates that behaviour. Guarded by to_regclass so the migration
-- is safe if the table is absent in a replay.
DO $$
BEGIN
  IF to_regclass('public.live_studio_channel_grants') IS NOT NULL THEN
    UPDATE public.live_studio_channel_grants
       SET refresh_token = '',
           access_token  = NULL
     WHERE revoked_at IS NOT NULL
       AND (COALESCE(refresh_token, '') <> '' OR access_token IS NOT NULL);
  END IF;
END $$;

COMMENT ON COLUMN public.oauth_grants.refresh_token IS
  'Google refresh token. MUST be wiped to '''' the moment revoked_at is set - a revoked grant that still holds a key is a credential we were asked to let go of. Both disconnect routes (drive, youtube) write refresh_token/access_token/revoked_at together; a third route must do the same.';

-- 0009/0012 Drive connect — connection health flag for the "needs reconnect" state.
--
-- Until now a refresh_token that fails at Google (the couple revoked access in
-- their Google security settings, or a password reset invalidated it) was
-- swallowed by the lazy token refreshers in lib/drive-copy.ts and
-- lib/photo-delivery-release.ts (`catch { return null }`). The couple kept
-- seeing "Connected" while uploads silently stalled, with no way to recover.
--
-- This column lets those refreshers record an invalid_grant so the couple-facing
-- surfaces can show a calm "Your Drive needs a quick reconnect" banner. It is
-- written on the single unified per-event grant (provider='drive') that both
-- the Papic drive-copy layer and the Photo Delivery release path consume.
--
--   'ok'           — refresh_token still valid (default, and on every successful refresh)
--   'needs_reauth' — Google rejected the refresh_token; couple must reconnect
--
-- RLS: oauth_grants already has RLS enabled at CREATE TABLE time; a column add
-- inherits the existing policies, so no policy change is required.

ALTER TABLE public.oauth_grants
  ADD COLUMN IF NOT EXISTS connection_health text NOT NULL DEFAULT 'ok'
    CHECK (connection_health IN ('ok', 'needs_reauth'));

COMMENT ON COLUMN public.oauth_grants.connection_health IS
  'Drive refresh-token health: ''ok'' or ''needs_reauth'' (set when Google rejects the refresh_token so the couple can be prompted to reconnect). Written by lib/drive-copy.ts + lib/photo-delivery-release.ts.';

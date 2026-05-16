-- ============================================================================
-- Iteration 0017 — Patiktok · Phase 3 · TikTok OAuth grants
-- ============================================================================
-- Personal-tier (₱1,999/day) couples link their own TikTok handle via OAuth so
-- the post-event compilation auto-uploads to their account. This migration
-- creates the per-event grant table that stores the access + refresh tokens.
--
-- Setnayan-tier (₱999/day) couples don't need a grant — videos go to the
-- platform-owned @SetnayanWeddings account using credentials held outside
-- per-event scope (TIKTOK_SETNAYAN_REFRESH_TOKEN env var, refreshed on
-- the worker side).
--
-- Tokens are stored encrypted-at-rest by Supabase Postgres + scoped by RLS
-- to the event's couple. The CSRF `state` table prevents callback replay.

CREATE TABLE IF NOT EXISTS public.patiktok_oauth_grants (
  grant_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  granted_by        UUID NOT NULL REFERENCES auth.users(id),
  -- TikTok identifiers (open_id is TikTok's stable per-app user identifier)
  tiktok_open_id    TEXT NOT NULL,
  tiktok_union_id   TEXT,
  tiktok_handle     TEXT,
  -- OAuth tokens
  access_token      TEXT NOT NULL,
  refresh_token     TEXT NOT NULL,
  scope             TEXT NOT NULL,
  expires_at        TIMESTAMPTZ NOT NULL,
  refreshed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Lifecycle
  revoked_at        TIMESTAMPTZ,
  revoked_reason    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.patiktok_oauth_grants IS
  'Iteration 0017 Phase 3 — per-event TikTok OAuth grants for Personal-tier couples. One active grant per event; revoke_at NULL filter applies.';

CREATE UNIQUE INDEX IF NOT EXISTS patiktok_oauth_grants_one_active_per_event
  ON public.patiktok_oauth_grants (event_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.patiktok_oauth_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_member_reads_oauth_grants ON public.patiktok_oauth_grants;
CREATE POLICY event_member_reads_oauth_grants ON public.patiktok_oauth_grants
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()));

-- Writes go through the server-only OAuth callback route using the service
-- role; no direct couple write policy needed. Admin can revoke.
DROP POLICY IF EXISTS admin_writes_oauth_grants ON public.patiktok_oauth_grants;
CREATE POLICY admin_writes_oauth_grants ON public.patiktok_oauth_grants
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- CSRF state table — short-lived nonces tying the OAuth start → callback
-- ----------------------------------------------------------------------------
-- The `state` query param sent to TikTok's authorize endpoint is a random
-- nonce we generated server-side. On callback we look it up to confirm the
-- code actually came back to OUR initiation (and to recover the event_id
-- the couple started from). Rows older than 10 min are deleted on each read.

CREATE TABLE IF NOT EXISTS public.patiktok_oauth_state (
  state_token   TEXT PRIMARY KEY,
  event_id      UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  initiated_by  UUID NOT NULL REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS patiktok_oauth_state_created_idx
  ON public.patiktok_oauth_state (created_at);

ALTER TABLE public.patiktok_oauth_state ENABLE ROW LEVEL SECURITY;

-- No couple-readable policy — only service-role (server routes) ever touches
-- this table. Admin can inspect.
DROP POLICY IF EXISTS admin_reads_oauth_state ON public.patiktok_oauth_state;
CREATE POLICY admin_reads_oauth_state ON public.patiktok_oauth_state
  FOR SELECT TO authenticated
  USING (public.is_admin());

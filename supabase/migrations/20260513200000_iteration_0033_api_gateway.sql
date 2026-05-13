-- ============================================================================
-- 20260513200000_iteration_0033_api_gateway.sql
-- Iteration 0033 Public API Foundation — gateway plumbing only.
--
-- Per the locked decision: "No public API endpoints in V1. Iteration 0033
-- plumbs the gateway only." This migration ships:
--   • api_keys table — one row per user-owned token. Stores the SHA-256
--     hash + a 16-char prefix for display. The raw key value is shown to
--     the user exactly once at creation and never persisted in plain text.
--   • Pattern A RLS — only the owning user can SELECT / UPDATE / DELETE
--     their keys. Hashes are looked up via the admin client during request
--     authentication, bypassing RLS.
--
-- Deferred:
--   • Scopes (read-only vs read-write vs per-resource) — V1 is all-access
--   • Rate limiting
--   • OAuth 2.0 flows
--   • Service-account vs user-account distinction
--   • Webhook delivery / subscriptions
--
-- Idempotent.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.api_keys (
  api_key_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id      TEXT UNIQUE NOT NULL DEFAULT public.generate_public_id('K'),
  user_id        UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  name           TEXT NOT NULL CHECK (length(name) > 0 AND length(name) <= 80),
  key_prefix     TEXT NOT NULL CHECK (length(key_prefix) <= 32),
  key_hash       TEXT NOT NULL UNIQUE,
  last_used_at   TIMESTAMPTZ,
  revoked_at     TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS api_keys_active_idx
  ON public.api_keys(user_id, created_at DESC)
  WHERE revoked_at IS NULL;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Pattern A: owner-only via auth.uid(). Auth-time lookups bypass via the
-- admin client (service-role), so the hash search isn't blocked by RLS.
DROP POLICY IF EXISTS api_keys_owner_read ON public.api_keys;
CREATE POLICY api_keys_owner_read
  ON public.api_keys FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS api_keys_owner_write ON public.api_keys;
CREATE POLICY api_keys_owner_write
  ON public.api_keys FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMIT;

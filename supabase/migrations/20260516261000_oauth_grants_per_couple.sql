-- ============================================================================
-- Shared OAuth foundation — per-couple OAuth grants for V1.5+ scaffold pages
-- ============================================================================
-- Created 2026-05-16 alongside the YouTube OAuth wiring for Panood
-- (iteration 0011). This table is the shared substrate for three scaffold-
-- level OAuth surfaces being shipped early per the 2026-05-16 owner
-- directive:
--
--   provider='youtube' — couple's BYO YouTube channel (iteration 0011 Panood)
--   provider='drive'   — couple's Google Drive folder (iteration 0012 Papic,
--                        Agent B follow-up)
--   provider='tiktok'  — Personal-tier handle (iteration 0017 Patiktok)
--
-- Note for the tiktok provider: iteration 0017 already shipped a
-- dedicated `patiktok_oauth_grants` table in
-- 20260516240000_iteration_0017_patiktok_oauth.sql. This shared table is
-- the future home for tiktok grants too, but the migration here does NOT
-- migrate or remove the existing patiktok_oauth_grants rows — that's a
-- follow-up consolidation. For now, Patiktok keeps its own table; new
-- providers (youtube, drive) write here.
--
-- V1 scope expansion rationale (see CLAUDE.md decision log 2026-05-16,
-- last entry "OAuth wiring for V1.5+ scaffold setup pages shipped early"):
-- couples should be able to connect their own accounts at setup time even
-- though the live broadcaster / Drive sync / TikTok render pipelines are
-- V1.5+ deliverables.
--
-- Graceful-fallback pattern: if the owner has not yet completed the
-- relevant Google/TikTok OAuth verified-app review, the Connect CTAs in
-- the UI degrade to a "coming soon — admin setup pending" placeholder and
-- the OAuth start routes return 503. Couples can ship V1 without
-- depending on the owner-side review timeline.
--
-- Token storage: refresh_token + access_token are TEXT for V1. Supabase
-- Postgres encrypts at rest. A pgcrypto encryption helper for
-- column-level encryption is a TODO(security) follow-up (see
-- 20260513020000_enable_pgcrypto.sql for the pgcrypto extension).

CREATE TABLE IF NOT EXISTS public.oauth_grants (
  grant_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  provider                TEXT NOT NULL CHECK (provider IN ('youtube', 'drive', 'tiktok')),
  scopes                  TEXT[] NOT NULL DEFAULT '{}',
  -- TODO(security): wrap refresh_token + access_token in pgcrypto column-
  -- level encryption once a project-wide encryption helper lands. For V1
  -- we rely on Supabase Postgres at-rest disk encryption and RLS scoping.
  refresh_token           TEXT NOT NULL,
  access_token            TEXT,
  access_token_expires_at TIMESTAMPTZ,
  external_account_id     TEXT,
  external_account_display TEXT,
  granted_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at              TIMESTAMPTZ,
  last_refreshed_at       TIMESTAMPTZ,
  metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (event_id, provider)
);

COMMENT ON TABLE public.oauth_grants IS
  'Shared per-couple OAuth grants table (created 2026-05-16). One row per (event_id, provider). Used by Panood (youtube), Papic (drive). Tiktok continues to use the older patiktok_oauth_grants table for V1; future consolidation is tracked as a TODO.';

CREATE INDEX IF NOT EXISTS oauth_grants_event_provider_idx
  ON public.oauth_grants (event_id, provider);

CREATE INDEX IF NOT EXISTS oauth_grants_active_idx
  ON public.oauth_grants (provider) WHERE revoked_at IS NULL;

-- A simple maintenance index for the access-token refresh worker — pulls
-- rows whose access_token is about to expire and that haven't been revoked.
CREATE INDEX IF NOT EXISTS oauth_grants_expiry_idx
  ON public.oauth_grants (access_token_expires_at) WHERE revoked_at IS NULL;

ALTER TABLE public.oauth_grants ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- RLS — event-scoped read for couples + admin override
-- ----------------------------------------------------------------------------
-- Style note: we follow the 0019/0021 RLS pattern of using the
-- public.current_event_ids() helper for couple reads, and public.is_admin()
-- for admin overrides. Writes always go through service-role server routes
-- (the OAuth start/callback/disconnect handlers), so no couple-write policy
-- is granted directly — keeping refresh-token writes off the wire from the
-- browser.

DROP POLICY IF EXISTS event_member_reads_oauth_grants ON public.oauth_grants;
CREATE POLICY event_member_reads_oauth_grants ON public.oauth_grants
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()));

DROP POLICY IF EXISTS admin_manages_oauth_grants ON public.oauth_grants;
CREATE POLICY admin_manages_oauth_grants ON public.oauth_grants
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- CSRF state nonce table — used by the OAuth start → callback round-trip
-- ----------------------------------------------------------------------------
-- Same shape as patiktok_oauth_state but provider-tagged so the shared
-- callback path can route to the right grant-upsert branch. Rows older
-- than 10 minutes are considered expired by the callback handler and
-- deleted on read (single-use nonces).

CREATE TABLE IF NOT EXISTS public.oauth_state (
  state_token   TEXT PRIMARY KEY,
  event_id      UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  provider      TEXT NOT NULL CHECK (provider IN ('youtube', 'drive', 'tiktok')),
  initiated_by  UUID NOT NULL REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS oauth_state_created_idx
  ON public.oauth_state (created_at);

ALTER TABLE public.oauth_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_reads_oauth_state ON public.oauth_state;
CREATE POLICY admin_reads_oauth_state ON public.oauth_state
  FOR SELECT TO authenticated
  USING (public.is_admin());

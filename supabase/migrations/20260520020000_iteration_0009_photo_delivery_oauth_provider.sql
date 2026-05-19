-- ============================================================================
-- 20260520020000_iteration_0009_photo_delivery_oauth_provider.sql
--
-- PR 3 of 5 for V1 iteration 0009 Photo Delivery.
-- Spec corpus: 0009_photo_delivery/0009_photo_delivery.md
--
-- Adds a new OAuth provider value `'drive_photo_delivery'` to the shared
-- oauth_state + oauth_grants tables so Photo Delivery's Drive flow can
-- coexist with Papic's (0012). Papic continues to use provider='drive';
-- Photo Delivery uses provider='drive_photo_delivery'. Same Google account
-- can hold both grants for the same event — they don't share folder state.
--
-- Architectural decision (2026-05-20):
--   Photo Delivery stores its refresh_token in oauth_grants (matching
--   Papic's shipped pattern · plaintext for now per the in-schema
--   TODO(security) comment on oauth_grants.refresh_token). The
--   events.photo_delivery_oauth_token_encrypted column added by PR 1 is
--   intentionally LEFT IN PLACE for now — it stays unused, and a future
--   harmonization PR can either drop it or migrate oauth_grants to
--   pgcrypto via apps/web/lib/encryption.ts (the PR 2 helper). See the
--   PR description for context.
--
-- Why a new provider value (not reuse `'drive'`):
--   - oauth_grants has a UNIQUE (event_id, provider). Reusing 'drive' would
--     force Papic + Photo Delivery to share one row; their metadata
--     payloads (folder ids) would clash.
--   - Distinct provider values keep iteration boundaries clean and let the
--     shared /api/cron/oauth-refresh worker iterate them uniformly later.
--
-- Idempotent (DROP CONSTRAINT IF EXISTS · re-ADD).
-- ============================================================================

BEGIN;

ALTER TABLE public.oauth_state
  DROP CONSTRAINT IF EXISTS oauth_state_provider_check;
ALTER TABLE public.oauth_state
  ADD CONSTRAINT oauth_state_provider_check
  CHECK (provider IN ('youtube', 'drive', 'tiktok', 'drive_photo_delivery'));

ALTER TABLE public.oauth_grants
  DROP CONSTRAINT IF EXISTS oauth_grants_provider_check;
ALTER TABLE public.oauth_grants
  ADD CONSTRAINT oauth_grants_provider_check
  CHECK (provider IN ('youtube', 'drive', 'tiktok', 'drive_photo_delivery'));

COMMIT;

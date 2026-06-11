-- ============================================================================
-- 20261107000000_push_subscriptions.sql
-- Web Push subscriptions (compliance/push-offline — Apple guideline 4.2).
--
-- One row per browser/device Push Service subscription. Created when a user
-- opts in from the profile "Push notifications" toggle: the client subscribes
-- to the browser Push Service (VAPID), then POSTs the resulting subscription
-- to a server action that upserts here. The server's sendWebPush() helper
-- (apps/web/lib/web-push.ts) reads every endpoint for a user_id and fans a
-- payload out alongside the existing in-app + email notification (0028).
--
-- This is purely additive infra for the PWA "minimum functionality"
-- differentiator (push + offline). Web Push uses VAPID keys the owner
-- generates (`npx web-push generate-vapid-keys`) — NO Apple/Google developer
-- account required. When the keys are unset the whole path no-ops.
--
-- Mirrors the iteration 0028 notifications table's RLS shape:
--   • FK to public.users(user_id) ON DELETE CASCADE (so closing an account
--     drops its push subscriptions).
--   • RLS enabled at CREATE time.
--   • A user manages (INSERT / SELECT / DELETE) only their OWN rows; the
--     row's user_id must equal auth.uid().
--   • The 410-Gone prune (a Push Service rejecting a stale endpoint) runs via
--     the service-role admin client, which bypasses RLS like the 0028 emit.
--
-- Idempotent.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  -- The Push Service endpoint URL. Unique platform-wide: the same browser on
  -- a shared device re-subscribing yields the same endpoint, so UNIQUE lets
  -- the upsert collapse re-subscribes onto one row (and re-home it if a
  -- different account signs in on that browser).
  endpoint     TEXT NOT NULL UNIQUE,
  -- The subscription's ECDH public key + auth secret (base64url). Required by
  -- web-push to encrypt the payload per RFC 8291.
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  -- Topic filter for future per-channel preferences (0028 deferred item).
  -- Empty/NULL means "all topics" for V1 — every notification type pushes.
  topics       TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Pattern A (recipient/owner-only): a user reads only their own subscriptions.
DROP POLICY IF EXISTS push_subscriptions_owner_select ON public.push_subscriptions;
CREATE POLICY push_subscriptions_owner_select
  ON public.push_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- A user can register a subscription only for themselves.
DROP POLICY IF EXISTS push_subscriptions_owner_insert ON public.push_subscriptions;
CREATE POLICY push_subscriptions_owner_insert
  ON public.push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- A user can refresh last_seen_at / topics on their own subscription (the
-- upsert path touches it on every re-subscribe).
DROP POLICY IF EXISTS push_subscriptions_owner_update ON public.push_subscriptions;
CREATE POLICY push_subscriptions_owner_update
  ON public.push_subscriptions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- A user can unsubscribe (delete) their own rows.
DROP POLICY IF EXISTS push_subscriptions_owner_delete ON public.push_subscriptions;
CREATE POLICY push_subscriptions_owner_delete
  ON public.push_subscriptions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

COMMIT;

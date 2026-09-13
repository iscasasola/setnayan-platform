-- guest_push_subscriptions — Web Push subscriptions for GUESTS (C8: notifications
-- finally have a subscriber). Web push already exists and is mounted for
-- authenticated users (public.push_subscriptions, user_id → auth.uid()) and for
-- vendors (public.vendor_push_tokens, vendor_profile_id). Neither fits a guest:
-- guests carry a signed-cookie session (apps/web/lib/guest-session.ts), never a
-- Supabase auth identity, so there is no auth.uid() to key an RLS policy on.
--
-- This mirrors public.scan_events (20260513050000_iteration_0002_invitation.sql),
-- the existing precedent for guest-originated writes: no INSERT policy for
-- guests at all — the row is written by the server (Route Handler / Server
-- Action) via the service-role admin client AFTER it verifies the guest's
-- session cookie. RLS here only governs READS (couple/coordinator + admin).
--
-- Created via `pnpm migration:new`. Idempotent — may be re-applied.

CREATE TABLE IF NOT EXISTS public.guest_push_subscriptions (
  id           BIGSERIAL PRIMARY KEY,
  guest_id     UUID NOT NULL REFERENCES public.guests(guest_id) ON DELETE CASCADE,
  event_id     UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- The Push Service endpoint URL. Unique platform-wide: the same browser
  -- re-subscribing (or a guest scanning again) yields the same endpoint, so
  -- the upsert collapses re-subscribes onto one row.
  endpoint     TEXT NOT NULL UNIQUE,
  -- The subscription's ECDH public key + auth secret (base64url), required by
  -- web-push to encrypt the payload per RFC 8291.
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guest_push_subscriptions_guest_id_idx
  ON public.guest_push_subscriptions (guest_id);

CREATE INDEX IF NOT EXISTS guest_push_subscriptions_event_id_idx
  ON public.guest_push_subscriptions (event_id);

ALTER TABLE public.guest_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Couple/coordinator reads subscriptions for their own event (mirrors
-- couple_reads_scan_events); admin reads everything.
DROP POLICY IF EXISTS couple_reads_guest_push_subscriptions ON public.guest_push_subscriptions;
CREATE POLICY couple_reads_guest_push_subscriptions ON public.guest_push_subscriptions
  FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
  );

-- A guest can read their own subscription row if they ever authenticate as a
-- Supabase user for this guest identity (mirrors guest_reads_own_scans);
-- harmless no-op today since guests are cookie-sessioned, not auth.uid()'d.
DROP POLICY IF EXISTS guest_reads_own_push_subscriptions ON public.guest_push_subscriptions;
CREATE POLICY guest_reads_own_push_subscriptions ON public.guest_push_subscriptions
  FOR SELECT TO authenticated
  USING (
    guest_id IN (SELECT public.current_user_guest_ids())
    OR public.is_admin()
  );

-- No INSERT/UPDATE/DELETE policy for guests: written via the service-role
-- admin client from a Server Action that has already verified the guest's
-- signed-cookie session (readGuestSession()). Admin can write for support/ops.
DROP POLICY IF EXISTS admin_writes_guest_push_subscriptions ON public.guest_push_subscriptions;
CREATE POLICY admin_writes_guest_push_subscriptions ON public.guest_push_subscriptions
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ALTER DEFAULT PRIVILEGES grants arwdDxtm to anon AND authenticated on every
-- new relation in `public` — the root cause of this project's exposure-surface
-- freeze. Revoke first, grant back only what the policies above actually use:
-- authenticated needs SELECT (both read policies) and
-- INSERT/UPDATE/DELETE (the admin ALL policy, gated by is_admin() in the
-- predicate — the grant alone lets nothing through). anon gets nothing; the
-- guest write path never runs as anon or authenticated, it runs as
-- service_role via the admin client, which bypasses grants entirely.
REVOKE ALL ON TABLE public.guest_push_subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.guest_push_subscriptions TO authenticated;

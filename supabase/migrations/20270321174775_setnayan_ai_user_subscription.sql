-- ============================================================================
-- 20270321174775_setnayan_ai_user_subscription.sql
--
-- Setnayan AI → PER-USER subscription spine (foundation, fully INERT).
--
-- The brainstorm 2026-06-29 reframed Setnayan AI from a per-event ₱3,999
-- one-time entitlement to a per-USER monthly subscription that covers ALL of a
-- user's events at once (see corpus Setnayan_AI_Template_Library.md +
-- Setnayan_AI_Subscription_Decisions_2026-06-29.md). This migration lays the
-- entitlement spine ONLY; it changes NOTHING about live behaviour.
--
-- Design (matches the existing per-event paywall plumbing):
--   • A user's subscription is a single window `active_until`. While it is in the
--     future, Setnayan AI is on for every event the user hosts/co-hosts — the
--     "fan-out". The fan-out is computed READ-SIDE in lib/setnayan-ai.ts (no
--     trigger denormalises onto events here), so this migration touches no live
--     table and the existing per-event `events.setnayan_ai_active` flag is
--     untouched. Couples (2 users, 1 event) are covered by EITHER member's
--     subscription -> never double-charged.
--   • A NEW tri-state feature flag `platform_settings.setnayan_ai_per_user_enabled`
--     gates the per-user gate, mirroring `setnayan_ai_paywall_enabled`. DEFAULT
--     NULL/absent -> per-user OFF -> byte-identical to today.
--
-- Prices stay admin-managed in platform_retail_catalog_v2 (term-pass SKU rows
-- land in a later PR once the price is signed off — NOT here). RLS enabled at
-- CREATE TABLE time. ADDITIVE + IDEMPOTENT. No drops, no destructive ALTERs.
-- ============================================================================

BEGIN;

-- ---- 1. the per-user subscription window -----------------------------------

CREATE TABLE IF NOT EXISTS public.user_ai_subscription (
  id            BIGSERIAL PRIMARY KEY,
  public_id     TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('A'),
  user_id       UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  -- The subscription is active while NOW() < active_until. Extended by a paid
  -- term pass (3/6/12mo) or stamped by a comp / team-pool grant.
  active_until  TIMESTAMPTZ NOT NULL,
  source        TEXT NOT NULL DEFAULT 'paid'
                  CHECK (source IN ('paid', 'comp', 'team_pool')),
  -- Optional link to the order that last extended the window (paid source).
  last_order_id UUID REFERENCES public.orders(order_id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One subscription row per user (the window is extended in place, not stacked).
CREATE UNIQUE INDEX IF NOT EXISTS user_ai_subscription_user_id_uidx
  ON public.user_ai_subscription(user_id);
-- Lazy-expiry lookups ("is this user active now?") scan by active_until.
CREATE INDEX IF NOT EXISTS user_ai_subscription_active_until_idx
  ON public.user_ai_subscription(active_until);

COMMENT ON TABLE public.user_ai_subscription IS
  'Per-USER Setnayan AI subscription window (foundation, inert until the '
  'setnayan_ai_per_user_enabled flag is flipped). Active while NOW() < '
  'active_until; fans out AI to all events the user hosts/co-hosts, computed '
  'read-side in lib/setnayan-ai.ts. One row per user.';
COMMENT ON COLUMN public.user_ai_subscription.active_until IS
  'Subscription expiry. AI is on for the user while NOW() < active_until. '
  'Extended by paid term passes; lazily checked at read time (cron-free).';
COMMENT ON COLUMN public.user_ai_subscription.source IS
  'How the window was granted: paid (term pass), comp (admin grant), or '
  'team_pool. comp/team_pool skip the payment-pending state.';

-- ---- 2. RLS (enabled at create time) ---------------------------------------

ALTER TABLE public.user_ai_subscription ENABLE ROW LEVEL SECURITY;

-- A user reads their OWN subscription; admins read all.
DROP POLICY IF EXISTS user_ai_subscription_select ON public.user_ai_subscription;
CREATE POLICY user_ai_subscription_select ON public.user_ai_subscription
  FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- Writes are server/admin only (the activation hook runs with the service role,
-- which bypasses RLS; admins may also adjust via the console). No client INSERT
-- /UPDATE/DELETE path — entitlement is never self-granted.
DROP POLICY IF EXISTS user_ai_subscription_admin_write ON public.user_ai_subscription;
CREATE POLICY user_ai_subscription_admin_write ON public.user_ai_subscription
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---- 3. the per-user feature flag (tri-state, default OFF) ------------------

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS setnayan_ai_per_user_enabled BOOLEAN;

COMMENT ON COLUMN public.platform_settings.setnayan_ai_per_user_enabled IS
  'Per-USER Setnayan AI subscription toggle. Tri-state mirroring '
  'setnayan_ai_paywall_enabled: NULL = OFF (defer; today''s behaviour) / TRUE = '
  'per-user gate on / FALSE = off. Non-secret feature flag. Flip from '
  '/admin/integrations once the price + consent sign-offs land. Default NULL.';

COMMIT;

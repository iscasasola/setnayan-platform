-- ============================================================================
-- 20260607060000_iteration_0023_order_refunds.sql
-- Iteration 0023 § 3.3 + § 3.6 refund action — records that Setnayan returned
-- money externally for a paid/fulfilled order.
--
-- WHY (CLAUDE.md 2026-05-23 row "Refund action on /admin/payments"):
-- Pilot launches ~2026-06-01 with 5-20 personal/family cohort exercising real
-- BDO/GCash payments. Manual reconciliation makes duplicate transfers common
-- (couple sends GCash, doesn't see confirmation, resends). Today the only
-- recovery path is Supabase Studio under live customer pressure. This table
-- + the matching server action gives the owner an in-app refund surface that
-- records the truth and notifies the couple in one step.
--
-- Behavior the schema encodes:
--   • orders.status flips to 'refunded' (the enum value already exists since
--     migration 20260513150000_iteration_0034_payments.sql line 34 — no
--     ALTER TYPE needed).
--   • order_refunds row records the amount, reason, admin who issued, the
--     R2 proof URL (nullable for V1 — owner often refunds before they save
--     the screenshot), and a status enum that lets V1.x surfaces capture
--     post-refund disputes ("customer says they never got the bank transfer")
--     or reversals without backfilling schema later.
--   • A single 'refunded' state at orders.status is the canonical truth;
--     order_refunds is the audit ledger (one order → one refund row in V1,
--     enforced by UNIQUE(order_id)). Partial refunds are V1.x — the schema
--     captures full refunds only via the unique constraint, but the
--     refund_amount_centavos column is INT not NOT-NULL-bound to the
--     order's total so V1.x can drop the unique constraint and switch to
--     a 1-to-many model without re-keying the rows.
--
-- RLS: admin-only INSERT/UPDATE/SELECT. Customers see refund state via
-- orders.status flipping to 'refunded' + the in-app notification fired by
-- the server action; they do NOT read order_refunds directly in V1 (a
-- customer-side refund detail page is a V1.x surface).
--
-- Idempotent. Safe to re-run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- order_refund_status enum
-- ----------------------------------------------------------------------------
--
-- 'sent' = admin completed the external bank transfer back to the customer
-- and recorded it (V1 happy path).
--
-- 'disputed_by_customer' = customer says the reverse transfer never landed.
-- Admin sees this in the V1.x dispute sub-queue and follows up.
--
-- 'reversed' = the refund itself was undone (rare; e.g., admin sent to wrong
-- account and the original customer never received money). Lets V1.x
-- distinguish "refund issued and stuck" from "refund cancelled cleanly."

DO $$ BEGIN
  CREATE TYPE public.order_refund_status AS ENUM (
    'sent',
    'disputed_by_customer',
    'reversed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- order_refunds
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.order_refunds (
  refund_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id               UUID NOT NULL REFERENCES public.orders(order_id) ON DELETE RESTRICT,
  refund_amount_centavos INTEGER NOT NULL CHECK (refund_amount_centavos > 0),
  reason                 TEXT NOT NULL CHECK (length(reason) >= 20 AND length(reason) <= 2000),
  refunded_by_admin_id   UUID NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
  refunded_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Nullable for V1 — owner often issues the bank-transfer reversal first
  -- and uploads the screenshot via a follow-up admin pass. V1.x can flip
  -- this to NOT NULL once the proof-upload flow is wired into the form.
  proof_url              TEXT,
  status                 public.order_refund_status NOT NULL DEFAULT 'sent',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One refund per order in V1 (full-refund-only model). Partial refunds in
-- V1.x will drop this constraint and key refunds to (order_id, refund_seq).
-- Mirrors the receipts.order_id UNIQUE pattern from iteration 0026.
CREATE UNIQUE INDEX IF NOT EXISTS order_refunds_order_id_uq
  ON public.order_refunds(order_id);

CREATE INDEX IF NOT EXISTS order_refunds_admin_id_idx
  ON public.order_refunds(refunded_by_admin_id);

CREATE INDEX IF NOT EXISTS order_refunds_refunded_at_idx
  ON public.order_refunds(refunded_at DESC);

CREATE INDEX IF NOT EXISTS order_refunds_status_idx
  ON public.order_refunds(status);

COMMENT ON TABLE public.order_refunds IS
  'Audit ledger for refunds issued against paid/fulfilled orders. orders.status '
  'is the source-of-truth flip (paid/fulfilled → refunded); this row records '
  'the WHO/WHEN/HOW-MUCH/WHY of the external bank transfer. V1 full-refund '
  'only (UNIQUE on order_id). Added 2026-06-07 per CLAUDE.md 2026-05-23 row.';

COMMENT ON COLUMN public.order_refunds.refund_amount_centavos IS
  'Refund amount in centavos. V1 stores as integer for arithmetic precision; '
  'lib/orders.ts formatPhp() reads numerics so the admin UI pre-fills this '
  'from order.confirmed_total_php (or requested_total_php) * 100 and the '
  'server action divides back to NUMERIC for display.';

COMMENT ON COLUMN public.order_refunds.proof_url IS
  'R2 path or external URL pointing at the bank-transfer reversal screenshot. '
  'Nullable in V1 — admin often issues the refund before saving proof and '
  'attaches the screenshot in a follow-up pass. V1.x: flip NOT NULL once the '
  'proof-upload flow lives in the admin UI.';

-- ----------------------------------------------------------------------------
-- RLS — admin-only
-- ----------------------------------------------------------------------------

ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;

-- Reads gated to internal accounts + team members + admin role. Customers
-- learn about their refund via the orders.status flip + the in-app
-- notification fired from the server action; the V1 customer-facing
-- refund detail surface is deferred to V1.x.
DROP POLICY IF EXISTS order_refunds_admin_read ON public.order_refunds;
CREATE POLICY order_refunds_admin_read
  ON public.order_refunds FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND (u.is_internal = TRUE
             OR u.is_team_member = TRUE
             OR u.account_type = 'admin')
    )
  );

-- INSERTs come from the service-role admin client (server action
-- /admin/payments/actions.ts → refundOrder). Service-role bypasses RLS, but
-- we keep an authenticated-role INSERT policy as defense-in-depth so a
-- mis-wired auth-client INSERT from a non-admin still fails closed.
DROP POLICY IF EXISTS order_refunds_admin_insert ON public.order_refunds;
CREATE POLICY order_refunds_admin_insert
  ON public.order_refunds FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND (u.is_internal = TRUE
             OR u.is_team_member = TRUE
             OR u.account_type = 'admin')
    )
  );

DROP POLICY IF EXISTS order_refunds_admin_update ON public.order_refunds;
CREATE POLICY order_refunds_admin_update
  ON public.order_refunds FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND (u.is_internal = TRUE
             OR u.is_team_member = TRUE
             OR u.account_type = 'admin')
    )
  );

COMMIT;

-- ============================================================================
-- notification_type enum extension — payment_refunded
-- ============================================================================
--
-- ALTER TYPE … ADD VALUE IF NOT EXISTS runs outside any transaction. Matches
-- the pattern in 20260514012000_notification_type_additions.sql. Adding the
-- value here keeps the migration self-contained — the server action's
-- emitNotification({ type: 'payment_refunded', … }) call won't 23514 against
-- the underlying enum check.

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'payment_refunded';

-- ============================================================================
-- 20260529010000_voucher_system_day1.sql
--
-- Timestamp note · 20260529000000 was already claimed by venue_directory_seed
-- (canonical timestamp collision · same pattern as PR #312 seating rename per
-- CLAUDE.md 2026-05-22 row 7). Bumped to 010000 (1hr later) to land cleanly.
--
-- WHY · Day 1 of 4-day pre-pilot voucher + inline-checkout sprint (V1 SCOPE
--       EXPANSION approved by owner · pilot 2026-06-01 in 4 days). Replaces
--       the current 2-step /orders/new → /orders/[id] flow with inline
--       single-page checkout including a "Have a code?" voucher field.
--       This migration is the substrate — discount_codes catalog + per-order
--       voucher columns + redemption audit table + payments.status
--       'resubmit_requested' value + payments.admin_resubmit_notice column.
--       Day 2 wires the couple-side toggle + applyVoucher server action.
--       Day 3 integrates net-paid into iteration 0026 BIR receipt.
--
-- LOCKED POLICY (from owner free-text 2026-05-29 · authoritative):
--   • Multi-use codes by default · admin sets max_uses (NULL = unlimited)
--   • expires_at REQUIRED at creation (admin specifies "until when")
--   • 1 voucher per cart/order · NO stacking (UI-enforced Day 2)
--   • Voucher applies at order creation (immediate price update)
--   • BIR receipt shows net paid (special price) not sticker + discount line
--   • Codes case-insensitive on input · stored UPPERCASE
--   • 3 discount_types: amount_off (centavos), pct_off (0-100 integer), free
--
-- Idempotent (gated on IF NOT EXISTS / DO blocks).
--
-- Cross-references:
--   • CLAUDE.md Day 1 voucher row (this work)
--   • iteration 0023 § admin discipline (admin_audit_log per mutation)
--   • iteration 0026 BIR receipt (net paid · Day 3 integration)
--   • iteration 0034 payments + cart (orders + payments schema this extends)
--   • Canonical admin_audit_log pattern: apps/web/app/admin/users/actions.ts:478
--   • Canonical generate_public_id pattern: 20260513150000 (orders public_id)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- discount_codes — the canonical voucher catalog. Admin creates/edits/disables
-- via /admin/discount-codes. RLS gates direct couple SELECT — the apply-time
-- lookup happens via a server action using the admin client (Day 2 work).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.discount_codes (
  discount_code_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 8-char uppercase alphanumeric. Stored canonicalized (UPPER) so the
  -- apply-time case-insensitive match is a simple equality check, not
  -- a function-on-column scan.
  code                  TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{8}$'),
  -- 3 discount types per locked policy.
  discount_type         TEXT NOT NULL CHECK (
    discount_type IN ('amount_off', 'pct_off', 'free')
  ),
  -- amount_off: centavos (stored NUMERIC for cross-type compatibility but
  -- treated as BIGINT centavos in code). pct_off: integer 1-100. free: NULL
  -- (the CHECK below enforces this triple shape).
  discount_value        NUMERIC(12, 2),
  -- service_keys from public.service_catalog (sku_code). Array allows
  -- multi-service codes (e.g., "all Papic SKUs" or "all photography services").
  -- Empty array = applies to no services (disabled effectively); admin UI
  -- should require at least one selection on create.
  covered_service_keys  TEXT[] NOT NULL DEFAULT '{}',
  -- REQUIRED per owner directive. Postgres TIMESTAMPTZ stores UTC; the
  -- admin form sends ISO from <input type="datetime-local"> treated as PH
  -- local time at the action layer.
  expires_at            TIMESTAMPTZ NOT NULL,
  -- NULL = unlimited within expiry window. Otherwise positive integer
  -- (CHECK enforces).
  max_uses              INT,
  uses_count            INT NOT NULL DEFAULT 0,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_admin_id   UUID NOT NULL REFERENCES public.users(user_id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Triple-shape coherence: each discount_type has its own value-validation
  -- pattern. Splitting these via OR'd CHECK clauses keeps the constraint
  -- self-documenting + Postgres can reject malformed inserts at write time
  -- (server action also validates · this is defense-in-depth).
  CONSTRAINT discount_codes_value_coherence CHECK (
    (discount_type = 'amount_off' AND discount_value IS NOT NULL AND discount_value > 0) OR
    (discount_type = 'pct_off'    AND discount_value IS NOT NULL AND discount_value > 0 AND discount_value <= 100) OR
    (discount_type = 'free')
  ),
  CONSTRAINT discount_codes_max_uses_positive CHECK (
    max_uses IS NULL OR max_uses > 0
  ),
  CONSTRAINT discount_codes_uses_within_cap CHECK (
    uses_count >= 0 AND (max_uses IS NULL OR uses_count <= max_uses)
  )
);

-- Apply-time lookups hit this index (admin client SELECTs by code where
-- is_active = TRUE before applying to a cart). Partial index keeps it tight.
CREATE INDEX IF NOT EXISTS idx_discount_codes_code_active
  ON public.discount_codes (code)
  WHERE is_active = TRUE;

-- Expiry sweeps (Day 2 lazy-eval at apply-time per
-- [[reference_setnayan_cron_strategy]] no-cron preference) hit this index.
CREATE INDEX IF NOT EXISTS idx_discount_codes_expires_at_active
  ON public.discount_codes (expires_at)
  WHERE is_active = TRUE;

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- Admin-only SELECT/INSERT/UPDATE/DELETE. Couples NEVER directly SELECT
-- from this table — the apply-time lookup goes through a server action that
-- uses the service-role admin client (matches the iteration 0034 payments
-- reconciliation pattern at apps/web/app/admin/payments/actions.ts).
DROP POLICY IF EXISTS discount_codes_admin_all ON public.discount_codes;
CREATE POLICY discount_codes_admin_all
  ON public.discount_codes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = auth.uid()
        AND account_type = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = auth.uid()
        AND account_type = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- discount_code_redemptions — per-couple-per-code audit. UNIQUE(order_id)
-- enforces the "1 voucher per cart/order" rule at the DB level (the apply
-- action ALSO checks before INSERT · this is the structural guarantee).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.discount_code_redemptions (
  redemption_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id           UUID NOT NULL
    REFERENCES public.discount_codes(discount_code_id),
  order_id                   UUID NOT NULL
    REFERENCES public.orders(order_id) ON DELETE CASCADE,
  couple_user_id             UUID NOT NULL
    REFERENCES public.users(user_id),
  -- Snapshot of discount amount in centavos applied to this specific order
  -- (denormalized from the discount code so a later admin edit to the code
  -- definition doesn't retroactively change historical redemption amounts).
  discount_centavos_applied  BIGINT NOT NULL CHECK (discount_centavos_applied >= 0),
  redeemed_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- "1 voucher per order" — structural guarantee. The apply server action
  -- also checks before INSERT but this prevents race conditions on
  -- concurrent submit clicks.
  UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_discount_code_redemptions_code
  ON public.discount_code_redemptions (discount_code_id, redeemed_at DESC);

CREATE INDEX IF NOT EXISTS idx_discount_code_redemptions_couple
  ON public.discount_code_redemptions (couple_user_id, redeemed_at DESC);

ALTER TABLE public.discount_code_redemptions ENABLE ROW LEVEL SECURITY;

-- Admin reads all redemptions for analytics; couples can read their own
-- for the order history view (Day 2 surfaces this).
DROP POLICY IF EXISTS discount_code_redemptions_admin_or_owner_read
  ON public.discount_code_redemptions;
CREATE POLICY discount_code_redemptions_admin_or_owner_read
  ON public.discount_code_redemptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = auth.uid()
        AND account_type = 'admin'
    )
    OR couple_user_id = auth.uid()
  );

-- Couples INSERT their own redemption rows via the apply server action
-- (which validates the code first via admin client, then writes the
-- redemption row scoped to the couple's user_id).
DROP POLICY IF EXISTS discount_code_redemptions_owner_insert
  ON public.discount_code_redemptions;
CREATE POLICY discount_code_redemptions_owner_insert
  ON public.discount_code_redemptions FOR INSERT
  TO authenticated
  WITH CHECK (couple_user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- orders extensions — voucher_code_applied (audit copy of the code string
-- so the order surface can display it without joining redemptions) +
-- voucher_discount_centavos (snapshot of discount amount in centavos).
-- ----------------------------------------------------------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS voucher_code_applied TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS voucher_discount_centavos BIGINT NOT NULL DEFAULT 0;

-- Guard: if voucher_code is set, discount must be > 0; if discount is 0, code
-- must be NULL (no zero-discount voucher rows that confuse the BIR receipt).
-- DO block lets us re-run the migration without raising "constraint exists".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_voucher_coherence'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_voucher_coherence CHECK (
        (voucher_code_applied IS NULL AND voucher_discount_centavos = 0) OR
        (voucher_code_applied IS NOT NULL AND voucher_discount_centavos > 0)
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- payments extensions — 'resubmit_requested' status value + admin_resubmit_notice
-- column. WHY · the inline-checkout flow (Day 2) needs an admin "reject but ask
-- couple to resubmit with corrected proof" path distinct from a hard 'rejected'
-- terminal state. The notice surfaces in the couple's order detail page.
--
-- payment_status is an ENUM (per 20260513150000 line 39) so we use
-- ALTER TYPE ... ADD VALUE IF NOT EXISTS (the canonical pattern matching
-- 20260530020000_guest_role_add_bride_groom.sql per CLAUDE.md 2026-05-22 row 8).
-- ----------------------------------------------------------------------------

ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'resubmit_requested';

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS admin_resubmit_notice TEXT;

COMMIT;

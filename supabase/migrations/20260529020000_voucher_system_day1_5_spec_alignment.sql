-- ============================================================================
-- 20260529020000_voucher_system_day1_5_spec_alignment.sql
--
-- WHY · Day 1.5 corrective refactor of PR #594 (Day 1 voucher system that
--       landed on origin/main as 20260529010000). Owner refined the spec
--       AFTER Day 1 shipped. This migration aligns the schema to the new
--       authoritative spec. See CLAUDE.md 2026-05-29 Day 1.5 row for the
--       canonical WHY.
--
-- LOCKED POLICY (refined from owner 2026-05-29 PM · supersedes Day 1):
--   • 3-type model: pct_off / pct_off_capped / free  (drops amount_off)
--     pct_off          — straight % off (e.g. 10% off)
--     pct_off_capped   — % off up to a fiat ceiling (e.g. 50% off up to ₱500)
--     free             — 100% off all covered services
--   • Schema separation: drop generic discount_value, replace with TWO cols:
--     pct_value INT   (1-100, used for both pct_off and pct_off_capped)
--     cap_centavos BIGINT  (NOT NULL only for pct_off_capped)
--   • Per-user uniqueness: UNIQUE (discount_code_id, couple_user_id) on
--     discount_code_redemptions enforces "1 redemption per couple per code"
--     in addition to existing UNIQUE (order_id) "1 voucher per order".
--   • order_ledger: new append-only audit log table. REVOKE UPDATE/DELETE
--     from authenticated · admin reads all · couple reads own (via orders
--     join). 8 event_type values covering the full order lifecycle.
--
-- SAFE BECAUSE no voucher rows exist in prod yet (Day 1 just shipped, no
-- admin has created a code yet). The DROP COLUMN + recreate path is clean.
--
-- ENUM strategy: Day 1 used a TEXT CHECK column for discount_type (NOT a
-- pg enum) per the original migration line 53-55. So the type swap is a
-- simple DROP CHECK + DROP COLUMN + ADD COLUMN + ADD CHECK · no enum
-- manipulation needed.
--
-- Cross-references:
--   • CLAUDE.md 2026-05-29 Day 1.5 row (canonical WHY for this refactor)
--   • PR #594 (Day 1 work this refactors · 20260529010000)
--   • iteration 0023 § admin discipline (admin_audit_log per mutation)
--   • iteration 0026 BIR receipt (net paid · Day 3 integration ahead)
--   • iteration 0034 payments + cart (orders + payments schema this extends)
--   • Canonical RLS pattern: PR #594 discount_code_redemptions policies
--   • Canonical orders ownership: orders.user_id (NOT couple_user_id) per
--     20260513150000 line 50 — order_ledger RLS joins through this column.
--
-- Idempotent (IF EXISTS / IF NOT EXISTS / DO blocks throughout).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- discount_codes · type swap + value-column split.
--
-- Step order matters:
--   1. Drop the old value-coherence CHECK constraint (references old shape)
--   2. Drop the old discount_type CHECK constraint (references 'amount_off')
--   3. Drop the discount_value column
--   4. Add pct_value + cap_centavos columns
--   5. Add the new discount_type CHECK (3 new values)
--   6. Add the new triple-shape value-coherence CHECK
-- ----------------------------------------------------------------------------

-- Step 1+2 · drop old constraints.
ALTER TABLE public.discount_codes
  DROP CONSTRAINT IF EXISTS discount_codes_value_coherence;

-- The discount_type CHECK was created inline in the column DDL of the Day 1
-- migration, so postgres named it via the column · we drop by inspecting
-- pg_constraint to find the auto-generated name.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.discount_codes'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%discount_type%amount_off%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.discount_codes DROP CONSTRAINT %I', cname);
  END IF;
END $$;

-- Step 3 · drop discount_value column (no rows · safe).
ALTER TABLE public.discount_codes
  DROP COLUMN IF EXISTS discount_value;

-- Step 4 · add the two new value columns.
ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS pct_value INT;

ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS cap_centavos BIGINT;

-- Step 5 · new discount_type CHECK with 3 refined values.
-- We add this as a named constraint so future migrations can reference + drop
-- it cleanly (lesson learned from step 2 above).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'discount_codes_type_check_v2'
      AND conrelid = 'public.discount_codes'::regclass
  ) THEN
    ALTER TABLE public.discount_codes
      ADD CONSTRAINT discount_codes_type_check_v2 CHECK (
        discount_type IN ('pct_off', 'pct_off_capped', 'free')
      );
  END IF;
END $$;

-- Step 6 · new triple-shape value-coherence CHECK per owner spec.
-- This is the structural guarantee that admin can't insert a malformed row:
--   • pct_off        → pct_value 1-100, cap_centavos NULL
--   • pct_off_capped → pct_value 1-100, cap_centavos > 0
--   • free           → both NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'discount_codes_value_coherence_v2'
      AND conrelid = 'public.discount_codes'::regclass
  ) THEN
    ALTER TABLE public.discount_codes
      ADD CONSTRAINT discount_codes_value_coherence_v2 CHECK (
        (discount_type = 'pct_off'        AND pct_value BETWEEN 1 AND 100 AND cap_centavos IS NULL) OR
        (discount_type = 'pct_off_capped' AND pct_value BETWEEN 1 AND 100 AND cap_centavos > 0)     OR
        (discount_type = 'free'           AND pct_value IS NULL          AND cap_centavos IS NULL)
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- discount_code_redemptions · add per-user uniqueness.
--
-- Owner spec: "1 redemption per couple per code". Combined with the existing
-- UNIQUE (order_id) from PR #594, that's the dual-rule:
--   (a) 1 voucher per order
--   (b) 1 redemption per couple per code
--
-- Implemented as a UNIQUE constraint (not just an index) so the apply server
-- action's INSERT surfaces a clean 23505 violation that the action handler
-- can translate to a brand-voice "you've already used this code" message.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'discount_code_redemptions_unique_code_couple'
      AND conrelid = 'public.discount_code_redemptions'::regclass
  ) THEN
    ALTER TABLE public.discount_code_redemptions
      ADD CONSTRAINT discount_code_redemptions_unique_code_couple
      UNIQUE (discount_code_id, couple_user_id);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- order_ledger · append-only audit log for the full order lifecycle.
--
-- WHY · Day 1.5 owner spec requires an immutable ledger for every state
--       transition on an order. Day 1 didn't ship this; Day 3 BIR receipt
--       integration will rely on it for the audit trail. UPDATE/DELETE
--       REVOKED from authenticated · admin reads all · couple reads own
--       through the orders join.
--
-- Snapshot semantics: amount_centavos + voucher_code + payment_id are
-- FROZEN at write time (not FKs). If admin later edits a voucher code's
-- definition, the ledger preserves the historical value-at-redemption.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.order_ledger (
  ledger_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID NOT NULL REFERENCES public.orders(order_id) ON DELETE CASCADE,
  event_type         TEXT NOT NULL CHECK (event_type IN (
    'order_created',
    'voucher_applied',
    'payment_uploaded',
    'payment_approved',
    'payment_rejected',
    'payment_resubmit_requested',
    'service_activated',
    'order_refunded'
  )),
  -- Frozen snapshot. For order_created/voucher_applied this is the post-
  -- discount total at that moment. For payment_* this is the amount paid.
  -- NULL when the event has no monetary dimension (e.g. service_activated).
  amount_centavos    BIGINT,
  -- Frozen copy of the voucher code string · so a later admin edit to the
  -- discount_codes row doesn't retroactively change historical ledger rows.
  voucher_code       TEXT,
  -- Frozen payment_id reference (NOT a FK · payment row could be hard-deleted
  -- in admin housekeeping but ledger row remains for audit).
  payment_id         UUID,
  actor_user_id      UUID NOT NULL REFERENCES public.users(user_id),
  actor_role         TEXT NOT NULL CHECK (actor_role IN ('couple', 'admin', 'system')),
  metadata           JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for typical read shapes:
--   • Order timeline view (couple + admin): order_id + created_at DESC
--   • Admin audit by actor: actor_user_id + created_at DESC
--   • Admin event-type analytics: event_type + created_at DESC
CREATE INDEX IF NOT EXISTS idx_order_ledger_order_created
  ON public.order_ledger (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_ledger_actor
  ON public.order_ledger (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_ledger_event_type
  ON public.order_ledger (event_type, created_at DESC);

-- RLS · admin reads all + couple reads own (via orders.user_id join). NO
-- UPDATE/DELETE for anyone except service_role (admin client). This is the
-- structural immutability guarantee.
ALTER TABLE public.order_ledger ENABLE ROW LEVEL SECURITY;

-- Belt-and-suspenders: revoke direct UPDATE/DELETE from authenticated and anon
-- at the table grant level (RLS policies could be misconfigured · this is the
-- defense-in-depth layer that makes the table structurally append-only).
REVOKE UPDATE, DELETE, TRUNCATE ON public.order_ledger FROM authenticated, anon;
GRANT INSERT, SELECT ON public.order_ledger TO authenticated;

-- Admin reads everything for moderation + analytics.
DROP POLICY IF EXISTS order_ledger_admin_read ON public.order_ledger;
CREATE POLICY order_ledger_admin_read
  ON public.order_ledger FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = auth.uid()
        AND account_type = 'admin'
    )
  );

-- Couple reads ledger rows for orders they own (via orders.user_id join
-- per the canonical column name from 20260513150000 line 50).
DROP POLICY IF EXISTS order_ledger_couple_read_own ON public.order_ledger;
CREATE POLICY order_ledger_couple_read_own
  ON public.order_ledger FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.order_id = order_ledger.order_id
        AND o.user_id = auth.uid()
    )
  );

-- INSERT is allowed for authenticated (service actions write ledger rows on
-- behalf of couple/admin/system actors · the actor_user_id column captures
-- the truth). Admin client (service-role) bypasses RLS · so admin-side
-- writes from server actions land unconditionally.
DROP POLICY IF EXISTS order_ledger_authenticated_insert ON public.order_ledger;
CREATE POLICY order_ledger_authenticated_insert
  ON public.order_ledger FOR INSERT
  TO authenticated
  WITH CHECK (actor_user_id = auth.uid());

COMMIT;

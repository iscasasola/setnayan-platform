-- ============================================================================
-- 20260529050000_voucher_eligible_users.sql
--
-- Adds `discount_code_eligible_users` join table for private vouchers
-- (account-locked / gift codes). When zero rows exist for a code, anyone
-- with the code can redeem (max_uses still applies). When at least one
-- row exists, ONLY those user accounts can redeem.
--
-- Owner request 2026-05-29: gift mechanism for specific family members.
-- Admin creates a free voucher + adds specific account(s) → only those
-- couples see the discount apply at checkout.
--
-- Idempotent.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.discount_code_eligible_users (
  discount_code_id   UUID NOT NULL REFERENCES public.discount_codes(discount_code_id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  added_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by_admin_id  UUID NOT NULL REFERENCES public.users(user_id),
  PRIMARY KEY (discount_code_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_eligible_by_user
  ON public.discount_code_eligible_users (user_id);

ALTER TABLE public.discount_code_eligible_users ENABLE ROW LEVEL SECURITY;

-- Admin can read + write all rows.
DROP POLICY IF EXISTS discount_code_eligible_users_admin_rw
  ON public.discount_code_eligible_users;
CREATE POLICY discount_code_eligible_users_admin_rw
  ON public.discount_code_eligible_users
  FOR ALL
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

-- Couple can SELECT their own eligibility rows (so the validate path
-- works without service-role lookups when we add couple-side eligibility
-- queries — currently the validate path uses admin client, but reserve
-- this policy for future couple-facing "your codes" surfaces).
DROP POLICY IF EXISTS discount_code_eligible_users_self_read
  ON public.discount_code_eligible_users;
CREATE POLICY discount_code_eligible_users_self_read
  ON public.discount_code_eligible_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.discount_code_eligible_users IS
  'Per-code account allow-list. Empty (no rows for a code) = public/anyone-with-code redeemable. At least one row = private/restricted to those user_ids.';

COMMIT;

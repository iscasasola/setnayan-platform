-- ============================================================================
-- 20260515030000_self_review_gate.sql
-- Decision 1 (CLAUDE.md 2026-05-15) — dual-role customer ↔ vendor:
-- self-purchase confirm + self-review three-layer hard-gate.
--
-- Renamed from 20260515020000_self_review_gate.sql on 2026-05-16: that
-- timestamp collided with 20260515020000_public_stats_exclusion.sql, which
-- creates a minimal `comp_grants` stub. Alphabetic tie-break made the stub
-- win, this file's `CREATE TABLE IF NOT EXISTS comp_grants` silently no-op'd,
-- and the very next `CREATE INDEX … ON comp_grants(user_id)` aborted the
-- whole migration because `user_id` didn't exist in the stub. Bumping the
-- timestamp by one slot + switching `CREATE TABLE` → `ALTER TABLE … ADD
-- COLUMN IF NOT EXISTS` lets this file upgrade the stub in place.
--
-- Spec sources:
--   - 0006_vendors_management.md § Reviews + § Dual-role review gate
--   - 0034_payments_and_cart.md § 3.1a + § 5.4 + § 0034.9 (identity tables)
--   - 0023_admin_console.md § 3.9 Review moderation queue
--   - 0021_couple_dashboard_fully_purchased.md § 2.2d.i Self-review block
--
-- Schema-name reconciliation with the actual repo:
--   - Spec `vendors.owner_user_id`     → real `vendor_profiles.user_id`
--   - Spec `vendors.vendor_id`         → real `vendor_profiles.vendor_profile_id`
--   - Spec `vendor_reviews.reviewer_user_id`
--                                       → real `vendor_reviews.couple_user_id`
--   - Spec `vendor_service_agents.member_id`
--                                       → real `vendor_team_members.user_id`
--   - Spec `service_order_payments.payer_account_number`
--                                       → real `payments.reference_number`
--                                         (V1 reconciliation matcher key)
--   - Spec `comp_grants` — minimal stub created earlier in the push by
--     `20260515020000_public_stats_exclusion.sql`; this file upgrades that
--     stub to the full V1 shape (public_id, user_id, scope, rationale,
--     granted_by, …) via `ALTER TABLE … ADD COLUMN IF NOT EXISTS`. The
--     broader comp ledger (owner_internal / team_pool / external_promo /
--     dispute_remedy sources) lives in `service_orders` follow-ups.
--
-- This migration:
--   1. New table `user_devices` (user_id, device_hash, last_seen_at) +
--      RLS (own rows only).
--   2. `users.address_normalized` TEXT column (no source columns exist in
--      V1 today; populated downstream when the address profile lands).
--   3. CHECK constraint that owner_self self-reviews are blocked at the
--      column level (subquery CHECK is non-portable — implemented via the
--      trigger instead per spec note).
--   4. BEFORE INSERT trigger `block_related_account_review` on
--      `vendor_reviews` checking 5 related-account signals; respects the
--      `setnayan.bypass_related_account_gate` session GUC for admin
--      override-publishes.
--   5. New table `vendor_review_appeals` (holding pen for would-be
--      reviews awaiting admin appeal decision).
--   6. New columns on `vendor_reviews`: `override_admin_id`,
--      `override_reason`.
--   7. Upgrade `comp_grants` (the stub created earlier by
--      `20260515020000_public_stats_exclusion.sql`) to the full V1 shape:
--      public_id, user_id, scope, scoped_skus, rationale, granted_by,
--      approved_by, two_admin_approval_id, revoked_at + CHECK / FK
--      constraints + owner-read RLS policy. Only the `vendor_self_comp`
--      source is wired by app code in V1.
--
-- All operations idempotent (IF NOT EXISTS / DROP IF EXISTS).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. user_devices — 1 row per (user, device fingerprint)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_devices (
  user_id       UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  device_hash   TEXT NOT NULL,
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, device_hash)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_by_hash
  ON public.user_devices(device_hash);

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_devices_owner_read ON public.user_devices;
CREATE POLICY user_devices_owner_read
  ON public.user_devices FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_devices_owner_write ON public.user_devices;
CREATE POLICY user_devices_owner_write
  ON public.user_devices FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 2. users.address_normalized
--    Spec § 0034.9: "computed downstream lowercased + whitespace-collapsed".
--    V1 ships with no address fields on users so the column starts NULL.
--    Null-safety in the trigger ensures a match never fires on NULL.
-- ----------------------------------------------------------------------------

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS address_normalized TEXT;

CREATE INDEX IF NOT EXISTS idx_users_address_normalized
  ON public.users(address_normalized)
  WHERE address_normalized IS NOT NULL AND length(address_normalized) > 0;

-- ----------------------------------------------------------------------------
-- 3. vendor_reviews additions — override columns for admin override-publish
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_reviews
  ADD COLUMN IF NOT EXISTS override_admin_id UUID
    REFERENCES public.users(user_id) ON DELETE SET NULL;
ALTER TABLE public.vendor_reviews
  ADD COLUMN IF NOT EXISTS override_reason TEXT;

-- ----------------------------------------------------------------------------
-- 4. vendor_review_appeals — holding pen for blocked reviews awaiting appeal
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_review_appeals (
  appeal_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL
    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  reviewer_user_id  UUID NOT NULL
    REFERENCES public.users(user_id) ON DELETE CASCADE,
  event_id          UUID NOT NULL
    REFERENCES public.events(event_id) ON DELETE CASCADE,
  event_vendor_id   UUID,   -- spec calls this `booking_id`; we link to event_vendors
  matched_signal    TEXT NOT NULL
    CHECK (matched_signal IN (
      'owner_self', 'team_member', 'payment_match', 'device_match', 'household_match'
    )),
  review_payload    JSONB NOT NULL,
  appeal_reason     TEXT NOT NULL CHECK (length(appeal_reason) BETWEEN 1 AND 4000),
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at        TIMESTAMPTZ,
  decided_by_admin  UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  decision          TEXT
    CHECK (decision IS NULL OR decision IN (
      'override_published', 'rejected', 'escalated'
    )),
  decision_reason   TEXT
);

CREATE INDEX IF NOT EXISTS idx_review_appeals_pending
  ON public.vendor_review_appeals(submitted_at)
  WHERE decided_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_review_appeals_vendor
  ON public.vendor_review_appeals(vendor_profile_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_appeals_reviewer
  ON public.vendor_review_appeals(reviewer_user_id, submitted_at DESC);

ALTER TABLE public.vendor_review_appeals ENABLE ROW LEVEL SECURITY;

-- Reviewers can read + insert their own appeals. They cannot edit after
-- submission — the admin's decision is the closing write, via the
-- service-role admin client.
DROP POLICY IF EXISTS vendor_review_appeals_owner_read
  ON public.vendor_review_appeals;
CREATE POLICY vendor_review_appeals_owner_read
  ON public.vendor_review_appeals FOR SELECT
  TO authenticated
  USING (reviewer_user_id = auth.uid());

DROP POLICY IF EXISTS vendor_review_appeals_owner_insert
  ON public.vendor_review_appeals;
CREATE POLICY vendor_review_appeals_owner_insert
  ON public.vendor_review_appeals FOR INSERT
  TO authenticated
  WITH CHECK (reviewer_user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 5. comp_grants — upgrade the stub from
--    `20260515020000_public_stats_exclusion.sql` to the full V1 shape for
--    the vendor self-comp grant type (0034 § 5.4 + dual-role review gate).
--    The stub already provides: grant_id (PK), source TEXT NOT NULL,
--    created_at, plus the loosely-typed order_id / vendor_profile_id /
--    created_by_user_id / reason columns and ENABLE ROW LEVEL SECURITY +
--    `comp_grants_admin_read` policy. We add the 11 columns the cart action
--    + rate-limit trigger expect, attach CHECK + FK constraints to the
--    stub's existing columns, and add the owner-read policy alongside the
--    stub's admin-read policy. `created_by_user_id` and `reason` from the
--    stub are left in place (deprecated; cart action writes `granted_by`
--    and `rationale` instead — no data, harmless).
-- ----------------------------------------------------------------------------

ALTER TABLE public.comp_grants
  ADD COLUMN IF NOT EXISTS public_id              TEXT,
  ADD COLUMN IF NOT EXISTS user_id                UUID
    REFERENCES public.users(user_id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS scope                  TEXT NOT NULL DEFAULT 'single_order',
  ADD COLUMN IF NOT EXISTS scoped_skus            TEXT[],
  ADD COLUMN IF NOT EXISTS expiry                 TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retail_value_centavos  INT,
  ADD COLUMN IF NOT EXISTS rationale              TEXT,
  ADD COLUMN IF NOT EXISTS granted_by             UUID
    REFERENCES public.users(user_id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS approved_by            UUID
    REFERENCES public.users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS two_admin_approval_id  UUID,
  ADD COLUMN IF NOT EXISTS revoked_at             TIMESTAMPTZ;

-- Backfill public_id (no-op in prod — table is empty), then attach default +
-- NOT NULL + UNIQUE.
UPDATE public.comp_grants
   SET public_id = public.generate_public_id('C')
 WHERE public_id IS NULL;
ALTER TABLE public.comp_grants
  ALTER COLUMN public_id SET DEFAULT public.generate_public_id('C'),
  ALTER COLUMN public_id SET NOT NULL;
DO $$
BEGIN
  ALTER TABLE public.comp_grants
    ADD CONSTRAINT comp_grants_public_id_key UNIQUE (public_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CHECK + FK constraints the stub didn't define.
DO $$
BEGIN
  ALTER TABLE public.comp_grants
    ADD CONSTRAINT comp_grants_scope_check
    CHECK (scope IN ('all_services', 'specific_skus', 'single_order'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE public.comp_grants
    ADD CONSTRAINT comp_grants_source_check
    CHECK (source IN (
      'owner_internal','team_pool','external_promo','dispute_remedy','vendor_self_comp'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE public.comp_grants
    ADD CONSTRAINT comp_grants_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE public.comp_grants
    ADD CONSTRAINT comp_grants_vendor_profile_id_fkey
    FOREIGN KEY (vendor_profile_id)
      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_comp_grants_user
  ON public.comp_grants(user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comp_grants_source
  ON public.comp_grants(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comp_grants_vendor_self_comp
  ON public.comp_grants(vendor_profile_id, created_at DESC)
  WHERE source = 'vendor_self_comp';

-- RLS is already enabled by the stub; add the owner-read policy alongside
-- the stub's `comp_grants_admin_read` policy. Both apply via OR.
DROP POLICY IF EXISTS comp_grants_owner_read ON public.comp_grants;
CREATE POLICY comp_grants_owner_read
  ON public.comp_grants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR granted_by = auth.uid());

-- Insert is server-action-only via service-role; no direct INSERT RLS policy
-- for authenticated. The rate-limit trigger below still fires on service-role
-- inserts.

-- Per-vendor quarterly cap override (defaults to 12).
CREATE TABLE IF NOT EXISTS public.vendor_self_comp_caps (
  vendor_profile_id  UUID PRIMARY KEY
    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  quarterly_cap      INT NOT NULL CHECK (quarterly_cap >= 0),
  raised_by_admin    UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  raised_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason             TEXT NOT NULL
);

ALTER TABLE public.vendor_self_comp_caps ENABLE ROW LEVEL SECURITY;
-- No public RLS — admins read/write via service-role.

CREATE OR REPLACE FUNCTION public.enforce_vendor_self_comp_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  q_count INT;
  q_cap   INT;
BEGIN
  IF NEW.source <> 'vendor_self_comp' THEN RETURN NEW; END IF;
  IF NEW.vendor_profile_id IS NULL THEN
    RAISE EXCEPTION 'vendor_self_comp requires vendor_profile_id'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(quarterly_cap, 12) INTO q_cap
    FROM public.vendor_self_comp_caps
   WHERE vendor_profile_id = NEW.vendor_profile_id;
  IF q_cap IS NULL THEN q_cap := 12; END IF;

  SELECT COUNT(*) INTO q_count
    FROM public.comp_grants
   WHERE source = 'vendor_self_comp'
     AND vendor_profile_id = NEW.vendor_profile_id
     AND date_trunc('quarter', created_at) = date_trunc('quarter', NEW.created_at)
     AND revoked_at IS NULL;

  IF q_count >= q_cap THEN
    RAISE EXCEPTION 'VENDOR_SELF_COMP_QUOTA_EXCEEDED: cap=% used=%', q_cap, q_count
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comp_grants_enforce_self_comp_quota
  ON public.comp_grants;
CREATE TRIGGER comp_grants_enforce_self_comp_quota
  BEFORE INSERT ON public.comp_grants
  FOR EACH ROW EXECUTE FUNCTION public.enforce_vendor_self_comp_quota();

-- ----------------------------------------------------------------------------
-- 5b. orders.comp_grant_id — link a comped order back to its grant.
--     Spec § 3.1a step 1: orders that are self-comped point at the grant
--     they were issued under, so analytics (and audit log queries) can
--     identify and filter them.
-- ----------------------------------------------------------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS comp_grant_id UUID
    REFERENCES public.comp_grants(grant_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_comp_grant_id_idx
  ON public.orders(comp_grant_id)
  WHERE comp_grant_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 6. block_related_account_review() — BEFORE INSERT trigger on vendor_reviews
--
--    Refuses the row when the reviewer shares any of 5 related-account
--    signals with the vendor's owner OR any team member.
--
--    The owner-self CHECK from spec is not portable (subquery in CHECK is
--    rejected by Postgres) so it's enforced here instead as the first signal.
--
--    Honors the `setnayan.bypass_related_account_gate` session GUC for
--    admin override-publishes (set to '1' for the override transaction).
--    Owner-self is the one signal that is NEVER overridable — it always
--    fires even when bypass is set.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.block_related_account_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_signal TEXT := NULL;
  v_owner_id     UUID;
  v_bypass       BOOLEAN := FALSE;
BEGIN
  SELECT user_id INTO v_owner_id
    FROM public.vendor_profiles
   WHERE vendor_profile_id = NEW.vendor_profile_id;

  -- 0. Owner-self — NEVER bypassable. If the reviewer IS the vendor
  --    owner the review is hard-blocked at the source. The CHECK
  --    constraint spec line cannot run (subquery in CHECK is unsupported)
  --    so the trigger enforces it instead.
  IF v_owner_id IS NOT NULL AND NEW.couple_user_id = v_owner_id THEN
    matched_signal := 'owner_self';
    RAISE EXCEPTION 'SELF_REVIEW_BLOCKED: % (appeal via 0023 Help inbox)', matched_signal
      USING ERRCODE = 'check_violation';
  END IF;

  -- Admin override path. The /admin/reviews override-publish action wraps
  -- its INSERT with `SET LOCAL setnayan.bypass_related_account_gate = '1'`
  -- so only the rest of the related-account checks (1–4) are skipped. The
  -- owner-self check above already returned before this point.
  BEGIN
    v_bypass := current_setting('setnayan.bypass_related_account_gate', TRUE) = '1';
  EXCEPTION WHEN OTHERS THEN
    v_bypass := FALSE;
  END;
  IF v_bypass THEN RETURN NEW; END IF;

  -- 1. Team member of the vendor.
  IF NEW.couple_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.vendor_team_members
     WHERE vendor_profile_id = NEW.vendor_profile_id
       AND user_id = NEW.couple_user_id
  ) THEN
    matched_signal := 'team_member';
  -- 2. Payment-method match — reviewer and vendor owner share any
  --    reference_number across the V1 payments table. (Spec uses
  --    `service_order_payments.payer_account_number`; the V1 equivalent
  --    is `payments.reference_number`. Reconciliation matcher hardens
  --    this in a follow-up migration.)
  ELSIF NEW.couple_user_id IS NOT NULL AND v_owner_id IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.payments p1
      JOIN public.payments p2
        ON p2.reference_number = p1.reference_number
       AND p2.reference_number IS NOT NULL
       AND length(p2.reference_number) > 0
     WHERE p1.user_id = NEW.couple_user_id
       AND p2.user_id = v_owner_id
  ) THEN
    matched_signal := 'payment_match';
  -- 3. Device fingerprint match (user_devices populated on session-start).
  ELSIF NEW.couple_user_id IS NOT NULL AND v_owner_id IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.user_devices d1
      JOIN public.user_devices d2 ON d2.device_hash = d1.device_hash
     WHERE d1.user_id = NEW.couple_user_id
       AND d2.user_id = v_owner_id
  ) THEN
    matched_signal := 'device_match';
  -- 4. Household address match (users.address_normalized; null-safe).
  ELSIF NEW.couple_user_id IS NOT NULL AND v_owner_id IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.users u1
      JOIN public.users u2
        ON u2.address_normalized = u1.address_normalized
       AND u1.address_normalized IS NOT NULL
       AND length(u1.address_normalized) > 0
     WHERE u1.user_id = NEW.couple_user_id
       AND u2.user_id = v_owner_id
  ) THEN
    matched_signal := 'household_match';
  END IF;

  IF matched_signal IS NOT NULL THEN
    RAISE EXCEPTION 'SELF_REVIEW_BLOCKED: % (appeal via 0023 Help inbox)', matched_signal
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_reviews_block_related_account
  ON public.vendor_reviews;
CREATE TRIGGER vendor_reviews_block_related_account
  BEFORE INSERT ON public.vendor_reviews
  FOR EACH ROW EXECUTE FUNCTION public.block_related_account_review();

-- ----------------------------------------------------------------------------
-- 7. Helper RPC — surface the matched_signal from a SELECT (read-only test
--    of whether a reviewer would be blocked). Used by the UI to disable the
--    "Leave a review" CTA up front instead of waiting for a 403.
--    Returns NULL when the review would succeed.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.detect_self_review_signal(
  p_vendor_profile_id UUID,
  p_reviewer_user_id  UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  IF p_vendor_profile_id IS NULL OR p_reviewer_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT user_id INTO v_owner_id
    FROM public.vendor_profiles
   WHERE vendor_profile_id = p_vendor_profile_id;
  IF v_owner_id IS NULL THEN RETURN NULL; END IF;

  IF p_reviewer_user_id = v_owner_id THEN RETURN 'owner_self'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.vendor_team_members
     WHERE vendor_profile_id = p_vendor_profile_id
       AND user_id = p_reviewer_user_id
  ) THEN RETURN 'team_member'; END IF;

  IF EXISTS (
    SELECT 1
      FROM public.payments p1
      JOIN public.payments p2
        ON p2.reference_number = p1.reference_number
       AND p2.reference_number IS NOT NULL
       AND length(p2.reference_number) > 0
     WHERE p1.user_id = p_reviewer_user_id
       AND p2.user_id = v_owner_id
  ) THEN RETURN 'payment_match'; END IF;

  IF EXISTS (
    SELECT 1
      FROM public.user_devices d1
      JOIN public.user_devices d2 ON d2.device_hash = d1.device_hash
     WHERE d1.user_id = p_reviewer_user_id
       AND d2.user_id = v_owner_id
  ) THEN RETURN 'device_match'; END IF;

  IF EXISTS (
    SELECT 1
      FROM public.users u1
      JOIN public.users u2
        ON u2.address_normalized = u1.address_normalized
       AND u1.address_normalized IS NOT NULL
       AND length(u1.address_normalized) > 0
     WHERE u1.user_id = p_reviewer_user_id
       AND u2.user_id = v_owner_id
  ) THEN RETURN 'household_match'; END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.detect_self_review_signal(UUID, UUID)
  TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. admin_override_publish_review — single-admin authority override-publish.
--    Wraps a SET LOCAL bypass + vendor_reviews INSERT + appeal close in one
--    transaction so the bypass GUC scopes exactly to this statement. The
--    owner-self + team_member signals are NOT bypassable; those return NULL
--    from the function and the caller treats that as a hard refusal.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_override_publish_review(
  p_appeal_id            UUID,
  p_admin_id             UUID,
  p_reason               TEXT,
  p_rating_overall       INT,
  p_rating_communication INT,
  p_rating_quality       INT,
  p_rating_value         INT,
  p_rating_on_time       INT,
  p_body                 TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appeal       public.vendor_review_appeals%ROWTYPE;
  v_review_id    UUID;
BEGIN
  SELECT * INTO v_appeal
    FROM public.vendor_review_appeals
   WHERE appeal_id = p_appeal_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPEAL_NOT_FOUND';
  END IF;
  IF v_appeal.decided_at IS NOT NULL THEN
    RAISE EXCEPTION 'APPEAL_ALREADY_DECIDED';
  END IF;
  IF v_appeal.matched_signal IN ('owner_self', 'team_member') THEN
    RAISE EXCEPTION 'OWNER_TEAM_NOT_OVERRIDABLE';
  END IF;

  -- Bypass scope: SET LOCAL only persists until COMMIT of the surrounding
  -- transaction. This function-call is its own implicit transaction, so the
  -- bypass disappears as soon as it returns.
  PERFORM set_config('setnayan.bypass_related_account_gate', '1', TRUE);

  INSERT INTO public.vendor_reviews (
    vendor_profile_id, event_id, couple_user_id,
    rating_overall, rating_communication, rating_quality, rating_value, rating_on_time,
    body,
    override_admin_id, override_reason
  ) VALUES (
    v_appeal.vendor_profile_id, v_appeal.event_id, v_appeal.reviewer_user_id,
    p_rating_overall, p_rating_communication, p_rating_quality, p_rating_value, p_rating_on_time,
    p_body,
    p_admin_id, p_reason
  )
  RETURNING review_id INTO v_review_id;

  UPDATE public.vendor_review_appeals
     SET decided_at        = NOW(),
         decided_by_admin  = p_admin_id,
         decision          = 'override_published',
         decision_reason   = p_reason
   WHERE appeal_id = p_appeal_id;

  RETURN v_review_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_override_publish_review(
  UUID, UUID, TEXT, INT, INT, INT, INT, INT, TEXT
) FROM PUBLIC;

COMMIT;

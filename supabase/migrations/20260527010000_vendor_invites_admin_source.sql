-- ============================================================================
-- 20260527000000_vendor_invites_admin_source.sql
--
-- Extend `vendor_invites` to support ADMIN-initiated invitations
-- (2026-05-21 owner direction): admin pre-creates a vendor invite and
-- shares the claim link with the vendor; the vendor signs up via the
-- existing /vendor/claim/[token] flow and ends up with a vendor_profile
-- they can continue editing.
--
-- The original 2026-05-19 schema was tightly coupled to COUPLE-initiated
-- invites (every row required a `vendor_id` FK to `event_vendors`). This
-- migration relaxes that for admin-source rows while preserving the strict
-- coupling for couple-source ones.
--
-- Schema changes:
--   • `vendor_id` becomes nullable.
--   • New column `source TEXT NOT NULL DEFAULT 'couple'` with CHECK
--     constraint restricting to {'couple','admin'}.
--   • Cross-column CHECK enforces source='couple' → vendor_id NOT NULL.
--   • New partial unique index on (LOWER(email)) where source='admin'
--     AND status='pending' so admins can't double-invite the same email
--     (couple-side uniqueness was already enforced per-vendor_id).
--   • RLS gains an admin write policy — internal/team accounts can INSERT,
--     UPDATE, DELETE any vendor_invites row (used by /admin/vendors/invite).
--
-- All additive + idempotent + backwards-compatible. Existing rows stay
-- valid because they default to source='couple' and already have vendor_id.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Add `source` column + CHECK constraint
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_invites
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'couple'
    CHECK (source IN ('couple', 'admin'));

COMMENT ON COLUMN public.vendor_invites.source IS
  'Who initiated the invite. ''couple'' = pre-2026-05-21 behavior; the row '
  'has a vendor_id FK to event_vendors and the claim flow auto-links to '
  'that row via applyClaimAutoLink. ''admin'' = Setnayan team pre-created '
  'the vendor account from /admin/vendors/invite; vendor_id is NULL and '
  'the claim flow just creates the vendor_profile without an event link.';

-- ----------------------------------------------------------------------------
-- 2. Relax vendor_id to nullable
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_invites
  ALTER COLUMN vendor_id DROP NOT NULL;

-- Cross-column CHECK: couple-source must still have a vendor_id; admin-source
-- must NOT (admin invites don't belong to an event).
ALTER TABLE public.vendor_invites
  DROP CONSTRAINT IF EXISTS vendor_invites_source_vendor_consistency;

ALTER TABLE public.vendor_invites
  ADD CONSTRAINT vendor_invites_source_vendor_consistency
  CHECK (
    (source = 'couple' AND vendor_id IS NOT NULL) OR
    (source = 'admin'  AND vendor_id IS NULL)
  );

-- ----------------------------------------------------------------------------
-- 3. Admin-side uniqueness — one live pending invite per (lower email).
-- ----------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS vendor_invites_admin_live_unique
  ON public.vendor_invites(LOWER(email))
  WHERE status = 'pending' AND source = 'admin';

-- ----------------------------------------------------------------------------
-- 4. RLS — admin write policies
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS vendor_invites_admin_write_all ON public.vendor_invites;
CREATE POLICY vendor_invites_admin_write_all
  ON public.vendor_invites FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;

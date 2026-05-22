-- ============================================================================
-- 20260604160000_vendor_invites_auto_share_link_source.sql
--
-- Owner directive 2026-05-22 (verbatim):
--   "when we lock a vendor for an event without an account here, there will
--    be a link the host can send to the vendor to login and lock this
--    schedule for them. they will have access to the free account for
--    vendors."
--
-- Extends `vendor_invites` with a THIRD source value `'auto_share_link'`
-- so finalizeVendor can auto-create a claim invite at lock-time for
-- manual vendors (rows where event_vendors.manual_vendor_id IS NOT NULL
-- AND event_vendors.marketplace_vendor_id IS NULL).
--
-- Why a new source instead of reusing 'couple':
--   • The 2026-05-19 'couple' source assumes the host typed an email
--     ("Invite vendor" form in vendors/invite-modal.tsx) and the partial
--     unique index on (vendor_id, LOWER(email)) WHERE status='pending'
--     enforces one live invite per (vendor_id, email).
--   • The auto-share-link path generates an invite BEFORE the host has
--     entered any email — the host shares the link manually via
--     whatever channel (Viber, FB Messenger, SMS, etc.). Email is a
--     LATER capture from the vendor's signup itself.
--   • event_manual_vendors has NO email column (just business_name +
--     contact_person + contact_number per 20260604080000). So we have
--     no email to seed at auto-create time.
--
-- Schema changes:
--   1. vendor_invites.source CHECK expanded: now accepts
--      {'couple', 'admin', 'auto_share_link'}.
--   2. vendor_invites.email becomes nullable.
--   3. vendor_invites_source_vendor_consistency CHECK refreshed:
--        - 'couple' source still requires vendor_id NOT NULL + email NOT NULL
--          (preserves the 2026-05-19 emailed-invite contract)
--        - 'admin' source still requires vendor_id NULL (preserves the
--          2026-05-21 admin-source contract); email stays NOT NULL since
--          admin invites always carry a target email
--        - 'auto_share_link' requires vendor_id NOT NULL (it's anchored to
--          a specific event_vendors row, just like couple-source) AND
--          allows email to be NULL (host shares manually, vendor's email
--          captured at signup)
--   4. New partial unique index `vendor_invites_auto_share_live_unique`
--      on (vendor_id) WHERE source='auto_share_link' AND status='pending'
--      so finalizeVendor's idempotent ensure-token helper can rely on
--      ONE pending auto_share_link invite per event_vendors row.
--
-- Idempotent + backwards-compatible:
--   - Existing 'couple' rows: unaffected (every existing row has email
--     populated; the looser email-nullable column doesn't change anything
--     for them).
--   - Existing 'admin' rows: unaffected (every existing admin row has
--     email populated; the per-source CHECK preserves that requirement).
--   - Existing partial unique indexes (vendor_invites_live_unique on couple,
--     vendor_invites_admin_live_unique on admin) untouched.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Drop the old source CHECK, add the new one with 3 values
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_invites
  DROP CONSTRAINT IF EXISTS vendor_invites_source_check;

-- Some Postgres versions auto-name the inline CHECK from 20260527010000
-- as `vendor_invites_source_check`. Drop variants defensively.
DO $$
DECLARE
  conname TEXT;
BEGIN
  FOR conname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public'
      AND rel.relname = 'vendor_invites'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%source%IN%couple%admin%'
  LOOP
    EXECUTE format('ALTER TABLE public.vendor_invites DROP CONSTRAINT IF EXISTS %I', conname);
  END LOOP;
END $$;

ALTER TABLE public.vendor_invites
  ADD CONSTRAINT vendor_invites_source_check
  CHECK (source IN ('couple', 'admin', 'auto_share_link'));

-- ----------------------------------------------------------------------------
-- 2. Relax email to nullable
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_invites
  ALTER COLUMN email DROP NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. Refresh the source/vendor/email consistency CHECK
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_invites
  DROP CONSTRAINT IF EXISTS vendor_invites_source_vendor_consistency;

ALTER TABLE public.vendor_invites
  ADD CONSTRAINT vendor_invites_source_vendor_consistency
  CHECK (
    (source = 'couple'           AND vendor_id IS NOT NULL AND email IS NOT NULL) OR
    (source = 'admin'            AND vendor_id IS NULL     AND email IS NOT NULL) OR
    (source = 'auto_share_link'  AND vendor_id IS NOT NULL)
  );

-- ----------------------------------------------------------------------------
-- 4. Partial unique index — one live auto_share_link invite per event_vendors row
-- ----------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS vendor_invites_auto_share_live_unique
  ON public.vendor_invites(vendor_id)
  WHERE status = 'pending' AND source = 'auto_share_link';

-- ----------------------------------------------------------------------------
-- 5. Column comment refresh
-- ----------------------------------------------------------------------------

COMMENT ON COLUMN public.vendor_invites.source IS
  'Who initiated the invite. ''couple'' (2026-05-19) — host typed an email '
  'in the vendor invite modal. ''admin'' (2026-05-21) — Setnayan team '
  'pre-created the vendor account from /admin/vendors/invite (no vendor_id, '
  'no event link). ''auto_share_link'' (2026-05-22 / 20260604160000) — '
  'auto-created by finalizeVendor when host locks a manual vendor with no '
  'Setnayan account. Email is NULL at insert time; host shares the link '
  'manually via whatever channel; vendor''s email is captured at signup.';

COMMENT ON COLUMN public.vendor_invites.email IS
  'Target email for couple-source + admin-source invites. NULL for '
  'auto_share_link source (host shares the claim URL manually; vendor''s '
  'email is captured at signup). The vendor_invites_source_vendor_consistency '
  'CHECK enforces NOT NULL for couple + admin sources.';

COMMIT;

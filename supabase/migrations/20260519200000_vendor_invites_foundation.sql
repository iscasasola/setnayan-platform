-- ============================================================================
-- 20260519200000_vendor_invites_foundation.sql
-- Iteration 0006 + 0022 — Couple-initiated invite for off-platform vendors.
-- Spec lock: CLAUDE.md "Tenth 2026-05-19 row" + "Eleventh 2026-05-19 row".
--
-- Adds:
--   • `marketplace_vendor_id` FK column on `event_vendors` — links a
--     couple-encoded vendor row to a real `vendor_profiles` entry. NULL =
--     off-platform (the default). Populated when the vendor claims a
--     couple-sent invite, accepts a Connect (already-on-Setnayan), or
--     when the couple originally picks a marketplace vendor (no UI for
--     that path yet — column is forward-compat).
--   • `vendor_invite_status` enum — 5 lifecycle states.
--   • `vendor_invites` table — one row per couple→email invite. Partial
--     unique index on (vendor_id, LOWER(email)) WHERE status='pending'
--     prevents duplicate live invites for the same address.
--   • RLS — couples read+write their own event's invites; the
--     `/vendor/claim/{token}` route reads via admin client (bypasses RLS
--     by design since the token is the access gate).
--
-- Per "Eleventh 2026-05-19 row": when `marketplace_vendor_id` is populated
-- via any link path, the application layer ALSO inserts a `vendor_follows`
-- row so the 0019 chat follow-gate doesn't lock the freshly-unlocked
-- chat. The vendor_follows insert lives in app code (server actions), not
-- in a DB trigger — keeps the auto-follow rule visible in the call path
-- rather than buried in pg_trigger output.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. event_vendors.marketplace_vendor_id — nullable FK to vendor_profiles
-- ----------------------------------------------------------------------------

ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS marketplace_vendor_id UUID
    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS event_vendors_marketplace_vendor_idx
  ON public.event_vendors(marketplace_vendor_id)
  WHERE marketplace_vendor_id IS NOT NULL;

COMMENT ON COLUMN public.event_vendors.marketplace_vendor_id IS
  'Optional link to the canonical vendor_profiles row. NULL = off-platform '
  '(couple-encoded, no Setnayan vendor account). Populated atomically when '
  'an invite is claimed or a Connect happens. App-layer also inserts a '
  'vendor_follows row in the same transaction (per 0019 § Booking-implies-'
  'follow auto-insert, locked 2026-05-19).';

-- ----------------------------------------------------------------------------
-- 2. vendor_invite_status — 5 lifecycle states
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.vendor_invite_status AS ENUM (
    'pending',
    'claimed',
    'expired',
    'revoked',
    'declined'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 3. vendor_invites
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_invites (
  invite_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id              TEXT UNIQUE NOT NULL DEFAULT public.generate_public_id('I'),

  -- Parent event_vendors row this invite was sent for.
  vendor_id              UUID NOT NULL
    REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,

  -- Couple-side sender (who tapped "Invite to Setnayan").
  invited_by_user_id     UUID NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Email-only delivery per the 2026-05-19 lock. No SMS in V1.
  email                  TEXT NOT NULL,

  -- Snapshot of the vendor row at invite time (so the claim page renders
  -- a stable identity even if the couple edits the row afterward).
  business_name          TEXT NOT NULL,
  service_category       TEXT,

  -- Opaque URL-safe token (~32 chars base64url). The token IS the access
  -- gate — every claim-page render verifies it; no separate auth.
  claim_token            TEXT UNIQUE NOT NULL,

  status                 public.vendor_invite_status NOT NULL DEFAULT 'pending',

  -- 90-day TTL per the 2026-05-19 lock. Lazy expiration sweep at
  -- claim-page render flips pending→expired; no cron.
  sent_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at             TIMESTAMPTZ NOT NULL,

  -- Set when status flips to 'claimed' (via either the new-vendor signup
  -- path or the Already-on-Setnayan Connect path).
  claimed_by_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_vendor_profile_id UUID
    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE SET NULL,
  claimed_at             TIMESTAMPTZ,

  declined_at            TIMESTAMPTZ,
  revoked_at             TIMESTAMPTZ,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_invites_vendor_idx
  ON public.vendor_invites(vendor_id);

CREATE INDEX IF NOT EXISTS vendor_invites_invited_by_idx
  ON public.vendor_invites(invited_by_user_id);

-- One live (pending) invite per (vendor_id, lowercased email). Revoking
-- the existing pending row releases the slot for a new invite.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_invites_live_unique
  ON public.vendor_invites(vendor_id, LOWER(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS vendor_invites_pending_expires_idx
  ON public.vendor_invites(expires_at)
  WHERE status = 'pending';

ALTER TABLE public.vendor_invites ENABLE ROW LEVEL SECURITY;

-- The couple member who created the invite (and their event collaborators
-- via the standard event-scoped read pattern) can SELECT + UPDATE +
-- DELETE the row from the dashboard. The vendor-side claim page reads via
-- the admin client (token IS the access gate) so no public SELECT policy
-- is needed.
DROP POLICY IF EXISTS vendor_invites_couple_read ON public.vendor_invites;
CREATE POLICY vendor_invites_couple_read
  ON public.vendor_invites FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (
      SELECT vendor_id FROM public.event_vendors
      WHERE event_id IN (SELECT public.current_couple_event_ids())
    )
  );

DROP POLICY IF EXISTS vendor_invites_couple_write ON public.vendor_invites;
CREATE POLICY vendor_invites_couple_write
  ON public.vendor_invites FOR ALL
  TO authenticated
  USING (
    vendor_id IN (
      SELECT vendor_id FROM public.event_vendors
      WHERE event_id IN (SELECT public.current_couple_event_ids())
    )
  )
  WITH CHECK (
    vendor_id IN (
      SELECT vendor_id FROM public.event_vendors
      WHERE event_id IN (SELECT public.current_couple_event_ids())
    )
  );

COMMIT;

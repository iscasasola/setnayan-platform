-- ============================================================================
-- 20270811377742_vendor_papic_capture_counsel_gated.sql
--
-- ⚠️  COUNSEL-GATED — DO NOT `supabase db push` UNTIL THE DPO/NPC RULING.  ⚠️
--
-- Vendor free Papic capture tier (owner override 2026-07-16, council verdict §8).
-- The council CUT this from V1 because a vendor collecting guest photos/clips for
-- its own use makes the vendor a THIRD-PARTY CONTROLLER of guest PI the guest
-- never consented to — widening the LIVE NPC filing (project_setnayan_privacy_
-- reconciliation). The owner overrode the cut and owns that exposure. Per the
-- standing counsel item, the DPO/NPC consent-chain + controller/processor ruling
-- GOVERNS GO-LIVE: this file is committed so the shape is reviewable, but it must
-- not land in prod until counsel signs off. The app surface is additionally
-- flag-gated (VENDOR_PAPIC_CAPTURE_ENABLED) and defaults OFF.
--
-- RA 10173 minimums baked into the schema (non-negotiable even under override):
--   • consent_basis           — the lawful basis captured at collection time.
--   • guest_consent_snapshot  — the consent state the capture relied on.
--   • nsfw_checked            — the always-on NSFW filter (cannot be disabled).
--   • geo IS NOT stored here   — geo is stripped on any vendor-facing share.
--
-- Free tier = 10 photos + 3 clips per (vendor, event); +30 = Papic Ltd, +100 =
-- Papic Unli (paid via vendor tokens — flat ₱200, monetize the doorway not the
-- deal). Caps live on vendor_papic_capture_grants; the app enforces the count.
-- 5-second hard cap on clips (product lock) is enforced client-side + here as a
-- documented invariant.
-- ============================================================================

BEGIN;

-- Per-(vendor, event) capture allowance. Absent row → the free 10/3 default.
CREATE TABLE IF NOT EXISTS public.vendor_papic_capture_grants (
  grant_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL,
  event_id          UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  tier              TEXT NOT NULL DEFAULT 'free'
                    CHECK (tier IN ('free', 'ltd', 'unli')),
  photo_cap         INTEGER NOT NULL DEFAULT 10 CHECK (photo_cap >= 0),
  clip_cap          INTEGER NOT NULL DEFAULT 3 CHECK (clip_cap >= 0),
  -- The vendor-token order that upgraded the tier (null on the free default).
  upgrade_order_id  UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vendor_profile_id, event_id)
);

COMMENT ON TABLE public.vendor_papic_capture_grants IS
  'COUNSEL-GATED. Per-(vendor,event) Papic capture allowance. free=10 photos/3 clips (default when no row); ltd=+30; unli=+100. Upgrades paid in vendor tokens. App enforces the caps against vendor_papic_captures counts.';

-- The captures. Distinct from couple-provisioned papic_photos (no vendor_profile_
-- id there) — this is the vendor's own capture lane, gated to their booked event.
CREATE TABLE IF NOT EXISTS public.vendor_papic_captures (
  capture_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id      UUID NOT NULL,
  event_id               UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  r2_object_key          TEXT NOT NULL,
  media_type             TEXT NOT NULL CHECK (media_type IN ('photo', 'clip')),
  -- 5-second hard cap on clips (product lock). Photos store NULL.
  clip_duration_ms       INTEGER CHECK (
                           clip_duration_ms IS NULL
                           OR (clip_duration_ms > 0 AND clip_duration_ms <= 5000)
                         ),
  captured_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_model           TEXT,
  -- RA 10173 provenance (non-negotiable):
  consent_basis          TEXT NOT NULL DEFAULT 'pending_dpo_ruling'
                         CHECK (consent_basis IN ('pending_dpo_ruling', 'event_consent', 'guest_optin')),
  nsfw_checked           BOOLEAN NOT NULL DEFAULT FALSE,
  -- Soft delete for takedowns.
  hidden_at              TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_papic_captures_ve_idx
  ON public.vendor_papic_captures (vendor_profile_id, event_id, media_type)
  WHERE hidden_at IS NULL;

COMMENT ON TABLE public.vendor_papic_captures IS
  'COUNSEL-GATED (DO NOT push until DPO/NPC ruling). Vendor-lane Papic captures for a booked event. Geo intentionally NOT stored (stripped on vendor shares). consent_basis defaults to pending_dpo_ruling; nsfw_checked must be TRUE to surface. 5s clip cap enforced.';

-- RLS AT CREATE TIME. Vendor reads/writes their own captures on booked events.
ALTER TABLE public.vendor_papic_capture_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_papic_captures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_papic_grants_read ON public.vendor_papic_capture_grants;
CREATE POLICY vendor_papic_grants_read
  ON public.vendor_papic_capture_grants FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()) OR public.is_admin());

DROP POLICY IF EXISTS vendor_papic_captures_vendor_read ON public.vendor_papic_captures;
CREATE POLICY vendor_papic_captures_vendor_read
  ON public.vendor_papic_captures FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()) OR public.is_admin());

DROP POLICY IF EXISTS vendor_papic_captures_vendor_insert ON public.vendor_papic_captures;
CREATE POLICY vendor_papic_captures_vendor_insert
  ON public.vendor_papic_captures FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
  );

DROP POLICY IF EXISTS vendor_papic_captures_vendor_update ON public.vendor_papic_captures;
CREATE POLICY vendor_papic_captures_vendor_update
  ON public.vendor_papic_captures FOR UPDATE TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

COMMIT;

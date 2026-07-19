-- ============================================================================
-- 20270814219429_data_privacy_controls.sql
--
-- Data Privacy control board — admin-approved activation of every privacy-
-- sensitive capability (RA 10173). ONE row per control; an admin flips it
-- active/inactive/blocked from /admin/data-privacy and the flip is recorded
-- (approved_by + approved_at + note) as the audit trail that supports the NPC
-- filing. Feature gates read this table (status='active') instead of scattered
-- env flags, so the owner controls activation in-app — no redeploy, no engineer
-- in the loop.
--
-- Seeded from the code catalog (lib/data-privacy-controls.ts). Re-run safe
-- (ON CONFLICT DO NOTHING keeps admin edits). Admin-only RLS.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.data_privacy_controls (
  control_key   TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  category      TEXT NOT NULL,
  risk_note     TEXT,
  -- inactive = built but off · active = approved & live · blocked = hard-held.
  status        TEXT NOT NULL DEFAULT 'inactive'
                CHECK (status IN ('inactive', 'active', 'blocked')),
  -- Audit trail (RA 10173 accountability).
  approved_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at   TIMESTAMPTZ,
  note          TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 100,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.data_privacy_controls IS
  'Data Privacy control board (RA 10173). One row per privacy-sensitive capability; an admin approves activation at /admin/data-privacy and the flip is recorded (approved_by/at/note). Feature gates read status=active. Admin-only RLS. Seeded from lib/data-privacy-controls.ts.';

-- RLS AT CREATE TIME — admin only (read + write). Non-admins never see it.
ALTER TABLE public.data_privacy_controls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_privacy_controls_admin_read ON public.data_privacy_controls;
CREATE POLICY data_privacy_controls_admin_read
  ON public.data_privacy_controls FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS data_privacy_controls_admin_write ON public.data_privacy_controls;
CREATE POLICY data_privacy_controls_admin_write
  ON public.data_privacy_controls FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Seed the catalog (mirror of lib/data-privacy-controls.ts) ────────────────
INSERT INTO public.data_privacy_controls (control_key, title, description, category, risk_note, sort_order) VALUES
  ('vendor_papic_capture',
   'Vendor Papic capture',
   'Lets a booked vendor collect photos and 5s clips of the event they are working (10 free + Ltd/Unli). Media is the vendor''s, scoped to their booked event.',
   'Guest media via vendor',
   'The vendor becomes a third-party controller of guest images — a consent basis for guest capture is required. NSFW filter on, geo stripped on share.',
   10),
  ('vendor_guest_delivery',
   'Per-guest vendor delivery tracker',
   'Lets a pax-serving vendor mark which guests have received their product (meal, souvenir) — unchecked = not yet received.',
   'Guest data via vendor',
   'Creates a vendor↔guest link to the couple''s guest list. Needs a consent/limitation basis for a vendor to see per-guest status.',
   20),
  ('face_enrollment',
   'Face detection & auto-tag',
   'Per-event face enrollment + auto-tagging of Papic photos (confidence ≥0.85 auto, 0.65–0.85 suggested). Vectors are per-event-scoped, never reused across events.',
   'Biometric (sensitive PI)',
   'Biometric data is sensitive PI under RA 10173. The live /privacy notice must disclose it and offer face-data revocation.',
   30),
  ('papic_geo_metadata',
   'Capture geolocation metadata',
   'Stamps captured_at + geo on photos/clips when a device fix is available. Geo is stripped on outbound shares; the original on R2 retains it.',
   'Location data',
   'Location is PI. Retention + the share-time strip must be disclosed; the stored original still carries geo.',
   40),
  ('cross_event_vendor_recall',
   'Cross-event vendor recall',
   'Surfaces a guest''s previously-saved / previously-booked vendors across their events (guest_saved_vendors, prior-event names).',
   'Cross-event linkage',
   'Links a person''s data across separate events without an explicit consent gate today. Needs a purpose + opt-out.',
   50),
  ('faith_religion_graph',
   'Faith / religion person graph',
   'Optional religion on a person unlocks faith-rite events (Binyag → Communion → Confirmation → Wedding) and sponsor/godparent edges.',
   'Sensitive PI (religion)',
   'Religious belief is sensitive PI. Must be strictly optional, unlocks-not-gates, with an explicit basis.',
   60),
  ('dependent_minor_profiles',
   'Dependent & minor profiles',
   'Lets a guardian account hold profiles for dependents, including minors (under 18) and elders, with transfer at age of majority.',
   'Minors'' data',
   'Processing minors'' data needs guardian consent + the ownership/transfer model; counsel-gated in the corpus.',
   70),
  ('home_activity_signals',
   'Home & onboarding signal capture',
   'Captures the SPI/PI signals the updated Home + onboarding collect (event brief, love-story, experience quiz) to drive the free deterministic engines.',
   'Profile & onboarding PI',
   'Some signals are SPI. The live /privacy notice must list what is collected and the purpose.',
   80)
ON CONFLICT (control_key) DO NOTHING;

COMMIT;

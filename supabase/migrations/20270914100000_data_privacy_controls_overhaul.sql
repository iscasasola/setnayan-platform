-- Data Privacy control board — overhaul (RA 10173).
--
-- Three things, all idempotent:
--   1. Widen the status CHECK to add 'retired' (a control whose feature was never
--      built / was removed — parked, not part of the live active/off set).
--   2. Add the two live-processing activities that had a DPIA on file but NO
--      board control: antifraud_trust_signals (LIVE → seed 'active') and
--      device_fingerprint (built, DPO-gated OFF → seed 'inactive').
--   3. Rearrange sort_order into risk-grouped sections, and correct the status of
--      three rows so the board stops implying live processing where there is none:
--        - papic_geo_metadata     → 'retired'  (no write path stamps geo; the geo
--                                    plumbing is dead code; nothing to gate)
--        - faith_religion_graph   → 'inactive' (built but env-off + counsel-gated;
--                                    not live in prod)
--        - dependent_minor_profiles → 'inactive' (built #3327 but env-off +
--                                    counsel-gated; not live in prod)
--
-- The live controls (face_enrollment, vendor_papic_capture, vendor_guest_delivery,
-- cross_event_vendor_recall, home_activity_signals, the coordinator + vendor-AI
-- set) keep their owner-set status untouched.

-- ── 1. status CHECK: add 'retired' ───────────────────────────────────────────
ALTER TABLE public.data_privacy_controls
  DROP CONSTRAINT IF EXISTS data_privacy_controls_status_check;
ALTER TABLE public.data_privacy_controls
  ADD CONSTRAINT data_privacy_controls_status_check
  CHECK (status IN ('inactive', 'active', 'blocked', 'retired'));

-- ── 2. New controls (catalog copy mirrors lib/data-privacy-controls.ts) ───────
-- antifraud_trust_signals: automated vendor auto-suspend fires today on every
-- couple review submit, completely unguarded. It has a filed DPIA
-- (09_DPIA_AntiFraud_Trust_Integrity) but no in-app control. Seed ACTIVE so the
-- live behavior is unchanged; the new gate is now the owner's kill-switch.
INSERT INTO public.data_privacy_controls
  (control_key, title, description, category, risk_note, status, sort_order)
VALUES
  (
    'antifraud_trust_signals',
    'Anti-fraud automated vendor suspension',
    'Identity-clustering + five-signal vendor fraud scoring, and the ONE automated decision it can take: a reversible auto-suspend (hides the vendor + freezes badges) when the aggregate open-signal score crosses the bar. Detection/scoring into the admin review queue is unaffected — only the automated suspension is gated.',
    'Automated decision (vendor)',
    'An automated decision that significantly affects a vendor under RA 10173 — it needs a published disclosure, a legitimate-interest assessment, and a documented contest/appeal path (NPC task t1-4). Fail-closed = no automated suspension; humans still act from the queue.',
    'active',
    70
  ),
  (
    'device_fingerprint',
    'Device-fingerprint fraud data',
    'Records a coarse, first-party per-browser device id (hashed server-side, never the raw id) into user_devices, lighting up identity-cluster + shared-device detection. Deliberately coarse — no canvas/behavioral fingerprint, no external SDK.',
    'Fraud prevention / device data',
    'A NEW pseudonymous data-collection practice. A DPO review is on file (12_Device_Fingerprint_DPO_Review) and a documented LIA is still owed (NPC task t2-10). Kept OFF until DPO sign-off; the capture path AND-gates this control with the NEXT_PUBLIC_DEVICE_FINGERPRINT_ENABLED env flag.',
    'inactive',
    100
  )
ON CONFLICT (control_key) DO NOTHING;

-- ── 3a. Rearrange: risk-grouped sort_order for the whole board ────────────────
-- Group 1 · Biometric & sensitive PI
UPDATE public.data_privacy_controls SET sort_order = 10  WHERE control_key = 'face_enrollment';
UPDATE public.data_privacy_controls SET sort_order = 20  WHERE control_key = 'faith_religion_graph';
UPDATE public.data_privacy_controls SET sort_order = 30  WHERE control_key = 'dependent_minor_profiles';
-- Group 2 · Vendor-mediated guest data
UPDATE public.data_privacy_controls SET sort_order = 40  WHERE control_key = 'vendor_papic_capture';
UPDATE public.data_privacy_controls SET sort_order = 50  WHERE control_key = 'vendor_guest_delivery';
UPDATE public.data_privacy_controls SET sort_order = 60  WHERE control_key = 'cross_event_vendor_recall';
-- Group 3 · Automated processing & AI
UPDATE public.data_privacy_controls SET sort_order = 70  WHERE control_key = 'antifraud_trust_signals';
UPDATE public.data_privacy_controls SET sort_order = 80  WHERE control_key = 'vendor_ai_autoreply';
UPDATE public.data_privacy_controls SET sort_order = 90  WHERE control_key = 'vendor_deep_search';
UPDATE public.data_privacy_controls SET sort_order = 100 WHERE control_key = 'device_fingerprint';
-- Group 4 · Coordinator access (privacy-sensitive)
UPDATE public.data_privacy_controls SET sort_order = 110 WHERE control_key = 'coordinator_consent_money';
UPDATE public.data_privacy_controls SET sort_order = 120 WHERE control_key = 'coordinator_prep_release';
-- Group 5 · Profile & onboarding
UPDATE public.data_privacy_controls SET sort_order = 130 WHERE control_key = 'home_activity_signals';
-- Group 6 · Activation switches (not privacy-sensitive)
UPDATE public.data_privacy_controls SET sort_order = 140 WHERE control_key = 'coordinator_run_of_show';
UPDATE public.data_privacy_controls SET sort_order = 150 WHERE control_key = 'coordinator_day_of_broadcast';
-- Group 7 · Retired (sinks to the bottom)
UPDATE public.data_privacy_controls SET sort_order = 900 WHERE control_key = 'papic_geo_metadata';

-- ── 3b. Status corrections — make the board reflect prod reality ──────────────
-- papic_geo_metadata: no write path stamps geo; the CaptureMetadata plumbing is
-- dead code hitting a presign-only route. There is no live feature to gate, so
-- 'Active' was a false positive. Retire it (the ROPA "location on captures"
-- activity is aspirational, not current processing).
UPDATE public.data_privacy_controls
  SET status = 'retired', approved_by = NULL, approved_at = NULL, updated_at = NOW()
  WHERE control_key = 'papic_geo_metadata';

-- faith_religion_graph + dependent_minor_profiles: built, but both sit behind the
-- OFF NEXT_PUBLIC_DEPENDENT_PEOPLE env flag and are counsel-gated — not live in
-- prod. The wired gate now AND-gates the env flag with this control, so 'inactive'
-- is the honest + protective default (both the env flag AND the control must be
-- turned on before any religion/minor SPI is processed).
UPDATE public.data_privacy_controls
  SET status = 'inactive', approved_by = NULL, approved_at = NULL, updated_at = NOW()
  WHERE control_key IN ('faith_religion_graph', 'dependent_minor_profiles');

-- home_activity_signals + cross_event_vendor_recall: these gate features that are
-- LIVE in prod today (the onboarding love-story / signature-details capture, and
-- the Library "vendors from weddings you attended" surface). This migration ships
-- the FIRST fail-closed gate on them, so the control MUST be 'active' or the gate
-- would silently drop live data (empty love_story, hidden attended-vendors). Force
-- 'active' so wiring the gate is behavior-preserving by construction — not
-- dependent on the owner having manually approved them earlier. In prod both are
-- already active (owner-approved 2026-07-16), so this is a no-op there; on a fresh
-- or staging DB it guarantees the live behavior. The remaining /privacy disclosure
-- for home_activity_signals SPI is tracked separately (NPC task t1-6).
UPDATE public.data_privacy_controls
  SET status = 'active', updated_at = NOW()
  WHERE control_key IN ('home_activity_signals', 'cross_event_vendor_recall')
    AND status <> 'active';

-- ⚠ DEPLOY ORDERING (antifraud_trust_signals): the code gate reads this control,
-- so between the code deploy and this migration applying, the row does not exist
-- yet → the gate reads 'inactive' and automated vendor auto-suspend PAUSES for that
-- window (detection/scoring + the admin queue keep working; enforcement is
-- reversible, so the harm is low). Verify this migration applied on merge and, if
-- the shared-concurrency migrations workflow skipped it, dispatch it manually.

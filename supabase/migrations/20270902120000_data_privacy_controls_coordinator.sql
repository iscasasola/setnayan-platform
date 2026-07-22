-- ============================================================================
-- 20270902120000_data_privacy_controls_coordinator.sql
--
-- Move the coordinator DPO-gated features off env flags and onto the admin
-- Data Privacy control board (20270814219429). An admin approves activation at
-- /admin/data-privacy and the flip is recorded (approved_by/at) as the RA 10173
-- audit trail; the feature gates read status='active' — no env flag, no
-- redeploy, no engineer in the loop.
--
-- Seeds TWO controls (mirror of lib/data-privacy-controls.ts), status inactive
-- (fail-closed). Re-run safe (ON CONFLICT DO NOTHING keeps admin edits).
--
--   coordinator_consent_money  ← was NEXT_PUBLIC_COORDINATOR_CONSENT_GATE_ENABLED
--   coordinator_prep_release   ← was NEXT_PUBLIC_COORDINATOR_PREP_RELEASE_ENABLED
--
-- The scheduling flags (P2 run-of-show, P3 broadcast) are NOT privacy-sensitive
-- and stay as ordinary flags — they don't belong on the DPO board.
-- ============================================================================

BEGIN;

INSERT INTO public.data_privacy_controls
  (control_key, title, description, category, risk_note, sort_order)
VALUES
  ('coordinator_consent_money',
   'Coordinator consent + money scopes',
   'The RA 10173 consent modal at the coordinator invite (guest list, seating, schedule, vendor chats) AND the couple''s optional "Can lock vendors" / "Can handle payments" scopes that let a coordinator finalize vendors and handle checkout on the couple''s behalf.',
   'Guest PII + money via coordinator',
   'Widens a coordinator''s access over guest PII and, if the couple grants it, money-adjacent actions. Consent is captured at invite; face/biometric data stays excluded. Confirm the DPO ruling before activating.',
   90),
  ('coordinator_prep_release',
   'Coordinator prep-then-release',
   'Lets a coordinator stage schedule (run-of-show) blocks privately and release them to the couple. Staged blocks are hidden from the couple, guests, and booked vendors until released.',
   'Coordinator private working set',
   'Widens the coordinator''s private working surface over the couple''s planning data (schedule). Same consent basis as the coordinator consent gate.',
   100)
ON CONFLICT (control_key) DO NOTHING;

COMMIT;

-- ============================================================================
-- 20270903120000_data_privacy_controls_coordinator_scheduling.sql
--
-- Put the coordinator scheduling features (P2 filtered run-of-show, P3 day-of
-- broadcast + call-times) on the admin control board too, so the WHOLE
-- coordinator suite activates from one page (/admin/data-privacy).
--
-- ⚠ These are NOT privacy-sensitive — they're ordinary activation switches. The
-- board is the de-facto "dark feature activation" surface; the rows are
-- explicitly labelled "activation only — not privacy-sensitive" so the RA 10173
-- audit trail stays truthful (an auditor sees they carry no privacy exposure).
--
-- Seeds two controls (mirror of lib/data-privacy-controls.ts), status inactive
-- (fail-closed). Re-run safe (ON CONFLICT DO NOTHING keeps admin edits).
--
--   coordinator_run_of_show       ← was NEXT_PUBLIC_SCHEDULE_ROS_P2_ENABLED
--   coordinator_day_of_broadcast  ← was NEXT_PUBLIC_COORDINATOR_P3_ENABLED
-- ============================================================================

BEGIN;

INSERT INTO public.data_privacy_controls
  (control_key, title, description, category, risk_note, sort_order)
VALUES
  ('coordinator_run_of_show',
   'Coordinator filtered run-of-show (P2)',
   'Coordinator schedule chrome: per-vendor / per-couple / per-guest filtered views over the one master run-of-show, responsible-party tags, reusable templates, and bulk retime.',
   'Coordinator activation — not privacy-sensitive',
   'No RA 10173 exposure — an activation switch, not a privacy control. Filters the already-guest-visible schedule; adds no new data collection or sharing.',
   110),
  ('coordinator_day_of_broadcast',
   'Coordinator day-of broadcast + call-times (P3)',
   'The day-of broadcast card (announcements to event members) and the optional per-vendor email call-times derived from the run-of-show.',
   'Coordinator activation — not privacy-sensitive',
   'No RA 10173 exposure — an activation switch. Emails go to booked vendors'' existing contact addresses; no new PII collection.',
   120)
ON CONFLICT (control_key) DO NOTHING;

COMMIT;

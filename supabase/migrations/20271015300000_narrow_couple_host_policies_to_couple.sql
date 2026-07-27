-- ============================================================================
-- Narrow ten policies that SAY couple/host but were implemented member-wide.
--
-- THE PROBLEM
-- -----------
-- `current_event_ids()` has no member_type filter:
--
--   SELECT event_id FROM public.event_members WHERE user_id = auth.uid();
--
-- so it returns an event for a GUEST exactly as it does for the COUPLE. 49
-- policies across 29 tables are written against it. Most of those are correct —
-- they are named `*_member_*` and are meant to admit any member.
--
-- Ten are not. Each is named `*_couple_*` or `*_host_*` — the author's own
-- stated intent — yet resolves through the member-wide function, so an ordinary
-- invited guest gets exactly what the couple gets. This migration makes those
-- ten match their names. It is not a judgement call about what a guest "should"
-- see; it is aligning an implementation with the intent already written on it.
--
-- The most consequential of the ten:
--   · user_reports_couple_read — HARASSMENT REPORTS. Any event member could read
--     every report filed on that event, including `reporter_user_id`. A guest
--     reported for harassment could identify the person who reported them.
--   · coordinator_access_consents (read AND write) — the RA 10173 consent record
--     lib/coordinator-money-scope.ts reads to authorise CHECKOUT. Any member
--     could read it and, through the FOR ALL policy, grant themselves scopes.
--
-- WHY THIS IS SAFE
-- ----------------
-- Every one of these ten tables is reached ONLY through the service-role client
-- in application code (verified by call-site audit 2026-07-27), and service_role
-- bypasses RLS entirely — so narrowing the policy cannot break a shipped path.
-- The single non-admin reference anywhere in the set is an INSERT into
-- user_reports (lib/chat-actions.ts, a user filing a report); this migration
-- touches no INSERT policy on that table.
--
-- WHAT IS DELIBERATELY NOT TOUCHED
-- --------------------------------
-- `current_event_ids()` itself is unchanged. Narrowing the function would move
-- all 49 policies at once, including the `*_member_*` ones that must keep
-- returning guests. The remaining policies that neither say "member" nor
-- "couple/host" — kwento_assignments, event_day_requests, event_song_requests,
-- guest_columns_moderate, photo_messages_moderate, proposal_amendments and
-- proposal_amendment_items, event_feature_policy_override — are a genuine
-- product question (should a guest be able to write a proposal amendment?) and
-- several ARE reached by non-admin client paths, so they are surfaced for an
-- owner ruling rather than changed here.
-- ============================================================================

-- ── user_reports — harassment reports + the reporter's identity ─────────────
DROP POLICY IF EXISTS user_reports_couple_read ON public.user_reports;
CREATE POLICY user_reports_couple_read ON public.user_reports
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

-- ── coordinator_access_consents — the checkout-authorising consent record ───
DROP POLICY IF EXISTS coordinator_access_consents_host_select ON public.coordinator_access_consents;
CREATE POLICY coordinator_access_consents_host_select ON public.coordinator_access_consents
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()) OR public.is_admin());

DROP POLICY IF EXISTS coordinator_access_consents_host_write ON public.coordinator_access_consents;
CREATE POLICY coordinator_access_consents_host_write ON public.coordinator_access_consents
  FOR ALL TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()) OR public.is_admin())
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()) OR public.is_admin());

-- ── setnayan_ai_guard_log ──────────────────────────────────────────────────
DROP POLICY IF EXISTS couple_reads_setnayan_ai_guard_log ON public.setnayan_ai_guard_log;
CREATE POLICY couple_reads_setnayan_ai_guard_log ON public.setnayan_ai_guard_log
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

-- ── event_vendor_policy_acknowledgements ───────────────────────────────────
DROP POLICY IF EXISTS event_vendor_policy_acknowledgements_host_select
  ON public.event_vendor_policy_acknowledgements;
CREATE POLICY event_vendor_policy_acknowledgements_host_select
  ON public.event_vendor_policy_acknowledgements
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()) OR public.is_admin());

-- ── event_vendor_preferences ───────────────────────────────────────────────
DROP POLICY IF EXISTS event_vendor_preferences_host_select ON public.event_vendor_preferences;
CREATE POLICY event_vendor_preferences_host_select ON public.event_vendor_preferences
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()) OR public.is_admin());

DROP POLICY IF EXISTS event_vendor_preferences_host_write ON public.event_vendor_preferences;
CREATE POLICY event_vendor_preferences_host_write ON public.event_vendor_preferences
  FOR ALL TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()) OR public.is_admin())
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()) OR public.is_admin());

-- ── guest_qr_rotations — rotation history for guest QR tokens ───────────────
DROP POLICY IF EXISTS guest_qr_rotations_host_read ON public.guest_qr_rotations;
CREATE POLICY guest_qr_rotations_host_read ON public.guest_qr_rotations
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()) OR public.is_admin());

-- ── vendor_guest_deliveries ────────────────────────────────────────────────
DROP POLICY IF EXISTS vendor_guest_deliveries_couple_read ON public.vendor_guest_deliveries;
CREATE POLICY vendor_guest_deliveries_couple_read ON public.vendor_guest_deliveries
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()) OR public.is_admin());

-- ── vendor_release_history — note: scoped by `event_id_snapshot` ────────────
DROP POLICY IF EXISTS vendor_release_history_host_read ON public.vendor_release_history;
CREATE POLICY vendor_release_history_host_read ON public.vendor_release_history
  FOR SELECT TO authenticated
  USING (event_id_snapshot IN (SELECT public.current_couple_event_ids()));

COMMENT ON FUNCTION public.current_event_ids() IS
  'Event ids the caller is a member of — ANY member_type (couple, guest, …). '
  'Deliberately unfiltered: the `*_member_*` policies depend on guests being '
  'returned. ⚠ A policy named *_couple_* or *_host_* must use '
  'current_couple_event_ids() instead — ten such policies were corrected on '
  '2026-07-27 (migration 20271015300000) after an audit found them granting '
  'guests couple-level access, including to harassment reports and the '
  'coordinator checkout-consent record.';

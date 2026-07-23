-- ============================================================================
-- RLS guest-scope hardening — re-scope sensitive policies off current_event_ids
-- ============================================================================
-- ROOT CAUSE: public.current_event_ids() = SELECT event_id FROM event_members
-- WHERE user_id = auth.uid() — with NO member_type filter. A plain GUEST
-- (member_type='guest', seeded when someone joins via app/join/[eventId]) is
-- therefore returned as a full event "member". Every policy scoped on
-- current_event_ids() thus leaks to any guest who joined the event.
--
-- Owner decision (2026-07-23): a plain guest gets a read-only BENIGN event view
-- (schedule / seat plan / the event row) but must NEVER reach tokens, orders,
-- payments, biometric data, vendor payment schedules, or other guests' secrets.
--
-- This migration DROP/CREATEs each sensitive policy below, changing ONLY the
-- scope helper and keeping every other clause. RLS stays ENABLED on every
-- table; no policy is widened; no blanket allow-all predicate is introduced.
-- Benign
-- event-context tables (schedule / run-of-show / seat plan / the event row)
-- are deliberately left on current_event_ids() — guests keep those.
--
-- Scoped helpers reused (already shipped — see their defining migrations):
--   current_couple_event_ids()                 — member_type='couple' only
--     (20260513040000)
--   current_couple_or_coordinator_event_ids()  — couple + coordinator
--     (20270206186005)
--
-- Idempotent: DROP POLICY IF EXISTS + CREATE for every policy.
-- ============================================================================

BEGIN;

-- ── oauth_grants · event_member_reads_oauth_grants (SELECT) ──────────────────
-- Plaintext Google/YouTube OAuth refresh tokens. Couple only — not even
-- coordinators. (was: current_event_ids — 20260516261000)
DROP POLICY IF EXISTS event_member_reads_oauth_grants ON public.oauth_grants;
CREATE POLICY event_member_reads_oauth_grants ON public.oauth_grants
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

-- ── guests · event_member_can_read_guest (SELECT) ───────────────────────────
-- Exposes every guest's qr_token (→ ephemeral session mint). Co-hosts manage
-- the list, so couple + coordinator. The separate guest_reads_own_row policy
-- (20260513010000) is UNTOUCHED, so a guest still sees THEIR own row.
-- (was: current_event_ids — 20260513010000; keeps the deleted_at guard)
DROP POLICY IF EXISTS event_member_can_read_guest ON public.guests;
CREATE POLICY event_member_can_read_guest ON public.guests
  FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_or_coordinator_event_ids())
    AND deleted_at IS NULL
  );

-- ── orders · orders_owner_read (SELECT) ─────────────────────────────────────
-- The money ledger. Co-host (spouse) read was the intent; a guest must not read
-- it. Coordinators are deliberately NOT added (money-wall). The direct-owner
-- (user_id = auth.uid()) and admin arms are preserved verbatim.
-- (was: current_event_ids — 20270129279924)
DROP POLICY IF EXISTS orders_owner_read ON public.orders;
CREATE POLICY orders_owner_read ON public.orders
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
  );

-- ── guest_face_enrollments · event_member_can_read_face_enrollment (SELECT) ──
-- Biometric face vectors + selfie references. Couple only.
-- (was: current_event_ids — 20260901000000)
DROP POLICY IF EXISTS event_member_can_read_face_enrollment ON public.guest_face_enrollments;
CREATE POLICY event_member_can_read_face_enrollment ON public.guest_face_enrollments
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

-- ── event_vendor_payment_plan · host SELECT + host FOR ALL ──────────────────
-- Frozen per-booking vendor payment schedule (money-wall). A guest could
-- previously not only read it but DELETE it (the FOR ALL policy). Couple only.
-- (was: current_event_ids — 20270202160005)
DROP POLICY IF EXISTS event_vendor_payment_plan_host_select
  ON public.event_vendor_payment_plan;
CREATE POLICY event_vendor_payment_plan_host_select
  ON public.event_vendor_payment_plan FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS event_vendor_payment_plan_host_write
  ON public.event_vendor_payment_plan;
CREATE POLICY event_vendor_payment_plan_host_write
  ON public.event_vendor_payment_plan FOR ALL
  TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
  )
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    OR public.is_admin()
  );

-- The table comment asserted "Host-scoped RLS via current_event_ids()." — now
-- couple-scoped. Fix the invariant claim in the same commit.
COMMENT ON TABLE public.event_vendor_payment_plan IS
  'Vendor Transaction Lifecycle Phase 2 PR-B — per-booking PAYMENT PLAN frozen at lock from the booked service''s vendor_service_payment_schedules template. instances_json = [{seq,label,amount_php,due_date,percent_bps?,amount_kind?}]; empty = no schedule (pay vendor directly). cleared_at/by set in PR-D. Couple-scoped RLS via current_couple_event_ids() (money-wall — re-scoped 20270831174208 off current_event_ids so guests can no longer read or delete it).';

-- ── budget_allocation_decisions · SELECT (+ DELETE companion) ───────────────
-- The table comment already says "Couple-own-only". It was not true: both the
-- SELECT read AND the DELETE (RA 10173 erase) were scoped on current_event_ids,
-- so a guest could read every budget snapshot AND erase them. Re-scope both to
-- couple-only to make the comment true. The INSERT policy is already
-- member_type='couple'-gated and is left untouched.
-- (was: current_event_ids — 20260824000000)
DROP POLICY IF EXISTS couple_reads_budget_allocation_decisions ON public.budget_allocation_decisions;
CREATE POLICY couple_reads_budget_allocation_decisions ON public.budget_allocation_decisions
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS couple_deletes_budget_allocation_decisions ON public.budget_allocation_decisions;
CREATE POLICY couple_deletes_budget_allocation_decisions ON public.budget_allocation_decisions
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

-- ── event_appointments · couple INSERT + couple UPDATE ──────────────────────
-- A guest could previously cancel/move the couple's vendor appointments. Day-of
-- ops belong to couple + coordinator. The couple READ policy is deliberately
-- LEFT on current_event_ids() — appointment visibility is benign event context
-- (like the schedule) and guests keep it. Only the writes are re-scoped.
-- (was: current_event_ids — 20270713200000)
DROP POLICY IF EXISTS event_appointments_couple_insert ON public.event_appointments;
CREATE POLICY event_appointments_couple_insert
  ON public.event_appointments FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT public.current_couple_or_coordinator_event_ids()));

DROP POLICY IF EXISTS event_appointments_couple_update ON public.event_appointments;
CREATE POLICY event_appointments_couple_update
  ON public.event_appointments FOR UPDATE TO authenticated
  USING (event_id IN (SELECT public.current_couple_or_coordinator_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_or_coordinator_event_ids()));

-- ── guest_message_blocks · guest_message_blocks_manage (FOR ALL) ────────────
-- The Kwento harassment lever. Its USING already restricts moderation to
-- couple/coordinator (member_type gate), but its WITH CHECK was
-- `is_admin() OR event_id IN current_event_ids()` — and current_event_ids()
-- admits a plain guest. Because WITH CHECK (not USING) governs INSERT, ANY
-- authenticated guest could INSERT a block row over PostgREST (anon-key browser
-- client) and silence any other guest — bypassing the blockKwentoGuest server
-- action's own gate entirely. Tighten WITH CHECK to MIRROR the USING clause so
-- the DB is the real gate. (was WITH CHECK: current_event_ids — 20261113000972)
DROP POLICY IF EXISTS guest_message_blocks_manage ON public.guest_message_blocks;
CREATE POLICY guest_message_blocks_manage ON public.guest_message_blocks FOR ALL
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = guest_message_blocks.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = guest_message_blocks.event_id
        AND em.user_id = auth.uid()
        AND em.member_type IN ('couple','coordinator')
    )
  );

-- ── patiktok_oauth_grants · re-scope the guest-readable OAuth SELECT ─────────
-- Same leak class as oauth_grants above: this table stores plaintext TikTok
-- access_token + refresh_token (both NOT NULL) and its SELECT policy
-- event_member_reads_oauth_grants was `USING (current_event_ids())` — so any
-- plain guest on the event could read the couple's TikTok refresh tokens. The
-- table is DORMANT today (gated behind unset TIKTOK_CLIENT_KEY/SECRET/REDIRECT
-- env, so no rows), which is the only reason it wasn't already exploited. Rename
-- the SELECT policy to a couple-scoped one (the old name was reused across two
-- tables — disambiguate it here). admin_writes_oauth_grants is left untouched.
-- (was: current_event_ids — 20270331200000)
DROP POLICY IF EXISTS event_member_reads_oauth_grants ON public.patiktok_oauth_grants;
DROP POLICY IF EXISTS couple_reads_patiktok_oauth_grants ON public.patiktok_oauth_grants;
CREATE POLICY couple_reads_patiktok_oauth_grants ON public.patiktok_oauth_grants
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

-- ── Post-condition assert ───────────────────────────────────────────────────
-- Every re-scoped policy must (a) still exist and (b) no longer reference the
-- guest-admitting current_event_ids() helper in USING or WITH CHECK. The LIKE
-- pattern matches ONLY current_event_ids — current_couple_event_ids and
-- current_couple_or_coordinator_event_ids do not contain it as a substring.
-- (Mirrors the assert style in 20270828140000_papic_one_tiers.sql.)
DO $$
DECLARE
  r RECORD;
  v_bad INT;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('oauth_grants',                'event_member_reads_oauth_grants'),
      ('guests',                      'event_member_can_read_guest'),
      ('orders',                      'orders_owner_read'),
      ('guest_face_enrollments',      'event_member_can_read_face_enrollment'),
      ('event_vendor_payment_plan',   'event_vendor_payment_plan_host_select'),
      ('event_vendor_payment_plan',   'event_vendor_payment_plan_host_write'),
      ('budget_allocation_decisions', 'couple_reads_budget_allocation_decisions'),
      ('budget_allocation_decisions', 'couple_deletes_budget_allocation_decisions'),
      ('event_appointments',          'event_appointments_couple_insert'),
      ('event_appointments',          'event_appointments_couple_update'),
      ('guest_message_blocks',        'guest_message_blocks_manage'),
      ('patiktok_oauth_grants',       'couple_reads_patiktok_oauth_grants')
    ) AS t(tbl, pol)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = r.tbl AND policyname = r.pol
    ) THEN
      RAISE EXCEPTION 'RLS guest-scope: policy %.% is missing after re-scope', r.tbl, r.pol;
    END IF;

    SELECT count(*) INTO v_bad
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = r.tbl
      AND policyname = r.pol
      AND (
        coalesce(qual, '')       LIKE '%current_event_ids%'
        OR coalesce(with_check, '') LIKE '%current_event_ids%'
      );
    IF v_bad > 0 THEN
      RAISE EXCEPTION 'RLS guest-scope: policy %.% still references current_event_ids()', r.tbl, r.pol;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- account fix requests consent to fix
-- ============================================================================
-- Admin account-access model — Phase 2 CORE (consent-to-fix).
-- Admin_Account_Access_Model_2026-06-22.md §1 (tier 2: "admin proposes; user
-- approves; then it lands"), §3 (consent-to-fix rows of the action catalog),
-- §8 ("lawful basis on ACCESS, not just edits" — the approval row IS the RA
-- 10173 lawful-basis record), §9 (trust promise).
--
-- WHAT THIS IS: the "request the user to allow us to fix their account" flow.
-- An admin who spots a typo'd name/email/phone/address or a wrong event detail
-- (date/venue) proposes a correction. NOTHING changes on the user's account
-- until the user approves. The approval (or decline) is recorded here as the
-- documented, durable consent record.
--
-- SCOPE NOTE (Phase 2 CORE only): the DB-level two-admin enforcement triggers
-- (money/orders/refunds/payment_receiving_accounts/admin-promotion — §4
-- mustFix #1), handler-lane RBAC, and the §10b weekly pool sub-cap are
-- DEFERRED to follow-up PRs. This migration ships only the consent-to-fix
-- substrate. The money/identity consent-to-fix rows in §3 that ALSO need a
-- two-admin gate are intentionally NOT exposed by the Phase-2-CORE admin
-- surface yet — see the field-allowlist note in app/admin/users/actions.ts.
--
-- WHO CAN DO WHAT (RLS):
--   • Admins (is_admin()) INSERT proposals + may READ every row (queue view).
--   • The TARGET user may READ + UPDATE (approve/decline) only their OWN rows
--     — matched by target_user_id = auth.uid() OR, when the proposal is
--     event-scoped, by couple-membership of that event
--     (current_couple_event_ids()). The user can never INSERT a proposal nor
--     read someone else's.
--   • The actual application of an approved change is done by a server action
--     using the USER's OWN RLS-gated client (so the write is still bounded by
--     the user's normal row-level security on users/events) — this table only
--     records intent + consent; it is not itself the field being changed.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + ENABLE RLS in the same migration,
-- DROP POLICY IF EXISTS before each CREATE POLICY, CREATE INDEX IF NOT EXISTS.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.account_fix_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The account whose data is proposed to change, and (optionally) the event
  -- the field lives on. event_id is NULL for user-level fields (name/email/
  -- phone on public.users); set for event-level fields (date/venue on
  -- public.events).
  target_user_id  UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  event_id        UUID REFERENCES public.events(event_id) ON DELETE CASCADE,

  -- WHICH field. target_table + field_key are the machine keys the apply step
  -- validates against a hard allowlist in code (never a free-form column write).
  -- field_label is the human-readable label shown to the couple ("Your name",
  -- "Wedding date", …).
  target_table    TEXT NOT NULL CHECK (target_table IN ('users', 'events')),
  field_key       TEXT NOT NULL,
  field_label     TEXT NOT NULL,

  -- The values, as plain text for display + apply. current_value is a snapshot
  -- captured at proposal time (advisory only — the apply step re-reads the live
  -- value so a concurrent edit isn't silently clobbered).
  current_value   TEXT,
  proposed_value  TEXT NOT NULL,

  requested_by    UUID REFERENCES public.users(user_id) ON DELETE SET NULL,

  -- Lifecycle. 'pending' until the user acts; 'approved' is a brief in-between
  -- the apply step flips to 'applied' on success; 'declined' / 'cancelled' are
  -- terminal. The user moves pending→approved/declined; the admin may
  -- pending→cancelled (withdraw a proposal).
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined', 'applied', 'cancelled')),

  -- A short, audit-grade note from the admin explaining the proposed fix.
  reason          TEXT,

  consent_at      TIMESTAMPTZ,           -- set when the user approves
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ            -- set on applied/declined/cancelled
);

-- Fast "what's pending for this user" lookup (the couple's own surface +
-- the admin queue both filter by user + status).
CREATE INDEX IF NOT EXISTS idx_account_fix_requests_target_user
  ON public.account_fix_requests (target_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_fix_requests_event
  ON public.account_fix_requests (event_id)
  WHERE event_id IS NOT NULL;

ALTER TABLE public.account_fix_requests ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Admin: full read (the proposal queue) + insert (propose). Admins never
-- approve on the user's behalf, so no admin UPDATE policy beyond what's needed
-- to withdraw (cancel) a pending proposal — handled by the combined UPDATE
-- policy below which admits is_admin() too. Mirrors the is_admin() pattern used
-- across the admin tables.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS account_fix_requests_admin_read ON public.account_fix_requests;
CREATE POLICY account_fix_requests_admin_read
  ON public.account_fix_requests
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS account_fix_requests_admin_insert ON public.account_fix_requests;
CREATE POLICY account_fix_requests_admin_insert
  ON public.account_fix_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- Target user: read their OWN proposals. Matched by direct ownership
-- (target_user_id = auth.uid()) OR couple-membership of the event the proposal
-- is scoped to. The OR keeps both partners of a couple able to see + act on an
-- event-scoped fix even if the admin happened to address it to one partner's
-- user_id.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS account_fix_requests_target_read ON public.account_fix_requests;
CREATE POLICY account_fix_requests_target_read
  ON public.account_fix_requests
  FOR SELECT
  TO authenticated
  USING (
    target_user_id = auth.uid()
    OR (event_id IS NOT NULL AND event_id IN (SELECT public.current_couple_event_ids()))
  );

-- ---------------------------------------------------------------------------
-- Target user (or admin, to withdraw): UPDATE. The USING clause gates WHICH
-- rows are visible-for-update; the WITH CHECK clause gates the row's shape
-- AFTER the update. We constrain the user to acting only on still-pending rows
-- and only into the user-reachable terminal states (approved/declined/applied).
-- Admins are admitted so requestAccountFix() can cancel (withdraw) a pending
-- proposal. The transition rules themselves (you can't decline an applied row,
-- etc.) are enforced in the server actions; this policy is the row-level fence.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS account_fix_requests_target_update ON public.account_fix_requests;
CREATE POLICY account_fix_requests_target_update
  ON public.account_fix_requests
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR target_user_id = auth.uid()
    OR (event_id IS NOT NULL AND event_id IN (SELECT public.current_couple_event_ids()))
  )
  WITH CHECK (
    public.is_admin()
    OR target_user_id = auth.uid()
    OR (event_id IS NOT NULL AND event_id IN (SELECT public.current_couple_event_ids()))
  );

-- ============================================================================
-- 20260627000000_iteration_0006_max_soft_holds_and_release_history.sql
--
-- PR A of the 3-PR lock/delete/overlap pilot-critical batch (CLAUDE.md
-- decision-log row "Canonical wizard sequence reconciled 38 → 45 + Lock/
-- delete/overlap architecture", 2026-05-24). This migration lands the
-- substrate for Rule 3 (Pre-downpayment overlap default — vendor-configurable
-- hold limit per date) and Rule 2 (Vendor-side release pre-downpayment, audit
-- table only — the action handler itself ships in PR C).
--
-- WHY this lands as the substrate first, ahead of any handler code:
--   1. The finalizeVendor server action (in PR A's code half) needs to read
--      vendor_profiles.max_soft_holds_per_date BEFORE writing the lock —
--      without the column there, the action can't gate. Push BEFORE merge
--      per [[feedback_setnayan_push_migrations_myself]] so the code on main
--      finds the column on first deploy. If we shipped code first, the
--      column-not-found error would crash the wizard's Lock CTA in prod
--      across every host using the Compare drawer.
--   2. vendor_release_history needs to exist before PR C wires the vendor
--      Release CTA (Rule 2). The table is read-only in PR A (no INSERT
--      from app code yet) and stays empty until PR C ships — but having
--      the table + RLS + index already there means PR C can be pure code,
--      no schema migration alongside.
--
-- Idempotent: ALTER TABLE ... ADD COLUMN IF NOT EXISTS + CREATE TABLE IF NOT
-- EXISTS + CREATE INDEX IF NOT EXISTS — safe to re-run, no destructive ops.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_profiles.max_soft_holds_per_date (Rule 3 substrate)
--
-- Drives how many concurrent 'contracted'-status picks can land on a single
-- vendor for the same event date. Per owner directive 2026-05-24:
--
--   "vendor can also delete the customer if they need to open the schedule.
--    for vendors, if there is no locked schedule yet via downpayment. they
--    can still accept inquiries for that schedule. and it will be their
--    call if they will accept the request for overlap on schedule?"
--
-- Owner-picked answer (Q2 of the 5-question lock): "Vendor sets a hold
-- limit — e.g., max 3 per date." This column is that limit. Defaults to 3
-- — middle ground between solo operators who only want 1 (so they can
-- pre-cancel anyone over their bandwidth) and busy studios who might
-- legitimately juggle 5+ for the same wedding date.
--
-- CHECK (BETWEEN 1 AND 20):
--   - Lower bound 1 — even the most cautious solo operator should allow ONE
--     soft hold at a time (zero means they can never be locked at all,
--     which breaks the platform's basic purpose).
--   - Upper bound 20 — sanity ceiling. If a vendor is genuinely juggling
--     20+ simultaneous soft holds for the same date, they probably want
--     a different model (V1.x per-date override, or a multi-team account
--     where each team member has their own soft-hold pool). 20 is high
--     enough that no honest vendor hits it, low enough to catch typos
--     (host fat-fingers 200 into the settings input).
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS max_soft_holds_per_date INT NOT NULL DEFAULT 3
    CHECK (max_soft_holds_per_date BETWEEN 1 AND 20);

COMMENT ON COLUMN public.vendor_profiles.max_soft_holds_per_date IS
  'How many concurrent contracted-status picks this vendor allows on the '
  'same event date before further locks are blocked with soft_hold_limit_'
  'reached. Default 3. Vendor adjusts in /vendor-dashboard/settings/'
  'availability (UI ships V1.x per CLAUDE.md 2026-05-24 row Lock/delete/'
  'overlap architecture Rule 3). Range 1-20 enforced by CHECK.';

-- ----------------------------------------------------------------------------
-- 2. vendor_release_history (Rule 2 substrate)
--
-- Audit table for when a vendor releases a booking pre-downpayment, OR when
-- the system auto-releases a soft hold because the vendor's downpayment-
-- confirmed slot displaced it (Rule 4 — auto_released_on_downpayment), OR
-- when an admin force-releases a booking (admin_force_release). The release
-- itself hard-deletes the event_vendors row — this table is the durable
-- audit trail.
--
-- Why a snapshot column (event_vendor_id_snapshot) instead of FK:
--   event_vendors.vendor_id rows hard-delete on release. An FK would either
--   block the delete (ON DELETE RESTRICT — defeats the purpose) or cascade
--   the audit row away (ON DELETE CASCADE — defeats the durability). A
--   snapshot column preserves the original event_vendor_id even after the
--   row vanishes — admins reviewing the release-history can still trace
--   the lineage. Same pattern as comp_grants in iteration 0023 spec.
--
-- event_id_snapshot is also a non-FK snapshot for the same reason —
-- iteration 0021 spec Q1 from CLAUDE.md 2026-05-20 row "Event self-delete
-- unblocked" allows events with 0 confirmed vendors to be hard-deleted,
-- so the FK constraint would also conflict. Snapshot stays accurate even
-- after the event is gone.
--
-- vendor_profile_id IS a real FK because vendor_profiles rows shouldn't
-- be deleted while audit history exists (vendor accounts soft-delete via
-- vendor_profiles.is_published flip, not hard-delete). vendor_user_id and
-- host_user_id ON DELETE SET NULL because auth.users CAN hard-delete
-- (account closure) and we'd rather preserve the audit row than lose it.
--
-- RLS: vendor reads their own (vendor_user_id = auth.uid()), admin reads
-- everything (is_admin()), host reads their own event's rows (event_id_
-- snapshot via current_event_ids() helper from iteration 0048). The host
-- read access is for audit transparency — "{Vendor} released our booking,
-- here's when and why" — not for any disputatory action.
--
-- No INSERT/UPDATE/DELETE policies — only the server actions in PR C +
-- the Rule 4 auto-release trigger in PR D should write. Service-role
-- keys bypass RLS so the server actions work as-is.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_release_history (
  release_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_vendor_id_snapshot  UUID NOT NULL,
  vendor_profile_id         UUID NOT NULL
                            REFERENCES public.vendor_profiles(vendor_profile_id)
                            ON DELETE RESTRICT,
  vendor_user_id            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  host_user_id              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_id_snapshot         UUID NOT NULL,
  release_reason            TEXT NOT NULL
                            CHECK (release_reason IN (
                              'vendor_self_release',
                              'auto_released_on_downpayment',
                              'admin_force_release'
                            )),
  vendor_notes              TEXT,
  released_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.vendor_release_history IS
  'Durable audit trail for vendor-side and system-side releases of '
  'pre-downpayment soft holds. Per CLAUDE.md 2026-05-24 row Lock/delete/'
  'overlap architecture Rule 2 (vendor self-release) and Rule 4 (auto-'
  'release on downpayment). Hard-delete of the event_vendors row is the '
  'real release — this table preserves who/when/why for V1.x admin pattern '
  'analysis (10+ releases per vendor per 90 days flags admin review for '
  'ghosting pattern). Write paths land in PR C + PR D; PR A only creates '
  'the substrate.';

CREATE INDEX IF NOT EXISTS vendor_release_history_vendor_recent_idx
  ON public.vendor_release_history(vendor_profile_id, released_at DESC);

COMMENT ON INDEX public.vendor_release_history_vendor_recent_idx IS
  'Powers V1.x admin pattern queries like "vendors with >10 releases in '
  'the last 90 days" for the ghosting-pattern monitor. Index leads with '
  'vendor_profile_id because the query always filters by vendor first.';

CREATE INDEX IF NOT EXISTS vendor_release_history_event_idx
  ON public.vendor_release_history(event_id_snapshot);

COMMENT ON INDEX public.vendor_release_history_event_idx IS
  'Powers the host audit-transparency read — "what bookings on my event '
  'were released by vendors". Less hot than the vendor-recent index but '
  'still wanted for host-side surfaces in PR C.';

ALTER TABLE public.vendor_release_history ENABLE ROW LEVEL SECURITY;

-- Vendor reads their own releases (released-this-vendor, not released-
-- BY-this-vendor — same row regardless of who initiated). vendor_user_id
-- can be NULL when the auth.users row has been deleted; in that case
-- the row remains visible only to admin + host.
DROP POLICY IF EXISTS vendor_release_history_vendor_read
  ON public.vendor_release_history;
CREATE POLICY vendor_release_history_vendor_read
  ON public.vendor_release_history FOR SELECT
  TO authenticated
  USING (vendor_user_id = auth.uid());

-- Admin reads everything (is_admin() helper canonical per CLAUDE.md
-- 2026-05-12 row "Owner / Internal Accounts").
DROP POLICY IF EXISTS vendor_release_history_admin_read
  ON public.vendor_release_history;
CREATE POLICY vendor_release_history_admin_read
  ON public.vendor_release_history FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Host reads their own event's release rows (iteration 0048 multi-host
-- aware via current_event_ids() — couple member, parent moderator, etc.
-- all see the audit for events they're on). Snapshot column means the
-- read works even after the event itself is deleted, though current_
-- event_ids() will return only currently-live events so deleted-event
-- audit rows become admin-only after delete (acceptable — host who
-- deleted their event can't audit anyway).
DROP POLICY IF EXISTS vendor_release_history_host_read
  ON public.vendor_release_history;
CREATE POLICY vendor_release_history_host_read
  ON public.vendor_release_history FOR SELECT
  TO authenticated
  USING (event_id_snapshot IN (SELECT public.current_event_ids()));

-- No INSERT/UPDATE/DELETE policies in PR A — by design. PR C ships the
-- vendor-side Release server action and lands the INSERT policy
-- alongside it (the action will need a policy that lets the releasing
-- vendor's own session write the row). Rule 4 auto-release (PR D) runs
-- as a service-role trigger so RLS doesn't gate it. Until PR C lands,
-- the table is read-only at the RLS layer for app-side sessions.

COMMIT;

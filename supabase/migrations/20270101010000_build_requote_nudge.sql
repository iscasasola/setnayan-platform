-- ============================================================================
-- 20270101010000_build_requote_nudge.sql
-- Build 3d-C — the VENDOR RE-QUOTE NUDGE (Build_3State_Solver_2026-06-16.md §7).
--
-- When the 3-state Build's Auto resolution turns a QUOTED vendor away on BUDGET
-- (but the vendor still passes the date + location gate), Setnayan posts a
-- system message in that vendor's chat thread inviting a fresh proposition. Two
-- additive pieces:
--
--   1. chat_sender_role gains a 'system' value, so the nudge renders as a
--      Setnayan/automated message — NOT "from the couple" (and NOT 'vendor', so
--      it never trips the name-reveal trigger that fires on a vendor's first
--      reply). The enum was 'couple' | 'vendor' | 'coordinator'
--      (20260513130000_iteration_0019_communications.sql:43).
--
--   2. build_requote_nudges — the throttle ledger: ONE row per
--      (event_id, vendor_profile_id, plan_group_id) we've nudged. A row present
--      = a PENDING nudge that opts that (event, vendor, service) out of a repeat
--      until the vendor REPLIES in-thread (a chat_messages row with
--      sender_role='vendor' created after sent_at re-opens it — evaluated in the
--      action, not here).
--
-- ── FLAG-DARK + ADDITIVE ─────────────────────────────────────────────────────
-- Nothing writes either piece unless BUILD_3STATE_ENABLED is on AND the couple
-- runs the 3-state [Build]; with the flag OFF (default) the nudge code path is
-- unreachable, so applying this migration is a no-op for live behavior. The
-- enum value is added but never USED in this file (ALTER TYPE … ADD VALUE
-- cannot be referenced in the same transaction), mirroring
-- 20260907000000_notification_types_cross_actor_signals.sql.
-- ============================================================================

-- 1. 'system' sender role — for automated in-thread messages (the nudge).
ALTER TYPE public.chat_sender_role ADD VALUE IF NOT EXISTS 'system';

-- 2. The re-quote-nudge throttle ledger.
CREATE TABLE IF NOT EXISTS public.build_requote_nudges (
  nudge_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- The nudged vendor's marketplace profile (the chat thread's vendor key).
  vendor_profile_id UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- The taxonomy plan group (service) the budget miss was for. Not an FK —
  -- plan_group_id is an app-level slug (lib/wedding-plan-groups), same as
  -- event_category_build_state.plan_group_id.
  plan_group_id     TEXT NOT NULL,
  -- The thread the nudge was posted into (for the reply-gate lookup).
  thread_id         UUID NOT NULL REFERENCES public.chat_threads(thread_id) ON DELETE CASCADE,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- ONE pending nudge per (event, vendor, service). Re-arming after a vendor
  -- reply is an UPSERT that refreshes sent_at on this same row (the action
  -- only re-nudges once a vendor message post-dates sent_at), so the unique
  -- key never needs a second row per service.
  UNIQUE (event_id, vendor_profile_id, plan_group_id)
);

CREATE INDEX IF NOT EXISTS build_requote_nudges_event_idx
  ON public.build_requote_nudges(event_id);
CREATE INDEX IF NOT EXISTS build_requote_nudges_thread_idx
  ON public.build_requote_nudges(thread_id);

COMMENT ON TABLE public.build_requote_nudges IS
  'Throttle ledger for the Build 3d-C vendor re-quote nudge (Build_3State_Solver_2026-06-16.md §7). One row per (event, vendor_profile, plan_group) we''ve nudged; a present row opts that service out of a repeat nudge until the vendor REPLIES in-thread (a chat_messages sender_role=''vendor'' row newer than sent_at). Written only behind BUILD_3STATE_ENABLED from runBuild3State. Service-role only — the nudge is fired from the couple''s [Build] action via the admin client; couples + vendors never read/write this ledger directly.';

-- RLS: enabled with NO policies → denies all authenticated access. The nudge is
-- fired + read exclusively from the server via the service-role admin client
-- (bypasses RLS), exactly like other system-emitted artifacts. Neither the
-- couple nor the vendor has any reason to see this throttle ledger.
ALTER TABLE public.build_requote_nudges ENABLE ROW LEVEL SECURITY;

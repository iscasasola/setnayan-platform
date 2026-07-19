-- ============================================================================
-- 20270715600000_thread_calls.sql
--
-- THREAD CALLS — the live 1:1 voice/video CALL session record for an accepted
-- vendor↔couple chat thread (corpus: Relationship_Workspace_and_Appointments_
-- 2026-07-11.md · "Call"; PR 10 of Vendor_Customer_Master_Build_Plan_2026-07-11).
--
-- This is the RING/SESSION log for a REAL-TIME call ("I'm calling you right
-- now → Join"). It is DISTINCT from and complementary to `event_appointments`
-- (20270713200000), which records a *scheduled* meeting ("let's meet Thursday
-- at 3pm"). An appointment is the plan; a thread_call is the live session that
-- may (later) start FROM an appointment or ad-hoc from the open thread.
--
-- Media never touches a Setnayan server: the call transport is free P2P WebRTC
-- over an ephemeral Supabase Realtime broadcast channel, STUN-only, no TURN
-- (lib/call-webrtc.ts) — so this table stores ONLY call metadata (who/what/when),
-- never any audio/video. Zero per-call egress cost.
--
-- RLS AT CREATE TIME. The two thread parties may read/insert/update their
-- thread's calls — MIRRORS the chat_messages membership pattern exactly
-- (20260513130000_iteration_0019_communications.sql), since this table carries
-- the SAME three scoping columns (thread_id/event_id/vendor_profile_id):
--   • couple side  → event_id IN current_couple_event_ids()
--   • vendor side  → vendor_profile_id IN current_vendor_profile_ids()
--   • admin READ   → is_admin()  (matches the sibling event_appointments
--                    read policy; read-only, never write)
-- No invented helpers or patterns. Idempotent + re-run safe.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.thread_calls (
  call_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id          uuid NOT NULL REFERENCES public.chat_threads(thread_id) ON DELETE CASCADE,
  event_id           uuid REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id  uuid REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  kind               text NOT NULL CHECK (kind IN ('voice','video')),
  status             text NOT NULL DEFAULT 'ringing'
                     CHECK (status IN ('ringing','active','ended','missed','declined')),
  started_by_user_id uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  started_at         timestamptz NOT NULL DEFAULT now(),
  ended_at           timestamptz
);

CREATE INDEX IF NOT EXISTS thread_calls_thread_id_idx
  ON public.thread_calls (thread_id);

-- RLS AT CREATE TIME.
ALTER TABLE public.thread_calls ENABLE ROW LEVEL SECURITY;

-- Either party in the thread (or an admin) can READ the thread's calls.
DROP POLICY IF EXISTS thread_calls_member_read ON public.thread_calls;
CREATE POLICY thread_calls_member_read
  ON public.thread_calls FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR public.is_admin()
  );

-- Either party in the thread can START a call (INSERT a ringing row). Mirrors
-- the chat_messages member-insert gate.
DROP POLICY IF EXISTS thread_calls_member_insert ON public.thread_calls;
CREATE POLICY thread_calls_member_insert
  ON public.thread_calls FOR INSERT
  TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
  );

-- Either party can UPDATE a thread's call (hang up → status='ended', ended_at).
-- Same membership predicate on both USING (which rows) and WITH CHECK (the row
-- must stay in the same thread's scope after the update).
DROP POLICY IF EXISTS thread_calls_member_update ON public.thread_calls;
CREATE POLICY thread_calls_member_update
  ON public.thread_calls FOR UPDATE
  TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
  )
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    OR vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
  );

-- Live "incoming call" banner: opt thread_calls into the supabase_realtime
-- publication so the callee's open thread page sees the ringing INSERT (and the
-- ended UPDATE) in <500ms without a refresh. Realtime honors RLS, so a client
-- only receives events for calls on threads they can already SELECT. Idempotent
-- — mirrors 20260514140000_enable_realtime_chat.sql.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'thread_calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_calls;
  END IF;
END $$;

COMMENT ON TABLE public.thread_calls IS
  'Live 1:1 voice/video CALL session records for accepted vendor↔couple chat threads (Relationship Workspace + Appointments, PR 10). Ring/session metadata ONLY — media is free P2P WebRTC (STUN-only, no TURN; lib/call-webrtc.ts) and never touches a server. Distinct from event_appointments (scheduled meetings). RLS mirrors chat_messages: two thread parties read/insert/update (couple via current_couple_event_ids, vendor via current_vendor_profile_ids); admin read via is_admin.';

COMMIT;

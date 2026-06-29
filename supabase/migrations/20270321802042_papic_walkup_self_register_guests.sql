-- papic walkup self register guests
-- ============================================================================
-- Papic WALK-UP foundation (Papic_Walkup_Face_Identity_Plan_2026-06-29 §1, §5).
--
-- Today a Papic guest camera (app/papic/guest) requires a PRE-EXISTING roster
-- guest: the setnayan_guest_session cookie carries guest_id, and you only get
-- one by opening your personal invite. There is no walk-up path — scan the
-- EVENT QR, get a camera, shoot, with NO guest list and NO name.
--
-- This adds the create half of "self-register on scan" (the resume half is the
-- app-side cookie check in the join route — see the follow-up route PR):
--
--   1. guests.self_registered — marks a walk-up camera the guest created
--      themselves (vs a host-curated roster row), so the roster UI can filter
--      them out and stale-event cleanup can target them.
--
--   2. papic_walkup_register(p_master_qr_token) — SECURITY DEFINER, public
--      (anon|authenticated), the join route's only write path. Resolves the
--      event by its events.master_qr_token (the event-level QR added by
--      20260704000000), REQUIRES the event to own PAPIC_GUEST (reusing
--      papic_event_owns_service from 20260718000000 — so a leaked master token
--      can't mint guests on an event that never bought guest cameras), inserts
--      a lightweight nameless guest (first_name 'Guest', neutral side/category),
--      and returns { guest_id, event_id, qr_token } for the cookie.
--
-- WHY SECURITY DEFINER + grant to anon: the walk-up surface has no Supabase auth
-- session (the cookie is the identity), and guests RLS is couple-write only — a
-- direct INSERT under the anon role is correctly blocked. The function body runs
-- as owner; the master_qr_token + the PAPIC_GUEST gate are the access controls.
-- Mirrors papic_record_guest_capture (20260718000000).
--
-- NOTE (PR1 scope): create-only. Same-device re-entry is the cookie (handled in
-- the route); cross-device face re-entry + the first-5-free walk-up free tier
-- are later phases. A leaked master token can create guest rows on a Papic-owning
-- event (inherent to walk-up — anyone at the event can join); blast radius is
-- bounded to events that paid for Papic. Rate-limiting is a follow-up.
--
-- SAFETY: purely additive (one nullable-defaulted column + one function), fully
-- idempotent (ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE FUNCTION). No drops,
-- no behavior change for any event that doesn't own PAPIC_GUEST.
-- ============================================================================

BEGIN;

-- 1. Mark walk-up (self-registered) cameras. Roster guests stay FALSE.
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS self_registered BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.guests.self_registered IS
  'TRUE = a Papic walk-up camera the guest self-created by scanning the event master QR (no roster entry, no name required). Lets the host roster UI filter them out and stale-event cleanup target them. FALSE = a host-curated roster guest.';

-- Cheap partial index for "this event's walk-up cameras" (roster filter + cleanup).
CREATE INDEX IF NOT EXISTS guests_self_registered_idx
  ON public.guests(event_id)
  WHERE self_registered AND deleted_at IS NULL;

-- 2. Walk-up registration RPC — the join route's only write path.
CREATE OR REPLACE FUNCTION public.papic_walkup_register(
  p_master_qr_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_owns     BOOLEAN;
  v_guest    RECORD;
BEGIN
  IF p_master_qr_token IS NULL OR length(p_master_qr_token) < 16 THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  SELECT event_id INTO v_event_id
  FROM public.events
  WHERE master_qr_token = p_master_qr_token
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  v_owns := public.papic_event_owns_service(v_event_id, 'PAPIC_GUEST');
  IF NOT v_owns THEN
    RETURN jsonb_build_object('status', 'not_owned');
  END IF;

  INSERT INTO public.guests (
    event_id, first_name, last_name, display_name,
    side, group_category, role, self_registered
  )
  VALUES (
    v_event_id, 'Guest', '', 'Guest',
    'both', 'other', 'guest', TRUE
  )
  RETURNING guest_id, event_id, qr_token INTO v_guest;

  RETURN jsonb_build_object(
    'status', 'ok',
    'guest_id', v_guest.guest_id,
    'event_id', v_guest.event_id,
    'qr_token', v_guest.qr_token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.papic_walkup_register(TEXT) TO authenticated, anon;

COMMIT;

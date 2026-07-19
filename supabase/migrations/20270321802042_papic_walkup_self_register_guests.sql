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
-- app-side cookie check in the join route):
--
--   1. events.papic_walkup_token — a DEDICATED, guest-facing secret rendered as
--      the walk-up QR. Deliberately SEPARATE from events.master_qr_token: that
--      one is a privileged CREW credential (crew devices pair against it, 5-cap;
--      rotating it revokes crew). Walk-up is shown to EVERY guest, so it gets
--      its own token + rotation clock — rotating the crew QR must never break
--      guest cameras, and printing the guest QR must never leak crew access.
--
--   2. guests.self_registered — marks a walk-up camera the guest created
--      themselves (vs a host-curated roster row), so the roster UI can filter
--      them out and stale-event cleanup can target them.
--
--   3. papic_walkup_register(p_walkup_token) — SECURITY DEFINER, public
--      (anon|authenticated), the join route's only write path. Resolves the
--      event by papic_walkup_token, REQUIRES guest cameras to be active —
--      PAPIC_GUEST OR the PAPIC_UNLOCK umbrella bundle, mirroring the app-side
--      eventPapicGuestActive / eventSkuActive('PAPIC_GUEST') so walk-up is
--      available exactly when the capture surface (/papic/guest) is — then
--      inserts a lightweight nameless guest (first_name 'Guest', neutral
--      side/category) and returns { guest_id, event_id, qr_token }. The
--      authoritative gate is the app-side route; this is the DB backstop.
--
-- WHY SECURITY DEFINER + grant to anon: the walk-up surface has no Supabase auth
-- session (the cookie is the identity), and guests RLS is couple-write only — a
-- direct INSERT under the anon role is correctly blocked. The function body runs
-- as owner; the walk-up token + the PAPIC_GUEST gate are the access controls.
-- Mirrors papic_record_guest_capture (20260718000000).
--
-- NOTE (PR1 scope): create-only. Same-device re-entry is the cookie (handled in
-- the route); cross-device face re-entry + the first-5-free walk-up free tier
-- are later phases. A leaked walk-up token can create guest rows on a Papic-
-- owning event (inherent to walk-up — anyone at the event can join); blast radius
-- is bounded to events that paid for Papic, and the token rotates independently.
--
-- SAFETY: purely additive (two nullable-defaulted columns + one function), fully
-- idempotent (ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE FUNCTION). No drops,
-- no behavior change for any event that doesn't own PAPIC_GUEST.
-- ============================================================================

BEGIN;

-- 1. Dedicated guest-facing walk-up token (separate from the crew master QR).
--    pgcrypto schema-qualified per 20260513030000 so DEFINER fns resolve it.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS papic_walkup_token TEXT NOT NULL
    DEFAULT encode(extensions.gen_random_bytes(16), 'hex');

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS papic_walkup_token_rotated_at TIMESTAMPTZ NOT NULL
    DEFAULT NOW();

COMMENT ON COLUMN public.events.papic_walkup_token IS
  'Dedicated secret rendered as the Papic walk-up QR (/papic/join/<token>). Shown to EVERY guest, so it is SEPARATE from the crew-only master_qr_token — rotating the crew QR must not break guest cameras, and the guest QR must not leak crew-device pairing access.';

CREATE INDEX IF NOT EXISTS events_papic_walkup_token_idx
  ON public.events(papic_walkup_token);

-- 2. Mark walk-up (self-registered) cameras. Roster guests stay FALSE.
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS self_registered BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.guests.self_registered IS
  'TRUE = a Papic walk-up camera the guest self-created by scanning the event walk-up QR (no roster entry, no name required). Lets the host roster UI filter them out and stale-event cleanup target them. FALSE = a host-curated roster guest.';

CREATE INDEX IF NOT EXISTS guests_self_registered_idx
  ON public.guests(event_id)
  WHERE self_registered AND deleted_at IS NULL;

-- 3. Walk-up registration RPC — the join route's only write path.
CREATE OR REPLACE FUNCTION public.papic_walkup_register(
  p_walkup_token TEXT
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
  IF p_walkup_token IS NULL OR length(p_walkup_token) < 16 THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  SELECT event_id INTO v_event_id
  FROM public.events
  WHERE papic_walkup_token = p_walkup_token
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  -- Mirror eventPapicGuestActive / eventSkuActive('PAPIC_GUEST'): a literal
  -- PAPIC_GUEST order OR the PAPIC_UNLOCK umbrella bundle (which grants
  -- PAPIC_GUEST per BUNDLE_CHILD_SKUS — SKU_OWNERSHIP_ALIASES is empty, so there
  -- are no other alias keys). The AUTHORITATIVE, bundle-aware gate is the
  -- app-side join route (eventPapicGuestActive); this is the DB backstop for
  -- direct RPC calls. Keep the two in sync.
  v_owns := public.papic_event_owns_service(v_event_id, 'PAPIC_GUEST')
         OR public.papic_event_owns_service(v_event_id, 'PAPIC_UNLOCK');
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

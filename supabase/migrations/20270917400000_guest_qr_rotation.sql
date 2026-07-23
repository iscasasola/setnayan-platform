-- Guest QR token rotation — audit + durable rate limit + actor typing
-- (On-the-Day build ④ · studies doc § 4 · council verdict § 5.11 · owner-signed
-- 2026-07-23: rotation authority = guests self-service + host/coordinator).
--
-- WHAT THIS ADDS (all INERT until app code calls it):
--   1. guests.qr_token_rotated_at / qr_rotation_count — mirrors the
--      events.master_qr_token_rotated_at precedent so the dashboard can show a
--      "rotated N min ago" hint (the check-in desk day-of case).
--   2. guest_qr_rotations — append-only audit of every rotation. The couple's
--      direct writes are deliberately NOT covered by log_delegate_write
--      (20261129003000:129-131), so rotation gets its own audit row here.
--      old_token_sha256 stores a SHA-256 of the retired token, never the raw
--      value (forensics without re-leak).
--   3. rotate_guest_qr_token() — SECURITY DEFINER RPC around the existing
--      mint (encode(gen_random_bytes(16),'hex') — SAME 32-hex space as the
--      column default; the /papic/join guest-vs-crew disambiguation relies on
--      disjoint UNIQUE token spaces, so the mint shape must not change).
--      Derives the actor kind server-side (admin/couple/coordinator from
--      auth.uid(); guest_self only via service_role after the app validated
--      the signed guest-session cookie) and enforces a DURABLE 3-per-guest-
--      per-24h rate limit (lib/rate-limit.ts is per-instance; this is the
--      real ceiling).
--
-- Invalidation semantics: IMMEDIATE — no grace window, no qr_token_previous.
-- Every resolver queries by the current token, so the old QR dies atomically
-- at the UPDATE; recovery is reprint/reshare, not undo.

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS qr_token_rotated_at timestamptz,
  ADD COLUMN IF NOT EXISTS qr_rotation_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.guest_qr_rotations (
  rotation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (event_id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES public.guests (guest_id) ON DELETE CASCADE,
  actor_kind text NOT NULL CHECK (actor_kind IN ('couple', 'coordinator', 'guest_self', 'admin')),
  actor_user_id uuid,
  reason text,
  -- SHA-256 hex of the RETIRED token. Never the raw token: the audit trail
  -- must not itself become a token leak (RA 10173 / council § 5.11).
  old_token_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The durable rate-limit lookup (guest_id + 24h window) and the per-event
-- audit listing both ride this index.
CREATE INDEX IF NOT EXISTS guest_qr_rotations_guest_created_idx
  ON public.guest_qr_rotations (guest_id, created_at DESC);
CREATE INDEX IF NOT EXISTS guest_qr_rotations_event_idx
  ON public.guest_qr_rotations (event_id);

-- RLS at CREATE TABLE time (canonical rule). Hosts + admins can read their
-- event's audit rows; NO INSERT/UPDATE/DELETE policy exists, so the ONLY
-- write path is the SECURITY DEFINER RPC below (definer bypasses RLS).
ALTER TABLE public.guest_qr_rotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guest_qr_rotations_host_read ON public.guest_qr_rotations;
CREATE POLICY guest_qr_rotations_host_read ON public.guest_qr_rotations
  FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_event_ids())
    OR public.is_admin()
  );

CREATE OR REPLACE FUNCTION public.rotate_guest_qr_token(
  p_guest_id uuid,
  p_actor_kind text DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest RECORD;
  v_uid uuid := auth.uid();
  v_kind text;
  v_recent integer;
  v_new_token text;
  v_now timestamptz := now();
BEGIN
  -- (1) Lock the guest row so concurrent rotations serialize.
  SELECT guest_id, event_id, qr_token
    INTO v_guest
    FROM public.guests
   WHERE guest_id = p_guest_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- (2) Authorization. The actor kind is DERIVED server-side for signed-in
  -- callers (the claimed p_actor_kind is ignored — a coordinator cannot label
  -- themselves 'couple' in the audit). guest_self is accepted ONLY from the
  -- service_role (the app's server action validates the signed guest-session
  -- cookie BEFORE calling with the admin client; anon has no EXECUTE grant).
  IF v_uid IS NOT NULL THEN
    IF public.is_admin() THEN
      v_kind := 'admin';
    ELSIF EXISTS (
      SELECT 1 FROM public.event_members
       WHERE event_id = v_guest.event_id
         AND user_id = v_uid
         AND member_type = 'couple'
    ) THEN
      v_kind := 'couple';
    ELSIF public.moderator_area_level(v_guest.event_id, 'guest_list') = 'edit' THEN
      v_kind := 'coordinator';
    ELSE
      RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
    END IF;
  ELSE
    IF auth.role() <> 'service_role' OR p_actor_kind IS DISTINCT FROM 'guest_self' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
    END IF;
    v_kind := 'guest_self';
  END IF;

  -- (3) Durable rate limit: 3 rotations per guest per 24h, ALL actor kinds
  -- except admin (support escape hatch). This is the real cross-instance
  -- ceiling — the in-memory limiter in the app is only a backstop.
  IF v_kind <> 'admin' THEN
    SELECT count(*) INTO v_recent
      FROM public.guest_qr_rotations
     WHERE guest_id = p_guest_id
       AND created_at > v_now - interval '24 hours';
    IF v_recent >= 3 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
    END IF;
  END IF;

  -- (4) Audit BEFORE the update (same transaction — atomic either way).
  INSERT INTO public.guest_qr_rotations
    (event_id, guest_id, actor_kind, actor_user_id, reason, old_token_sha256)
  VALUES (
    v_guest.event_id,
    p_guest_id,
    v_kind,
    v_uid,
    NULLIF(btrim(COALESCE(p_reason, '')), ''),
    encode(extensions.digest(v_guest.qr_token, 'sha256'), 'hex')
  );

  -- (5) Mint the replacement — SAME shape as the column default (32 lowercase
  -- hex · 16 bytes). Old token dies here, atomically.
  v_new_token := encode(extensions.gen_random_bytes(16), 'hex');

  UPDATE public.guests
     SET qr_token = v_new_token,
         qr_token_rotated_at = v_now,
         qr_rotation_count = qr_rotation_count + 1,
         updated_at = v_now
   WHERE guest_id = p_guest_id;

  RETURN jsonb_build_object(
    'ok', true,
    'qr_token', v_new_token,
    'rotated_at', v_now,
    'actor_kind', v_kind
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_guest_qr_token(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotate_guest_qr_token(uuid, text, text) TO authenticated, service_role;

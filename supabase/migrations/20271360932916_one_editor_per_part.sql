-- ============================================================================
-- 20271360932916_one_editor_per_part.sql
--
-- ✍️ ONE EDITOR PER PART (owner 2026-11-21, DECISION_LOG "DESKTOP SPLIT VIEW + ONE EDITOR PER PART — APPROVED TO
-- BUILD"; drawing `prototypes/desktop_split_view_2026-11-21/desktop_split_view_v2_fable.html`, frames 3–5).
--
--   · ONE editor per part of an event (Guests · Seats · March · Schedule · Hub · Event Details · Suppliers ·
--     Mood Board). Everybody else sees "<Name> is editing <Part>." and the part is read-only for them.
--   · The part FREES ITSELF 5 SECONDS after the editor stops: every edit touches `last_edit_at`; a row whose
--     `last_edit_at` is older than 5 s (SERVER clock, never a client's) is free to the next person.
--   · A HOST CAN ALWAYS TAKE OVER. The bumped person is remembered on the row (`bumped_user_id`, `taken_by_label`)
--     so their next touch / read answers `taken_over` with the host's name — "Claire took over Guests." Their unsaved
--     change is kept on their own screen (it never reached the server); Put it back reopens it as a draft.
--
-- Extends the shipped seating lock (20261216000000_seating_editor_locks.sql — same envelope, same FOR UPDATE idiom,
-- same "writes only through SECURITY DEFINER RPCs"). That lock stays the Seats editor's own (one editor, 90 s); this
-- table is the per-part lock every other part uses.
--
-- Who may hold a part: the event's couple (hosts), or an accepted helper / booked coordinator whose seat resolves the
-- part's area to 'edit' (`moderator_area_level`, the one resolver). Admins observe. Event Details and March have no
-- area of their own; both ride 'schedule' (The Day: date, place, who walks) — a controller call, said in the PR.
--
-- Idempotent: IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS. Applied only by the pipeline.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. event_part_editor_locks — one row per (event, part). holder NULL = free.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_part_editor_locks (
  lock_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  part            TEXT NOT NULL CHECK (part IN ('guests', 'seats', 'march', 'schedule', 'hub', 'event_details', 'suppliers', 'mood_board')),
  holder_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  holder_label    TEXT NOT NULL DEFAULT '' CHECK (length(holder_label) <= 120),
  holder_is_host  BOOLEAN NOT NULL DEFAULT FALSE,
  last_edit_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The person a host bumped, and the host's name — said to them once ("Claire took over Guests.").
  bumped_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  taken_by_label  TEXT CHECK (taken_by_label IS NULL OR length(taken_by_label) <= 120),
  bumped_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, part)
);

ALTER TABLE public.event_part_editor_locks ENABLE ROW LEVEL SECURITY;

-- READ: admins, the event's couple, and the event's accepted helpers / coordinator (any level) see who is editing.
-- No write policy on purpose: every write goes through the SECURITY DEFINER RPCs below.
DROP POLICY IF EXISTS event_part_editor_locks_read ON public.event_part_editor_locks;
CREATE POLICY event_part_editor_locks_read
  ON public.event_part_editor_locks FOR SELECT
  TO authenticated
  USING (
    (SELECT public.is_admin())
    OR event_id IN (SELECT public.current_couple_event_ids())
    OR event_id IN (SELECT public.current_moderator_event_ids())
  );

COMMENT ON TABLE public.event_part_editor_locks IS
  'One editor per part (owner 2026-11-21, DESKTOP SPLIT VIEW + ONE EDITOR PER PART). One row per (event, part); holder_user_id NULL or last_edit_at older than 5 s (server clock) = free. A host can always take over: the bumped person is kept in bumped_user_id / taken_by_label so they are told. Writes only via acquire/touch/release_part_editor_lock; read via RLS or part_editor_lock_state. Writer: those RPCs (lib/use-part-editor-lock.ts). Reader: part_editor_lock_state + the part edit gate.';

-- ----------------------------------------------------------------------------
-- 2. part_lock_area — the delegate area a part rides. Closed set; NULL = not a part.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.part_lock_area(p_part TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_part
    WHEN 'guests' THEN 'guest_list'
    WHEN 'seats' THEN 'seat_plan'
    WHEN 'march' THEN 'schedule'
    WHEN 'schedule' THEN 'schedule'
    WHEN 'event_details' THEN 'schedule'
    WHEN 'hub' THEN 'invitations'
    WHEN 'suppliers' THEN 'vendors'
    WHEN 'mood_board' THEN 'mood_board'
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.part_lock_area(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.part_lock_area(TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. acquire_part_editor_lock — claim the part (or refresh it, or — a host only — take it over).
--
--   { status:'acquired' | 'refreshed' | 'took_over', lock_id, holder_label, last_edit_at }
--   { status:'held_by_other', holder_label, holder_is_host, last_edit_at }
--   { status:'not_authorized' }
--
-- Free = nobody holds it, or the holder's last edit is older than 5 s (server clock).
-- p_take_over = TRUE takes a LIVE peer's pen only when the caller is a host; the peer is remembered as bumped.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.acquire_part_editor_lock(
  p_event_id  UUID,
  p_part      TEXT,
  p_label     TEXT DEFAULT '',
  p_take_over BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_area    TEXT := public.part_lock_area(p_part);
  v_is_host BOOLEAN;
  v_label   TEXT := left(COALESCE(NULLIF(trim(p_label), ''), 'Someone'), 120);
  v_lock    RECORD;
BEGIN
  IF v_uid IS NULL OR v_area IS NULL THEN
    RETURN jsonb_build_object('status', 'not_authorized');
  END IF;

  v_is_host := p_event_id IN (SELECT public.current_couple_event_ids());
  IF NOT v_is_host AND COALESCE(public.moderator_area_level(p_event_id, v_area), '') <> 'edit' THEN
    RETURN jsonb_build_object('status', 'not_authorized');
  END IF;

  -- The row exists from the first acquire on; serialize every decision on it.
  INSERT INTO public.event_part_editor_locks (event_id, part, holder_user_id, holder_label, holder_is_host, last_edit_at)
  VALUES (p_event_id, p_part, NULL, '', FALSE, NOW())
  ON CONFLICT (event_id, part) DO NOTHING;

  SELECT * INTO v_lock FROM public.event_part_editor_locks
   WHERE event_id = p_event_id AND part = p_part
     FOR UPDATE;

  -- Mine already → refresh.
  IF v_lock.holder_user_id = v_uid THEN
    UPDATE public.event_part_editor_locks
       SET last_edit_at = NOW(), holder_label = v_label, holder_is_host = v_is_host, updated_at = NOW()
     WHERE lock_id = v_lock.lock_id;
    RETURN jsonb_build_object('status', 'refreshed', 'lock_id', v_lock.lock_id, 'holder_label', v_label, 'last_edit_at', NOW());
  END IF;

  -- Free (nobody, or the holder stopped more than 5 s ago) → mine. A bumped person claiming again clears their notice.
  IF v_lock.holder_user_id IS NULL OR v_lock.last_edit_at < NOW() - INTERVAL '5 seconds' THEN
    UPDATE public.event_part_editor_locks
       SET holder_user_id = v_uid, holder_label = v_label, holder_is_host = v_is_host, last_edit_at = NOW(),
           bumped_user_id = CASE WHEN bumped_user_id = v_uid THEN NULL ELSE bumped_user_id END,
           taken_by_label = CASE WHEN bumped_user_id = v_uid THEN NULL ELSE taken_by_label END,
           bumped_at = CASE WHEN bumped_user_id = v_uid THEN NULL ELSE bumped_at END,
           updated_at = NOW()
     WHERE lock_id = v_lock.lock_id;
    RETURN jsonb_build_object('status', 'acquired', 'lock_id', v_lock.lock_id, 'holder_label', v_label, 'last_edit_at', NOW());
  END IF;

  -- A live peer holds it. A host may always take over; the peer is told.
  IF p_take_over AND v_is_host THEN
    UPDATE public.event_part_editor_locks
       SET bumped_user_id = v_lock.holder_user_id, taken_by_label = v_label, bumped_at = NOW(),
           holder_user_id = v_uid, holder_label = v_label, holder_is_host = TRUE, last_edit_at = NOW(), updated_at = NOW()
     WHERE lock_id = v_lock.lock_id;
    RETURN jsonb_build_object('status', 'took_over', 'lock_id', v_lock.lock_id, 'holder_label', v_label, 'last_edit_at', NOW());
  END IF;

  RETURN jsonb_build_object(
    'status', 'held_by_other',
    'holder_label', v_lock.holder_label,
    'holder_is_host', v_lock.holder_is_host,
    'last_edit_at', v_lock.last_edit_at);
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_part_editor_lock(UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acquire_part_editor_lock(UUID, TEXT, TEXT, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION public.acquire_part_editor_lock(UUID, TEXT, TEXT, BOOLEAN) IS
  'Claim / refresh one part of an event for editing (one editor per part, owner 2026-11-21). Free = no holder or the holder''s last edit older than 5 s (server clock). p_take_over lets a HOST take a live peer''s pen; the peer is kept as bumped so they are told. Hosts and edit-level helpers only (moderator_area_level of part_lock_area).';

-- ----------------------------------------------------------------------------
-- 4. touch_part_editor_lock — every edit by the holder. Keeps the 5 s window open.
--   { status:'ok', last_edit_at }                       still mine (refreshed even after a pause, if nobody claimed it)
--   { status:'taken_over', taken_by_label }             a host took it from me
--   { status:'lost' }                                   somebody else claimed it after I stopped
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_part_editor_lock(p_lock_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_lock RECORD;
BEGIN
  IF v_uid IS NULL OR p_lock_id IS NULL THEN
    RETURN jsonb_build_object('status', 'lost');
  END IF;
  SELECT * INTO v_lock FROM public.event_part_editor_locks WHERE lock_id = p_lock_id FOR UPDATE;
  IF v_lock.lock_id IS NULL THEN
    RETURN jsonb_build_object('status', 'lost');
  END IF;
  IF v_lock.holder_user_id = v_uid THEN
    UPDATE public.event_part_editor_locks SET last_edit_at = NOW(), updated_at = NOW() WHERE lock_id = p_lock_id;
    RETURN jsonb_build_object('status', 'ok', 'last_edit_at', NOW());
  END IF;
  IF v_lock.bumped_user_id = v_uid THEN
    RETURN jsonb_build_object('status', 'taken_over', 'taken_by_label', v_lock.taken_by_label);
  END IF;
  RETURN jsonb_build_object('status', 'lost');
END;
$$;

REVOKE ALL ON FUNCTION public.touch_part_editor_lock(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_part_editor_lock(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. release_part_editor_lock — the editor left (unmount / pagehide). Idempotent; never frees a peer's pen.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_part_editor_lock(p_lock_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_rows INT;
BEGIN
  IF v_uid IS NULL OR p_lock_id IS NULL THEN
    RETURN jsonb_build_object('status', 'ok', 'released', 0);
  END IF;
  UPDATE public.event_part_editor_locks
     SET holder_user_id = NULL, holder_label = '', holder_is_host = FALSE, updated_at = NOW()
   WHERE lock_id = p_lock_id AND holder_user_id = v_uid;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('status', 'ok', 'released', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.release_part_editor_lock(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_part_editor_lock(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. part_editor_lock_state — what a person looking at the part is told (the quiet bar, the "is free" moment, the
--    take-over notice). Same gate as the read policy; anyone else is told 'not_authorized', never "free".
--   { status:'free' | 'mine' | 'held', holder_label, holder_is_host, can_edit, can_take_over, taken_by_label, bumped_at }
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.part_editor_lock_state(p_event_id UUID, p_part TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_area     TEXT := public.part_lock_area(p_part);
  v_is_host  BOOLEAN;
  v_can_edit BOOLEAN;
  v_lock     RECORD;
  v_status   TEXT;
BEGIN
  IF v_uid IS NULL OR v_area IS NULL THEN
    RETURN jsonb_build_object('status', 'not_authorized');
  END IF;
  v_is_host := p_event_id IN (SELECT public.current_couple_event_ids());
  IF NOT v_is_host AND p_event_id NOT IN (SELECT public.current_moderator_event_ids()) THEN
    RETURN jsonb_build_object('status', 'not_authorized');
  END IF;
  v_can_edit := v_is_host OR COALESCE(public.moderator_area_level(p_event_id, v_area), '') = 'edit';

  SELECT * INTO v_lock FROM public.event_part_editor_locks WHERE event_id = p_event_id AND part = p_part;

  IF v_lock.lock_id IS NULL OR v_lock.holder_user_id IS NULL OR v_lock.last_edit_at < NOW() - INTERVAL '5 seconds' THEN
    v_status := 'free';
  ELSIF v_lock.holder_user_id = v_uid THEN
    v_status := 'mine';
  ELSE
    v_status := 'held';
  END IF;

  RETURN jsonb_build_object(
    'status', v_status,
    'holder_label', CASE WHEN v_status = 'held' THEN v_lock.holder_label END,
    'holder_is_host', CASE WHEN v_status = 'held' THEN v_lock.holder_is_host END,
    'can_edit', v_can_edit,
    'can_take_over', v_is_host AND v_status = 'held',
    'taken_by_label', CASE WHEN v_lock.bumped_user_id = v_uid THEN v_lock.taken_by_label END,
    'bumped_at', CASE WHEN v_lock.bumped_user_id = v_uid THEN v_lock.bumped_at END);
END;
$$;

REVOKE ALL ON FUNCTION public.part_editor_lock_state(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.part_editor_lock_state(UUID, TEXT) TO authenticated;

COMMIT;

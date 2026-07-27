-- ═══════════════════════════════════════════════════════════════════════════
-- THE COORDINATOR ASKS — and the host approves, feature by feature.
-- Owner ruling 2026-07-27.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Owner, verbatim: "coordinator will ask for access from the host. host must
-- approve what features do they want to share the vendor." And, on how much
-- may be asked for: SPECIFIC FEATURES — the coordinator ticks what they need,
-- the host sees exactly that ask and approves or declines EACH LINE.
--
-- ── HALF OF THIS ALREADY SHIPPED. THIS TABLE IS ONLY THE ASK. ──────────────
-- `event_moderators.permissions_json.areas` + `moderator_area_level()`
-- (20261129003000) is already "the host approves which features to share":
-- seven areas, each edit/view/none, per person, revocable. Nothing here
-- replaces or duplicates that — an approval WRITES that existing structure and
-- every feature keeps reading it. What did not exist in EITHER direction was a
-- way for the coordinator to ask first; today only the host can initiate, via
-- the invite at /host/accept/[token]. That gap is this table, and nothing more.
--
-- ── THIS TABLE GRANTS NOTHING ──────────────────────────────────────────────
-- A row here is a REQUEST. It confers no access at any level: every gated
-- feature reads `moderator_area_level`, never this table. A request that is
-- never answered leaves the coordinator with exactly what they had before it —
-- nothing. That separation is deliberate, so a bug in the asking flow can
-- never become a bug in the granting one.

-- ── 1 · The table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event_access_requests (
  request_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Who they are as a supplier, so the host sees a business name and not a
  -- bare account. SET NULL rather than CASCADE: the request stays auditable
  -- even if the vendor profile is later removed.
  vendor_profile_id UUID REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE SET NULL,

  -- What they are asking for. Constrained to the SAME seven areas the host can
  -- already grant (lib/event-moderators.ts DELEGATE_AREAS) — a request for an
  -- area the host has no way to approve would be a dead end.
  requested_areas   TEXT[] NOT NULL
    CHECK (
      cardinality(requested_areas) BETWEEN 1 AND 7
      AND requested_areas <@ ARRAY[
        'guest_list', 'seat_plan', 'schedule', 'vendors',
        'invitations', 'mood_board', 'budget'
      ]::TEXT[]
    ),

  -- Why they need it, in their own words. Same 240 cap as the day-of stream.
  note              TEXT CHECK (note IS NULL OR char_length(btrim(note)) BETWEEN 1 AND 240),

  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'answered', 'withdrawn')),

  -- Per-area verdict: { "seat_plan": "granted", "schedule": "declined" }.
  -- A map, not a single verdict, because the owner's model is line-by-line —
  -- a host who shares the seat plan but not the budget must be recordable.
  decisions         JSONB NOT NULL DEFAULT '{}'::jsonb,

  decided_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One OPEN ask per person per event — a coordinator cannot pile up requests
-- and drown the host. Answered and withdrawn rows stay for the audit trail,
-- which is why this is PARTIAL rather than a plain UNIQUE.
CREATE UNIQUE INDEX IF NOT EXISTS event_access_requests_one_pending_idx
  ON public.event_access_requests (event_id, requester_user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS event_access_requests_event_idx
  ON public.event_access_requests (event_id, created_at DESC);

COMMENT ON TABLE public.event_access_requests IS
  'A coordinator ASKING the host for named features (owner ruling 2026-07-27). Grants nothing on its own — every gated feature reads moderator_area_level(), never this table. An approval writes event_moderators.permissions_json.areas, which is the mechanism that already shipped.';

COMMENT ON COLUMN public.event_access_requests.decisions IS
  'Per-area verdict map, e.g. {"seat_plan":"granted","budget":"declined"} — the host answers line by line, so a partial yes is a first-class outcome rather than a lost detail.';

-- ── 2 · updated_at ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_event_access_requests()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := NOW();
  IF NEW.status <> 'pending' AND OLD.status = 'pending' THEN
    NEW.decided_at := COALESCE(NEW.decided_at, NOW());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS event_access_requests_touch ON public.event_access_requests;
CREATE TRIGGER event_access_requests_touch
  BEFORE UPDATE ON public.event_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_event_access_requests();

-- ── 3 · Privileges — REVOKE first (every new relation ships OPEN here) ─────

REVOKE ALL ON public.event_access_requests FROM PUBLIC;
REVOKE ALL ON public.event_access_requests FROM anon;
REVOKE ALL ON public.event_access_requests FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON public.event_access_requests TO authenticated;

REVOKE ALL ON FUNCTION public.touch_event_access_requests()
  FROM PUBLIC, anon, authenticated;

-- ── 4 · RLS ────────────────────────────────────────────────────────────────

ALTER TABLE public.event_access_requests ENABLE ROW LEVEL SECURITY;

-- 4a · The asker sees their own asks. Nothing else — a supplier must not learn
--      who else has asked the couple for what.
DROP POLICY IF EXISTS event_access_requests_own_read ON public.event_access_requests;
CREATE POLICY event_access_requests_own_read
  ON public.event_access_requests FOR SELECT TO authenticated
  USING (requester_user_id = auth.uid());

-- 4b · Only a BOOKED vendor may ask, and only in their own name.
DROP POLICY IF EXISTS event_access_requests_own_insert ON public.event_access_requests;
CREATE POLICY event_access_requests_own_insert
  ON public.event_access_requests FOR INSERT TO authenticated
  WITH CHECK (
    requester_user_id = auth.uid()
    AND event_id IN (SELECT public.current_vendor_booked_event_ids())
  );

-- 4c · The asker may WITHDRAW their own pending ask. They cannot answer it:
--      `decisions` and `status='answered'` are the host's to write, and 4e is
--      the only policy that can produce them.
DROP POLICY IF EXISTS event_access_requests_own_withdraw ON public.event_access_requests;
CREATE POLICY event_access_requests_own_withdraw
  ON public.event_access_requests FOR UPDATE TO authenticated
  USING (requester_user_id = auth.uid() AND status = 'pending')
  WITH CHECK (requester_user_id = auth.uid() AND status = 'withdrawn');

-- 4d · The host sees every ask on their event.
DROP POLICY IF EXISTS event_access_requests_host_read ON public.event_access_requests;
CREATE POLICY event_access_requests_host_read
  ON public.event_access_requests FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()) OR public.is_admin());

-- 4e · The host answers. Deliberately NOT extended to delegate moderators:
--      handing out access is the host's own call, and a coordinator who could
--      approve requests could approve their own.
DROP POLICY IF EXISTS event_access_requests_host_answer ON public.event_access_requests;
CREATE POLICY event_access_requests_host_answer
  ON public.event_access_requests FOR UPDATE TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_event_ids()));

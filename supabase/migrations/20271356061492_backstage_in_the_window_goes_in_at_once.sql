-- backstage_in_the_window_goes_in_at_once
-- Created via `pnpm migration:new`. Idempotent — safe to re-apply.
--
-- 🎭 BACKSTAGE INSIDE THE VENUE'S WINDOW GOES IN AT ONCE — NOW HELD BY THE DATABASE (Unichat part F; owner 2026-11-20,
-- DECISION_LOG "A supplier sets its own BACKSTAGE moments without the host's OK"). Until now the rule lived only in the
-- server's settle step (`settleAfterAsking`, lib/schedule-suggestion-decide.server.ts), which applies a supplier's own
-- request with the service role. This migration makes the database the judge, in two layers:
--
--   1 · THE VERDICT IS THE DATABASE'S. `schedule_request_goes_in_at_once(suggestion_id)` reads the request, its chapter
--       and (for an adjust) the moment as it is NOW, and says true only when:
--         · it is the supplier's own open request (`to_host`), a `new` or an `adjust` — a delete always waits;
--         · where the moment ENDS UP is backstage (before the chapter starts / at or after it ends) and inside the
--           venue's window (setup-from → out-by), on a side the venue gave hours for;
--         · for an adjust, where it IS NOW is backstage too — moving a moment guests see out of the programme waits.
--       The server asks this function before it applies anything (no second reading of the rule in TypeScript).
--   2 · THE RECORD CANNOT LIE. A trigger on `event_schedule_suggestions` refuses to mark a request accepted with
--       `auto_agreed = true` (nobody pressed Approve) unless the event's Auto-agree is ON or the request is the supplier's
--       own `new`/`adjust` whose moment now sits backstage inside the window. The server applies the moment BEFORE it
--       marks the request, so this layer checks where the moment landed — the origin check is layer 1's.
--
-- The window is the chapter's own shipped hours (`start_at` · `end_at` · `ingress_minutes_before` ·
-- `egress_minutes_after`, migration 20271307658341) — the same reading as `venueWindowOf` / `backstageVerdict` in
-- apps/web/lib/venue-window.ts. Wall clocks stored in UTC columns: plain interval arithmetic, never a zone.
--
-- Nothing new is stored: no table, no column, no policy. The functions are SECURITY DEFINER so they can read the chapter
-- (a supplier's session cannot); only the service role may call them.
-- Held by apps/web/tests/db/backstage-in-the-window-goes-in-at-once.db.test.ts.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ── the window verdict: 'at_once' · 'guests_see' · 'outside' · 'no_window' (lib/venue-window.ts `backstageVerdict`) ──
CREATE OR REPLACE FUNCTION public.backstage_window_verdict(p_chapter_id UUID, p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c          public.event_schedule_blocks%ROWTYPE;
  v_end      TIMESTAMPTZ;
  v_ingress  TIMESTAMPTZ;
  v_egress   TIMESTAMPTZ;
  v_has_in   BOOLEAN;
  v_has_out  BOOLEAN;
  v_open     TIMESTAMPTZ;
  v_close    TIMESTAMPTZ;
BEGIN
  SELECT * INTO c FROM public.event_schedule_blocks WHERE block_id = p_chapter_id;
  -- No chapter, a moment (not a chapter), no clock, or Time TBA: there is no window to be inside.
  IF NOT FOUND OR c.parent_block_id IS NOT NULL OR c.start_at IS NULL OR COALESCE(c.time_tba, FALSE) OR p_start IS NULL THEN
    RETURN 'no_window';
  END IF;
  v_end     := CASE WHEN c.end_at IS NOT NULL AND c.end_at > c.start_at THEN c.end_at END;
  v_ingress := CASE WHEN c.ingress_minutes_before IS NOT NULL THEN c.start_at - make_interval(mins => c.ingress_minutes_before) END;
  v_egress  := CASE WHEN c.egress_minutes_after IS NOT NULL THEN c.start_at + make_interval(mins => c.egress_minutes_after) END;
  v_has_in  := v_ingress IS NOT NULL AND v_ingress < c.start_at;
  v_has_out := v_egress IS NOT NULL AND v_egress > COALESCE(v_end, c.start_at);
  v_open    := CASE WHEN v_has_in THEN v_ingress ELSE c.start_at END;
  v_close   := CASE WHEN v_has_out THEN v_egress ELSE COALESCE(v_end, c.start_at) END;

  -- The part of the chapter the moment starts in (lib/chapter-section.ts `momentSection`).
  IF p_start >= c.start_at AND (v_end IS NULL OR p_start < v_end) THEN
    RETURN 'guests_see';
  END IF;
  -- Backstage is only "inside" on a side the venue gave hours for.
  IF p_start < c.start_at AND NOT v_has_in THEN RETURN 'outside'; END IF;
  IF p_start >= c.start_at AND NOT v_has_out THEN RETURN 'outside'; END IF;
  IF p_start < v_open OR p_start > v_close OR (p_end IS NOT NULL AND p_end > v_close) THEN
    RETURN 'outside';
  END IF;
  RETURN 'at_once';
END;
$$;

REVOKE ALL ON FUNCTION public.backstage_window_verdict(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backstage_window_verdict(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- ── layer 1 · the request's verdict (the server asks this before applying) ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.schedule_request_goes_in_at_once(p_suggestion_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r        public.event_schedule_suggestions%ROWTYPE;
  cur      public.event_schedule_blocks%ROWTYPE;
  v_start  TIMESTAMPTZ;
  v_end    TIMESTAMPTZ;
BEGIN
  SELECT * INTO r FROM public.event_schedule_suggestions WHERE suggestion_id = p_suggestion_id;
  IF NOT FOUND OR r.status <> 'open' OR COALESCE(r.direction, 'to_host') = 'to_supplier' THEN
    RETURN FALSE;
  END IF;
  IF r.kind = 'new' THEN
    RETURN public.backstage_window_verdict(r.proposed_parent_block_id, r.proposed_start_at, r.proposed_end_at) = 'at_once';
  END IF;
  IF r.kind <> 'adjust' OR r.block_id IS NULL THEN
    RETURN FALSE;
  END IF;
  SELECT * INTO cur FROM public.event_schedule_blocks WHERE block_id = r.block_id AND event_id = r.event_id;
  IF NOT FOUND OR cur.parent_block_id IS NULL OR cur.start_at IS NULL THEN
    RETURN FALSE;
  END IF;
  -- Where it IS NOW: a moment guests see never leaves the programme without a person's yes.
  IF public.backstage_window_verdict(cur.parent_block_id, cur.start_at, cur.end_at) = 'guests_see' THEN
    RETURN FALSE;
  END IF;
  v_start := COALESCE(r.proposed_start_at, cur.start_at);
  v_end   := CASE WHEN r.proposed_start_at IS NOT NULL THEN r.proposed_end_at ELSE COALESCE(r.proposed_end_at, cur.end_at) END;
  RETURN public.backstage_window_verdict(cur.parent_block_id, v_start, v_end) = 'at_once';
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_request_goes_in_at_once(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_request_goes_in_at_once(UUID) TO service_role;

COMMENT ON FUNCTION public.schedule_request_goes_in_at_once(UUID) IS
  'Unichat F (owner 2026-11-20): true only for a supplier''s own open new/adjust whose moment ends up backstage inside the chapter''s venue window (and, for an adjust, is backstage now). The server''s settle asks this before applying a request without the host.';

-- ── layer 2 · an accept nobody pressed is only written for what the rule allows ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.schedule_request_auto_accept_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auto   BOOLEAN;
  v_block  public.event_schedule_blocks%ROWTYPE;
  v_ok     BOOLEAN := FALSE;
BEGIN
  IF NOT (NEW.status = 'accepted' AND COALESCE(NEW.auto_agreed, FALSE) AND NOT COALESCE(OLD.auto_agreed, FALSE)) THEN
    RETURN NEW;
  END IF;
  SELECT supplier_requests_auto_agree INTO v_auto FROM public.events WHERE event_id = NEW.event_id;
  IF COALESCE(v_auto, FALSE) THEN
    RETURN NEW; -- the host's standing choice: every request goes in (ruled 1 Nov, starts OFF).
  END IF;
  IF COALESCE(NEW.direction, 'to_host') <> 'to_supplier' THEN
    IF NEW.kind = 'new' THEN
      v_ok := public.backstage_window_verdict(NEW.proposed_parent_block_id, NEW.proposed_start_at, NEW.proposed_end_at) = 'at_once';
    ELSIF NEW.kind = 'adjust' AND NEW.block_id IS NOT NULL THEN
      -- The server moves the moment before it marks the request: check where it landed.
      SELECT * INTO v_block FROM public.event_schedule_blocks WHERE block_id = NEW.block_id AND event_id = NEW.event_id;
      IF FOUND AND v_block.parent_block_id IS NOT NULL THEN
        v_ok := public.backstage_window_verdict(v_block.parent_block_id, v_block.start_at, v_block.end_at) = 'at_once';
      END IF;
    END IF;
  END IF;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'schedulerequest:needs_a_person'
      USING HINT = 'Only a supplier''s own backstage moment inside the venue''s hours goes in without the host. This one waits for the host or coordinator.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_request_auto_accept_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_schedule_suggestions_auto_accept_guard ON public.event_schedule_suggestions;
CREATE TRIGGER event_schedule_suggestions_auto_accept_guard
  BEFORE UPDATE OF status, auto_agreed ON public.event_schedule_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.schedule_request_auto_accept_guard();

COMMIT;

-- supplier claim scanner unlimited group session
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🎟 THE SUPPLIER CLAIM SCANNER — slice 3: UNLIMITED and GROUP SESSION.
--
-- Owner rulings (DECISION_LOG): 2026-09-25 "EVERY SUPPLIER SCAN GETS A SHARED SEQUENCE NUMBER (#0001…), AND A THIRD
-- MODE: UNLIMITED" — *"if their service is unlimited, they can do multiple scans and it will count them again"*;
-- "GROUP SESSIONS (photo booth group shots) — print count = guests scanned, adjustable" — New session → scan everyone
-- in the shot → ONE number shared by all (#0107) → prints default = guests scanned, the operator adjusts –/+ → Ready
-- announces "#0107 is ready…" to each guest → each guest's pickup scan marks them received ("#0107 · 3 of 5 claimed");
-- group sessions combine with unlimited (a guest may be in many sessions). Prototype frames C · C′.
--
--   1 · modes widen: `unlimited`, `group_session` (settings + claims);
--   2 · UNLIMITED: every scan is a new claim with a new number, received at once; the count is "served" (every scan)
--       and "unique" (guests);
--   3 · supplier_scan_sessions: one open session per service per event; its number is allocated when it OPENS, under
--       the same counter lock as every other number. A claim names its session (`session_id`); a guest is in a
--       session once. Done closes it with the prints (default = guests scanned, 1–99); an EMPTY session cancelled gives
--       its number back when it is still the last one, so a mis-tap leaves no gap;
--   4 · the scan in a group service: a session open → the guest joins it ("#0107 · 3 guests"); none open → a pickup:
--       a READY claim is received ("#0107 · 3 of 5 claimed"), an ordered one is "not ready", else "start a session";
--   5 · Ready (slice 2's supplier_scan_ready) works on a closed session's number — never on one still open.
-- Counts only, everywhere: no function here returns a guest id or a name.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1 · the modes widen ─────────────────────────────────────────────────────
ALTER TABLE public.supplier_scan_settings DROP CONSTRAINT IF EXISTS supplier_scan_settings_mode_check;
ALTER TABLE public.supplier_scan_settings
  ADD CONSTRAINT supplier_scan_settings_mode_check
  CHECK (mode IN ('once', 'ordered_received', 'unlimited', 'group_session'));

ALTER TABLE public.supplier_scan_claims DROP CONSTRAINT IF EXISTS supplier_scan_claims_mode_check;
ALTER TABLE public.supplier_scan_claims
  ADD CONSTRAINT supplier_scan_claims_mode_check
  CHECK (mode IN ('once', 'ordered_received', 'unlimited', 'group_session'));

-- ─── 3 · sessions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_scan_sessions (
  session_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           UUID NOT NULL REFERENCES public.events (event_id) ON DELETE CASCADE,
  coverage_id        BIGINT NOT NULL REFERENCES public.vendor_coverages (id) ON DELETE CASCADE,
  vendor_profile_id  UUID NOT NULL REFERENCES public.vendor_profiles (vendor_profile_id) ON DELETE CASCADE,
  scan_number        INTEGER NOT NULL CHECK (scan_number > 0),
  mode               TEXT NOT NULL,
  state              TEXT NOT NULL DEFAULT 'open',
  prints             INTEGER CHECK (prints IS NULL OR prints BETWEEN 1 AND 99),
  opened_by_user_id  UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  opened_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at          TIMESTAMPTZ,
  UNIQUE (event_id, coverage_id, scan_number)
);

ALTER TABLE public.supplier_scan_sessions DROP CONSTRAINT IF EXISTS supplier_scan_sessions_mode_check;
ALTER TABLE public.supplier_scan_sessions
  ADD CONSTRAINT supplier_scan_sessions_mode_check CHECK (mode IN ('group_session'));
ALTER TABLE public.supplier_scan_sessions DROP CONSTRAINT IF EXISTS supplier_scan_sessions_state_check;
ALTER TABLE public.supplier_scan_sessions
  ADD CONSTRAINT supplier_scan_sessions_state_check CHECK (state IN ('open', 'done'));

CREATE UNIQUE INDEX IF NOT EXISTS supplier_scan_sessions_one_open_uniq
  ON public.supplier_scan_sessions (event_id, coverage_id) WHERE state = 'open';
CREATE INDEX IF NOT EXISTS supplier_scan_sessions_coverage_idx ON public.supplier_scan_sessions (coverage_id);
CREATE INDEX IF NOT EXISTS supplier_scan_sessions_vendor_idx ON public.supplier_scan_sessions (vendor_profile_id);
CREATE INDEX IF NOT EXISTS supplier_scan_sessions_opener_idx
  ON public.supplier_scan_sessions (opened_by_user_id) WHERE opened_by_user_id IS NOT NULL;

ALTER TABLE public.supplier_scan_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supplier_scan_sessions FROM anon;
-- Only the session functions write a shot — the pen is taken from browser roles, not just refused by RLS.
REVOKE INSERT, UPDATE, DELETE ON public.supplier_scan_sessions FROM authenticated;

-- The couple + coordinator read (their desk); admin reads. No write policy: only the session functions write.
DROP POLICY IF EXISTS supplier_scan_sessions_member_read ON public.supplier_scan_sessions;
CREATE POLICY supplier_scan_sessions_member_read ON public.supplier_scan_sessions
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1 FROM public.event_members em
       WHERE em.event_id = supplier_scan_sessions.event_id
         AND em.user_id = (SELECT auth.uid())
         AND em.member_type IN ('couple', 'coordinator')
    )
  );

COMMENT ON TABLE public.supplier_scan_sessions IS
  'A group shot (Group session): ONE shared number for everyone scanned into it, its prints (default = guests, 1–99), open → done. One open per service per event. Written only by supplier_scan_session_open / supplier_scan_session_done and joined by supplier_scan_claim.';

ALTER TABLE public.supplier_scan_claims
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.supplier_scan_sessions (session_id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS supplier_scan_claims_once_per_session_uniq
  ON public.supplier_scan_claims (session_id, guest_id) WHERE session_id IS NOT NULL;

-- ─── the scan, all four modes ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.supplier_scan_claim(
  p_event_id UUID,
  p_coverage_id BIGINT,
  p_token TEXT,
  p_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor    UUID;
  v_canonical TEXT;
  v_souvenir  BOOLEAN;
  v_setting   public.supplier_scan_settings%ROWTYPE;
  v_guest     UUID;
  v_existing  public.supplier_scan_claims%ROWTYPE;
  v_session   public.supplier_scan_sessions%ROWTYPE;
  v_sv_number INTEGER;
  v_sv_found  BOOLEAN := FALSE;
  v_number    INTEGER;
  v_claimed   INTEGER;
  v_of        INTEGER;
BEGIN
  IF p_method NOT IN ('supplier_qr', 'supplier_nfc') THEN
    RAISE EXCEPTION 'bad_method' USING ERRCODE = '22023';
  END IF;

  v_vendor := public.supplier_scan_shop_for(p_event_id, p_coverage_id);
  IF v_vendor IS NULL THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_setting FROM public.supplier_scan_settings s WHERE s.coverage_id = p_coverage_id;
  IF NOT FOUND OR NOT v_setting.enabled THEN
    RAISE EXCEPTION 'scanner_off' USING ERRCODE = '42501';
  END IF;

  SELECT vc.canonical_service INTO v_canonical FROM public.vendor_coverages vc WHERE vc.id = p_coverage_id;
  v_souvenir := public.supplier_scan_is_souvenir(v_canonical) AND v_setting.mode = 'once';

  SELECT g.guest_id INTO v_guest
    FROM public.guests g
   WHERE g.event_id = p_event_id
     AND g.qr_token = lower(btrim(COALESCE(p_token, '')))
     AND g.deleted_at IS NULL
     AND g.entry_source <> 'self_added_unlisted';
  IF v_guest IS NULL THEN
    RETURN jsonb_build_object('outcome', 'not_guest');
  END IF;

  -- 🔒 The number's lock — every scan, session open and Done of this service at this event queues here.
  INSERT INTO public.supplier_scan_counters (event_id, coverage_id)
  VALUES (p_event_id, p_coverage_id)
  ON CONFLICT (event_id, coverage_id) DO NOTHING;
  PERFORM 1 FROM public.supplier_scan_counters k
    WHERE k.event_id = p_event_id AND k.coverage_id = p_coverage_id
    FOR UPDATE;

  -- ── GROUP SESSION (and, from slice 4, ROAMING — the same shape, no station) ──
  IF v_setting.mode IN ('group_session', 'roaming') THEN
    SELECT * INTO v_session FROM public.supplier_scan_sessions ss
     WHERE ss.event_id = p_event_id AND ss.coverage_id = p_coverage_id AND ss.state = 'open';
    IF FOUND THEN
      IF EXISTS (SELECT 1 FROM public.supplier_scan_claims c WHERE c.session_id = v_session.session_id AND c.guest_id = v_guest) THEN
        SELECT COUNT(*)::INTEGER INTO v_of FROM public.supplier_scan_claims c WHERE c.session_id = v_session.session_id;
        RETURN jsonb_build_object('outcome', 'in_session', 'number', v_session.scan_number, 'guests', v_of);
      END IF;
      INSERT INTO public.supplier_scan_claims
        (event_id, guest_id, coverage_id, vendor_profile_id, scan_number, mode, state, method, scanned_by_user_id, session_id)
      VALUES (p_event_id, v_guest, p_coverage_id, v_vendor, v_session.scan_number, v_session.mode, 'ordered', p_method, auth.uid(), v_session.session_id);
      SELECT COUNT(*)::INTEGER INTO v_of FROM public.supplier_scan_claims c WHERE c.session_id = v_session.session_id;
      RETURN jsonb_build_object('outcome', 'added', 'number', v_session.scan_number, 'guests', v_of);
    END IF;

    -- No session open: this is a PICKUP. The guest's oldest READY claim is handed over.
    SELECT * INTO v_existing FROM public.supplier_scan_claims c
     WHERE c.event_id = p_event_id AND c.coverage_id = p_coverage_id AND c.guest_id = v_guest AND c.state = 'ready'
     ORDER BY c.scan_number ASC LIMIT 1;
    IF FOUND THEN
      UPDATE public.supplier_scan_claims SET state = 'received', received_at = NOW() WHERE claim_id = v_existing.claim_id;
      SELECT (COUNT(*) FILTER (WHERE c.state = 'received'))::INTEGER, COUNT(*)::INTEGER INTO v_claimed, v_of
        FROM public.supplier_scan_claims c WHERE c.session_id = v_existing.session_id;
      RETURN jsonb_build_object('outcome', 'picked_up', 'number', v_existing.scan_number, 'claimed', v_claimed, 'of', v_of);
    END IF;
    SELECT * INTO v_existing FROM public.supplier_scan_claims c
     WHERE c.event_id = p_event_id AND c.coverage_id = p_coverage_id AND c.guest_id = v_guest AND c.state = 'ordered'
     ORDER BY c.scan_number ASC LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('outcome', 'not_ready', 'number', v_existing.scan_number);
    END IF;
    SELECT * INTO v_existing FROM public.supplier_scan_claims c
     WHERE c.event_id = p_event_id AND c.coverage_id = p_coverage_id AND c.guest_id = v_guest
     ORDER BY c.scan_number DESC LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('outcome', 'already', 'number', v_existing.scan_number, 'claimed', NULL, 'total', NULL);
    END IF;
    RETURN jsonb_build_object('outcome', 'no_session');
  END IF;

  -- ── UNLIMITED: every scan counts, a new number each time ──
  IF v_setting.mode = 'unlimited' THEN
    UPDATE public.supplier_scan_counters k
       SET last_number = k.last_number + 1
     WHERE k.event_id = p_event_id AND k.coverage_id = p_coverage_id
    RETURNING k.last_number INTO v_number;
    INSERT INTO public.supplier_scan_claims
      (event_id, guest_id, coverage_id, vendor_profile_id, scan_number, mode, state, method, scanned_by_user_id, received_at)
    VALUES (p_event_id, v_guest, p_coverage_id, v_vendor, v_number, 'unlimited', 'received', p_method, auth.uid(), NOW());
    SELECT COUNT(*)::INTEGER, COUNT(DISTINCT c.guest_id)::INTEGER INTO v_claimed, v_of
      FROM public.supplier_scan_claims c
     WHERE c.event_id = p_event_id AND c.coverage_id = p_coverage_id AND c.mode = 'unlimited';
    RETURN jsonb_build_object('outcome', 'served', 'number', v_number, 'served', v_claimed, 'unique', v_of);
  END IF;

  -- ── ONCE · ORDERED → RECEIVED (slices 1–2, unchanged) ──
  IF v_souvenir THEN
    SELECT c.scan_number, TRUE INTO v_sv_number, v_sv_found
      FROM public.guest_souvenir_claims c WHERE c.guest_id = v_guest;
    IF COALESCE(v_sv_found, FALSE) THEN
      RETURN jsonb_build_object('outcome', 'already', 'number', v_sv_number, 'claimed', NULL, 'total', NULL);
    END IF;
  ELSE
    SELECT * INTO v_existing
      FROM public.supplier_scan_claims c
     WHERE c.event_id = p_event_id AND c.coverage_id = p_coverage_id
       AND c.guest_id = v_guest AND c.mode IN ('once', 'ordered_received')
     LIMIT 1;
    IF FOUND THEN
      IF v_existing.state = 'received' THEN
        RETURN jsonb_build_object('outcome', 'already', 'number', v_existing.scan_number, 'claimed', NULL, 'total', NULL);
      ELSIF v_existing.state = 'ordered' THEN
        RETURN jsonb_build_object('outcome', 'not_ready', 'number', v_existing.scan_number);
      END IF;
      UPDATE public.supplier_scan_claims
         SET state = 'received', received_at = NOW()
       WHERE claim_id = v_existing.claim_id;
      SELECT COUNT(DISTINCT c.guest_id)::INTEGER INTO v_claimed
        FROM public.supplier_scan_claims c
       WHERE c.event_id = p_event_id AND c.coverage_id = p_coverage_id AND c.state = 'received';
      RETURN jsonb_build_object(
        'outcome', 'received',
        'number', v_existing.scan_number,
        'claimed', v_claimed,
        'total', public.supplier_scan_total(p_event_id)
      );
    END IF;
  END IF;

  UPDATE public.supplier_scan_counters k
     SET last_number = k.last_number + 1
   WHERE k.event_id = p_event_id AND k.coverage_id = p_coverage_id
  RETURNING k.last_number INTO v_number;

  IF v_souvenir THEN
    INSERT INTO public.guest_souvenir_claims
      (event_id, guest_id, claimed_by_user_id, method, vendor_profile_id, coverage_id, scan_number)
    VALUES (p_event_id, v_guest, auth.uid(), p_method, v_vendor, p_coverage_id, v_number);
    SELECT COUNT(*)::INTEGER INTO v_claimed FROM public.guest_souvenir_claims c WHERE c.event_id = p_event_id;
    RETURN jsonb_build_object('outcome', 'claimed', 'number', v_number, 'claimed', v_claimed, 'total', public.supplier_scan_total(p_event_id));
  END IF;

  IF v_setting.mode = 'ordered_received' THEN
    INSERT INTO public.supplier_scan_claims
      (event_id, guest_id, coverage_id, vendor_profile_id, scan_number, mode, state, method, scanned_by_user_id)
    VALUES (p_event_id, v_guest, p_coverage_id, v_vendor, v_number, 'ordered_received', 'ordered', p_method, auth.uid());
    RETURN jsonb_build_object('outcome', 'ordered', 'number', v_number);
  END IF;

  INSERT INTO public.supplier_scan_claims
    (event_id, guest_id, coverage_id, vendor_profile_id, scan_number, mode, state, method, scanned_by_user_id, received_at)
  VALUES (p_event_id, v_guest, p_coverage_id, v_vendor, v_number, 'once', 'received', p_method, auth.uid(), NOW());
  SELECT COUNT(DISTINCT c.guest_id)::INTEGER INTO v_claimed
    FROM public.supplier_scan_claims c
   WHERE c.event_id = p_event_id AND c.coverage_id = p_coverage_id AND c.state = 'received';
  RETURN jsonb_build_object('outcome', 'claimed', 'number', v_number, 'claimed', v_claimed, 'total', public.supplier_scan_total(p_event_id));
END;
$$;

REVOKE ALL ON FUNCTION public.supplier_scan_claim(UUID, BIGINT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_scan_claim(UUID, BIGINT, TEXT, TEXT) TO authenticated;

-- ─── a session opens: its number is allocated now, under the lock ────────────
CREATE OR REPLACE FUNCTION public.supplier_scan_session_open(p_event_id UUID, p_coverage_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor  UUID;
  v_setting public.supplier_scan_settings%ROWTYPE;
  v_session public.supplier_scan_sessions%ROWTYPE;
  v_number  INTEGER;
  v_of      INTEGER;
BEGIN
  v_vendor := public.supplier_scan_shop_for(p_event_id, p_coverage_id);
  IF v_vendor IS NULL THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_setting FROM public.supplier_scan_settings s WHERE s.coverage_id = p_coverage_id;
  IF NOT FOUND OR NOT v_setting.enabled THEN
    RAISE EXCEPTION 'scanner_off' USING ERRCODE = '42501';
  END IF;
  IF v_setting.mode NOT IN ('group_session', 'roaming') THEN
    RAISE EXCEPTION 'not_a_session_mode' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.supplier_scan_counters (event_id, coverage_id)
  VALUES (p_event_id, p_coverage_id)
  ON CONFLICT (event_id, coverage_id) DO NOTHING;
  PERFORM 1 FROM public.supplier_scan_counters k
    WHERE k.event_id = p_event_id AND k.coverage_id = p_coverage_id
    FOR UPDATE;

  -- Already one open (another phone opened it): join it rather than open a second.
  SELECT * INTO v_session FROM public.supplier_scan_sessions ss
   WHERE ss.event_id = p_event_id AND ss.coverage_id = p_coverage_id AND ss.state = 'open';
  IF FOUND THEN
    SELECT COUNT(*)::INTEGER INTO v_of FROM public.supplier_scan_claims c WHERE c.session_id = v_session.session_id;
    RETURN jsonb_build_object('number', v_session.scan_number, 'guests', v_of);
  END IF;

  UPDATE public.supplier_scan_counters k
     SET last_number = k.last_number + 1
   WHERE k.event_id = p_event_id AND k.coverage_id = p_coverage_id
  RETURNING k.last_number INTO v_number;
  INSERT INTO public.supplier_scan_sessions (event_id, coverage_id, vendor_profile_id, scan_number, mode, opened_by_user_id)
  VALUES (p_event_id, p_coverage_id, v_vendor, v_number, v_setting.mode, auth.uid());
  RETURN jsonb_build_object('number', v_number, 'guests', 0);
END;
$$;

REVOKE ALL ON FUNCTION public.supplier_scan_session_open(UUID, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_scan_session_open(UUID, BIGINT) TO authenticated;

-- ─── Done: the open session closes with its prints ───────────────────────────
-- p_prints NULL = the default, one per guest scanned. An EMPTY session is cancelled, and its number given back when it
-- is still the last one handed out (a mis-tap leaves no gap). Returns { number, guests, prints } or { cancelled }.
CREATE OR REPLACE FUNCTION public.supplier_scan_session_done(p_event_id UUID, p_coverage_id BIGINT, p_prints INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor  UUID;
  v_session public.supplier_scan_sessions%ROWTYPE;
  v_of      INTEGER;
  v_prints  INTEGER;
BEGIN
  v_vendor := public.supplier_scan_shop_for(p_event_id, p_coverage_id);
  IF v_vendor IS NULL THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.supplier_scan_counters k
    WHERE k.event_id = p_event_id AND k.coverage_id = p_coverage_id
    FOR UPDATE;
  SELECT * INTO v_session FROM public.supplier_scan_sessions ss
   WHERE ss.event_id = p_event_id AND ss.coverage_id = p_coverage_id AND ss.state = 'open';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'none_open');
  END IF;
  SELECT COUNT(*)::INTEGER INTO v_of FROM public.supplier_scan_claims c WHERE c.session_id = v_session.session_id;
  IF v_of = 0 THEN
    DELETE FROM public.supplier_scan_sessions WHERE session_id = v_session.session_id;
    UPDATE public.supplier_scan_counters k
       SET last_number = k.last_number - 1
     WHERE k.event_id = p_event_id AND k.coverage_id = p_coverage_id AND k.last_number = v_session.scan_number;
    RETURN jsonb_build_object('outcome', 'cancelled', 'number', v_session.scan_number);
  END IF;
  v_prints := COALESCE(p_prints, v_of);
  IF v_prints < 1 OR v_prints > 99 THEN
    RAISE EXCEPTION 'bad_prints' USING ERRCODE = '22023';
  END IF;
  UPDATE public.supplier_scan_sessions
     SET state = 'done', prints = v_prints, closed_at = NOW()
   WHERE session_id = v_session.session_id;
  RETURN jsonb_build_object('outcome', 'done', 'number', v_session.scan_number, 'guests', v_of, 'prints', v_prints);
END;
$$;

REVOKE ALL ON FUNCTION public.supplier_scan_session_done(UUID, BIGINT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_scan_session_done(UUID, BIGINT, INTEGER) TO authenticated;

-- ─── Ready never fires on a session still open ───────────────────────────────
CREATE OR REPLACE FUNCTION public.supplier_scan_ready(p_event_id UUID, p_coverage_id BIGINT, p_number INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor  UUID;
  v_label   TEXT;
  v_shop    TEXT;
  v_body    TEXT;
  v_told    INTEGER := 0;
  r         RECORD;
BEGIN
  v_vendor := public.supplier_scan_shop_for(p_event_id, p_coverage_id);
  IF v_vendor IS NULL THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.supplier_scan_sessions ss
     WHERE ss.event_id = p_event_id AND ss.coverage_id = p_coverage_id AND ss.scan_number = p_number AND ss.state = 'open'
  ) THEN
    RAISE EXCEPTION 'session_open' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(NULLIF(btrim(css.display_name_en), ''), initcap(replace(vc.canonical_service, '_', ' ')))
    INTO v_label
    FROM public.vendor_coverages vc
    LEFT JOIN public.canonical_service_schemas css ON css.canonical_service = vc.canonical_service
   WHERE vc.id = p_coverage_id;
  SELECT NULLIF(btrim(vp.business_name), '') INTO v_shop FROM public.vendor_profiles vp WHERE vp.vendor_profile_id = v_vendor;
  v_body := '#' || lpad(p_number::TEXT, 4, '0') || ' is ready — claim it at ' || COALESCE(v_label, 'the supplier')
            || COALESCE(' (' || v_shop || ')', '') || '.';

  FOR r IN
    UPDATE public.supplier_scan_claims c
       SET state = 'ready', ready_at = NOW()
     WHERE c.event_id = p_event_id AND c.coverage_id = p_coverage_id
       AND c.scan_number = p_number AND c.state = 'ordered'
    RETURNING c.guest_id
  LOOP
    INSERT INTO public.coordinator_broadcasts (event_id, sender_user_id, sender_role, body, target_guest_id)
    VALUES (p_event_id, auth.uid(), 'supplier', left(v_body, 500), r.guest_id);
    v_told := v_told + 1;
  END LOOP;
  RETURN v_told;
END;
$$;

REVOKE ALL ON FUNCTION public.supplier_scan_ready(UUID, BIGINT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_scan_ready(UUID, BIGINT, INTEGER) TO authenticated;

-- ─── the count, every mode ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.supplier_scan_tally(p_event_id UUID, p_coverage_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor    UUID;
  v_canonical TEXT;
  v_setting   public.supplier_scan_settings%ROWTYPE;
  v_souvenir  BOOLEAN;
  v_claimed   INTEGER;
  v_ordered   INTEGER := 0;
  v_ready     INTEGER := 0;
  v_served    INTEGER := 0;
  v_unique    INTEGER := 0;
  v_sessions  INTEGER := 0;
  v_open      public.supplier_scan_sessions%ROWTYPE;
  v_open_of   INTEGER;
  v_last      INTEGER;
BEGIN
  v_vendor := public.supplier_scan_shop_for(p_event_id, p_coverage_id);
  IF v_vendor IS NULL THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;
  SELECT vc.canonical_service INTO v_canonical FROM public.vendor_coverages vc WHERE vc.id = p_coverage_id;
  SELECT * INTO v_setting FROM public.supplier_scan_settings s WHERE s.coverage_id = p_coverage_id;
  v_souvenir := public.supplier_scan_is_souvenir(v_canonical) AND COALESCE(v_setting.mode, 'once') = 'once';

  IF v_souvenir THEN
    SELECT COUNT(*)::INTEGER INTO v_claimed FROM public.guest_souvenir_claims c WHERE c.event_id = p_event_id;
  ELSIF COALESCE(v_setting.mode, 'once') IN ('group_session', 'roaming') THEN
    -- Per CLAIM (a guest in three shots holds three): the prints people pick up.
    SELECT (COUNT(*) FILTER (WHERE c.state = 'received'))::INTEGER,
           (COUNT(*) FILTER (WHERE c.state = 'ordered'))::INTEGER,
           (COUNT(*) FILTER (WHERE c.state = 'ready'))::INTEGER,
           COUNT(DISTINCT c.guest_id)::INTEGER
      INTO v_claimed, v_ordered, v_ready, v_unique
      FROM public.supplier_scan_claims c
     WHERE c.event_id = p_event_id AND c.coverage_id = p_coverage_id AND c.session_id IS NOT NULL;
    SELECT COUNT(*)::INTEGER INTO v_sessions FROM public.supplier_scan_sessions ss
     WHERE ss.event_id = p_event_id AND ss.coverage_id = p_coverage_id;
  ELSIF COALESCE(v_setting.mode, 'once') = 'unlimited' THEN
    SELECT COUNT(*)::INTEGER, COUNT(DISTINCT c.guest_id)::INTEGER INTO v_served, v_unique
      FROM public.supplier_scan_claims c
     WHERE c.event_id = p_event_id AND c.coverage_id = p_coverage_id AND c.mode = 'unlimited';
    v_claimed := v_unique;
  ELSE
    SELECT (COUNT(DISTINCT c.guest_id) FILTER (WHERE c.state = 'received'))::INTEGER,
           (COUNT(DISTINCT c.guest_id) FILTER (WHERE c.state = 'ordered'))::INTEGER,
           (COUNT(DISTINCT c.guest_id) FILTER (WHERE c.state = 'ready'))::INTEGER
      INTO v_claimed, v_ordered, v_ready
      FROM public.supplier_scan_claims c
     WHERE c.event_id = p_event_id AND c.coverage_id = p_coverage_id AND c.mode IN ('once', 'ordered_received');
  END IF;

  SELECT * INTO v_open FROM public.supplier_scan_sessions ss
   WHERE ss.event_id = p_event_id AND ss.coverage_id = p_coverage_id AND ss.state = 'open';
  IF FOUND THEN
    SELECT COUNT(*)::INTEGER INTO v_open_of FROM public.supplier_scan_claims c WHERE c.session_id = v_open.session_id;
  END IF;
  SELECT k.last_number INTO v_last
    FROM public.supplier_scan_counters k
   WHERE k.event_id = p_event_id AND k.coverage_id = p_coverage_id;

  RETURN jsonb_build_object(
    'enabled', COALESCE(v_setting.enabled, FALSE),
    'mode', COALESCE(v_setting.mode, 'once'),
    'souvenir', v_souvenir,
    'claimed', COALESCE(v_claimed, 0),
    'ordered', COALESCE(v_ordered, 0),
    'ready', COALESCE(v_ready, 0),
    'served', COALESCE(v_served, 0),
    'unique', COALESCE(v_unique, 0),
    'sessions', COALESCE(v_sessions, 0),
    'open_number', CASE WHEN v_open.session_id IS NULL THEN NULL ELSE v_open.scan_number END,
    'open_guests', CASE WHEN v_open.session_id IS NULL THEN NULL ELSE COALESCE(v_open_of, 0) END,
    'total', public.supplier_scan_total(p_event_id),
    'last_number', COALESCE(v_last, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.supplier_scan_tally(UUID, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_scan_tally(UUID, BIGINT) TO authenticated;

-- ─── "Your numbers", with a session's prints and whether it is still open ────
DROP FUNCTION IF EXISTS public.supplier_scan_numbers(UUID, BIGINT);
CREATE FUNCTION public.supplier_scan_numbers(p_event_id UUID, p_coverage_id BIGINT)
RETURNS TABLE (
  scan_number INTEGER,
  guests INTEGER,
  ordered INTEGER,
  ready INTEGER,
  received INTEGER,
  first_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  prints INTEGER,
  open BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.supplier_scan_shop_for(p_event_id, p_coverage_id) IS NULL THEN
    RAISE EXCEPTION 'not_your_booking' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT c.scan_number,
           (COUNT(DISTINCT c.guest_id))::INTEGER,
           (COUNT(*) FILTER (WHERE c.state = 'ordered'))::INTEGER,
           (COUNT(*) FILTER (WHERE c.state = 'ready'))::INTEGER,
           (COUNT(*) FILTER (WHERE c.state = 'received'))::INTEGER,
           MIN(c.claimed_at),
           MAX(c.ready_at),
           MAX(c.received_at),
           MAX(ss.prints),
           COALESCE(bool_or(ss.state = 'open'), FALSE)
      FROM public.supplier_scan_claims c
      LEFT JOIN public.supplier_scan_sessions ss ON ss.session_id = c.session_id
     WHERE c.event_id = p_event_id AND c.coverage_id = p_coverage_id
     GROUP BY c.scan_number
     ORDER BY c.scan_number DESC
     LIMIT 300;
END;
$$;

REVOKE ALL ON FUNCTION public.supplier_scan_numbers(UUID, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_scan_numbers(UUID, BIGINT) TO authenticated;

COMMIT;

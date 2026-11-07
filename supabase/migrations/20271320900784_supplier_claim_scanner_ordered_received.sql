-- supplier claim scanner ordered received
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🎟 THE SUPPLIER CLAIM SCANNER — slice 2: ORDERED → RECEIVED, and "#0042 is ready".
--
-- Owner rulings (DECISION_LOG): 2026-09-25 "TWO SUPPLIER SERVICE MODES: RECEIVED ONLY or ORDERED → RECEIVED" ·
-- "SUPPLIER SERVICE FLOW GAINS READY TO CLAIM + A GUEST ANNOUNCEMENT" · "ALL ANNOUNCEMENTS GO THROUGH THE ONE
-- COORDINATOR ANNOUNCEMENT CHANNEL" · "ANNOUNCEMENTS SHOW ONLY ON THE EVENT HUB — no email"; the approved prototype's
-- frame F (`supplier_scan_2026-10-03_fable.html`).
--
--   1 · the mode `ordered_received` joins `once` (settings + claims CHECKs widen — the code runs it now);
--   2 · a claim carries a STATE: ordered → ready → received (Once claims are born received);
--       one per guest per service per event in both modes (the unique index widens);
--   3 · the scan: no claim → ORDERED (the number is allocated now and kept through Ready → Received);
--       ordered → "not ready yet" (nothing changes); ready → RECEIVED; received → "already";
--   4 · supplier_scan_ready(event, service, number): the supplier taps Ready on a number → its guests' claims go
--       ready AND each guest gets ONE line on their Event Hub — "#0042 is ready — claim it at Photo booth". It is a row
--       in the ONE announcement channel (`coordinator_broadcasts`), targeted at that one guest (`target_guest_id`),
--       sender_role 'supplier'. No new channel, no email, no SMS.
--   5 · every reader of the event-wide announcement must skip targeted rows (the app does —
--       lib/coordinator-broadcasts-server.ts `fetchLatestBroadcasts`), so "#0042 is ready" never reaches the others;
--   6 · supplier_scan_numbers(event, service): the supplier's "Your numbers" — number · how many guests · state ·
--       time. Counts only: no guest id, no name.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1 · the mode widens ─────────────────────────────────────────────────────
ALTER TABLE public.supplier_scan_settings DROP CONSTRAINT IF EXISTS supplier_scan_settings_mode_check;
ALTER TABLE public.supplier_scan_settings
  ADD CONSTRAINT supplier_scan_settings_mode_check CHECK (mode IN ('once', 'ordered_received'));

ALTER TABLE public.supplier_scan_claims DROP CONSTRAINT IF EXISTS supplier_scan_claims_mode_check;
ALTER TABLE public.supplier_scan_claims
  ADD CONSTRAINT supplier_scan_claims_mode_check CHECK (mode IN ('once', 'ordered_received'));

-- ─── 2 · a claim's state ─────────────────────────────────────────────────────
ALTER TABLE public.supplier_scan_claims
  ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

ALTER TABLE public.supplier_scan_claims DROP CONSTRAINT IF EXISTS supplier_scan_claims_state_check;
ALTER TABLE public.supplier_scan_claims
  ADD CONSTRAINT supplier_scan_claims_state_check CHECK (state IN ('ordered', 'ready', 'received'));

-- A Once claim is received the moment it is made.
UPDATE public.supplier_scan_claims SET received_at = claimed_at WHERE state = 'received' AND received_at IS NULL;

DROP INDEX IF EXISTS public.supplier_scan_claims_once_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS supplier_scan_claims_one_per_guest_uniq
  ON public.supplier_scan_claims (event_id, coverage_id, guest_id)
  WHERE mode IN ('once', 'ordered_received');

CREATE INDEX IF NOT EXISTS supplier_scan_claims_number_idx
  ON public.supplier_scan_claims (event_id, coverage_id, scan_number);

COMMENT ON COLUMN public.supplier_scan_claims.state IS
  'ordered → ready → received (Ordered → Received mode); a Once claim is born received. Moved only by supplier_scan_claim() and supplier_scan_ready().';

-- ─── 4a · one-guest targeting on the ONE announcement channel ────────────────
ALTER TABLE public.coordinator_broadcasts
  ADD COLUMN IF NOT EXISTS target_guest_id UUID;

ALTER TABLE public.coordinator_broadcasts DROP CONSTRAINT IF EXISTS coordinator_broadcasts_target_guest_fkey;
ALTER TABLE public.coordinator_broadcasts
  ADD CONSTRAINT coordinator_broadcasts_target_guest_fkey
  FOREIGN KEY (event_id, target_guest_id) REFERENCES public.guests (event_id, guest_id) ON DELETE CASCADE;

ALTER TABLE public.coordinator_broadcasts DROP CONSTRAINT IF EXISTS coordinator_broadcasts_sender_role_check;
ALTER TABLE public.coordinator_broadcasts
  ADD CONSTRAINT coordinator_broadcasts_sender_role_check CHECK (sender_role IN ('couple', 'coordinator', 'supplier'));

-- A supplier's line is ALWAYS for one guest; a line for one guest is ALWAYS a supplier's.
ALTER TABLE public.coordinator_broadcasts DROP CONSTRAINT IF EXISTS coordinator_broadcasts_supplier_is_one_guest;
ALTER TABLE public.coordinator_broadcasts
  ADD CONSTRAINT coordinator_broadcasts_supplier_is_one_guest
  CHECK ((sender_role = 'supplier') = (target_guest_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS coordinator_broadcasts_target_guest_idx
  ON public.coordinator_broadcasts (event_id, target_guest_id, created_at DESC)
  WHERE target_guest_id IS NOT NULL;

COMMENT ON COLUMN public.coordinator_broadcasts.target_guest_id IS
  'NULL = to every guest (the couple / coordinator). Set = to ONE guest only — a supplier''s "#0042 is ready" (supplier_scan_ready). Event-wide readers must filter target_guest_id IS NULL.';

-- ─── 3 · THE SCAN, with Ordered → Received ───────────────────────────────────
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
  v_sv_number INTEGER;
  v_sv_found  BOOLEAN := FALSE;
  v_number    INTEGER;
  v_claimed   INTEGER;
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
  -- A souvenir writes the couple's own desk row only when it is handed over on the spot (Once); a made-to-order
  -- souvenir keeps its order in supplier_scan_claims, like any other made-to-order item.
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

  -- 🔒 The number's lock — every scan of this service at this event queues here.
  INSERT INTO public.supplier_scan_counters (event_id, coverage_id)
  VALUES (p_event_id, p_coverage_id)
  ON CONFLICT (event_id, coverage_id) DO NOTHING;
  PERFORM 1 FROM public.supplier_scan_counters k
    WHERE k.event_id = p_event_id AND k.coverage_id = p_coverage_id
    FOR UPDATE;

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
      -- ready → RECEIVED: the second scan hands it over.
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

-- ─── the count, with Ordered · Ready · Received ──────────────────────────────
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
  ELSE
    SELECT (COUNT(DISTINCT c.guest_id) FILTER (WHERE c.state = 'received'))::INTEGER,
           (COUNT(DISTINCT c.guest_id) FILTER (WHERE c.state = 'ordered'))::INTEGER,
           (COUNT(DISTINCT c.guest_id) FILTER (WHERE c.state = 'ready'))::INTEGER
      INTO v_claimed, v_ordered, v_ready
      FROM public.supplier_scan_claims c
     WHERE c.event_id = p_event_id AND c.coverage_id = p_coverage_id;
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
    'total', public.supplier_scan_total(p_event_id),
    'last_number', COALESCE(v_last, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.supplier_scan_tally(UUID, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_scan_tally(UUID, BIGINT) TO authenticated;

-- ─── 4b · READY: the supplier tells the number's guests ──────────────────────
-- Returns how many guests were told. 0 = nothing was waiting on that number (already ready, received, or unknown).
-- The words are built HERE from the service's own name and the shop's — never text from the browser.
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

-- ─── 6 · "Your numbers" — counts only ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.supplier_scan_numbers(p_event_id UUID, p_coverage_id BIGINT)
RETURNS TABLE (
  scan_number INTEGER,
  guests INTEGER,
  ordered INTEGER,
  ready INTEGER,
  received INTEGER,
  first_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ
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
           MAX(c.received_at)
      FROM public.supplier_scan_claims c
     WHERE c.event_id = p_event_id AND c.coverage_id = p_coverage_id
     GROUP BY c.scan_number
     ORDER BY c.scan_number DESC
     LIMIT 300;
END;
$$;

REVOKE ALL ON FUNCTION public.supplier_scan_numbers(UUID, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_scan_numbers(UUID, BIGINT) TO authenticated;

COMMIT;

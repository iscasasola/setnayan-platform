-- ════════════════════════════════════════════════════════════════════════════
-- BOOKING FEE — charge ONLY clients Setnayan sourced (owner-locked 2026-07-25,
-- reaffirmed 2026-07-26: "bringing in clients will give them free access").
--
-- Canonical: Vendor_Monetization_Model_LOCKED_2026-07-25.md § 3
--   "Applies ONLY to clients Setnayan sourced (client discovered the vendor
--    through the marketplace). BYO / vendor-invited / returning = free."
--   "sourced-vs-BYO is stamped ONCE at first contact (marketplace-discovered
--    vs vendor-invited/own-link), and is IMMUTABLE."
--
-- THE BUG THIS CLOSES. `booking_fee_open_lock_charge` hardcoded
-- `attribution := 'sourced'` on the ledger insert (20270927120000:165, comment:
-- "kept 'sourced' to satisfy the column default"). The LOCK path therefore
-- never consulted arrival source at all, so on flag-flip a vendor who brought
-- their OWN client would have been billed a percentage of a deal Setnayan had
-- no part in — the exact opposite of the locked model, and the one outcome the
-- whole "monetize ACCESS, not the vendor's deals" posture exists to avoid.
--
-- The SEND path already carries attribution; only the LOCK path was blind.
--
-- HOW ATTRIBUTION IS DERIVED (build plan 2026-07-21 § "Definition of sourced",
-- with the 2026-07-26 owner correction applied):
--   SOURCED  iff a chat thread exists for (event, vendor) whose inquiry_source
--            is one of the marketplace-discovery surfaces below.
--   IMPORT   everything else — NULL inquiry_source, no thread at all,
--            host_manual, invite_claim, degree, AND 'website'.
--
-- ⚠ 'website' is DELIBERATELY ABSENT from the sourced set. The 2026-07-21 build
-- plan listed it with an open sign-off (#3d-iv); the owner closed it on
-- 2026-07-26 — a couple arriving through the vendor's OWN link is a client the
-- vendor brought, so it is an IMPORT and free. Keeping it billable would have
-- charged vendors for their own audience and pushed them off-platform.
--
-- FAIL-SAFE DIRECTION: anything unrecognised resolves to IMPORT (free). A
-- misclassification must cost Setnayan a fee it might have been owed, never
-- bill a vendor for a client they brought themselves. Silent overcharging is
-- unrecoverable trust; a missed fee is just a missed fee.
-- ════════════════════════════════════════════════════════════════════════════

-- ── The sourced-surface set, as SQL. Mirrors SOURCED_INQUIRY_SOURCES in
--    apps/web/lib/booking-fee-gate.ts; the DB test asserts the two agree.
CREATE OR REPLACE FUNCTION public.booking_fee_is_sourced_surface(p_inquiry_source TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_inquiry_source IS NOT NULL
     AND p_inquiry_source IN (
       'explore', 'search', 'shortlist', 'first_pick',
       'favorites', 'auto_build', 'editorial', 'influencer'
     );
$$;

COMMENT ON FUNCTION public.booking_fee_is_sourced_surface(TEXT) IS
  'TRUE when an inquiry_source means the couple discovered the vendor THROUGH '
  'Setnayan (billable). Everything else - incl. NULL, host_manual, invite_claim, '
  'degree and website (the vendor own link) - is an IMPORT and free forever. '
  'Owner-locked 2026-07-25 s3; website closed to IMPORT 2026-07-26. Mirrors '
  'SOURCED_INQUIRY_SOURCES in apps/web/lib/booking-fee-gate.ts.';

-- ── Attribution for a (vendor, event) pair, from the thread stamped at first
--    contact. Immutable by construction: it reads inquiry_source, which the
--    provenance guard (20270820292403) already protects from being rewritten.
CREATE OR REPLACE FUNCTION public.booking_fee_attribution_for(
  p_vendor_profile_id UUID,
  p_event_id UUID
)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
        FROM public.chat_threads t
       WHERE t.event_id = p_event_id
         AND t.vendor_profile_id = p_vendor_profile_id
         AND public.booking_fee_is_sourced_surface(t.inquiry_source)
    ) THEN 'sourced'
    ELSE 'import'
  END;
$$;

COMMENT ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) IS
  'sourced | import for a (vendor, event). SOURCED only when a chat thread for '
  'the pair carries a marketplace-discovery inquiry_source. Fails SAFE to '
  'import: no thread, NULL source, or an unrecognised source is free.';

-- ── Rebuild the lock RPC so it stamps the DERIVED attribution and waives an
--    import outright. Everything else — the free-5 ordinal, idempotency, the
--    verified gate, the rate — is carried over byte-for-byte from
--    20270927120000 / 20271009120000.
CREATE OR REPLACE FUNCTION public.booking_fee_open_lock_charge(
  p_event_vendor_id UUID,
  p_schedule_version TEXT DEFAULT '2026-07-25-taper5-1-over-100k'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ev          RECORD;
  v_ledger      RECORD;
  v_existing    RECORD;
  v_ordinal     INTEGER;
  v_is_free     BOOLEAN;
  v_fee         BIGINT;
  v_charge_amount BIGINT;
  v_status      TEXT;
  v_attribution TEXT;
  v_charge_id   UUID;
BEGIN
  SELECT ev.marketplace_vendor_id AS vpid,
         ev.event_id,
         ev.status,
         COALESCE(round(ev.total_cost_php * 100)::BIGINT, 0) AS amount_centavos
    INTO v_ev
    FROM public.event_vendors ev
    WHERE ev.vendor_id = p_event_vendor_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('skipped', 'not_found');
  END IF;
  IF v_ev.vpid IS NULL THEN
    RETURN jsonb_build_object('skipped', 'not_verified_vendor');
  END IF;
  IF v_ev.status NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete') THEN
    RETURN jsonb_build_object('skipped', 'not_contracted');
  END IF;

  -- THE NEW GATE. A client the vendor brought is never billed.
  v_attribution := public.booking_fee_attribution_for(v_ev.vpid, v_ev.event_id);

  PERFORM pg_advisory_xact_lock(hashtextextended(v_ev.vpid::text, 0));

  INSERT INTO public.booking_fee_ledger
    (vendor_profile_id, event_id, source, attribution, attribution_frozen_at,
     highest_declared_centavos)
  VALUES
    (v_ev.vpid, v_ev.event_id, 'lock', v_attribution, NOW(), v_ev.amount_centavos)
  ON CONFLICT (vendor_profile_id, event_id) DO UPDATE
    SET highest_declared_centavos =
          GREATEST(COALESCE(public.booking_fee_ledger.highest_declared_centavos, 0),
                   EXCLUDED.highest_declared_centavos),
        -- Also repair `source` on reuse. The original ON CONFLICT never set it,
        -- so a row first created by the SEND path stayed source='send' and the
        -- free-5 ordinal (which counts source='lock') silently excluded it.
        source = 'lock',
        updated_at = NOW()
  RETURNING * INTO v_ledger;

  -- An IMPORT is free forever: record the waiver so the decision is auditable
  -- and idempotent, and never mint an order.
  IF v_ledger.attribution = 'import' THEN
    SELECT charge_id, status INTO v_existing
      FROM public.booking_fee_charges
      WHERE event_vendor_id = p_event_vendor_id
        AND status IN ('pending', 'paid', 'waived_import', 'waived_free5')
      LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'charge_id', v_existing.charge_id, 'status', v_existing.status,
        'amount_charged_centavos', 0, 'computed_fee_centavos', 0,
        'is_free', TRUE, 'attribution', 'import', 'reused', TRUE);
    END IF;

    INSERT INTO public.booking_fee_charges
      (ledger_id, proposal_id, event_vendor_id, source, vendor_profile_id, event_id,
       proposal_amount_centavos, computed_fee_centavos, amount_charged_centavos,
       schedule_version, status)
    VALUES
      (v_ledger.ledger_id, NULL, p_event_vendor_id, 'lock', v_ev.vpid, v_ev.event_id,
       v_ev.amount_centavos, 0, 0, p_schedule_version, 'waived_import')
    RETURNING charge_id INTO v_charge_id;

    RETURN jsonb_build_object(
      'charge_id', v_charge_id, 'status', 'waived_import',
      'amount_charged_centavos', 0, 'computed_fee_centavos', 0,
      'is_free', TRUE, 'attribution', 'import', 'reused', FALSE);
  END IF;

  -- ── SOURCED from here down: the pre-existing free-5 + rate path, unchanged.
  IF v_ledger.booking_ordinal IS NULL THEN
    SELECT count(*) INTO v_ordinal
      FROM public.booking_fee_ledger l2
      WHERE l2.vendor_profile_id = v_ev.vpid
        AND l2.source = 'lock'
        AND (l2.created_at, l2.ledger_id) <= (v_ledger.created_at, v_ledger.ledger_id);
    -- Defensive: the count includes v_ledger itself, so it is >= 1. Clamping
    -- keeps a pathological 0 from violating booking_ordinal >= 1, which would
    -- raise and make the whole fee silently uncollected.
    v_ordinal := GREATEST(v_ordinal, 1);
    v_is_free := v_ordinal <= 5;
    UPDATE public.booking_fee_ledger
      SET booking_ordinal = v_ordinal, is_free_booking = v_is_free, updated_at = NOW()
      WHERE ledger_id = v_ledger.ledger_id;
  ELSE
    v_ordinal := v_ledger.booking_ordinal;
    v_is_free := v_ledger.is_free_booking;
  END IF;

  SELECT charge_id, status, amount_charged_centavos, computed_fee_centavos
    INTO v_existing
    FROM public.booking_fee_charges
    WHERE event_vendor_id = p_event_vendor_id
      AND status IN ('pending', 'paid', 'waived_import', 'waived_free5')
    LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'charge_id', v_existing.charge_id, 'status', v_existing.status,
      'amount_charged_centavos', v_existing.amount_charged_centavos,
      'computed_fee_centavos', v_existing.computed_fee_centavos,
      'booking_ordinal', v_ordinal, 'is_free', v_is_free,
      'attribution', 'sourced', 'reused', true);
  END IF;

  v_fee := public.booking_fee_centavos(v_ev.amount_centavos);

  IF v_is_free THEN
    v_status := 'waived_free5';
    v_charge_amount := 0;
  ELSIF v_fee <= 0 THEN
    v_status := 'paid';
    v_charge_amount := 0;
  ELSE
    v_status := 'pending';
    v_charge_amount := v_fee;
  END IF;

  INSERT INTO public.booking_fee_charges
    (ledger_id, proposal_id, event_vendor_id, source, vendor_profile_id, event_id,
     proposal_amount_centavos, computed_fee_centavos, amount_charged_centavos,
     schedule_version, status, paid_at, expires_at)
  VALUES
    (v_ledger.ledger_id, NULL, p_event_vendor_id, 'lock', v_ev.vpid, v_ev.event_id,
     v_ev.amount_centavos, v_fee, v_charge_amount, p_schedule_version, v_status,
     CASE WHEN v_status = 'paid' THEN NOW() ELSE NULL END,
     CASE WHEN v_status = 'pending' THEN NOW() + INTERVAL '7 days' ELSE NULL END)
  RETURNING charge_id INTO v_charge_id;

  RETURN jsonb_build_object(
    'charge_id', v_charge_id, 'status', v_status,
    'amount_charged_centavos', v_charge_amount, 'computed_fee_centavos', v_fee,
    'booking_ordinal', v_ordinal, 'is_free', v_is_free,
    'attribution', 'sourced', 'reused', false);
END;
$$;

REVOKE ALL ON FUNCTION public.booking_fee_open_lock_charge(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_open_lock_charge(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_open_lock_charge(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_open_lock_charge(UUID, TEXT) TO service_role;

-- ⚠ REVOKE from anon/authenticated EXPLICITLY, not just PUBLIC. Supabase's
-- platform ALTER DEFAULT PRIVILEGES grants ALL on every new FUNCTION to anon,
-- authenticated and service_role, and revoking from PUBLIC does not touch a
-- role-specific grant. This is the same trap that shipped `events_host` as a
-- writable definer view earlier today; the exposure freeze caught it here.
REVOKE ALL ON FUNCTION public.booking_fee_is_sourced_surface(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_is_sourced_surface(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_is_sourced_surface(TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_is_sourced_surface(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.booking_fee_attribution_for(UUID, UUID) TO service_role;

-- ── Post-condition: the classification must match the locked model.
DO $$
BEGIN
  -- Marketplace discovery is billable.
  IF NOT public.booking_fee_is_sourced_surface('explore')
     OR NOT public.booking_fee_is_sourced_surface('search')
     OR NOT public.booking_fee_is_sourced_surface('shortlist') THEN
    RAISE EXCEPTION 'a marketplace-discovery surface is no longer billable';
  END IF;

  -- The vendor's own audience is NOT.
  IF public.booking_fee_is_sourced_surface('website') THEN
    RAISE EXCEPTION 'website (the vendor own link) is billable — owner ruled it an IMPORT 2026-07-26';
  END IF;
  IF public.booking_fee_is_sourced_surface('host_manual')
     OR public.booking_fee_is_sourced_surface('invite_claim')
     OR public.booking_fee_is_sourced_surface('degree') THEN
    RAISE EXCEPTION 'a vendor-brought source is billable';
  END IF;

  -- Unknown / NULL must fail SAFE to free.
  IF public.booking_fee_is_sourced_surface(NULL)
     OR public.booking_fee_is_sourced_surface('something_invented_later') THEN
    RAISE EXCEPTION 'an unrecognised source is billable — it must fail safe to import';
  END IF;
END $$;

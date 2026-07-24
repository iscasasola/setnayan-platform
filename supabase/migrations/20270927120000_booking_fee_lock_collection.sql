-- Booking Fee · LOCK collection — the money loop closes at LOCK, not SEND.
--
-- Owner moved the fee TRIGGER to the LOCK (event_vendors → contracted), with the
-- fee base = the COUPLE-CONFIRMED agreed total (event_vendors.total_cost_php),
-- and the rate = flat 5% / no cap (lib/booking-fee.ts, 2026-07-24). This migration:
--
--   1. REPRICES public.booking_fee_centavos to flat 5% / NO cap — it was still the
--      superseded flat-2% / ₱4,000-cap schedule from 20270916909942, which
--      diverged from lib/booking-fee.ts. That old function was INERT (the only
--      caller, the send-gate, never runs while the two-key flags are off), so this
--      reprice is byte-behaviour-identical on the live path today and simply
--      re-aligns SQL with TS before the LOCK path starts calling it.
--   2. Extends booking_fee_ledger + booking_fee_charges to carry a LOCK-sourced
--      charge (no proposal): a nullable proposal_id, an event_vendor_id anchor, a
--      source discriminator, and the FROZEN free-5 decision on the ledger.
--   3. Adds booking_fee_open_lock_charge(event_vendor_id) — the LOCK twin of
--      booking_fee_open_charge. It resolves the fee from the couple-confirmed
--      event_vendors.total_cost_php, applies the FREE-5 courtesy (a verified
--      vendor's first 5 booked customers pay nothing), and opens exactly ONE live
--      charge per (vendor × event). Settlement reuses the existing
--      booking_fee_settle_charge unchanged.
--
-- Ships INERT: nothing calls booking_fee_open_lock_charge until the LOCK-path
-- wiring lands AND NEXT_PUBLIC_BOOKING_FEE_ENABLED is flipped. No money moves here.
--
-- FREE-5 is per VERIFIED vendor identity (vendor_profiles, the DTI+permit
-- reg-number anchor via event_vendors.marketplace_vendor_id). Off-platform /
-- manual vendors (marketplace_vendor_id IS NULL) are NEVER billed. The ordinal is
-- FROZEN on the ledger at first charge so a re-lock of the same event can never
-- double-count or shift a vendor across the 5/6 boundary; a per-vendor advisory
-- lock serialises ordinal assignment across concurrent first-locks.

BEGIN;

-- ── 1) Reprice booking_fee_centavos → flat 5%, ₱50 floor, NO cap ─────────────
-- Authoritative SQL mirror of apps/web/lib/booking-fee.ts (owner 2026-07-24).
-- 5% × ₱1,000 = ₱50, so the floor binds at/below ₱1,000; unbounded above.
-- Non-positive / NULL → 0 (the ₱0/barter case — no consideration, no fee).
CREATE OR REPLACE FUNCTION public.booking_fee_centavos(p_amount_centavos BIGINT)
RETURNS BIGINT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_amount_centavos IS NULL OR p_amount_centavos <= 0 THEN 0::BIGINT
    ELSE GREATEST(round(p_amount_centavos * 0.05)::BIGINT, 5000::BIGINT) -- 5%, ₱50 floor, no cap
  END;
$$;
COMMENT ON FUNCTION public.booking_fee_centavos(BIGINT) IS
  'Vendor Booking Fee (centavos) for an agreed amount (centavos). Flat 5%, floor '
  '₱50 (5000c), NO cap. Authoritative mirror of apps/web/lib/booking-fee.ts '
  '(owner-directed 2026-07-24; supersedes the flat-2%/₱4,000-cap schedule). '
  'Non-positive → 0.';

-- ── 2a) Ledger — LOCK source + frozen free-5 decision ────────────────────────
ALTER TABLE public.booking_fee_ledger
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'send'
    CHECK (source IN ('send', 'lock')),
  -- 1-based ordinal of this (vendor, event) among the vendor's LOCK bookings,
  -- FROZEN at first charge. NULL until first computed.
  ADD COLUMN IF NOT EXISTS booking_ordinal INTEGER
    CHECK (booking_ordinal IS NULL OR booking_ordinal >= 1),
  -- Frozen free-5 verdict (ordinal <= 5). NULL until first computed.
  ADD COLUMN IF NOT EXISTS is_free_booking BOOLEAN;

COMMENT ON COLUMN public.booking_fee_ledger.booking_ordinal IS
  'FROZEN 1-based rank of this (vendor,event) among the vendor''s lock bookings. '
  'Free-5: ordinal <= 5 → no fee. Immutable once set so a re-lock never shifts it.';

-- ── 2b) Charges — a LOCK charge has an event_vendor anchor, not a proposal ────
ALTER TABLE public.booking_fee_charges
  ALTER COLUMN proposal_id DROP NOT NULL;

ALTER TABLE public.booking_fee_charges
  ADD COLUMN IF NOT EXISTS event_vendor_id UUID
    REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'send'
    CHECK (source IN ('send', 'lock'));

-- A charge anchors to EITHER a proposal (send path) OR an event_vendor (lock path).
ALTER TABLE public.booking_fee_charges
  DROP CONSTRAINT IF EXISTS booking_fee_charges_anchor_ck;
ALTER TABLE public.booking_fee_charges
  ADD CONSTRAINT booking_fee_charges_anchor_ck
    CHECK (proposal_id IS NOT NULL OR event_vendor_id IS NOT NULL);

-- Extend the status set with waived_free5 (a free-5 lock → clears at amount 0,
-- distinct from waived_import so the audit trail says WHY it was free).
ALTER TABLE public.booking_fee_charges
  DROP CONSTRAINT IF EXISTS booking_fee_charges_status_check;
ALTER TABLE public.booking_fee_charges
  ADD CONSTRAINT booking_fee_charges_status_check
    CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'waived_import', 'waived_free5'));

-- One live (pending/paid/waived) charge per event_vendor — the LOCK idempotency
-- guard, mirroring booking_fee_charges_one_live_per_proposal.
CREATE UNIQUE INDEX IF NOT EXISTS booking_fee_charges_one_live_per_event_vendor
  ON public.booking_fee_charges(event_vendor_id)
  WHERE event_vendor_id IS NOT NULL
    AND status IN ('pending', 'paid', 'waived_import', 'waived_free5');

-- ── 3) RPC · open a LOCK charge for an event_vendor (idempotent) ─────────────
-- The LOCK twin of booking_fee_open_charge. Resolves the fee AUTHORITATIVELY from
-- the couple-confirmed event_vendors.total_cost_php, applies free-5, and opens at
-- most one live charge per (vendor, event). service_role-only — the lock action
-- calls it with the admin client.
--
-- Returns JSONB:
--   { skipped: 'not_found'|'not_verified_vendor'|'not_contracted' }  -- no charge
--   { charge_id, status, amount_charged_centavos, computed_fee_centavos,
--     booking_ordinal, is_free, reused }
CREATE OR REPLACE FUNCTION public.booking_fee_open_lock_charge(
  p_event_vendor_id  UUID,
  p_schedule_version TEXT DEFAULT '2026-07-24-flat5-nocap'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ev             RECORD;
  v_ledger         RECORD;
  v_existing       RECORD;
  v_fee            BIGINT;
  v_ordinal        INTEGER;
  v_is_free        BOOLEAN;
  v_status         TEXT;
  v_charge_amount  BIGINT;
  v_charge_id      UUID;
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

  -- Only a VERIFIED (marketplace-linked) vendor is billable. Off-platform /
  -- manual vendors carry no vendor_profiles identity → never a fee.
  IF v_ev.vpid IS NULL THEN
    RETURN jsonb_build_object('skipped', 'not_verified_vendor');
  END IF;

  -- The fee triggers only for a COMMITTED lock (contracted or past).
  IF v_ev.status NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete') THEN
    RETURN jsonb_build_object('skipped', 'not_contracted');
  END IF;

  -- Serialise ordinal assignment PER VENDOR so two concurrent first-locks (same
  -- vendor, different events) can't both read the same free-5 rank.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_ev.vpid::text, 0));

  -- Upsert the (vendor, event) ledger row. attribution is unused on the lock
  -- path (kept 'sourced' to satisfy the column default); free-5 replaces it.
  INSERT INTO public.booking_fee_ledger
    (vendor_profile_id, event_id, source, attribution, attribution_frozen_at,
     highest_declared_centavos)
  VALUES
    (v_ev.vpid, v_ev.event_id, 'lock', 'sourced', NOW(), v_ev.amount_centavos)
  ON CONFLICT (vendor_profile_id, event_id) DO UPDATE
    SET highest_declared_centavos =
          GREATEST(COALESCE(public.booking_fee_ledger.highest_declared_centavos, 0),
                   EXCLUDED.highest_declared_centavos),
        updated_at = NOW()
  RETURNING * INTO v_ledger;

  -- Freeze the free-5 verdict on first computation; reuse it forever after.
  IF v_ledger.booking_ordinal IS NULL THEN
    SELECT count(*) INTO v_ordinal
      FROM public.booking_fee_ledger l2
      WHERE l2.vendor_profile_id = v_ev.vpid
        AND l2.source = 'lock'
        AND (l2.created_at, l2.ledger_id) <= (v_ledger.created_at, v_ledger.ledger_id);
    v_is_free := v_ordinal <= 5;
    UPDATE public.booking_fee_ledger
      SET booking_ordinal = v_ordinal, is_free_booking = v_is_free, updated_at = NOW()
      WHERE ledger_id = v_ledger.ledger_id;
  ELSE
    v_ordinal := v_ledger.booking_ordinal;
    v_is_free := v_ledger.is_free_booking;
  END IF;

  -- Idempotent: a live charge already exists for this event_vendor → return it.
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
      'booking_ordinal', v_ordinal, 'is_free', v_is_free, 'reused', true);
  END IF;

  v_fee := public.booking_fee_centavos(v_ev.amount_centavos);

  IF v_is_free THEN
    v_status := 'waived_free5';  -- one of the vendor's first 5 booked customers
    v_charge_amount := 0;
  ELSIF v_fee <= 0 THEN
    v_status := 'paid';          -- ₱0 / barter booking → nothing to collect
    v_charge_amount := 0;
  ELSE
    v_status := 'pending';       -- 6th+ booking → collect 5% on the QR rail
    v_charge_amount := v_fee;
  END IF;

  INSERT INTO public.booking_fee_charges
    (ledger_id, proposal_id, event_vendor_id, source, vendor_profile_id, event_id,
     proposal_amount_centavos, computed_fee_centavos, amount_charged_centavos,
     schedule_version, status, paid_at, expires_at)
  VALUES
    (v_ledger.ledger_id, NULL, p_event_vendor_id, 'lock', v_ev.vpid, v_ev.event_id,
     v_ev.amount_centavos, v_fee, v_charge_amount, p_schedule_version, v_status,
     CASE WHEN v_status IN ('paid', 'waived_free5') THEN NOW() END,
     CASE WHEN v_status = 'pending' THEN NOW() + INTERVAL '7 days' END)
  RETURNING charge_id INTO v_charge_id;

  RETURN jsonb_build_object(
    'charge_id', v_charge_id, 'status', v_status,
    'amount_charged_centavos', v_charge_amount, 'computed_fee_centavos', v_fee,
    'booking_ordinal', v_ordinal, 'is_free', v_is_free, 'reused', false);
END;
$$;
COMMENT ON FUNCTION public.booking_fee_open_lock_charge(UUID, TEXT) IS
  'Open (or reuse) the single live LOCK Booking-Fee charge for an event_vendor. '
  'Fee base = couple-confirmed event_vendors.total_cost_php; free for a verified '
  'vendor''s first 5 booked customers. service_role-only.';

-- ── Grants — money writes are service_role-only ──────────────────────────────
REVOKE ALL ON FUNCTION public.booking_fee_open_lock_charge(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_open_lock_charge(UUID, TEXT) TO service_role;

COMMIT;

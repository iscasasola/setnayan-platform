-- Booking Fee · PR-3 — the fee ledger + charge tables + money RPCs.
--
-- The prepaid-gate data spine (Booking_Fee_Build_Plan §PR-3). Ships INERT: these
-- tables/RPCs exist but nothing writes to them until the send-action wiring lands
-- AND the NEXT_PUBLIC_BOOKING_FEE_ENABLED flag is flipped. No money moves here.
--
-- Cap UNIT = per vendor × event (owner 2026-07-23) → the ₱4,000 cap is enforced on
-- the booking_fee_ledger aggregate, keyed UNIQUE(vendor_profile_id, event_id).
-- Refund-on-walk-away resolved to NO REFUND (positioning doc 2026-07-22) → the
-- charge status set has no 'void'/'refunded'. Money is in CENTAVOS to match
-- vendor_proposals.total_centavos. Writes go through SECURITY DEFINER RPCs granted
-- to service_role only (the send action calls them with the admin client); clients
-- get SELECT-only RLS on their own rows, mirroring vendor_event_unlocks.

BEGIN;

-- ── Fee schedule (authoritative SQL mirror of apps/web/lib/booking-fee.ts) ────
-- Flat 2% of the proposal amount, floored at ₱50 (5000c), capped at ₱4,000
-- (400000c). Owner-directed 2026-07-23. Computed here so a caller can never
-- influence the amount; the TS function is for UI preview only. ₱0/non-positive → 0.
CREATE OR REPLACE FUNCTION public.booking_fee_centavos(p_amount_centavos BIGINT)
RETURNS BIGINT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_amount_centavos IS NULL OR p_amount_centavos <= 0 THEN 0::BIGINT
    ELSE LEAST(
           GREATEST(round(p_amount_centavos * 0.02)::BIGINT, 5000::BIGINT), -- ₱50 floor
           400000::BIGINT                                                    -- ₱4,000 cap
         )
  END;
$$;
COMMENT ON FUNCTION public.booking_fee_centavos(BIGINT) IS
  'Vendor Booking Fee (centavos) for a proposal amount (centavos). Flat 2%, floor '
  '₱50 (5000c), cap ₱4,000 (400000c). Authoritative mirror of '
  'apps/web/lib/booking-fee.ts (owner-directed 2026-07-23). Non-positive → 0.';

-- ── booking_fee_ledger — one row per (vendor_profile_id, event_id) ───────────
CREATE TABLE IF NOT EXISTS public.booking_fee_ledger (
  ledger_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id         UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  event_id                  UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- Frozen at first charge, immutable thereafter. import → fee always 0 (free forever).
  attribution               TEXT NOT NULL DEFAULT 'sourced' CHECK (attribution IN ('sourced', 'import')),
  attribution_thread_id     UUID REFERENCES public.chat_threads(thread_id) ON DELETE SET NULL,
  attribution_frozen_at     TIMESTAMPTZ,
  -- High-water mark: recorded (harmless) but delta-billing is NOT implemented — the
  -- high-water revision rule is an OPEN owner sign-off (#3m-b). Nullable, read-only.
  highest_declared_centavos BIGINT CHECK (highest_declared_centavos IS NULL OR highest_declared_centavos >= 0),
  fee_paid_total_centavos   BIGINT NOT NULL DEFAULT 0 CHECK (fee_paid_total_centavos >= 0),
  cap_reached_at            TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vendor_profile_id, event_id)
);
CREATE INDEX IF NOT EXISTS booking_fee_ledger_vendor_idx ON public.booking_fee_ledger(vendor_profile_id);
CREATE INDEX IF NOT EXISTS booking_fee_ledger_event_idx ON public.booking_fee_ledger(event_id);
ALTER TABLE public.booking_fee_ledger ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.booking_fee_ledger IS
  'Per (vendor, event) Booking-Fee aggregate — the ₱4,000 cap unit (owner 2026-07-23). '
  'Mirrors vendor_event_unlocks: SELECT-only for clients, written by service-role RPCs.';

-- ── booking_fee_charges — one row per SEND ATTEMPT ───────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_fee_charges (
  charge_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id                TEXT UNIQUE NOT NULL DEFAULT public.generate_public_id('F'),
  ledger_id                UUID NOT NULL REFERENCES public.booking_fee_ledger(ledger_id) ON DELETE CASCADE,
  proposal_id              UUID NOT NULL REFERENCES public.vendor_proposals(proposal_id) ON DELETE CASCADE,
  vendor_profile_id        UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  event_id                 UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  proposal_amount_centavos BIGINT NOT NULL CHECK (proposal_amount_centavos >= 0),
  computed_fee_centavos    BIGINT NOT NULL CHECK (computed_fee_centavos >= 0),
  amount_charged_centavos  BIGINT NOT NULL CHECK (amount_charged_centavos >= 0),
  schedule_version         TEXT NOT NULL,
  -- No 'void', no 'refunded' — refund-on-walk-away resolved to NO REFUND
  -- (positioning doc 2026-07-22). waived_import = free send (attribution='import'
  -- or cap already reached → amount 0).
  status                   TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'waived_import')),
  gateway                  TEXT,
  payment_ref              TEXT,
  paid_at                  TIMESTAMPTZ,
  failed_reason            TEXT,
  expires_at               TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS booking_fee_charges_proposal_idx ON public.booking_fee_charges(proposal_id);
CREATE INDEX IF NOT EXISTS booking_fee_charges_ledger_idx ON public.booking_fee_charges(ledger_id);
CREATE INDEX IF NOT EXISTS booking_fee_charges_vendor_idx ON public.booking_fee_charges(vendor_profile_id);
-- A proposal is billed at most once: only one live (pending/paid/waived_import)
-- charge per proposal. A failed/expired attempt does not block a fresh one.
CREATE UNIQUE INDEX IF NOT EXISTS booking_fee_charges_one_live_per_proposal
  ON public.booking_fee_charges(proposal_id)
  WHERE status IN ('pending', 'paid', 'waived_import');
ALTER TABLE public.booking_fee_charges ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.booking_fee_charges IS
  'One row per proposal SEND attempt. The prepaid gate: a proposal may only send '
  'once a paid/waived_import charge exists for it. No refund/void state.';

-- ── RLS — SELECT-only for clients (vendor own + admin); writes via RPCs ───────
DROP POLICY IF EXISTS booking_fee_ledger_vendor_read ON public.booking_fee_ledger;
CREATE POLICY booking_fee_ledger_vendor_read ON public.booking_fee_ledger
  FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS booking_fee_ledger_admin_read ON public.booking_fee_ledger;
CREATE POLICY booking_fee_ledger_admin_read ON public.booking_fee_ledger
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS booking_fee_charges_vendor_read ON public.booking_fee_charges;
CREATE POLICY booking_fee_charges_vendor_read ON public.booking_fee_charges
  FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS booking_fee_charges_admin_read ON public.booking_fee_charges;
CREATE POLICY booking_fee_charges_admin_read ON public.booking_fee_charges
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ── RPC · open a charge for a proposal (idempotent) ──────────────────────────
-- Resolves the fee AUTHORITATIVELY from the proposal amount, upserts the ledger
-- (freezing attribution on first insert), and opens exactly one live charge per
-- proposal. sourced+fee>0 → 'pending' (awaits payment); import or cap-reached →
-- amount 0 and immediately clear ('waived_import'/'paid'). Charge amount is
-- LEAST(fee, remaining cap) so the aggregate never exceeds ₱4,000. p_attribution
-- and p_thread_id are resolved server-side by the send action (this RPC is
-- service_role-only, never client-callable, so those inputs are trusted).
CREATE OR REPLACE FUNCTION public.booking_fee_open_charge(
  p_proposal_id     UUID,
  p_attribution     TEXT DEFAULT 'sourced',
  p_thread_id       UUID DEFAULT NULL,
  p_schedule_version TEXT DEFAULT '2026-07-23-flat2'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal RECORD;
  v_ledger   RECORD;
  v_existing RECORD;
  v_fee            BIGINT;
  v_remaining      BIGINT;
  v_charge_amount  BIGINT;
  v_status         TEXT;
  v_charge_id      UUID;
BEGIN
  SELECT vendor_profile_id, event_id, COALESCE(total_centavos, 0) AS amount
    INTO v_proposal
    FROM public.vendor_proposals
    WHERE proposal_id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'proposal_not_found';
  END IF;

  -- Upsert the ledger; attribution + freeze stamp only on first insert.
  INSERT INTO public.booking_fee_ledger
    (vendor_profile_id, event_id, attribution, attribution_thread_id,
     attribution_frozen_at, highest_declared_centavos)
  VALUES
    (v_proposal.vendor_profile_id, v_proposal.event_id,
     CASE WHEN p_attribution = 'import' THEN 'import' ELSE 'sourced' END,
     p_thread_id, NOW(), v_proposal.amount)
  ON CONFLICT (vendor_profile_id, event_id) DO UPDATE
    SET highest_declared_centavos =
          GREATEST(COALESCE(public.booking_fee_ledger.highest_declared_centavos, 0),
                   EXCLUDED.highest_declared_centavos),
        updated_at = NOW()
  RETURNING * INTO v_ledger;

  -- Idempotent: a live charge already exists for this proposal → return it.
  SELECT charge_id, status, amount_charged_centavos, computed_fee_centavos
    INTO v_existing
    FROM public.booking_fee_charges
    WHERE proposal_id = p_proposal_id
      AND status IN ('pending', 'paid', 'waived_import')
    LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'charge_id', v_existing.charge_id, 'status', v_existing.status,
      'amount_charged_centavos', v_existing.amount_charged_centavos,
      'computed_fee_centavos', v_existing.computed_fee_centavos,
      'attribution', v_ledger.attribution, 'reused', true);
  END IF;

  v_fee := public.booking_fee_centavos(v_proposal.amount);
  v_remaining := GREATEST(0, 400000 - v_ledger.fee_paid_total_centavos);
  v_charge_amount := LEAST(v_fee, v_remaining);

  IF v_ledger.attribution = 'import' THEN
    v_status := 'waived_import';
    v_charge_amount := 0;
  ELSIF v_charge_amount <= 0 THEN
    v_status := 'paid';        -- cap reached or fee 0 → nothing to collect
    v_charge_amount := 0;
  ELSE
    v_status := 'pending';
  END IF;

  INSERT INTO public.booking_fee_charges
    (ledger_id, proposal_id, vendor_profile_id, event_id, proposal_amount_centavos,
     computed_fee_centavos, amount_charged_centavos, schedule_version, status,
     paid_at, expires_at)
  VALUES
    (v_ledger.ledger_id, p_proposal_id, v_proposal.vendor_profile_id, v_proposal.event_id,
     v_proposal.amount, v_fee, v_charge_amount, p_schedule_version, v_status,
     CASE WHEN v_status IN ('paid', 'waived_import') THEN NOW() END,
     CASE WHEN v_status = 'pending' THEN NOW() + INTERVAL '7 days' END)
  RETURNING charge_id INTO v_charge_id;

  RETURN jsonb_build_object(
    'charge_id', v_charge_id, 'status', v_status,
    'amount_charged_centavos', v_charge_amount, 'computed_fee_centavos', v_fee,
    'attribution', v_ledger.attribution, 'reused', false);
END;
$$;
COMMENT ON FUNCTION public.booking_fee_open_charge(UUID, TEXT, UUID, TEXT) IS
  'Open (or reuse) the single live Booking-Fee charge for a proposal. '
  'service_role-only — the send action calls it with the admin client.';

-- ── RPC · settle a pending charge as paid (idempotent) ───────────────────────
-- Called from the gateway/admin confirmation path (mirrors approve_* RPCs). Flips
-- pending → paid and rolls the paid amount into the ledger (setting cap_reached_at
-- when the aggregate hits ₱4,000). Idempotent: a non-pending charge is a no-op.
CREATE OR REPLACE FUNCTION public.booking_fee_settle_charge(
  p_charge_id   UUID,
  p_gateway     TEXT DEFAULT NULL,
  p_payment_ref TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charge RECORD;
BEGIN
  UPDATE public.booking_fee_charges
    SET status = 'paid', gateway = p_gateway, payment_ref = p_payment_ref,
        paid_at = NOW(), updated_at = NOW()
    WHERE charge_id = p_charge_id AND status = 'pending'
    RETURNING * INTO v_charge;
  IF NOT FOUND THEN
    SELECT status INTO v_charge FROM public.booking_fee_charges WHERE charge_id = p_charge_id;
    RETURN jsonb_build_object('charge_id', p_charge_id,
      'status', COALESCE(v_charge.status, 'unknown'), 'settled', false);
  END IF;

  UPDATE public.booking_fee_ledger
    SET fee_paid_total_centavos = fee_paid_total_centavos + v_charge.amount_charged_centavos,
        cap_reached_at = CASE
          WHEN fee_paid_total_centavos + v_charge.amount_charged_centavos >= 400000
               AND cap_reached_at IS NULL THEN NOW()
          ELSE cap_reached_at END,
        updated_at = NOW()
    WHERE ledger_id = v_charge.ledger_id;

  RETURN jsonb_build_object('charge_id', p_charge_id, 'status', 'paid', 'settled', true);
END;
$$;
COMMENT ON FUNCTION public.booking_fee_settle_charge(UUID, TEXT, TEXT) IS
  'Mark a pending Booking-Fee charge paid + roll it into the ledger. '
  'service_role-only; idempotent (non-pending → no-op).';

-- ── RPC · is a proposal cleared to send? (read-only gate check) ──────────────
CREATE OR REPLACE FUNCTION public.booking_fee_proposal_cleared(p_proposal_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.booking_fee_charges
    WHERE proposal_id = p_proposal_id AND status IN ('paid', 'waived_import')
  );
$$;
COMMENT ON FUNCTION public.booking_fee_proposal_cleared(UUID) IS
  'TRUE iff a paid/waived_import Booking-Fee charge exists for the proposal — the '
  'send-gate predicate. Read-only.';

-- ── Grants — money writes are service_role-only; reads for the gate ──────────
REVOKE ALL ON FUNCTION public.booking_fee_open_charge(UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_open_charge(UUID, TEXT, UUID, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.booking_fee_settle_charge(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_fee_settle_charge(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.booking_fee_centavos(BIGINT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.booking_fee_proposal_cleared(UUID) TO authenticated, service_role;

COMMIT;

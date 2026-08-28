-- a_shop_can_ask_for_a_payment
-- ============================================================================
-- THE SHOP CAN ASK A BOOKED CUSTOMER FOR MONEY — from the page where it already
-- sees the balance. (S4, shop redesign, 2026-08-28.)
--
-- ── WHAT DID NOT EXIST ─────────────────────────────────────────────────────
-- Grepped before a line of this was written: nothing anywhere lets a SUPPLIER
-- ask a COUPLE for a payment. `requestPaymentResubmit` is Setnayan asking a
-- buyer to re-upload proof of a payment to US, on an `orders` row. The couple
-- authors the installment plan (`event_vendor_payment_plan`, host-RLS, frozen
-- at lock from the shop's own service schedule); the shop can CONFIRM receipt
-- (`confirm_vendor_payment`) and READ the timeline (`vendor_payday_installments`).
-- What is missing is the ad-hoc sentence in between: "please send ₱X now."
--
-- ── WHY IT IS NOT A CHANGE ORDER, AND WHY THAT MATTERS ─────────────────────
-- `vendor_change_orders` (20270320861005) is the closest shipped thing and its
-- SHAPE is copied here on purpose — propose → withdraw, RLS at CREATE, no
-- UPDATE policy on either side, resolution only through a SECURITY DEFINER
-- single-winner RPC. What is deliberately NOT copied is its SETTLEMENT: a
-- change order accepts into `event_vendor_line_items` because it CHANGES WHAT
-- IS OWED. A payment ask changes nothing — it asks for a slice of a figure both
-- parties already agreed. 🔑 IF AN ASK EVER WROTE A LEDGER LINE IT WOULD DOUBLE
-- THE COUPLE'S TOTAL. There is no ledger write in this file, and there must
-- never be one.
--
-- ── OFF-PLATFORM MONEY, UNCHANGED ──────────────────────────────────────────
-- Setnayan never holds these funds and this table moves none. `amount_php` is a
-- figure the shop typed. No gateway, no receipt, no tax, no commission. The
-- money itself still arrives the way it always did and is still confirmed
-- through the existing ledger path.
--
-- ── THE INVERSE SHIPS IN THE SAME MIGRATION ────────────────────────────────
-- 🔑 A FORWARD PRIMITIVE WITH NO INVERSE is a defect this repo has paid for
-- more than once (the auto-block that closed a booked date and could never be
-- removed). An ask is a thing one person says to another about money; the shop
-- must be able to take it back the moment it is settled or was a mistake. The
-- withdraw RPC is written here, granted here, and called by the same PR.
--
-- ── WHAT IT DOES **NOT** DO, said out loud ─────────────────────────────────
-- ⛔ It does not close itself when money arrives. Auto-matching a confirmed
-- payment to an ask would be a second money rule sitting beside the ledger's,
-- and two copies of a money rule always drift. The shop withdraws it.
-- ⛔ It does not chase. No sweeper, no expiry, no reminder — this project is
-- cron-free and an ask that nags on a schedule nobody chose is not in scope.
--
-- BARE migration (no BEGIN/COMMIT): `ALTER TYPE … ADD VALUE` cannot run inside
-- an explicit transaction block — the same reason 20270202160005 is bare. Every
-- statement auto-commits; CREATE TABLE / CREATE POLICY are safe without one.
-- Idempotent + re-run safe.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · notification_type — the couple has to be TOLD, or this is a page nobody
--     opens. A label the enum has never heard of is REFUSED, NOT THROWN:
--     `emitNotification` logs and carries on, the action completes, CI is
--     green, and the notice silently reaches nobody. Three types shipped that
--     way before `every-notice-type-exists-in-the-database.test.ts` was written.
-- ----------------------------------------------------------------------------
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'vendor_payment_asked';

-- ----------------------------------------------------------------------------
-- 2 · vendor_payment_asks — one row per ask. RLS + policies IN THIS MIGRATION
--     (RLS-at-CREATE-TABLE, the repo's standing rule).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_payment_asks (
  ask_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The booking this is about. `event_vendors`' primary key is `vendor_id`.
  event_vendor_id   UUID NOT NULL
                    REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,
  -- The couple-RLS anchor.
  event_id          UUID NOT NULL
                    REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- Denormalized so the vendor-side policy can be a plain set-membership test
  -- rather than a join, exactly as vendor_change_orders does it.
  vendor_profile_id UUID NOT NULL
                    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- A figure the shop typed. Always positive: an ask is never a credit — that
  -- is what a change order is for.
  amount_php        NUMERIC(12,2) NOT NULL CHECK (amount_php > 0),
  -- What it is for, in the shop's own words. The couple reads this verbatim.
  note              TEXT CHECK (note IS NULL OR char_length(btrim(note)) BETWEEN 1 AND 500),
  -- When the shop would like it. Advisory only — nothing enforces it.
  due_date          DATE,
  status            TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'withdrawn')),
  asked_by_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  withdrawn_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The state and its receipt cannot disagree. Same coherence shape the lock
  -- request carries, and the reason a stale timestamp can never be read as a
  -- live state.
  CONSTRAINT vendor_payment_asks_withdrawn_coherence_chk
    CHECK ((status <> 'withdrawn') OR (withdrawn_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS vendor_payment_asks_booking_idx
  ON public.vendor_payment_asks (event_vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vendor_payment_asks_event_idx
  ON public.vendor_payment_asks (event_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS vendor_payment_asks_vendor_idx
  ON public.vendor_payment_asks (vendor_profile_id, status, created_at DESC);

ALTER TABLE public.vendor_payment_asks ENABLE ROW LEVEL SECURITY;

-- 🔒 A NEW TABLE IN `public` IS BORN OPEN, NOT CLOSED. `ALTER DEFAULT
-- PRIVILEGES` in this schema grants `arwdDxtm` to BOTH `anon` and
-- `authenticated` on every newly created relation — measured in prod during
-- this migration's own rolled-back dry run: the table came into existence with
-- SEVEN table-level grants to `anon`. RLS with no anon policy means anon reads
-- zero rows, but a grant nobody revoked is exactly the shape that produced
-- "361 of 368 tables grant SELECT+INSERT to anon". Revoke first, then grant
-- back only the two verbs the shipped paths use.
--
-- 🔑 REVOKED AT TABLE LEVEL, WHICH IS WHAT ALSO DROPS COLUMN GRANTS. A
-- column-by-column revoke leaves the NEXT column granted, and
-- `has_table_privilege` answers FALSE while column grants stand — a table-level
-- audit then reads the table as closed while it is open.
REVOKE ALL ON public.vendor_payment_asks FROM PUBLIC;
REVOKE ALL ON public.vendor_payment_asks FROM anon;
REVOKE ALL ON public.vendor_payment_asks FROM authenticated;

-- SELECT + INSERT only. There is deliberately NO UPDATE or DELETE grant: the
-- withdraw RPC below runs SECURITY DEFINER and needs none, so even a permissive
-- UPDATE policy added here by mistake later could not be exercised. Two fences,
-- and the outer one does not depend on somebody reading the inner one.
GRANT SELECT, INSERT ON public.vendor_payment_asks TO authenticated;

-- SHOP — read its own asks. `current_vendor_booked_event_ids()` already
-- requires a CONFIRMED booking, so an ask cannot exist, or be read, on a
-- celebration this shop was never booked for.
DROP POLICY IF EXISTS vendor_payment_asks_vendor_read ON public.vendor_payment_asks;
CREATE POLICY vendor_payment_asks_vendor_read
  ON public.vendor_payment_asks FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
  );

-- SHOP — raise one.
--
-- 🔒 THE ROW IS YOURS, THE FIELD IS NOT — the ninth-and-counting instance in
-- this schema. `authenticated` will hold INSERT on every column of this table,
-- and PostgREST serves it at /rest/v1/vendor_payment_asks to a public anon key,
-- so "our server action always sets it correctly" is not a defence. The WITH
-- CHECK therefore pins every field that records WHO DID THIS and WHAT STATE IT
-- IS IN — `status` must be 'open' (a shop cannot post an already-withdrawn ask
-- into somebody's history) and `asked_by_user_id` must be the caller (a shop
-- cannot sign an ask in a teammate's name).
DROP POLICY IF EXISTS vendor_payment_asks_vendor_insert ON public.vendor_payment_asks;
CREATE POLICY vendor_payment_asks_vendor_insert
  ON public.vendor_payment_asks FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    AND status = 'open'
    AND withdrawn_at IS NULL
    AND asked_by_user_id = auth.uid()
  );

-- COUPLE + their delegates — read what was asked OF THEM. Read only: there is
-- no couple INSERT and no couple UPDATE policy anywhere in this file, so a
-- couple can neither invent an ask against themselves nor make one disappear.
DROP POLICY IF EXISTS vendor_payment_asks_couple_read ON public.vendor_payment_asks;
CREATE POLICY vendor_payment_asks_couple_read
  ON public.vendor_payment_asks FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR event_id IN (SELECT public.current_moderator_event_ids())
  );

-- SETNAYAN — read, for the disputes console. An ask is evidence in exactly the
-- argument /admin/disputes exists to settle.
DROP POLICY IF EXISTS vendor_payment_asks_admin_read ON public.vendor_payment_asks;
CREATE POLICY vendor_payment_asks_admin_read
  ON public.vendor_payment_asks FOR SELECT TO authenticated
  USING (public.is_admin());

-- ⛔ THERE IS NO UPDATE POLICY AND NO DELETE POLICY, FOR ANYBODY. Withdrawal
-- flows only through the SECURITY DEFINER RPC below — the single writer of a
-- resolved state. Adding a permissive UPDATE here would hand the shop the
-- ability to rewrite an amount after the couple had read it.

COMMENT ON TABLE public.vendor_payment_asks IS
  'A shop asking a BOOKED customer for a payment (S4, 2026-08-28). Off-platform money: Setnayan holds nothing and this table moves nothing -- amount_php is a figure the shop typed about money the couple pays the shop directly. Shape copied from vendor_change_orders (RLS at create, no UPDATE/DELETE policy on either side, resolution only via a SECURITY DEFINER single-winner RPC); its SETTLEMENT is deliberately NOT copied -- a change order writes event_vendor_line_items because it changes what is owed, an ask does not and must never write a ledger line or it would double the couple''s total. Insert is gated to a confirmed booking of a profile the caller owns/administers, with status and asked_by_user_id pinned in the WITH CHECK. Nothing sweeps, expires or auto-closes an ask; the shop withdraws it.';

COMMENT ON COLUMN public.vendor_payment_asks.status IS
  'open | withdrawn. There is no ''paid'' value ON PURPOSE: whether money arrived is the LEDGER''s fact (event_vendor_payments + vendor_confirmed_at), and a second copy of that answer living here would drift from it.';

-- ----------------------------------------------------------------------------
-- 3 · withdraw_vendor_payment_ask — the inverse. Single-winner + idempotent,
--     modelled on respond_vendor_proposal / acknowledge_vendor_deposit /
--     withdraw_change_order: ownership gate → SELECT … FOR UPDATE → status
--     precondition → atomic UPDATE repeating the precondition in the WHERE →
--     ROW_COUNT → a re-call on an already-withdrawn ask returns its state
--     rather than an error.
--
-- 🔑 IT IS GATED ON `auth.uid()`, SO IT MUST BE CALLED ON THE CALLER'S OWN
-- SESSION. The service-role client carries no user, `auth.uid()` is NULL, and
-- every ownership test below fails — the feature would look finished and refuse
-- every withdrawal in production. That exact defect was caught by a guard in
-- this repo one day before this file was written.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.withdraw_vendor_payment_ask(
  p_ask_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status            TEXT;
  v_vendor_profile_id UUID;
  v_owns              BOOLEAN;
  v_rows              INT;
BEGIN
  IF p_ask_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT a.status, a.vendor_profile_id
    INTO v_status, v_vendor_profile_id
  FROM public.vendor_payment_asks a
  WHERE a.ask_id = p_ask_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- Ownership: the shop that raised it (its owner or an admin-rank teammate).
  -- Deliberately the SAME set the INSERT policy uses, so whoever could create
  -- an ask can take it back.
  SELECT EXISTS (
    SELECT 1 FROM public.current_vendor_profile_ids() AS id
    WHERE id = v_vendor_profile_id
  ) INTO v_owns;

  IF NOT v_owns THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_yours');
  END IF;

  -- Idempotent: withdrawing an already-withdrawn ask is a no-op that reports
  -- the state, never an error a person has to interpret.
  IF v_status = 'withdrawn' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'withdrawn', 'already', true);
  END IF;

  UPDATE public.vendor_payment_asks
     SET status = 'withdrawn',
         withdrawn_at = NOW(),
         updated_at = NOW()
   WHERE ask_id = p_ask_id
     AND status = 'open';
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    -- Somebody else won the race between the SELECT and here.
    RETURN jsonb_build_object('ok', true, 'status', 'withdrawn', 'already', true);
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', 'withdrawn', 'already', false);
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_vendor_payment_ask(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.withdraw_vendor_payment_ask(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.withdraw_vendor_payment_ask(UUID) TO authenticated;

COMMENT ON FUNCTION public.withdraw_vendor_payment_ask(UUID) IS
  'Take back a payment ask. The ONLY writer of a resolved state on vendor_payment_asks -- neither side holds an UPDATE policy. Single-winner (SELECT FOR UPDATE + the status precondition repeated in the UPDATE WHERE) and idempotent (a second call returns already=true, never an error). Ownership is the SAME set the INSERT policy admits: the profile owner or an admin-rank teammate, resolved from auth.uid() -- so it MUST be called on the caller''s own session; on the service-role client auth.uid() is NULL and every withdrawal is refused.';

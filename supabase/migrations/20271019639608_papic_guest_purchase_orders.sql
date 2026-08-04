-- papic_guest_purchase_orders
-- ============================================================================
-- GUESTS CAN BUY PAPIC (owner-locked 2026-07-29, DECISION_LOG last row).
--
-- A guest at the party — someone holding a camera QR, with no Setnayan account
-- and no intention of making one — can buy shots for the event they are
-- standing in:
--
--   • POOL TOP-UP  → +3,000 / +6,000 / +10,000 points into the event's SHARED
--                    pool (PAPIC_GUEST · PAPIC_GUEST_6K · PAPIC_GUEST_10K).
--   • ONE RELOAD   → 50 / 100 points onto THEIR OWN Papic One camera
--                    (PAPIC_CAMERA_MINI_DAY · PAPIC_ONE_100).
--
-- Same rungs, same prices the host pays. No new SKUs, no catalog change: this
-- migration adds no prices and no service codes.
--
-- ── THE ONE THING THIS MIGRATION ACTUALLY CHANGES ──────────────────────────
-- The 0034 payments spine assumes a CUSTOMER-OWNED order:
-- `orders.user_id NOT NULL REFERENCES public.users`. A camera holder is not a
-- user — they hold a wedding-scoped seat session (a QR claim), or a guest-QR
-- cookie, and neither is guaranteed a row in `public.users`. So `user_id`
-- becomes NULLABLE on the three money tables, and a new side table carries the
-- owner axis that replaces it.
--
-- WHY NULLABLE AND NOT A SECOND ORDER TABLE: the admin must not get a second
-- inbox. A guest order is an ORDINARY `orders` + `payments` pair, so it shows up
-- in /admin/payments with no reader change, and inherits — for free, and
-- unforkably — the shortfall guard (`orderGrossOwed` + `orderReconciledToPaid`),
-- the promote-to-paid gate, the receipt issuance, and `activateOrderSku`. A
-- parallel table would have had to re-implement every one of those, and the one
-- it got wrong would be the one that provisions on a short payment.
--
-- ── WHY A NULL user_id IS SAFE ON A TABLE WITH RLS ─────────────────────────
-- Both order policies are `user_id = auth.uid()`. Against NULL that predicate
-- evaluates to NULL, which is not TRUE, so a guest order is invisible to EVERY
-- session role and un-writable by them — strictly tighter than an owned row,
-- not looser. The same holds for `payments_owner_read` / `payments_owner_insert`
-- and `receipts`. And INSERT on orders/payments is already revoked from
-- `authenticated`/`anon` outright (SEC-4b, 20271008178212) with a BEFORE INSERT
-- caller guard on top, so a NULL-user order can only ever be minted by the
-- server. Nothing here re-grants any of that; the post-condition asserts it.
--
-- ── THE OWNER AXIS ─────────────────────────────────────────────────────────
-- "At least one owner is present" cannot be a CHECK on `orders`: the owner of a
-- guest order lives in another table, and the two rows are written by two
-- statements (the same two-step + compensate shape the shipped host path
-- `purchasePapicOneCamera` uses for its `papic_one_orders` row). So the axis is
-- asserted where it IS expressible:
--
--   1. HERE, on papic_guest_orders: `seat_id IS NOT NULL OR guest_id IS NOT
--      NULL` — a guest order row cannot exist without naming who bought it, and
--      a One reload additionally cannot exist without naming a camera.
--   2. IN CODE, in lib/order-mint-identity.ts (`guestOrderRowFor`), which
--      refuses to build the payload at all unless an event plus one owner axis
--      resolved — the same fail-closed posture `orderRowFor` has for `userId`.
--   3. The buy action cancels the order when the provenance row fails to land,
--      so a NULL-user order never survives without its owner.
--
-- ── HOW POINTS GET GRANTED (no change to the activation dispatcher) ────────
-- Deliberately none. A guest POOL top-up is a PAPIC_GUEST* order, which
-- lib/sku-activation.ts already routes to `grantPapicPassPoints` → an unscoped
-- (seat_id IS NULL) grant, i.e. the SHARED pool. A guest ONE reload additionally
-- writes the SAME `papic_one_orders` row the host path writes, which
-- `papic_grant_camera_points` already reads to make a SEAT-SCOPED grant. Both
-- fire only from `approvePaymentCore`, and only when the order reached 'paid' —
-- the admin-approval gate stands untouched (owner-locked: points are granted on
-- APPROVAL, never on submission, never on screenshot upload).
--
-- Idempotent: DROP NOT NULL is a no-op once dropped, and every object is
-- IF NOT EXISTS.
-- ============================================================================

BEGIN;

-- ── 1 · the money tables learn that an order can have no account ────────────
ALTER TABLE public.orders   ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.payments ALTER COLUMN user_id DROP NOT NULL;
-- receipts too: `issueReceiptForOrder` copies orders.user_id onto the receipt,
-- and a guest order must still produce the receipt artifact the spine produces
-- (BIR: the payer name is a free-text field on the payment form; an anonymous
-- receipt reads "Guest of <event>" pending accountant sign-off — documented, not
-- blocked, per the standing interim-payments default).
ALTER TABLE public.receipts ALTER COLUMN user_id DROP NOT NULL;

COMMENT ON COLUMN public.orders.user_id IS
  'The buying account, or NULL for a GUEST order minted from a Papic capture '
  'surface by someone with no Setnayan account (owner-locked 2026-07-29). A NULL '
  'here is not "unknown" - it is "there is no account", and the owner lives in '
  'public.papic_guest_orders. Both orders policies are user_id = auth.uid(), so a '
  'NULL-user order is invisible to every session role; INSERT is service-role-only '
  '(SEC-4b, 20271008178212). Never write NULL from a path that has a real buyer.';

COMMENT ON COLUMN public.payments.user_id IS
  'The paying account, or NULL when the order it settles is a guest order with no '
  'account behind it. Same visibility consequence as orders.user_id: NULL rows are '
  'unreadable by every session role, and only the admin queue (service-role) sees them.';

COMMENT ON COLUMN public.receipts.user_id IS
  'NULL for a guest order (no account exists). issued_to_email / issued_to_name '
  'still carry whatever the payer typed on the payment form.';

-- ── 2 · papic_guest_orders — who bought it, and what it is for ──────────────
-- One row per guest order. Carries three things `orders` cannot:
--   • the OWNER AXIS (seat or guest) that replaces the missing user_id;
--   • the ACCESS TOKEN, which is how an account-less buyer reaches their own
--     payment instructions and uploads their proof — they cannot read `orders`
--     under RLS, so the capability has to be a bearer token scoped to ONE order
--     rather than an event or seat id anybody could type;
--   • the SNAPSHOTTED points, for the same reason papic_one_orders snapshots
--     them: an admin editing a rung tomorrow must not silently reprice an order
--     already sitting in reconciliation today.
CREATE TABLE IF NOT EXISTS public.papic_guest_orders (
  order_id      UUID PRIMARY KEY REFERENCES public.orders(order_id) ON DELETE CASCADE,
  event_id      UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- The camera seat the buyer was holding, NULL when they bought from the
  -- guest-QR camera, which has a guest identity and no seat.
  seat_id       UUID REFERENCES public.paparazzi_seats(seat_id) ON DELETE SET NULL,
  -- The guest-QR identity (public.guests) when the buy came from /papic/guest.
  guest_id      UUID REFERENCES public.guests(guest_id) ON DELETE SET NULL,
  purchase_kind TEXT NOT NULL,
  service_code  TEXT NOT NULL,
  points        INTEGER NOT NULL,
  -- "Name for your receipt - optional". Free text, never an identity claim.
  payer_name    TEXT,
  access_token  TEXT NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT papic_guest_orders_kind_chk
    CHECK (purchase_kind IN ('pool_topup', 'one_reload')),
  CONSTRAINT papic_guest_orders_points_chk
    CHECK (points > 0),
  -- THE OWNER AXIS. Without this a guest order could exist with nobody attached
  -- to it, which is the state the removed `user_id NOT NULL` used to make
  -- impossible.
  CONSTRAINT papic_guest_orders_owner_axis_chk
    CHECK (seat_id IS NOT NULL OR guest_id IS NOT NULL),
  -- A reload has to name the camera it reloads. "Reload, but we do not know
  -- which camera" is an order the approval hook could not fulfil.
  CONSTRAINT papic_guest_orders_reload_needs_seat_chk
    CHECK (purchase_kind <> 'one_reload' OR seat_id IS NOT NULL),
  CONSTRAINT papic_guest_orders_access_token_len_chk
    CHECK (length(access_token) >= 24)
);

CREATE INDEX IF NOT EXISTS papic_guest_orders_event_idx ON public.papic_guest_orders(event_id);
CREATE INDEX IF NOT EXISTS papic_guest_orders_seat_idx  ON public.papic_guest_orders(seat_id);
CREATE INDEX IF NOT EXISTS papic_guest_orders_guest_idx ON public.papic_guest_orders(guest_id);

-- RLS at CREATE TABLE time, and no policies at all: this table is read and
-- written by the server only. The bearer token is checked in the action, NOT by
-- a policy — a policy would need the token in its predicate, which would mean
-- shipping it to the browser's PostgREST session, which is the thing we are
-- avoiding.
ALTER TABLE public.papic_guest_orders ENABLE ROW LEVEL SECURITY;

-- Every new table in `public` ships OPEN: the default ACL grants the full
-- `arwdDxtm` to anon + authenticated, which is the documented root cause of a
-- past 368-table exposure. The REVOKE is not optional and not redundant.
REVOKE ALL ON public.papic_guest_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.papic_guest_orders TO service_role;

COMMENT ON TABLE public.papic_guest_orders IS
  'Guest-bought Papic (owner-locked 2026-07-29). One row per order minted from a '
  'capture surface by someone with no account: the owner axis (seat or guest) that '
  'replaces orders.user_id, the bearer access_token that lets them reach their own '
  'payment instructions, and the snapshotted points. Read on approval only through '
  'the ORDER (service_key -> grantPapicPassPoints for a pool top-up; the sibling '
  'papic_one_orders row -> papic_grant_camera_points for a One reload), which is '
  'why the activation dispatcher needed no change.';

COMMENT ON COLUMN public.papic_guest_orders.access_token IS
  'Unguessable bearer capability for ONE order - the account-less equivalent of '
  'orders_owner_read. Long random (>= 24 chars enforced); never derived from the '
  'reference code, the seat token or the event id, so holding one grants nothing '
  'beyond its own order and nothing can be enumerated from it.';

COMMENT ON COLUMN public.papic_guest_orders.seat_id IS
  'The camera the buyer was holding. For purchase_kind = one_reload this is ALSO '
  'the camera being reloaded, and the action proves the caller holds that exact '
  'seat before writing it - a guest can never reload somebody elses camera.';

COMMENT ON COLUMN public.papic_guest_orders.payer_name IS
  'Optional free text from "Name for your receipt". Display + BIR only. Never used '
  'to authorize anything and never matched against a user.';

COMMIT;

-- ----------------------------------------------------------------------------
-- Post-conditions. Loud, so a half-applied migration cannot pass for applied
-- (schema_migrations has recorded APPLIED while objects never landed before).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  bad TEXT[] := ARRAY[]::TEXT[];
  t   TEXT;
  r   TEXT;
  p   TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['orders', 'payments', 'receipts'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = t
         AND column_name = 'user_id' AND is_nullable = 'NO'
    ) THEN
      bad := array_append(bad, format('public.%s.user_id is still NOT NULL', t));
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = 'papic_guest_orders' AND c.relrowsecurity
  ) THEN
    bad := array_append(bad, 'papic_guest_orders missing or RLS disabled');
  END IF;

  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH p IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
      IF has_table_privilege(r, 'public.papic_guest_orders', p) THEN
        bad := array_append(bad, format('%s still holds %s on papic_guest_orders', r, p));
      END IF;
    END LOOP;
  END LOOP;

  -- the SEC-4b lock must be untouched by this migration
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH t IN ARRAY ARRAY['public.orders', 'public.payments'] LOOP
      IF has_table_privilege(r, t, 'INSERT') THEN
        bad := array_append(bad, format('SEC-4b REGRESSION: %s can INSERT into %s', r, t));
      END IF;
    END LOOP;
  END LOOP;

  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'papic_guest_orders post-condition failed: %', array_to_string(bad, ', ');
  END IF;
END $$;

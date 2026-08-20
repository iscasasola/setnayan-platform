-- An unpaid order stops waiting forever.
--
-- OWNER RULING 2026-08-20: an order that is never paid cancels itself after
-- FIFTEEN days, the customer is warned before it does, and it is CANCELLED —
-- not deleted — so somebody who paid late can still be shown what happened.
--
-- WHY 15 AND NOT 7. Philippine payroll lands on the 15th and the 30th, so a
-- fifteen-day window always contains exactly one payday whatever day the order
-- is placed. A seven-day window can miss both. And the expensive failure here
-- is not an order lingering — an unpaid order unlocks nothing and merely sits —
-- it is MONEY ARRIVING AGAINST AN ORDER THAT ALREADY CANCELLED ITSELF. Shorter
-- windows make that more likely, so the window is deliberately generous.
--
-- ⚠ payment_due_at IS NOT orders.expires_at. That column already exists and
-- means the SUBSCRIPTION TERM ending ("sweep flips paid → lapsed"). Overloading
-- it would give one column two meanings and break the subscription sweep the
-- first time a customer paid late. Two clocks, two columns.
--
-- 🔑 THE DEFAULT IS THE MECHANISM, NOT A CONVENIENCE. Orders are created from
-- several paths (checkout, the Papic buy flow, the onboarding mint, vendor
-- billing). Stamping the deadline in application code would mean finding every
-- one of them, and the path somebody forgets is the one that never expires —
-- this repo's "gate with no handle" failure, where a column exists, is read
-- everywhere and written nowhere. A column DEFAULT cannot be forgotten by a
-- caller that does not know about it.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_due_at TIMESTAMPTZ
    NOT NULL DEFAULT (now() + INTERVAL '15 days');

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_reminder_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.orders.payment_due_at IS
  'When an unpaid order cancels itself (owner 2026-08-20: 15 days). Stamped by the column DEFAULT at insert so no creation path can forget it, and FIXED from that moment — it is a promise printed on the buyer''s checkout screen, so changing the window must never move a deadline somebody was already given. NOT the same as expires_at, which is the subscription term. Swept by sweepExpiredUnpaidOrders (apps/web/lib/order-payment-window.server.ts); only submitted/awaiting_payment non-vendor orders are ever cancelled.';

COMMENT ON COLUMN public.orders.payment_reminder_sent_at IS
  'When the "your order is still waiting for payment" nudge was sent, roughly halfway to payment_due_at. NULL = not yet sent. Idempotency guard: the sweep runs on page visits (this platform is cron-free), so without it every admin page load would re-email the buyer.';

-- Existing rows: the ALTER above already gave every one of them a deadline 15
-- days from this migration rather than 15 days from when they were placed.
-- That is deliberate and is the kind way round — nobody's order is retroactively
-- overdue the moment this ships, which would cancel it before they were ever
-- told a deadline existed.

-- ─────────────────────────────────────────────────────────────────────────────
-- THE ROW IS YOURS. THE DEADLINE IS NOT.
--
-- `authenticated` holds a TABLE-level UPDATE grant on public.orders (it
-- predates this change and is relied on by checkout), so both new columns
-- inherit UPDATE the moment they exist. Left alone, a buyer could PATCH their
-- own order through PostgREST — the anon key is in the page source by design
-- and the UI is not a gate — and simply move their own deadline, forever. They
-- could also stamp payment_reminder_sent_at to silence their own warning.
--
-- ⚠ THE OBVIOUS FIX IS THE WRONG ONE HERE. Revoking table-level UPDATE would
-- drop EVERY column grant with it and require re-granting ~27 columns by hand;
-- miss one and checkout breaks in production. So this uses the other shipped
-- remedy for exactly this shape (the 2026-08-12 "row is yours, field is not"
-- sweep): the value must exist, but the BROWSER must not choose it — a trigger.
--
-- 🚨 PRIVILEGE IS READ FROM `current_setting('role')`, NOT `current_user` — AND
-- THE FIRST CUT OF THIS MIGRATION GOT IT WRONG IN THE ONE WAY THAT MATTERS.
-- Inside a SECURITY DEFINER function `current_user` is the FUNCTION OWNER, not
-- the caller, so `current_user NOT IN ('authenticated','anon')` is ALWAYS TRUE
-- and the guard admits everybody. Migration 20271141980127 already wrote this
-- table down after being bitten by it:
--
--     SET LOCAL ROLE …   current_user   session_user   current_setting('role')
--     service_role       postgres       postgres       service_role
--     authenticated      postgres       postgres       authenticated
--     anon               postgres       postgres       anon
--
-- My db test caught it only AFTER a second bug was fixed: the buyer had no
-- identity, so RLS refused the UPDATE outright and the assertion passed
-- VACUOUSLY. Two green lights, neither meaning anything. Give the fixture a
-- real identity before trusting a denial.
--
-- Also NOT `auth.role() IS NULL`: the PGlite replay's shim returns 'anon' where
-- production returns NULL, which makes every such branch dead code in every db
-- test in this repo.
--
-- Reverts rather than raises: a couple editing their order through a legitimate
-- screen must not hit an error because an untouched column came along for the
-- ride. Only a CHANGE to these two fields is undone.

CREATE OR REPLACE FUNCTION public.guard_orders_payment_window()
RETURNS TRIGGER
LANGUAGE plpgsql
-- SECURITY INVOKER (the default), deliberately. This function touches no table
-- — it only rewrites NEW — so it needs no elevated rights, and the anon-callable
-- SECURITY DEFINER guard in the db suite is correct to ask why any such
-- function exists. The first cut declared DEFINER out of habit, which both
-- widened the surface for no reason AND broke the privilege check, since
-- `current_user` inside a DEFINER function is the owner.
SET search_path TO 'public'
AS $$
BEGIN
  -- A trusted caller (the sweep, admin actions, a migration) is anything that
  -- is NOT one of PostgREST's two browser roles. `true` = missing_ok, so a
  -- direct superuser connection with no role set reads NULL and is trusted.
  IF COALESCE(current_setting('role', true), 'none') NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  NEW.payment_due_at := OLD.payment_due_at;
  NEW.payment_reminder_sent_at := OLD.payment_reminder_sent_at;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_orders_payment_window() IS
  'A buyer may not move their own payment deadline or silence their own reminder. orders carries a table-level UPDATE grant for authenticated, so both columns are writable through PostgREST without this. Reverts the change instead of raising, so an unrelated legitimate update never errors.';

DROP TRIGGER IF EXISTS trg_guard_orders_payment_window ON public.orders;
CREATE TRIGGER trg_guard_orders_payment_window
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_orders_payment_window();

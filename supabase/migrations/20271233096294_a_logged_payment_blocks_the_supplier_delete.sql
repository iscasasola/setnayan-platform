-- a_logged_payment_blocks_the_supplier_delete
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

--
-- ═══════════════════════════════════════════════════════════════════════════
-- A LOGGED PAYMENT BLOCKS THE SUPPLIER DELETE — SUP-67 (BUD-8), 2026-09-18
--
-- 🚨 THE BUG. `event_vendor_payments` hangs off `event_vendors` with
-- `ON DELETE CASCADE`. Both couple-side delete paths — `deleteVendor()` and
-- `cancelBookingAsHost()` — decided whether money had moved from a STATUS LIST
-- (`deposit_paid / delivered / complete`) plus the legacy `deposit_paid_php`
-- field. The budget page's "record a cost" door creates its supplier at
-- `contracted` and writes the money as a payment row, touching neither — so
-- removing that supplier silently destroyed the couple's record of real money.
-- Measured in the replay: at `considering` too, not only `contracted`.
--
-- 🔑 THE FIX IS THE PROPERTY, NOT A FIFTH STATUS. A supplier row with ANY
-- payment logged against it cannot be deleted — whatever its status, whichever
-- code path issued the DELETE. The status list is what drifted; a longer list
-- drifts the same way. The server actions ask first only so the couple is told
-- why in words; this trigger is what makes it true.
--
-- The way through is deliberate and already ships: remove the payment itself
-- (`deletePayment` on the budget page) — an act on the money, never a side
-- effect of tidying the supplier list.
--
-- ⚖ TWO DELETES PASS THROUGH, on purpose:
--   · the CASCADE from deleting the whole celebration. By the time the FK
--     cascade reaches `event_vendors` the `events` row is already gone, so the
--     test is "does the event still exist" — not a trigger-depth heuristic.
--     `the_money_outlives_the_event` already decided what happens to that money
--     (a marketplace booking keeps it with `event_id` nulled; a typed-in name
--     takes it along); this must not reopen that.
--     ⚠ Measured in the replay: when that cascade reaches this row the payment
--     is ALREADY gone, so the clause is never the deciding one there. It is a
--     defence for a cascade order the replay does not produce. Unproven, and
--     labelled as such rather than tested with a fixture that cannot fail.
--   · a row whose `event_id` is already NULL — a booking preserved after its
--     celebration was deleted. That is the supplier's record, governed by the
--     preservation slices, not by a couple's delete.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.event_vendors_refuse_delete_with_payments()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.event_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.events e WHERE e.event_id = OLD.event_id)
     AND EXISTS (SELECT 1 FROM public.event_vendor_payments p WHERE p.vendor_id = OLD.vendor_id)
  THEN
    RAISE EXCEPTION 'event_vendors: this supplier has a logged payment and cannot be deleted — remove the payment first'
      USING ERRCODE = '23503',
            HINT = 'SUP-67: a logged payment is never deleted as a side effect of removing its supplier.';
  END IF;
  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.event_vendors_refuse_delete_with_payments() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS event_vendors_refuse_delete_with_payments ON public.event_vendors;
CREATE TRIGGER event_vendors_refuse_delete_with_payments
  BEFORE DELETE ON public.event_vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.event_vendors_refuse_delete_with_payments();

## 2026-08-20 · fix(events): the delete gate reads the money, not a status the couple can rewrite

🚨 **THE GATE SHIPPED THIS MORNING COULD BE WALKED PAST.** `deleteOwnEvent` refuses
an event carrying a settled order — but it read only the order's CURRENT status,
and the couple can change that status themselves.

`cancelOrder` writes `status='cancelled'` with **no check on the status it is
leaving**, and the RLS guard behind it agrees: `orders_update_status_guard` is
RESTRICTIVE with `USING (user_id = auth.uid())` and a WITH CHECK that constrains
only the NEW value, which admits `'cancelled'`. So a couple holding a **paid**
order could cancel it — through the button or straight through PostgREST — and
then delete a celebration that had been paid for, possibly carrying a BIR receipt.

🔑 **A GATE MUST KEY ON SOMETHING THE PERSON IT GATES CANNOT REWRITE.** It now
reads three signals, any one of which refuses:
- the order's settled status (**`lapsed` added** — it is reachable ONLY from
  `paid`, since `lib/subscriptions.ts` is its sole writer and filters
  `.eq('status','paid')`, so a lapsed order is a paid one whose service expired);
- a **`payments`** row against any of the event's orders — somebody logged a
  transfer or uploaded a screenshot;
- a **`receipts`** row — a BIR official receipt with a sequential serial.

Neither of the last two is reachable by flipping an enum on the order, and both
outlive the cancellation. Same family as the repo's own *"the row is yours, the
field is not"* sweep.

🔒 **AND ALL THREE FAIL CLOSED INDEPENDENTLY.** `null` on any one means that
count could not be read, and the answer to "we could not check whether they paid"
is no. A gate that only guards its first input is a gate with one hinge.

⚠ **Latent, not exploited:** production has never had a paid order, so no event
has ever been in the bypassable state. Found by an adversarial sweep of what an
event delete leaves behind, not by a report.

⏭ **NOT fixed here, deliberately:** `cancelOrder` itself should refuse to cancel
an order that was already paid — that is a refund request, not a cancellation.
Changing a money flow is its own change and its own review.

**Guards:** 12 assertions (4 new), every one mutation-checked with occurrence
counts printed before → after, all RED — including one proving that dropping
EITHER of the two new signals, or narrowing the fail-closed test to the first
input alone, is caught.

SPEC IMPACT: None — no decision changed; this closes a hole in today's build.

## 2026-08-15 · fix(explore): the app promised the supplier agrees first — they never do

Explore's ⓘ panel told couples: *"Locking is a handshake, not a switch: you request
the lock, the vendor agrees, …"*. **Step 2 of that handshake has never existed.**
`finalizeVendor` writes `status='contracted'` outright and the vendor is TOLD
afterwards — `emitNotification('booking_confirmed')`, "You have a new confirmed
booking". Steps 1, 3, 4 and 5 ship; the agreement does not. So the one screen that
exists to explain the mechanism described a veto no supplier has ever been offered.

The line now describes what pressing Lock actually does. What was TRUE is kept: the
couple pays the supplier directly, off-platform, and the date is reserved on the
supplier's calendar only at `acknowledge_vendor_deposit` (the caller of
`acquireSchedulePoolsForBooking`).

🔑 **Copy is not a plan.** A sentence describing an unbuilt step is a promise the
product breaks every time somebody reads it. This one survived because it read as a
specification of intent rather than a claim about behaviour.

**The guard is DERIVED, not a pinned literal** (`lib/explore-info-copy.test.ts`).
Pinning the string would fail on every legitimate reword and pass the moment someone
reworded the promise back in. Instead it asks the code whether step 2 is wired —
`vendor_agree_to_lock` called from any non-test file under `app/` or `lib/` — and only
then permits the sentence to claim it. Comments are stripped first, so a docblock
naming the RPC cannot satisfy it. When PR-H wires a caller, the guard releases on its
own and the promise becomes legal again.

⚠ **A shipped table is not a shipped feature.** Migration `20271107090000` put nine
`lock_*` columns, three SECURITY DEFINER RPCs and a forgery trigger into production —
with **zero app callers**, verified by grep and by querying prod. Only a caller ships a
feature. This is the sixth "gate with no handle" in this codebase.

Mutation-tested both ways, occurrence count measured before → after so the sabotage is
proven to have landed: restoring the old sentence takes `vendor agrees` from 2 → 3 and
turns test 1 RED; deleting the sentence instead of fixing it turns test 2 RED.

SPEC IMPACT: `DECISION_LOG.md` — a row recording that the promise copy was live and
false, and that the corrected line must flip back only as a function of
`NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED`, never ahead of the flag.

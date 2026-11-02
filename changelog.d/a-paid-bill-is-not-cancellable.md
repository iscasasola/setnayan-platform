## 2026-08-21 · fix(events): a paid bill is not cancellable, and no event pointer dangles

Three of the five builds the owner asked to complete. Each was measured in
production before it was written.

**1 · 🚨 A BUYER COULD CANCEL A BILL THEY HAD ALREADY PAID.** `cancelOrder` wrote
`status='cancelled'` with **no condition on the status it was leaving**, and the
RLS guard behind it cannot help — `orders_update_status_guard` is RESTRICTIVE with
`USING (user_id = auth.uid())` and a WITH CHECK that constrains only the NEW value,
which admits `'cancelled'`. Two harms: the money record for a paid service reads as
though it was never bought, and until yesterday this was the route **past** the
event-delete gate (cancel the bill, then delete the celebration).

🔑 **THE CANCELLABLE STATES ARE NAMED POSITIVELY**, not as "anything but paid" — a
deny-list over an eight-value enum is a bill you keep paying, and a state added
later would be cancellable by default. ⚠ The update now `.select()`s and checks the
row count: Supabase does not throw, and an RLS refusal and a no-op are the same
shape, so without reading back a refused cancel would have redirected to
`cancelled=1` and told the person it worked.

**2 · TWO TABLES POINTED AT EVENTS WITH NOTHING HOLDING THE POINTER.**
`event_software_activations_v2.event_id` and `couple_briefs.event_id` had **no
foreign key** — deleting an event left the row holding the id of a celebration that
no longer exists, with no error and no cascade. **Prod already held 17 orphans.**

⚠ **THE CLEANUP RUNS FIRST BECAUSE IT HAS TO.** `ADD CONSTRAINT` is validated
against existing rows and hard-fails on the first orphan — it would take the whole
release, not just this migration.

⚖ **`couple_briefs` takes SET NULL, not CASCADE, deliberately.**
`vendor_bid_submissions` cascades off the brief, so a cascade here would destroy
**suppliers' bids** when a couple deletes a celebration — the exact inverse of the
owner's rule. 🪤 **And SET NULL needs a nullable column: `event_id` was NOT NULL**,
which would have been accepted at CREATE time and then RAISED at delete time,
aborting the DELETE and leaving the couple unable to remove their celebration at
all. A safety key that blocks the feature it protects. Caught by a db test seeding
a real row, not by reading the DDL.

**3 · CLOSED THE DELETE LANE ON EVENTS.** Prod granted `authenticated` DELETE on
`public.events` (`has_table_privilege` = TRUE, measured), so a couple could delete
straight through PostgREST with **no application code running**. The BEFORE DELETE
trigger fires on that path — but the **R2 media sweep** and the **paid-supplier
consent gate** are application code, so that route orphaned photographs forever and
walked past the rule that a paid supplier must first agree. Verified safe before
writing: all five app delete sites use `createAdminClient()` (service_role), grepped
not remembered. The RLS policy is left in place — inert without the grant, and belt
and braces if the grant is ever restored.

**Guards:** 9 assertions (4 unit + 5 db). All 6 sabotages mutation-checked with
counts printed before → after, all RED.

🪤 **ONE SABOTAGE STAYED GREEN AND IT WAS NOT DECORATION — IT WAS UNTESTABLE.**
Removing the orphan cleanup changes nothing in the PGlite replay, because that
database starts EMPTY and holds no orphans; the rows it protects exist only in
prod. Pinned instead as an ORDERING check over the migration source, which is the
actual safety property, with the reason written where the next reader will meet it.

⏭ **NOT in this PR:** vendor data surviving a deletion (a mapping pass is running),
and wiring the supplier-accepts handshake.

📝 **Noted, not fixed:** `derive_brief_token_cost()` is a `CASE` with no `ELSE`, so
a brief with an unlisted budget range raises *"case not found"*. Latent in a dead
table (no reader, no writer) — found while seeding the test.

SPEC IMPACT: None — closes gaps in the 2026-08-20/21 delete work.

## 2026-09-03 · fix(setnayan-ai): the paid over-budget guard reads the same books as /budget

`SETNAYAN_AI` sells, verbatim on its buy page: **"Warns you before you go over
budget"** — *"It adds up what you've committed against your target while there's
still room to trim."* That sentence is GRD-05 (`overBudgetTrigger`). Until now
the guard the couple pays ₱1,499 for added the money up **itself** — paid and
fulfilled `orders` plus `contracted`-or-better `event_vendors.total_cost_php` —
while `/budget` has asked `resolveEventMoney` since BUD-2.

Two additions over one fact, so a couple could be warned by one number and
reassured by another on the next screen, and the number they had paid for was
the narrower one. It could not see a locked package's agreed total (R4), a
vendor's catalogue line items, a manual line on an off-platform supplier, a
change-order credit, transport, crew meals (R5), a supplier-less `event_costs`
row (BA7), or a payment logged against a vendor nothing was agreed with.

- **GRD-05 now reads `resolveEventMoney`** — the same call `/budget` renders.
  `budgetFromEventMoney` (`lib/setnayan-ai-snapshot.ts`) is the one mapper, and
  **both** surfaces that run the trigger go through it: the guard-notification
  sweep and the Overview's "Sai on watch" rail, which had a third assembly of
  its own.
- **The alert names the category.** The GRD-05 copy has always had a
  `{top_driver_category}` slot and never had the data for it — the old formula
  filled it with the single costliest vendor's raw category slug
  (`reception_venue`). It now carries the biggest committed **bucket's** label
  from `EventMoney.byBucket` — the same words `/budget` prints for that
  category ("Catering").
- **`SnapshotBudget.pendingPhp` is gone.** It summed `submitted` Setnayan
  orders — money the couple has applied for and an admin has not approved — and
  added them on top of committed. The resolver files those under `estimated`,
  and §18.5 rule 4 gives "over budget" exactly one meaning: what the couple has
  **agreed** exceeds their target.
- **`lib/one-set-of-books.test.ts`** is the deliverable: over row fixtures
  carrying money through every source the resolver knows, it fails if the
  guard's committed total and `/budget`'s strip ever differ, if GRD-05 fires on
  a different threshold, if `SnapshotBudget` grows a field the resolver does not
  have, or if either surface stops asking the mapper.

**Measured on the live database (2026-09-03, read-only):** both prod events that
carry money show a **₱0 delta** and **no couple's warning state flips** — the
two books agree today by coincidence of the data (every locked vendor's line
items happen to sum to their headline; there are no packages, credits, crew
meals, `event_costs` or `submitted` orders anywhere). The defect was real and
latent, not yet paid out. Event `044f7e64` (AI active, ₱2,250,000 target)
reads ₱2,499 committed before and after; `947e7bab` (₱930,000 target) reads
₱810,000 before and after. Neither is over budget in either arithmetic.

The `top_driver_category` copy DOES change on live data: `947e7bab` would say
"Catering" (₱225,000, the biggest committed bucket) where the old formula said
`catering` from the costliest single vendor — same category here, different
mechanism, and the mechanisms part company as soon as a category has two
suppliers.

`lib/the-bill-has-somewhere-to-be-paid.test.ts` drops `lib/setnayan-ai-snapshot.ts`
from `UNPAID_READERS` — the `pending` bucket that entry guarded no longer
exists — and gains a test that pins the read where it went: the snapshot may not
touch `orders` at all, and the resolver must read them unfiltered while naming
both unpaid states.

GRD-05 stays **in-app** (`ai_guard_alert`). GRD-01 remains the only guard on the
email allowlist; moving GRD-05 there is a separate §4.1 restraint decision and
is not done here.

SPEC IMPACT: Yes — this changes what a paid SKU reports. `DECISION_LOG.md` row
2026-09-03 "GRD-05 reads resolveEventMoney" records the owner-facing decision:
the guard's committed total is now the resolver's, so it may move in either
direction, and `SETNAYAN_AI`'s buy-page promise is now true of the same number
`/budget` prints.

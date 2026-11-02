## 2026-08-21 · fix(db): a quote outlives the event

Slice 5 of *"vendors get to keep it"*, and it **closes the half-win slice 4
named**.

A proposal is a quote the **supplier wrote and sent**. `vendor_profile_id` is
`NOT NULL`, the supplier authored every word, and there is no such thing as a
proposal the supplier did not take part in — so, exactly like a contract in
slice 3, **every row survives with no status test**. A draft they never sent is
still their own document.

### It closes the quote-stage fee gap

`booking_fee_charges_anchor_ck` requires `proposal_id` **or** `event_vendor_id`,
and both cascaded. Slice 2 made the `event_vendor_id` anchor survive; this makes
the `proposal_id` anchor survive. So a booking fee raised at the **quote** stage
(`source='send'`) no longer disappears when a couple deletes their event.

That was **money a supplier owes Setnayan**, erased by a couple who is not a
party to the debt.

A test asserts the surviving charge still satisfies its own CHECK **and can
still be marked paid** — a charge nothing can ever update is a tombstone, not a
preserved debt.

### Checked for the slice-4 trap first, not after

Every child FK pointing at `vendor_proposals` is **single-column**
(`booking_fee_charges`, `chat_messages`, `inquiry_outcomes`,
`proposal_amendments`), so nothing here spans the column being nulled and no
`ON UPDATE` clause is needed. **That is the check slice 2 skipped and slice 4 had
to repair.**

### And the anonymity trap does not apply — measured, not assumed

The proposal page renders from `merge_snapshot` / `rendered_body` /
`rendered_terms`, which the proposal already carries, and the supplier's list
shows only the proposal's own fields. It never displays a client name pulled
from the event, so **no snapshot column was added**. Adding one out of symmetry
with slice 3 would have been cargo.

### One live landmine defused

`app/proposals/[publicId]/page.tsx` built a back link as
`` `/dashboard/${proposal.event_id}/vendors` ``. With a NULL event that renders
`/dashboard/null/vendors`. **Unreachable today** — an orphaned quote is invisible
to the couple, whose read policy keys on `event_id`, so only the supplier reaches
that page and they take the vendor branch. Guarded anyway: that reasoning depends
on no admin or support policy ever being added to `vendor_proposals`, which is
not a promise the page can keep.

**A third costume for the same trap** — after *vanishes* (slice 2) and *goes
anonymous* (slice 3), now *builds a broken URL*. One question still finds all
three: **what else reads the event?**

### Mutations

| | | |
|---|---|---|
| **M68** proposal FK back to `CASCADE` | **all 5 RED** | everything depends on the quote surviving |
| **M69** fee-charge FK back to `CASCADE` | RED ×2 | exactly the two fee tests — proving the closure needs **both** halves |

### A note on merge order

This migration briefly carried a duplicate, idempotent copy of slice 4's fee-FK
statements so the two PRs could land in either order without a stacked
auto-merge. Slice 4 merged first, so the copy was **removed** rather than left as
a confusing second definition, and the dependency is documented in the migration
instead.

SPEC IMPACT: None — implements the ruling in `DECISION_LOG.md` 2026-08-21.

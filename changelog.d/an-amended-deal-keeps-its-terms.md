## 2026-08-21 · fix(db): an amended deal keeps its terms

Slice 6 of *"vendors get to keep it"*.

### 🚨 Not a missing record — a misleading one

Slice 5 made the supplier's **quote** survive; slice 3 made their **contract**
survive. But the things that *change* those terms — a bundled amendment
(discount / add-on / freebie / special request) and a change order — still
cascaded.

So a supplier was left holding a quote showing the **original** price with no
record of the discount both sides agreed, and a contract with no record of the
change orders against it.

**A record that survives stating terms nobody agreed to is worse than one that
is simply gone**, because the supplier reads it as fact.

### The parent alone is not enough

`proposal_amendments` carries the note and the status. **Every amount lives one
table down**, in `proposal_amendment_items.amount_php`, one row per line.
Preserving only the parent leaves an amendment that says *"accepted"* and cannot
say **what** — the same misleading-record failure reproduced inside the fix.

Both tables are preserved, and a test sums the surviving lines to check they
still add up to what was agreed.

`amendment_id` stays `CASCADE` deliberately: an item genuinely belongs to its
amendment, and with the amendment now surviving that cascade never fires on a
deletion.

### No status test, for the same reason as contracts and quotes

The amendment state machine starts at `'proposed'`, which means **sent** — there
is no draft the supplier never saw. So a **declined** request survives too: a
refusal is part of the record of a negotiation both parties were in. Asserted by
its own test, so a future change that quietly filtered to accepted-only would go
red.

### Slice-4 trap checked first, as it now always is

Every FK on all three tables is **single-column**, so nothing spans the column
being nulled and no `ON UPDATE` clause is needed.

`vendor_change_orders.event_vendor_id` is `NOT NULL` + `CASCADE` and is **left
alone**: slice 2 preserves a booked row rather than deleting it, so that FK never
fires for a supplier who took part. For a booking that is *not* preserved — a
name the couple typed — the change order correctly goes with it, and a test
covers that direction too.

### Mutations — each fails exactly its own tests

| | | |
|---|---|---|
| **M70** amendments back to `CASCADE` | RED ×3 | everything hanging off the amendment |
| **M71** **items** back to `CASCADE` | RED ×1 | *the parent alone cannot say what was agreed* — the point of the slice |
| **M72** change orders back to `CASCADE` | RED ×1 | *a change order against a signed contract survives* |

SPEC IMPACT: None — implements the ruling in `DECISION_LOG.md` 2026-08-21.

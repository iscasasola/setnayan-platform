## 2026-09-03 · fix(vendors): one gate decides whether a supplier may be invited

Five shipped call sites answered ONE question — *"may this supplier be sent a
claim invite?"* — three different ways:

| call site | its gate |
|---|---|
| `createManualVendorInvite` | `manual_vendor_id IS NOT NULL` **AND** `marketplace_vendor_id IS NULL` |
| `finalizeVendor` | the same two conditions |
| the vendor workspace page | `marketplace_vendor_id IS NULL`, alone |
| `createAutoShareInviteAction` | **no condition at all** |
| `inviteVendorByEmail` | `marketplace_vendor_id IS NULL`, alone |

**Measured against production 2026-09-03** — re-measured, not taken from a
handoff: 45 `event_vendors` rows, **43 with BOTH ids NULL**. Narrow it to the
rows actually eligible (off-platform AND locked — what the workspace page
offers an invite for) and it is **12 of 12 REFUSED**, every one told
*"This vendor is already on Setnayan."* That sentence was false for precisely
the suppliers who saw it: they are the ones **not** on Setnayan.
`vendor_invites` held **0 rows of any source**, which is what a path nobody can
reach looks like from the data. Re-measure with

```sql
select count(*) filter (where manual_vendor_id is null
                          and marketplace_vendor_id is null)
from public.event_vendors;
```

- **One predicate**, `canInviteSupplier`, in the new pure module
  `apps/web/lib/supplier-invite-eligibility.ts`. All five gates call it. It is
  pure and lives outside `lib/vendor-invites.ts` deliberately: that module is
  `server-only`, and a predicate nobody can import from a unit test is a
  predicate whose truth table nobody checks — and this one's truth table *is*
  the defect.
- **The fact and the question have separate names.** `isOffPlatformSupplier`
  (does this supplier have an account?) and `canInviteSupplier` (may we invite
  them?) return the same thing today. Collapsing them would let a future clause
  on one silently move the other, which is the class of defect this closes.
- **The false sentence is gone.** `SUPPLIER_ALREADY_HAS_ACCOUNT_MESSAGE` is now
  shown only when it is true — i.e. only when the supplier really does have an
  account. Its one previously-correct use, in `inviteVendorByEmail`, now shares
  the same string.
- **`createAutoShareInviteAction` gained the gate it never had**, and now reads
  the supplier's identity from the **row** rather than from hidden form inputs.
  The denormalised `business_name` on `vendor_invites` is what the public claim
  page shows the supplier; taking it from the client let a caller stamp any name
  onto it. The gate needs the row anyway, so this costs nothing.
- **`ensureAutoShareInvite`'s docblock carried the wrong rule as an instruction
  to callers** — *"caller MUST verify `manual_vendor_id IS NOT NULL` AND
  `marketplace_vendor_id IS NULL`"* — and two callers followed it in good faith.
  Only the second half was ever justified, by the very next clause of that same
  sentence. The instruction is corrected and the record of what it cost is kept
  beside it, because deleting it would let the next session re-derive
  "manual vendors get manual invites" from the column name alone.

### A second question, found by the guard while it was being written

Property 2 (*"every gate calls the predicate"*) fired on a site nobody had
listed: the **`HostServiceDetails`** render gate, which ANDed the same wrong
`manual_vendor_id IS NOT NULL` half. It answers a *different* question — "may
the host author this supplier's package details?" — with the same fact
underneath and the same 43-of-45 blast radius:

- the editor was **never rendered** for a both-ids-NULL supplier, so the couple
  had no way to describe a supplier only they can describe; and
- `updateHostServiceDetails` scoped its `UPDATE` the same way, so it matched no
  row — **and an UPDATE that matches nothing returns no error**.

🔑 **The two failures concealed each other.** With the form hidden, the silent
no-op behind it was unreachable and therefore unreportable. Fixing only one
would have turned a hidden control into a save button that does nothing, so
both are fixed here. This was **not** part of the task that produced this PR;
it is reported as a separate finding rather than folded in silently.

Guarded by `apps/web/lib/one-gate-decides-a-supplier-invite.test.ts` — truth
table · every gate calls the one predicate (asserting the **count**, because a
file-level check cannot tell five call sites from four) · the invite helper is
never called without the gate in the same file · the false sentence cannot
return as rendered text · the docblock keeps its own correction · and both
host-details gates ask the fact. Mutation-tested six ways — putting
`manual_vendor_id` back into the predicate, each gate re-growing its own,
restoring the false sentence, dropping the fourth gate again, and re-narrowing
either host-details gate — each turning exactly the intended assertions red.

SPEC IMPACT: None. This restores the behaviour the shipped workspace page
already documented in its own comment ("ANY vendor without a Setnayan account
(marketplace_vendor_id IS NULL) gets the claim-link CTA") and the owner's
2026-07-01 directive ("Add manually will create a QR code for the vendor to log
in from"). No locked decision changes; whether a booking is real enough to be
worth inviting stays a per-surface condition and is untouched.

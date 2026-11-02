## 2026-08-07 · fix(budget): a receipt attached to a vendor payment could never arrive

A couple photographs the bank transfer they made to their photographer, attaches
it to the payment they are logging — and it is **refused**. The payment saves
anyway, with no receipt. On the other side, the photographer's *"confirm we
received this"* screen has a slot for that receipt and has had one since
**2026-06-20**.

**Three stacked breaks, not the one on record.** Fixing any two leaves it broken:

1. **The upload was rejected outright.** The uploader mints `payment-proof/…`
   into the private thread-files bucket; `PRIVATE_BUCKET_ROOTS` did not list
   `payment-proof`, so the upload API returned a 400.
2. **The validator pointed at the wrong bucket and two prefixes nothing has ever
   produced.** It omitted `bucket` — which defaults to the PUBLIC media bucket —
   and listed `budget/<id>/` + `payments/<id>/`. It could never match, and a
   non-matching ref is dropped to NULL *by design*, so the receipt was discarded
   silently even if the upload had succeeded.
3. **The stored value was the wrong shape.** It saved the bare key. The reader
   returns any value not starting with `r2://` **verbatim**, so the vendor's
   "View attached receipt" would have been a relative path and a 404.

🔑 **The register recorded break 2 and said the validator "still accepts the old
public paths". That is not what happened** — those prefixes match no uploader that
has ever existed. It was broken on arrival, 2h31m *before* the bucket switch it
was blamed on.

**Why it shipped green:** the two tests covering this asserted
`r2://setnayan-media/budget/<EVENT>/receipt.jpg` — a reference no uploader has
ever minted. **A test is only as real as the value it feeds in.** Repointed.

Also corrected three docblocks that would have sent the next reader back to the
public bucket, including *"There is currently NO reader"* — true when written,
false since June.

🛡 **New guard, verified to FAIL first.** It reads every private-bucket
`<FileUpload>` out of the source and asserts its root is registered. Reverting
break 1 makes it name the exact file. It carries two self-checks, because a
scanner that matches nothing passes forever.

⚠ Deliberately a **new** test, not an extension of the existing prefix-tenancy
one: that checks a different dimension (does the id belong to the caller), and
`payment-proof` already passed it while being completely unusable.

⛔ **Do not "fix" a future variant by moving the prefix to `payments/<eventId>`** —
`payments` is an ORDER root, so an event id under it is checked against the
orders table and 403s.

SPEC IMPACT: None — closes an item in `WHAT_IS_LEFT.md` §1.

## 2026-08-04 · fix(dates): the other two ways out of a lock also give the date back

Completes the date bug. #4093 fixed **one** of the three couple-initiated exits from a vendor lock; the other two left the date behind exactly as before.

| Exit | Before |
|---|---|
| `revertVendorToConsidering` | fixed in #4093 |
| `deleteVendor` | **still stranded the date** |
| `cancelBookingAsHost` (non-downpaid) | **still stranded the date** |

A couple who *removed* the vendor rather than reverting it — the more natural action — got no benefit from #4093 at all.

### Extracted, not copied

The conditions now live once, in `lib/release-forced-date.ts`. Copying them into three call sites is how two of them drift and one quietly stops guarding — and the condition most likely to be dropped is the one that matters most: **has the date already gone outward?** Forgetting that deletes a date guests have already been sent.

The helper is a no-op unless **all** hold: the stamp names this vendor · no other confirmed vendor remains · no launched Save-the-Date, no pending scheduled launch, no public landing page. It returns which of those stopped it, so a caller can surface it later.

### The one deliberate exclusion

`cancelBookingAsHost`'s **downpaid** branch returns `downpaid_use_dispute_flow` long before the release call, so it can never reach it. **A dispute must not quietly erase a wedding date.**

Still excluded, as before: a **vendor**-side cancellation, an admin action, or force majeure. A supplier backing out must prompt the couple, never silently delete their date. The helper's docblock says so, because the next person to add a fourth exit will read that before they read this.

### Notes

- `#4093`'s inline block is replaced by the helper call — same behaviour, one definition. No condition was relaxed in the move.
- `deleteVendor` returns `void`; the release runs before its `revalidatePath` calls so the cleared date is reflected on the first render.

Verified: **zero typecheck errors** in the changed files · unit suite **6,279 pass / 4 fail**, the same four pre-existing `@electric-sql/pglite` module failures present on unmodified `origin/main`.

SPEC IMPACT: None — completes the owner's 2026-08-04 date ruling across all three couple-initiated exits.

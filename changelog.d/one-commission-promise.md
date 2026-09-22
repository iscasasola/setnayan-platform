## 2026-09-22 · fix(copy): one commission promise, said the same way everywhere

**Owner, 2026-09-22: "0% commission stays, propagate the /pricing wording everywhere."**

The claim appears across ~50 files. `/pricing` said both sentences; almost everything else said only
the first. Per the 2026-08-06 ruling, recorded in `/pricing`'s own source: *"No commission on vendor
bookings" is CORRECT and stays… the fee is charged to the VENDOR for the introduction… so **both
sentences are true at once, but only if the second one is actually said.***

### The audience distinction IS the ruling

🔑 A **couple**-facing "0% commission" needs no second sentence and must not be made to carry one —
a couple is not billed and never will be, so naming the supplier's fee there raises a question they
do not have. The second sentence is owed wherever a **supplier** reads the claim. The guard therefore
holds a list of supplier surfaces, and **also asserts the reverse**: a couple-facing page that starts
naming the booking fee fails too.

### What was actually wrong

🛑 **Three supplier pages still promised "0% commission while we launch", ungated, while production
had already charged and collected ₱837.50** — `vendor-grow-hero`, `vendor-tier-matrix` and
`vendor/claim/[token]`. That is the same claim `VendorGrowFairPay` records fixing on 2026-09-20.

🪤 **And `vendor-grow-sections` — the file that documents fixing it — still carried it twice more,
plus a hand-typed `5%, then 1% beyond ₱100,000`.** A fix applied to one string in a file is not a fix
applied to the file. Found by the guard, not by reading.

### The shape

New `lib/commission-promise.ts` is the single source: `COUPLE_COMMISSION_PROMISE` (unqualified),
`supplierCommissionPromise()` and `supplierCommissionShort()` (both halves, always), and
`BANNED_LAUNCH_WINDOW_SHAPE`. Every number derives from `bookingFeeScheduleSummary()` and
`FREE_BOOKING_LIMIT`, and the wording is gated on `isBookingFeeEnabled()` — the same flag that
decides whether anyone is billed, so the promise and the charge cannot disagree.

Applied to: `vendor-grow-hero` · `vendor-tier-matrix` · `vendor-tier-deltas` · `vendor-grow-sections`
· `vendor/claim/[token]` · `HomeOverlays` · `vendor-benefits` · `waitlist` · `custom-plans composer`
· `help.ts`. Already correct and left alone: `/pricing`, and the two fixed in #5849.

🪤 One fix looked applied and was not: JSX line-wrapping split `"A booking / fee applies"` across a
newline, so the phrase did not exist as a string and the guard could not see it. **A line break is
invisible to a reader and decisive to a matcher.**

Guard `one-commission-promise.test.ts` — 5 tests, 4 sabotages red, typecheck 0 errors.

SPEC IMPACT: `DECISION_LOG.md` — the 2026-09-22 ruling recorded. Applied directly per the
2026-06-04 standing authorization.

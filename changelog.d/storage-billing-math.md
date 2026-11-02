## 2026-08-08 · feat(storage): the billing math for ₱500/yr per 10 GB — measured on what we HOLD

Owner-locked: **₱500/year per 10 GB block**, charged on actual stored bytes,
**accumulating across every event on the ACCOUNT** ("this will accumulate all the
data they collect on their account"). Customer sees a **percentage, never GB**, and
always gets a **5 GB buffer**.

This PR is the **pure math layer only** — no UI, no SKU change, no charging. It is
the foundation the percentage, the block count and any invoice all sit on, and it
needed no owner decision because making a byte count correct is not a policy call.

**🔑 The correction at the heart of it: we bill for what we are STORING, not what was
once uploaded.** The existing byte columns were built for INGEST telemetry — how big
the original was when it arrived — so the councils could check the modelled ~8%
web-copy ratio. A bill asks the opposite question: after the retention window we
REPLACE the original with its compressed copy, so summing `orig_bytes` would invoice
a couple whose gallery is 0.4 GB for the 4.4 GB they uploaded a year ago. Same
columns, opposite meaning — the "two values that look alike" shape this project keeps
paying for. The billing view therefore gets its own type (`StoredRow`) and its own
function, rather than a flag on the telemetry path.

**🚨 An unmeasured byte must never look like zero.** A clip's raw video has no
recorded size — the derivative writer deliberately omits `orig_bytes` for clips,
because a clip's "original" is a video, not the poster still it derives from — and
those are the **largest objects on the platform**. `storedBytes()` returns an explicit
`unmeasured` flag rather than silently summing what it happens to know, and
`aggregateAccountStorage()` carries the count forward. Without it the failure is
invisible and wrong in **both** directions at once: clip-heavy events (which cost the
most) get billed the least, while the customer's meter reads reassuringly low.

**⚠ ACCOUNT scope, not event scope.** Everything else in this codebase totals storage
per event, because captures belong to events. Billing a person means rolling up all
their events together: three 4 GB events are **12 GB = 2 blocks (₱1,000)**, not three
separate 1-block bills (₱1,500). A test pins that difference.

Also: GB is **decimal (10⁹)**, matching how the storage bill is actually charged —
binary GB would make every block ~7% smaller than the cost basis it was priced
against and silently erode the margin.

Sabotaged **5 ways** from a verified-green baseline, all caught: bill dropped
originals again · treat clip raws as zero · remove the buffer · switch to binary GB ·
round blocks down.

Typecheck clean · 7076/7076 unit tests · all 12 `lint-*.mjs` clean · the existing
telemetry suite still green.

⏭ **NOT built here** (deliberately): the per-account rollup query, the customer-facing
meter UI, the SKU re-price, and registering the plan for annual expiry. Two of those
wait on owner decisions — what counts toward the allowance, and what happens on
non-renewal.

SPEC IMPACT: None — the pricing decision is already recorded in `DECISION_LOG.md`
(2026-08-08).

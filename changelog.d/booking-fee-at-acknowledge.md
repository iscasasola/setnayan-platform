## 2026-08-03 · feat(booking-fee): the vendor is billed when they accept the payment, not when the couple locks

Implements **PR-I** of `Explore_Replan_BUILD_SPEC_2026-07-27.md` §7 — an owner ruling that has been sitting in the corpus for nine days while the code ran the previous one.

**Owner, 2026-07-27** (DECISION_LOG "lock handshake" row): *"locking applies only once the vendor accepts the payment"* — Lock = request → vendor agrees → vendor sends payment request → customer pays + screenshot → **vendor accepts payment (billed the syncing fee alongside accepting)** → schedule locked.

Restated by the owner in his own words on 2026-08-03: *"vendor will confirm the payment. confirming it will lead them to the booking fee. This is where we get the commission of the website."*

### What changed

The fee moves from **couple-lock** to **vendor-payment-acknowledge**. Rate, base, sourced-only and free-5 are all **unchanged** — only the moment moved.

**Removed from three lock sites** (this is the whole risk of the change):

| Site | Was |
|---|---|
| `app/dashboard/[eventId]/vendors/actions.ts` | `finalizeVendor` — the vendor-page lock |
| `app/dashboard/[eventId]/vendors/packages/actions.ts` | `lockPackage` — the package lock |
| `lib/chat-lock-booking.server.ts` | the chat lock |

**Added to one:** `vendorAcknowledgeDeposit`, inside the `env.status === 'ok'` branch — so a re-clicked acknowledge bills nothing. That idempotency comes from the single-winner `acknowledge_vendor_deposit` RPC, not from a check of our own.

No marketplace pre-gate is needed at the new site: `collectBookingFeeAtLock` already returns `skipped:'not_verified_vendor'` for an off-platform vendor. Fail-soft is preserved — the acknowledgement has committed and the couple has been told their date is locked; a fee hiccup must never undo that.

### Why this needed a guard, not a comment

Three removals and one addition, **on money, behind a flag that is off.** Leave one lock site behind and the vendor is billed **twice** the day `NEXT_PUBLIC_BOOKING_FEE_ENABLED` flips — and nothing would catch it, because with the flag off every path is a silent no-op in CI and in prod. The bug's first appearance would be a real duplicate bill.

`scripts/lint-booking-fee-single-trigger.mjs` asserts **exactly one** non-test call site, and that it is the acknowledge action. It strips comments before matching, so the three "no longer fires here" notes don't trip it. New CI job `lint booking-fee single trigger`.

**Verified in both directions:** passes on this branch; re-added one lock site and confirmed it fails with the two call sites named. A guard that cannot fail is worse than none.

It also fails if **nothing** calls the symbol — a fee that can never be charged is as wrong as one charged twice.

### The lineage

The spec calls this the **fifth ruling** on when the fee fires. Each was recorded properly and the code still drifted, because a decision and a call site are not connected by anything. The guard is that connection: a sixth ruling now has to change `CANONICAL_CALLER` and say so.

### ⏭ Surfaced, deliberately not folded in

`refresh_fee_only` (decided in `lib/chat-lock-booking.ts:57`) existed **only** to re-attempt the fee on an already-booked pair. With the trigger moved it can no longer charge anything — it is now an inert branch that reports `already_booked`. Retiring it means changing the shared decision type and its callers. That is a separate change; widening this one is how a money move gets rushed. `feeCharged` is kept in the return shape and is now always `false` from that path, which is *correct* — no fee was charged there.

**PR-H** — the vendor agreeing to a lock *before* payment — remains unbuilt and is the one genuinely missing step in the owner's flow.

Verified: 88 unit tests pass across the touched modules · guard passes and provably fails · zero typecheck errors in the changed files (the 147 reported locally are the pre-existing missing-`pglite` cascade in `tests/db`, none in app code).

SPEC IMPACT: None — implements a ruling already recorded in `DECISION_LOG.md` (2026-07-27) and `Explore_Replan_BUILD_SPEC_2026-07-27.md` §7. Rate, base and scope unchanged.

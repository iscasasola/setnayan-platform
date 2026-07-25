## 2026-07-25 · feat(vendor-pricing): "free until your 6th booking" on the two couple-visibility add-ons (flag-dark)

Owner-locked 2026-07-25. While a vendor is inside their **first 5 bookings** — the
same window in which Setnayan charges them **no booking fee** — **3D Plan Ads** and
**Papic Challenge** cost **₱0**. From their 6th booking the normal banded price
applies (₱2,000 Free/Solo · ₱1,500 Pro/Ent for 3D Ads; ₱500/₱400 per event for
Papic). One sentence to a vendor: *you don't pay us anything until you've won 5
clients here.*

**Scope is the two COUPLE-VISIBILITY add-ons only** (owner). AI Chatbot and Deep
Search charge from day one — Deep Search in particular costs real money per run
(~₱10–30 of web search + synthesis), so giving it away would be a per-use loss
rather than a marketing spend. Pinned by a test.

**This REPLACES the 3D booth's one-time free 28-day cycle.** With the policy live,
free is decided only by the first-5 window and it repeats; the trial is dormant.
`booth_addon_trial_used_at` is deliberately **not** consumed, so switching the
policy back off restores the legacy free cycle intact.

- `lib/vendor-addon-first5-free.ts` (**new, pure**) — the policy: covered SKUs, the
  window predicate, the non-stacking expiry, the bookings-remaining counter, and
  the committed-booking reader.
- `lib/vendor-addon-first5-free-flag.ts` (**new**) — `NEXT_PUBLIC_VENDOR_ADDON_FIRST5_FREE`,
  its **own** switch. Tiered pricing decides what an add-on costs and who may buy;
  this decides who pays nothing yet. They ship together but stay independently
  revertible.
- 3D booth: buy action + subscription card + page.
- Papic: buy action gains a ₱0 **direct-activate** path (audit-only ₱0 `paid`
  order + the sponsorship written inline — the `sku-activation` hook only ever
  runs on admin approval of a real payment), plus section + buy-button copy.

### Three traps this had to avoid

1. **The counter cannot read `booking_fee_ledger`.** `collectBookingFeeAtLock`
   returns `{status:'disabled'}` and touches no DB while `NEXT_PUBLIC_BOOKING_FEE_ENABLED`
   is off (`lib/booking-fee-lock.server.ts:57`) — that flag is off, so the ledger is
   **empty for every vendor**. Counting it would have read 0 for everyone and made
   both add-ons **free forever**. The count comes from `event_vendors` instead,
   filtered on the same four committed statuses the fee RPC uses, which yields the
   same number regardless of how the fee flag is set.
2. **A repeatable grant is not double-click-proof.** The one-time trial was safe by
   construction (atomic `WHERE trial_used_at IS NULL`). Without that, a vendor
   inside the window could click ten times and stack 280 free days outliving their
   6th booking. `nonStackingFreeExpiry` clamps every grant to one cycle ahead, so
   repeated presses are idempotent.
3. **Reads fail CLOSED.** A failed or garbage booking count is treated as *outside*
   the window, so a broken read charges rather than gives away. Never invert it.

Also removes a **4th** copy of the committed-status list (`photo-challenge-actions.ts`
now shares the constant) with a drift test pinning it against the platform's.

FLAG-DARK: off (default) → the 3D booth keeps its one-time trial and Papic charges
from the first event, byte-identical to today. Typecheck clean · 3289/3289 unit
tests pass (12 new) · `lint:entitlement-gates` clean.

SPEC IMPACT: `Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 2 — add-on pricing
gains a first-5-free carve-out for the two couple-visibility add-ons.

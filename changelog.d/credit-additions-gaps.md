## 2026-07-27 · fix(packages): two gaps in credit-funded purchases — both money, both mine

Found by sweeping the credit path for gaps. Both are the same class I had
already fixed twice in this wave, re-introduced by yesterday's
credit-on-other-services PR.

### Gap A — the browser's raw input was persisted as truth

`persistedCustomizations` spreads `...customizations`, which carries the
client's `credit_additions` **verbatim**. The additions were sanitised for
*pricing* (same-vendor only, committed price required) — and then the
**unsanitised** list was written into `customizations_json`.

So a service belonging to another vendor, or one the vendor never priced for
credit, was dropped from the money and still **recorded as bought**. Every
later reader — including whatever tells the vendor what to deliver — would have
read it as real.

Exactly the failure the `chosen_option_ids` sanitisation was written to stop:
*"a bogus id survives in customizations_json and reads as truth to every later
consumer."*

**Also frozen: the unit price.** `credit_price_centavos` is live and
vendor-editable, so storing a bare pointer would let a later edit rewrite what
the couple spent. The price is now snapshotted at lock — same reasoning as
`orders.pax_snapshot`.

### Gap B — a line removal handed the credit back

`removeItemFromPackage` re-priced with **no additions**, so removing any line
recomputed the pool as though the couple had bought nothing: a ₱500 pool with
₱300 already spent went back to reading ₱500 available.

The test pins the bug's own signature — pricing without the additions returns
the full pool, pricing with them does not.

**Fails closed on an unpriced legacy purchase.** A booking with no frozen price
cannot be re-priced without guessing, and guessing is how credit gets spent at a
number nobody committed to, so the removal refuses with an actionable message
instead. (Prod holds 0 packages, so nothing existing is affected.)

**Verification:** 2 new tests, both named for the failure they prevent.
**4229 unit + 396 DB green**, `tsc --noEmit` exit=0, `next lint` exit=0. No
migration. Note `tsc` does *not* catch Gap B — the argument is optional — which
is precisely why the test exists.

SPEC IMPACT: none — this restores intended behaviour. ⚠ Still open and
unbuilt: **no vendor UI** to set a credit price or a per-head upgrade, and **no
couple UI** for the picker (prototype only), so `credit_additions` has no real
sender yet. And the **dead-pool** divergence stands: `credit_price_centavos`
defaults to NULL, so a vendor who prices nothing gives their couples a credit
pool with nothing to spend it on — the opposite default from
`package_credit_v1`'s "credit can be spent on anything Sofitel offers".

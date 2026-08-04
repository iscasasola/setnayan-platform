## 2026-08-01 · feat(observability): the first arrival check — money landed, did the feature switch on?

The owner's original framing was *"a log that an account did this action destined to arrive to this interconnection, testing if the interconnection did work."* This is that, built the **derived** way rather than the **declared** way, and the distinction is the whole design:

- **Declared** — every write site records "this is supposed to land over there." Precise, and it fails the moment somebody forgets one, because a missing declaration is indistinguishable from a healthy joint. It also only ever covers writes made *after* it ships.
- **Derived** — state the pair of facts **once** and let a query find the gap. Nothing to forget, and it works retroactively on every row already in the database.

**The pair:** *an order that has been paid should have its SKU active on its event.* Money first, because a silent gap there costs a real customer something they paid for — and they find out before we do.

**It calls the product's own reader.** `eventSkuActive` is the function the product itself uses to decide whether a feature is unlocked, so the probe cannot drift from what the couple experiences. A SQL re-implementation would be a second copy of a rule that already folds in bundle composition, promo free-windows and admin comp grants — and two copies of one rule drift together while the check stays green.

**The 15-minute grace window is load-bearing.** Activation runs *after* payment, not inside it, so a just-paid order is legitimately not-yet-active. Without the window this would report a fault on every healthy checkout and be muted within a day.

`fulfilled` is included alongside `paid` on purpose: it claims *more* than `paid` does, so a fulfilled order whose SKU is inactive is a louder contradiction, not a quieter one.

No PII in the ledger — SKU keys only, capped at five, never order ids or customer identifiers.

SPEC IMPACT: None — new observability probe, no product or pricing behaviour changed.

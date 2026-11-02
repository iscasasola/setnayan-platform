## 2026-07-31 · fix(pricing): the Suite hub was the last surface still quoting ₱1,499 for every event type

Setnayan AI has been priced per event type since the 2026-07-22 lock — Tier A ₱1,499 wedding · B ₱899 debut/corporate/gala · C ₱499 standard · D ₱99 light · E ₱0 simple. `setnayan_ai_per_event_pricing_enabled` is **TRUE in prod**, so checkout, the AI detail page and the onboarding services step all resolve the real tier.

The Suite hub did not. It reads the catalog in one bulk query:

```ts
.in('service_code', serviceKeys).eq('is_active', true)
```

Both halves are correct for an ordinary SKU and wrong for this one. `serviceKeys` carries the generic `SETNAYAN_AI` (Tier A), and the tier rows `SETNAYAN_AI_B/C/D` are **price-source-only with `is_active = FALSE` by design** — so they could not come back from that query even if it asked for them. Every event type saw ₱1,499.

This is the hub. It is the **first** price a host sees, and it was the only one that lied — a `date` host was quoted ₱1,499 for a ₱99 product, then charged ₱99 at checkout. The error runs in the customer's favour to discover, which is why nothing caught it, but it suppresses the sale at exactly the moment the decision is made.

Fixed by resolving through `resolveSetnayanAiDisplayPricePhp` — the shared switch the detail page and `order-charge-authority` already use. That function exists precisely so shown and charged prices cannot disagree in either state of the flag; the hub simply wasn't calling it. All four surfaces now agree through one switch.

### The same resolve closes a fake door

Tier E is `simple_event`: marketplace off ⇒ no vendors ⇒ nothing for the planner to plan, so there is **no AI SKU at all**. The card still rendered, still took the tap, and could never complete a purchase — it dead-ended in a "please refresh" that would never come true.

The entry is now gated on the same resolved price (`aiDisplayPhp > 0`), so the hub can never offer what checkout cannot sell. An event that already **owns** it keeps the card, so a grandfathered unlock never vanishes from under its buyer.

A zero from an unreadable read takes the same branch: the stale flat price is deleted rather than printed, because no number is safer than a wrong one on a card that leads to payment.

### Verified

Read from prod before writing: all four tier rows exist with the locked amounts, `setnayan_ai_per_event_pricing_enabled = true`, `setnayan_ai_paywall_enabled = true`. `tsc --noEmit` clean · `next lint` clean.

SPEC IMPACT: None. No price, tier assignment or entitlement changed — this makes one surface display the price the other three already resolve.

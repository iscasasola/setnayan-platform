## 2026-08-28 · feat(explore): the marketplace grid shows what a shop starts at

Owner, 2026-08-28: *"their service cards has the prices."* He was right, and the
question I had raised was the wrong one.

**RULE 0 paid almost the whole change.** The grid **already computed** every
visible shop's cheapest active `starting_price_php` — the same figure, a few
lines above — and `vendor-card.tsx` has always been able to render
`Starts at ₱X` for any shop. One ternary threw it away for everyone but demo
rows:

```ts
v.starting_price_php = v.is_demo === true && svc?.startingPrice ? … : null;
```

Its comment cited the **2026-05-16 hide-prices lock**, which was **superseded on
2026-07-16** by `hide_prices_publicly` — an opt-in-to-HIDE flag defaulting to
show — and the shop's own page has honoured it ever since, printing *"from ₱X"*
on every service card. The grid was the one screen that never got the memo, and
its comment said so in terms: *"V1.1 candidate … once the hide-prices lock is
reconsidered (owner decision pending)."* It has been reconsidered.

**Showing it here discloses nothing** a visitor could not read one tap later on
the shop's own page.

**The dangerous direction is not "no price" — it is showing one a shop opted out
of.** A shop that ticked *hide my prices* has them blanked on its own page; if
the grid did not ask, the same shop would have its prices printed on the
marketplace — a control honoured only on the way in. So:

- `payloadHidesPricesPublicly` + `fetchVendorsHidingPricesPublicly` are new in
  `lib/vendor-service-attributes.ts` — **one rule, two callers.** The shop page's
  own per-vendor reader now calls the shared predicate instead of testing the key
  itself; a guard fails if either surface re-implements it.
- The grid reads it **once per page**, not once per card.
- It **fails open** (empty set → everybody shows), deliberately and unchanged: a
  transient read failure must never blank the price of every shop on the
  marketplace.

**Not changed:** demo cards keep their own label and styling; the couple's
in-dashboard search is untouched; no ranking changed in this PR.

**Measured** · typecheck 0 errors (exit 0) · prod: 2 service cards, both on a
hidden fixture shop, both with no price — so no shop's price appears on the grid
today and nothing a visitor sees changes until a real shop publishes a priced
card.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-28 — the 2026-05-16 hide-prices lock is
recorded as superseded on the marketplace grid, the last surface still citing it.

## 2026-08-29 · feat(onboarding): the set-up price shows its own arithmetic

Owner, 2026-08-29: *"on the onboarding payment. show the regular price. the total
discount given. how much you saved."*

The services step's total block already knew all three figures and showed one of
them. The regular price was a sentence in the small print under the card, the
discount was never named at all, and "Your total today" was a number a person had
to take on trust. It is a ledger now, in the order a receipt reads:

```
Papic                          ₱49
Setnayan AI              Not added
──────────────────────────────────
Regular price                  ₱70
Set-up discount · 30% off     −₱21
──────────────────────────────────
Your total today               ₱49
You save ₱21 by setting up now. The same things cost ₱70 if you add them
later — this price is only while you're setting up.
```

- **No new price maths.** `laterPhp` and `savingPhp` already existed and are
  unchanged; only the percentage is new, and it is derived from those two.
- **The percentage is FLOORED, never rounded.** Rounding 29.6% up to "30% off"
  claims a discount we did not give, on the one screen where somebody is about to
  hand over money. Flooring can only under-state our own offer.
- **It still cannot invent a "was" price.** Every rung's `listPricePhp` collapses
  onto its `pricePhp` when that rung carries no sign-up discount, so `savingPhp`
  is 0 and the whole ladder disappears with it — a catalog with no discounts
  renders exactly the old screen.
- The duplicated saving row is gone: the discount is a line in the subtraction,
  and the saving is stated once, in words, under the total.

Guard `lib/onboarding/ten-percent-if-you-add-it-now.test.ts` grew two tests — the
three lines exist and appear in receipt order, and the percentage is floored (with
a worked example, so the rule survives a refactor of the expression). Its
source-matching helper now collapses whitespace: the rendered sentence wraps, and
a guard that goes red on re-wrapping teaches you to edit the guard instead of
reading it. **5 mutations, all measured, all red** — deleting the regular-price
row (1→0), rounding instead of flooring (1→0), dropping the discount amount
(1→0), dropping the saving sentence (1→0), and swapping the total above the
ladder (measured by index, not by count — a reordering mutation cannot be
measured by counting a string).

SPEC IMPACT: `DECISION_LOG.md` row 2026-08-29 — the onboarding total shows
regular price, discount and saving as a subtraction. No price, SKU or discount
rule changes.

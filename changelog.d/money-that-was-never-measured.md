## 2026-08-19 · fix(budget): a refused payments read no longer bills the couple again

`fetchVendorBudgetSummary` fires three reads and checked the error on exactly ONE
of them — the vendor row. The other two took `?? []`. Supabase RESOLVES with
`{ error }` rather than throwing, so a refused payments read arrived as
`data: null`, became an empty payment list, and:

    paidTotal = 0   →   remaining = itemizedTotal   (the FULL amount)

A couple who had paid ₱150,000 of ₱200,000 saw **Paid ₱0** and
**Remaining ₱200,000**.

🔑 THE WORST SHAPE OF THIS DISEASE, because the output is not a missing list —
it is a DEMAND. And the two figures are not independent: one refused read moves
both, which is why the card now hides them together rather than showing a
truthful budget beside a fabricated balance.

⚠ `fetchBudgetSnapshot`, three functions down, makes the OPPOSITE choice and is
correct: it THROWS on all three read errors, so its summaries are honest by
construction and set both flags true. The flags exist for the loader that cannot
throw — not to soften the one that does. A test pins all three throws.

SPEC IMPACT: None.

Follows the precedent set by `vendor-dashboard/reads-are-honest.test.ts`
(2026-08-18, supplier side) and `lib/guests.ts` (2026-08-19, couple side).

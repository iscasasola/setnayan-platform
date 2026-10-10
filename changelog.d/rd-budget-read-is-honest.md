## 2026-10-08 · fix(budget): the money resolver says which reads answered (Budget B0)

Plan row **B0** of `BUDGET_PAGE_2026-10-08_fable.md` (owner-approved: "budget looks good!"). No UI change.

**The defect.** `resolveEventMoney` (`apps/web/lib/budget-truth.ts`) turned every refused select into `data ?? []`. Supabase resolves with `{ error }` instead of throwing, so a refused `orders` read arrived as "no orders" and the Budget page painted **Agreed ₱0** and an empty group to a couple who had paid for three things — byte-identical to an event that had bought nothing. Same disease the guest list (`guests-read-is-honest.test.ts`) and the supplier dashboard (`reads-are-honest.test.ts`) were cured of.

**What changed**

- `EventMoney.reads: MoneyReadStatus` — `{ suppliers, orders, costs }`, each `'ok' | 'failed'`, set per source INSIDE `resolveEventMoney` and handed to the pure core (`MoneyInputs.reads`). One key per group the new Budget list draws.
- `rowsOrRefused()` replaces every `res.data ?? []` in the resolver: a refusal is `null`, never `[]`, and each one is logged through `logQueryError` with its table. A MISSING `orders` / `event_costs` relation stays a tolerated answer (no rows can exist), as before.
- One refusal anywhere in the supplier set (`event_vendors`, line items, payments, the locked-package total, a throw from the pricing lookup) fails the whole supplier group and the group contributes nothing — a supplier row drawn without its payments reads "₱0 paid", which is a wrong number, not a partial one.
- `knownMoneyTotals(money)` — the reading a summary uses: `agreedPhp` / `paidPhp` are `null` (unknown, never 0) when any source was refused; `owedAtLeastPhp` is the floor across the sources that did answer.
- `resolveEventMoneySettled()` — never rejects; a throw comes back with all three reads `'failed'`. `resolveEventMoney` itself still rejects, so its other callers (export route, Home lens, AI snapshot) behave exactly as before.
- `budget/page.tsx` stops `.catch(() => null)`: it asks the settled form and treats a ledger with a refused source as it treated an absent one (legacy strip figures, category table withheld, "could not load your own recorded costs"). Before this, a refused-but-not-thrown read printed partial totals as if whole.

**Guard:** `apps/web/lib/budget-read-is-honest.test.ts` (13) — drives the real resolver over a per-table stub client; a refused `orders` read must report `reads.orders = 'failed'` and `knownMoneyTotals().agreedPhp === null`, never 0. Six sabotages seen red (status hard-coded ok · `data ?? []` restored · status computed but not passed to the core · refused payments still drawn · a number stated on a partial ledger · page ungated).

**Not covered, stated:** `buildVendorPricingLookup` (`lib/budget.ts`) still swallows its own refused selects internally; only a throw from it fails the supplier read. The target (`events_host`) read is logged when refused but is not one of the three keys.

SPEC IMPACT: None — implements `BUDGET_PAGE_2026-10-08_fable.md` §3 "Honest read" / §5 row B0 as written.

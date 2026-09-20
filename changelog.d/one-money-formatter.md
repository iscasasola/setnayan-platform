## 2026-09-20 · fix(money): one peso formatter, and a guard so a second one cannot come back

PR #5744 fixed `lib/orders.ts`'s `formatPhp` after a real ₱837.50 booking fee printed as
**₱838**. PR #5756 found three places that rounded money *before storing it* and named the
mechanism: `lib/vendor-service-payment-schedules.ts` exported `centavosToPhp` as
`Math.round(centavos / 100)` beside an identically-named, correct function in `lib/payouts.ts`.
This PR sweeps that mechanism out of the display layer.

**Measured on `origin/main`, 2026-09-20 — `formatPhp` was defined FOUR times in two behaviours:**

| module | behaviour |
|---|---|
| `lib/orders.ts` | exact — ₱837.50 (PR #5744's) |
| `lib/budget.ts` | `maximumFractionDigits: 0` → **₱838** |
| `lib/vendors.ts` | byte-identical to `budget.ts`'s |
| `lib/vendor-autoreply/answer.ts` | `Math.round(php)`, and `''` (not `—`) for an absent figure |

…and `formatCentavosPhp` THREE times: `lib/payouts.ts` kept the centavos, while
`lib/vendor-packages.ts` and `lib/sku-catalog.ts` did `Math.round(centavos / 100)` — **one
centavo rendered as ₱1**. `formatCentavos` existed twice more.

🔑 **The call site reads the same either way.** `formatPhp(owedPhp)` is the same fourteen
characters whichever module the import line above it names. Nothing goes red, because both
definitions are correct TypeScript and both are correct for *something*.

### What changed

- **New `apps/web/lib/php.ts`** — the one definition of `formatPhp` (exact), `formatCentavosPhp`
  (the same rule, entered in centavos) and `formatPhpRounded` (the band formatter, which must
  say `@rounds-to-the-peso` and why).
- `lib/orders.ts`, `lib/payouts.ts`, `lib/vendor-packages.ts`, `lib/sku-catalog.ts`,
  `lib/journal-spotlights.ts` and `lib/vendor-proposals.ts` now **re-export** from it under
  their existing names — ~50 importers untouched, one definition behind all of them.
- `lib/budget.ts` and `lib/vendors.ts` lost their `formatPhp`; **41 call-site files** were
  classified one by one and re-pointed: real money (and totals derived from it) to `formatPhp`,
  targets/bands/allocations to `formatPhpRounded`.
- Two sites rounded *before* handing the figure over — `overview-sections.tsx`
  (`formatPhp(Math.round(card.totalCentavos / 100))`) and `conversion-deals-card.tsx`
  (`Math.round(deal.totalContractPhp)`) — both removed.
- `lib/proposal-amendments.ts#pesoLabel` used a bare `toLocaleString('en-PH')`, which is Intl's
  default: three decimals and a dropped trailing zero, so ₱1,837.50 read **−₱1,837.5**. It now
  delegates; only the typographic minus is local.
- `lib/vendor-autoreply/answer.ts` renamed its pair to `formatPhpApprox` /
  `formatCentavosPhpApprox` — a third null behaviour under a shared name.
- Seven helpers that legitimately round now carry `@rounds-to-the-peso` **and the reason**;
  one carries `@not-a-money-rounder` because its `maximumFractionDigits: 0` is on a photo count.
  `lib/comp-grants.ts`'s docblock claimed it "keeps centavos" while doing `Math.floor(c / 100)` —
  corrected.

### The guard

`apps/web/lib/security/money-formatter-scan.ts` + `.test.ts` + `money-formatter.baseline.txt`
(house pattern: `scripts/dup-rule.baseline.txt`). **R1** — no two *definitions* of a money
helper may be exported under one name; a re-export is not a definition, which is what lets a
name stay where its importers already look. **R2** — a helper that drops the fraction must carry
a documented reason. The baseline may only shrink (size pinned at 3 rows); `formatPhp`,
`formatCentavosPhp` and `formatCentavos` are paid down to zero and may never re-enter it.
Twelve tests, each sabotage-proven; both formatters are *executed* on ₱837.50, never grepped.

### Honest limits

- Measured on production 2026-09-20 (read-only): `event_vendor_line_items.amount_php` (18 rows),
  `event_vendor_payments.amount_php` (5), `event_vendors.total_cost_php` (49) and every
  `*_centavos` price column carry **no centavo-bearing row today**. The one live centavo-bearing
  money row is in `payments` / `orders` — the owner's ₱837.50 fee, already fixed by #5744. So the
  budget and package sides are belt-and-braces; centavos are reachable *by construction*
  (`NUMERIC(12,2)`, and `accept_vendor_proposal` writes `total_cost_php = centavos / 100.0`), not
  by accident. `event_costs` is different: `parseCostAmountPhp` deliberately keeps 2dp, so a
  couple can already type ₱837.50 into a supplier-less cost and read ₱838 back.
- The two `centavosToPhp` / `phpToCentavos` collisions are **left in the baseline on purpose**:
  open PR #5756 rewrites those exact lines. The follow-up that folds the schedule helpers into
  `lib/php.ts` belongs in its own PR.
- `lib/supplies/pricing.ts#formatRetailLabel` rounds a **price a customer pays**, on the strength
  of a convention rather than a constraint. All 43 live `service_catalog` rows are whole pesos, so
  it is accurate today. Flagged in its docblock for the owner, not silently changed.

SPEC IMPACT: None. Display formatting and a repo guard; no schema, price, SKU or copy decision
changes. The peso rendering rule is unchanged from the one PR #5744 already standardised on.

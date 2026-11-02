## 2026-07-27 · feat(budget): BUD-1 — the shared money resolver (read-only, nothing wired yet)

`/budget` currently prints **two contradictory totals eight inches apart** — verified
on prod event `044f7e64…`: **"Total to pay ₱80,000"** directly above **"Committed ₱0"**
plus the empty state *"You're still choosing vendors"*, with that ₱80,000 vendor's card
not rendered at all, so the couple cannot find, edit or delete the number driving their
own headline. Cause: **seven surfaces compute "the budget" with five incompatible
formulas.** This ships the one calculator they will all ask instead.

**New — `apps/web/lib/budget-truth.ts`:**

- `resolveEventMoney(client, eventId)` → `{ targetPhp, estimated, committed, paid,
  stillOwed, overpaid, isOverBudget, overBudgetByPhp, byBucket[], lines[], sources[],
  warnings[] }`, per BUILD SPEC §18.1. Pure core (`computeEventMoney`) + thin
  fetch-then-delegate wrapper, so the arithmetic is testable without a database.
- Integer-centavos internally so the reconciliation is exact; PHP on the public shape.
- **Setnayan-booked spend enters as read-only LINE ROWS**, not a lone statistic
  (today it reaches exactly one stat on one page).
- **Vendor spend keeps the shipped `itemizedTotal` precedence** (`lib/budget.ts`
  ~:636-645 — package · service · manual · legacy headline), corrected per R4/R12
  rather than replaced.

**Defects closed inside the resolver:** R3 (package cascade billed N+1 times —
`package_role` has been written since `20271009160000` and read by nothing) ·
R4 (package priced from Σ`replacement_value_centavos` instead of the agreed total) ·
R5 (transport + crew meals invisible to `/budget`) · R8 (archived vendors still
spending the couple's money) · R11 (`paid + stillOwed ≠ total` when a vendor is
overpaid) · R12 (`> 0` branch test silently discarding credits).

**Honesty rules (§18.5) enforced in code:** estimates never enter `committed` or
`stillOwed`; unknown benchmarks report `null`, never ₱0 (13 of 27 active leaves are
unseeded, **including `ceremony_venue`**); "over budget" has one meaning and only the
resolver says it; every figure carries provenance in `sources[]`; excluded rows are
named in `warnings[]`, never silently dropped.

**THE INVARIANT — `committed + overpaid = paid + stillOwed`** — asserted by
`checkMoneyInvariant()` on every result and by the unit suite on every fixture. A
mutation test proves the assertion bites (breaking the total turns 11 tests red).
⚠ §18.5 rule 6 writes this as *"Committed = Paid + Still owed + Overpaid"*, which is
**mis-signed** and cannot hold (₱100k committed / ₱120k paid would claim 100 = 140);
the reconciling form is `committed = paid + stillOwed − overpaid`. Same three figures,
same intent, sign corrected.

**Parity harness — `apps/web/scripts/budget-parity.ts`** (+ redacted prod capture at
`scripts/fixtures/budget-parity-prod.json`). Prints old-vs-new per surface so BUD-2..
BUD-8 can prove they changed each number *to the right one*. Real deltas today:

| Event | Surface | Today | Resolver |
|---|---|---|---|
| `947e7bab…` | Checklist health · Committed | **₱0** | **₱810,000** (R2, live) |
| `947e7bab…` | Allocation planner · sees committed | **₱0** | **₱810,000** |
| `044f7e64…` | Live card + Merkado lens · Total to pay / To go | **₱80,000** | **₱0 committed, ₱80,000 estimated** |

**Two prod findings that correct the spec** (both would have shipped bugs):
- §18.1 names an order status `pending_payment`; the `order_status` enum has no such
  value — the correct one is **`awaiting_payment`**. `submitted` is mapped to
  *estimated*, per the SKU activation gate (activation is on admin approval).
- R6's proposed `deposit_paid_php` → `event_vendor_payments` backfill would
  **double-count on live data**: all three prod deposits (₱67,500 / ₱24,000 / ₱20,000
  = ₱111,500) already exist as identical payment rows on the same vendors. The
  resolver treats the legacy field as a **fallback, never additive**, and flags a
  mismatch instead. BUD-4 must reconcile before it backfills.

Read-only. No schema, no UI, no surface wired — that is BUD-2 onward. The only edit
outside the new files is `export` on `buildVendorPricingLookup` / `VendorPricingLookup`
in `lib/budget.ts`, so the resolver reuses the shipped catalogue-pricing resolution
instead of duplicating it.

SPEC IMPACT: `Explore_Replan_BUILD_SPEC_2026-07-27.md` §18.1 (the `pending_payment`
→ `awaiting_payment` correction), §18.5 rule 6 (the mis-signed invariant), §18.5 rule 5
(13 of 27 unseeded leaves, not 12 of 26), and §18.6 BUD-4 (the deposit backfill would
double-count). Applied to the corpus alongside this PR.

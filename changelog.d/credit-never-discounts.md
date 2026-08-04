## 2026-07-26 · fix(packages): credit SHIFTS, it never discounts — 'refundable' retired

Owner-locked 2026-07-26: **"credits can be shifted to other services, but will
not discount the price."**

That settles a question the engine had flagged **open**. `package-credit.ts`
carried this against `unspent_credit_policy = 'refundable'`:

> ⚠ *'refundable' IS AN UNVERIFIED SEMANTIC — OWNER DECISION OPEN. Read literally,
> 'refundable' refunds the WHOLE unspent pool — which includes
> `consumable_budget_centavos`, money the sticker price already charged for… It
> also means removals cut the price, which contradicts the model's own pillar
> ("changes WHAT you get, not what you pay").*

### What it was actually doing

Measured on the seeded shape (₱1,400,000 package, ₱200,000 consumable budget),
for a couple who customized **nothing**:

| policy | couple pays | inclusions delivered |
|---|---|---|
| `expiring` | ₱1,400,000 | all |
| `refundable` | **₱1,200,000** | **all** |

₱200,000 given away for doing nothing. The pool is spending power *inside* the
package, not a discount to bank.

### The change

- `UnspentCreditPolicy` is now a **single value** — `'expiring'`.
- `creditRefundCentavos` is pinned at **0** and the discount arithmetic is gone.
  The field stays in the result so every consumer still reconciles
  `bookingTotal === basePrice + overspend − creditRefund`.
- The DB CHECK is tightened to `= 'expiring'`, so a discount policy cannot even
  be **stored**. A row still carrying `'refundable'` makes the engine **refuse**
  (`invalid_package`) rather than quietly discount — fail loud, not silent.
- The adapter normalises anything else to `'expiring'`, so both the read path
  and the compute path land on "the couple pays full price".

**Unspent credit is forfeited**, and the tests say so in those words.

### Tests that changed, deliberately

`package-credit.test.ts` had a block headed *"'refundable' semantics — PINNED,
pending owner confirmation"*, noting: *"If the owner confirms the other reading,
these two tests are the ones that change — deliberately loud."* The owner
confirmed. They changed, and now assert the opposite: a zero-customization
booking pays the **full** sticker price, and the retired policy **refuses**.

### 🔧 Also repairs `main`, which is currently red

`main` is failing at `4b06e2153` (#3761): the committed exposure baseline is
internally inconsistent — its header declares 6151 facts while the body holds
one more. Regenerating it here fixes that; the only delta is the count line, no
capability changed.

**Verification:** 4122 unit + **375 DB** green (was 373 with 2 failures),
`tsc --noEmit` exit=0, `next lint` exit=0. Prod holds 0 packages, so no row
carries the retired value and nothing needed backfilling.

SPEC IMPACT: closes the "unverified semantic" flagged in `lib/package-credit.ts`
and in `Vendor_Package_Credit_BUILD_SPEC_2026-07-26.md` (which still discusses
`'refund'`). ⚠ Note this does **not** answer the separate M2 question of
**signed option deltas** (downgrade credits) — that remains an explicit owner
decision, and the DB still refuses negative deltas.

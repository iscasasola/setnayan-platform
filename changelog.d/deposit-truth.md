## 2026-09-19 · fix(money): the deposit amount has one reader — the payment log, through `lib/paid-to-vendor.ts`

The couple's "Record deposit" writes the amount to `event_vendor_payments` (stamped `is_deposit_record`)
and never to `event_vendors.deposit_paid_php`. Screens that read the column showed no deposit on a
recorded, supplier-confirmed ₱2,000 (rosa-ben · Saysay, prod) — including Setnayan's own deposit-dispute
queue, which printed "Couple recorded —" for EVERY dispute (only couple-recorded deposits can be refused).

- New `lib/paid-to-vendor.ts` — `paidToVendorCentavos/Php` (the log wins; the legacy column only when
  the log has no row; never additive — the rule `computeEventMoney` already used, lifted out) and
  `recordedDepositPhp` (the `is_deposit_record` row). The amount half of #5670's `bookingMoneyMoved`.
- Routed through it: `lib/budget-truth.ts`, both `paidTotal`s in `lib/budget.ts` (which ignored the
  legacy column — now agrees with `/budget`), the workspace "Paid so far", the admin deposit-dispute
  card and its settlement audit row.
- Removed two carriers of the wrong fact: the unread `PlanCardPick.deposit_paid_php` and the caller-less
  `computeVendorStats` (summed the column only).
- Lock pop-up copy: "Pay the downpayment to lock" / "Lock & submit downpayment" → "deposit" (no locked
  term in DECISION_LOG.md; the workspace, "Record deposit" and the ledger all say deposit).
- Guard `lib/deposit-fact-has-one-reader.test.ts`: executes the rule, pins every file that names the
  column with its count, and fails any `<row>.deposit_paid_php` not passed straight into the shared rule.

Chose DERIVE-FROM-LOG over "also write the column": prod's log already holds every deposit (all 3 legacy
figures have a matching log row; the 1 recorded deposit has its row and a NULL column), so there is no
backfill, no migration and no second copy of one number. Agrees with AREA-VENDOR #5672/#5680/#5684,
which also read the supplier side from the log.

SPEC IMPACT: None

## 2026-09-03 · feat(budget): the ledger says what is due and when

Each category row in the per-category ledger (BA3) now carries a chip for its
most urgent unpaid milestone — a supplier, an amount, and the days spelled
out ("5 days overdue", "due today", "due in 6 days") instead of a bare date.
A roll-up in the ledger's own header (not the top-line meter, which BA4 owns)
sums what is overdue and what falls in the next 30 days across every row.

Three tiers, all read from BA5's `paymentDueState` / `TRIGGER_THRESHOLDS`
(`lib/setnayan-ai-triggers.ts`) via `MoneyLine.dueState` and `MoneyBucket.due`
— overdue, due within the 7-day window GRD-01 emails on, and due within the
30-day horizon `upcomingDueAmount` has always used. Nothing here compares a
day count against a threshold of its own:
`the-ledger-reads-one-clock.test.ts` fails CI if it ever does, sabotage-tested
so the detector is proven able to fail.

`lib/budget-ledger.ts`: `BudgetLedgerRow.nextDue` (the row's most urgent
unpaid line), `dueSoonPhp`/`dueSoonCount`/`upcomingPhp`/`upcomingCount` on
both the row and `BudgetLedger.totals`, and `daysUntilDueLabel` — pure
formatting, no threshold of its own.

SPEC IMPACT: None. Presentation of already-shipped BA3/BA5 data; no new
schema, no new threshold, no change to what "overdue" or "due soon" mean.

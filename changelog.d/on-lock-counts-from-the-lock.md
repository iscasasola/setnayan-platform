## 2026-09-21 · fix(payment-plan): "after lock" counts from the day the couple clicks Lock

Owner, asked what a self-added supplier's "N days after lock" instalment counts
from: *"on the date you clicked on lock"*.

It counted from the day the supplier was **added** (`event_vendors.created_at`)
— the only date there was, since a self-added supplier never handshakes and
nothing recorded the lock. A venue added in March and locked in June got a
"7 days after lock" payment dated in March.

- **New column** `event_vendor_payment_plan.on_lock_anchor_date` (DATE, null
  until locked). A column on the plan, not `event_vendors.locked_at`, so it
  cannot become a second answer to "when was this booked?" beside
  `lock_agreed_at`.
- **At Lock** (`finalizeVendor`, off-platform only): the day is stamped — the
  Manila day, so a 7am lock is not "yesterday" — and the couple's kept plan is
  re-dated to it (`redateOnLockInstalments`). Only "after lock" dates move;
  money, labels and "before the event" rows stay. A legacy instance with no
  stored rule is left as it was. The marketplace path keeps its existing UTC
  day — changing it is a separate call.
- **Editing later** (`saveSelfAddedPaymentPlan`) reads the stamped day back
  (`onLockAnchorIso`), so a re-save months later never slides a date. Before
  the lock, dates show as if locked today. An unreadable anchor refuses rather
  than guessing today.
- The sheet's dropdown said "after booking" — which reads as "after I added
  them". It now says **"after you lock"**.

Guards: `the-plan-counts-from-the-lock-day.test.ts` (new) and
`locking-keeps-the-couples-plan.test.ts` — its "skips the upsert" assertion
re-pointed at the property that survives (the keep branch UPDATEs in place and
never writes the computed estimate), plus the lock-day stamp on all three
paths. Four sabotages, each red.

Exposure baseline: one line accepted — the new column carries exactly the
grants of its seven siblings on the same RLS-gated table (a column-level REVOKE
under a table grant would be a no-op).

SPEC IMPACT: `DECISION_LOG.md` — (l) a self-added supplier's "after lock"
instalments count from the day the couple clicked Lock (owner, 2026-09-21).

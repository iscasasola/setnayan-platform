## 2026-08-05 · feat(admin): settle reviews and payouts from the work list, with the details each one requires

Steps 3 and 4 of the act-from-the-list work. Two more queues can now be settled
without leaving `/admin/work` — but neither gets a button, and the code is why.

- **Reviews** — `overridePublishReview` throws *"Override reason is required
  (1–4000 chars)"*. Publishing over a couple's contested review moves a vendor's
  public star rating and belongs on the record with its why, so the drawer
  renders a required reason field beside a **Publish** button.
- **Payouts** — `markPayoutPaidAction` needs the METHOD and the REFERENCE of a
  transfer the admin already made by hand. A money record without its reference
  cannot be matched to a bank statement later, so the drawer renders a method
  picker and a reference field. ⚠ Nothing here moves money; it writes down that
  a transfer already happened outside Setnayan.

Both delegate to the pages' own actions, so the list and the page can never
drift on what the decision means. New `PeekForm` type in `lib/admin/queue-peek.ts`
describes the fields beside the query that produced the row — one place, not two.

🔑 This corrects an earlier classification of mine: reviews was filed as a FACT
queue (one click) until reading the action showed it refuses to run without a
reason. The taxonomy is decided by what the code demands, not by how the queue
feels.

⚠ Payout column names were wrong on the first pass (`net_centavos`,
`payout_stage`, `scheduled_at`, `status`); the real ones are `amount_centavos`,
`stage`, `trigger_date`, `released_at IS NULL`. Caught by
`lib/security/select-column-scan.test.ts` — the same guard that caught three
wrong payment columns last week. A Supabase select naming a phantom column
returns an error, not a crash, so both would have shipped as a silently-empty
drawer.

SPEC IMPACT: None — DECISION_LOG 2026-08-04 already records the fact/judgement/
needs-details split this implements.

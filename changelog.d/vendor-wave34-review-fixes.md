## 2026-06-29 · fix(vendors): Wave-3/4 adversarial-review security + money + concurrency fixes

Ship the six code-substantiated bugs found in the Wave-3/4 vendor-benefits
adversarial review as one focused change. Five are a single idempotent migration
(`20270323841750_wave34_review_fixes`); one is app-code. The full migration was
validated against prod in a `BEGIN…ROLLBACK` dry-run (every fix executes clean;
Fix A's trigger was additionally proven to BLOCK a direct `authenticated` ack
write while still ALLOWING the owner/DEFINER-RPC path and the couple's legit
`deposit_recorded_at` write).

- **A (HIGH) — couple could forge the vendor's deposit acknowledgement.**
  `event_vendors.deposit_acknowledged_at` is vendor-set only (via the SECURITY
  DEFINER `acknowledge_vendor_deposit` RPC), but the couple `FOR ALL` RLS had no
  column restriction. The specced column-REVOKE does NOT close this — both
  `authenticated` and `anon` hold a TABLE-WIDE `UPDATE` grant on the table, which
  confers UPDATE on every column regardless of a column-level revoke. Fixed with
  the prompt's safer alternative: a `BEFORE UPDATE` trigger
  (`guard_event_vendor_deposit_ack`) that rejects any change to the column when
  `current_user IN ('authenticated','anon')`. The DEFINER RPC (runs as owner
  `postgres`) and `service_role` pass; direct PostgREST forge attempts are
  rejected.
- **B (HIGH) — credit/removal change-order inflated the couple's budget.**
  `accept_change_order` settled `ABS(delta)` into `event_vendor_line_items`
  (which had `CHECK (amount_php >= 0)`), so a removal stored a positive amount and
  `lib/budget.ts` treated a credit as money owed. Dropped the non-negative CHECK,
  re-defined `accept_change_order` to settle the SIGNED delta, and skipped
  non-positive line items in the budget `.ics` export so a credit never emits a
  spurious "Payment due" calendar event. Manual couple entry still validates
  `> 0` at the app layer (`parseRequiredMoney`) — only change-order credits can
  produce a negative line. (The budget reducers already sum signed, so a negative
  correctly REDUCES the total + upcoming-due amount.)
- **C (MEDIUM) — No-Show policy-ack evidence was couple-forgeable.** Dropped the
  unused `event_vendor_policy_acknowledgements_host_insert` authenticated policy
  (the real writer is the service-role admin client, which bypasses RLS); kept
  the `_host_select` read policy.
- **D (MEDIUM) — `recordDeposit` double-counted the payment ledger.** The marker
  was COALESCE-idempotent but the `event_vendor_payments` insert ran
  unconditionally, so a re-record/retry landed a duplicate payment row. Guarded
  the insert on `if (!ev.deposit_recorded_at)` to match the marker's idempotency.
- **E (LOW) — `advance_schedule_block` START cross-row TOCTOU.** Two concurrent
  STARTs on different upcoming blocks could both go live. Added a partial-unique
  index `event_schedule_blocks_one_live_per_event (event_id) WHERE
  run_state='live'` so the second commit fails at the DB level.
- **F (LOW) — waitlist couple UPDATE policy too permissive.** Recreated
  `vendor_date_waitlist_couple_update` so a couple can only keep `pending` or
  self-`cancelled`; vendor-only states (`notified`/`converted`) stay service-role.

SPEC IMPACT: None. Hardening of already-shipped Wave-3/4 vendor surfaces — no
behavior the specs describe changes (a credit change order now correctly reduces
the budget instead of inflating it, matching the change-order trail's documented
"signed delta" intent).

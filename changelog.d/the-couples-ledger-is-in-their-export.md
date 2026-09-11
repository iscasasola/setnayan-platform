## 2026-09-11 · feat(privacy): the couple's payment ledger is in their RA 10173 data export

The data-subject export (`app/api/profile/export/route.ts`) did not include the
payments a couple logs against their suppliers. The guardrail listed
`event_vendor_payments` as excluded, and listed `event_vendors` with a reason
claiming bookings were "already reachable in an export through the EVENT". That
was never true: the route read neither table. The orchestrator ruled the ledger in
(2026-09-11).

- **New `payment_ledger` section:** every payment the couple logged on an event
  they OWN.
  - It contains the amount, date, method, reference and notes; whether the
    supplier confirmed it; and, since H4, the supplier's "it never reached me"
    and Setnayan's ruling, all of which the couple already sees.
  - Each row names the supplier it was paid to (`paid_to`: business name and
    category, from a narrow read of `event_vendors`).
  - Receipts get a presigned `receipt_link`, a `receipt_link_expires_at`, and
    the durable `proof_r2_key`, so a downloaded file doesn't look broken later.
- **Couple scope:** the same couple-owned events as the birth data. Those event
  ids are now resolved once and shared by all three couple-level sections, and
  read on the session client, where the couple read policies are a second bound.
  A coordinator on someone else's event exports none of it.
- **Withheld, each with a reason:** the three account ids of other people
  (`vendor_confirmed_by`, `payment_refused_by_user_id`,
  `payment_dispute_settled_by_user_id`). What those people recorded IS exported.
  `not_included` says so.
- **Guardrail changes:**
  - `event_vendors` and `event_vendor_payments` move to exported, and the false
    reason is gone.
  - New **T14:** the ledger projection is complete against the migrations,
    checked by equality as T12 does for `vendor_profiles`.
  - New **T15:** both reads are bounded to the couple's own events and read on
    the session client.
  - Mutation-checked 4 ways.
- `lib/export-payment-ledger.ts` is pure (the projection, what is withheld and
  why, and row shaping) and has its own unit test.
- The deposit-refusal history (#5453) stays excluded as Setnayan's referee
  record.

SPEC IMPACT: None.

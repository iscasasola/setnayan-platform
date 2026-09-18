## 2026-09-18 · chore(booking): retire the booking-lifecycle ends nobody needs — three tables and six functions with only one end (S36)

Session S36 re-measured the booking-lifecycle tier of S26's both-ends baseline
(`apps/web/tests/db/ugat-both-ends.baseline.txt`, PR #5625). For each orphan
the question was **join the missing end, or delete the end nobody needs**. These
nine are deletions, each because an owner ruling or a shipped replacement had
already made the missing end impossible. Migration `20271234094457`.

**Measured in prod first (2026-09-18):** all three tables held **0 rows**; none
has an inbound foreign key; none of the six functions has a caller in the app,
in a policy, a trigger, a view or another function body.

- **`vendor_contract_signatures`** (+ `vendor_contract_check_fully_signed()`):
  owner, 2026-05-18 — *"we will not make contracts for them."* Contracts are
  upload-only; the Contracts page already says Setnayan does not facilitate
  signatures. The table never had a writer. `vendor_contracts` and its status
  vocabulary stay.
- **`couple_waitlist_signups`:** Setnayan went live for couples on 2026-07-24;
  `/waitlist` became a "start now" page and its action was deleted. The
  erasure delete-by-email rule leaves with it (a DELETE against a dropped table
  is recorded as an erasure FAILURE). Register and guardrail entries are kept
  but now say DROPPED — the migration parser never reads DROP TABLE.
- **`event_vendor_booth_placements`:** the shipped 3D booth (2026-09-05) places
  through `event_floor_booths`; this foundation was a second home for one fact.
- **`get_pending_inquiry_basics`:** the masked-lead read; the mask was retired
  and the Accept/Decline chips read the same admin-scoped `events` row as the
  header.
- **`unlock_vendor_event`:** owner 2026-07-24, *"your inbox is never locked"* —
  every accept routes to `unlock_vendor_event_free`. The "flag-off path" the
  gated original was kept for does not exist. `_free`, `_hold` and
  `claim_unlock_vendor_event` stay.
- **`get_vendor_thread_summaries`:** built for the Phase-2 native inbox; the web
  inbox names threads through `fetchInquiryCustomerFacts`.
- **`list_vendor_delivery_bookings` · `confirm_guest_delivery` ·
  `undo_guest_delivery`:** a per-guest delivery roster applied to prod by hand
  and back-filled so the guards could see it; once seen, nothing called it. The
  anon-RPC baseline had carried "proposed for DROP" since 2026-08-06. The
  prod-only table `event_service_deliveries` is untouched (no migration owns it).
  The switch only those three read, `vendor_services.per_guest_delivery`
  ("no shipped surface sets" it; 0 of 2 prod rows), is dropped with them —
  the gates-have-handles guard had, correctly, just flagged it as a gate with no
  handle, and a baseline excuse would have kept it on purpose.

**Guards that moved with the schema:** exposure-surface baseline and
`user-fk-behaviour.generated.txt` regenerated; six stale anon-RPC baseline lines
and one refusing-FK baseline line deleted; `anon-table-grants-closed` batch-2
floor 17→16 for the dropped table only; `prod-object-backfill` now guards the
three back-filled functions that remain; `user-delete-blockers` loses the
signature explanation (its test now exercises the supplies-order refusal).

**Left deliberately, for the owner (not engineering):** `feature_reviews`
(specced 2026-05-17, no page or writer ever built, 0 rows), the
`set_service_slot_day_capacity` restaurant capacity RPC (the whole
table-reservation feature is behind a default-OFF flag with no UI yet), and
`finalize_guest_claim` (the OTP/couple-review claim design of 2026-06-10 that
the 2026-09-16 open-joining ruling appears to supersede — retiring the
`guest_claims` subsystem is a bigger call).

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` — one row
recording that the dual e-signature table from the 2026-05-18 rows is gone from
the schema (the decision itself is unchanged: upload-only).

## 2026-08-27 · fix(bookings): a Locked-QR booking finally stamps the link to the shop

**Found while building S3, and it is the same defect PR #4488 fixed in its twin.**

`event_vendors` carries two columns answering one question — which Setnayan shop is this booking? —
and the readers are split across them. `get_vendor_event_brief`, the booked-supplier schedule policy
and the vendor capture policy read `marketplace_vendor_id`. The supplier doorway and desk on the
celebration's own page, editorial first-pick credit, Real Stories credit, Papic attribution,
stage-note recipients, showcase credits, chapter participation and the plausibility scanner all read
`linked_vendor_profile_id`.

🔴 **`vendor_claim_locked_qr` wrote the first and never mentioned the second — on the one path where
MONEY HAS ALREADY CHANGED HANDS.** Read out of production with `pg_get_functiondef`, not from a
migration: `acquire_service_time_slot`, `vendor_agree_to_lock` (since #4488) and the wizard's lock
action all stamp both; this one stamped neither mention of the column anywhere in its body. A
supplier booked by scanning the couple's locked QR was therefore invisible to all nine surfaces
above.

- 🔑 **A clone inherits the bug its twin fixed** — fourth instance of that shape in this repo.
- ⚖ **No owner decision.** It widens nothing: it makes a booking that has already taken a
  downpayment equal to every other booking. The UPDATE arm COALESCEs, so an existing link is never
  overwritten — this write may only ever FILL the column, never move it.
- 🔢 **Safe by arithmetic.** Production holds **zero** locked-QR tokens, ever — none claimed, none
  pending — and zero `event_vendors` rows sourced `vendor_locked_qr`. Nothing is backfilled because
  there is nothing to backfill.
- 🔒 **`CREATE OR REPLACE` restates the WHOLE body**, so two rules this change does not own are
  asserted explicitly rather than assumed: the 2026-08-09 `COALESCE(source, …)` rule (a lock is a
  status change, never a rewrite of how the couple found the shop) and the ORDER of the schedule
  acquire, which must stay after the date-precision narrowing or every claim reserves nothing while
  reporting success.
- ⛔ **`selection_match_rank` is deliberately NOT written.** #4488 set it because an agreed lock
  resolves a marketplace *suggestion*; a Locked QR is a shop bringing its own couple in, so a
  perfect-match rank would be a claim about a suggestion that never happened.

Guard: `apps/web/tests/db/locked-qr-stamps-the-link.db.test.ts` — 7 cases including a
**neutralisation** that puts the old body back and confirms both arms go dark, so the suite cannot
be measuring a fixture something else was linking.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-27 (the correction row already records the finding).

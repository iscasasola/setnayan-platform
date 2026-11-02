## 2026-09-16 · fix(bookings): a booking records WHICH service card it is for

`event_vendors.service_id` was NULL on **48 of 48 rows in production** — every
booking that exists, including a **contracted** one.

**It is not cosmetic.** `setnayan_gift_offered_on` answers *"does this booking carry
the Setnayan gift?"* by joining `vendor_services` ON `event_vendors.service_id`. A
NULL join column matches nothing, so the answer was **FALSE for every booking in
existence** — not because suppliers declined, but because the question could not be
reached. A supplier could switch the gift on and no couple would ever receive it,
with no error, no empty state and no log line.

🔑 **AND FALSE IS EXACTLY WHAT AN HONEST "NO GIFT" LOOKS LIKE.** Nothing failed,
nothing rendered wrong, and the system quietly said no to a question it never asked.
That is this project's recurring disease in its purest form.

**The cause, and why every test missed it.** Both writers that set the column
(`startServiceInquiry`, `unlockCategoryWithInquiry`) set it **only when they
INSERT**. The branch that runs when the row ALREADY EXISTS — the ordinary case,
since a couple usually saves a shop to their picks, or an auto-add creates the row,
before they inquire — updated `requested_service_ids` and nothing else. Any test
that could have caught this would have exercised the insert, where the link was
always correct.

**Proof it was that branch and not an unused feature:** three rows carry populated
`requested_service_ids` (1–2 services each) with `service_id` NULL. The couple named
the service; the request was recorded; the link never was.

Fixed where the couple actually names a service: the update branch now backfills
`service_id` when it is empty. **Only when empty** — a couple may inquire about a
second service later, and overwriting would silently move which card the booking is
for, which is the card the gift, the quote and the bill all read.

⚠ **Existing rows are NOT backfilled by this change.** New inquiries link correctly
from now on; the 48 rows already in production still read NULL. Three of them hold
enough information to repair (their `requested_service_ids`), but one lists two
services and picking the first would be a guess on a contracted booking — surfaced
to the owner as a decision rather than guessed.

Guarded by `a-booking-knows-which-service-it-is-for.test.ts`, which asserts the
UPDATE path specifically — the insert was never the problem — and that the backfill
stays conditional. Sabotage-verified: removing the backfill goes red.

Verified: 15,752 unit tests pass · typecheck clean · 31 CI lint guards green.

SPEC IMPACT: None.

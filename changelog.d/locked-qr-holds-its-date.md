## 2026-08-27 · fix(vendors): a booking made by locked QR holds its date

A supplier booked by scanning the couple's Locked QR — where money has already
changed hands — now reserves that day on their own schedule, so their calendar
and their daily capacity finally agree.

`vendor_claim_locked_qr()` writes `status='deposit_paid'`, one of the three
statuses the pool doctrine counts as BOOKED, and acquired no schedule pool. It
was the only booking path that did not: the couple's lock, the wizard lock and
the slot path all acquire, and the vendor's deposit acknowledgement calls
`acquireSchedulePoolsForBooking`. Added as step (e) of the claim, after the block
that finalises the agreed date — `acquire_schedule_pools` degrades open unless
the event's date is day-precise, so an acquire hoisted above that returns
`no_date` on every claim and reserves nothing while reporting success.

⛔ **Every non-OK outcome degrades OPEN and warns; it never aborts.** The token
is single-use and the money has already moved, so a refusal would strand a
couple who has paid, holding a QR that can never be scanned again — and one
stale manual block is enough to reach it. The acquire runs inside a plpgsql
EXCEPTION block, so even an unexpected error rolls back the reservation alone.

⚠ **Defence-in-depth, not a live bug.** Measured against production before
writing: `vendor_locked_qr_tokens` holds zero rows, ever, and zero
`event_vendors` rows carry source `vendor_locked_qr`. Nobody has been
double-sold a date through this path because nobody has used this path.

Pools resolve by CATEGORY — the claim writes `category` on both branches and
writes no `service_id`, so the category is the only thing the finished row
names. `resolve_schedule_pool`'s junk-pool guard returns NULL unless the vendor
genuinely sells it, which degrades open like any other refusal.

New guard `apps/web/tests/db/locked-qr-claim-reserves-its-date.db.test.ts` — 7
cases including a blocked date, a full pool, a simulated hard throw inside the
acquire, and a neutralisation that restores the abort and watches the blocked
claim start failing. Its fixture seeds a `vendor_services` row on purpose: the
resolver reads that table, not the profile's `services` text[], and without it
the pool never resolves and "the claim was not refused" would be true for the
wrong reason.

SPEC IMPACT: None — no product rule changes. The pool doctrine
(`Customer_Vendor_Marketplace_Architecture_2026-06-04.md` § 4) already said every
booked status consumes capacity; this path was the one that did not obey it.

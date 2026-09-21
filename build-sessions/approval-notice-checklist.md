# Click test · an approval notice follows the payer (PR #5751)

> Its own file, not an append to `AREA-CHECKLISTS-2026-09-18.md`. That shared
> file is append-only and every session appends to its end, so it conflicts on
> essentially every concurrent PR — it cost this PR two CI cycles (a conflicting
> PR runs NO required checks) before the house rule changed. One file per
> checklist; the shared one is being retired.

## An approval notice follows the payer (PR #5751) · 2026-09-20

**What was wrong, in your own words:** you approved the ₱837.50 booking fee (order
`S89O-DW67KBQADN`, ref `SN9B7485DD`) and Saysay got two notices and two emails — every one of
them linking to **Ana & Miguel's planning dashboard**. Saysay is the supplier; that is not their
page. They landed on a **404**, so nothing of the couple's was shown — but they were still sent
somewhere that has nothing to do with them.

**Sign in as the SUPPLIER — testnayan2 (Saysay), by email + password, never the Google button.**

1. Open the bell tray. The two notices about `SN9B7485DD` are the OLD ones and still point at the
   couple's dashboard — **old rows are not rewritten**, so expect them to stay wrong. This
   checklist is about the NEXT payment.
2. As **admin**, go to `/admin/payments` and approve any pending **booking-fee** payment (a
   `vendor_booking_fee__…` order — the supplier is the payer).
3. Back as **testnayan2**, open the bell tray → the new *"Payment of … matched"* row.
   **Tap it.** It must land on **`/vendor-dashboard/booking-fees/<order>`** — the supplier's own
   fee page, with the amount and the payment log. **Not** a 404, and **not** any URL containing
   the couple's event id.
4. The *"marked paid"* row, same thing. Tap it → the same fee page.
5. Read that second notice's **body**. It must NOT say *"We'll start work right away."* Setnayan
   starts no work when you settle a fee you owe us; it should read *"Your booking fee is settled
   — nothing further is owed on it."*
6. Check the **email** for both (if `RESEND_API_KEY` is set in Vercel — if it is not, both send
   nothing, silently). The link in the email must be the same fee page, and the **subject must
   carry the centavos**: *"Payment of ₱837.50 matched"*, never ₱838.
7. **Now prove the couple did not lose anything.** Sign in as **testnayan3** (the couple) and have
   an admin approve any payment on one of *their* orders. The notice must still deep-link to
   **`/dashboard/<their event>/orders/<order>`**, exactly as before, and its body must still read
   *"We'll start work right away."*

**What this does not cover (say so if you want it):**
- Notices emitted from anywhere other than the admin payments desk. The waived-booking-fee
  receipt was swept and is already correct (it uses the vendor lane).
- The two notices already sitting in Saysay's tray from 2026-09-20. Rewriting historical
  `notifications.related_url` rows is a **data** change on production, which a session must not
  make — your call whether it is worth doing at all, given both rows are read.

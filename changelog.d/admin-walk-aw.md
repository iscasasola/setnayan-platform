## 2026-11-14 · fix(admin): admin walk AW-4 · AW-5 · AW-7 · AW-9 — a paid bill stops waiting, one sentence for "nothing sent", founder seats read, plan names

Each was measured in prod before it was fixed.

- **AW-4.** Order `S89O-05E8XMMPF4` was `paid`: its logged payment was matched and a receipt was issued. The bill's own placeholder row (pending, no reference, no screenshot) still stayed `pending`, so Payments listed it as "Pending review" and Work counted "2 waiting" over one real item.
  - One rule now decides it: `paymentStillWaiting` in `lib/payment-logged.ts`. A placeholder on an order already paid is not waiting. A *logged* second transfer on a paid order still is, because that is a double payment.
  - The Work count, the Money badge, the Work drawer, the desk's "To confirm" number and the desk list all go through that rule (`countPaymentsWaiting` digest).
- **AW-5.** Liwanag's ₱1,337.50 bill holds only its placeholder: nothing was sent. Fees owed was right ("Billed — nothing sent yet"). Payments said "Pending review", and that was wrong.
  - The desk now says Fees owed's words for a placeholder, in the row and on the opened payment (`NOTHING_SENT_WORDS`).
- **AW-7.** `founder_seats` has two keys to `users` (`user_id`, `granted_by`), so the bare `users ( email )` embed was ambiguous and PostgREST refused the whole read.
  - The read now names `users!founder_seats_user_id_fkey`.
  - A refused read now says "Couldn't count the open seats — 10 in all" instead of "— of 10 open".
- **AW-9.** Subscriptions printed the raw "solo · monthly".
  - It now prints the plan's catalog name (`vendor_billing_catalog.title`, e.g. "Supplier Plus (4 weeks)"). Vendor plans have no row in `platform_retail_catalog_v2`.
  - Only names are read, never a price. The fallback is words, never a code.
- **Guard:** `lib/admin/the-admin-walk-aw.test.ts`. A sabotage of the AW-4 digest and of the AW-7 embed each turned it red.

SPEC IMPACT: None.

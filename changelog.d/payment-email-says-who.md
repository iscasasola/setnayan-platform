## 2026-09-30 · feat(admin-alerts): the payment email says who, which event, and what

Owner, holding "Payment logged · ₱245 — confirm it": *"i want the email to identify also the name of
the host, event type, event name, and the services availed when we receive an email"*.

- **Payment logged** and **New order awaiting reconciliation** (both `order_awaiting_reconciliation`,
  `lib/order-admin-notify.ts`) now read the order once with the admin client and send: the host's
  formal name + email (the event's hosting accounts, or the order's owner when there is no event), a
  separate "Paid by" when somebody else logged it (a guest settling a Papic reload is named as a
  guest), the event name and type (`event_type_vocab.label_en`), every service on the bill with its
  price, the total owed (`orderGrossOwed`), amount logged, method, the order reference, any bank
  reference, when it was logged (Manila), and the order id.
- Subject (= the in-app title): `Payment logged · ₱245 · Birthday Salubong ni Ate (Birthday) — confirm it`.
- The button (and the in-app link) opens `/admin/payments?filter=all&q=<order public id>` — that
  order on the payments desk, not the homepage. The order id is the only identifier in the URL.
- A fact that cannot be read is said ("Could not read — open the order"), never dropped. If the order
  itself cannot be read, the old one-line alert still sends and says so.
- Admin emails wear an admin footer: "Setnayan HQ · Filipino celebration planning + verified
  suppliers" / "You're receiving this because you're a Setnayan admin." — not the Papic-gallery line
  every branded email inherited. The morning digest gets the same footer.
- Mechanism: `emitNotification` takes an optional `email` (paragraphs, sections, CTA label,
  `audience: 'admin'`); `renderBrandedEmail` renders `sections` as labelled tables and swaps the footer
  for `audience: 'admin'`. Customer emails are unchanged.
- Guard: `lib/admin-payment-alert-says-who.test.ts` renders the real email from a fixture.

- **Customer email footer (owner "yes", 2026-09-30):** the tagline under every branded customer email is
  now "Setnayan · Filipino celebration planning + verified suppliers" (was "Filipino wedding planning +
  verified vendors"). `anniversary-emails.test.ts` pins the new line and holds "wedding"/"vendor" out
  of it. The site SEO titles in `app/layout.tsx` are unchanged (not part of the decision).

SPEC IMPACT: `DECISION_LOG.md` row 2026-09-30 "THE EMAIL FOOTER SAYS CELEBRATION AND SUPPLIERS"
(owner "yes" to the controller's recommendation) — the customer email tagline.

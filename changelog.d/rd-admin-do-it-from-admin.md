## 2026-10-01 · feat(admin/money): receiving accounts are a list · Record a payment received

P5a part 1 of 2 (owner 2026-10-01, ADMIN APP + EVENT HUB PER TYPE — OWNER ANSWERS).

- **Setnayan's receiving accounts become a list.** `platform_settings.receiving_accounts`
  (jsonb, migration `20271258278351`) holds any bank or e-wallet — name · account name ·
  number · QR — in the order customers see them. Today's GCash and BDO fields are copied
  into it once. Admin › Settings › Payment methods now shows one card per account (turn
  on/off, move up/down, remove, edit, QR with "QR says: <merchant name>" read from the
  code), an "Add an account" form, and the GCash/BDO monthly limits. A new account, or a
  new name, number or QR, still waits for a second admin (§ 9.1); the switch, the order
  and the label save at once. Checkout, `/pay`, the Papic guest order page and every
  supplier "Pay with" picker read the list through `lib/payment-channels.ts`; an empty or
  unreadable list falls back to the old GCash/BDO fields, so checkout keeps working.
- **Record a payment received** on `/admin/payments?filter=all&q=<order id>`: when the
  search names exactly one open order, a form records the money (amount · paid into ·
  date · bank reference · note) in the same row shape the customer's own "I paid" writes,
  then confirms it through `approvePaymentCore` — shortfall guard, duplicate rule,
  receipt, payouts and provisioning all run as usual. An intent branch on
  `approvePayment`; no new server action.
- Row 13: approving from a search lands back on that search. Row 16: the Money ledger's
  buyer / payment / receipt reads each say when they failed (the "ours" badge and the
  Received total no longer silently fall back), and each row opens the payments desk on
  that order.
- Approval label: "Change a receiving account (money)".

Guards: `app/admin/payments/record-a-payment-received.test.ts` (new); re-anchored to the
list shape, same properties: `lib/the-receiving-account-has-one-door.test.ts`,
`lib/a-closed-rail-hands-out-no-account-number.test.ts`, `lib/payment-channels.test.ts`
(+5 list tests), `app/_components/payment/one-payment-surface.test.ts`,
`app/pay/one-payment-page.test.ts`.

SPEC IMPACT: None

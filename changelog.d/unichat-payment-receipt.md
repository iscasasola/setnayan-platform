## 2026-11-21 · feat(chat): the supplier-payment receipt document — the hosts' Receipt card gets "PDF"

Stacked on H2 (#8080). The approved Unichat drawing (`unichat_live_v3_2026-11-20.html`) gives the hosts' Receipt card
a PDF; H2 left it out until "a supplier-payment receipt document exists". This is that document.

- **`/receipts/payment/[paymentId]`** — the house receipt slip (`receipt-slip.tsx`) with Save as PDF and Share. Hosts
  only (`event_members.member_type = 'couple'`); only a confirmed, unrefused payment; a refused read is not found.
  Figures are the payment row's, via `receiptOfPayment` (the same arithmetic as the card, split out of `receiptFor`).
- **Receipt card** — "PDF" beside the title (KindCard `action`), only for a host and a found payment. `loadReceipt`
  now reads whether the reader is a host (a coordinator sees the card, not the PDF — as drawn).
- **The slip says it is not an official receipt**: "<shop> confirmed this payment on Setnayan. This is your record of
  it, not an official receipt — <shop> issues that." Setnayan did not sell the service.
- **No number.** The drawing prints `S89R-…`, but `R` is already reviews' and referral codes' type letter. The slip
  shows the hosts' payment reference instead; `ReceiptSlip.number` and `ReceiptPage.back` became optional.
- Stale on purpose (ship controller regenerates): `lib/ugat/screens.generated.json` (one new route).

SPEC IMPACT: None applied — two calls flagged to the controller: (1) a receipt number needs its own type letter;
(2) the "not an official receipt" line.

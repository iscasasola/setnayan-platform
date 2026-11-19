## 2026-11-19 · feat(pay): buyer receipts can be read on the phone — behind a switch that is OFF

A 17 Nov ruling keeps the EXISTING reader for buyer receipts, and the owner has not ruled on swapping it. So the
on-phone read ships dark behind `BUYER_RECEIPTS_READ_ON_PHONE` (`lib/receipt-fields.ts`, `false`). With it OFF,
every buyer path behaves exactly as before: the server reads the screenshot (`readPaymentReceiptFromR2`), and the
admin's "Read it again" runs `runPaymentReceiptRead`.

- **With the switch ON:** Upload Payment Receipt on /pay (gift store orders included) and in the couple checkout
  drawer reads the screenshot ON THE BUYER'S PHONE with #7924's Tesseract.js reader (moved to `lib/on-phone-reader.ts`,
  shared, not forked) and fills amount, date, time and reference for the buyer to correct
  (`app/_components/payment/receipt-read-fields.tsx`). Only the text is posted; the server re-runs the same pure
  parser for the admin's card. Admin "Read it again" reads the signed image on the admin's phone
  (`reread-on-this-phone.tsx`). What is logged on the payment passes the same `readReferenceToLog` /
  `receiptPaidOnToLog` filters as the server read.
- **Always on (parser):** the phone's status-bar clock ("9:41") is no longer taken as the payment time — a time on
  the date's line or after it wins. `ocrDigitFix` moved beside the scan (re-exported from `lib/admin/received-match.ts`).
- **Guard:** `the-receipt-is-read-on-the-phone.test.ts` fails if the switch is turned on, if any buyer path loses
  the existing reader, or if the phone path reaches an outside model.

SPEC IMPACT: None while the switch is OFF — the privacy notice and the Anthropic subprocessor entry still describe the
server reader, which is what runs. Turning the switch ON needs both reworded (owner + DPO sign-off).

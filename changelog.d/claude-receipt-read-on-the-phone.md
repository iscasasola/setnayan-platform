## 2026-11-19 · feat(pay): buyer receipts are read on the phone — the outside AI call is removed

Owner, 19 Nov (specs DECISION_LOG, "all your picks"): *"BDO buyer receipts are read on the phone; the outside AI call
is removed (#7940)."* Stacked on #7926 (BDO pay flow) and #7938 (BDO exact matches hold 30 minutes).

- **Upload Payment Receipt** on /pay (gift store orders included) and in the couple checkout drawer reads the
  screenshot ON THE BUYER'S PHONE with #7924's Tesseract.js reader (moved to `lib/on-phone-reader.ts`, shared, not
  forked) and fills four fields — amount, date, time, reference — that the buyer can correct before sending
  (`app/_components/payment/receipt-read-fields.tsx`). Only the text is posted; the server re-runs the same pure
  parser for the admin's card, and the card says what the buyer corrected. What is logged on the payment passes
  #7926's `readReferenceToLog` / `receiptPaidOnToLog` filters, as the server read did.
- **Removed:** the Anthropic call in `lib/payment-receipt-read.server.ts` (`readPaymentReceiptFromR2`,
  `runPaymentReceiptRead`, the R2 fetch and the sharp re-encode). Admin "Read it again" reads the signed image on the
  admin's phone (`reread-on-this-phone.tsx`).
- **Parser:** the phone's status-bar clock ("9:41") is no longer taken as the payment time — a time on the date's
  line or after it wins. `ocrDigitFix` moved beside the scan (re-exported from `lib/admin/received-match.ts`).
- **Lazy:** Tesseract and the parser load only on the proof step (warmed when it opens); nothing in first-load JS.
- **Privacy notice** + subprocessor record now say receipts are read on the phone and not sent to Anthropic.

SPEC IMPACT: privacy notice text (`app/(shell)/privacy/page.tsx` "Reading your payment receipt") and
`lib/subprocessors.ts` Anthropic role — the DPO statement changed; flagged for owner sign-off in the PR. The ruling is
already in the specs DECISION_LOG (2026-11-19 row); corpus not otherwise edited from this cloud session.

## 2026-11-17 · feat(admin/payments): drop received BDO screenshots, match them by hand (phase 1)

Owner, 17 Nov 2026: "ok build it", on the drawing in specs `prototypes/admin_payment_verify_2026-11-17/` (v5, BDO only). Build answers: undo = "Hold 30 min, then pay" and buyer reference = "Wait for the BDO pay flow". So this is **phase 1, and nothing matches by itself.**

- **Admin › Payments › From your BDO.** An "Add received screenshots" tile ("From your BDO app · many at once"). **The pictures are read ON THE ADMIN'S PHONE** by Tesseract.js 7.0.0 (open source, in the browser; owner 17 Nov: "Yes, swap it in"). No picture is uploaded and no outside AI is called. Only the text reaches the server, where plain code (`lib/admin/received-match.ts`) keeps the reference, the amount (only when the text shows exactly one peso figure) and the Manila time. The reader files come from cdn.jsdelivr.net at pinned versions; that host is already in the CSP for MediaPipe. A picture it cannot read becomes an "unreadable" row, so it is counted. Measured on a drawn BDO screen: it misreads a 0 as O inside the reference, so an O touching a digit is read as 0.
- **One card per received payment with no order.** Each card has:
  - a "Match to" dropdown listing waiting payments of the same amount to the centavo. Whole-reference / full BDO invoice-suffix matches come first, and each candidate shows its reasons ("Same amount · Reference matches", "Ends in 1560", "Arrived before the order was placed");
  - a "Set aside" dropdown: Leave for the next drop, or Not a Setnayan payment.
  
  The summary lines are "N in your BDO, no order", "N buyers say paid, not in your BDO yet" and "N pictures could not be read". A refused read is drawn as a failure, never as "nothing received". If the reader key is unset, the tile says so and is off.
- **Match is a human press.** It goes through the shipped `approvePaymentCore` path. The amount is re-checked to the centavo on the server, and a duplicate refusal is surfaced and matches nothing. `app/admin/payments/received.ts` joined `MONEY_GATES` in `an-ai-may-not-approve-money.test.ts`. A new test fails if it ever writes `match_kind 'auto'` or reads the strong-candidate flag.
- **No new route.** These are three `intent` branches on `approvePayment` (`received-drop` · `received-match` · `received-leave`), the same way 'record' works.
- **New dependency:** `tesseract.js@7.0.0` (apps/web), loaded only when the admin drops pictures.
- **Migration `20271350937606_admin_received_transactions`.**
  - The table is admin-only: RLS at create with the `is_admin()` pattern, and signed-in roles cannot write.
  - At most one received row per payment.
  - Authorship FKs use `ON DELETE SET NULL`.
  - Related updates: exposure baseline regenerated, Ugat baseline line added, and "Download my data" exclusions updated (staff stamps on our own bank record).

**Phase 2 (not here):** with the BDO pay flow, auto-match strong ones behind a 30-minute hold with Undo, a toast + Focus line (no email), and the money-test amendment.

SPEC IMPACT: specs `DECISION_LOG.md` gained the 2026-11-17 "read on the admin's phone" row (pushed, 0b45c923). The other rulings are the earlier 2026-11-17 admin payment verify rows and the drawing is in `prototypes/admin_payment_verify_2026-11-17/`.

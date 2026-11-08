## 2026-11-08 · fix(build2): release-branch CI — refunds read-only surface, Booked QR quote guard, one-render refund save

- **Booked QR → quote is written only by the claim.** `vendor_proposals.locked_qr_token_id` inherits the table's
  browser grants, so a shop could have stamped ANOTHER shop's token id onto its own draft and made that code's real
  claim write no quote (UNIQUE + `ON CONFLICT DO NOTHING`). Migration 20271328327292 (not yet applied anywhere) now
  adds the `a_quote_names_its_booked_qr_only_by_the_claim` trigger (same shape as `a_taken_down_card_stays_down`);
  `booked-qr-claim-copies-the-quote.db.test.ts` case 8 pins it and neutralises it.
- **Refund admin read asks once per statement** — `USING ((SELECT public.is_console_admin()))`.
- **Exposure baseline accepted** for the ruled refund ledger only: `event_vendor_refunds` SELECT for signed-in
  users (shop / couple / admin read policies), its two SECURITY DEFINER writers (authenticated only), and the two new
  columns that inherit their tables' existing grants.
- **Ugat:** joint J65 *Shop → Booked QR → accepted quote* maps `vendor_locked_qr_tokens` (now spine-referenced).
- **One render per refund save:** `client-refunds.tsx` drops the `router.refresh()` after `recordClientRefund`
  (the action revalidates the page).
- **Only the Chat view marks a chat read.** B2-D's one shared draw (Chat · Quotation · Details) wrote
  `markThreadRead` on the server whichever page was shown, so opening a client's Details or Quotation marked the
  conversation read. The embedded draw now writes no marker; its Chat node mounts `MarkReadWhenShown` (client,
  on mount — the shell mounts only the page on screen). The full-screen route still marks on the server, and its
  conversation column awaits the marker first. Held by `a-client-open-draws-the-thread-once.test.ts` 1·2 and 2
  (both seen red with the embedded skip removed).
- **Copy:** the clients lab's first ledger row reads "First payment", not "Downpayment".
- Two `a-revised-quote-must-be-accepted-again` anchors re-pointed to B2-D's `vendorToolsFor(cm)` / `toolNodesFor(cm)`.

SPEC IMPACT: None — the guard enforces the existing ruling (DECISION_LOG 2026-11-03 "A BOOKED QR CARRIES THE WHOLE
PURCHASE": the claim is the writer).

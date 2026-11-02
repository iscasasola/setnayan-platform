## 2026-09-11 · security(deposits): a couple's deposit receipt is a private file (N5 · part A)

Found by N4 (#5432 "found, not fixed"), re-measured on origin/main by N5.

- **Before:** both deposit writers in `vendors/actions.ts` — the lock that carries a
  downpayment and "record a deposit" — uploaded the screenshot under
  `deposit-proof/<eventId>/`, which the prefix router sends to the PUBLIC media
  bucket, and stored its permanent public URL. Every reader (the supplier's client
  page ×3, the supplier overview, the couple's workspace, the admin disputes queue,
  the admin force-majeure page) rendered the stored value straight into an `href` —
  and the couple's session can write that column (measured in the replay as a real
  `authenticated` couple: `https://wa.me/…` and a stranger's private ref both
  accepted), so it was also a "View proof" link out of the app on the supplier's page.
- **Now:** `lib/deposit-proof.server.ts` — `uploadDepositProof` files the receipt in the
  PRIVATE thread-files bucket under `payment-proof/events/<eventId>/deposit/`, refuses
  the public dev fallback, and returns the `r2://` ref (never a URL);
  `depositProofDisplayUrl` shows a short-lived signed link only for a ref inside the
  row's own event deposit folder (`depositProofPolicy`, `lib/r2-client-ref.ts`) — no
  legacy pass-through, so a stored `https://…` renders nothing. All 5 reading surfaces
  go through it.
- **Existing objects:** production held **0** rows with a deposit receipt and **0**
  recorded deposits (read-only, 2026-09-11), so no stored link is lost. Objects that an
  earlier upload may have left in the public bucket under `deposit-proof/` cannot be
  counted from the database (a row can be cleared after upload); listing that R2 prefix
  needs the R2 credentials — flagged for the orchestrator, nothing moved or deleted.
- Guards: `lib/deposit-proofs-are-private.test.ts` (7) · the generic-signer suite's
  private-reader list gains the deposit reader.

SPEC IMPACT: None

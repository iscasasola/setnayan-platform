## 2026-07-30 · fix(security): bind payment-proof screenshot refs to the payer's own prefix

**A client-supplied `screenshot_ref` was accepted on `startsWith('r2://')` alone, on three
payment paths — and an ADMIN was the one who rendered it.**

`screenshot_url` is written from a `screenshot_ref` **form field** in
`dashboard/[eventId]/checkout/actions.ts`, `dashboard/[eventId]/orders/actions.ts`, and
`vendor-dashboard/booking-fees/actions.ts`. All three validated it with nothing but a scheme
test. `lib/r2-client-ref.ts` documents `displayUrlForStoredAsset` as signing "any `r2://` ref
for any of the five buckets with no tenancy check whatsoever" — and its own header names
*"another couple's payment screenshot"* as the example oracle.

So a buyer (or vendor) could submit
`r2://setnayan-vendor-verification/vendors/{anyone}/verification/dti.pdf` as their payment
proof, and the `/admin/payments` reconciliation screen would presign and render it. Output
device: an admin's browser. That is a cross-tenant read oracle over every private bucket —
vendor DTI/BIR permits and IDs, signed contracts, other couples' payment screenshots — reached
from an ordinary form field.

**Fix** — two new tenanted policies in the single sanctioned gate, applied at all three sites:

- `orderPaymentProofPolicy(orderId)` — private thread-files bucket, `payments/{orderId}/` only.
  Both order paths load the row `.eq('user_id', user.id)` before this runs, so the caller is
  already proven to own the id being keyed on.
- `inlineCheckoutProofPolicy(eventId, userId)` — for the checkout drawer, where the order row
  does not exist yet: the event's prefix plus the buyer's own user-keyed prefix. `eventId` is
  nullable because the AI subscription is the one eventless SKU, and a `${null}` interpolated
  into a prefix would be a degenerate rule that silently matches nothing.

**Also found and left alone, deliberately:** the legacy `<input type="file" name="screenshot">`
fallback in the two order paths pipes proofs through `uploadPublicAsset` — the **public**
bucket — three lines below a comment saying "never the public `media` bucket". It is
unreachable from any shipped page (the only `name="screenshot"` input posts to
`submitPapicGuestPayment`, which correctly uploads server-side to the private bucket and mints
its own ref). Flagged rather than removed so the deletion is its own reviewable change.

**Tests** — `lib/payment-proof-ref-tenancy.test.ts`, 15 cases: the original
vendor-verification oracle, the contracts bucket, the public bucket under a matching prefix,
sibling-prefix confusion (`payments/{id}-evil`), traversal, the `http://169.254.169.254`
SSRF shape, the eventless-AI-sub degenerate-prefix case, plus **wiring guards** — the call
sites must still route through `parseClientRef`, must not reintroduce the bare scheme check,
and the parser call must sit within 8 lines of the assignment it gates. Mutation-proved:
reverting the booking-fees site fails 3, widening the order policy to `payments/` fails 2,
restored 15/15.

SPEC IMPACT: None — no behavior change for a legitimate upload; refs the uploader actually
writes still pass. Security note added to `SECURITY_HANDOFF_2026-07-26.md` in the corpus.

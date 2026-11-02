## 2026-07-05 · fix(privacy): route payment-proof screenshots to the private R2 bucket

Payment-proof screenshots were landing in the **public** `setnayan-media` R2
bucket instead of the private `setnayan-thread-files` bucket, exposing them at
permanent publicly-readable URLs (2026-07-04 Data Flow Map audit, gap #1).

Two independent leak vectors, both fixed:

- **Direct-upload path (what fired in prod):** the checkout drawer
  (`app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx`) and the
  order-detail log-payment form (`app/dashboard/[eventId]/orders/[orderId]/page.tsx`)
  passed `<FileUpload bucket="media">` for the payment screenshot, so every
  proof (and its stored `r2://setnayan-media/…` ref) went public. Both now use
  `bucket="thread-files"`.
- **Server-side fallback path:** `bucketForPrefix` matched only the singular
  `payment-screenshot/` prefix, but both `uploadPublicAsset` writers pass the
  plural `payment-screenshots/…`, so proofs fell through to the public `media`
  default. Added the plural mapping (singular kept for legacy). The mapping was
  extracted into a new pure, client-safe module `lib/bucket-routing.ts` (no
  `server-only`) so it can be unit-tested under `tsx --test` — mirrors the
  house `review-fraud-scoring` (pure) vs `review-fraud-screener` (server-only)
  split. `lib/storage.ts` re-exports it, so every app call site is unchanged.
- **Admin read path:** `app/admin/payments/page.tsx` rendered the raw stored
  `screenshot_url` verbatim as `<img src>`/`<a href>`. That only "worked"
  because the leaked object was publicly readable; a correctly-stored private
  `r2://…` ref would have rendered a broken literal string. It now pre-resolves
  each proof to a short-lived presigned GET via `displayUrlForStoredAsset`
  (mirroring the order-detail page), so private-bucket proofs display for admins.

**Object migration:** `apps/web/scripts/migrate-payment-screenshots-to-private.ts`
(one-off, dry-run by default) copies each leaked `payment-screenshots/*` object
from `setnayan-media` → `setnayan-thread-files`, verifies size+etag, repoints the
`payments.screenshot_url` ref, then deletes the public source (crash-safe order:
ref-update precedes delete). Prod DB audit (verified this change) found exactly
**6** payment rows on the public bucket — all `r2://setnayan-media/payment-screenshots/…`,
0 already private, 0 non-`r2://` fallback rows — so the migration selector
(`LIKE 'r2://setnayan-media/%'`) covers 100% of leaked rows. The migration was
**not run** here: no R2 credentials are available (no `.env.local` at
`apps/web/`, and `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` are
unset in the environment). The script is shipped ready-to-run for the operator
to execute against prod once creds are present — until then those 6 objects
remain physically readable at their public `setnayan-media` URLs.

SPEC IMPACT: None — code-only privacy fix; no SKU, schema, pricing, or spec-corpus change.

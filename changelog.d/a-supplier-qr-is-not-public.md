## 2026-09-17 · fix(vendor): a supplier's payment QR leaves the public bucket

⚖ **OWNER RULING 2026-09-17** — the couples' 2026-09-15 disclosure rule extends
to suppliers. **Asked, not inferred:** DECISION_LOG records that the wallet
ruling was issued separately from the bank one because *"widening a disclosure
rule past what was asked is how the next person inherits a decision nobody
made."*

🔢 **Done now because `vendor_payment_methods` held ZERO rows.** That makes this
a policy change; once suppliers start uploading it becomes a migration plus an
orphan sweep, exactly as the couples' did.

### The prefix had to move roots, for a different reason than the couples'

`vendors/<id>/payment-qr/` puts the meaningful segment in the MIDDLE, behind an
unpredictable id, where `bucketForPrefix` (matching `startsWith`) can never
reach it. And the `vendors/` root could not be claimed either — vendor
VERIFICATION documents share it and belong in `setnayan-vendor-verification`, so
a rule there would misroute DTI certificates and IDs. Hence `vendor-payment-qr/`
as its own root, with a test asserting the old root was **not** claimed.

`VENDOR_ROOTS` must name it too: the resolver defaults an unknown root to an
EVENT id, and /api/upload then refuses every upload with a 403.

### 🔴 The anti-swap decoder would have broken SILENTLY

`decodeQrFromR2` presigned a **public** URL for our own object and `fetch`ed it
back over HTTP — which `lib/r2.ts` explicitly warns against ("handing one a
24-hour public URL so that our own process can fetch it back creates an exposure
that never had to exist"), and which only ever worked against the public bucket.
After the move it would have returned `null` with no error, taking the
`decoded_destination` verification with it and quietly routing every supplier to
manual review.

It now reads bytes with `r2GetBytes` and decodes through the shared two-scale
decoder. The ref is checked against this supplier's own policy BEFORE anything
is fetched — `qr_r2_key` is a column a supplier writes. `vendorProfileId` is
**required**, not optional: an optional id with a permissive fallback is how a
caller silently skips the check.

### One helper, four surfaces

The couple's vendor workspace, the public proposal page, the supplier's own
dashboard and the admin desk all rendered this image via
`displayUrlForStoredAsset` — public-bucket only, returning **null** otherwise.
A null renders as a MISSING IMAGE, not an error: missing one surface would look
exactly like a supplier who never uploaded a QR. All four now import
`vendorPaymentQrDisplayUrl`.

🔑 **A presigned URL is correct here and was wrong for the gift page**, and the
difference was measured rather than assumed: all four surfaces call
`createClient` → `cookies()`, so Next renders them PER REQUEST and each render
mints a fresh URL. `/[slug]/pabuya` is published and read for months, which is
why that one needed a permanent route. Same object class, different lifetime.

### Two registries caught the omissions

`the-generic-signer-is-public-only` (the new private uploader) and
`r2-client-ref`'s uploader/policy pairing. ⚠ The latter's fixture table
hardcoded `r2://setnayan-media/…`, so it could only express PUBLIC uploaders —
the row for a private one could not be written truthfully at all. Given a bucket
column defaulting to the public bucket, rather than deleting the row: a guard
that cannot represent the correct new state gets "fixed" by removing its
coverage.

SPEC IMPACT: a new owner ruling (2026-09-17) extending the disclosure rule to
supplier payment methods — belongs in DECISION_LOG.

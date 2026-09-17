## 2026-09-17 · feat(pabuya): new gift QRs land in the private bucket, under their own root

**Steps 10–11.** The forward fix. The migration of the one existing object, and
the orphan sweep, are an OWNER-run script — not done by this change.

`setnayan-media` is world-readable: an anonymous GET of an object key returns
200. A QR Ph code ENCODES the bank account number it stands for, so the app
route answering 403 to a stranger protected bytes that had a second address
answering everyone.

### ⚖ Two changes, one ruling — and the second half is the one usually dropped

DECISION_LOG 2026-07-30 moved vendor payment receipts off the public bucket and
paired that with a `bucketForPrefix` rule *"so a future server-side writer that
routes by prefix cannot land these in the public bucket by omission. That
omission is exactly how they got there."*

🔑 **The root prefix is what makes that second half possible.** `bucketForPrefix`
matches `startsWith`, so a key shaped `events/<uuid>/pabuya/…` — meaningful
segment in the MIDDLE, behind an unpredictable id — can never have a rule. So
keys move to **`pabuya-qr/<eventId>/`**, not just to another bucket. Swapping the
bucket alone would have been "did the move" while silently dropping the defence
the ruling asked for.

It also removes a live bypass: `eventMediaPolicy` admits all of `events/<id>/`
in the PUBLIC bucket, so while gift QRs lived there a host could post their own
QR key into a site-chrome or Save-the-Date field and have the wedding site serve
it to a passer-by with no recognition gate at all. Out of that namespace, not
expressible.

### Five registries, and they must land together

`pabuyaQrPolicy` (write) · the `<FileUpload>` bucket + prefix ·
`PRIVATE_BUCKET_ROOTS` · `bucketForPrefix` · `PRIVATE_UPLOADERS`. Miss the policy
and every new upload is silently stored as `null` with "that QR image reference
isn't valid"; miss the roots and `/api/upload` 400s.

⚠ A SIXTH was found by the repo, not by me: `ROOT_CARRIES`
(`upload-prefix-tenancy.test.ts`) requires every upload-prefix root to be
DECLARED rather than silently defaulted. `pabuya-qr` carries an event id, which
is the resolver's default, so no route arm was needed — but the guard is what
said so. Two other guards caught omissions in these steps too
(`every-cleanup-delete-is-pinned`, `the-generic-signer-is-public-only`).

### The transition is one list

WRITE accepts only the private home, so a browser cannot choose the old one.
READ accepts both, via `pabuyaQrLegacyPolicy` — read-only, marked temporary, and
deleted together with its entry in `pabuyaQrAcceptedPolicies` once the migration
count reads zero. The cleanup scope names both homes for the same reason.

### The script (`scripts/migrate-pabuya-qr-to-private.ts`)

COPY → VERIFY size **and** etag → UPDATE ref → DELETE source. Dry-run default,
`MIGRATE_APPLY=1` to apply. Shape copied from
`migrate-payment-screenshots-to-private.ts`.

🔑 **The delete is the point, not the copy.** Moving the object while leaving the
original changes nothing a stranger can reach — the key was disclosed in every
presigned `<img src>` the page ever rendered, so the old URL works forever unless
the object is removed. Owner authorised the move AND the deletion.

⚠ **`--sweep-orphans`** (off by default): a row-driven migration cannot see a QR
a couple REPLACED. Until Step 8 landed today nothing deleted a displaced object,
so those sit in the public bucket unreferenced and exactly as exposed as the live
ones. Without the sweep the migration looks complete and leaves them.

⚠ OWNER-RUN: no R2 credential reaches an assistant session.

SPEC IMPACT: None — implements the 2026-07-30 pattern for a new class; no ruling changes.

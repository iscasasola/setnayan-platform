## 2026-09-10 · fix(admin): a live verification document is never "left over"

`/admin/verification-docs` can permanently delete objects from the private
`setnayan-vendor-verification` bucket — government IDs, BIR 2303 certificates,
Mayor's Permits, DTI/SEC certificates and bank proofs. It marks an object
deletable when no database row references its key.

**The referenced-key set was empty by construction, permanently, from both of
its sources.** `referencedKeys()` kept `Object.values(...)` entries that were
`typeof === 'string'`, and no writer in this codebase has ever produced one:
`buildSlotValue` persists `{ r2_key, uploaded_at }`, an ARRAY of those for
`portfolio_samples`, an array for `client_references`, a platform map for
`social_media`, and `null` for a cleared slot. The five
`vendor_verifications.*_r2_key` columns have no writer at all. Both reads
succeeded, neither raised an error, and the set came back with nothing in it —
which the page and the delete action both read as "nothing points at this
file". The first real document a supplier uploads would have been labelled
"Left over" with a permanent, unversioned Delete beside it. Production holds
zero references today, which is the only reason it never fired.

**Fixed in the producer, not the classifier** — the delete action re-derives the
same set at press time, so one fix covers the label and the button:

- `referencedKeysFrom()` (pure, in `lib/verification-docs.ts`) walks any shape
  at any depth. Half one is the erasure sweep's own `collectStoredAssetRefs` for
  `r2://` refs; half two is a plain-string walk for the bare keys both SEC-1
  upload gates admit (`!ref.startsWith('r2://') ||` short-circuits ownership to
  true). Union, never intersection.
- Every collected value enters the set TWICE — raw, and as the bare key
  `parseR2Ref` resolves. The listing holds bare keys and the database holds full
  refs, so widening the walk alone still marks every live document deletable.
- A value neither form recognises stays in the set raw, so it errs toward "in
  use". Over-collection can only refuse a delete; under-collection erases an
  identity document.
- Both sources — the jsonb and the five columns — now go through that one
  helper, so a writer appearing on either is covered on the day it ships.

**New gate, deliberately stricter than before:** an EMPTY reference set no
longer authorises anything. `isDeletableVerificationDoc` refuses when the set is
empty, and `buildVerificationDocsReport` switches deletion off page-wide when
the set is empty while the bucket holds files. A successful read that returns
nothing is what a broken reference reader looks like — there is no error for the
existing fail-closed gate to trip on, and that is exactly how this shipped.
Denial of cleanup is the survivable failure.

**Named, NOT fixed here** (each is its own change):
- `lib/vendor-identity-retention.ts::deleteStoredAsset` returns a hardcoded
  `true` for its `legacy_url` branch, discarding `deletePublicAsset`'s
  `{ ok: false, reason: 'unrecognized-url' }`. The caller then counts the file
  as deleted AND nulls the pointer — a retained, unreachable file counted as
  erased in an RA 10173 job. Inert today (0 rows).
- `app/admin/verify/actions.ts` reads `doc_uploads.social_media.url`, a key
  `buildSlotValue` can never write (it writes a platform → link map), so the
  vendor deep-search dossier silently loses the social link.
- `authenticated` holds table-level INSERT on `vendor_verifications` and the
  self-insert policy constrains only `vendor_profile_id`, so a vendor chooses
  their own `approved_at` and all five key columns. Latent; needs its own
  migration and its own review.

**NOT broken, checked and cleared:** the erasure purge
(`lib/erasure/purge.ts:929`) and the 90-day identity sweep's applications branch
already use `collectStoredAssetRefs` correctly. There is no RA 10173 extraction
failure there.

SPEC IMPACT: None. No schema change, no migration, no product decision. The
behaviour change is that a page which could delete live identity documents can
no longer offer them, and that deletion is refused outright while the reference
check produces nothing.

## 2026-09-10 · fix(security): a vendor can no longer mint its own verification row — or steer our retention job into deleting someone else's file

**What a person could do.** A signed-in supplier could write one row straight
into `public.vendor_verifications` through PostgREST with the public anon key,
choosing every column but one — including `approved_at` and
`government_id_r2_key`. Our weekly RA 10173 identity-retention sweep reads
exactly those two columns: it takes the approval date as its 90-day clock and
deletes the file the key names, on the ADMIN client, out of any of our five R2
buckets. Public-media keys are printed in our own page source inside presigned
URLs, so a forged row naming another shop's logo got that logo permanently
deleted on the next admin page load. The bucket is not versioned.

**The door (measured from the committed exposure baseline).** `authenticated`
held table-level `SIUD` and column `SIU` on all 29 columns; the only INSERT
policy constrained `vendor_profile_id` and nothing else. UPDATE/DELETE were
already inert (no policy). **Zero writers of this table exist anywhere in the
repo**, and both readers use the admin client — the live intake writes
`vendor_verification_applications` instead.

**Two locks, because either alone leaves a hole.**
- Migration `20271218766967` revokes INSERT/UPDATE/DELETE at **table** level from
  `authenticated` + `anon` (that is what drops the column grants), drops the
  orphaned `vendor_verifications_self_insert` policy, and refuses to apply unless
  the revoke took at both table and column level and SELECT did not move.
  **SELECT and the self-read policy are kept on purpose** — not part of the
  exploit, correctly scoped to the caller's own shop, and removing a live read is
  its own decision.
- `sweepVerifications` now deletes only `r2://setnayan-vendor-verification/…`
  refs. Anything else is **refused, counted into `assetsRefused`, logged at error
  level — and its pointer is kept**, so a refusal can never become a file retained
  past its declared period with nothing pointing at it.

**Deliberately NOT symmetric.** `sweepApplications` is not bucket-pinned, and a
guard fails if anyone "tidies" it to match: the live intake accepts identity
slots under `vendorOwnedMediaPolicy`, whose bucket defaults to the PUBLIC media
bucket, so real identity documents legitimately live there. Pinning it would
strand them past retention. Those refs are already tenancy-pinned at write time
by SEC-1; the column path has no write-time control, which is why it needs one.

**Found by the replay, would have broken production:** the first draft looped
`has_column_privilege(…, 'DELETE')` — DELETE has no column form, so Postgres
raises `unrecognized privilege type`. The migration would have aborted in prod
and blocked every deploy behind it.

**Named, not fixed:** `deleteStoredAsset` returns a hardcoded `true` for its
`legacy_url` branch, discarding `deletePublicAsset`'s `{ ok: false }`, so a file
never removed is counted as erased and its pointer nulled. That is a compliance
judgement about what we keep past a declared period — flagged in the PR body.

**Not performed:** the usual production `BEGIN…ROLLBACK` dry-run — this session
had no production database access. Every dependency was verified from the
committed baseline and the migration history instead.

SPEC IMPACT: None — a privilege and retention-safety fix; no product behaviour,
price or copy changes. Prod holds 0 rows in this table.

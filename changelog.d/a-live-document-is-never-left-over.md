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

---

## 2026-09-10 · fix(admin): the same page, attacked and repaired

Three adversarial reviewers then attacked the change above. One could not break
it; the other two found five things, every one reproduced by executing the code.
All five are closed on this branch.

1. **Leading whitespace fell through BOTH halves of the union.** The `r2://`
   test was asymmetric — half one included on `value.startsWith('r2://')` (raw),
   half two excluded on `value.trim().startsWith('r2://')` (trimmed) — so the
   exclusion was strictly wider than the inclusion and the gap was covered by
   nobody. Measured against a non-empty set: `" r2://<bucket>/<key>"` with one
   leading space came back `half1=0 half2=0`, `left_over`, `deletable: true`;
   `\n` and `\t` identical; a trailing space was always fine. Both predicates
   are now computed on the same string. 🔑 Two predicates that divide one job
   must be computed on the same value — whichever way they disagree, one side is
   a silent hole.

2. **The fail-safe claim in the docstring was false as written.** It said a
   shape neither form recognises "still lands in the set raw, so it errs toward
   'in use'". The set is compared against BARE LISTING KEYS, so a raw value that
   is not itself a bare key protects nothing. Probed with a non-empty set, every
   one of these was `deletable: true`: a presigned
   `https://…/<bucket>/<key>?X-Amz-Signature=…`, a public host
   (`media.setnayan.com`, `pub-….r2.dev`), an uppercase `R2://` scheme, and a
   bare key with a leading slash. All are legal stored values — both SEC-1 gates
   short-circuit on `!ref.startsWith('r2://')`, `lib/uploads.ts` and
   `lib/vendor-identity-retention.ts` both model `legacy_url`, and
   `file-upload.tsx` supports legacy http(s) values. `referenceCandidateForms`
   now derives a key from each (from the URL PATH — the bucket is never
   guessed), and the docstring states the remaining ceiling instead of implying
   cover. A docstring that overstates a safety property is worse than none.

3. 🔴 **The reference read was unbounded — and it beat the new empty-set gate.**
   Neither SELECT carried a `.limit()`, a `.range()` or a count, while PostgREST
   caps the rows it returns (Supabase's documented default for that setting is
   1000). A capped read comes back LARGE, NON-EMPTY and INCOMPLETE with
   `error: null` — past the error gate AND past the empty-set gate — marking
   every document belonging to a row past the cap deletable. **The same disease
   as the bug this branch fixes, one axis over: a successful read returning an
   incomplete set, feeding an irreversible delete.** Both sources are now paged
   to exhaustion through one shared `readAllPages`, which treats an exactly-full
   page as never the end and only a SHORT page as proof of it; if the ceiling is
   reached first, the read is `complete: false` and the page and the action both
   fail closed. Raising a limit would have been the same bug with a bigger
   number. 🔑 The truncation guard had been put on the SAFE side (fewer objects
   listed = fewer deletions offered) and not on the DANGEROUS one.
   ⚖ A short LISTING is still deliberately not a gate, and that asymmetry is now
   stated in the code: this page's verdict is per-FILE, so a short listing only
   ever refuses a cleanup. (`/admin/website-media` blocks on its own truncation
   because its verdict is per-FOLDER.) The page still says the list is partial.

4 & 5. **Two guards were decoration, both proven so.** Both covered
   `verification-docs-server.ts`, which imports `server-only` and therefore
   cannot be loaded by any `node:test`, so both read its SOURCE and asserted a
   string was present. A reviewer broke the guarded behaviour twice while the
   suite reported `# tests 32 # fail 0`: **B1** kept both `referencedKeysFrom(`
   call sites (the asserted count of 2) and discarded their results
   (`keys.add(key)` 2 → 0), restoring the original defect; **B2** replaced the
   block-reason expression with `const blockReason = referenceError;`, leaving
   both asserted literals in place and the gate gone. 🔑 **The answer to an
   untestable module is to split the pure rule out of it, never to match a
   longer string.** The fold (`collectReferencedKeys`), the paging
   (`readAllPages`), the page-wide decision (`verificationDeletionBlockReason` /
   `buildVerificationDocsReportFrom`) and the delete action's whole verdict
   (`verificationDeleteVerdict`) now live in the pure module and are tested by
   being CALLED. The server module and the action fetch and delegate; they
   decide nothing.

⚠ **HONEST LIMIT, stated rather than left standing as a guard:** one assertion
still reads the server module's source — "this module decides nothing" is a
claim about ABSENCE, and absence has no behaviour to call. It pins that the
three helpers are what the module calls, that exactly one `.range()` exists (a
second, unranged query is finding 3 returning), that the string-only filter
cannot come back, and that completeness is never asserted as a literal. It is a
structural bill, not a behavioural guard.

23 assertions added (32 → 55 tests). Every repair mutation-tested with its
occurrence count printed before → after, all RED; B1 and B2 re-run verbatim
against the restructured code and both now RED.

SPEC IMPACT: None. No schema change, no migration, no product decision.

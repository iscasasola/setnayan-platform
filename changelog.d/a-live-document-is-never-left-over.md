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

---

## 2026-09-10 · fix(admin): round 3 — the PR had disarmed its own canary

Two more reviewers attacked the repairs above and independently found the same
new defect, **in code round 2 added**. Six things are closed here, and five of
them share one root cause.

🔴 **THE ROOT CAUSE, and the reason three of the six existed at all: every
reference test hand-built its input, so the REAL select shape, the REAL range
window and the REAL ordering were exercised by nothing.** `readAllPages` was
injectable, which looked like testability — but every injected `fetchPage` stub
ignored its arguments, and the query itself was built inside
`verification-docs-server.ts`, a module that opens with `import 'server-only'`
and which no `node:test` can load. The table names, the SELECT columns, the
ordering, the range arithmetic and the completeness proof now live in
`lib/verification-docs.ts` as pure, exported values, and a fake client records
what the query actually asked for.

1. 🔴 **THE PRIMARY KEY IN THE SELECT DISARMED THE EMPTY-REFERENCE-SET GATE.**
   Round 2 added `verification_id` / `application_id` to both reference SELECTs
   (to order by them) and handed the WHOLE ROW to the fold. `collectPlainStrings`
   keeps every string at any depth, so each row's PK UUID was collected as though
   it were a document reference. Gate 4 counts SET SIZE, so **ONE ordinary
   `vendor_verifications` row whose five `*_r2_key` columns are all NULL yielded
   a set of size 1, the gate did not fire, and the page offered Delete on a live
   government ID with verdict `ok`.** Measured, executing both shapes: main's
   select gave `keyCount=0, gate FIRES, deletable=false`; this branch's gave
   `keyCount=1, gate DOES NOT FIRE, deletable=TRUE`. That gate's entire stated
   job is to catch "the reference reader collected nothing" — the original defect
   this branch exists to fix — and from the first verification row onward it
   could never fire again. Inert in production today by arithmetic (0
   `vendor_verifications` rows, 1 application whose `doc_uploads` is all nulls);
   it stops being inert at the first verification row.
   **Both halves repaired, because they are different failures:**
   · The SELECT projects **reference columns only**. PostgREST orders by a column
     whether or not it is projected, so the PK never needed to be there. The two
     sources are data now (`VERIFICATION_REFERENCE_SOURCES`), and the type's own
     comment says why the PK must never join `referenceColumns`.
   · The gate counts **document references**, not set size —
     `documentReferenceCount` counts only keys shaped like a file in this bucket.
     🔑 **A set can be non-empty for reasons that protect nothing.** Counting
     fewer things only ever refuses a delete, which is the safe direction here.
   · And the walk's depth ceiling now **fails closed**. `collectPlainStrings`
     stopped at `maxDepth = 8` silently, which returns a SMALLER set — the
     dangerous direction — and a reviewer used exactly that to score a LIVE
     document `left_over` with `pageOffersDelete = true`. A truncated walk makes
     the whole reference read incomplete, which switches deletion off page-wide.

2. **A paging off-by-one went GREEN.** `fetchPage(from, from + pageSize - 1)` →
   `fetchPage(from + 1, from + pageSize)` skips the FIRST row of the table
   entirely; its five documents read `left_over` with Delete beside them and the
   read still reports `complete: true`. Suite stayed green at 55/55. A fake
   client now records every range window and the test asserts them exactly, and
   that the first row's document is in the reference set.

3. **Removing `.order()` went GREEN** — the very line the code's own comment
   calls "what makes paging meaningful: without a stable order, two pages can
   return the same row and miss another". 55/55. The surviving source-matching
   test counted `.range(` and never looked at `.order(` at all. The ordering is
   built in the pure module now and recorded by the fake client.

4. **The paging completeness proof was unproven, and the branch had disclosed
   it.** `readAllPages` treated a SHORT page as proof of the end, which is sound
   only while `pageSize` (500) is strictly BELOW the server's row cap — and that
   cap is project configuration: it is not in `pg_db_role_setting` and no session
   can read it. A reviewer probed the consequence (cap 3 vs pageSize 4 → one
   call, `complete: true`): silent truncation feeding an irreversible delete, the
   original bug restored behind the guard written to prevent it.
   **Completeness is no longer inferred from a page's shape.** Both SELECTs ask
   for `{ count: 'exact' }`, PostgREST reports the total for the whole match
   regardless of how many rows it hands over, and the read is complete when the
   rows collected reach that number and never otherwise. The next window starts
   at what has ACTUALLY been collected rather than at a fixed stride, so a cap
   below the page size is read through instead of mistaken for the end. **No
   count reported ⇒ `complete: false`. FAIL CLOSED**, and the code says so.
   ⚠ Honest limit, stated in the code: this is offset paging, so a row deleted
   between two pages can still shift the window. Keyset paging on the PK would
   close it and needs the PK in the projection — which is finding 1. If this
   table ever grows past one page in practice, that is the change to make, with
   the PK kept OUT of the fold.

5. **The predicate asymmetry was not fully gone, and the comment said it was.**
   Half one includes on `startsWith('r2://') && length > 5`; half two excluded on
   `startsWith('r2://')` with no length clause, so the bare literal `"r2://"`
   fell into NEITHER (measured: `half1=0 half2=0`). Harmless — a five-character
   scheme can never equal a `vendors/…` object key — but a comment that
   overstates a safety property is the failure this repo keeps paying for. The
   two predicates are identical now, character for character.

6. **The "kept raw" claim was still slightly overstated.** Both halves trimmed,
   so a stored value equal to an object key that ENDS IN A SPACE lost its raw
   form and scored deletable. Unreachable in practice (`sanitizeFilename` maps
   everything outside `[a-zA-Z0-9._-]` to `-` and keys are minted server-side),
   and this function only ever adds, so making the claim true costs one line: the
   untrimmed value is kept beside the trimmed one. A protocol-relative
   `//host/key` — the fifth stored URL shape, previously outside the four covered
   — now resolves to its key rather than falling through to the leading-slash
   rule, which would have kept the host as part of the key.

⚠ **HONEST LIMITS, corrected.** The round-2 note said ONE source-matching
assertion survives. **It is SIX**: the new "the server module decides nothing",
plus five inherited from `main` (press-time re-read ordering, the shared-rule
ordering, no-bulk-delete, content-disposition, admin-before-formData). The five
are pre-existing ordering claims about a `'use server'` module — weak, but not
new debt, and left as they are. The server-module one is strengthened: it now
asserts the module contains **no `.select(`, no `.order(` and no `.range(` at
all**, which is what keeps the query where a test can record it.

17 assertions added (55 → 72 tests). Twelve mutations, every one with its
occurrence count printed before → after, all RED. S-A (the paging off-by-one)
and the canary sabotage (gutting gate 4) re-run VERBATIM: both RED.
⚠ **S-F re-run verbatim did NOT LAND and its green means nothing** — the string
it targets (`.order(pkColumn, { ascending: true })` in
`verification-docs-server.ts`) no longer exists, because the ordering moved into
the pure module; occurrence count 0 → 0. Re-run in its new home it is RED.
🔑 *An unmeasured mutation proves nothing, and a mutation aimed at a string that
has moved measures nothing at all.*

SPEC IMPACT: None. No schema change, no migration, no product decision.

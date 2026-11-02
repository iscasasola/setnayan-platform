## 2026-09-10 · test(admin): the verification-docs RULES were guarded — the WIRING to them was not, five ways

Follow-up to #5398. That PR is correct: two reviewers executed the shipped code and could not make a live government ID score deletable through any legal stored shape. **What was wrong is regression protection.** Five seams where a guarded rule is *reached* could each be sabotaged with the suite GREEN at `# tests 72 # pass 72 # fail 0` — every one the same root cause the PR exists to kill, one level smaller.

Every mutation below was applied on the branch, its needle counted before → after, **and the string it ADDS counted too** — a sabotage scoring 0 → 0 did not land and its green means nothing.

| # | seam | mutation | before fix | after fix |
|---|---|---|---|---|
| 1 | `buildVerificationDocsReportFrom` feeds gate 4 the SET SIZE | `documentReferenceCount: documentReferenceCount(input.keys),` 1→0, `…: input.keys.size,` 0→1 | 72/72 GREEN | **3 fail** |
| 2 | the error arm, in the `server-only` module | `if (read.error) return` 1→0, `if (false) return` 0→1 | 72/72 GREEN | **2 fail** |
| 3 | `complete = complete && read.complete;` → `complete = complete;` | needle 1→0, added 0→1 | 72/72 GREEN | **3 fail** |
| 4 | `complete: complete && !truncated` → `complete: complete` | needle 1→0, added 0→1 | 72/72 GREEN | **2 fail** |
| 5 | `fetchReferencePage`'s `total: res.count ?? null` → `?? 0` | needle 1→0, added 0→1 | 72/72 GREEN | **3 fail** |

**Seam 1 is not a no-op.** On a realistic in-progress intake — `doc_uploads` holding social links and one client reference, no documents uploaded — the set holds 5 strings and 0 document-shaped references. Set size 5 flips `referencesComplete` false → **true** and clears the block reason, which is Delete buttons rendering beside a live government ID on the "Left over" shelf. All four existing canary tests call `verificationDeletionBlockReason` **directly**, hand-passing the number themselves, so nothing ever put a set through the real builder.

**Seams 2–4 are the conditions round 3 put back into `verification-docs-server.ts`** — the module that opens `import 'server-only'`, which no `node:test` can load, and whose own docblock says *"a condition added to this file is a condition nothing can guard."* The change that wrote that sentence added three conditions directly beneath it.

**Seam 5 was proved on a stub.** The existing *"a read that reports NO count can never call itself complete"* test drives `readAllPages` with an injected stub that never touches `fetchReferencePage`, so the line deciding `total` was exercised by nothing. Under `?? 0`, `readAllPages` evaluates `rows.length >= 0` — always true — and a server reporting no count is declared COMPLETE after one page. Same "proved on a stub, real seam unguarded" shape that let round 2's S-A and S-F ship green.

**The structural move, which is the point:** `verification-docs-server.ts` now decides **nothing** — zero `if (`, zero `&&`, zero assignments to `complete` in its stripped source. The three conditions became `foldReferenceReads(reads)` in the pure module, where four tests CALL it. What is left in the server module is a client, a bucket listing, a loop and two function calls.

**The two wiring seams are guarded through the REAL path, never an injected stub:** seam 1 by running a non-empty-but-zero-document reference set through `buildVerificationDocsReportFrom`; seam 5 by driving `readReferenceSource` → `readAllPages` → `fetchReferencePage` with a fake Supabase client that reports `count: null`.

**Record corrected:** #5398's body claims "M2 · gate 4 counts set size again · 1→0 · 3 fail". That is **accurate as written** — re-measured here at 3 fail — but it hits the *rule* inside `verificationDeletionBlockReason`, never the argument feeding it. The rule was guarded; the wiring to it was not.

**One ceiling decided rather than inherited:** `documentReferenceCount` is still narrowly inflatable — `referenceCandidateForms` rule 4 derives a key from any `http(s)` path at its first `vendors/`, so a stored social link like `https://anything/vendors/x/verification/y` counts. Narrowing it needs PROVENANCE the fold deliberately does not carry (flatness is what makes a sixth reference column covered the day it is added), and threading a provenance-bearing set out of the fold, through the server module and into the report builder would **add new wiring at exactly the seam this page keeps being bitten by**. Refused, recorded on the function, and pinned by a test so the ceiling is stated rather than unnoticed. What bounds it: gate 4 is a backstop; the primary gate is `referenced.has(key)`, an exact match nothing can inflate.

13 new tests (72 → 85). No behaviour on the happy path changed — every change makes the page refuse more readily, never less; anti-vacuity tests pin that a real document reference, a counted server and a complete fold all still authorise the page.

SPEC IMPACT: None

---

## 2026-09-10 · test(admin): round 5 — the WIRING round 4 left behind was the next defect

Two independent reviewers of the block above found the same remaining hole, and it is the fifth costume of one disease. Round 4 moved the DECISIONS out of `verification-docs-server.ts` and left the WIRING in — which is precisely the mistake round 4 itself was raised to fix (its own seam 1 was *"the rule is guarded, the argument feeding it is not"*).

Every mutation below was applied on this branch, its needle counted before → after **and the string it ADDS counted too**, comment-stripped as well as raw. A sabotage scoring 0 → 0 did not land and its green means nothing.

| # | what was sabotaged | needle → added | on the UNFIXED branch | after this change |
|---|---|---|---|---|
| **X0** | `for (const source of VERIFICATION_REFERENCE_SOURCES)` → `.slice(0, 1)` | 1→0 / 0→1 | **85/85 GREEN** | **3 fail** |
| **X1** | the fold's verdict destructured and re-shaped with `\|\|` on the way out | 1→0 / 0→1 | **85/85 GREEN** | **1 fail** |
| **X2** | `referencesComplete: complete` → `referencesComplete: Boolean(1)` | 1→0 / 0→1 | **85/85 GREEN** | **1 fail** |
| **X3** | `referenceError,` → `referenceError: null,` | 1→0 / 0→1 | **85/85 GREEN** | **1 fail** |
| **X4** | `foldReferenceReads(reads)` → `foldReferenceReads([])` | 1→0 / 0→1 | **85/85 GREEN** | **3 fail** |

**X0 is the worst thing this page has had.** It drops `vendor_verification_applications.doc_uploads` — the in-progress-intake source, **whose absence IS the original defect the whole page exists to fix**. The harm was driven end to end rather than argued: one legacy `vendor_verifications` row carrying a real key (so the empty-set canary stays quiet) plus one in-progress application holding a government ID gave, unmutated, `docRefCount 2 · page not blocked · government_id = in_use · verdict "inuse"`; sabotaged, `docRefCount 1 · page not blocked · government_id = LEFT_OVER · verdict "OK"` — a live passport photo offered for permanent deletion from an unversioned bucket, suite green. And it poisons **both** halves, because `app/admin/verification-docs/actions.ts` re-derives through the very function that loop sat in, so the delete action AGREES with the wrong page instead of catching it.

### Move 1 — the module is now incapable of shaping the answer

`verification-docs-server.ts` is a client, a listing closure and one `return` each. The source loop, the listing `try/catch` and the argument object handed to `buildVerificationDocsReportFrom` are all in the pure module now, behind two entry points a test CALLS: `readAllReferenceSources(client, opts)` and `buildVerificationDocsReportWith({ client, listObjects, pageSize })`. The sources are deliberately **not** injectable — an override would only move the seam back one level. Five new behavioural tests drive them:

* every declared reference source is actually queried, recorded off a fake Supabase client (this is X0's guard, and it is the one the brief demanded);
* dropping the in-progress source makes a live government ID score `ok`, asserted as the stated defect;
* a source that raises stops the whole read and returns an **empty** set through the real loop;
* the assembled report blocks on a listing that throws, on a reference read that raised, **and on a read that succeeded but cannot prove it finished** — that last arm is what makes X1 and X2 reachable, because gate 2 is only ever reached through that argument.

`apps/web/lib/verification-docs.ts` is **pure additions** — 204 inserted, 0 deleted — so every existing shape rule, every gate and every canary is byte-identical. The eleven legal stored shapes score exactly as they did: a live document `in_use` and not deletable, a genuine orphan still `left_over` and still deletable.

### Move 2 — the structural bill is DERIVED, not enumerated

Round 4's bill was a deny-list of three literals (`if (`, `complete =`, `&&`). **Two reviewers each walked past it on their first try** — X1 used `||`, X2 landed one token from the `referencesComplete: true` the bill did forbid. This repo's own rule is that a deny-list is a bill you have to keep paying.

Chosen instead: **the module's whole comment-stripped, whitespace-normalised body is pinned against an exact expected text** (`SERVER_BODY_PIN`). There is no "new spelling" to find — any edit fails, and the author must update the pin deliberately, which is the point, because the design rule for that file is that nothing goes in it. Measured, all RED where a deny-list was blind: page size `500 → 5000`; bucket `vendorVerification → media`; `VERIFICATION_PREFIX` replaced by a literal; and a plain refactor that hoists the client into a `const`. Measured GREEN, by design: a comment-only edit. Measured RED: editing the pin itself, which proves it is really compared.

**What it still cannot catch, stated rather than implied:** an edit made *together with* a matching edit to the pin. That is a deliberate act with a diff a reviewer reads, and it is the strongest thing available for a module no test can load. The pin is also a claim about ABSENCE — it does not prove the two remaining calls behave; the five `R5 ·` behavioural tests do that.

**X3 and X4 are now guarded, not merely fail-closed** (1 fail and 3 fail respectively) — they were accepted-fails-closed before this change and are closed now.

90 tests (85 → 90) in this file; the whole `lib/**` unit suite is 12,229 tests, 0 fail. `tsc --noEmit` exit 0, 0 error lines. No migration, no behaviour change on the happy path — every change makes the page refuse more readily, never less.

SPEC IMPACT: None

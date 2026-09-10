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

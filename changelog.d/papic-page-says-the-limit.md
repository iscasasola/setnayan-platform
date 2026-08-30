## 2026-08-30 · feat(papic): the promotion page may finally say it (Shots Per Guest · S6)

S6 of the shots-per-guest stream (`WHATS_NEXT_Shots_Per_Guest_SESSIONS_2026-08-28.md`).
The last session in the stream, and the only one a customer reads.

**The gate was real and it is open.** S6 could not merge until S3 and S4 were
**SERVING in production**, not merely merged — a limit a guest cannot see is the
same defect wearing a new number. Verified independently, not off the merge:
`#5002 · #5017 · #5014 · #5019` are all ancestors of `0d0b265`, and the Vercel
deployment for `0d0b265` is `READY`, `target: production`.

**One sentence, in an existing card — not a section.** The page measured
12,847px at 375px on 2026-08-29 and two PRs (#5003, #5007) were spent cutting
it. The claim goes in "Let the whole room shoot", which is where the ceiling
lives semantically: it exists only inside the shared pot.

**Why the second half is safe to print:** the ceiling is a CEILING, NOT A
RESERVATION — `20271184624871`'s own header: *"Nothing is carved out of the pot;
no guest holds a wallet; unspent credits stay shared."* So "whatever a guest
doesn't use is still there for everyone else" is true by construction. There is
no release to wait on and no way for it to drift out of true.

**The guard moved with the truth, and was not weakened.**
`papic-page-says-only-what-is-true.test.ts`:

- The `a per-guest shot limit` prohibition said *"Not built yet"*. It is built.
  Retired in favour of the narrower rule that outlives the build — **the couple
  picks the number, so the page may never print one.** The blanket ban on
  mentioning limits is gone; the fixed-number ban stays.
- **A tenth prohibition added:** claiming we *invented* per-guest limits. A rival
  ships them, checkable in fifteen seconds. This only became reachable now — a
  page that never mentioned limits could not overclaim them. The ratchet moved
  9 → 10.

🚨 **AND ONE FALSE MECHANISM FOUND IN THE GUARD ITSELF.** Its docblock claimed
`stillSayable` *"pins the chapters line so a later reader cannot tidy a true
claim off the page."* **It does not.** `stillSayable` asserts a pattern does not
FIRE on a true sentence; nothing asserts the sentence is present. Measured by
deleting one — every `stillSayable` test stayed green. So the claim this PR
ships gets a real presence assertion, and the docblock says what the mechanism
actually does.
⚠ **The chapters line is still unpinned.** Recorded, not silently adopted — it
belongs to whoever owns that copy.

SPEC IMPACT: `WHATS_NEXT_Shots_Per_Guest_SESSIONS_2026-08-28.md` (S6 row → built,
the stream is complete) · `PAPIC_PAGE_BRIEF_FOR_CHAT_2026-08-29.md` § 3 (the
per-guest row was already unlocked by oversight 2026-08-30).

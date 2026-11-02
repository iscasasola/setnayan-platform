## 2026-08-10 · fix(tests): real production ids were pinned in eight test files — the sweep found five, not one

A `secret scan` failure on another PR exposed one of these: a test had pinned a real production auth user id as `const AUTH = '…'`, and gitleaks flagged it as a generic API key on entropy. Chasing it turned up a worse fact.

🚨 **The scanner had been silent about the others purely because of what their variables were called.** Gitleaks' `generic-api-key` rule keys off the surrounding identifier, so the same class of value passed as `VP`, `EVENT`, `THREAD` and `OTHER_EVENT` and failed only as `AUTH`. **Nothing was protecting the repo — one variable happened to be named badly enough to trip a keyword.**

### What the sweep found

Every uuid-shaped literal under `apps/web` was collected (37 distinct) and every candidate checked against **every `uuid` column in every base table** of the prod schemas — not against a guess about which tables mattered.

| id | what it really is | where it was |
|---|---|---|
| `044f7e64…` | a real event — present in **29** tables | `upload-prefix-tenancy` · `event-card-art` · `csp-report` · `std-media` · `std-seal` · 2 comments |
| `947e7bab…` | a real event — **28** tables. Used in one test as a **thread** id | `upload-prefix-tenancy` · `event-card-art` · `std-media` |
| `0ccc7aa3…` | a real event — **15** tables | `event-card-art` (×2) |
| `9b41095a…` | a real event — **13** tables | 2 comments |
| `51858369…` | the live shop `setnaprod` | `verification-docs` |

The remaining 32 literals were then checked the same way and **matched nothing in prod** — all genuinely synthetic. That check is why this entry can say "clean" rather than "looks clean".

🔑 **`947e7bab…` was a real EVENT id being used as a THREAD id, and nothing ever noticed** — the resolver only looks at the *shape* of the segment. That is the tidiest possible proof that a real row was never needed by any of these tests.

### Two places where swapping the value was not enough

**A hash test pinned to one real id.** `event-card-art.test.ts` asserted that four salted hashes of one specific event id land in four distinct low-bit buckets. Substituting a synthetic id there would have meant **picking a value that happens to pass** — fitting the test to its input, which is how an assertion quietly stops meaning anything. It now measures the property across 200 ids and requires ≥75%. The arithmetic is stated in the test: a good finalizer gives all-four-distinct ~91% of the time (64·63·62·61 / 64⁴), raw FNV-1a lands near zero, so the floor sits wide of both. **Mutation-tested — deleting the murmur3 finalizer turns it red.**

**A rejection case built from a real id.** `isUuid` was fed `044f7e64-95aa-4dcb-04c1-…` — one nibble off a real row — to prove a bad variant is refused. Rebuilt from the synthetic base, so a near-miss of a live event no longer sits in the repo.

### Judgement calls, stated

- **Comments keep their provenance, truncated.** Lines like *"reproduced in prod on event 9b41095a…"* explain why a test exists; replacing the id with a fake one would make the sentence a lie. Truncated to the 8-char form the repo already uses elsewhere — still enough to find the row with database access, no longer a high-entropy literal.
- **Two `changelog.d` fragments** carried full ids and were truncated the same way. Records are not rewritten here; nothing about what happened changed.

### What is NOT guarded, and why no guard was invented

There is no automated check that a new uuid literal is synthetic. Deciding that requires knowing which ids are real, and the only oracle is the production database — which CI has no access to, and the migration replay tests run against an empty schema. Every heuristic considered (few distinct nibbles, zero-prefixed, entropy thresholds) misclassified several of the 32 legitimate synthetic ids in the repo today. 🔑 **A guard that cries wolf teaches you to skim past the one time it is right**, so the honest state is: the secret scanner catches the badly-named ones, and this sweep is repeatable — the collection script is a dozen lines and the prod check is one query.

The config was **not** touched. The scanner behaved correctly.

Verified: **7350/7350** unit · 20/20 `lint-*.mjs` · `tsc` clean.

SPEC IMPACT: None.

## 2026-08-18 · fix(admin): a health monitor that said nothing had ever been checked, and a growth claim from an unchecked query

Two defects found next door to lane B's conversion, reported by that session, and **verified by me by reading the code rather than accepting the report.** Neither file hand-rolls a `<table>`, so neither was on any bill and no guard reached either.

### 1 · The health monitor rendered a catastrophe, not an absence

`app-performance/_surfaces/interconnections-surface.tsx` destructured its read as `const { data } = await …` — **the error thrown away entirely** — then `(data ?? [])`.

🚨 **AND THE LIST IS DRIVEN BY THE PROBE REGISTRY, NOT THE LEDGER.** So a refused read did not render empty. Every card fell to `run: null`, so **every probe showed "Never run"**, the banner announced that all of them had never run, and it supplied a plausible reason — *"Probes fire from public-site traffic, so a quiet site means a quiet ledger."* A health monitor stating at full confidence that nothing on the platform has ever been checked, **and explaining its own wrong answer convincingly.**

🔑 **A REGISTRY-DRIVEN LIST MAKES A REFUSED READ LOUDER, NOT QUIETER.** Every other instance of this defect renders an absence that looks like **nothing**; this one renders an absence that looks like a **catastrophe**. Both are lies. This one either sends somebody chasing an outage that does not exist, or gets dismissed as obviously broken — and either way the real signal is gone. **When a surface joins rows to a fixed registry, ask what the registry says when the rows are missing.**

⚖ **THE REGISTRY-DRIVEN DESIGN IS CORRECT AND IS NOT CHANGED.** Its own docblock says why: *"A probe that has never run must appear as 'never run' — if the page listed only what the ledger contains, adding a probe and forgetting to deploy it would leave the page looking complete."* Exactly right, and the same mechanism that prevents one false-clean is what converted a read failure into a false alarm. **What changes is that "never run" is now only claimable from a ledger that was actually read** — every probe shows *Unknown* otherwise, and the notice says plainly that unknown and never-run are different answers and only one of them is a finding. The `.limit(400)` is hoisted to a named constant.

### 2 · A statement about growth, from a query nobody checked

`lib/hiring-guide/queries.ts` destructured `{ data: weeklySignups }` with no error bound and then coerced with `?? []` at **three** sites, so a refused read set the weekly rate, the recent count and the prior count all to zero. Every forecast then returned with no date, and `operations-surface` printed **"Insufficient signup data"**.

Fixed **additively** — the flag is optional on `MilestoneForecast`, which has three consumers (the admin surface, `alert-engine.ts`, `emails.ts`); the two that do not read it behave exactly as before, so no alert changes. The screen now says the signups could not be read **and that this is not a forecast of no growth.**

🪤 **MY OWN FIX WAS PARTIAL AND MY OWN COUNT CAUGHT IT.** `getMilestoneForecasts` has THREE return shapes; my edit matched an 8-space indent and stamped only two. Printing **stamps (2) against return paths (3)** exposed it. Left in, the unstamped branch would have returned the flag as *absent* rather than *false*, and the screen would have fallen back to the original wording on exactly one path — a fix that works two times in three with nothing to say which. **Do not check that a change is present; check that its count matches what it must cover.** Now 3 of 3.

### Why these waited

Both were found while a CI freeze was in force — four lanes had rate-limited our own action downloads to 429s — and both sat in territory lane B was editing. **Fixing them under the freeze would have made the freeze advisory, which is how a control becomes a convention.** They were named, verified and dated instead, and are fixed here now that lane B has merged. Re-confirmed present on `f4b998e03` before touching anything.

Verification: typecheck clean · 8,578 unit tests · invariants measured on comment-STRIPPED source, the number a guard would see.

⚠ **NOT OBSERVED.** Both surfaces are behind the admin login, so this is test-proved and measured, never seen.

SPEC IMPACT: None — internal admin surfaces and one shared query module. No schema, no migration.

---

### 🛑 A RULE I TRIED TO ADD, MEASURED, AND DID NOT SHIP

The lane-D session gave me a sharp caveat on my read-binding rule: **"binding the error is not the finish line"** — a page can bind it and still render nothing about it, and `'—'` is *already* the legitimate value for a shop with no name or an account with no email, so a silent fallback is not merely quiet, it is **ambiguous with a real value**. The proposed check was *"the bound error reaches JSX"*.

I implemented it and measured it across all 33 converted files before shipping. **It over-reaches, and I am not shipping it.**

The measurement, and each step is worth more than the result:

| pass | flagged | what changed |
|---|---|---|
| 1 | *"0 offenders ✅"* | **meaningless** — my extractor matched apostrophes inside comments, so I measured a list of prose fragments and got a clean pass from nonsense |
| 2 | 18 | list validated against disk first |
| 3 | 7 | counted flags derived by ASSIGNMENT, not only declaration |
| 4 | 6 | counted assignments inside an `if`, which do not start a line |
| read | **0 genuine** | read the survivors instead of trusting the count |

**Every survivor I read was correct code.** `venues-surface` and `disputes` both bind the error, log it, and then carry honesty through `const measured = Array.isArray(rows)` — derived from the **data being null**, not from the error identifier.

🔑 **SO THE CHECKABLE INVARIANT IS NOT "THE ERROR REACHES THE RENDER".** It is *"something derived from not-having-measured reaches the render"* — and that fact is legitimately carried by **either** the error **or** the null data. A rule demanding the error specifically would fail six correct files, and this repo has direct evidence today of what that costs: **a guard that cries wolf teaches you to skim past the one time it is right.**

⚖ Recorded rather than shipped, and recorded rather than silently dropped, so the next attempt starts from the sharper invariant instead of re-deriving the wrong one. The same applies to lane D's other caveat — a read inside a `try` whose `catch` resolves to zero makes the identical claim by a different route, and any implementation must see both arms.

🪤 **AND THE FIRST MEASUREMENT RETURNED A REASSURING GREEN FROM A BROKEN EXTRACTOR** — "every bound error reaches the render ✅", computed over a list that contained `"s queue and"` and `","`. **Validate the list before trusting what it says about the code**; an extractor that matched the wrong thing produces a clean pass, not an error.

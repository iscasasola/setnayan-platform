# START HERE — what is left to build on Setnayan

**Assembled 2026-09-21.** Everything in this zip was measured on that date against `origin/main` and
the live production database, by four read-only audits, two re-measurement passes over an older
register, and one walk of the live public site.

---

## Read in this order

| File | What it is |
|---|---|
| **`01_WHAT_IS_LEFT.md`** | **The register.** Every item still to be built, ranked, with the command that re-measures it. This is the document. |
| **`02_MERGE_PLAN.md`** | How to land it in **11 merges instead of ~45**, because cost is charged per merge. |
| `AUDITS/` | The four raw audits the register was assembled from — money · supplier · couple · launch. Kept whole so the assembly can be checked against its source. |
| `BRIEFS/` | Four ready-to-dispatch build briefs and the rules for bundling. **Nothing here has been dispatched.** They are documentation of how each item would be done. |
| `PARKED/` | The mood-board outfit library — parked by the owner: *"we will do it next time."* |

---

## ⚠ A HANDOFF IS NOT EVIDENCE — including this one

No row in this pack cites a line number. Every row carries a **greppable symbol or the SQL that
re-measures it**, because line numbers rot and a "corrected" line number has itself been the error
here more than once.

**Two in three rows on the previous register turned out to be already built.** When two agents
re-measured the 2026-09-18 bundle on 2026-09-21: ~106 items claimed open, ~75 re-measured, **~49
already done.** Twenty-one of those closed simply by finding a merged PR that named the row's own ID
in its title:

```bash
git log origin/main --oneline --grep="<ROW-ID>"
```

**And the confident rows decay too.** One was marked *"🔴 CONFIRMED OPEN — re-measured by TWO
phrasings"* and had in fact shipped; neither phrasing was the one used.

🔑 **A zero only proves something on a row asking for an ABSENCE.** A row asking for a PRESENCE that
greps nothing proves only that the phrasing you tried is not the phrasing that shipped. Try at least
two different symbols before calling anything missing.

---

## The three facts that frame every row

**1. No wedding has ever happened.** All nine weddings on the platform are in the future.

**2. Both shops are the owner's** — and both wear a verified badge that came from a bypass rather
than the approval flow. **The path from "I signed up as a supplier" to "couples can find me" has
never once been walked end to end by anybody.**

**3. Exactly one real booking fee has ever been collected** — ₱837.50, driven end to end by the owner
on 2026-09-19/20. It works.

🔑 **So most of this pack is a measured ABSENCE OF EVIDENCE, not a measured defect.** A row marked
**NEVER EXERCISED** is not broken and is not working — nobody knows, and claiming either would be an
invention. That distinction is the most important thing in this pack.

---

## Before you read code — the traps that have each cost a whole session

- **`/Users/icecasasola` is a stale checkout of this repo**, ~749 commits behind. A subagent aimed at
  it once returned a coherent, fully control-flow-traced, **completely wrong** finding — real line
  numbers, from a file whose code had since been deleted. **Never read code from `~`.**
- **The working checkout can be just as stale** — the one these audits began in was **2,290 commits
  behind** and produced three confident wrong findings before the divergence was caught.
  Use `git show origin/main:<path>` and `git grep <pat> origin/main`. Check with
  `git rev-list --count HEAD..origin/main`.
- **A code comment is not a measurement.** Six applied migration headers still carry a belief that
  was disproven twice; applied migrations are never edited, so those comments stay wrong forever.
- **A flag's default in code is not its value in production.**

## The lines that do not bend

- **Prod is read-only.** **Never apply a migration directly to production** — a direct apply once
  stranded seven merged PRs for three hours. **Never run `supabase migration repair`**; it rewrites
  the production ledger.
- **Never weaken a guard to go green.** Raise its threshold and say so.
- **Never type credentials.** The owner signs in. Test as testnayan1–4 by email and password, never
  the Google button — and **never as the owner's `is_internal` account, which passes every paid gate
  and is part of why these gaps survived this long.**
- **Stop and report BLOCKED** rather than routing around a safety check.

---

## The one thing worth more than this pack

Everything here except §4b of the register was read from code, the database and environment state.
The single measurement that would tell you more than another pass over these documents is **a real
run**: one supplier through signup → verification → live → quote → lock → fee, and one couple through
invite → guests → the day → confirm → review, watched by someone.

Almost nothing in this product has ever been used. That is the finding underneath all the others.

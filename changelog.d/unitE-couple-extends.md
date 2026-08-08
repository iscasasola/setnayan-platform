## 2026-08-08 · design(#4): the checklist percentage, a quieter digest, and a phone-sized focal

The three items the verified placement map showed were still outstanding on the
couple's Overview. All three are **presentation or a lean read** — no href, no
action, no destination changes, so the port guard reports nothing lost.

### 1 · "N% done" beside the checklist link (§ 2.3b)

The doorway to the full checklist now carries how far along it is, so a couple can
see progress without opening it.

🔑 **THREE OUTCOMES, NOT TWO, AND THEY MUST NOT COLLAPSE.** A failed read and a
checklist that has never been seeded both arrive as *"no completed items"* —
rendering `0% done` for either would state a fact about their planning that nobody
measured. Both render **no chip**; only a genuinely seeded list shows a
percentage. A finished list turns green rather than staying gold, because gold in
this kit means *waiting on you*, which 100% is not.

Two head-counts, no rows, joined to the surface's existing batch. **It does not
seed** — `ensureChecklistSeeded` mutates and belongs to the checklist surfaces; a
read on the Overview must never write.

⚠ The focal's existing "% planned" is a **different number** (vendor categories
locked), which is exactly why the spec gave this one its own home.

### 2 · The digest's second line has to earn its place (§ 2.2)

On the digest, the grey second line now shows **only when it carries a date or a
reference**. Everything else it repeated is still written in full on the decisions
board directly below.

The predicate is grounded in the lines this panel actually renders, traced to
their assignments — `Order placed · ref A7K2QX` stays; `3 categories still open`,
`1 waiting`, `Saved options waiting on a lock` and `Order placed · payment
pending` go.

🪤 **A BARE MONTH NAME IS NOT A DATE.** "May" is a verb and "March" is a noun. A
month only counts when a **number sits beside it** — otherwise the day someone
writes *"you may need to…"* the rule silently stops applying.

🪤 **AND THE FIRST VERSION HAD THE BUG ITS OWN TEST CAUGHT.** The reference
pattern was written `/…[A-Z0-9]{4,}/i`, and the `i` flag makes `[A-Z0-9]` match
**lowercase** — so *"Please **reference your** order"* read "your" as a reference
code and kept the line forever. Order codes here are uppercase Crockford base32,
so the code half must stay case-**sensitive**. **A case-insensitive class is not a
looser match — it is a different match**, and this one disabled the rule it
belonged to.

### 3 · The Watch folds on a phone, never on a laptop (§ 4 · E2)

When the assistant is on, its watch rows made the focal tall enough to push
"Needs you this week" below the fold — the one panel a couple opens the app for.
Nine months out the briefing is reassurance; the digest is the job.

On phones the rows now sit behind one tappable line, **open by default whenever
anything is a `guard`**, so a real warning is never hidden behind a tap. Laptops
never fold.

⚠ **Two branches, not one element neutralised by CSS.** Forcing a single
`<details>` open at ≥lg leaves its `<summary>` clickable and focusable while doing
nothing visible — **a dead control**, which this repo treats as a defect. Two
branches is also the pattern already used for the sidebar/bottom-nav split.
`watchItems` is capped at 4, so the cost is at most four rows of duplicate markup,
and no duplicate DOM ids: `inspectId` is a query param, not an id.

### Verification

- **7,098 unit tests pass**, 0 fail (6 new)
- green under **UTC · Asia/Manila · America/New_York · Pacific/Kiritimati** — CI
  runs UTC, the one clock where date mistakes cancel out
- **all 21 lint guards green**, including the port guard: nothing lost
- `tsc` clean

🪤 `tsc` first rejected the new read with *"Type instantiation is excessively deep"*
— a hand-rolled structural type for the database client, inside a `Promise.all`
the compiler already has to widen 14 ways. The house `SupabaseClient` type fixes
it; being clever about a parameter type is not worth a compiler that gives up.

SPEC IMPACT: None — implements § 2.2, § 2.3b and § 4 E2 as written.

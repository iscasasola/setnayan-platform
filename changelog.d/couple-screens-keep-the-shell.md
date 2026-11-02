## 2026-08-18 · fix(couple): every daily screen keeps the shared shell

Owner, 2026-08-18: **"all should keep our shell."**

**What a person experiences:** nothing visibly, today. One page inside the couple's event
dashboard was drawing its own frame inside the app's frame. It now sits in the shared one like
every other screen, at the same width it had.

⚠ **It is also an accessibility fault, which is the part that mattered.** Two `<main>` landmarks
on one page means a screen reader offers *"skip to main content"* twice and neither one is the
whole page.

🪤 **MY FIRST COUNT WAS WRONG BY FIVE, AND THE ERROR IS THE LESSON.** A grep for `<main` across
the four screens returned **five** files. Four were **comments describing the layout's own
`<main>`** — *"the shell supplies the `<main>` landmark"*, *"-mt-6 cancels the `<main py-6>`"*.
Exactly **one** was a real element. 🔑 **A guard that matches a string is not matching the act:**
strip comments first, or the notes people wrote *about* a rule get reported as breaking it.

🪤 **AND THE FIRST GUARD CRIED WOLF OVER THE WHOLE TREE.** Scanning every event page flagged
print sheets and a crash screen — pages that *should* own their document. They are now excluded
**by what the route IS** (a `/print/` or `/poster/` segment, an `error.tsx`), never by filename,
so a new print route is covered automatically and a new ordinary screen cannot hide behind the
list.

✅ **ALL SEVEN OTHER SCREENS ARE FIXED TOO — the pinned list is EMPTY.** Owner: *"ok fix it."*
Each was read before it was touched, and they were not all the same job:
- **five** were plain width wrappers → `<div>`, classes untouched;
- **manpower** painted a full-height surface → `<div>` with the paint **kept**, because dropping
  it would be a visual change nobody asked for;
- **the website editor's was its PREVIEW PANE**, not a page wrapper → `<section aria-label="Preview">`.
  A two-pane editor's preview is a real region somebody navigates to; demoting it to a bare `<div>`
  would have **destroyed a landmark rather than corrected one**.

⚠ **I first wrote that list by hand from truncated terminal output and it was missing one.** It is
generated from the scan now — and regenerated again after the fixes, rather than hand-emptied.
⚠ **The empty list is NOT dead code.** It is what makes a NEW offender fail; deleting it deletes
the guard. Mutation-proved with the list empty.

🪤 **I CLAIMED THE PREVIEW'S LABEL WAS THE POINT AND NOTHING HELD IT.** Removing
`aria-label="Preview"` left every test green — the reasoning for choosing `<section>` over `<div>`
lived only in a comment. *A sentence is not a mechanism.* A fourth assertion now holds it, and the
mutation that previously passed now goes red.

🪤 **AND I BROKE A PAGE PUTTING A COMMENT IN IT.** `return ( {/* … */} <div> )` is two expressions,
not one — it parses as an object literal and the file stops compiling. A note above the `return` is
the only place it fits. Caught by typecheck, which is exactly why it runs after the edit and not
before.

🛡 **3 mutations, measured by occurrence count, all RED:** the fixed page growing its frame back
(1→0) · the shell's own `<main>` removed, which would make the whole rule vacuous (1→0) · a pinned
debt line quietly deleted to look cleaner (1→0).

⏭ **This is the shell half of the couple's-screens work only.** The visual port of guests ·
vendors · budget · gallery against the approved archetypes has NOT started.

SPEC IMPACT: None.

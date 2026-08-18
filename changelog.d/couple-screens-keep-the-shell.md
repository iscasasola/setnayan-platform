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

📋 **SEVEN ORDINARY SCREENS ELSEWHERE IN THE EVENT TREE HAVE THE SAME SECOND FRAME — NAMED, NOT
FIXED.** Manpower, the Papic recap, the playlist, the website editor shell, editorial, hero photo
and living hero. I have not read them and will not "fix" pages I have not read. They are pinned so
the number can only **shrink**: fixing one means deleting its line, a new offender fails, and
deleting a line without fixing it also fails. **A bill, not a decision.**
⚠ I first wrote that list **by hand from truncated terminal output and it was missing one**. It is
now generated from the scan itself.

🛡 **3 mutations, measured by occurrence count, all RED:** the fixed page growing its frame back
(1→0) · the shell's own `<main>` removed, which would make the whole rule vacuous (1→0) · a pinned
debt line quietly deleted to look cleaner (1→0).

⏭ **This is the shell half of the couple's-screens work only.** The visual port of guests ·
vendors · budget · gallery against the approved archetypes has NOT started.

SPEC IMPACT: None.

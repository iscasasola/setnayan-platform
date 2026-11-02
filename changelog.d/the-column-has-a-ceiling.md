## 2026-08-18 · fix(event-hub): the desktop column gets a ceiling, and stops there

**What a person gets.** On a large monitor the event page fills **61%** of the
glass instead of 51%, and **stops** — a 2560px screen gets more margin, not a
wider invitation.

**Measured with the owner, on the live page.** After the previous change the
column was 1024px; on his 2000px monitor that is 51%, with 488px of cream each
side. He asked for a limit rather than unbounded growth. **A page that grows
forever stops being a page.**

**The ceiling is 76rem (1216px), and it is FINAL.**

🔑 **76 AND NOT 80, AND THE DIFFERENCE IS THE RAIL — this was arithmetic, not
taste.** The desktop rail floats in the left margin at
`50% − (half the widest column + 7rem + a 1.5rem gap)`. At an 80rem ceiling that
gap collapses to **0.25rem at 1536px** — the rail would all but touch the text.
At 76rem the gap is a constant **1.5rem at every width from 1536 to 2560**:

| viewport | page | rail | gap |
|---|---|---|---|
| 1536 | 1216px (79%) | 1.50 → 8.50rem | **1.50rem** |
| 2000 | 1216px (61%) | 16.00 → 23.00rem | **1.50rem** |
| 2560 | 1216px (48%) | 33.50 → 40.50rem | **1.50rem** |

**The rail's anchor moved with it** — `50% − 40.5rem` → `50% − 46.5rem`, derived
from the new widest column rather than re-typed.

🛡 `rail-fits.test.ts` — 8 assertions. **The page now has TWO desktop widths and
the guard's first cut knew only one**: it modelled a single "widest column" and
went red the moment the ceiling rose — correctly, because the anchor is derived
from the LARGER while the tightest squeeze is at the SMALLER (1280px, where the
clamp is active and the page has not yet grown). It now checks 1280 · 1536 ·
2560.

**Mutation-proved, counts printed:** the ceiling removed (3→0) **1 fail** · the
rail anchor left at the old stage (landed) **3 fail** · restored **8 pass**.

🪤 **AND ONE SABOTAGE WALKED PAST THE GUARD.** The "is it still bounded" check
looked only at `2xl:`, so adding `3xl:max-w-full` **after** the ceiling left it
GREEN while the column grew without limit again. **A ceiling is only a ceiling
if NOTHING above it reopens** — now any responsive unbounded width, at any
breakpoint, fails. Re-run: **1 fail**.

⚠ **AND THE RISK I ASKED THE OWNER TO CHECK TURNED OUT TO BE FINE — I could have
checked it myself.** Measured every rendered sentence on the live page at 2000px:
the longest runs **66 characters**. The reading measure held; nothing stretched.
I had flagged 101 unmeasured paragraphs as needing a human eye when a DOM
measurement answered it in seconds.

SPEC IMPACT: None.

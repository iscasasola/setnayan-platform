## 2026-08-18 · fix(couple): the locked build's costs line up like a bank book

First unit of the couple's-screens design port, against the owner-approved archetypes
(2026-08-04, BINDING — **port, never redraw**).

**What a person experiences:** in the locked build list, the costs down the right-hand side now
line up digit for digit. Before, ₱1,000 and ₱950 sat at different widths and the column staggered.

🔑 **RIGHT-ALIGNMENT ALONE DOES NOT MAKE A COLUMN LINE UP.** The rows were already right-aligned;
proportional figures give each numeral a different width, so the digits still stagger. Equal-width
figures are what the ledger archetype's own words ask for: *"every numeral right-aligned in Space
Mono like a bank book."*

🪤 **THERE WERE THREE ROWS, NOT TWO — AND THE GUARD IS HOW I FOUND OUT.** My scan found two, because
the third is indented differently and my search keyed on the surrounding brace. I fixed two, wrote
the guard, and it went **red**. 🔑 **A guard written from the same scan that found the defects
inherits its blind spot** — unless it re-derives the set. This one matches the RENDER, not the
punctuation around it.

⚖ **WHAT THE PORT DELIBERATELY LEFT ALONE, each read and cleared** — a guard that cries wolf
teaches you to skim past the one time it is right:
- a bare **₱ symbol** beside an input is not a numeral;
- money inside a **sentence** (*"₱4,500 in your build"*) is prose; forcing it mono would make the
  sentence read like a receipt;
- the vendor cards' **serif-italic price** (`.price` / `.hprice`) belongs to a different archetype,
  is applied consistently across both components, and is not a ledger row.

📊 **RULE 0 PAID AGAIN — most of this port is already done.** The app-wide sweep already gave
equal-width figures to **5 of 7** budget files and **23 of 46** vendor files. Of 13 candidates the
crude scan produced, **11 were correct as they stood**. The remaining work on these screens is
smaller than the brief implies.

🛡 **2 mutations, measured by occurrence count, both RED:** one row losing its equal-width figures —
the partial-fix shape (4→3) · the file no longer rendering money at all, which would leave the
guard passing forever (present→0).

⏭ **STILL OPEN on this port:** the roster rule (*"selection lives on the avatar itself"*) and the
comparison rule (*"show the delta, never the repetition"*) are unmeasured. Neither is touched here.

SPEC IMPACT: None.

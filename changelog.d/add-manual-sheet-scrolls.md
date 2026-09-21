## 2026-09-21 · fix(add-manual): the sheet could not be reached, and the payment plan could not be read

Three defects in the one-screen "Add manually" sheet (#5777), **found by driving
it on production the day it shipped** — not by any test. Every one of them
passed a green suite.

**1. The required field and the Save button were off-screen.** Measured in the
live browser: the sheet was **1,513px tall in a 768px window**. It sits in a
`fixed inset-0` overlay, which cannot scroll, and `sm:items-center` centred it —
so it overflowed 372px off **both** edges. The required Vendor name field sat at
**y = −174** and "Save & add" was below the fold. A couple on a laptop could not
fill in the one required name, or save. The old four-field sheet fit; the
consolidation to eight fields and a 200px map broke it.
The sheet now caps its own height (`max-h-[92dvh]`, `sm:max-h-[calc(100dvh-2rem)]`)
and scrolls, and the Cancel / Save & add footer is **sticky**, so the primary
action never scrolls away. `dvh` not `vh`, so the pinned footer does not slide
under a phone's address bar. Re-measured live with the fix applied: sheet 16 →
752 inside the window, name field at y = 214, Save & add pinned at 675–719 and
still pinned after scrolling to the last payment row.

**2. On a phone the payment plan was unusable.** One six-column row per
instalment put the payment's NAME in a **34px** input and its due-date rule in a
**31px** select at 375px, and clipped them even on desktop ("Downpaymer",
"after bo", "before t"). A couple could not read which due-date rule they had
picked — the whole point of a dated plan. Each instalment is now two lines: what
and how much, then when.

**3. …and the two-line fix would ALSO have shipped broken.** A replica measured
inside the live sheet came back at **18px**. The shared `CELL` class carried
`w-full`, and every control added a fixed width on top. Two width utilities on
one element resolve by the order Tailwind EMITS them in the stylesheet, not the
order they are written — and `w-full` won, so every control went to 100% and the
flex row shrank them all together. Removing it: name 169px, due-date rule 130px
against the 88px "before the event" needs.

**Also: the payment plan now prints money through the shared `formatPhp`.** Both
the plan's running total and its shortfall message hand-rolled
`Math.round(n).toLocaleString('en-PH')`, so a ₱1.50 shortfall read "₱2 is
unaccounted for" — a figure the couple could not find in anything they typed.
That is the PR #5744 bug (₱837.50 printed as ₱838) on a new surface. The
money-formatter scan passed it only because it inspects functions NAMED like
converters (`…ToPhp`); the rule is the intent, not the scan's reach. New test:
a ₱1.50 shortfall is named as ₱1.50.

**Guards.** `the-add-manual-sheet-is-animated.test.ts` gains a reachability
block — a height cap on phones and desktop, `overflow-y-auto`, and a sticky
footer — each sabotage-verified to go red. It is explicit that a source guard
cannot measure layout: it pins the declarations whose ABSENCE produced the bug.
Its existing mount assertion had pinned the literal class ORDER
(`sn-addman-sheet w-full max-w-md`) and broke on this edit for a reason unrelated
to animation; it now pins the element.

Sticky works here BECAUSE the sheet's entrance uses `backwards`: `both` would
leave an identity transform on the sheet, and a transformed ancestor breaks
sticky exactly as it breaks `position: fixed`.

SPEC IMPACT: None — layout and formatting fixes to an existing decision.

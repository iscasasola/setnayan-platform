## 2026-08-19 · design(app): 13 more eyebrows, and the guard that could not see them

**SPEC IMPACT:** None.

Owner asked whether the header work was complete. **It was not**, and the guard
said it was.

`lint-page-masthead.mjs` looked for `.sn-eye` **inside a `<header>`**. The eyebrow
has **two spellings** in this codebase — the shared class, and a hand-rolled
`uppercase tracking-[…]` label — and it does not always sit inside a `<header>`.
The entire 109-file ratchet was built from the first shape only, so **22 pages
carrying the second were never debt and were never reported.** Among them:

- *"My Shop → Packages"* over **Your packages**
- *"Add categories"* over **Bring more categories on-stage**
- *"Setnayan HQ · Demand Radar"* over **Demand Radar** — the label repeating the
  title exactly
- *"Setnayan · Pick a date"* over **What date are you thinking of?**

**13 cut.** Each was a breadcrumb, a nav echo, or the title again.

**8 kept, reviewed one at a time and now recorded in the lint's ALLOWED list with
a reason each** — so nobody tidies them later:
- error pages, where the small line is the wordmark and the paragraph is the page
- **敬茶** on the tea ceremony — "Your serving order" alone does not say tea ceremony
- the printed Papic poster, which a guest reads off a wall
- *"Review blocked"* — a red badge with an icon: a **state**, not a label
- a service's **category** above its name, and a package's **type** above its name
  — both classify rather than echo
- the contract document header, whose line carries counterparty and date

**The durable fix:** the guard gained a second half, anchored on the **h1**
instead of the container, so it catches a page masthead wherever it is written.
A `.sn-eye` on a tile or a section is still correct and still untouched — the h1
is what makes it a page header.

🛡 **Mutation-proved:** re-adding a hand-rolled eyebrow above an h1 moved the
occurrence count **0 → 1** and took the lint from ✓ to **✖ 16 files**. Restored,
back to ✓.

🔑 **THIS IS THE THIRD TIME IN ONE SESSION A PATTERN-BASED COUNT UNDER-REPORTED**
(377 → 84 → 7 on section paragraphs; then "app is clean" while 22 pages had it).
**A search finds the shape it already knows.** When a guard reports zero, the
question to ask is what spelling it cannot see.

Verified: `tsc` clean (`--version` first) · full unit suite green ·
`lint-port-no-lost-controls` ✅ 402 routes / 1429 controls · masthead lint ✓.

## 2026-09-22 · fix(your-team): the two strips above the bench stop pushing it off the page

Owner, 2026-09-22: *"if i have 100 vendors and i am inquire to all… i have 100 messages from
suppliers. i will not be able to see the bench anymore."*

He was describing shipped behaviour, not a hypothetical. `waiting-for-quotes.tsx` and
`pending-lock-proposals.tsx` each rendered a bare `items.map(...)` with **no ceiling and no
remainder line**, and `vendors/page.tsx` renders **both above** `<ShortlistCategories>`.
`waitingForQuotes` is `push`ed once per pending inquiry with no limit upstream either.

**Measured in the approved prototype at phone width:** with 100 pending inquiries the bench began
**4,806px** down, against **757px** capped; page height **8,449px** against **4,400px**. About
**five screens of scrolling before a couple could look for anybody.**

🔑 **The rule:** a list that grows without bound may never sit between the top of the page and
something the reader needs. A page's height must not depend on how busy the couple has been.

- **`lib/capped-rows.ts`** (new, pure) — `capRows(items, ceiling)` → `{ shown, hiddenCount }`,
  `hiddenMoreLabel(hiddenCount, noun)`, `DEFAULT_ROW_CEILING = 3`.
- **The remainder folds IN PLACE, in a native `<details>` — it is not linked away.** Every
  proposal row is actionable ("Lock now" is a money-adjacent confirm), so hiding one behind a route
  that does not exist would remove the couple's ability to answer it. `<details>` also needs no
  JavaScript.
- **Two refusals are built into the module rather than asked of its callers:**
  - **It cannot say "…and 0 more".** `hiddenMoreLabel` returns `null` for a zero remainder, so the
    phrase is *unrepresentable* — there is no string to put in the row, so the row cannot exist. A
    list of exactly the ceiling length looks like an uncapped list, which is what it is.
  - **A broken ceiling hides nothing.** Zero, negative, NaN or Infinity returns everything. Failing
    open is the only safe direction: "hidden by arithmetic" is indistinguishable on screen from
    "they are not there".
- **Empty is still empty.** Both strips early-return `null` on an empty list and still do; the cap
  never invents a header for nothing. Pinned by the guard.

Proof — `lib/capped-rows.test.ts`, 9 tests, all EXECUTING the module:

- the owner's case: 100 rows → 3 shown, **97** counted (the real remainder, not a guess);
- 🪤 exactly-the-ceiling → `hiddenCount 0` and the label is **null**;
- 🪤 a broken ceiling (0, −1, −100, NaN, Infinity) → **everything shown, nothing claimed hidden**;
- `shown.length + hiddenCount === input.length` for every size 0…12;
- null/undefined lists, and a fractional ceiling that floors;
- and a source guard that both components import the cap, call `capRows(items)`, word the remainder
  through `hiddenMoreLabel`, fold it in a `<details>`, still `return null` on empty, and **no longer
  contain `items.map(`**.

⚠ **Three sabotages, each watched go red, each caught by the right test:**

| sabotage | what failed |
|---|---|
| `capRows` returns everything | the 100-row case and the fractional-ceiling case |
| drop the zero guard in `hiddenMoreLabel` | the ceiling-length, short-list and zero-phrase tests |
| put `items.map(` back in the component | the source guard |

🪤 **And the guard's first version convicted the fix.** It fired on the docblock I had just
written, which *quotes* `items.map(...)` as the thing that used to happen. It now strips comments
first through the repo's canonical `stripComments` (`lint-one-comment-stripper.mjs` exists to keep
there being exactly one). **A phrasing ban that cannot tell code from a comment about code will
eventually forbid explaining itself.**

Verified: `tsc --noEmit` clean · 9/9 · `lint-dup-rule-baseline`, `lint-exposure-baseline`,
`lint-one-comment-stripper`, `lint-port-no-lost-controls`, `lint-page-masthead` pass ·
`check-migration-timestamps` 1478 migrations.

SPEC IMPACT: None. No locked decision changes; the ceiling is a geometry bound, not a product rule,
and nothing is made unreachable.

**Not in this change, deliberately:** neither strip is given an error signal by `vendors/page.tsx`,
so a refused read and "no pending inquiries" both arrive as an empty array and render identically.
That is a real gap of the class this project has shipped seven fixes for, it is **not** made worse
here, and closing it needs an upstream error flag — its own slice, not a cap.

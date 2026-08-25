## 2026-08-26 · fix(admin): the console stops printing the plumbing at you

The owner read `AWAITING_VENDOR` off his own Completions screen and asked what it was —
the stored column value, rendered raw and uppercased by CSS. The same page ended with
*"table `event_vendors` (migrations 20270101000000 + 20270106000000)"*.

**13 files were showing a person schema. Now 1, and that one is legitimate.**

🔑 **THE SWEEP WAS WRONG TWICE BEFORE IT WAS RIGHT.** Searching for the string
`Source ·` found **8** files. The real number was **13** — five screens carry the same
defect in a different shape: `(iteration 0026)` inside an otherwise-fine sentence,
`(iteration 0023 § 3.11)`, and a table name inside an **error message** the operator
reads when a count fails. **One spelling is not a survey**, the third time that has cost
this project. The guard matches the THING (a migration number, an iteration reference, a
snake_case table in `<code>`), never a phrasing.

**Removed** where the footer carried nothing a person needs: Completions · Chat flags ·
Disputes · Repost watch · Price bands.
**Rewritten in English** where the content mattered and would otherwise be lost:

- **Payment methods** kept its "historical audit only" warning — without it an operator
  could believe money still moves through those rails.
- **Integrity watch** kept what it actually watches for, including the conditional
  price scanner, and that it only ever flags for a person.
- **User reports** kept the reason it exists: both app stores require it, so an
  unattended queue is a compliance problem, not only a moderation one.

**A stored status is now words.** `awaiting_vendor` → *"Supplier has not confirmed"*, and
the badge stops rendering in the mono-uppercase data face that made a column value look
like a code. An unmapped value falls back to the raw word — an empty badge would be worse
than an ugly one.

⚖ **Two sites are deliberately legal and the guard exempts one by name:**
`<code>true</code>` on Free windows is the literal value an operator must set, and
`<code>status</code>` on the Taxonomy studio explains a field they can see. Naming
something the person acts on is not developer text.

🪤 **A run that meant nothing:** the first full-suite pass reported **141 failures** and
`tsc` exit 1 with **zero** TS errors — because dependencies were never installed in the
worktree, so `react` could not resolve and `npx` tried to fetch `tsc`. Both symptoms, one
cause. Re-run after install: **10,049 pass / 0 fail**.

Guard: `app/admin/the-console-speaks-english.test.ts` — 3 assertions, comments stripped
before matching, with a can-it-fire floor (walks >100 real files and re-tests the pattern
against the exact string it was written for).

SPEC IMPACT: None — copy only; no rule, price or behaviour changes.

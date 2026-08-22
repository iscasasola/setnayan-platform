## 2026-08-22 · fix(people): the page's own actions sit together, and the one that cannot be honest is not drawn

Owner, holding the approved mock next to the live page: *"seems different from
your design. where the buttons live add an alaga, new group (samahan), import
contacts."*

He was right, and I had reported the remaining gaps twice without noticing this
one. The mock puts **three** buttons in the header row; **one** shipped, floated
alone on the right, and "New samahan" had been left as a text link at the bottom
of the page — reachable, but not where the design says it lives.

**Now:** one row at the top with both doors this page actually owns — **Add an
alaga** and **New samahan**. Neither is a new destination; the samahan page has
existed all along.

### ⛔ "Import contacts" is deliberately absent, and it is a rule that stops it

The owner locked this the day before: *"these people must have an account to be
listed as people."* A pasted address book is mostly people who do not have one,
so a contacts import reduces to one of two things:

* telling you **which of your contacts are on Setnayan** — an enumeration oracle
  over a list you supply, which is precisely what `lib/people-search.ts` is
  written NOT to be; or
* **bulk-emailing strangers** who never asked.

Either is a worse product than a missing button, and a button that opens neither
is a fake door — this codebase has already deleted an entire SKU for being sold
and undeliverable. It is not drawn, and a test keeps it that way with the reason
attached, so the next person to consider it starts from the rule rather than from
the mock.

⚠ **The mock's visible "People 16" heading is also absent, and that one is not
mine to restore**: page titles across the app became screen-reader-only under a
separate owner-locked change. The count still reads on the "Everyone 16" chip.

Guard: 5 assertions in `the-buttons-live-together.test.ts`, matched against the
page source with **comments stripped** — a rule mentioned in prose is not a rule
the page renders. Mutation-measured: removing New samahan from the row (2 → 1
mentions, the survivor being the comment) turns it red.

SPEC IMPACT: None — no schema, no new destination, no decision reversed. The
"Import contacts" reasoning is recorded in `DECISION_LOG.md` alongside the
account rule it follows from.

# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-06 · feat(vendors): removing a category archives its conversations — and restoring brings back exactly those

Owner: *"how about archive. just means, that category will no longer be on their choices to build"*,
then, asked directly: *"yes archive the conversations too."*

### What was true before, and why the first draft of this was a lie

`excludeTileFromPlan` wrote ONE `event_category_decisions` row and touched nothing else — no
threads, no picks, no `event_vendors`. An earlier version of the requested copy would have told
couples *"the inquiries for these vendors will be deleted as well."* **That was false, and the false
half was the frightening half.** Now the archive is real, and the copy describes it exactly.

### Archive, never delete — the existing mechanism, reused

Stamps `chat_threads.archived_at`, the marker `withdrawInquiry` established 2026-07-24. That
decision's reasoning holds here unchanged: the conversation is the dispute/evidence record and the
source of the couple-confirmed booking amount, and the vendor is its other party. **There is no
DELETE policy on `chat_threads` at all** — a hard delete would be refused by RLS anyway.

### 🔑 The hard part: restore must not RESURRECT

A blanket un-archive on restore is a data-loss-shaped bug pointing backwards: it would also revive
threads the couple deliberately withdrew weeks earlier with `withdrawInquiry`, silently overwriting
their decision with an unrelated one.

So the exclusion's own `decided_at` is the **correlation stamp**: every thread this removal archives
carries the exact timestamp stored on the decision row, and the restore un-archives only threads
carrying that stamp. A thread the couple archived themselves has a different timestamp and is left
exactly as they left it. **No new column** — `event_category_decisions.decided_at` already exists
and was already written; `archiveStamp()` returns one value used for both writes.

### Two orderings that fail silently if reversed — both guarded

- **The decision row is written BEFORE any thread is archived.** Reversed, a failed upsert leaves
  conversations stamped with a timestamp no row holds: invisible to the couple and unreachable by
  any restore.
- **`decided_at` is read BEFORE the decision row is deleted.** Reversed, the only link back to the
  archived conversations is destroyed first.

Neither raises an error. Both now have source-anchored tests.

### A booked supplier's thread can never be archived here

The locked-category guard predates this and runs first — `canRemoveTileFromPlan` hides the control,
`excludeTileFromPlan` refuses the write with `REMOVE_BLOCKED_LOCKED`, fail-closed. By the time the
archive runs, the category is *proven* unlocked. That is a property of the ORDER, so a test asserts
the guard still precedes the archive.

### The couple is told

`REMOVE_FROM_PLAN_NOTE` — *"The category leaves your choices, and your conversations with those
suppliers move to Archived — nothing is deleted. Add it back and they return."*

It rides the button's **aria-label and title**, NOT an `sr-only` span: `aria-label` overrides inner
text for assistive tech, so a hidden span inside that button would have reached nobody — sighted or
not. A test asserts the note is on the label and that it never claims a destruction the code does
not perform.

⚠ **Open, and an owner call:** on touch there is no hover, so a touch user gets no *visible*
disclosure before the removal happens. A confirm step would fix that and is deliberately NOT built
here.

### Tests

15 in `category-archive.test.ts` — 9 pure, 6 source-anchored. Mutation-checked, each red on exactly
its own case: blanket un-archive · re-stamping an already-archived thread · archiving before the
decision row · dropping the locked guard · a lying note · the note dropped from the aria-label.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-06 (already logged: removal is an archive, not a delete; the
locked-category guard already shipped). No schema, migration, SKU or price change.

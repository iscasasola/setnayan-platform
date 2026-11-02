## 2026-08-04 · feat(admin): clear a folder of left-over media in one go — with the gates that make it safe

The owner opened `/admin/website-media` and reported **1,878** deletable files. The page offered single-file delete only, each behind its own confirmation. That is not a usable path, and a surface that can only be cleared one confirmation at a time never gets cleared.

### The prohibition this reverses, and why it is answered rather than ignored

`actions.ts` said in its own header that a bulk control *"would be a mistake: the left-over verdict comes from a database read, and a read that breaks or gets scoped wrong reports every file as left-over at once. One keystroke should never be able to act on that."*

**That reasoning is correct**, so the danger is now *caught* instead of avoided. `clearLeftoverMediaAction` refuses on five gates, all server-side, all before a single delete:

1. **Admin required.**
2. **The verdict is re-read.** `loadWebsiteMedia()` runs fresh; the screen's classification is never trusted. The action takes a folder and a count — **never a caller-supplied list of keys**, which would make the browser the authority on what gets deleted.
3. **A read that did not complete deletes nothing** — failed lookup, failed listing, or a truncated listing all refuse. A failed read and an empty result are the same value; that is the whole hazard.
4. **"Everything is left over" is treated as a broken query, not a tidy bucket.** This is the exact signature the old header warned about: if not one file *anywhere* in the bucket reads as in use, refuse. The logo set and menu icons alone are always in use.
5. **The confirmed count must still be the real count** — the admin types the number, and a bucket that moved between render and click is refused rather than silently acted on.

Every key in the loop still passes `assertDeletableKey`, and only rows the fresh read calls unreferenced are eligible — *Not sure* is refused as firmly as *In use*.

**The control is deliberately not one tap:** the admin types the file count to arm it. The difference between clearing 3 files and clearing 1,878 should be something a person notices in their hands, not a number they skim past.

**`lib/website-media-bulk-gates.test.ts`** pins all five, plus that each refusal sits *before* the delete loop — an accidental reorder is exactly what a "simplifying" edit would do. It also asserts the header still records why the rule changed, so a reader who finds the action but not the reversal doesn't assume it slipped in unnoticed. **Mutation-verified:** removing gate 3 or gate 4 turns it red and names which.

Verified: 6490/6490 unit tests, `tsc --noEmit` clean, lint clean.

SPEC IMPACT: None — reverses an in-code rule, not a corpus decision. Recorded in `DECISION_LOG.md`.

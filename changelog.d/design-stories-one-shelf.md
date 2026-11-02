## 2026-08-13 · feat(stories): one shelf, three voices — and the council lock finally has a guard

Owner ruled **"option B"** on the drawn comparison (`prototypes/stories_page_one_shelf_or_two_2026-08-13.html`). On `/realstories` the editorials, the storytellers' chapters and the Journal now share **ONE shelf**, and the **card** says which kind it is. `StorytellersShelf` and `JournalRail` are **deleted, not hidden**.

**What the page looked like before.** Its headline promises *"the front-page story of their life"* and the only life on it was Maria & Jose — a **sample**. Under that sat an empty heading (0 featured chapters). A year of real writing — **33 published articles** — was three cards at the bottom labelled *"practical guides"*.

### 🔒 The council lock of 2026-07-16 is intact — and is now enforced

The lock is that the voices **never blur into one grammar**. All three still render through their own shipped components (`Tile` / `StorytellerTile` / `StoryCard`); nothing was redrawn. **What merged is the HEADINGS.**

🔑 **The lock's comment said *"they render in two labelled sections"*, and that clause had been read as part of the lock.** It was its *implementation*. The comment now says so.

⚠ **This DOES reverse a later spec decision.** `FABLE_Public_Marketplace_Spec` § 4e chose *"Journal-in-grid intent honored by E4's labelled rail instead"*, reading a uniform grid as erasing the lock. That reasoning holds for a **uniform** grid; this shelf is not uniform. **I had told the owner nothing stood against the change — that was wrong, and he was told before this was built.**

**And the headings were the only thing enforcing the lock.** Nothing tested it. With them gone, the next person sees three card shapes in one grid and reasonably tidies them into one — the exact uniform grid the lock forbids, arriving as an improvement. `stories-one-shelf.test.ts` now asserts it.

### Three traps paid on the way

🪤 **The `#storytellers` anchor lived on the deleted section.** `/storytellers` is a live 302 to `/realstories#storytellers`; deleting its section without re-homing the id turns a working redirect into a scroll to nowhere. It moved with the chapters, onto the container so it survives an empty list.

🪤 **The volume-gated search path would have SPLIT THE PAGE BACK INTO TWO.** It renders its own two labelled sections and mounts only above `STORIES_SEARCH_MIN_POOL`. Left alone, the layout would have reverted itself **on success** — the day the shelf finally filled — with nothing to blame. Merged too.

🪤 **The port-control lint fired, and its escape hatch was a trap.** It correctly reported `/realstories` losing `JournalRail` + `StorytellersShelf`, and offers *"regenerate the baseline."* **Regenerating dropped FOUR MORE controls** — `updatePlanningDeadline`, `toggleChecklistItem`, `reissueAction`, `signInWithPassword` — **all of which still exist in `origin/main`'s code**, i.e. a detection change, not removals. Committing that would have recorded them as deliberately removed and **retired the guard's protection over them permanently**. The baseline was hand-edited instead: the diff is **exactly four lines**, all mine. **A baseline is a bill, not a decision** — see the standing note on a guard blind spot becoming a baselined lie.

### Guards, mutation-tested by occurrence count

`stories-one-shelf.test.ts` — 7 assertions: the three voices are imported not redrawn · both kinds declare themselves on the card · the companions are grid **children**, never a second grid (which would rebuild two shelves one level down and look almost right) · the retired components are gone and unreferenced · the `#storytellers` anchor survives · the search covers all three voices and the empty state needs all three empty · the page actually passes all three in.

**7 sabotages, 7 caught.** ⚠ One probe aborted the harness first: `id="storytellers"` occurs **twice** in the file because my own comment names it. The guard strips comments before matching, so the honest landing check is 2 → 1 — which also proves the comment alone cannot satisfy it.

Full suite **7862 tests, 8 failing — the same 8 that fail at `origin/main`** (`papic-*-metering`, `perceptual-hash`, `vendor-deep-search*`), all local-environment. All 23 lint scripts pass.

⚠ Articles are capped at **6** here, not the rail's 3: on one shelf they *are* much of the content.

SPEC IMPACT: `FABLE_Public_Marketplace_Spec_2026-08-08.md` § 4e (the E4 labelled-rail decision) is superseded by the owner's 2026-08-13 ruling. Recorded in `DECISION_LOG.md`.

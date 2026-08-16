## 2026-08-15 · fix(privacy): "link only" now actually stays unlisted — and the fallback that ignored the setting entirely

Owner, 2026-08-15: *"it is the owner's choice if they want this in public or link
only or tagged accounts only (no tagged account means it is private for them)."*

**1 · A LINK-ONLY CELEBRATION COULD BE LISTED PUBLICLY AND HANDED TO GOOGLE.**
The editorial loaders asked `.neq('landing_page_visibility', 'private')`, which
admits **`'unlisted'`** — the value the couple's own privacy screen sells as
*"link only"*. So a page whose owner had chosen that only people with the link
should find it was eligible for `/realstories` **and** for
`sitemap-weddings.xml`.

⚖ **The showcase consent does not cover this.** `public_summary_consent_at`
answers *"may Setnayan write about us?"*. It is not permission to re-list a page
its owner deliberately unlisted. Both gates must pass; now they do.

🔑 **THE OLD SPELLING FAILED OPEN ON A VALUE IT NEVER NAMED.** An exclusion test
over an enum that can grow admits every future member by default — so the guard
bans the SHAPE on this column, not the one old spelling. That matters
immediately: a fourth state ("tagged accounts only") is coming, and under the
old shape it would have been born public.

**2 · 🚨 THE FALLBACK PATH HAD NO VISIBILITY GATE AT ALL — a PRE-EXISTING hole,
not one introduced here.** The consented read has a pre-migration fallback for
the featuring columns. The primary query carried the visibility filter; **the
fallback never had one, in any form.** It is entered on ANY error from the
primary query — not only the unknown-column case it was written for — so a
transient failure silently downgraded the shelf to a read that would list a
celebration whose owner had set their page **private**.
🔑 **A FAIL-SOFT PATH MUST BE AT LEAST AS STRICT AS THE ONE IT REPLACES.**
Degrading ordering is graceful; degrading a privacy gate is a leak that only
appears on a bad day, when nobody is looking.

🔬 **Found by the guard counting reads against gates, not by reading the file** —
and it surfaced as a RED BASELINE before any mutation was run. Had I trusted the
first mutation result instead of stopping to ask why the baseline was red, both
mutations would have been meaningless.

🛡 `lib/showcase-visibility.test.ts` — 2 tests: every events read in the module
gates on `= 'public'`, and the number of gates is never fewer than the number of
events reads (which is what caught #2 and what will catch a sixth read added
without one). Comments stripped before scanning, because this module now
*describes* the removed filter in prose. **Baseline verified GREEN, then two
sabotages, each verified to have LANDED by occurrence count** (`neq` 0→1 RED;
gates 5→4 RED).

**Impact today: none visible.** Prod holds 2 public weddings, 3 private, **0
unlisted** — so nothing was actually mis-listed. This closes the door before the
first person uses the setting.

⏭ **NOT built here — needs the owner:** the third state, *"tagged accounts
only"*. `landing_page_visibility` is `public | unlisted | private`; the new state
has no agreed meaning yet, because **`guests` has no account link at all** (only
`person_id`) and `event_members` — the sole account↔event link — currently holds
only the couple, who can never be "untagged". Defining it wrong is a privacy
error in one direction or a dead feature in the other, so it is asked, not
guessed.

SPEC IMPACT: `STORIES_AND_EDITORIAL_INTEGRATION_2026-08-15.md` § 5 and
`DECISION_LOG.md` 2026-08-15 — updated in the corpus.

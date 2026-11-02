## 2026-08-15 · fix(stories): nine finished sample stories were invisible — now twenty, one for every kind of event

**RULE 0 PAID OFF AGAIN. The owner asked for "sample stories for each event" and
NINE ALREADY EXISTED** — a debut in Makati, a graduation in Quezon City, a family
reunion in Cebu, a golden anniversary in Pasig, and five weddings. Written,
deployed, live at their own URLs.

🚨 **AND THE STORIES PAGE LINKED TO NONE OF THEM.** It asked
`showcases.length === 0`, and prod holds **one** seeded sample ROW — so a single
database record concluded "we have stories" and switched the entire in-code
library off. Measured live before the fix: `/realstories` rendered exactly one
card, and it was not one of the nine.

🔑 **A ROW IS NOT A STORY.** The seeded sample is a published row and is not a real
story; conflating the two is the whole bug. The count now filters samples out
first.

🔴 **MEANWHILE THE SITEMAP WAS PUBLISHING ALL NINE TO GOOGLE.** `sitemap-weddings.xml`
decided independently (`if real.length > 0 … else all samples`), so the site had
**nine orphan pages: indexed, crawlable, fictional, and reachable from no link on
the site.** 🔑 **SPLITTING ONE RULE ACROSS TWO FILES IS HOW THAT HAPPENED** — the
rule now lives in `lib/sample-stories.ts` and both publishers ask it.
**The sitemap is the half that rots quietly:** a page that stops rendering samples
is obvious in a second; a sitemap still offering fictional URLs is visible to
nobody but a crawler.

🪤 **THREE SAMPLES POINTED AT COVER IMAGES THAT 404 ON PRODUCTION** (graduation,
reunion, anniversary). Nothing threw — the card silently fell back. A missing file
is not a design decision, so the dead paths are removed and the fallback is now
deliberate. Guarded: a test fails when any sample names a cover file that is not on
disk.

**ELEVEN NEW SAMPLES, so all sixteen kinds are covered** — christening, birthday,
gender reveal, celebration, travel, corporate, tournament, gala night, simple
event, date, hangout. Written in the shipped Chronicle voice (witness pull-quotes,
edition numbers, service badges, team credits); **nothing was redrawn** — the
existing record shape and components are unchanged.
🛡 Coverage is **DERIVED from `ANCHOR_BY_TYPE`**, the same canonical roster
`event-type-coverage.test.ts` already uses — add a seventeenth kind to the product
and this suite demands a sample for it, with no list to hand-edit here.

⏱ **THE OWNER'S RETIRE RULE (2026-08-15), verbatim:** *"samples will be gone once
we have created 5 event stories in public."* Implemented as one named number.
Below it the page shows **real stories AND samples together**, so the first four
real ones appear beside them rather than replacing them; the fifth retires the
samples from **both the page and the sitemap** in the same instant. Measured:
0 → 20 shown · 1 → 20 · 4 → 20 · **5 → 0**.
⚖ It **fails toward showing** — a negative or `NaN` count still shows samples,
because an empty Stories page on launch day is worse than one badged sample too
many.

🪤 **I BROKE THE PAGE MID-EDIT AND THE TYPECHECK CAUGHT IT** — a scripted
restructure of the item list left three stray lines (a duplicate closer and an
orphaned ternary arm). Seven syntax errors, fixed; `tsc` is clean in every file
this PR touches. Also self-caught before commit: one palette colour written as
`#B9A externa` — a valid string, not a valid colour — now guarded by a test that
checks every palette entry.

**Verification:** 17 tests green (10 new + 7 existing Stories) · **9 sabotages,
each verified to land by occurrence count, all 9 turn the suite red**, baseline and
post-restore green · all 24 lint scripts pass · `tsc` clean in the touched files
(the 262 remaining errors are missing third-party packages in the borrowed
`node_modules`, identical before and after).

**Files:** `apps/web/lib/sample-stories.ts` (new) ·
`apps/web/lib/sample-stories.test.ts` (new, 10 tests) ·
`apps/web/lib/real-weddings.ts` (+11 samples, −3 dead image paths) ·
`apps/web/app/realstories/page.tsx` · `apps/web/app/sitemap-weddings.xml/route.ts`

SPEC IMPACT: Records the owner's 2026-08-15 retire rule (samples disappear at five
real public stories) and the decision to cover all sixteen event kinds. Logged in
`DECISION_LOG.md`. No price, SKU or locked decision touched.

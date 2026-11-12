## 2026-11-12 · feat(suppliers): Find is organized by the plan — one pinned row, listed categories only, booked → asked → liked → suggested → ideas

- **Pinned row ("option 4").** The `Find ▾` menu rows carry a one-line meaning; the count ("2 of 5 covered") and its bar fold into the row; the row's one action is the next page (`Build 3/6 ›` · `Booked 2 ›` · `Find ›`), then ⚙. The "Cover your event" block above the list is gone.
- **"N of M covered" counts only listed categories** (`resolveBenchRing({ listedOnly: true })`): a category is listed once a supplier was asked or booked there. A brand-new event shows "nothing added yet" and the empty state; new categories are reached through the thumb-row search and ＋.
- **Order inside an open category:** Booked → Asked → Liked ideas → Suggested for you (3 cards + "Search all <Category> (N) ›") → Ideas (4 photos + "More ideas ›"). A booked or covered category collapses the last two to "✓ Done · Search again ›".
- **Liked ideas link to the exact card** via `moodboard_library_assets.vendor_service_id` ("From <shop> · <card> ›"), else "Find who does this ›". A liked supplier photo shows "Ask for a quote" (`cardVerbWords('ask')`) — never automatic; pressing it asks and moves the card into Asked.

Overturned guards (owner ruling 2026-11-12 supersedes 2026-10-26 "cover header is calm"): `the-cover-header-is-calm.test.ts` (count/bar now in the pinned row), `the-info-dot-is-round.test.ts` (bench ⓘ removed), `more-to-compare.test.ts`, `marketplace-masthead-and-layout.test.ts`, `supplier-sheet.test.ts` (sheetDoor.open is now 3 calls), `the-badge-has-a-deadline.test.ts` (bill line for `lib/find-inspiration.server.ts`).

SPEC IMPACT: DECISION_LOG.md row 2026-11-12 "Find is organized by the plan" (Setnayan-specs 98e10d4d). Prototype: claude.ai/artifact/7CKa6wbHUH7xDGZm7b29fA.

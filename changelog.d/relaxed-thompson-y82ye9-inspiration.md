## 2026-11-06 · feat(suppliers): R5 — the Inspiration box lives in Suppliers › Find (frames A · B · C + the ✎ sheet's looks)

The event-menu reorganisation's R5 (`EVENT_MENU_REORG_BUILD_PLAN_2026-10-27.md` step 11), built from the owner-approved
prototype `prototypes/inspiration_in_find_2026-10-28/` (DECISION_LOG 2026-10-28 "INSPIRATION LIVES IN SUPPLIERS ›
FIND" *"on find"*, "FINAL FRAMES A–F APPROVED"). Nothing new is stored: the couple's shipped `event_inspiration_assets`
(filed by `slot_key`), the admin's parts (`getInspirationParts` · `partCategories`), and a gallery pick's shop
(`library_asset_id` → `moodboard_library_assets.vendor_profile_id`).

- **A** — "Your inspiration board" is the first row of Find: a stack of three covers, "N photos · N parts · N from your
  suppliers", an ⓘ. It opens the whole board.
- **B** — an opened category draws its Inspiration strip first, above its suppliers: one tile per part with photos
  (cover · "On your list" when the photo's shop is in the couple's picks · name · "N photos"), ＋ Add a part last. A
  category with parts and no photos yet still offers ＋ Add a part.
- **C** — `?board=1` opens the SHIPPED `InspirationBoard` (Studio › Mood Board's, with its upload and gallery actions)
  whole, in the house `Sheet` over Find — moved, not redrawn; no new route.
- The ✎ "What to show" sheet's empty `data-find-looks` slot now holds each service's looks (the parts it supplies,
  with counts), greyed while the service is unticked; its search finds a service by a look's name too.
- A refused read is said ("We couldn't read your inspiration board…"), never drawn as an empty board.
- ⓘ: "How Suppliers works" names the board; tour `customer_suppliers_v1` gains a "Your inspiration board" stop.
- `/dev/suppliers-lab?insp=1|empty|unread` draws A and B on fixtures for the proof.
- Guard `lib/inspiration-lives-in-find.test.ts` (4 tests, each sabotaged red).

NOT in this PR (next build, same prototype): **D** saving a supplier's photo → shortlist + one auto-inquiry + Undo ·
**E** the supplier's "The looks they liked" card · **F** the mixed service + inspiration carousel under each supplier ·
the board's Share into a supplier chat · regrouping C by category › part. Studio › Mood Board keeps its inspiration
part for now (its palette is read from those photos) — the owner's call on removing it is in the PR.

SPEC IMPACT: `EVENT_MENU_REORG_BUILD_PLAN_2026-10-27.md` step 11 (R5) marked PARTLY BUILT (A–C, draft PR); no decision
changed.

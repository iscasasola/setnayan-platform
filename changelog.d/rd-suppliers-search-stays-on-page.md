## 2026-10-24 · feat(search): search or add — Suppliers and Guests keep the result on the page

Owner, 24 Oct, verbatim: *"we will show the result on the page itself. not a new screen. So it searches what we
already have on the shortlist, what service card has that, or add my own new supplier's service card manually that i
can give the supplier itself."* · *"it is search or add for both guests and suppliers"* · *"the add manually is the one
with QR"*.

- **Suppliers** (`shortlist-categories.tsx`): the "From the whole marketplace" rows (each a link to `/v/{slug}`) and
  the "See all results in the marketplace" door to `/explore?q=` are gone, with their debounced whole-marketplace
  fetch, its lab stand-in and their CSS. A hit still opens under its own category row (the shipped filter — kept).
  While searching, the last row is "＋ Add “…” as your own supplier" — the thumb row's own ＋ door (`addYourOwn`), so it
  opens the shipped `AddYourOwnWalk`: step 1 checks the marketplace by name ("Is this them?"), step 4 is the link + QR
  to hand the supplier. The empty line now reads "Nothing in your shortlist matches “…”. Add them as your own below."
- **Guests** (`guests-screen.tsx`, search block only): with hits, the last row is "＋ Add “…” as a guest" →
  `openAddGuest(q)` (the shipped sheet, name filled in). With no hit the shipped block stays (one-tap add + picks); its
  title points at the add ("Nobody matches “…”. Add them below.") and its button reads the same words.
- One shared button, `components/search-add-row.tsx` (`SearchAddRow`), clips a long name inside its quotes so the
  label fits 375 px. No new server action, no new mechanism.
- Guards: `vendors/search-or-add.test.ts`, `guests/_components/search-or-add.test.ts` (the Guests one on the render).
- Regenerated: `scripts/port-control-baseline.json` (drops `/explore?q=[seg]` and `MarketSearchStandInCtx.Provider` —
  the deliberate removal), `lib/ugat/screens.generated.json`.

SPEC IMPACT: None — implements the owner's 2026-10-24 ruling on an existing surface; no locked decision changes.

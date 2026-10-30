## 2026-10-30 · feat(suppliers): the place sheet opens on the Top 10 and locks to a booked reception; one ✕ inside every thumb-row search; the category ✎ comes and goes

The Find / top-line pieces of the APPROVED final Event › Suppliers design (corpus DECISION_LOG "APPROVED — THE FINAL
EVENT › SUPPLIERS DESIGN (Find · Build · Booked) IS THE BUILD CONTRACT"; prototype
`prototypes/build-contracts-2026-10-30/suppliers-final/`, `_build-src/city.js · extra.css`; owner notes 75–88 of
`OWNER-NOTES-2026-10-29-30.md`) that no other build carries. Stacked on #7054 (Find v4), whose ✎ it animates.

- **Your place — Top 10** (owner "we show the top 10 locations in the country … and also allow search city?"): the
  shipped `CityPick` gains `start="top10"` — with nothing typed it lists the app's own ranked wedding cities 1–10
  (`wedding-cities.ts`, read through `lib/your-place.ts` `topPlaces()`, never copied), rank numbers, km from the
  reception's pin; search and Near me are unchanged. The Maker's Details keeps its nearest-first list.
- **Your place — locked by a booked reception** (owner "once a reception is booked, location changed to the receptions
  location"): the place sheet draws the reception's city read-only (its pin's nearest curated city; else the stored city
  / its address) with one line why, and no picker. `nearestCity` now lives once, in `lib/your-place.ts`
  (`details-city-pick.tsx` re-exports it).
- **✕ inside every thumb-row search** (owner "this search bar needs to have an x inside to clear the text with one
  click"): `components/thumb-row.tsx` draws one ✕ inside its own search field (44 × 44 press, 28 px disc), shown only
  with words (`:placeholder-shown`, so it takes no room at 320 when empty), clearing through the input's own event and
  never raising the keyboard. The separate riding-only ✕ seat and the browser's own search ✕ are gone — one ✕.
- **The category ✎ comes and goes** (owner "this and the pencil icon stays hidden until that is highlighted.. and
  animate it entering and leaving"): #7054's ✎ stays mounted (inert, unread) on its row once the list is read, and
  grows + fades in as the row opens and folds away as it closes (`@starting-style` for the first opening). The open
  row is tinted at every width; the ✎ is a framed pill (accent while a service is hidden); on a phone the open row drops
  its state word so the category name is never broken mid-word.

NOT built here: up to 2 regions on the place (no column holds two — needs an owner/schema call), the folded row's
📅 / 📍 chips (that row is #7078's), and the Yours · Suppliers · Inspiration view icons on the open row (not built
anywhere yet). The date chip already opens the shipped "Your date" sheet (Help me choose included) — unchanged.

Guards: `lib/your-place.test.ts`, `lib/every-thumb-row-search-clears-in-one-tap.test.ts`,
`app/dashboard/[eventId]/vendors/the-pencil-comes-and-goes-with-the-open-row.test.ts` (each sabotaged and seen to fail).

SPEC IMPACT: None — builds an approved design as drawn; the open questions (regions storage, Find's km anchor for a
picked city) are reported to the controller, not decided here.

## 2026-10-30 · feat(suppliers): Find's sort is one ≡ on the thumb row — Nearest picks the venue, Budget fit asks a range

Owner, 30 Oct, on Suppliers › Find's "Best matches" ▾: *"this dropdown's list has too much wording per row"* ·
*"if they pick nearest to my budget. should we ask what is their budget range for this search? … lowest and highest"* ·
*"our budget range will depend on the lowest and highest service cards for that category"* · *"nearest means it is
compared to either their booked reception venue or ceremony venue … we make them choose?"* (answered "Reception +
Ceremony") · *"this is a filter and sort parameter? shouldn't this be on the thumb row?"* · *"so it applies to all?"*.

- **Shorter rows.** The ranking choices read **Nearest** · **Budget fit** · **New suppliers** (were "Nearest to your
  venue" · "Fits your budget" · "New here"); a greyed row's note is a few words ("Add your venue first" · "None here
  yet"). `lib/ranking-lenses.ts`; Explore's lens chips read the same labels.
- **≡ on the thumb row.** The sort always applied to every category but was drawn inside each open one. It is now the
  Find thumb row's sort seat (`FindThumbRow` `sort` → the shared `ThumbMenu`, Guests' place for the same thing), one
  control for the page. The pre-replan bench keeps its bar.
- **Nearest to reception · Nearest to ceremony.** One row per venue with a pin, in the same list — measured from the
  Event Hub's own two venues (`resolveEventVenues`: a booked venue's pin, else the couple's own;
  `lib/find-near-anchors.server.ts`). One pin, or the same place twice → one row, "Nearest". The reception is now the
  BOOKED reception's pin where there is one (it was the first venue ever saved). Nearest is offered whenever a venue has a
  pin — an empty bench no longer greys it with "Add your venue" for a couple who has one.
- **Budget fit asks a range.** Under Budget fit each open category shows "Your range [₱lowest] – [₱highest] ⓘ"; the
  boxes start at the cheapest and priciest card in that category, typing reorders it at once (in range first, then the
  closest prices — nobody removed), a blank end is open. Held for this search only: nothing is written and the budget
  plan never changes. Budget fit is always offered now (it asks).
- Only the ORDER and the pill move ("Closest to your ceremony" · "In your range"); a card's own distance line and
  badges are untouched (`SortShape` in `lib/bench-sort.ts`, `orderInlineMoreRow`'s `adjust`).

Guards: `lib/find-sort-choices.test.ts` (executed) · two cases in `lib/bench-sort.test.ts` ·
`app/dashboard/[eventId]/vendors/find-sort-is-one-row.test.ts` (5 sabotages seen red) · `more-to-compare.test.ts`
re-aimed (the head draws no sort).

SPEC IMPACT: None — owner rulings given in this conversation 2026-10-30; no locked decision changed.

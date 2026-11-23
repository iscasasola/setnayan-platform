## 2026-11-22 · fix(suppliers): Find's search says the distance in card 14's words

BUILD_RULES §2 and the 20 Nov card 14 rows: *"Distance reads 'about N km from your venue'"* (straight line, no paid map
service). Find's cards already said it. The category search overlay, opened from the same Find column by "See all",
"✓ Done · Search again" and a liked photo's "Find who", still printed a bare "12.3 km" on each row.

- `searchCategoryVendors` now says what its distances were measured from: `distanceFromVenue` is true only when the
  reception anchor (the venue) was used, the same anchor the page reads for card 14's `askVenue`. No new read and no
  new server action; it is one more field on the result it already returns.
- The overlay's distance reads `aboutKmLine` ("about 12 km from your venue", "under 1 km …"). When the event has no
  venue and the search measured from the Region's centre, the row says "Set your venue to see distance", as the cards
  do. The "beyond their N km range · travel fee likely" note is kept.
- Guard: `lib/find-search-distance-reads-card-14.test.ts`. Sabotaged twice (a bare `{r.distanceKm} km`, and
  `distanceFromVenue` set from any coords): each turned it red.

Not done here (listed in #7920's parity gaps): the overlay's rows are not yet drawn on card 14's face. That needs each
supplier's service card in the overlay, which it does not read today.

SPEC IMPACT: None. It applies the 20 Nov card 14 distance ruling to one more Find surface.

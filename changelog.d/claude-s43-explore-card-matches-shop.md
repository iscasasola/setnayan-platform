## 2026-09-19 · fix(explore): a marketplace service card shows the inclusions, discount, Serves line and showcase photos the shop page shows (S43 · 5)

`/explore` and the shop page (`app/v/[slug]`) draw the same `ServiceCardView`
through the same `toServiceCard`, but the marketplace passed `undefined` for four
of its inputs. So a card on Explore had no "Includes …" row, no discount badge,
no Serves line and no photo strip, and all four appeared one click later on the
shop. (S27 #5620 fixed the record and the hide-prices choice on the same call;
#5622 the gift line.)

The grid now reads the same data with the same readers, batched over its 24
cards: `fetchInclusionsByService`, `fetchDiscountsByServicePublic` and
`fetchCoveragesByIdPublic` (each fails soft to "nothing extra" by its own
contract). The Serves-line builder moves out of the shop page into
`lib/service-serves-line.ts`, verbatim, so both surfaces use one copy. Showcase
photos and the clip resolve with `publicUrlForStoredAsset`, the same unsigned
resolver this grid already uses for the cover. A ref that can't be served
publicly is dropped, so the card loses that photo and the grid is unaffected.

Guard: `lib/the-marketplace-card-carries-its-record.test.ts` now also pins
argument positions 1–4 of the `/explore` `toServiceCard(` call, the shared
readers, and that the shop page has no private Serves builder again
(sabotage-checked red).

SPEC IMPACT: None.

## 2026-10-30 · feat(shop-page): supplier website by plan, slice 3 — reach ring by plan, own web address, pinned review in the card

Owner-approved 2026-10-30 ("Supplier website by plan approve"; contract `prototypes/build-contracts-2026-10-30/supplier-website-by-plan/`, its "What shows, by plan" table; Q4 taken as drawn).

- **Reach by plan** (`lib/shop-page-plan.ts` `shopReach`, `_components/shop-reach.tsx`): the city line says "Serves up to N km around <city>" — `effectiveOuterRadiusKm` over the effective tier (the shipped caps, 20 · 30 · 50 · 100 km) clamping the shop's own `outer_radius_km` — or, before Setnayan has verified the shop, "<city> · distance search opens once verified" (2026-10-29, Free = 0 km). The map draws that ring with the SHIPPED `ReachMap` (Where you work's map; gains an optional couple-voiced `ariaLabel`); a shop with no ring keeps the shipped pin map.
- **Addresses** (`_components/shop-addresses.tsx`): every plan shows its Setnayan address; Pro + Ultra (`customWebsiteName`) also "<own domain> → this page" from a verified `custom_domains` row (read only on those plans; a refused read degrades to the Setnayan address).
- **Pinned review in the card** (`_components/pinned-review-card.tsx`): Pro + Ultra, the pinned review's first words beside the facts (it still leads the Reviews list), only where the plan shows review words.
- Dev lab `/dev/shop-plan-lab?plan=free|verified|solo|pro|ultra` (404 in production).

Already shipped and left as is (content parity): the Pro cover photo band and the Ultra name-on-photo hero (`heroPhotoUrl` / `cinematicHero`), the paid branches list.

SPEC IMPACT: None — builds the approved contract. NOT built, reported: Free's "ONE live service · N more open once verified" and the live-services-per-plan count (3·3·5·∞) need a "picked live service" state on `vendor_services` / `vendor_profiles` (2026-10-29 build-all-show-one) that no column holds yet; the supplier side must create it first.

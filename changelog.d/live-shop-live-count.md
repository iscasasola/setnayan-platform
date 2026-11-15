## 2026-11-15 · fix(live): Shop's pinned row counts live cards, not live services

Shop's pinned row read "3 cards · 2 live" while all 3 cards were online: "cards" summed every service's cards, "live"
counted services with a card on. `ShopServiceRow` now carries `liveCards`, and `cardsLiveBits` (lib/shop-services-summary.ts)
words both numbers in cards — "3 cards · 3 live". The Services figures (services · live services) are unchanged.
Guard: `lib/shop-cards-and-live-count-one-unit.test.ts`.

SPEC IMPACT: None

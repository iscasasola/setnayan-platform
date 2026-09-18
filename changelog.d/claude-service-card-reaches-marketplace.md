## 2026-09-18 · fix(explore): a service card on the marketplace carries its record and its shop's price choice (SUP-41)

The `/explore` service-card grid drew the same `ServiceCardView` as the shop page (`app/v/[slug]`), but called `toServiceCard` with the card record hard-wired to `null` and `hidePrices` hard-wired to `false`.
- **The record (booked count, event-type mix, anonymized ledger, medal case) now reaches the marketplace.** It uses the same `NEXT_PUBLIC_CARD_RECORD_ENABLED` flag (ON in production), the same batched `service_card_records` RPC, and the same shop-rating rule. That rule is extracted as `cardRecordRatingFromTrusted` in `lib/service-card-record.ts` and shared with the shop page. A card with no history renders exactly as before.
- **A shop that chose "hide my prices publicly" no longer has its prices printed on the marketplace grid.** The shop's own page and the vendor grid already honoured that choice. It reuses `fetchVendorsHidingPricesPublicly`, which fails open as before.
- Guard `lib/the-marketplace-card-carries-its-record.test.ts` parses the `toServiceCard(` call and checks the argument at each position. A file-level match would stay green, because the vendor grid already uses the same names.
- `lib/the-logo-opens-the-shop.test.ts`: the grid window is re-anchored on the JSX `{serviceCards.map(` (exactly one), because the page now also maps the cards to collect ids. Every assertion is unchanged.

SPEC IMPACT: None. (Closes register row SUP-41 / CARD-EXPLORE.)

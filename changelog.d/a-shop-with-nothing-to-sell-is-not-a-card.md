## 2026-09-17 · fix(marketplace): a shop with no active service is not a bookable card

`/explore`'s vendor-grid (`vendor_market_stats`) and `fetchWizardVendorRecommendations`
(shared by onboarding, the Concierge wizard, and the event's own Category Search vendor
browser) both listed a shop the moment it was `verified`, without asking whether it had
any active `vendor_services` row left to inquire about. A shop with zero active services
still rendered as a bookable card and could not be messaged — inquiry is keyed to a
service. Measured in prod: `?event_type=simple_event` returned exactly one such shop as
the ONLY result.

New shared gate, `lib/vendor-inquirable-gate.ts` (`fetchVendorIdsWithActiveService`),
applied at both call sites (plus the `/explore` "Show all" broadened-count empty-state
query, so it never advertises inventory it can't deliver a message for) so the rule can't
drift between surfaces. `fetchMarketplaceServiceCards` never had this bug — it lists
services, not shops, so a shop with zero active ones already contributed zero rows there.

Guard: `lib/vendor-inquirable-gate.test.ts`. Sabotaged the predicate
(`is_active` → `is_active, false`) and confirmed 2 of 4 cases went red before restoring.

SPEC IMPACT: None — application-layer fix, no schema change, no product-decision change.

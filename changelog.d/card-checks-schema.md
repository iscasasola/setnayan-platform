## 2026-10-27 · feat(card-checks): the schema half of "fix before Create" — claim words, one photo = one service card

Owner 2026-10-26: *"when there is something they need to change, they must fix it before the service card is
created"* · *"once a photo is used. it technically cannot be used on another service card."* · *"ok then remove the
price integrity issue"*. PR 1 of the v2 PLAN's order (corpus `prototypes/service_card_checks_2026-10-26/` PLAN §5–§6).
Storage only; nothing calls it yet.

- Migration `…_service_card_checks_v2.sql`: `card_claim_words` (admin-only RLS at CREATE, seeded with the owner's six:
  guaranteed · #1 · best in · lowest price · official · 100%); repost-watch surface CHECKs learn `service_showcase`
  (re-listed in full); `vendor_image_hashes.vendor_service_id` (→ vendor_services SET NULL, indexed) so a photo's hash
  names its card; `vendor_image_flags.supplier_reported_at` + `supplier_report_note` ("It's mine — report it").
- Gone from the first cut (never on main): the held-card mechanism (`integrity_flags` service_card kind, statuses,
  `service_card_held()`, the publish-gate hold arm) and everything price (`card_price_band_tolerance`, its setting,
  lib and test).
- Mapped: Ugat joint J57; erasure / export guardrails + export-completeness decide `card_claim_words`; exposure
  baseline, user-FK map and ugat screens regenerated.
- Tests: `tests/db/a-claim-word-list-is-admin-only.db.test.ts`, `tests/db/one-photo-one-card-schema.db.test.ts`.

SPEC IMPACT: None new — implements DECISION_LOG 2026-10-26 "SERVICE CARD CHECKS — FIX BEFORE CREATE", "CARD CHECKS —
NO PRICE BAND; ONE PHOTO, ONE SERVICE CARD", "NO PRICE CHECK ON SERVICE CARDS AT ALL"; prototype
`prototypes/service_card_checks_2026-10-26/` (index.html + PLAN.md).

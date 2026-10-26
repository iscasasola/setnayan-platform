## 2026-10-26 · feat(card-checks): the schema half of service card checks — a held card waits for the check

Owner 2026-10-26: *"Cards go live right away after automatic checks; only flagged cards wait for admin review."*
This PR is PR 1 of the approved PLAN's order (corpus `prototypes/service_card_checks_2026-10-26/PLAN.md` §7) —
storage and the fence only; nothing calls it yet, so no screen changes.

- `integrity_flags` learns the card: `subject_service_id` (→ `vendor_services`, CASCADE), kind `service_card`,
  statuses `approved · asked_to_fix · rejected` (both CHECKs re-listed in full), the shape arm, and a partial unique
  index — at most ONE holding flag (open · asked_to_fix · rejected) per card.
- `card_claim_words` (seeded with the owner's six: guaranteed · #1 · best in · lowest price · official · 100%) and
  `card_claim_word_allowances` (per shop) — RLS at CREATE, admin only.
- `platform_settings.card_price_band_tolerance` — **NULL = the price check is OFF**; no default (ruling: "no guessed
  number"). Editable on /admin/settings as "Price-band tolerance for new cards (%)", read on its own so a refused
  read never shows "off" or lets Save blank the owner's number.
- Repost-watch surface CHECKs learn `service_showcase` (ruling: hash cover + showcase).
- `enforce_service_publish_gate` grows the HOLD arm: a held card cannot go live except through an admin session or
  `approve_service_card()` (the one door, service_role only). `service_card_held()` is SECURITY DEFINER so the
  supplier's own session — which cannot read `integrity_flags` — still sees its hold.
- New in-app notice type `service_card_check` (own migration; not on the email allowlist).
- Tests: `tests/db/a-held-card-waits-for-the-check.db.test.ts` (17), `lib/card-price-band-tolerance.test.ts` (5).

SPEC IMPACT: None new — implements DECISION_LOG 2026-10-26 "APPROVED — SERVICE CARD CHECKS AS DRAWN".

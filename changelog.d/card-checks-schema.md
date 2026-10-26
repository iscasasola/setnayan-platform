## 2026-10-26 · feat(card-checks): the schema half of service card checks — a held card waits for the check

Owner 2026-10-26: *"Cards go live right away after automatic checks; only flagged cards wait for admin review."*
This PR is PR 1 of the approved PLAN's order (corpus `prototypes/service_card_checks_2026-10-26/PLAN.md` §7) —
storage and the fence only; nothing calls it yet, so no screen changes.

- `integrity_flags` learns the card: `subject_service_id` (→ `vendor_services`, CASCADE), kind `service_card`,
  statuses `approved · asked_to_fix · rejected` (both CHECKs re-listed in full), the shape arm, and a partial unique
  index — at most ONE holding flag (open · asked_to_fix · rejected) per card.
- `card_claim_words` (seeded with the owner's six: guaranteed · #1 · best in · lowest price · official · 100%) —
  RLS at CREATE, admin only. (The per-shop allowance table, the Approve function and the notice type land with
  the PRs that write / call / emit them, so no table or function ships without its other end.)
- `platform_settings.card_price_band_tolerance` — **NULL = the price check is OFF**; no default (ruling: "no guessed
  number"). Editable on /admin/settings as "Price-band tolerance for new cards (%)", read on its own so a refused
  read never shows "off" or lets Save blank the owner's number.
- Repost-watch surface CHECKs learn `service_showcase` (ruling: hash cover + showcase).
- `enforce_service_publish_gate` grows the HOLD arm: a held card cannot go live except through an admin session or
  the `app.service_card_verdict` door (opened only by the admin Approve function, PR 3). `service_card_held()` is
  SECURITY DEFINER so the supplier's own session — which cannot read `integrity_flags` — still sees its hold.
- Mapped: Ugat joint **J56** (claims on the FK, both CHECKs, the word table, the tolerance column, no `held` column);
  erasure + export guardrails classify `card_claim_words`; exposure baseline, user-FK map and admin jobs regenerated.
- Tests: `tests/db/a-held-card-waits-for-the-check.db.test.ts` (14), `lib/card-price-band-tolerance.test.ts` (5).

SPEC IMPACT: corpus `prototypes/service_card_checks_2026-10-26/PLAN.md` gains a "What was built" section; implements DECISION_LOG 2026-10-26 "APPROVED — SERVICE CARD CHECKS AS DRAWN" (no new decision).

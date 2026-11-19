## 2026-11-19 · feat(onboarding): supplier onboarding — Door C (coordinator) + "Trusted partners" + two fixes

Part 3 of 3 of the approved supplier onboarding (DECISION_LOG 2026-11-19 "COORDINATOR ONBOARDING (Door C) APPROVED +
'TRUSTED PARTNERS'"). Stacked on part 1.

- **Door C** (`/open-shop?as=coordinator`): Coordination pre-picked — the first coordination service, ONE dropdown of
  `COORDINATOR_TRADE_SERVICES`' leaves ("Not a coordinator? Search all services" keeps the full picker) — then the
  shared screens; the first card is drafted on their page (a price to approve).
- **"Invite shops you trust"** — new `/open-shop/invite`, where the coordinator's shop opens: their own `/i/<slug>`
  QR on the shipped `QrCard` (Share), "Only invite those you trust.", then Done → where the first card's way lands.
- A shop that scans it gets the **blue invite door** (`/i/<slug>` wears `data-supplier-look`), then Door B.
- **"Trusted partners"** everywhere the coordinator-to-shop tie and the shop-page section are named: the shop page
  section (was "Trusted by"), Shop › Trusted partners (was Partnerships), the add / invite words ("each other's trusted
  partners", was "preferred supplier"), the claim doors' and `/i`'s lines. The DB is unchanged; the "Trusted by"
  BADGE (clients who came back) is a different thing and keeps its name.
- **Fix:** all four `/for-coordinators` buttons carry `?as=coordinator` (the test that pins them updated).
- **Fix:** the invite perks no longer promise "marketplace listing" / "Marketplace exposure" (an unverified Free shop
  is found by its own link and QR) — on `/i`, the couple's link and the team invite doors.

SPEC IMPACT: None new — implements the 2026-11-19 DECISION_LOG row as written. New route `/open-shop/invite` needs a
FEATURE_REGISTER row in the corpus (flagged).

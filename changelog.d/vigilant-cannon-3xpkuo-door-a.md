## 2026-11-19 · feat(onboarding): supplier onboarding — Door A (a couple's QR claim)

Part 2 of 3 of the approved supplier onboarding (DECISION_LOG 2026-11-19 "SUPPLIER CLAIM ONBOARDING (couple QR)
APPROVED — all 13 picks"). Stacked on part 1 (the shared vocabulary, `lib/supplier-onboarding.ts`). The claim door
(`/open-shop?claim=`) becomes the same five screens:

- **Accept** — "<couple> invited you"; the main button says Accept (was "Claim it"); "Sign in & accept". The ⓘ no
  longer promises a "free marketplace listing" (an unverified shop is found by its own link and QR).
- **Create account** — SECOND. The email way's boxes stay mounted (hidden) in the finish form and post at the end;
  they are checked on the account screen before moving on. The bot check is drawn only on the last screen.
- **Check your shop** — one list, a sheet per fact (the shipped house `Sheet`): Shop name · Contact person (+ role,
  moved from the account slide) · What you do · Contact number · Package (price · what's included · payment plan ·
  the bundle, one sheet) · How you get paid. Every old slide's body is a sheet now — nothing dropped. Supersedes the
  7 Nov "let it flow step by step" for this door.
- **Your first service card** — drafted from the couple's category, the service they booked and the price they
  logged. Approve (needs a price) · Edit (finalize hands over to the shipped Card Maker, `?edit=<id>`) · Skip (card 0
  is not made; the booking stays in Clients). A new price goes to the couple to approve (the shipped purchase change).
- **You're all set** — the plan (`PlanOnLastScreen`), then Open my shop → finalize → Today `?claimed=1` (its welcome).
- Supplier blue look.

Events served and the map pin are not on this door's record — Today asks for them (noted for the controller).

SPEC IMPACT: None new — implements the 2026-11-19 DECISION_LOG row as written.

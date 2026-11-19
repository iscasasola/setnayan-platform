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

### Review fixes (19–20 Nov, drawing `36jmQMWrANcgd2HxihAUw5`)
- **P1 Accept:** "<couple> added you." · "For their wedding · <date>." · the shop card as the couple typed it (name, Covers, Contact, Booked) · "Accept to run this booking on Setnayan. Free." · the grey pills became quiet links — I have an account · Not my business.
- **P3 Check your shop:** "Change anything <couple> got wrong." · Door A's own rows Shop name · Contact · Number · Covers · Booked · Pays · They pay you (`CLAIM_CHECK_LABEL`) · a "Changed" tag on a row that now differs from the couple's record · the two notes (contact changes are seen; price/service changes are approved) · "Looks right".
- **P4 team door:** the Setnayan team's finish lands on Shop › Your details and never reaches the Card Maker hand-off, so its card screen draws no Edit and promises none.
- **P5 You're all set:** Shop ✓ · Cards ✓ (what the finish actually makes) · Client ✓ · the Free row and its line · the "I understand" tick on EVERY claim, and Open my shop waits for it.
- **P6:** Today's claimed welcome says "<couple>'s <event> is in Clients." (`lib/claimed-welcome.server.ts`, read only on `?claimed=1`; any refused read names nobody).
- Step names under the bars: Accept · Account · Your shop · Your card · Done.
SPEC IMPACT: None — builds the approved 19 Nov drawing.

## 2026-11-20 · fix(onboarding): Door A carries the first card through finalize

- `finishClaimDoor` asks the shipped switch about the first card. The answer is `live`, `draft` (with the switch's sentence and the card id), `refused` (not made) or `skipped`, and it rides through `/vendor/claim/<token>/finalize` to `?claimed=1&card=…`. A bare `?claimed=1` no longer reads as "and first card".
- Today's claimed welcome says draft or refused with the way to the card. Its ticked row names the card only on `live`.
- P5's Cards row has no ✓: the cards are made as drafts when the shop opens, and the welcome says which ones went on the page.
- Tests: `lib/supplier-onboarding.test.ts` 12.

SPEC IMPACT: None.

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

## 2026-11-21 · fix(onboarding): Door A P4 fits 375 px, as drawn

Caught up with #8028 + `main` (merge only). P4: Approve card full width, Edit · Skip for now under it (the team door: Approve over Skip). Shot: `build-sessions/shots-onboarding-375/a1-accept-375.jpg`.

SPEC IMPACT: None.

## 2026-11-20 · fix(onboarding): Door A's account, check list and first card match the approved drawing (P2 · P3 · P4)

Owner's "Approved" on the controller questions (20 Nov), built to drawing `36jmQMWrANcgd2HxihAUw5` v4:

- **P2 · Create your account:** Google · Apple, then "or", then the email boxes, all at once — as Door B's PB2. The
  two-step "Continue with Email" (v19, 7 Nov) is superseded by the 19 Nov drawing. The OAuth row sits above the finish
  form (forms never nest); the line reads "Your changes save as you go."
- **P3:** the list is titled "Check your shop" (`CLAIM_CHECK_HEAD`); Door B keeps "Your shop".
- **P4 · Your first service card:** the couple's own first card is drafted — the card as couples will see it (its lines
  read-only on the face), then "Built from what <couple> recorded" (they picked it · they booked you for · they logged
  it / add yours), the price box, then Approve · Edit · Skip. Its lines are changed in the Card Maker (Edit). The
  Setnayan team's door and services the supplier added keep the form.
- **One piece, two doors:** the drafted card moved out of the wizard into `app/open-shop/_components/first-card-draft.tsx`
  (`FirstCardDraft`); Door B's PB4 renders it unchanged.
- Tests: `the-claim-door.test.ts` test 3 now pins P2 (the 7 Nov rule it held is superseded); new test 4 pins P4 and the
  one shared piece. Six sabotages, each red.

SPEC IMPACT: None (builds the approved drawing; no new rule).

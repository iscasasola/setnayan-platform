## 2026-11-22 · fix(onboarding): Door A tells Today the truth about the first card

Rescued from the local 20 Nov line (`rescue/2026-11-22/doors-a`), re-applied on what shipped as #8030 — the part
main did not have. Door B already works this way; Door A now does too.

- **Approve asks the shipped switch.** `finishClaimDoor` puts the first card on the page through
  `putFirstCardLive` (the publish gate + the plan's live-cards cap). Its answer rides through the shipped
  `/vendor/claim/<token>/finalize` to Today as `card=live|draft|refused|skipped`, the reason as a KEY
  (`lib/first-card-why.ts`, never a sentence on the address) and, for a draft, the card's id.
- **Today's claimed welcome says it.** Draft: "Your first card is made, but it isn't on your page yet." + the
  switch's own sentence + "Open it in the Card Maker" on THAT card. Not made: "Your first card wasn't made." +
  "Open your cards". Made but not found again: said as that. The claim door's card keeps its own pricing — the
  welcome never re-makes it.
- **The ✓ is held to the database.** "Your shop and first card" is ticked only when a live card is read back now
  (`readHasLiveCard`, read only on `?card=live`); a reload or a hand-typed `?card=live` cannot fake it.
- **P5's Cards row has no ✓** and says the cards are made as drafts when the shop opens.
- Lab: `/dev/open-shop-lab?screen=welcome&kind=claimed|opened&card=…` draws the welcome on fixtures.
- Tests: `lib/supplier-onboarding.test.ts` 12 and 14 (new), 11 and `the-claim-door.test.ts` 4 (pins follow).

Not carried from the rescue branch: the P1 shop card as "rows on white" (main kept the approved drawing's card,
ship-reviewed 21 Nov), the stale round-2 shots, the local regenerate commit.

SPEC IMPACT: None.

## 2026-11-07 · fix(open-shop): on the claim door, a service the supplier adds is their own card — never in the couple's bundle

Owner ruling, verbatim: *"on the sign up the supplier can add more services but not add them to the customers bundle."*

- **The bundle slide** ("What's included") lists only the services the couple recorded (`fromRecord`). A service
  the supplier added with "Add a service" is named under it as "Not in this bundle: … your own card on your shop".
- **Never bundled.** `syncCards` seeds `bundled` only for a recorded service, and a kept card for an added service
  is forced to `bundled: false`. The answers post `fromRecord` per card, and `bundled` is off for any added card.
- **The server decides, against the record.** `finishClaimDoor` reads the record (`readClaimDoor(token)`) and
  `splitClaimCards` (`lib/claim-door.ts`) splits the posted cards. A card is the couple's only when the door says
  `fromRecord` AND its category is one the couple recorded; anything else goes to `added` with `bundled` forced off.
  Every card, the couple's and the added ones, is made through the shipped `createVendorService`. The package
  (`savePackage`) is built only from the couple's cards: their confirmed price, their services and their own extra lines.
- **An added service's card slide** shows neither the "Part of the ₱… bundle" band nor "Price it on its own". It
  reads "Your own service — on your shop, priced on its own. Not part of <couple>'s booking." and shows the price
  field directly.
- Guard `app/open-shop/the-claim-door.test.ts` gains rules 5a–5d (14 tests). Each rule was sabotaged once and went
  red: bundle list back to `d.cards.map` · `syncCards` without `s.fromRecord` · `splitClaimCards` keeping the posted
  `bundled` · package items back to `answers.cards.map` · `inBundle` back to `c.bundled`.

SPEC IMPACT: None. The ruling is the corpus DECISION_LOG row "ON THE CLAIM DOOR THE SUPPLIER MAY ADD MORE SERVICES
TO THEIR SHOP, BUT NEVER INTO THE COUPLE'S BUNDLE" (recorded by the coordinator).

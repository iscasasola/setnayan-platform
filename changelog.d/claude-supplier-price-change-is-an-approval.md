## 2026-11-13 · feat(claim): a supplier's price or service change on the couple's booking is a proposal they approve

Owner ruling (DECISION_LOG 2026-11-07, "A SUPPLIER'S CORRECTION: CONTACT DETAILS ONLY NOTIFY; A PRICE OR SERVICE
CHANGE NEEDS THE COUPLE'S APPROVAL"): *"couple only gets a price change, or service change on their purchase gets
changed, needs approval."* The contact half shipped in `lib/supplier-corrections.ts`; this is the price half.

- New pure rule `lib/supplier-purchase-change.ts`: the couple's recorded total and services (read on the server) against
  the couple's cards as the supplier confirmed them on the claim door (`splitClaimCards` → `theirs`). A moved price is
  one Add-on / Discount line carrying the signed difference; a recorded service the supplier removed is a line to say
  yes or no to. Services the supplier ADDED to their own shop are never compared (commit 335d298a33's scope).
- `lib/supplier-purchase-change.server.ts`: the claim finish (`finishClaimDoor`) STAGES the difference as the shipped
  `proposal_amendments` row (raised by the supplier, on no conversation, so no reader draws it). The couple's Approve
  (`answerClaimAccess`) points it at the booked row and the one conversation, posts the shipped amendment card
  (accept · counter · decline) and tells the couple in the app; Decline withdraws it. `event_vendors` is never written —
  the couple's price and services stay theirs until they accept.
- Claim door: the Services slide's hint now says a removed service goes to the couple to approve (it used to say it
  "leaves their record too", which no code did).
- Claim door: the details slide's "Price" (the ONE bundle price) is now posted (`ClaimDoorAnswers.price`). It used to
  be dropped — only card prices reached the server — so a supplier who changed only that field changed nothing. A moved
  Price is the supplier's word on the bundle and raises the same proposal; left at the couple's figure, the cards decide.
  Its hint says a new price goes to the couple to approve.
- A couple who recorded NO price gets no proposal: the supplier's price is simply their price.
- **An approved claim change is LOCKABLE** (owner 13 Nov, DECISION_LOG "AN APPROVED CLAIM CHANGE IS LOCKABLE":
  *"yes lockable."*). The claim finish builds a REAL quote (`claimChangeQuote`): the couple's agreed guests / hours
  (read on the server) × the pricing the supplier confirmed on the door (Per guest: rate × guests, billed never below
  the minimum · Per hour: base for its hours + extra hours × the extra-hour rate · One price: the typed price; a bundled
  card is a line with no amount). It is staged as a DRAFT `vendor_proposals` row (`merge_snapshot.source =
  'claim_door'`) and set as the Deal's `base_proposal_id`, so the couple reads nothing before they accept. On the
  couple's Accept (`respondAmendmentFromChat` → `acceptClaimChangeQuote`), it becomes their ACCEPTED quote (the shop's
  earlier live quotes on the event are superseded first: the Booked QR claim's move). The shipped `lockDeal` then books
  it. With a quote behind it, the Deal's price line carries no amount, so the change is never counted twice. **No
  quote** (the Deal stays "no price, no lock", as before) when the lines cannot add up to exactly the price the couple
  accepts, e.g. a rate rounded from ₱100,000 ÷ 120, or per guest with no guests agreed. A withdrawn or declined
  staging deletes its draft.
- Guard `lib/a-price-change-is-the-couples-to-approve.test.ts` (8 tests; twelve sabotages each seen red).

No migration. No new UI shape (the shipped `chat-amendment-card.tsx`). The card renders only while
`NEXT_PUBLIC_CHAT_NEGOTIATION_V1` is on, like every amendment.

SPEC IMPACT: None — implements the existing 2026-11-07 and 2026-11-13 DECISION_LOG rows.

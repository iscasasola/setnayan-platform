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
- Guard `lib/a-price-change-is-the-couples-to-approve.test.ts` (6 tests; five sabotages each seen red).

No migration. No new UI shape (the shipped `chat-amendment-card.tsx`). The card renders only while
`NEXT_PUBLIC_CHAT_NEGOTIATION_V1` is on, like every amendment.

SPEC IMPACT: None — implements the existing 2026-11-07 DECISION_LOG row.

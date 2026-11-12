## 2026-11-12 · feat(chat): a counter, a plan and one-tap accept (Piece 1 · PR-3)

- Both (+) menus open on a **Negotiate** group. Supplier: Change quote · Propose a payment plan · See every version.
  Couple: Ask for a change · Counter with a price · Propose a payment plan · See every version. "Offer" is left for PR-4;
  "See every version" opens the shipped versions sheet.
- Migration `20271340018194` extends `booking_change_asks` (amount, scope, proposed plan, Good until, raised by, the
  version an accept wrote; status adds `accepted` · `countered`). `ask_for_a_change` takes a counter or a plan;
  `answer_change_ask` accepts one. Accept writes exactly ONE new version in the database (`change_ask_write_version`),
  landing ACCEPTED (owner 12 Nov); the plan re-splits with paid rows fixed and no row below zero. Anything a drop
  cannot take from unpaid rows is shown as owed back to the couple and the accept is refused (FIVE GUARDS, 12 Nov).
- "Expired · ask again" is derived from Good until; an expired counter cannot be accepted. A plan-locked quote refuses
  a plan proposal. New cards are lazy (`thread-parts` chunk).
- 💰 A coordinator without Budget & payments reads no counter amount or plan rows (round-4 rule, 9 Nov):
  `booking_change_asks.amount_centavos` / `proposed_plan` are closed per column to browser roles, and the chat reads
  its asks through `change_asks_read`, which masks them ("₱ — hosts only") and admits exactly as the table's policy.

SPEC IMPACT: None

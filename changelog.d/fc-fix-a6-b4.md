## 2026-11-25 · fix(supplier): final check area 6, batch 4: an unread headcount, an unread Papic ledger, the Money bar's words

Lane A fixes from the 25 Nov final check (area 6). No amount, fee, plan or rule changed.

- **A refused headcount is not 0 (A6-03).** `liveHeadcount` (lib/pax.ts) returns `null` on a refused count and logs it. Finalizing a guest list then refuses ("Couldn't count your guests just now — nothing was changed.") instead of freezing the estimate as the binding headcount. `resolveLivePax` keeps its contract (the estimate floor) and logs; what a price should do with an unread count is the owner's (🟠). Moving the count onto `headcountForBasis` would change counts that price surcharges, so it is not done here (🟠).
- **An unread Papic ledger sells and refuses nothing on a guess (A6-24).** No pack is offered on an unread ledger; the album does not refuse an import as "out of credits" (the server still meters it); the shop wallet does not print a granted count built from a guessed 0.
- **The Money bar's words (A6-B06).** "N% of ₱X received", not "booked": the bar measures what was received.
- **Not a finding (A6-B03).** The chat title ("Lolo's Birthday (Dec 15)") and the Clients row ("Lolo Ben at 80 · Birthday · Dec 15") differ by two owner rulings (28 and 30 Oct), held by `lib/one-event-one-chat-title.test.ts`; both read one date formatter.
- **Guard:** `lib/area-6-batch-4-holds.test.ts`; `lib/vendor-papic-grants.test.ts` gains the unread-ledger `offerPack` assertion. Server actions: no new export. No migration.

SPEC IMPACT: None.

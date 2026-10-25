## 2026-10-14 · feat(march): a tapped name on the Wedding March opens their own guest card, in place

Owner, verbatim: *"on Wedding march. when we click a guest, we can show the guest card on the guest's page so they can rename edit it there and do not need to go back to guests."*

- Studio › Wedding March (and Details › Your event › Wedding March): a TAP on a walking name or a "Not walking" chip — pressed and let go without lifting, under the drag's own 4 px / 8 px — opens that guest's real guest card as a sheet over the march (the parents' sheet: `Sheet` + `rise`, on `<body>`). Enter opens it from the keyboard; Space still picks the name up to move it. The open name wears a ring.
- The card is the shipped `GuestCardBody` (panel, the hand-drawn kit — no template kit enters the Maker), read at the tap by ONE new action, `openMarchGuestCard` (the Guest list's own `loadGuestCard`, under the couple's session). Nothing is pre-read with the Maker. +1 server action.
- Edits save live through the card's own `updateGuest`, as on the Guest list — said under the name (`HubSavesImmediately`: Apply / ↺ / Restore do not cover them). The card's own Undo toast now has a host while the sheet is open (`UndoToastHost`). Closing after a save re-reads the Maker once, so the march shows the new name at once; closing without a save reads nothing.
- Dev lab: `/dev/details-lab?item=march` and `/dev/maker-lab?studio=1` open the same card over the lab march with stand-in writes (`lab-march-cards.tsx`, renames kept in dev memory) — no database.
- Guard: `lib/the-march-opens-the-guest-card-in-place.test.ts` (sabotaged 4 ways, each red).

SPEC IMPACT: None — implements the owner's 2026-10-14 ruling; the other "go back to Guests" dead ends found (Seat plan's guest tap = Move only; the march's empty state points at the guest card) are listed in the PR, not changed.

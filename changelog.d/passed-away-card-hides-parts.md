## 2026-11-04 · fix(guest-card): a guest who passed away shows only what still applies · one hairline between groups

Owner, verbatim: *"if passed away, there are parts in the guest card that doesn't need to show. Additional Guest, RSVP,
Photos, Seat Plan, Note, Access and QR"* — and *"i see a double line in between access and not counted for"*.

- **Passed away → those parts are not drawn** (`guest-card-body.tsx`, `away`): Additional Guests · RSVP Status · Papic /
  Photos · Seat Plan · Note for them · Private note · Access (its Account row and the Give / Take back doors with it) · the
  top ticket / QR with its Invite and ⋯ (Write to NFC · New QR). Still drawn: the name, the status line ("Not sent · passed
  away"), Basic Info, Details, the Passed Away switch and Delete. Couple rows never carry Passed Away — unchanged.
- **Nothing is cleared.** The autosave compares each save with the card it last SENT, so a part that stopped posting would
  have been written as cleared on the next save (RSVP back to "No reply", meal, dietary, notes and photo consent emptied).
  The hidden parts' values now ride as hidden inputs (`AwayCarriers`) — the card posts the very same form either way (the
  golden `the-card-posts-the-same-form` is unchanged). Switching Passed Away off redraws every part: the save revalidates
  the guest pages before its quiet return.
- **The double line**: "Not counted for ▾"'s hidden marker sat BEFORE its row, so the row was not its box's first child and
  kept its own top rule (`first:border-t-0`) under Access's bottom rule. The marker now follows the row. The same check found
  a second one: on the Maker's cards (no Delete handed in) Passed Away's rule touched the card's own bottom rule — it now
  draws only while a group follows.
- Guard: `a-guest-who-passed-away-shows-only-what-applies.test.ts` — what is drawn either way, that hiding clears nothing
  (measured with the save's own merge, both directions), and that no two hairlines touch (a property of the drawn tree, light
  and dark, eight states).

SPEC IMPACT: None — builds the Setnayan-specs DECISION_LOG row dated 2026-11-04, "A GUEST WHO PASSED AWAY: THE CARD SHOWS
ONLY WHAT STILL APPLIES".

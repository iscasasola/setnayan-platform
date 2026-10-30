## 2026-10-30 · feat(guests): every Guests name is the full name, with the nickname beside it

Owner, Guests prototype v24–v26 (HANDOVER "NAMES"): *"the FULL name (name_prefix + first + last, from the shipped name
helper) with the nickname (`guests.display_name`, no new column) beside it in muted quotes; search matches the nickname
too … wrap to 3 lines, never ellipsize."*

- `lib/guests.ts`: `guestNickBeside` (the one "does the nickname add anything" rule, now also behind
  `guestPrintName`) and `guestNameWithNick` → `{ name, nick }` (full name via `guestFullName`; a row with no name parts
  keeps its compact name; an unnamed +1 seat reads "+1 · TBA").
- `app/_components/guest-nick.tsx` `<GuestNick>` — the nickname muted (`text-ink/55`), in “quotes”, moves to the next
  line whole, never cut.
- Drawn on: Guests › List rows (`guests-screen.tsx`, was the couple's "Shown as" INSTEAD of the name), the guest card's
  head (page h1 + the panel title, `guestCardTitle` / `guestCardNick`), and the March chips in Guests
  (`EntouragePerson.nick` → `MarchPerson.nick` → `details-march.tsx`, only when `guests`; the Maker's march and every
  print ignore it — the invitation keeps the full name only).
- The List row name now WRAPS up to three lines (line-clamp 3) instead of one line with an ellipsis (v15, "names never
  ellipsized"); the row's Share · Delete stay at the right of the first grid row. `guest-row-actions-share-the-name-line`
  test updated to the new property.
- Search already matched the nickname (`guestMatchesSearch` reads `display_name`) — now pinned.
- Not changed: the 2D canvas seat labels and the Map faces (room is tight; Map is redrawn in slice 10); Seats › List
  draws faces only.
- Guard `lib/guests-names-wear-the-nickname.test.ts` (sabotaged: `guestNickBeside` without its "already says it" check → red).

SPEC IMPACT: None — implements the prototype's NAMES rule as approved.

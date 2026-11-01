## 2026-11-01 · feat(guests): drag a guest into another section to change their role

Guests › List, Role grouping (owner 2026-11-01, DECISION_LOG "GUESTS › LIST: DRAG TO CHANGE ROLE · HONOUR ATTENDANTS
GET THEIR OWN GROUP", part 1; part 2 shipped in #7141).

- Press and hold a guest (a mouse may also drag 4 px), drag them over a section, let go. Near the list's edges it
  scrolls by itself — the one shared drag piece, `lib/drag-edge-scroll.ts` (#7154). Tap · move fallback: hold, let go
  without dragging, then tap the section.
- A section with several roles (Honour attendants) asks which with a small PickMenu; the roles are exactly the section
  header's ＋ roles (`sectionHeadDoors`), so only roles the event offers.
- "Guests of [Role]" (#7144): a guest with no role of their own becomes the +1 of someone in that role ("Whose guest?"
  when several); anybody else is refused with the reason in one line (owner: *"they get to that group only if they do
  not have a role and their role is guest"*).
- The couple and the honoree are never picked up; nor an unnamed +1 seat.
- Every change shows an Undo toast; the row moves at once (optimistic overlay); the screen is never reset.
- Server: no new export (the server-action budget is at its ceiling). `setGuestPrimaryRole` takes an optional
  `{ via: 'list-drag', broughtBy }`: the role is validated against the event's offered roles (the same
  `resolveRoleSetForEvent` check `addSingleGuest` uses), a drag refuses the couple, and a "Guests of" drop links the +1
  and recounts each guest's "+N" to their rows (the database's +N-is-the-rows rule), refused on a finalized list.
- Guard: `guests/_components/a-guest-is-dragged-to-a-new-role.test.ts`.

SPEC IMPACT: None — builds the DECISION_LOG row of 2026-11-01 as ruled; no spec text changes.

## 2026-10-21 · feat(guest card): Tab keeps a row and opens the next

Owner: *"pressing tab on keyboard should allow next row on the guest card?"* On the desktop guest card, Tab
(Shift+Tab backwards) in an open ✎ row now keeps it — the same keep as Enter or a tap out, through the card's one
autosave — and opens the next row straight into its field with its words selected: Title → First → Middle → Last →
Suffix → Shown as → Mobile → the open section's rows (RSVP's Reply, Invited to, Extra seats, Meal, Dietary…). A
dropdown, a switch or chips take the focus with the menu shut (Enter/Space opens it, a keyboard pick hands the focus
back, Tab goes on). Shut sections are skipped; hidden inputs are never a stop. Escape still leaves the row as it was.
A wrong, unfinished (a required name emptied) or refused keep stays on its row and says so. Not editing, Tab moves
pill to pill with the focus ring and Enter starts editing (unchanged). Phone: unchanged, except a field's keyboard now
says "next" when there is a next row, and that key goes on the same way.

Where: the row kit (`app/_components/form-row.tsx` — `TypedRow`/`FormRowField`, `tabRowFrom`, `tabInto`;
`lib/form-row.ts` — `FieldExit` gains `tab`/`tab-back`, `exitMoves`, `rowToTabTo`); the card's autosave form is the
box Tab walks (`data-form-tab-scope`, `guest-card-autosave.tsx`). Screens without that box: Tab keeps and the focus
stays on the row's pill (it used to fall to the page). Also: a form reset after a save no longer drops an open
field's selection in Safari. Guard: `guests/_components/tab-goes-to-the-next-row.test.ts` (8 sabotages RED).

SPEC IMPACT: None.

## 2026-10-28 · fix(guests): ⚙ › Invitations' "Pick who" works in place

Owner, 28 Oct: *"guest settings beside send to 107 there is a button pick who. that does not show anything"*.
"Pick who" was a link to the page it sits on (`/guests?select=to-invite`) inside the ⚙ sheet — the sheet stayed open
over an unchanged list, and `initialSelect` only turned Select on without narrowing. Now the press (on the Guests
screen, via `PickWhoContext`) closes the sheet, turns Select on and filters the list to To invite (the carousel's
shipped `toinvite` door, `isToInvite`); the Select bar's "Invite N" walks the picked in the one send run. The cold
`?select=to-invite` link lands in the same state. On the Map it opens the List that way. No navigation in place, no new
server action, no migration. Guard: `guests/_components/pick-who-narrows-in-place.test.ts` (render harness + press
wiring; sabotaged red twice). Lab: `/dev/guests-lab?part=screen&select=to-invite`.

SPEC IMPACT: None (a bug fix to an approved control).

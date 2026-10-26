## 2026-10-26 · feat(prints): the Digital ticket's three looks are on its slide, not in Print settings

Owner, verbatim, walking the live Prints carousel (#6946): *"The 3 designs for the digital ticket should be on the carousel and not on
settings."*

- The Digital ticket's slide now carries **Classic ▾** (Classic · Ticket · Photo poster — the shipped `PickMenu`, each look's small
  picture in the list) in the toolbar's first row, before View as ▾ — the Event pass's Calling card ▾ is its twin. On a computer it is
  the right column's "Ticket style" Form row.
- A pick **redraws the big preview at once** for the guest shown (the slide's `/api/guest/pass-card?…&design=` takes the look picked,
  `withTicketLook`) and still **waits for Apply**, said in the open list: the pick is the ONE ticket-style pick, extracted from
  `PassCardDesignPicker` as `usePassLookPick` — the Maker's draft store (`draftedPassLookOr` / `noteDraftedPassLook`) and the draft save
  (`passDesignDraftPatch`), the same field. No forked state: the slide, its dropdown and the Guest's ticket scene read the same pick.
- The **Ticket style row is gone from ⚙ Print settings › Passes** (no duplicate): `TicketStyle` and the picker's settings strip
  (`studio` mode) are deleted.

Guarded by `apps/web/lib/prints-carousel-follows-the-prototype.test.ts` (7) — sabotaged once (the Style ▾ dropped from the toolbar → red).
`the-ticket-style-follows-the-draft`, `studio-prints-six-are-the-templates` (5) and `studio-prints-navigation` (3) now read the slide.

SPEC IMPACT: None — moves an existing control to where the owner asked; same field, same save, same Apply.

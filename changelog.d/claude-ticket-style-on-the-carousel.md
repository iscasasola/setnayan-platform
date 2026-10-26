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

Mapped: `scripts/port-control-baseline.json` regenerated — the launch route's `TicketStyle` → `TicketStylePick` (the control moved from
the ⚙ sheet to the toolbar) and the strip's `BgCard`/`BgCards` gone with it; `lib/ugat/screens.generated.json` regenerated (no change —
no door moved). No address pointed at the sheet's Ticket style row; `?item=digital-ticket` opens the carousel on the slide that now
carries it, and the Prints tile's own address still opens Prints. `app/api/CONSUMER_INVENTORY.md` names the carousel as a second reader
of the `pass_design=` previews. The dev lab's `/dev/me-lab/ticket` takes `&design=` so the three looks can be seen without a database.

SPEC IMPACT: `Setnayan/prototypes/prints_carousel_2026-10-26/NOTES.md` (new, corpus 597da4d2) — records that the Digital ticket's three
looks now live on its carousel slide, not in ⚙ Print settings (owner 2026-10-26); same field, same save, same Apply.

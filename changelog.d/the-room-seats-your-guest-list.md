## 2026-09-03 · fix(reception-design): the People control says which surface it governs

`people` is a reception-design part — couple / couple + entourage / everyone /
empty venue — and it sits in the lab's design panel **directly beside the 3D
room**. It reads like a room control. It is not one.

It feeds `renderVenueSvg`: the flat concept illustration, the printed concept
PDF, and the supplier's mood-board mirror. Those have no seating to draw from,
so somebody has to say who to sketch. The **room** populates from `occByTable` —
the guests who actually hold a seat.

So the couple could set "Empty venue", watch the little concept preview empty
out, and see the 3D room beside it stay full. Nothing was broken; two surfaces
were answering two different questions and only one of them said so.

⚠ **THE TEMPTING FIX WAS THE WRONG ONE, AND THIS CHANGE EXISTS PARTLY TO BLOCK
IT.** "The couple picked Empty venue and the room is full — honour the setting"
reads as an obvious bug report; it was on this project's own build list as one.
Wiring it would install a **second mechanism owning one fact**: the guest list
saying a table is seated while a design picker says the room is empty, each
internally consistent, each passing its own tests, disagreeing forever. And the
default is `who: 'couple'`, so gating the crowd on it would have emptied every
room already built and shown to suppliers.

**Fix — name the surface.** The People zone now reads: *"This sets who appears
in your concept image and printed concept. The room itself seats whoever is on
your guest list."*

**Guard — `lib/the-room-seats-your-guest-list.test.ts`.** Pins the boundary
rather than the wording: no 3D surface may read `people` from the design; the
walk must derive its crowd from seat occupancy; `renderVenueSvg` must still
consume the choice (or the control governs nothing and the note points at a
surface that no longer uses it); and the editor must name both surfaces — "this
affects some views" is not a disclosure. Four sabotages verified red, the first
being the tempting fix itself.

SPEC IMPACT: None — no behaviour changes. Confirms who owns "who is in the
room": the guest list.

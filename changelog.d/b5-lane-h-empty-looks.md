## 2026-11-10 · feat(empty-look): the shared Example slot + the user dashboard's greyed-out shelves (Build 5 Lane H, slice 1)

Owner 2026-11-09 (DECISION_LOG 🧱👻 ×2), approved prototype `prototypes/empty_looks_user_event_2026-11-10/` (artifact WGwLL2uxVnUDEwCUBWu1WM, approved 10 Nov).

- **The slot.** `ExamplePreview` in `app/_components/states/empty-state.tsx`: the part's own component on sample rows, faded + grey + `aria-hidden` + `inert`, under an unfaded "Example" chip. `EmptyState` and `QuietStart` gain an optional `preview` prop (omitted = as shipped). One CSS rule in `globals.css` (`.sn-example*`).
- **One fixture.** `lib/empty-look-samples.ts` — every sample name, figure and photo the Examples use (existing images until the owner's Higgsfield files land).
- **User dashboard.** Planning (two poster cards), Now happening, Ended/Untold and Told (one glass card each) and Worth planning (the strip's own list) each draw their Example under the shipped line and door — only when the board's membership reads ANSWERED (`userEventsReadRefused`, the same cached read, no extra trip); Told only when the stories were measured.
- **Guard.** `app/_components/states/every-empty-part-shows-an-example.test.ts` renders every listed part's Example, pins each mount behind its "read answered and empty" gate, and refuses a per-page copy of the treatment.
- **Lab.** `/dev/empty-looks-lab?board=user` (`&example=0` = as shipped).

SPEC IMPACT: None — builds the approved prototype; HOUSE_TEMPLATES T28 "Shipped/Guard" lines can now name `ExamplePreview` and the new guard (controller to update with the Lane H merge).

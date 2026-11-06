## 2026-11-06 · fix(services): the service maker's sheets open on top of Today's New service sheet

Found live on www.setnayan.com: a new supplier on Today opens "What you offer → ＋ Start", which draws the service
maker inside the shared `Sheet` (`setup-offer-fold.tsx`, z-50). Every sheet the maker opens (`CanvasSheet` — What you
offer, Ask us, Preview, Who it's for, Delete) was `z-40`, so it opened BEHIND that sheet: "Choose what you offer"
looked dead, and since a card is "Hidden until what you offer…", no card could be made from Today. The maker's
Preview · Create row (`SupplierThumbRow`, portalled to `<body>` at z 25) was hidden under the same sheet — no Create.

- `CanvasSheet` takes the house layer above the modal, `z-sn-toast` (`--sn-z-toast`, the layer the report sheet and
  the pay confirm already open over a Sheet on) — no new number. The layer-scale note in `globals.css` names it.
- `Sheet` now tells its body it is inside a sheet (`InSheet` context). `SupplierThumbRow` reads it: inside a sheet it
  is drawn in place (still `position: fixed`, inside the sheet's own layer), never moves up into the page's pinned row
  (behind the sheet), and its edges follow the sheet's panel. Everywhere else it is unchanged (portalled to `<body>`).
- PickMenu lists (the Schedule "Its own schedule ▾") were already `z-[95]` on `<body>` — measured on top, unchanged.
- `/dev/card-maker-lab?host=today` draws the real maker inside the real `SetupOfferFold` sheet, for checking the
  maker's sheets over Today.
- Guard: `app/vendor-dashboard/services/the-maker-sheets-open-on-top.test.ts` reads every layer from its source
  (class → Tailwind theme → CSS token) and fails if CanvasSheet is not above the Sheet's geometries, a PickMenu is not
  above CanvasSheet, or the thumb row is portalled under a sheet it is inside.

SPEC IMPACT: None

## 2026-11-11 · feat(today): Today's ⚙ sits on the photo header and rides the pinned "Needs you today" row

Owner, 11 Nov, *"Today settings yes"* (ask e of the supplier queued-asks prototype, `plans/supplier_queued_asks_2026-11-11`).
Today's one ⚙ (`TodaySettings`, same sheet) now sits top-right on the photo header, the way Shop's and Portfolio's do. Once
the header scrolls away it moves to the right end of the pinned "Needs you today" row. It no longer sits beside the hours
("N · 12 MN – 12 MN") mid-page while the header is still on screen.

- `_components/use-hero-pin.ts` — Portfolio's shipped `pin` math, moved into a hook unchanged; `portfolio-view.tsx` uses it.
- `_components/today-gear-ride.tsx` — `TodayGearRide` measures the cover; the two `TodayGearSlot`s (`cover` · `pin`) draw one
  mount at a time. The first paint puts the ⚙ on the header.
- `supplier-today-screen.tsx` gives the cover the `cover` slot and the Needs-you row the `pin` slot. A new shop (six steps)
  is unchanged.
- Guards: new `today-gear-rides-the-header.test.ts`. `today-pins-needs-you-today.test.ts` and
  `the-today-page-speaks-to-every-supplier.test.ts` are updated for the new place (the first tap past the header's ⚙ is
  still the next event's card).

SPEC IMPACT: None. This builds an approved ruling. Its prototype and the ruling are already in the corpus
(`plans/supplier_queued_asks_2026-11-11`, ask e).

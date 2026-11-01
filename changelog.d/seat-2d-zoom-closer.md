## 2026-10-30 · fix(seating): the 2D seat plan zooms in until seat names read at body size

Owner, 30 Oct: *"zoom in 2d map is still too small. make it zoom a bit more so the names on the seats are normal
font size"*. The couple's 2D plan (Guests › Seats › 2D) had a fixed closest zoom of 2.6. Tables are drawn to scale,
so on a phone a table is about a quarter of its drawn size, and at 2.6 a seat name measured **4.8 px** on a 390 px
phone (5.5 px at 820 px).

The closest zoom is now `planMaxZoom` (`apps/web/lib/seat-plan-details.ts`): the zoom at which every table's seat
names reach 13.5 px on this canvas. It is never lower than the old 2.6, and it stops at 24. Measured on
`/dev/guests-lab?part=screen&gview=seats&seat=map` at full zoom-in: names are **13.5–14.4 px** at 390 px (zoom
2.6 → 7.83) and at 820 px (2.6 → 6.81), sharp in WebKit and Chromium. Fit still opens at the same frame (it stays
capped at 2.6). Pinch, wheel and the + / − buttons all use the new cap. The cap is a ref, so the wheel listener
(bound once per view) never uses an old value. The 3D plan and the guest's "your seat" view are unchanged; neither
reads this.

Guard: `the-seat-plan-on-the-phone.test.ts` test 10. It checks that every table type at 358, 390 and 820 px reaches
13 px or more at the closest zoom, that the editor clamps to `zoomMaxRef`, that Fit stays at the old frame, and that
the seat label is still the `SEAT_NAME_PX` text the cap is sized for. Sabotage checks: putting back a fixed 2.6 in
the editor turns it red, and so does making `planMaxZoom` return 2.6.

SPEC IMPACT: None

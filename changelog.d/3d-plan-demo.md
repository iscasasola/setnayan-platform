## 2026-07-03 · feat(homepage): 3D Plan live demo — click a sample guest, walk their seat in 3D

The third and final homepage dock-tile demo (Papic and Live Studio/Panood shipped
earlier the same day; DECISION_LOG 2026-07-03). Unlike those two, this one is
single-phone and per-guest rather than a two-phone pairing: the 3D Plan hero
gets a "Find your seat · try it" CTA (`HomeReskin.tsx`) that opens
`Plan3DDemoOverlay`, rendering the public Maria & Jose sample event's real
published seat plan in a read-only, low-poly 3D room (`Plan3DScene`, new
`app/_components/plan3d/`). Clicking any seated guest figure mints a FRESH
`demo_sessions` row bound to that one guest (`mintPlan3DGuestQr`) and shows a
QR. Scanning it opens `/3d_plan/demo/[token]` on the phone as that guest — one
button, "Where am I seated?" — which plays a scripted entrance→seat walk
reusing the couple-facing 3D lab's own pathing math (`steerPath`/`seatWorld`/
`floorObstacles` from `lib/seating-3d.ts`, unmodified). Fictional sample
guests, zero privacy surface — no camera, no faces, no consent screen.

**Scaffold reuse, not a new table.** `demo_sessions` gets one additive nullable
column, `bound_ref` (migration `20270505186595`), instead of a parallel schema
— every existing Papic/Panood row leaves it null. `createDemoSession`/
`resolveDemoToken` in `lib/demo-sessions.ts` grew an optional `boundRef`
param/field; both are 100% backward compatible with the shipped two-phone flow.

**Bug found + fixed while building:** the sample event's `event_tables.x_pos`/
`y_pos` were stored as 0–1 fractions instead of the 0–100 percent convention
every renderer (2D editor, PDF export, the couple's real 3D lab, and this new
demo) expects — all 7 tables were rendering collapsed into one corner. This
was ALREADY live and broken on `/tour/seating` (Stop 3 of the public tour),
not something this PR introduced. Corrected the 7 rows directly in prod
(×100, one-time data fix, no schema change) — `/tour/seating` now also renders
the intended composed layout (sweetheart near the stage, sponsors flanking,
families below, friends/entourage at the back).

SPEC IMPACT: Iteration 0008 (Seating Chart Editor) / 0020 (interaction
prototype, homepage demos program) — logged as a decision-log row, no spec
body edit needed (the sample-event data fix and the new demo route are both
implementation detail, not a locked-decision change).

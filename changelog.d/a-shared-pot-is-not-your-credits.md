## 2026-09-16 · fix(papic): a shared pot is not "your credits"

A guest's `papic_guest_spend_ceilings.ceiling_points` is a **LIMIT, not a
reservation.** Measured in production: not one of `papic_event_pool_status`,
`papic_capture_points_available` or `papic_camera_points_remaining` reads that
table. The pool subtracts `papic_seat_allocations` and nothing else. Every
credit comes out of one shared pot, first come first served — a named guest can
arrive to find it empty and her number worth nothing.

Two strings shipped in #5536 said *"your credits ran out partway through"* — in
the per-photo tally and in the refused shot's screen-reader label. Both fire at
the moment a guest is most likely to believe she had something of her own. They
now say **"the shots ran out"**.

🔑 **Second person plus a possessive is exactly how a limit reads as a
reservation, and a console-side sweep cannot see it** — this copy shares no
vocabulary with the couple's screens. The new guard is written in *her* words
(`your credits`, `set aside`, `held for you`, `reserved`, `promised`) and runs
over every sentence the module can produce.

A camera's **dedicated** balance is a genuine reservation — `papic_seat_allocations`
IS deducted from the pot — so the `own_camera` branch may still say "added to
this camera". Nothing else may.

SPEC IMPACT: None (the ceiling-vs-reservation decision is recorded elsewhere;
this only removes copy that overstated it).

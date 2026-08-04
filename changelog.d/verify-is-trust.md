## 2026-08-04 · fix(admin): Verify is trust work, not growth

Owner, 2026-08-04: *"go with verify"* — move the vendor-verification queue from the `growth` lane to `trust`.

Reading a government ID and deciding whether a business is who it says it is **is** trust work. It sat in `growth` because a vendor is waiting for a badge — which is what the queue feels like **to the vendor**, not what the admin is actually doing.

**The practical cost:** filtering the admin work list by **Trust** hid every pending verification — the first thing anyone would expect to find there. Surfaced by the lane-filter chips shipped earlier today, which is the first time the lane labels became clickable rather than decorative.

One field. Counts, SLA and the queue itself are unchanged.

SPEC IMPACT: None — a lane label, no rule or threshold changed.

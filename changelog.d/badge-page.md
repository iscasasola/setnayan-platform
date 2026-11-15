## 2026-11-15 · feat(badges): J4 slice 1 — the badge page's one adapter and its model (five badges, seven tiers, the step reached)

Controller job J4, the supplier badge page (prototypes `supplier_badges_2026-11-15/badge-milestones_v86.html` · `badge-flow-walkthrough_v5.html`; owner rulings DECISION_LOG 4b8cc3a3 · 7fbff0cd). Slice 1 is the part that stands on main alone.

- NEW `app/vendor-dashboard/shop/_components/badges/badge-sources.ts` — THE ONE ADAPTER through which the page reads the parallel jobs (J0 ladder #7753, J2 seals, J3 card badges, J5 graphs). Until #7753 merges it mirrors J0's five badge keys, their own seven steps and the seven tier names (Bronze · Silver · Gold · Ruby · Emerald · Diamond · Black Diamond), word for word; a guard compares the mirror with `lib/badge-tiers.ts` the day that file exports them and fails on any difference — then the adapter's body becomes one re-export line.
- NEW `badge-page-model.ts` (pure): the five badges exactly (Completed bookings · Five-star reviews · Gifts given · Trusted by · Invites) with the prototype's words; an award fact names the STEP REACHED ("Gold · 50 bookings"), never the running count; a badge not yet earned is LOCKED with what it takes ("Bronze at 5 bookings"); an unread count says so.
- Guard: `badges/badge-sources.test.ts` — five claims; the drift claim was sabotage-checked against #7753's real `badge-tiers.ts` (equal → green, one step changed → red).

No UI, no route, no server action, no schema in this slice.

SPEC IMPACT: None.

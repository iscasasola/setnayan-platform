## 2026-11-02 · feat(seats): VIP tables seat role first, the host picks where VIP +1s sit, nothing is split silently (seating slice B)

The owner's FINAL SEATING PRECEDENCE (DECISION_LOG 2026-11-02): *"VIP should always be role first then group. then if
there are plus 1, we pick if they sit beside on the VIP or locate them. to the nearest table of the VIP. this also
means all plus of the VIP should sit together."* Stacked on slice A (#7180) — ships after it.

- **VIP tables.** New `event_tables.is_vip` (migration `20271302302532_seating_vip_tables.sql`, additive, column
  default, no UPDATE, RLS unchanged). The host marks a table in its own settings: the 2D table's ⋯ ("Make it a VIP
  table" / "Not a VIP table") and the List table tools (VIP ▾). A small VIP mark shows in the List heading, the 2D
  table hub and over the table in the 3D room.
- **Role first at VIP tables.** `computeAutoSeat` (extended, not rewritten) seats every role holder at the VIP tables
  first, in the Guests list's role order (`rosterRoleRank`, the roster's own `ROSTER_ROLE_ORDER`, now shared from
  `lib/role-groups.ts`), then by group. A role set the couple switched to "Sit with their group" stays with its group.
- **+1s of VIP guests** — one dropdown in the seating rules (`event_floor_plan.vip_plus_ones`): "Beside them at the VIP
  table" (default) · "At the nearest table to the VIP". Away, ALL VIP +1s sit together at the non-VIP table(s)
  nearest the VIP tables (2D distance, ties by the natural table order). A +1 with a role of their own stays a VIP.
- **Everyone else: group first.** A role holder the VIP tables had no room for sits with their GROUP; inside every
  group, role holders take the first consecutive chairs, in role order; pairs and +1s stay side by side (slice A's
  `consecutiveRun`).
- **Shown, never silent.** `computeAutoSeat`'s new `cannotFit` list names who got no chair, a group that fits one
  table but was split, and role holders the VIP tables could not take; Auto arrange returns it and the editor's toast
  says it ("⚠ Didn’t fit: …").
- With NO VIP table marked, a "Sit together" role set still shares one table (the 2026-09-30 ruling) — only the
  role-clustering inside groups changes.

Guard: `apps/web/lib/vip-tables-seat-role-first.test.ts` (dummy 25-table / ~230-guest room), each rule seen red with
its branch removed.

SPEC IMPACT: New columns `event_tables.is_vip` and `event_floor_plan.vip_plus_ones`, recorded by the 2026-11-02
DECISION_LOG rows "+1 OF A ROLE SITS BY THEIR MAIN; VIP TABLES" and "FINAL SEATING PRECEDENCE" (already in the corpus);
the 0008 AS-BUILT note is left to the controller. Two interpretations flagged for the owner in the PR body.

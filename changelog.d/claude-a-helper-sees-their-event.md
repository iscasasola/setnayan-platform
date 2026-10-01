## 2026-09-29 · fix(events): a Limited helper's event is on their Events page — "You help with this"

A Limited helper (and a hired planner) holds a `coordinator` membership, and the
Events board only read `couple` and `guest` rows — so the event they were seated
on appeared on NO board, theirs included. Prod held one such person today (a
hired planner with a live seat).

- `lib/event-board.ts`: third stance `helper` (coordinator → helper), labelled
  **"You help with this"** (owner wording 2026-09-28); its card opens the event
  dashboard, which admits a live seat (a coordinator row is minted only by
  `sync_delegate_membership`, alongside the seat). No album door, no ⋯ menu, no
  story button, no auto-jump. Merge precedence organiser > helper > invited.
- Launcher board + top-bar search read the `coordinator` rows too, so search
  finds exactly what the board shows. A helper card says "You're on the hosts'
  team" instead of an unmeasured "Just getting started".
- Tests updated from "a coordinator gets no card" to the new rule; sabotage
  (dropping the mapping) fails 4 of them.

SPEC IMPACT: None — implements the 2026-09-28 DECISION_LOG co-host / Limited
helper rows.

## 2026-09-18 · feat(clusters): a group shows each guest once — 7b's roster reaches the screen (S37)

**SPEC IMPACT:** None — builds the screen half 7b already specified ("the planner's view"); no decision changes.

S26's both-ends guard (#5625) ranked `cluster_guest_roster` as `rpc-no-caller`. Re-measured: it
shipped 2026-09-02 in `20271191258098` as item 7b's read shape, and 7c built the cluster screen
without it — so the resolver made Liza-at-the-shower and Liza-at-the-wedding **one person** in the
database and no page ever said so. Choice: **(a) join the missing end.**

- `lib/clusters.ts` — `fetchClusterRoster()` (the same `{ rows, measured }` shape as every reader in
  the file) and the pure `orderRoster()`: people on more than one list first, then by name; a
  nameless guest is kept and sorted last, never dropped.
- `/dashboard/clusters/[clusterId]` — a "Guests across the group" tile: how many people, how many are
  on more than one list, and a collapsed "See everyone" list with a chip per celebration and its RSVP.
  A refused read says so; only a measured empty read may say there are no guests. The tile states
  that each celebration still keeps its own list — the cluster stays presentation, never accounting.
- The RPC is SECURITY INVOKER, so the screen shows only guests of celebrations the viewer can already
  open; `a-cluster-mate-is-the-same-person.db.test.ts` already proves the stranger and guest cases.
- Guard: `lib/a-group-shows-each-guest-once.test.ts` — executes `orderRoster`, and pins the mount and
  the refused-before-empty order (sabotage-proved: swapping the branches turns it red).

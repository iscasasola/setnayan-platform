## 2026-06-26 · fix(seating-3d): state-sync correctness from the parity review (5 fixes)

An adversarial review of the 3D-lab parity surfaced real state-sync bugs; all fixed:

- **Rules went stale after any refresh** — `keepApart`/`priorityOrder` were
  init-only `useState(prop)`. Added a sync effect so they re-derive from props on
  every loader re-run (fixes stale panel + stale dedup + lost-lock divergence).
- **Per-guest priority churned the page** — `cycleGuestPriority` called
  `router.refresh()` (priority is display + solver-input only). Replaced with a
  local optimistic overlay (instant chip, no refresh, no seat churn); the overlay
  clears when fresh guest rows arrive.
- **`reorderPriority`** now bounds-checks BOTH `from` and `to` (defense-in-depth).
- **Linked-table rename** now optimistically updates every sibling sharing the
  `link_group_id` (the merge effect is add-only and won't reconcile existing rows).
- **Rename input** keys on `selectedId` (was `selectedLabel`) so switching between
  two same-named tables remounts the field.

SPEC IMPACT: None (correctness hardening of shipped 3D parity).

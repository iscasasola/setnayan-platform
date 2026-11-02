## 2026-09-30 · chore(train): fold #6190 · #6186 · #6188 · #6187 · #6189 — the combination's own fixes

The release train for the guest landing page (#6186), auto-seat by role (#6188),
Post Event (#6187) and the walking-pair fix (#6189), plus the prod schema snapshot
(#6190). What the COMBINATION needed that no member needed alone:

- **Server-action budget (1226 → 1225, ceiling 1225).** #6188's new
  `saveRoleSeating` is folded into the existing `savePriorityOrder` in
  `app/dashboard/[eventId]/seating/actions.ts`: one action writes whichever of
  `priority_order` / `role_seating` the form carries, same lock gate, same
  parsers (`parsePriorityOrder`, `parseRoleSeating`). The seating editor's
  per-role toggle now calls `savePriorityOrder` with its `role_seating` field.
  The ceiling was not raised.
- **Guest-list row, `partnerNameById` × `invite`.** #6189 removes the "walks
  with" line from a Guest list row; main's Invite column (#6185) adds `invite`.
  Both kept: the row takes `invite`, not `partnerNameById` (the map stays for
  the selection chips).
- **Generated baselines regenerated once, on the merged tree** (never
  hand-merged): port-control (#6187 + #6189 deliberately removed controls),
  exposure (#6188's `event_floor_plan.role_seating`, authenticated only, like
  `priority_order`), dup-rule (#6186's `/[slug]/invite/enter` reads ONE guest's
  own name parts — a deliberate narrow read, never entourage fields — and two
  claims-page omissions are gone).

SPEC IMPACT: None — no behaviour change beyond the members' own; the action merge
is an implementation detail of an owner-approved setting.

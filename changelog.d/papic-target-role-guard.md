## 2026-07-22 · fix(papic-games): close the target_role fail-open in the guest RPCs

Gap analysis #7. `papic_missions.target_role` (a `guest_role`) exists for
role-scoped roster missions, but no read path ever consulted it: a mission with
`target_role` set and `target_guest_id` NULL fell through the "target_guest_id IS
NULL → show to everyone" branch, so a role-scoped mission would **leak to every
guest**. Latent today (no path writes `target_role` yet), but this closes the trap
before roster authoring lands. Flag-gated at the call site.

- **Migration** `20270905044875_papic_target_role_guard.sql` — `CREATE OR REPLACE`
  (signatures unchanged, grants preserved) of both guest RPCs to resolve the
  guest's own `role` (`guests.role`) and add `AND (m.target_role IS NULL OR
  m.target_role = <guest role>)`:
  - `papic_guest_missions` — a role-targeted mission now shows only to a guest of
    that role (fail-**closed**).
  - `papic_complete_mission` — a guest can't complete a mission targeted to a role
    they aren't.

No TS change — `target_role` was already in the RPC return / `GuestMissionRow`; the
filter is server-side only.

SPEC IMPACT: None — defensive hardening of the existing schema (the roster mission
type is a future spec item; this makes its scoping correct in advance).

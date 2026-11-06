## 2026-11-05 · fix(admin): "Add to team" takes two admins (Vendor Agreement § 9.1)

`users.is_team_member = TRUE` makes an account an admin everywhere (`isAdminProfile`, `lib/admin/admin-predicate.ts`). § 9.1's first row says promoting a user to **any** admin role needs two admins. The "Add to team" button on the Users list (`toggleTeamMember`) set the flag with one admin, and once the team service-credit pool and its two-admin `grant_team_pool` were retired on 2026-11-05 (#7295, which this is stacked on), that button was the only way to set it.

- **Add to team** now opens a `grant_team_member` approval and grants nothing. A different admin confirms it in Approvals, and only the approvals dispatcher writes the flag. A second press finds the open request instead of opening another. Nobody can ask for their own account. The row reads "Team · waiting on 2nd admin" while the request is open, and the page says why.
- **Remove from team** is unchanged: one admin, at once. Removing access never waits on a quorum.
- `grant_team_member` is also in the Approvals picker, next to "Promote to admin".
- Migration `20271309260178` adds the value to the `admin_approval_requests` CHECK, re-listed from production's `pg_get_constraintdef` (read 2026-11-05: exactly the ten values of `20271244152236`).
- Guard: `lib/adding-a-team-member-takes-two-admins.test.ts` walks `app/` and `lib/` and fails if anything except the dispatcher's `grant_team_member` arm writes a non-`false` value to the flag. It goes red when the old one-admin write is put back (checked).

SPEC IMPACT: None. The Vendor Agreement § 9.1 already requires this ("Promote a user to any admin role"). `lib/two-admin-promise.ts` records that the promote-to-admin row is now enforced through two action types.

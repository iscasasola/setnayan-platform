## 2026-07-25 · feat(vendor-team): Financial + Secretary roles and the agent assignment notice (flag-dark)

Vendor monetization build, `Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 7 — "Team seats
+ roles (Pro+)". Adds the two missing team scopes and the assignment→notify hook, all behind a
new flag defaulting OFF.

- **New flag** `NEXT_PUBLIC_VENDOR_TEAM_ROLES_V2` (default OFF) —
  `apps/web/lib/vendor-team-roles-flag.ts`. With the flag off, the Team page renders the same
  Admin/Agent/Viewer picker, the server actions parse the same role set (including the retired
  `owner` value, so its friendly message still fires), and no notification is ever emitted.
- **`apps/web/lib/vendor-team-roles.ts`** (pure — no env, no clock, no I/O). EXTENDS
  `lib/vendor-team.ts` rather than replacing it: the existing `VendorTeamRole` union is left
  untouched so every `Record<VendorTeamRole, …>` in the tree keeps compiling. Adds
  `VendorTeamRoleExtended` (+ `financial` · `secretary`), a role × capability matrix, and the
  predicates `vendorRoleCan` · `canReadClientChat` · `canAccessBilling` · `canScheduleForTeam` ·
  `canAssignBookings` · `seesTeamCalendar`, plus the Pro+ gate `areExtendedRolesAvailable`.
  **`canReadClientChat('financial')` is a hard, separately-guarded `false`** — the locked model's
  one non-negotiable boundary for this role.
- **`apps/web/lib/vendor-team-assignment-notice.ts`** (pure) — decides whether an assignment is a
  real hand-off (never self-assignment, never an emptied service list) and builds the notice
  ("You've been booked for [event]"). `apps/web/lib/vendor-team-assignment-notify.ts` is the
  server-only, flag-gated, fail-soft delivery half.
- **Wired now:** assigning services to an agent from the Team page emits the notice (flag-dark,
  deferred via `after()`). The `booking` notice shape is built and tested but has no call site —
  there is no booking→team-member assignment column yet (another track's surface).
- **Migration `20271003612974_vendor_team_roles_financial_secretary.sql`** — additive
  `ALTER TYPE … ADD VALUE IF NOT EXISTS` for `vendor_team_role` (`financial`, `secretary`) and
  `notification_type` (`vendor_assignment_received`). No existing row or constraint changes.
- **Tests:** `lib/vendor-team-roles.test.ts` (every role × every capability, flag-OFF byte-identity
  across every tier), `lib/vendor-team-assignment-notice.test.ts`,
  `tests/db/vendor-team-roles.db.test.ts` (verified failing without the migration; also pins the
  fail-closed RLS behaviour below).

**RLS is FAIL-CLOSED for the new labels, on purpose.** `public.current_vendor_ids(min_role)`
ranks a membership with `CASE role WHEN 'owner' THEN 4 … WHEN 'viewer' THEN 1 END` and no `ELSE`,
so `financial`/`secretary` rank NULL and never satisfy the comparison. Widening the enum
therefore grants **zero** RLS access by itself — the safe direction while the feature is dark, and
now pinned by test so nobody makes it permissive by accident. It is also a hard blocker for
flipping the flag: until that shared helper is extended (not this track's lane), a Financial
member can read nothing at all, including the billing rows the role exists for.

**Known follow-ups (deliberately out of this track's lane):** `lib/vendor-role.ts` `ROLE_RANK`
filters unknown roles out, so a `financial`/`secretary` member currently resolves to no vendor
role in the nav — must be handled before the flag is flipped. `lib/notifications.ts`'s
`NotificationType` union does not yet carry `vendor_assignment_received` (cast at the seam, with
a note); concrete symptom at flip time is a blank type badge in the notifications list
(`NOTIFICATION_TYPE_LABEL`/`_TONE` miss the key — cosmetic, no crash, and no email is sent because
the type is not on the transactional allowlist). `lib/vendor-tier-caps.ts` `agentAccounts` counts seats BEYOND the founder while the
locked model quotes TOTAL seats (Free/Solo 1 · Pro 3 · Enterprise 10) — the discrepancy is
recorded as `LOCKED_TEAM_SEAT_TOTAL`, not enforced; owner to settle.

SPEC IMPACT: None — implements `Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 7 as written;
no locked decision changed. The seat-count ambiguity noted above is surfaced for owner sign-off,
not resolved here.

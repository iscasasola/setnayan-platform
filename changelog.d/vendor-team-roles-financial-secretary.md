## 2026-07-26 · feat(vendor-team): Secretary role + assignment notice (flag-dark) — Financial DESCOPED

Vendor monetization build, `Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 7 — "Team seats
+ roles (Pro+)". Ships **one** of the model's two new team scopes, plus the assignment→notify
hook, behind a new flag defaulting OFF.

### ⛔ Financial is DESCOPED — it is not in this branch at all

The locked model's Financial role is defined by a boundary — *"billing / payments / reports,
**NO client chat**"*. This platform cannot express that boundary. `public.current_vendor_ids(min_role)`
is a **single scalar rank** (owner 4 > admin 3 > agent 2 > viewer 1); vendor chat is gated at
rank ≥ 1 and billing at rank ≥ 3, so **any rank that lets Financial see billing necessarily
clears chat**. The first draft of this branch shipped a `canReadClientChat('financial') === false`
predicate with **zero call sites** — a promise nothing enforced, on a role whose only prescribed
follow-up (slotting `financial` into the rank CASE) is the change that breaks it.

Rather than ship an unenforceable boundary, the role is removed everywhere: not in the type
union, not in the capability matrix, not in the labels, **not in the DB enum** (`ALTER TYPE …
ADD VALUE` is irreversible, so the label is deliberately never created), not offered by the
picker, not parsed by the server action. Tests pin its **absence** on all of those surfaces,
including a DB test asserting a `role='financial'` INSERT is rejected by the enum.

Re-introducing it needs an RLS split (e.g. `current_vendor_ids_billing`) plus a route guard —
a design change, and an open owner decision (7-track ship-readiness report § 4 Q12).

Secretary ships because its boundary is a **negative** one the existing ladder *can* express:
below admin ⇒ no billing, no store settings.

### What actually landed

- **New flag** `NEXT_PUBLIC_VENDOR_TEAM_ROLES_V2` (default OFF) —
  `apps/web/lib/vendor-team-roles-flag.ts`. With the flag off, the Team page renders the same
  Admin/Agent/Viewer picker, the server actions parse the same role set (including the retired
  `owner` value, so its friendly message still fires), the action issues exactly the queries it
  issued before, and no notification is ever emitted.
- **`apps/web/lib/vendor-team-roles.ts`** (pure — no env, no clock, no I/O). EXTENDS
  `lib/vendor-team.ts` rather than replacing it: the existing `VendorTeamRole` union is left
  untouched so every `Record<VendorTeamRole, …>` in the tree keeps compiling. Adds
  `VendorTeamRoleExtended` (+ `secretary`), the Pro+ gate `areExtendedRolesAvailable`, the
  picker/parse helpers, and a role × capability matrix.
  - **`vendorRoleCan` now fails CLOSED.** It previously normalized an unrecognised role to
    `'viewer'`, which holds `view_schedule` — so `null` / `''` / `'customer'` (a **non-member**)
    was granted the schedule. It now returns `false` for every capability unless the role is a
    known team role. `asVendorTeamRoleExtended` keeps the viewer fallback but is marked
    **display-only** and is no longer on the authorization path.
  - **`vendorRoleCan` takes an optional `tier`.** When supplied, the Pro+ scopes evaporate below
    Pro — the read-time-lapse pattern this repo already uses for entitlements, so a Pro store
    that downgrades to Solo cannot keep a Pro-only role working. The built-in four are not
    tier-gated.
  - ⚠ **The matrix is DESCRIPTIVE, not enforcing, and has zero authorization call sites.** It is
    documented as such in the module header. Real access control remains RLS
    (`current_vendor_ids`) + `ensureAdmin()`. The `canReadClientChat` / `canAccessBilling` /
    `canScheduleForTeam` / `canAssignBookings` / `seesTeamCalendar` wrappers were **deleted** —
    they were uncalled and read as guarantees.
- **`apps/web/lib/vendor-team-assignment-notice.ts`** (pure) — decides whether an assignment is a
  real hand-off and builds the notice. New `assignmentServiceDelta(prior, next)`: the notice now
  describes **what was ADDED**, not the resulting total. Previously, stripping 4 of a member's 5
  services told them *"You've been assigned 1 service"*, and a no-op save notified them too. Both
  are now silent. `apps/web/lib/vendor-team-assignment-notify.ts` is the server-only, flag-gated,
  fail-soft delivery half.
- **`apps/web/app/vendor-dashboard/team/actions.ts`** — `setVendorAgentServices` reads the prior
  assignment set (flag-gated, so flag-OFF query shape is unchanged) and notifies only on a
  non-empty delta. The parse-set decision moved into the pure lib (`parsableRoleSet`) so the
  flag-OFF guarantee is testable; a `'use server'` module cannot be imported by the unit runner.
- **`apps/web/app/vendor-dashboard/team/page.tsx`** — `rolesForRow` moved into the pure lib and
  tested; the Financial tone/copy removed.
- **Migration `20271004566590_vendor_team_role_secretary.sql`** — additive
  `ALTER TYPE … ADD VALUE IF NOT EXISTS` for `vendor_team_role` (`secretary` only) and
  `notification_type` (`vendor_assignment_received`). No existing row or constraint changes.
  Regenerated via `pnpm migration:new`: the previous prefix (`20271003612974`) sorted **before**
  `20271003734490_live_studio_moderator_control_access.sql` already on `main`, breaking the
  monotonic-prefix assumption.

### Verification

`pnpm run typecheck` exit 0. `pnpm test:unit` **3453 pass / 0 fail**. `pnpm test:db` run for this
file: 12 pass / 0 fail. Every behavioural fix was falsified by reverting it and observing the
failures: fail-closed + tier gate → **4 failed**; Financial descope (role re-added) → **8 failed**;
flag-OFF parse set (`enabled` ignored) → **2 failed**; assignment delta (reverted to "new total")
→ **5 failed**; migration moved aside → **5 DB tests failed**.

**RLS is FAIL-CLOSED for the new label, on purpose.** `public.current_vendor_ids(min_role)` ranks a
membership with `CASE role WHEN 'owner' THEN 4 … WHEN 'viewer' THEN 1 END` and no `ELSE`, so
`secretary` ranks NULL and never satisfies the comparison. Widening the enum grants **zero** RLS
access by itself, pinned by test. That is also why the flag stays off: **a Secretary member can
currently read nothing at all.** The role is expressible, not yet useful — extending the helper is
a deliberate follow-up, not a side effect of this branch.

**Known follow-ups (NOT done here):** `lib/vendor-role.ts` `ROLE_RANK` filters unknown roles out,
so a `secretary` member resolves to no vendor role in the nav and lands on the scoped
Overview + Customers nav (which matches the role's intent, and shows nothing while RLS returns
zero rows) — settle before flipping. `lib/notifications.ts`'s `NotificationType` union does not
yet carry `vendor_assignment_received` (cast at the seam, with a note); symptom at flip time is a
blank type badge in the notifications list (cosmetic, no crash, no email — the type is not on the
transactional allowlist). `lib/vendor-tier-caps.ts` `agentAccounts` counts seats BEYOND the founder
while the locked model quotes TOTAL seats (Free/Solo 1 · Pro 3 · Enterprise 10) — the discrepancy
is recorded as `LOCKED_TEAM_SEAT_TOTAL`, **not enforced**; owner to settle. No `.env.example` entry
for the new flag (deliberately omitted — one consolidating commit adds all the wave's flags).

SPEC IMPACT: `Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 7 — the **Financial role is not
implemented** and cannot be with the current RLS model. Owner decision needed (report § 4 Q12:
"Should the money person on a vendor's team be able to see client conversations?"). Recorded here
rather than silently shipped as a broken promise; the § 7 seat-count ambiguity is likewise
surfaced, not resolved.

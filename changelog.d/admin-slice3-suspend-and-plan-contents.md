## 2026-11-13 · feat(admin): suspend / unsuspend an account · plan contents become editable (admin slice 3)

Owner, 13 Nov 2026, verbatim: *"Yes, add both"* (DECISION_LOG "ADMIN GAINS ACCOUNT SUSPEND + EDITABLE PLAN CONTENTS"). Ported from the approved prototype `prototypes/admin_pub/` (people.html `cfm-suspend-person` · `date-suspend` · `cfm-unsuspend-person` · the Suspended list; catalogue.html › Plan contents `plan-pick` · `cfm-cap`) and its builder panel `#builder-2026-11-13`.

**Suspend an account (People › person page, and a ⏸ Suspended filter on the People list).**
- `users.suspended_at · suspended_until · suspended_reason`, added to `guard_users_privilege_columns` (a person can neither lift nor set their own hold — mutation-checked).
- `admin_suspend_account` / `admin_lift_account_suspension` (service role) stamp the person and suspend every shop they own in ONE transaction, the way the fraud desk does (`fraud_suspended_at` = the person's own `suspended_at`, `public_visibility = hidden`). The lift clears only the shops THIS hold stamped — a shop the fraud desk suspended keeps its own suspension.
- Sign-in: `auth.users.banned_until` through the GoTrue admin API (`ban_duration`) + every session revoked. A failed ban rolls the database half back. The sign-in card says "This account is on hold…" instead of GoTrue's "User is banned".
- Choices: 7 days · 30 days · until lifted; reasons as drawn; a note for admins they never see. Unsuspend, then Undo (the same reason and Until).
- One in-app notice each way (`account_suspended` · `account_unsuspended`, new enum values in their own migration). NOT on the email allowlist.
- "Lifts itself on the Until date": cron-free job `account-suspension-lift` (hourly) → `lift_expired_account_suspensions()`.

**Plan contents (Catalogue › Plan contents, `/admin/pricing?tab=plan-contents`).**
- `vendor_plan_contents` seeded from `TIER_CAPS` (seven allowances: cards per category, categories, team seats, branches, bookings per date per card, wait list, couples per date) + `vendor_plan_content_changes`, written by a trigger.
- `vendor_tier_limit()` reads the table first and falls back to its code arms (IMMUTABLE → STABLE). App readers follow it through `fetchLiveTierCaps` → `fetchCapsWithAddOns` (every service-card / category create gate), the Team seat gate and Add a branch.
- An edit is a REQUEST: `approve_plan_contents_change`, confirmed by a second admin in Approvals (like a price). The request names how many shops are over a lowered number; they keep what they have.
- Event plans (Free · Event Plus · Event Pro) shown read-only from `EVENT_PLANS` + the catalogue; the one column that already exists (`included_papic_credits`) is editable through the same approval.

Server-action budget 1249 → 1251 (two dispatchers instead of five exports). Exposure baseline regenerated: new reach is the three `users.suspended_*` columns (own row only, RLS), the public plan/key/value of `vendor_plan_contents` (column-scoped — never which admin changed it) and the admin-only history.

SPEC IMPACT: None — this builds the approved 2026-11-13 decision. Open owner questions are in the PR body.

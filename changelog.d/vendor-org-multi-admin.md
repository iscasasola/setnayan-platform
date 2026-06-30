## 2026-07-01 · feat(vendors): vendor account = multi-admin org/store model

A vendor account is now an **organization (store)** that user accounts join with
a role — not a person. Owner-locked 2026-07-01 (Q&A). Supersedes the 2026-05-12
single-`owner` role lock (iteration 0022 §2.6a). This is PR1 of 2 — governance +
subscription gate. PR2 (personal-token wallet re-key) follows.

**Governance (migration `20270401000000_vendor_org_multi_admin.sql`)**

- The privileged singular `owner` role is **retired**. `admin` is the new top
  role. Every `owner` row is backfilled to `admin`; the store creator
  auto-becomes `admin` (updated `handle_new_vendor_user` bootstrap). The `owner`
  enum value is retained (Postgres can't cheaply drop it) but is unused.
- RLS write on `vendor_team_members` opens from "the single profile owner" to
  **any admin** of the store (`current_vendor_ids('admin')`). The legacy
  owner-direct read/manage access from `20260821` is unaffected.
- **≥1-admin floor** + **peer-admin demotion vote**, both enforced at the DB so
  a direct client write can't bypass them:
  - `vendor_team_guard()` BEFORE UPDATE/DELETE trigger: blocks any demotion/
    removal that would leave the store with zero admins, and blocks demoting/
    removing *another* admin unless the vote-execution path authorized it (via a
    txn-local `app.vendor_admin_change_approved` GUC). Self-step-down is allowed.
  - `vendor_admin_motions` + `vendor_admin_motion_votes` tables (RLS: admins
    read; writes only through RPCs) + `vendor_propose_admin_motion` /
    `vendor_vote_admin_motion` / `vendor_cancel_admin_motion` /
    `_resolve_vendor_admin_motion`. Majority = `floor(N/2)+1` of the admins
    EXCLUDING the target — no 2-admin deadlock (the other admin passes it alone).
- **Subscription is admin-only.** `create_vendor_subscription` now resolves the
  store via `current_vendor_ids('admin')` and raises `NOT_VENDOR_ADMIN` for
  non-admins (was founder-only via `vendor_profiles.user_id`).

**UI**

- `/vendor-dashboard/team` is now ADMIN-gated (any admin manages it, not just the
  founder). Promotion to Admin and managing/removing agents & viewers stay
  unilateral; changing or removing a *peer admin* surfaces a "Start a vote" flow,
  with an "Admin votes" panel to Approve / Reject / Cancel. Admins can "Step
  down" themselves (blocked when they're the last admin).
- New admin-console read-only view `/admin/vendors/[id]/team` (members, roles,
  founder badge, open votes) linked from the admin vendors list.
- Account switcher already aggregates membership-based vendor access — no change.

SPEC IMPACT: DECISION_LOG row added 2026-07-01 (multi-admin org model);
memory `project_setnayan_vendor_org_governance` written. Iteration 0022 §2.6a is
superseded (the corpus iteration specs are REFERENCE/HISTORY per the 2026-06-07
source-of-truth flip; code is canonical).

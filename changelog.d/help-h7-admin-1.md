## 2026-11-14 · feat(help): H7 — 24 internal admin answers for the console, two-admin approvals, the money desk, and people and trust

Fills `apps/web/lib/help-admin/admin-1.ts` (admin areas A1–A17: Work, Money, People) with 24 internal answers in 4 topics, behind the B3 wall (imported only by `lib/help-admin.ts`). Each names its source in code; no § 9.1 limit, SLA hour or count is typed.

⚠ Found while writing — needs the owner, not copy: two of the eight § 9.1 two-admin promises are not enforced in code; a customer/event comp above the § 9.1 limit is granted at once by one admin; supplier plan prices and the bulk price tools save with one admin. The answer `admin-what-two-admins-really-enforce` says so. The existing admin topics in `lib/help-admin.ts` are largely stale and are left for the controller to assign.

SPEC IMPACT: None in this PR — but the § 9.1 enforcement gap is an owner decision (see the PR body).

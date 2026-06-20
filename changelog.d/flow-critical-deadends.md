## 2026-06-20 · fix(flow): two critical dead-ends — rejected vendor can re-apply, no-event inquiry routes to create (flow wave C/D)

Two of the user-flow audit's 6 **critical** dead-ends (both on now-uncontended surfaces):

- **Rejected vendor had no way to try again** (`vendor-dashboard/verify/page.tsx`). A `rejected` application showed only the `RejectedCard` (the reason) with no CTA — a terminal dead-end. Now the rejected branch also renders `StartApplicationCard`, so the vendor can start a fresh application. Safe: `ensureDraftApplication` selects only a `draft` row (none exists post-rejection) → it inserts a new draft; the old rejected row stays as history. `recommended` is derived from verification state (non-null for a rejected vendor; the card no-ops gracefully if ever null — never errors).
- **"Create your event first" with no path to create one** (`v/[slug]/_components/inquiry-composer.tsx`, both the manual-send and auto-send paths). A signed-in couple with no event hit a static error and was stranded. Both `no_event` branches now redirect to `/onboarding/wedding?next=<return>` (mirroring the existing `not_secured`→`/signup?next=` pattern) so they create an event and come back to inquire.

Other criticals: vendor-save-drops-feedback is auto-resolved by the toast bridge (#1927, `?saved=1` now toasts). Remaining: Pakanta `/orders/new` loop (payment-adjacent), accept-inquiry crash (needs typed-result conversion), onboarding "Sign in" path.

Verified: StartApplicationCard rendered in the rejected branch; 0 dead-end "Create your event first" messages left; 2 `no_event` redirects to `/onboarding/wedding`; both routes exist; both files pre-flighted clear of open PRs. tsc/lint/build via CI.

SPEC IMPACT: none (bug fix). Backlog: `02_Specifications/User_Flow_Audit_Backlog_2026-06-20.md`.

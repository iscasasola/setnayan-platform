## 2026-06-20 · feat(admin): confirm-guards on vendor-status + pricing-save actions (verify / pricing)

Wave 5 of the 2-step-down program — completes the admin-safety net started in #1880 (and the money-guards in #1897). The remaining single-click destructive admin actions now confirm before they fire.

- **`admin/verify`** — **Approve application** (→ Verified, public listing live + badge + Pro/Enterprise), **Approve visibility** (→ publicly bookable), **Reject** (→ Hidden, off browse), **Archive** (permanent). The reject-application + demote actions already sit behind a required-reason `<details>` dropdown, so they keep that friction and aren't re-wrapped.
- **`admin/pricing`** — **Save all changes** (ships prices LIVE to the public catalog) + **Create bundle** (a live product on /pricing + /for-vendors). Both wrapped in `ConfirmForm`; the bulk-save's reset button + required fields still behave.

The pricing wraps are confirm-on-save ONLY — no price value or logic changed, so the holistic pricing pass is untouched.

tsc 0; grep-verified 0 raw `<form>` left on the six guarded actions. No schema change.

SPEC IMPACT: admin console safety (iterations 0023 / 0006). Logged in `DECISION_LOG.md`.

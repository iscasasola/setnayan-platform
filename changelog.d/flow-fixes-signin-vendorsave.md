## 2026-06-22 · fix(flow): onboarding sign-in link + vendor profile-save returns to form + stale-comment cleanup

Three small flow fixes surfaced by the user-flow audit re-verification (most of the audit's "critical dead-ends" were already fixed or never bugs; these were the genuine remainder):

- **Onboarding account gate** — added an "Already have an account? Sign in" link (`/login?next=<RESUME_NEXT>`) to the `screen-account` section in `onboarding-shell.tsx`. Returning users (especially the email path) previously had no in-gate recovery affordance and were bounced to `/signup` with a raw Supabase "User already registered" error. `/login` already honours `next` + `?resume=1` restores the draft.
- **Vendor profile save** — `saveVendorProfile` now redirects/revalidates to `/vendor-dashboard/profile` (success `?saved=1` + all three error paths) instead of the dashboard home, so the vendor lands back on the edit form, whose `FormFlash` toast is already wired for `?saved`/`?error`. (`toggleVendorBackendCount` left on `/vendor-dashboard` — correct, it lives on the home page.)
- **Stale comment** — corrected the misleading note in `commitOnboardingWedding` that claimed only `catholic` is an active ceremony_type. The code preserves any `ALLOWED_CEREMONIES` faith verbatim; selectability is gated upstream by the picker's launch-status filter. Comment-only, no behaviour change.

SPEC IMPACT: None (bug/UX fixes; no schema, pricing, or feature-scope change).

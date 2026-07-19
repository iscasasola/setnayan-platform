## 2026-07-03 · fix(signup): skip the signup form for already-authenticated users

`/signup` had no session check — an already-logged-in user clicking a
"Register your business" CTA (`?as=vendor`) landed on a full email/password
account-creation form instead of vendor onboarding, and submitting it with
their own email just errored ("user already exists").

- `/signup` now detects an existing session first. An explicit `next` wins;
  otherwise `?as=vendor` sends straight to `/vendor-dashboard` (which already
  renders a fresh intake form when the user has no `vendor_profiles` row),
  and a plain already-authenticated hit falls back to `accountHomePath`
  (mirrors the `rawNext === '/'` shortcut in `login/actions.ts`).

SPEC IMPACT: None.

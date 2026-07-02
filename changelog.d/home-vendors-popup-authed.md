## 2026-07-03 · fix(home): homepage "Vendors" nav popup skips the pitch for signed-in users

The new homepage reskin's top-nav "Vendors" popup (`HomeOverlays.tsx`) always
linked its "Register your business · free" CTA to `/for-vendors` — the
marketing page — even for an already-authenticated visitor, who then has to
find and click that page's own register CTA to reach `/signup?as=vendor`
(which, per the prior fragment in this same window, now shortcuts a signed-in
user straight to `/vendor-dashboard`). Two hops to get somewhere that should
be one.

- The popup now resolves sign-in state client-side on mount (same pattern as
  the existing OAuth/device detection in this file — keeps the homepage
  cookie-free and ISR'd) and points the CTA at `/vendor-dashboard` directly
  when signed in, leaving the `/for-vendors` funnel unchanged for signed-out
  visitors.

SPEC IMPACT: None.

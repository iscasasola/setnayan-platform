## 2026-07-10 · feat(vendors): hero scroll-lock gate + login-first "List your business"

The `/vendors` hero is now a decision gate. On load the page scroll is locked
(`<html>`/`<body>` overflow hidden) so the visitor stays on the hero until they
choose one of the two CTAs. Added a small client island
`vendor-hero-gate.tsx` (the hero stays a Server Component with the LCP
`<Image>`): it locks scroll on mount, and

- "List your business for free" → `/open-shop` (releases the lock; navigation
  unmounts the hero anyway), and
- "How the model works ↓" → releases the lock and JS-smooth-scrolls to `#model`
  (respects `prefers-reduced-motion`; the app has no global `scroll-behavior`).

The lock is released on either CTA and on unmount, and is skipped entirely when
the page is deep-linked past the hero (a `#hash` is present on load), so a
visitor is never trapped.

"List your business for free" keeps `/open-shop` as its target — that route is
already the one smart, auth-aware entry point (login gate → existing-shop check
→ shop-limit check via `canOpenAnotherShop` → open their shop or the create
wizard), which is exactly the requested flow. Two owner decisions (2026-07-10):

- **One shop per user stays** (`MAX_SHOPS_PER_USER = 1`, `vendor_profiles.user_id
  UNIQUE`). Multi-shop ("show their businesses") remains the paused, owner-gated
  multi-business flip — NOT enabled here. So "reached your limit" = already owns
  their one shop → routed to `/vendor-dashboard/shop`.
- **Login-first** (was signup-first): the logged-out `/open-shop` redirect now
  goes to `/login?next=/open-shop&as=vendor` instead of `/signup?as=vendor`.
  Added an `as` hint to the login view model (`login-data.ts`) so the sign-in
  rail's "Create your vendor account" link keeps `as=vendor` → `/signup?as=vendor`
  (vendor radio preselected). Existing vendors sign in and return; new vendors
  can still create an account.

SPEC IMPACT: None (behavioral/routing; no pricing, SKU, or schema change; the
one-shop-per-user cap and paused multi-business decision are unchanged).

## 2026-07-01 · feat(login): full-bleed cinematic sign-in + intercepted overlay

Redesigned `/login` to the owner-supplied mockup "1c · Full-bleed · sign-in
rail": a photographic hero panel (the published homepage hero frame, falling
back to a gradient) carrying a floating pill nav + the "Keep your memories. Plan
your moments." headline, beside a frosted obsidian sign-in rail. Replaces the
prior light, centered v2.1 paper-and-ink card.

- **Two entry points, one scene.** The standalone `app/login/page.tsx` (hard
  load / refresh / SEO) and an INTERCEPTED route (`app/@modal/(.)login`) both
  reuse `LoginHero` + `SignInRail`. On soft navigation the rail slides in OVER
  the page you were on (homepage, /pricing, …) instead of leaving it — owner
  directive "moving the buttons of the website". Wired via a root `@modal`
  parallel slot (`app/layout.tsx` + `app/@modal/default.tsx` → null).
- **Entrance choreography.** Desktop: hero settles from the left while the rail
  slides in from the right edge. Mobile: the rail rises as a bottom sheet over
  the photo. CSS-driven (`.sn-login--enter` on the page, `[data-open]`
  transitions in the client `LoginOverlay`), with a `prefers-reduced-motion`
  fallback. Overlay reuses the shared `useModalA11y` primitive (focus trap +
  Escape + scroll-lock + focus restore); dismiss = `router.back()` (Escape /
  backdrop / close button), returning to the underlying page with scroll intact.
- **Dark = the OBSIDIAN end of the existing Clean Editorial palette**
  (`var(--m-ink)` #1E2229), not a new theme — coexists with the light-locked app
  surface. All radii route through `--m-r-*` tokens; champagne-gold accents.
- **Wiring preserved** per [[feedback_setnayan_button_preservation]]:
  `signInWithPassword` server action, OAuth-first placement, field
  names/ids/autocomplete/required, the error/check_email/ready/next searchParams
  contract + `safeNext()`, "Stay signed in" (default checked), Forgot, Create
  one. Shared `getLoginView()` computes the view model for both entry points.
- `OAuthButtonRow` / `DesktopOAuthButtons` gain an optional `variant="dark"`
  (translucent light-on-dark pills + white Apple glyph via `AppleIcon` fill);
  default `'light'` leaves `/signup` and every other call site unchanged.
- Added a "Show/Hide" password toggle (`PasswordField`) per the mockup. The
  mockup's "Email me a one-time link instead" is intentionally NOT rendered —
  the provider set is locked to email+password + Google/Apple (owner 2026-06-15);
  re-adding magic-link would reverse that lock.

Verified: typecheck + ESLint + radius/nav-icon/bottom-nav guards pass; `/login`,
`/`, and `/(.)login` compile with 0 errors; hard GET /login renders the
standalone page (no overlay), soft nav from / fires the interceptor (overlay
chunk in the RSC payload).

SPEC IMPACT: Notable visual/UX decision — logged at the bottom of `DECISION_LOG.md`
(2026-07-01). The dark cinematic login diverges from the retired v2.1 light
paper-and-ink login card; surfaced for owner sign-off. No schema / SKU / pricing
/ auth-flow change.

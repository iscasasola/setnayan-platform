## 2026-07-18 · refactor(login): one login everywhere — the greige "Sign in" card is now THE login on every path

Owner: "we only want 1 login. we want that popup and dimming the background
anywhere." The app had THREE sign-in surfaces from two directives a day apart:

1. the light **greige "Sign in to Setnayan." card** — the login website visitors
   actually see, opened from the marketing top-nav (HomeOverlays, owner
   2026-06-30 "login should be like the upper menu — a popup");
2. the **obsidian frosted rail** intercepted overlay (`app/@modal/(.)login`,
   owner 2026-07-01) on soft navigation to `/login`;
3. the **obsidian full-page** `/login` (hard load / refresh / deep-link / a
   server redirect off a protected route, e.g. `/vendor-dashboard`).

So a redirect dumped users on a dark full page that looked nothing like the
login they knew. Owner picked the **greige card** as the single login (it's the
one on the site, and — unlike the obsidian rail — it's what people recognize).

**Now the greige card renders everywhere**, from one shared component:

- **`sign-in-card.tsx`** (new) — the greige card body (title · OAuth · email/
  password form wired to the same `signInWithPassword` action · status banners),
  extracted so the marketing overlay and the routes render the identical card.
  Threads `next` through the hidden input + OAuth + signup link so a sign-in
  reached by a redirect forwards the user on afterward.
- **`sign-in-card-modal.tsx`** (new) — the greige `.home-reskin-ov` dimmed-glass
  shell as a route surface. `/login/page.tsx` renders it with `dismissHref="/"`
  (close/Esc/backdrop → home; NOT `router.back()`, which would bounce back to
  the protected page and re-redirect — a close loop).
- **`HomeOverlays.tsx`** — the marketing-nav `SignInOverlay` now renders the same
  `SignInCard` (was a bespoke inline copy). Its five now-unused auth imports
  dropped.
- **`login-data.ts`** — dropped `heroImageUrl` (the greige card has no hero
  panel), so `getLoginView` no longer fetches the hero video → the /login server
  work is now trivial.

**Removed (dead after the switch):**

- the obsidian login: `login-overlay.tsx`, `sign-in-rail.tsx`, `login-hero.tsx`,
  `password-field.tsx`, `login-loading-bridge.tsx`, and the ~490-line `.sn-login*`
  block in `globals.css`.
- **the `@modal` parallel-route slot + `(.)login` interceptor** (and its wiring
  in `layout.tsx`). With the marketing nav opening the card via HomeOverlays
  state (never the interceptor), and every `/login` navigation now showing the
  same card, the interceptor only added a **double-render**: at `/login` both the
  page slot and the `(.)login` slot matched and each mounted a card, stacking two
  identical dialogs (the top one hid the error banner of the lower one). Removing
  it → exactly one card per `/login`.
- **`login/loading.tsx`** — its Suspense boundary was cloning the page `<main>`
  into the streaming reveal container (`<div id="S:1">`), intermittently leaving
  two cards. The skeleton was also a stale light-card layout that no longer
  matched the greige card. Gone → stable single render. (`getLoginView` is now
  fast enough that no fallback is needed.)

Verified in-browser: `/login?next=/vendor-dashboard` (the original redirect) →
one greige card, `next` threaded into form + signup link; Close → `/` with scroll
unlocked, no loop; marketing-nav Sign in → same card dimming the homepage behind
it; error banner renders server-side (auth errors also surface via the app-wide
`ToastFromParams`, unchanged). typecheck + next lint clean.

SPEC IMPACT: None. Presentation/architecture unification of the existing login;
no schema, SKU, pricing, route contract, or auth-flow change. Owner design
decision logged at the bottom of the corpus DECISION_LOG.md.

## 2026-07-18 · chore(login): full login-surface audit + dead-obsidian cleanup

Owner follow-up: "delete the other login designs and make sure all login
connects to that." A whole-app audit of every login surface (169 entry points /
forms / modals / guards across `apps/web`) confirmed **all 159 real entry points
already reach the one greige card** — every `/login` link + every auth-guard
redirect. Cleaned up the remnants the audit surfaced:

- Removed the dead `variant="dark"` OAuth path from `oauth-button-row.tsx` +
  `desktop-oauth-buttons.tsx` — the light-on-dark treatment existed only for the
  deleted obsidian sign-in rail; zero call sites pass `dark` (every consumer uses
  the default light). The `dark` prop, `BTN_DARK`, and the obsidian-rail comments
  are gone; the light rendering is byte-identical.
- Scrubbed stale `app/@modal/(.)login` interceptor references from the docstrings
  of `sign-in-card.tsx`, `sign-in-card-modal.tsx`, `login/page.tsx`, and
  `login-data.ts` (the interceptor was removed earlier in this PR).

Surfaced to owner, NOT changed here: (1) `public/keynote/components/login-signup.jsx`
— an orphaned static design-deck mockup of a separate login+signup screen (no
actions/hrefs, not loaded by any keynote HTML); recommend deleting but it's a
deck artifact. (2) The onboarding "Your plan is ready" account gate renders its
own inline "Continue with Google" (signup/account-creation, conversion-optimized);
its "Already have an account? Sign in" link already points to `/login`.

SPEC IMPACT: None. Dead-code + docs cleanup; no behavior change.

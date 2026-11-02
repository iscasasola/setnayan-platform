## 2026-07-26 · fix(live-studio): stop the pilot-mode banner painting into live broadcasts

`<PilotModeBanner>` mounts from the root layout in **normal flow above `{children}`**, and
`/panood/program/[eventId]` — the chrome-less Live Studio program window a couple's OBS
window-captures — inherits that layout. With `NEXT_PUBLIC_PILOT_MODE_FREE_UNTIL` set, the banner
would push the program surface down and put a terracotta *"Pilot mode — every add-on and
subscription is free for testing"* bar into the couple's live broadcast, on a day that cannot be
re-run.

Third instance of the same bug class: `<CookieConsentBanner>` had no route gate at all (#3721),
`<DemoModeBanner>` was gated in that same sweep, and `<PilotModeBanner>` was missed by both.

- **Gated** on the existing `isBroadcastCaptureRoute()` predicate from `capture-safe-routes.ts` —
  no new predicate, no widening of the consent-suppression list (that list stays tiny for RA 10173
  reasons documented in that module).
- **Kept the server/client split deliberate.** The banner stays a server component so
  `@/lib/sku-catalog` (593 lines / ~19 KB of SKU + pricing data, server-only today) is not dragged
  into the client bundle of *every* route; only the new `pilot-mode-banner-client.tsx` — which does
  nothing but the pathname check — is client-side.
- **No first-paint flash.** `/panood/program/[eventId]` is dynamic (auth + DB per request), so
  `usePathname()` resolves during its server render and the banner is absent from the first HTML,
  not removed after hydration.
- **Added `global-banner-capture-gate.test.ts`** — a structural regression guard asserting every
  `*-banner` the root layout mounts reaches the capture gate, directly or via one local child.
  This package has no DOM/RTL, so a render test is not possible; the guard instead catches the bug
  that has now recurred three times — a new global banner added by someone with no reason to know
  the program window is being captured. Exemptions require an entry in `ALLOWED_UNGATED` with a
  stated reason.

Mutation-checked: reverting the fix fails both new tests (2/2); restoring it passes both.
Full unit suite 3792/3799 — the 7 failures (pHash native deps, vendor-deep-search) reproduce
identically on the unmodified base and are unrelated.

SPEC IMPACT: None. Behavioural fix within the Live Studio capture-surface rule already documented
in `capture-safe-routes.ts` and the `/panood/program/[eventId]` page header.

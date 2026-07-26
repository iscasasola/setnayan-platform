## 2026-07-26 · fix(privacy): suppress cookie banner on OBS-captured and full-screen Live Studio surfaces

`<CookieConsentBanner>` is mounted unconditionally from `app/layout.tsx` and had
no route gate at all — its only early return was `if (!mounted || decided)`. So
it rendered on **every** route, including `/panood/program/[eventId]`: the
chrome-less Live Studio PROGRAM OUTPUT window a couple's OBS **window-captures**
and streams to their YouTube. That page's own header states the rule it exists to
keep ("OBS captures the WINDOW, so any chrome in the tree is one layout change
away from leaking into the couple's broadcast"). A visitor who hadn't yet made a
cookie choice would have had the consent card composited into a live wedding
broadcast, on a day that cannot be re-run.

- **New** `apps/web/app/_components/capture-safe-routes.ts` — one pure,
  unit-tested module holding two named predicates, matching the existing
  `usePathname()` + route-predicate idiom (`marketing/site-chrome.tsx`'s
  `isMarketingRoute`, `nav/match-path.ts`). No new mechanism, no per-route
  conditional mounting in `layout.tsx`.
  - `isBroadcastCaptureRoute` → `/panood/program/` only ("an encoder is
    capturing these pixels"; nothing global may paint here).
  - `isConsentSuppressedRoute` → the above **plus** `/panood/control/`, Wave 8's
    `fixed inset-0` / 100dvh / `overflow-hidden` controller, where the banner
    (`fixed` bottom-right, `z-[70]`, shell is `z-0`) lands on the
    unlock-to-broadcast pill and the bottom control row on a surface that cannot
    scroll it away.
  - Prefixes are matched **with** their trailing slash, so a future
    `/panood/programme` can never be swallowed; bare `/panood/program` and
    `/panood/control` (404s, not capture surfaces) keep their banner.
- `cookie-consent-banner.tsx` self-gates via `usePathname()` +
  `isConsentSuppressedRoute`.
- `demo-mode-banner.tsx` — **same one-line class of bug, also fixed.** It renders
  in normal flow above `{children}`, so an admin with demo mode active would push
  the 100dvh program surface down and put a yellow "Demo mode active" bar into
  the broadcast. Now gated on `isBroadcastCaptureRoute`.
- `layout.tsx` — corrected a stale comment claiming the banner "self-hides on '/'
  where HomeReskin renders its own bespoke pill". No such pill exists (the only
  consent UI in the tree is this banner plus the `openConsentManager()` re-open
  links); the banner did **not** self-hide anywhere.
- **11 unit tests** in `capture-safe-routes.test.ts` (`node:test` via
  `pnpm --filter web test:unit`): suppressed on each excluded route · still
  renders on representative normal routes (`/`, `/pricing`, `/explore`,
  `/login`, `/cookies`, `/help/[slug]`, `/dashboard/[eventId]`,
  `/dashboard/[eventId]/studio/panood/broadcast`, `/vendor-dashboard`,
  `/admin/data-privacy`, a guest `/[slug]`) · exact-prefix boundary
  (`/panood/programme`, `/panood/controls`, `/embed/panood/program/…`) ·
  null/undefined/empty pathname.

**RA 10173 — `/panood/cam/[token]` is deliberately NOT excluded.** It is the
camera-join page a helper opens on their phone and is frequently the only
Setnayan page that person ever sees, so suppressing the banner there would mean
never asking them for consent at all. It is also not a capture surface: the
published media is a `getUserMedia` camera track, so DOM chrome never enters the
WebRTC stream. Audit of the route found no analytics call, no `captureEvent`, and
no non-essential storage of its own — but it inherits the global
`PostHogProvider`, which fires `$pageview` there for anyone who consented
earlier, so the surface is not intrinsically essential-cookies-only and the ask
must stay. Both excluded routes are reachable only by a signed-in control-room
member, who necessarily passed `/login` and the dashboard first — no consent
opportunity is lost.

**Known, NOT fixed here (different class):** `PilotModeBanner` is a *server*
component that renders an in-flow `<aside>` on every route when
`NEXT_PUBLIC_PILOT_MODE_FREE_UNTIL` is a future timestamp — it would appear in
the OBS capture the same way. The env var is currently unset in production
(verified: no "Pilot mode" string on the live homepage), so this is latent.
Fixing it means converting a deliberately-server component to a client one,
which adds an always-mounted client component to the shared bundle and
regresses the 2026-07-02 perf/ISR work — a scoped decision, not a one-liner.

SPEC IMPACT: None. No SKU, schema, price, or entitlement change; the consent
model, storage key, and PostHog gate are untouched. The exclusion is two
authenticated Live Studio operator surfaces where no person is being asked
anything.

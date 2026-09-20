## 2026-09-20 · fix(reliability): a tab older than the site says so, instead of going blank

On 2026-09-20 the owner's guest list went blank after a server action and stayed
blank. Measured: the action ran on the build his tab was loaded from (05:17Z),
the redirect's payload came back from a newer production build (05:58Z), and the
router rendered nothing. **No exception was thrown** — so no error boundary, no
Sentry event, and `lib/stale-bundle.ts` (which exists for exactly this class)
never fired, because it can only recognise the ChunkLoadError-shaped half. An
empty page that reads as an outage, on a site serving perfectly. He reasonably
concluded we were down. It had happened to him twice before.

- `lib/build-version.ts` — the pure decision: offer a reload only for two
  DIFFERENT, REAL, KNOWN build versions. Missing, blank, `'dev'` or unparseable
  on either side is silence. A version bar that cries wolf is ignored on the one
  day it is right.
- `app/_components/stale-tab-notice.tsx` — a bar with Reload and Not now,
  mounted ONCE in the root layout so it covers the couple's dashboard, the
  supplier workspace and a guest on an invitation. It checks on visibility and
  focus, never on an interval, because the moment that matters is when somebody
  comes back to a tab they left open. It **never reloads by itself** — a couple
  may be halfway through a guest's name. Dismissal is remembered per VERSION, so
  the next deploy may speak again.
- `next.config.ts` inlines `NEXT_PUBLIC_BUILD_VERSION` from
  `VERCEL_GIT_COMMIT_SHA` at build time, deliberately NOT relying on
  `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` (which exists only when a dashboard toggle
  nobody here checks is on — a value that silently becomes undefined would turn
  the notice off with nothing red).
- **No new route.** `/api/health` has reported the serving build's commit sha
  since iteration 0035, force-dynamic and no-store. The server half already
  existed.

⚠ **A MITIGATION, NOT A CURE.** Vercel Skew Protection PINS a tab to its own
deployment so the mismatch cannot happen. It is a project setting, not a
`next.config` option (`skewProtection: true` is the Astro adapter's API), and
`PATCH /projects {"skewProtectionMaxAge": 43200}` returned **404 `Skew
Protection not found`** — unavailable on this account's plan. If that changes,
turn it on AND keep this: a tab open longer than the pin's max age lands in
exactly the same place.

Guarded by `lib/build-version.test.ts` (8 tests). One trap recorded in the test
itself: asserting `VERCEL_GIT_COMMIT_SHA` is merely PRESENT in `next.config.ts`
passed a real sabotage, because that name also appears in the Sentry release
config — the assertion now anchors on the `NEXT_PUBLIC_BUILD_VERSION` binding.

SPEC IMPACT: None.

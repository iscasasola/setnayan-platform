## 2026-07-09 · feat(home): full-screen launcher — /dashboard splits out of the sidebar chrome

Owner "splash screen … we do not want side bar and menu bars here" (2026-07-09).
The account home becomes a chrome-less full-screen **launcher** — the picker
where everything is compiled — while events / shop / admin keep their own
dashboards.

- **Route restructure:** moved `/dashboard` out of the `(account)` SidebarShell
  group into a new `(launcher)` group with a minimal layout — a slim top bar
  ONLY (brand → /dashboard · notifications bell · account menu, all reusing the
  existing `Wordmark` / `UnreadBellBadge` / `AccountSwitcher`). The other account
  pages (People / Memories / Settings / Notifications / Setnayan AI) keep the
  `(account)` sidebar. The parent `dashboard/layout.tsx` (auth/gating/tour,
  already chrome-free) is unchanged.
- **Finished events hidden:** past + archived events collapse behind a "Show all
  events" toggle (`?show=all`, server-only — no client JS); upcoming shown by
  default with a "N finished events hidden" note. Replaces the old archived
  `<details>`.
- **Marketplace removed** from the launcher (it's an in-event vendor-discovery
  surface — `/explore` from an event — not an account destination).
- **New "Your account" tiles:** People · Memories Hub · Setnayan AI (the
  remaining sidebar items surfaced on the splash).
- **Ring on cards** is included here (flat bar → wine `ProgressRing`), which
  **supersedes PR #2939** — that PR edited the now-moved page and is being
  closed.
- Landing/redirect rule + all three flag-gated blocks (LifeFlash · AutoSurfaced ·
  Your story) preserved.

`tsc` + `next lint` clean; exactly one `/dashboard` index page (no parallel-page
collision). ⚠ Structural route change — the `production build` + Playwright e2e
CI checks are the validation gate.

SPEC IMPACT: None (UI / route architecture — the account home is now a
full-screen launcher; sub-surfaces keep their dashboards).

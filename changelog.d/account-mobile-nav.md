# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-05 · fix(account-nav): mobile navigation for the account surface (/dashboard)

The account surface had **no mobile nav.** `SidebarShell` hides the sidebar below `lg` (1024px) and expects each doorway to supply its own mobile chrome — but the account doorway supplied only the top-bar utilities (unread bell + account-switcher pill), so on a phone the account nav (**My Events · People · Memories Hub · Setnayan AI · Notifications · Profile & Settings · Marketplace · New event**) was **unreachable**. Owner report: "/dashboard should have both desktop and mobile version." (Event and vendor doorways already have mobile nav; the account one was missed.)

- **`app/dashboard/(account)/_components/account-mobile-nav.tsx`** (new · client) — a `< lg` hamburger in the top bar that opens a left drawer **reusing the exact desktop `<AccountSidebar>`** (so labels/icons stay registry-driven — no forked nav list). Closes on navigation (route change), backdrop tap, Escape, or the close button; locks body scroll while open; portaled to `document.body`; SSR-safe (mount guard).
- **`app/dashboard/(account)/layout.tsx`** — top bar restructured `justify-end` → `justify-between`: hamburger on the left (mobile only), the bell + switcher cluster pushed right via `ml-auto`. Desktop is unchanged (hamburger is `lg:hidden`; `ml-auto` keeps the bell right-aligned).

Verified: `tsc` clean · `next lint` clean · `lint:navicon` delegation guard passed (drawer consumes the registry via the reused `AccountSidebar`). Visual QA pending on the live mobile deploy (local Chrome was unavailable).

SPEC IMPACT: None — additive mobile chrome; brings the account surface to parity with the event/vendor doorways.

## 2026-10-16 · perf(dashboard): opening an event, round 2 — the name at the tap, the guest list draws what can be seen, prefetches reuse the chrome, the logo travels once

Follows #6572. Same method: a production build with the owner's rows replayed read-only (each read
timed at its production `pg_stat_statements` mean), Chromium 375 px, 4× CPU, Fast 4G.

- **Tap an event → its name at once.** The event layout (prefetched with the card) hands the Home's
  cover words (`lib/home-cover-words.ts`, the one function the Home also uses) to the Home's loading
  screen, which draws the real cover band — names and date line — at the tap instead of a skeleton
  under the loader veil (`home-loading-cover.tsx`, `home-cover-band.tsx`). Every other route that
  inherits the loading screen keeps its skeleton. 🔒
  `app/dashboard/[eventId]/opening-an-event-shows-its-name-at-once.test.ts`.
- **Guests draws what can be seen.** 79 of 85 rows sat in folded sections. A section's rows are drawn
  once it is open (and kept), at most 50 on the first draw, the rest at the first idle moment. Every
  count and select-all reads the data. 🔒 `app/dashboard/[eventId]/guests/the-guest-list-draws-what-can-be-seen.test.ts`.
- **In-app requests reuse the account chrome.** `lib/chrome-snapshot.ts`: a prefetch or in-app tap
  (`Sec-Fetch-Dest: empty`) reuses the switcher and rail slot this verified user's last render read
  (≤ 20 s, measured answers only, never across people). A page load and a Server Action always read
  fresh. (Next strips `Next-Router-Prefetch` from `headers()` and from middleware, so "prefetch only"
  could not be told.) The rail stops asking the auth server a second time per render. 🔒 `lib/a-prefetch-reuses-the-chrome.test.ts`.
- **The couple's logo travels once.** The rail gets the switcher's own (gated, inked) entry for the
  event, so the RSC payload sends the SVG once. 🔒 `app/dashboard/[eventId]/the-logo-travels-once.test.ts`.

SPEC IMPACT: None. (Product call recorded in the PR: on the Home's own path the loading screen shows
the real cover and no loader veil — the veil was hiding a page that already had its words.)

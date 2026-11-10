## 2026-11-10 · fix(build5-F2/F5/F6): one `<main>` per page · words say what they mean · the Create → Shop 429

**F2 — one landmark per page (Step 0 row 20).** Ten files rendered their own `<main>` inside a layout that already
renders one (`vendor-dashboard/layout.tsx` and `dashboard/[eventId]/layout.tsx`, both `<main className="sn-vt-page">`):
Plan › Booking fees, Deep search, Packages (list + one), the Plan screen, the supplier error boundary, the invitation
QR print sheet, the Panood join-card print sheet, the Papic crew poster, the seating error boundary. Each inner one is
now a `<div>` (classes unchanged; the print sheets' `main { padding: 0 }` still zeroes the layout's `<main>`). Guard:
`one-main-per-page.test.ts` › "no page or component inside a <main>-bearing layout renders its own <main>" —
layouts DISCOVERED, so a new one is covered the day it ships.

**F5 — words (Step 0 row 28, Step 0b item 9).**
- Your details › "What you do" read `pabati · day_of_coordinator`: `serviceLabels` names only the 30 coarse
  categories. `details-data.ts` now builds `serviceNames` — coarse label, else the admin's service name
  (`lib/service-labels.ts`, `canonical_service_schemas.display_name_en`), else the key's own words. Never the key.
- "1 new inquiries · 1 unread threads" (the supplier Clients badge label, `lib/nav-badges.ts`) → `countNoun`.
- "in 1 days" → new `inDaysWords` (`lib/format-number.ts`: today · tomorrow · in N days) in `whats-next.ts`,
  `whats-next-step.tsx`, `shop-permit-line.ts`, `year-moments-strip.tsx`.
- "1 days" countdowns → `countNoun` (onboarding date calendar + wedding countdown, Maker navigator, story spine,
  sample hub, the event dashboard's "N days to go" when the real-time count is 1).
- The ⚙ emoji in copy → `gearText()` (`app/_components/gear-text.tsx`) draws the real lucide `Settings` icon in its
  place: Settings-button tips (incl. "stay in Clients ⚙"), the Maker guide's "In Guests ⚙", the stage ⓘ and the
  tool-why toast. Customers/Dates "open ⚙ › How many a day" is left to #7423, which rewrites that line.
Guard: `lib/words-say-what-they-mean.test.ts`.

**F6 — the one 429 while creating a card (Step 0 row 29).** Supabase edge logs hold no 429 for 10 Nov; none of our
limiters is near its ceiling on one create (and Vercel keeps no status line to confirm one). The rate-limited request
that fits — the only one that fires exactly on that crash — is the browser's report to Sentry's ingest
(`ingest.us.sentry.io`, not reproduced, inferred): the Create → `/vendor-dashboard/shop?saved=1` stale-tab crash fired an error event plus a
full on-error replay, and Sentry answered 429. The crash itself survived #7424 because only `app/error.tsx` reloads a
stale tab, while supplier pages are caught first by `app/vendor-dashboard/error.tsx`. Now `recoverStaleTab()`
(`lib/stale-bundle.ts`) runs in the supplier, admin, seating and event-page boundaries, and `beforeSend` drops
stale-tab errors (`isRecoverableTabError`). Guard: `lib/a-stale-tab-is-recovered-at-every-boundary.test.ts`.

SPEC IMPACT: None — bug fixes to shipped screens; no ruling changed.

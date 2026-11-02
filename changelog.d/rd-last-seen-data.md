## 2026-10-02 · feat(speed): a host's five main pages show last-seen data at once, then refresh

Owner ruling (DECISION_LOG 2026-10-02, "LAST-SEEN DATA SHOWS INSTANTLY, THEN
REFRESHES — FOR A HOST'S MAIN PAGES (NEVER MONEY)"), the last piece after the
code preload (#6264) and the service worker keeping code on the phone (#6255).

- **Pages:** the host's Home, Guest list, Suppliers, Schedule and Event Details.
  Each page's own `loading.tsx` now paints what the host last saw there — from a
  small per-device store keyed by account + event + page (`lib/last-seen/`) —
  under a quiet "Updating…" mark, and the fresh server render replaces it. A
  short "Updated just now" follows. First visit, a filtered/deep-linked view, or
  nothing kept → the skeleton, as before.
- **Honest read:** the kept copy is `inert` (nothing on it can be tapped or read
  out as live). Offline, or no fresh page after 15 s → "Couldn't refresh — this
  is what you saw <when>, and it may be out of date" + Try again. A read that
  failed (the "—" / "Could not load" states) is never kept as last-seen.
- **Never money:** budgets, payments, prices, owed and paid always load fresh.
  The money parts of the five pages carry `data-money` (Home's Paid / Still
  owing line, the Budget tile, payments-due rows; Details' Budget and Purchases
  sections, supplier-payment and Papic-credit rows; Suppliers' Payments and
  Plans sections, prices, deposit steps and money tiles; Schedule's payment due
  dates) and are dropped from the snapshot; every peso figure is masked; and the
  store refuses, on write AND read, any snapshot still holding a ₱ / PHP figure
  or a `data-money` element. Suppliers' Budget part and the budget-accordion
  kill-switch path are not kept at all.
- **Privacy:** only what the page showed that signed-in host — links, form
  targets, hidden fields, hidden elements, field values and inline handlers are
  stripped. Sign-out empties the whole store: an inline script on the front
  door (where `/auth/sign-out` lands) and `/login` removes every `sn-ls:` key
  when no auth cookie is present. A different account on the same phone wipes
  the previous account's pages on its first read or save.
- **Size (measured, local `next build` with CI's env, base 60b949035 vs this
  branch):** shared bundle 205,949 → 205,966 B gzipped (+17 B: the one
  webpack-runtime entry for the lazy store; ceiling 206,848). Maker first load
  (`/dashboard/[eventId]/launch`) 477.0 → 478.9 KB (ceiling 505 KB) — the Maker
  embeds the Schedule page and sits under `[eventId]/loading.tsx`, so it carries
  the two small wrappers. The store + snapshot cleaner is ONE lazy chunk
  (`lib/last-seen/client.ts`, 1,909 B gzipped), loaded on idle by the event
  layout (skipped under Save-Data) and never in any page's first load. The wipe
  is inline HTML, not JS. No new server actions, no new routes; nothing is
  prefetched but that code.
- Each kept page lives at exactly one address (`lastSeenPath`), so the Schedule
  the Maker embeds inside `/launch` is never kept as "the Schedule page", and
  child routes that share `[eventId]/loading.tsx` never paint Home's copy.
- Tests: `apps/web/lib/last-seen/last-seen.test.ts` — cached-then-fresh render
  (real Fizz streaming), money never cached, sign-out clears, user-switch
  isolation, failed refresh says so; each sabotaged once.

SPEC IMPACT: None

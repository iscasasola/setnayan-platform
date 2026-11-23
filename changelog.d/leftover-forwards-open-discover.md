## 2026-11-23 · fix(home): the two leftover forwards open Discover, not Home

Owner, verbatim: *"Fix the two leftover forwards too"* — the two #8234 named.

- `/explore/categories` and the retired Real Stories tree (`/realstories`, `/realstories/<anything>`) forwarded to the bare `/`.
  Since a signed-in bare `/` opens Home (#8234), that took a signed-in person to Home. Both now forward to Discover's own
  door, `/?discover=1`, with any query they carry kept after it (`discoverForwardTarget`, `lib/legacy-redirects.ts`).
- The same hole, found by the new whole-map check: `/explore?utm_source=fb` forwarded to `/?utm_source=fb`, and tracking
  tags alone do not ask for Discover. `/explore` now puts the door first only in that case; every other `/explore` address
  forwards exactly as before.
- The tracking-tag rule moved into `lib/discover-href.ts` (`TRACKING_ONLY`, `asksForDiscover`). The sign-in rule and the
  redirect map now share one copy.
- Guard: `lib/a-signed-in-visit-to-the-root-opens-home.test.ts` fails if any retired address lands a signed-in person on
  Home, with or without tracking tags. Sabotage was run both ways (`/realstories` → `'/'`, `/explore/categories` → `'/'`),
  and each went RED.

SPEC IMPACT: None. This applies the 2026-11-16 ruling "/realstories → Discover" and the 2026-11-23 Home ruling.

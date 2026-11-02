## 2026-07-02 · fix(vendor): searchable, contained service picker on the Locked QR deal form

The Locked QR generator's "Service(s) — pick every service this deal covers"
rendered every one of the vendor's offerings as chips at once. For a vendor with
a large catalog (e.g. the founder shop offers ~150), that's a wall of raw
`snake_case` keys — overwhelming and hard to scan (owner: *"show all services
without bombarding too much"*).

- **Selected pinned on top** — chosen services show as removable chips (tap to
  remove), always visible even while searching.
- **Search box** — filter the vendor's offerings by name; placeholder shows the
  total count.
- **Height-capped list** — the remaining (unselected) services live in a
  `max-h-56` scroll area instead of expanding the page indefinitely.
- **Humanized labels** — raw taxonomy leaf keys (`arcade_retro_games`) render as
  "Arcade Retro Games" for display; already-named services pass through
  unchanged. Display-only — the submitted `service_refs` values are untouched.

No change to what's submitted or to `toggleService`/`serviceRefs` — purely the
picker's presentation. Scoped to `locked-qr-generator.tsx` (no overlap with the
open Locked-QR validation PR #2600, which touches only actions.ts + page.tsx).

Verified: `tsc --noEmit` clean · ESLint clean (production build runs in CI).

SPEC IMPACT: None (UI/UX of an existing picker).

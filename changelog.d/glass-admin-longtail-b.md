## 2026-07-15 · feat(admin): Glass PR-9b — admin standalone-queue sweep (rollout COMPLETE)

Atelier-Glass rollout **PR-9b** (rollout plan § 5 PR-9 / § 3.4 — split B of two,
the lightest mechanical admin pass). Applies the § 4 coherence contract to the
~38 remaining **standalone** admin routes (approvals, payouts, receipts,
reviews, taxonomy, integrity-watch, force-majeure, editorial-review, vendor-*,
venues, event-types, demo-vendors, … everything outside the six tabbed studios),
using the identical PR-8 idiom. Redirect stubs and the `MobileLandingGrid`
landings (directory/money/more — no page-local markup) were skipped.

- **Headings/eyebrows** — `m-eyebrow`/`m-display*` → `.sn-eye` + `.sn-h1`;
  uppercase `m-mono` section labels → `.sn-eye`.
- **Wrappers off `bg-cream`/`m-card`** — opaque panels → glass `.sn-tile`;
  repeated list-item `m-card`s → the no-blur `.sn-row` fallback; `<table>`/
  `divide-y` wrappers → ONE `.sn-tile !p-0`, **rows stay opaque** (§ 1.6 / R4:
  never glass the rows); dashed empties + small boxes → white wash. taxonomy's
  one nested-disclosure list demoted to a no-blur container (no nested glass).
- **Status pills → warm semantics** — `violet-*`/`purple-*`/`blue-*` →
  info-slate, `red-*` → danger, pairs → `--sn-*-soft`/solid. `terracotta`/`warn`/
  `success` aliased-gold/sage kept per R6 (post-PR-9 rename).

**This completes the App-Wide Atelier-Glass Rollout** (PR-0 → PR-9): the launcher,
event, account, vendor, and admin surfaces now all speak the shared glass/motion
language. Fences: `admin-nav-*`/sidebar/layout chrome + non-admin surfaces
untouched; no data-source, action, route, copy-fact, or flag change. Gates:
typecheck + ESLint + `lint:radius` + local production build all green.

SPEC IMPACT: None — visual contract sweep only (rollout plan § 5 PR-9).

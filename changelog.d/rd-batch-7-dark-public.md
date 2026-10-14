## 2026-10-14 · release(dark · public): batch 7 — dark mode 1–4 (hidden) + public site fixes

One release branch joining five finished draft PRs onto main a103decfd (after Suppliers batch 5 #6528), merged
`--no-ff` in order: #6500 dark 1 tokens (368c4ed2e) · #6501 dark 2 contrast (c5f1c6ba1) · #6502 dark 3 switch
(0c531297f) · #6499 public site fixes (2d6684377) · #6522 dark 4 shared controls (e732525c6; already held 1–3 + #6499).

Dark ships HIDDEN: `DARK_READY` (lib/appearance.ts) stays EMPTY, so picking Dark in Preferences changes nothing on
any route and no route paints `html.dark` without the switch. The guest Event Hub (`/[slug]`) never follows it.

Conflicts, each resolved keeping both sides:
- `scripts/lint-label-on-fill-contrast.mjs` (#6499 vs dark 2/3): taken from #6522's own join of the same two
  (7a3af516d) — main has not touched the file since #6522's base, so that resolution is exact.
- `scripts/guest-faint-ink.baseline.json`: main's EMPTY record kept (c4e1fa269 fixed the last 34 faint guest
  labels); regenerated — still 0.
- `scripts/port-control-baseline.json`, no-card, root map, screens: regenerated, never hand-merged.

Surfaces built on main since the dark drafts, judged by the dark contrast pass — two new dark misses, fixed at the
token level (Light unchanged: a `dark:` class applies only under `html.dark`, and `bg-raised` is #FFF in light):
- `app/_components/qr-card.tsx` — the centre "S" mark on the white QR plate: `dark:text-mulberry-700` (in dark that
  token IS the light accent #C24E25, so the mark reads on its white plate as it does in light).
- `launch/_components/studio-prints-six.tsx` — the upload pie's centre: `bg-white` → `bg-raised`.

Dark record (`label-contrast-dark.baseline.json`, may only go down): 321 (#6501/#6502) → 305 (#6522) → **302**
(main's own fixes since: details-city-pick, customers-calendar, customers-filter-bar). Light record unchanged (46 CSS
rules); guest faint-ink 0.

Migration: `20271267769389_users_theme_preference_light_by_default` (dark 3) sits below main's head
20271268832636 — applied by `db push --include-all`; PGlite replays in filename order (it depends on nothing later).

SPEC IMPACT: None of its own. Carried from dark 3: corpus `02_Specifications/Theme_System_Implementation_Spec.md`
line 5 (still says light-locked, picker removed) is updated WHEN THIS BATCH MERGES, not on a draft.

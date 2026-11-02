## 2026-07-09 · style(day-of): "Energy, not skin" density + serif pass on the guest day-of surface (R7)

Presentation-only reskin of the public guest landing / live-event day-of cards
(iteration 0031) to carry the editorial serif + denser stat reads of the
"Energy, not skin" direction — **within each couple's Mood Board palette**, not
the dashboard wine chrome.

- **`app/_components/progress-ring.tsx`** — added an optional `color` prop
  (defaults to the wine `--color-mulberry` token, so all existing dashboard
  usages are unchanged). Lets palette-themed guest surfaces drive the ring from
  their own accent variable instead of hardcoding dashboard wine.
- **`app/[slug]/_components/schedule-widget.tsx`** — serif "The run of show"
  heading; new **program-progress `ProgressRing`** (completed / total blocks)
  driven purely from data already computed on the page (the block-end instants
  vs. `now`), only shown once the program has begun, coloured from
  `rgb(var(--color-terracotta))` (the couple's accent); block labels → serif.
- **`app/[slug]/_components/your-seat-block.tsx`**, **`arrival-greeting.tsx`**,
  **`guest-hub-card.tsx`** (seat label + "coming up" label),
  **`live-wall-block.tsx`** (moment-count → compact serif stat),
  **`hub/page.tsx`** (seat / directions / camera / QR panel headings), and the
  identified-guest greeting in **`app/[slug]/page.tsx`** — serif-italic headings
  + tighter density.

Guardrails held: no logic / query / day-of-mode-gating changes; per-event
mood-board palette theming untouched (accents drive from the page's existing
`--color-*` palette variables, never `--color-mulberry`/`--m-nav-active`);
scope limited to `app/[slug]/**` day-of components + the shared `ProgressRing`
primitive (additive, non-breaking). No dashboard/vendor/admin surfaces touched.
Used the guest surface's established `font-serif` idiom (font-display alias)
rather than the marketing `.m-serif` class, to stay consistent with the
existing hub/our-story headings on these palette-themed pages.

SPEC IMPACT: None — presentation/typography only; no schema, pricing, SKU, or
behavioural change.

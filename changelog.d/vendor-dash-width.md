## 2026-07-01 · style(vendor-dashboard): widen content to match the top bar

Every vendor-dashboard page hardcoded its own content-width cap (`max-w-3xl` /
`4xl` / `5xl` / bare `6xl`), so the main content area drifted narrower than the
shared top bar — leaving a large empty gutter on wide monitors (most visible on
the Overview page at `max-w-5xl` = 1024px). Standardized every outer page
container onto the one width the codebase already treats as "wide" —
`max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl` — which is exactly the cap the
shared top bar (`sidebar-shell` topBar slot) already uses, so header and body
now align.

- 35 files: rewrote only the outer container's `max-w-*` token (anchored on
  `mx-auto w-full max-w-…`). Inner reading caps (`max-w-prose`, card/modal
  widths) and genuinely-narrow states (create forms, tier gates, empty states
  at `max-w-2xl`/`xl`) were left untouched — widening a single form column to
  1536px would be worse UX, not better.
- Pure Tailwind className swap (45 insert / 45 delete, 1:1); the classes are
  already in use across 38 other files, so no Tailwind config change and no
  runtime/type surface.

SPEC IMPACT: None (visual layout only — no locked decision, pricing, SKU, or
schema change).

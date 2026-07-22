## 2026-07-22 · fix(vendor-dashboard): convert Deep Search header to <PageMasthead>

The Deep Search surface (`app/vendor-dashboard/deep-search/page.tsx`, merged in
db6b017f8) hand-rolled its own page masthead — an `.sn-eye` eyebrow inside a
`<header>` — which is the exact drifted shape the `lint page masthead` CI check
guards against. It was merged without a baseline entry, so that non-blocking
check went red on every open PR.

- Converted the hand-rolled `<header>` (eyebrow + title + lede) and the separate
  "Plan & tokens" back link to the shared `<PageMasthead>` component: title →
  `title`, description → `lede`, back link → `back` + `backLabel`. The `.sn-eye`
  eyebrow is dropped by design (the component has no eyebrow prop). The page now
  matches every other dashboard masthead. Removed the now-unused `Link` and
  `ArrowLeft` imports.
- Removed the stale `app/admin/npc-readiness/page.tsx` entry from
  `scripts/page-masthead-baseline.json` — that page no longer hand-rolls a
  masthead, so the lint was reporting it as a win to lock in.
- `node scripts/lint-page-masthead.mjs` now exits 0.

SPEC IMPACT: None — CI lint cleanup, no product/behavior change.

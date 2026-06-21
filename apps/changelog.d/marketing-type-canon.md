## 2026-06-21 · feat(ux): complete the canonical marketing heading scale (VIS-9/10)

Added the missing lower tiers to the `.m-h-*` fluid heading family so marketing section/sub headings have a shared scale to adopt (the family previously only covered hero sizes; other pages hand-rolled `text-3xl sm:text-4xl` steps).

- `.m-h-sm` (section h2 · `clamp(1.875rem, 4.5vw, 2.25rem)` = 30→36px) + `.m-h-xs` (sub/card-title · 22→26px), both with the clamp + −2% tracking / 110% line-height tightening. `.m-h-sm` matches the dominant section-h2 endpoints, so adopting it is a no-size-change swap — just adds fluidity + the VIS-9 tightening.

Additive only — no live page changed (on inspection the marketing pages were already consistent; a blind full sweep of the public conversion surface was deliberately not done). `pnpm typecheck` 0 · `pnpm lint` 0.

SPEC IMPACT: None (additive heading utilities; no live surface changed).

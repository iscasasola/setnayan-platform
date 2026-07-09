## 2026-07-09 · feat(home): wire the hub's Life Story card to the Life-Flash route

The "Where to?" hub's Life Story hero now links to the real dedicated route —
`/dashboard/life-flash` (the flag-gated Life-Flash experience) — when
`lifeStoryEnabled()` is on. That route `notFound()`s while the rollout flag is
off, so in prod (flag off) the card keeps its Memories Hub
(`/dashboard/library`) fallback and never 404s.

No new route was needed — the dedicated Life Story surface already ships as
`/dashboard/life-flash` (Phase 1, built across PRs #2888–#2902). This is the
one-line wiring the earlier hub PR (#2929) left as a follow-up.

Note: when the flag IS on, the hub shows both the compact Life Story space card
and the richer flag-gated `LifeFlashHomeCard` (both → `/dashboard/life-flash`) —
a dev/preview-only redundancy to resolve when Life-Flash launches.

SPEC IMPACT: None.

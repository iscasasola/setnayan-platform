## 2026-07-09 · fix(launcher): drop the duplicate Life Story hero card when the flag is on

The account launcher (`apps/web/app/dashboard/(launcher)/page.tsx`) rendered the
Life Story surface **twice** when `lifeStoryEnabled()` was ON: a flat hero
`SpaceCard` in the "Your spaces" grid AND the richer `<LifeFlashHomeCard/>`
(face-row orbs + moment/people counts), both pointing at `/dashboard/life-flash`.

Fix: when the flag is ON, the richer `LifeFlashHomeCard` is now the SOLE Life
Story doorway — the flat hero `SpaceCard` is dropped from the `spaces` array.
When the flag is OFF (prod today), behavior is unchanged: the flat hero card
still renders as the fallback into the Memories Hub (`/dashboard/library`). The
`lifeStoryEnabled()` result is computed once (`lifeOn`) and reused at both the
build site and the render site.

Reversible: flip `lifeStoryEnabled()` (env `NEXT_PUBLIC_LIFE_STORY`) — the dedup only
affects the flag-ON dev/preview state; prod (flag off) is byte-identical.

SPEC IMPACT: None — UI composition only (removes a duplicate render; no schema,
pricing, SKU, or route change).

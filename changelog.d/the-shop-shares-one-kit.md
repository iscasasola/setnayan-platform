## 2026-08-24 · change(vendor): the supplier tree shares one presentational kit

W4-B, PR 1 of the supplier design port. The 63 supplier screens drew the same
shapes with hand-typed copies — the section card `rounded-2xl border
border-ink/10 bg-white` appeared 34 times in 47 spellings, the form-control
recipe 45 times, and `clients/[eventId]/page.tsx` declared a local `Card`
identical to the dominant recipe. Extracted (not designed) into
`app/vendor-dashboard/_components/kit.tsx` — `ShopCard` · `ShopStat` ·
`ShopPill` · `ShopNotice` · `ShopEmpty` · `shopInputClass` — the same
tree-scoped reasoning as the admin console's `ConsoleTable`. The pill/notice
tone maps settle the colour argument once: no tone emits bare
`text-terracotta` (the decorative gold, 3.37:1 — an AA fail as text); gold
text is `text-terracotta-700`, actions are `mulberry`.

First two screens converted: `clients/[eventId]/page.tsx` (local `Card`
retired, 10 input recipes) and `clients/surface.tsx` (6 input recipes).

New guard `app/vendor-dashboard/kit-convergence.test.ts`: a generated,
exact-both-ways baseline of hand-rolled recipe counts per file — a new copy
fails, a conversion fails until the baseline is regenerated in the same PR.
Comment-stripped before matching. Mutation-checked by printed occurrence
count: hand-rolled card added 0→1 RED · kit recipe gutted 3→2 RED ·
recipe-in-a-comment stays GREEN. Bare `text-terracotta` is deliberately NOT
ratcheted (gold on an icon is legal and ~213 mixed sites would make the guard
cry wolf); gold-as-text is corrected per file in the sweep PRs.

SPEC IMPACT: None.

## 2026-08-24 · fix(admin): stop painting admin text in the unreadable gold

`app/admin/**` used the Tailwind slot named `terracotta` — the atelier gold
`#A9834B`, 3.37:1 on white, an AA text-contrast failure — as TEXT color in 67
places across 30 files (checkbox ticks, badges, taxonomy pill labels, links,
active-state labels). Swept to `text-mulberry` (`#C24E25`, 4.61:1), which is
where the real CTA/action colour actually lives in this repo's inherited,
backwards slot naming. The 39 remaining `text-terracotta` occurrences are
left untouched — they colour icons only (non-text 3:1 floor, clears at
3.37:1), plus one already-correct documentation comment in
`referrals-surface.tsx`.

Added `app/admin/_components/admin-gold-is-not-text.test.ts`, mutation-tested
by occurrence count (three sabotage runs: a reverted text fix goes RED, an
icon-adjacent edit stays GREEN, a reverted checkbox fix goes RED), picked up
by the existing `test:unit` glob — no CI wiring needed. Admin has zero
`dark:` classes, so no dark-panel contrast variant applies here.

SPEC IMPACT: None.

## 2026-10-10 · fix(hub): a plate's ink no longer names itself — its edge, its printed frame and its soft inks draw again

`.sn-editorial .pahina-plate` and `.pahina-deckle` shadowed `--color-ink` as `var(--color-ink-on-plate, var(--color-ink))`.
A custom property that names itself, even in a fallback, is a cycle: the browser makes it invalid on that element. Since
2026-09-25 every plate a guest saw had lost its 1 px edge and its printed inner frame (both computed to `none`), drew
`text-ink/80` at full strength and `border-ink/15` as a full-ink line. Words still read, so nothing looked broken enough
to be noticed.

The page's ink now has a second name on the element that sets it (`--color-ink-page` on `.sn-editorial`), and both rules
fall back to that. Measured in Chromium on the lab's Details page: ink `44 42 41` (was invalid), edge `1px solid` at 10 %,
frame at 8 %, `text-ink/80` at 0.8, `border-ink/15` at 0.15; on a dark page with the plate's ink pinned, the plate reads
the pinned ink. Guard `lib/no-custom-property-names-itself.test.ts` sweeps every stylesheet under `app/` (sabotage seen
red). Not run on Safari.

SPEC IMPACT: None (restores the plate as designed — "printed inner hairline frame").

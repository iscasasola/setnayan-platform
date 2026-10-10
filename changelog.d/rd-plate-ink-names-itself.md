## 2026-10-10 · fix(hub): a plate's ink no longer names itself — a latent fault, shown on the Maker lab

`.sn-editorial .pahina-plate` and `.pahina-deckle` shadowed `--color-ink` as `var(--color-ink-on-plate, var(--color-ink))`.
A custom property that names itself is a cycle. Chromium reaches it only when `--color-ink-on-plate` is unset; there the
property becomes invalid on the plate: its 1 px edge and printed inner frame compute to `none`, `text-ink/80` draws at
full strength and `border-ink/15` as a full-ink line. Measured on the Maker lab's guest pages, which pin nothing.

NOT a live fault: real guest pages pin the plate's ink, so the fallback was never reached — the live sample event's plate
measured ink `0 0 0`, edge and frame `solid` on 2026-10-10. (The controller first reported this as "every plate since
2026-09-25"; a browser read of the live page corrected it.)

The page's ink now has a second name on the element that sets it (`--color-ink-page` on `.sn-editorial`) and both rules
fall back to that, so an unpinned surface draws the plate as designed too. After, on the lab: ink `44 42 41`, edge 10 %,
frame 8 %, `text-ink/80` at 0.8, `border-ink/15` at 0.15; with the ink pinned (as live does) nothing changes. Guard
`lib/no-custom-property-names-itself.test.ts` sweeps every stylesheet under `app/` (sabotage seen red). Not run on Safari.

SPEC IMPACT: None.

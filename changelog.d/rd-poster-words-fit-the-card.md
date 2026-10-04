## 2026-10-04 · fix(poster): every line of the paper card fits — the date is never cut off

The owner's dashboard event cards at phone width printed the date ("12 December 2026") across the card's foot. The paper invitation card (`app/_components/event-poster.module.css`, `.paper`) is a fixed-height flex column whose words were sized only in `cqw`, while the chips' clearance (7rem / 34 %), the private strip (`--sb`, 54 px) and the date's 13 px floor are fixed — so the stack ran out of room on almost every card size. Measured in a browser harness before the fix: 4–46 px over between a 128 px Maker thumbnail and a ~260 px desktop column, the date under the strip from 221 to 245 px.

The paper now sizes its words AS A GROUP from the room it has: the poster is a size container, `--room` is its content box (`100cqh` less the padding), the date (and on a wide card the eyebrow and invitation line) keep their px floors as `--small`, and every other size — circle, names, joiner, gaps — is `calc(var(--f) * n)` with `--f = min(1cqw, (room − small) / --big)`. A roomy card keeps the approved 1cqw look; a tight one shrinks the group. Every line has a unitless `line-height` (a taller face cannot grow the stack), the eyebrow and invitation line stay on one line, and the date never wraps (capped at 8.8cqw so "30 September 2026" fits). The circle keeps #6344's `flex-shrink: 0` + 1:1. The narrow-card rule that drops the eyebrow and invitation line under 220 px stays. Applies wherever `<EventPoster>` draws the paper: the dashboard card, Discover, the Maker preview.

Guard: `apps/web/lib/event-poster-fits.test.ts` evaluates the module's CSS at every card width from 120 to 420 px and at the six phone widths, and checks the date can never be clipped, shrunk or wrapped.

SPEC IMPACT: None.

## 2026-07-02 · style(vendor): de-card static readouts on My Shop (frames = clickable)

Extends the affordance rule "a frame means you can click it" from My Performance
(changelog `perf-frameless`) to the vendor **My Shop** storefront (owner:
*"make my shop decarded also"* → same rule: *"if the card is unclickable, remove
its framing, only place a frame if it is a button"* → full de-card).

Stripped the boxed-card treatment (`rounded-* border/bg` + orange-tint boxes)
from every **static** readout so content sits flat, held apart by the existing
`space-y-*` / grid-gap parents:

- The storefront **identity hero** — `rounded-2xl border` + orange-tint box
  dropped; the identity flows flat, its CTA buttons keep their own button frames.
- **"How you're doing"** metric tiles (the read-only pulse) — `rounded-xl` +
  orange-tint dropped, now bare tiles in the grid (mirrors the perf momentum tiles).
- **Team** member rows — `rounded-lg border bg-white` box dropped, flex layout kept.
- **Branch** HQ/location row — same box dropped.
- Branch **advisory notes** (coverage-map hint · Enterprise-only note) — the
  orange-tint rounded box dropped, now plain advisory text.
- The no-profile **empty-state** panel — frame dropped (its CTA keeps its own button frame).

Kept framed — ONLY genuinely interactive elements (owner: on My Performance only
interactive buttons carry a frame, the rest are frameless): the **Manage** tiles
(Profile/Website/Team/Branch — each a clickable expander) · the **Your services**
disclosure toggle · every form input / `<select>` / CTA button. Avatars + icon
badges + data-viz (the completeness ring, the reach map) are not "frames" and are
left as-is.

Verified: `tsc --noEmit` clean · `next lint` clean (only pre-existing warnings in
unrelated files). Production build gated by CI.

SPEC IMPACT: None (visual/affordance pass; no data, pricing, or logic change).
